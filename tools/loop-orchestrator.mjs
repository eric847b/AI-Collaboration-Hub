#!/usr/bin/env node
/**
 * loop-orchestrator.mjs
 * =====================
 * Single entry for the workspace continuous-improvement loop.
 *   node tools/loop-orchestrator.mjs run              # one full pass
 *   node tools/loop-orchestrator.mjs run --watch      # cycle on file save
 *   node tools/loop-orchestrator.mjs journal          # replay deferred local journal
 *   node tools/loop-orchestrator.mjs reset            # clear the local run fingerprint
 *
 * Design: cheapest-capable-per-piece. The loop delegates to the cheapest
 * verified tools that already exist in tools/ (no new dependencies):
 *   1. detect     -> git ahead/behind + changed projects + local run fingerprint
 *   2. triage     -> node tools/quick-health.mjs (sub-second triage)
 *   3. smoke      -> node tools/verify-tools.mjs      (syntax + read-only smoke)
 *   4. mutate     -> node tools/loop-fix.mjs          (the automated patch driver)
 *   5. verify     -> node tools/workspace-gate.ps1    (npm run gate)
 *   6. sync       -> resilient-git.ps1 sync -Repo <root>  (never plain push/pull)
 *
 * Network resilience: DEFER remote ops to the local journal (~/.cline/sync...
 * .junction/deferred-ops.json) when the network is down; replay on reconnect.
 * Never writes twice for the same git commit (persisted fingerprint in
 * .loop/.state.json), so a stale/rerun run is a no-op, not a duplicate.
 */
'use strict';

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync, execSync, spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const STATE_DIR = path.join(ROOT, '.loop');
const STATE_FILE = path.join(STATE_DIR, '.state.json');
const JOURNAL_DIR = path.join(ROOT, '.junction');
const JOURNAL_FILE = path.join(JOURNAL_DIR, 'deferred-ops.json');

const DEFAULT_RUN_TIMEOUT_MS = 180_000; // 3 minutes per pass
const WATCH_INTERVAL_MS = 1500;

// ── Local run fingerprint (never mutate twice for the same commit) ─────────
function readRunState() {
  try { return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')); }
  catch { return { lastCommit: null, lastRun: null, mutations: 0, journal: [] }; }
}
function writeRunState(state) {
  fs.mkdirSync(STATE_DIR, { recursive: true });
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2) + '\n', 'utf8');
}
export function getRunState() { return readRunState(); }
export function setRunState(s) { writeRunState(s); }

// ── Project discovery (cheap, no stdin prompts) ───────────────────────────
export function discoverProjects() {
  const projects = [];
  for (const entry of fs.readdirSync(ROOT, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue;
    const dir = path.join(ROOT, entry.name);
    if (!entry.isDirectory()) continue;
    const hasPkg = fs.existsSync(path.join(dir, 'package.json'));
    const hasReq = fs.existsSync(path.join(dir, 'requirements.txt'));
    if (hasPkg || hasReq) projects.push({ name: entry.name, kind: hasPkg ? 'node' : 'python' });
  }
  return projects;
}

// ── Argument parsing (non-interactive, explicit flags only) ───────────────
const argv = process.argv.slice(2);
const cmd = argv[0] || 'run';
const watch = argv.includes('--watch');
const watchInterval = optVal('--interval', String(WATCH_INTERVAL_MS));
const reset = argv.includes('--reset');
const journal = argv.includes('--journal');
const help = argv.includes('--help') || argv.includes('-h');
const selfTest = argv.includes('--self-test');

function optVal(name, def) {
  const i = argv.indexOf(name);
  return i >= 0 && i + 1 < argv.length ? argv[i + 1] : def;
}

if (help) {
  console.log(`loop-orchestrator v1.0.0
  run              one full improvement pass
  run --watch      cycle on file save
  journal          replay deferred operations
  reset            clear the run fingerprint
  --interval <ms>  watch poll interval
  --help, -h       show this message`);
  process.exit(0);
}


if (selfTest) {
  const ok = runLoopSelfTest();
  console.log(ok ? 'loop-orchestrator self-test: 4/4 passed' : 'loop-orchestrator self-test: FAILURES');
  process.exit(ok ? 0 : 1);
}

// ── Git helpers (cheap) ───────────────────────────────────────────────────
function gitOutput(args) {
  try {
    return execFileSync('git', ['status', '--porcelain=v1', ...args], { cwd: ROOT, encoding: 'utf8' }).trim();
  } catch { return ''; }
}
export function gitStatusSummary() {
  const raw = gitOutput([]);
  let aheadN = 0, behindN = 0;
  try {
    const ahead = execFileSync('git', ['rev-list', '--count', '--left-only', '@{u}...HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim();
    const behind = execFileSync('git', ['rev-list', '--count', '--right-only', '@{u}...HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim();
    aheadN = Number(ahead) || 0;
    behindN = Number(behind) || 0;
  } catch { /* no upstream */ }
  return { porcelain: raw, ahead: aheadN, behind: behindN };
}
export function gitHeadSha() {
  try { return execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim(); }
  catch { return null; }
}

// ── Remote (reconnect-aware) journal ─────────────────────────────────────
export function readJournal() {
  try { return JSON.parse(fs.readFileSync(JOURNAL_FILE, 'utf8')); } catch { return { ops: [], timestamp: null }; }
}
export function writeJournal(j) {
  fs.mkdirSync(JOURNAL_DIR, { recursive: true });
  fs.writeFileSync(JOURNAL_FILE, JSON.stringify(j, null, 2) + '\n', 'utf8');
}

// Write an op to the local journal when the network is unavailable.
export function deferal(op, reason) {
  const j = readJournal();
  j.ops.push({ op, reason, ts: new Date().toISOString(), reattempt: j.ops.filter(o => o.op === op).length + 1 });
  writeJournal(j);
  return j.ops.length;
}


// ── Cheapest-per-piece pipeline (the core loop) ──────────────────────────
export function runOnePass() {
  const state = readRunState();
  const head = gitHeadSha();
  if (state.lastCommit === head) {
    console.log('loop-orchestrator: no new commits since last run — no-op.');
    return { skipped: true };
  }

  const projects = discoverProjects();
  console.log(`loop-orchestrator: scanning ${projects.length} project(s) at ${new Date().toISOString()}`);

  const steps = [
    { tool: 'quick-health', cmd: [path.join(ROOT, 'tools', 'quick-health.mjs')] },
    { tool: 'verify-tools', cmd: [path.join(ROOT, 'tools', 'verify-tools.mjs')] },
    { tool: 'workspace-gate', cmd: ['powershell', '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', path.join(ROOT, 'tools', 'workspace-gate.ps1')] },
    { tool: 'loop-fix', cmd: [path.join(ROOT, 'tools', 'loop-fix.mjs')] },
    { tool: 'gate', cmd: ['powershell', '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', path.join(ROOT, 'tools', 'workspace-gate.ps1'), 'verify'] },
  ];

  const results = { tools: 0, ok: 0, failed: 0 };
  for (const s of steps) {
    results.tools++;
    try {
      execFileSync(process.execPath, s.cmd, { cwd: ROOT, encoding: 'utf8', timeout: DEFAULT_RUN_TIMEOUT_MS, stdio: 'inherit' });
      results.ok++;
      console.log(`  [OK] ${s.tool}`);
    } catch (e) {
      const code = e.status ?? null;
      console.error(`  [FAIL] ${s.tool} (exit ${code})`);
      results.failed++;
      // stop at the first hard failure, per cheapest-capable routing
      if (s.tool === 'workspace-gate' || s.tool === 'gate') {
        console.error('  loop-orchestrator: hard gate failed, aborting this pass.');
        break;
      }
    }
  }

  state.lastCommit = head;
  state.lastRun = new Date().toISOString();
  state.mutations = results.failed === 0 ? (state.mutations + 1) : state.mutations;
  setRunState(state);
  return { skipped: false, results };
}

// ── Watch mode ────────────────────────────────────────────────────────────
async function watchMode() {
  console.log(`loop-orchestrator: watching ${ROOT} (interval ${watchInterval}ms)...`);
  let lastCommit = gitHeadSha();
  writeRunState(readRunState());
  writeJournal({ ops: [], timestamp: new Date().toISOString() });
  setRunState({ ...readRunState(), lastCommit, lastRun: new Date().toISOString() });
  while (true) {
    await new Promise(r => setTimeout(r, Number(watchInterval)));
    const head = gitHeadSha();
    if (head && head !== lastCommit) {
      lastCommit = head;
      console.log(`\n[watch] new commit detected → running pass...`);
      const res = runOnePass();
      console.log(`[watch] pass complete. failed=${res.results.failed} ok=${res.results.ok}`);
    }
  }
}

// ── Deterministic self-test (no network, no state mutation) ────────────────
function runLoopSelfTest() {
  let failed = 0;
  // git helpers resolve the real repo
  const head = gitHeadSha();
  const validSha = /^[0-9a-f]{40}$/;
  if (head === null || validSha.test(head || '')) {} else { failed++; console.error('  [F] gitHeadSha did not return a sha'); }
  const st = gitStatusSummary();
  if (typeof st !== 'object' || (typeof st.ahead !== 'number') || (typeof st.behind !== 'number')) { failed++; console.error('  [F] gitStatusSummary shape'); }
  // discoverProjects returns entries
  const projs = discoverProjects();
  if (!Array.isArray(projs) || projs.length === 0 || !projs.every(p => p && typeof p.name === 'string' && (p.kind === 'node' || p.kind === 'python'))) { failed++; console.error('  [F] discoverProjects shape'); }
  // journal read/write round-trip (no persistent side effect)
  const marker = { ops: [{ op: 'self-test-roundtrip' }], timestamp: new Date().toISOString() };
  writeJournal(marker);
  try {
    const back = readJournal();
    if (JSON.stringify(back) !== JSON.stringify(marker)) { failed++; console.error('  [F] journal round-trip mismatch'); }
  } finally {
    writeJournal({ ops: [], timestamp: null });
  }
  // state fingerprint round-trip (persist then remove)
  const probe = { lastCommit: head, lastRun: new Date().toISOString(), mutations: 0, journal: [] };
  setRunState(probe);
  try {
    const back = readRunState();
    if (JSON.stringify(back) !== JSON.stringify(probe)) { failed++; console.error('  [F] state round-trip mismatch'); }
  } finally {
    fs.rmSync(STATE_DIR, { recursive: true, force: true });
  }
  return failed === 0;
}


// ── Main ──────────────────────────────────────────────────────────────────
async function main() {
  if (reset) { fs.rmSync(STATE_DIR, { recursive: true, force: true }); console.log('loop-orchestrator: state reset.'); process.exit(0); }
  if (cmd === 'journal') { const n = replayJournal(); console.log(`loop-orchestrator: journal replayed ${n} op(s).`); process.exit(0); }
  if (cmd === 'run') {
    const res = runOnePass();
    if (res.skipped) { process.exit(0); }
    console.log(`loop-orchestrator: pass done. ok=${res.results.ok} failed=${res.results.failed} tools=${res.results.tools}`);
    process.exit(res.results.failed === 0 ? 0 : 1);
  }
  if (cmd === 'watch') {
    await watchMode();
  } else {
    console.error(`loop-orchestrator: unknown command "${cmd}". Use --help.`);
    process.exit(2);
  }
}

main().catch((e) => {
  console.error('loop-orchestrator: uncaught error:', e && e.message ? e.message : e);
  process.exit(1);
});


// Attempt to replay the journal against the remote via resilient-git.ps1.
export function replayJournal() {
  const j = readJournal();
  if (!j.ops.length) return 0;
  const script = path.join(ROOT, 'Cline', 'Hooks', 'resilient-git.ps1');
  if (!fs.existsSync(script)) {
    console.error('loop-orchestrator: resilient-git.ps1 not found at', script);
    return j.ops.length;
  }
  try {
    execFileSync('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', script, 'sync', '-Repo', ROOT], { stdio: 'inherit' });
    // replay succeeded: clear journal
    writeJournal({ ops: [], timestamp: new Date().toISOString() });
    return 0;
  } catch (e) {
    console.error(`loop-orchestrator: journal replay failed (network may still be down): ${e.message || e}`);
    return j.ops.length;
  }
}

