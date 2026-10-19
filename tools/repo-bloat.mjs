#!/usr/bin/env node
// repo-bloat.mjs — tracked-repository bloat ledger + regression gate.
// v1: gates GIT-TRACKED bloat (the bytes that permanently live in history),
//     complementing bundle-trend.cjs which gates build-output dirs only.
//
//   node tools/repo-bloat.mjs collect  [--ledger ...] [--note "..."]   seed/extend baseline
//   node tools/repo-bloat.mjs check    [--ledger ...] [--threshold 10] [--max-file-mb 1] [--strict]
//   node tools/repo-bloat.mjs report   [--ledger ...] [--limit 5]
//   node tools/repo-bloat.mjs markdown [--ledger ...] [--limit 10] [--out <file>]
//
// WHY THIS EXISTS (Round 12 follow-on): bundle-trend.cjs measures what builds
// produce (dist/build/out), but nothing measured what gets COMMITTED. In a
// monorepo where several agent sessions commit concurrently, a 40 MB model
// file, a video export, a log dump, a nested node_modules or a re-added dist/
// tree becomes permanent git history the moment it is staged — and the only
// later remedy is a history rewrite. This tool measures every git-tracked file
// (via `git ls-files -z`, so ignored-but-present working files never count),
// appends snapshots to a ledger, and fails `check` when the repo GREW beyond
// the threshold or when offenders appear that the accepted set does not cover.
//
// RATCHET, NOT ABSOLUTE PURITY: the workspace already tracks 5 pattern
// offenders (2 zips + 3 files under ai-chat-websites/Userscripts/build/), and
// lockfiles alone approach the megabyte scale. A purity gate would be red on
// day one and get disabled. So, like the workflow-audit baseline ledger, the
// first `collect` SEEDS the accepted set; from then on `check` gates drift
// since the last collect — shrink never fails, new offenders and over-threshold
// growth do. `collect` is the deliberate, reviewed act that re-baselines.
//
// v4 house architecture (same as quick-health.mjs): run(argv, io, deps)
// RETURNS an exit code and never calls process.exit itself; every IO seam
// (measure/ledger read/write, clock, git sha) is injectable, so the self-test
// drives every CLI path IN-PROCESS with zero subprocess spawns.
//
// Exit codes: 0 ok/warn · 1 regression (or warn under --strict) · 2 bad usage
// or an unreadable ledger (never silently "no baseline" — that would turn
// corruption into a green run).
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TOOL_VERSION = '1.1.0';
const DEFAULT_LEDGER = path.join('docs', 'metrics', 'repo-bloat-history.json');
const DEFAULT_THRESHOLD_PCT = 10;
const DEFAULT_MAX_FILE_MB = 1;
const TOP_N = 10;

/**
 * Declared flag inventory (Round 12 D contract) — the single source for
 * --help and for parseArgs; check-flag-contract.mjs probes that every declared
 * flag is implemented and that every implemented flag is declared.
 */
const FLAG_DECLARATIONS = [
  ['--help', 'exit 0'], ['-h', 'alias of --help'],
  ['--version', 'exit 0'], ['-V', 'alias of --version'],
  ['--strict', 'promote warn to fail'],
  ['--quiet', 'verdict/summary line only (no detail rows)'],
  ['--ledger <path>', 'ledger file (default docs/metrics/repo-bloat-history.json)'],
  ['--note <text>', 'free-text note stored with a collect snapshot'],
  ['--threshold <pct>', 'max tolerated tracked-bytes growth, percent (default 10)'],
  ['--max-file-mb <mb>', 'per-file size cap in MiB (default 1)'],
  ['--limit <n>', 'snapshots shown by report/markdown (default 5/10)'],
  ['--out <file>', 'markdown output file (default: stdout)'],
  ['--self-test', 'run built-in checks and exit'],
];

/**
 * Bloat patterns: tracked paths that should not exist in git history at all.
 * Deliberately narrow — a wrong-positive here blocks a legitimate commit, so
 * only build outputs, dependency trees, caches, logs and binary blobs that
 * carry no reviewable diff make the list. Images/fonts under assets/ are NOT
 * listed (they are real source assets in this workspace); the --max-file-mb
 * cap is the backstop for a huge one of those.
 */
export const BLOAT_PATTERNS = [
  /(^|\/)node_modules\//,
  /(^|\/)(dist|build|out|\.output|release|coverage|\.next|\.vite|\.cache)\//,
  /\.(log|tmp|temp|swp|bak|orig|rej)$/,
  /\.(zip|tar|tgz|gz|bz2|7z|rar)$/,
  /\.(mp4|mov|avi|mkv|webm|wav|mp3|flac)$/,
  /\.(exe|dll|so|dylib|bin|dat|db|sqlite|wasm)$/,
  /(^|\/)\.DS_Store$|(^|\/)Thumbs\.db$/i,
  /(^|\/)npm-debug\.log|yarn-error\.log/,
];

export function human(bytes) {
  if (!Number.isFinite(bytes) || bytes < 0) return '?';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KiB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MiB`;
}

export function isBloatPath(rel) {
  return BLOAT_PATTERNS.some((re) => re.test(rel));
}

/** Strictly-greater: a file exactly AT the cap is not over the cap. */
export function isOverCap(bytes, maxFileMb) {
  return bytes > maxFileMb * 1024 * 1024;
}


/** Split `git ls-files -z` output; empty entries dropped. */
export function parseLsFiles(nulOutput) {
  return String(nulOutput ?? '').split('\0').filter(Boolean);
}

/**
 * Classify one tracked file into an offender record, or null when clean.
 * kind explains WHY it is an offender so report output is actionable.
 */
export function classify(rel, bytes, maxFileMb) {
  const pattern = isBloatPath(rel);
  const oversized = isOverCap(bytes, maxFileMb);
  if (!pattern && !oversized) return null;
  return { path: rel, bytes, kind: pattern && oversized ? 'pattern+oversized' : pattern ? 'pattern' : 'oversized' };
}

/** Build a measurement summary from [{path, bytes}] entries. */
export function summarizeFiles(entries, maxFileMb) {
  let bytes = 0;
  const offenders = [];
  const top = [];
  for (const e of entries) {
    bytes += e.bytes;
    const off = classify(e.path, e.bytes, maxFileMb);
    if (off) offenders.push(off);
    top.push(e);
  }
  top.sort((a, b) => b.bytes - a.bytes);
  return {
    files: entries.length,
    bytes,
    offenders: offenders.sort((a, b) => b.bytes - a.bytes),
    top: top.slice(0, TOP_N),
  };
}

/**
 * The verdict core — pure, fully injectable, and the mutation-probe surface.
 *
 * Rules, in order of authority:
 *   1. NO BASELINE  -> warn (never fail: nothing was ever recorded; never pass
 *      silently either, or a deleted ledger turns into a permanently green gate).
 *   2. GROWTH       -> fail when growth is STRICTLY greater than the threshold.
 *      Exactly-at-threshold passes; shrinking NEVER fails (a red gate that
 *      punishes improvement gets disabled by its operators).
 *   3. NEW OFFENDERS-> fail: offenders not in the accepted set are drift since
 *      the last collect (the ratchet — review them, then collect to accept).
 *   4. ACCEPTED     -> warn: known offenders still present (visible debt,
 *      fatal only under --strict).
 */
export function evaluate({ current, baseline, accepted, opts }) {
  const acceptedSet = new Set(accepted || []);
  const offenders = current.offenders || [];
  const newOffenders = offenders.filter((o) => !acceptedSet.has(o.path));
  const acceptedOffenders = offenders.filter((o) => acceptedSet.has(o.path));
  let growthPct = null;
  let regressed = false;
  if (baseline && baseline.bytes > 0) {
    growthPct = ((current.bytes - baseline.bytes) / baseline.bytes) * 100;
    regressed = growthPct > opts.thresholdPct;
  } else if (baseline) {
    // Baseline existed but recorded zero bytes: any growth from 0 is
    // unbounded by a percentage, so treat it as regression only if bytes
    // appear at all beyond the cap-driven offenders (defensive; should not
    // occur for a real git repo).
    growthPct = current.bytes > 0 ? Infinity : 0;
    regressed = current.bytes > 0 && offenders.length > 0;
  }
  let level;
  if (!baseline) level = 'warn';
  else if (regressed || newOffenders.length > 0) level = 'fail';
  else if (acceptedOffenders.length > 0) level = 'warn';
  else level = 'ok';
  return { level, growthPct, regressed, newOffenders, acceptedOffenders, hasBaseline: Boolean(baseline) };
}

/** `git ls-files -z` + statSync; injectable via deps.measure. */
export function measureReal(maxFileMb) {
  const out = execFileSync('git', ['ls-files', '-z'], {
    cwd: ROOT,
    maxBuffer: 64 * 1024 * 1024,
    encoding: 'buffer',
  });
  const entries = [];
  for (const rel of parseLsFiles(out.toString('utf8'))) {
    try {
      const st = fs.statSync(path.join(ROOT, rel));
      if (st.isFile()) entries.push({ path: rel.split(path.sep).join('/'), bytes: st.size });
    } catch {
      // tracked in the index but absent from the working tree (deleted-but-not-committed
      // or a sparse-checkout hole) — it carries no working bytes, skip it.
    }
  }
  return summarizeFiles(entries, maxFileMb);
}

export function gitSha() {
  try {
    return execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim();
  } catch {
    return 'unknown';
  }
}

/** Ledger IO. Missing file -> null baseline (warn path); malformed -> throws (exit 2). */
export function loadLedger(ledgerPath) {
  if (!fs.existsSync(ledgerPath)) return null;
  const text = fs.readFileSync(ledgerPath, 'utf8');
  let data;
  try {
    data = JSON.parse(text);
  } catch (e) {
    throw new Error(`ledger is not valid JSON: ${ledgerPath} (${e.message})`);
  }
  if (!data || !Array.isArray(data.snapshots)) {
    throw new Error(`ledger has no snapshots array: ${ledgerPath}`);
  }
  return data;
}

export function saveLedger(ledgerPath, data) {
  fs.mkdirSync(path.dirname(ledgerPath), { recursive: true });
  fs.writeFileSync(ledgerPath, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

export function parseArgs(argv) {
  const opts = {
    strict: false, quiet: false, selfTest: false, help: false, version: false,
    ledger: DEFAULT_LEDGER, note: null, thresholdPct: DEFAULT_THRESHOLD_PCT,
    maxFileMb: DEFAULT_MAX_FILE_MB, limit: null, out: null, command: null,
  };
  const errors = [];
  const positionals = [];
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const eq = arg.indexOf('=');
    const bare = eq === -1 ? arg : arg.slice(0, eq);
    const inlineValue = eq === -1 ? null : arg.slice(eq + 1);
    const takeValue = () => {
      if (inlineValue !== null) return inlineValue;
      i += 1;
      return i < argv.length ? argv[i] : null;
    };
    switch (bare) {
      case '--strict':
      case '--quiet':
      case '--self-test':
      case '--help':
      case '-h':
      case '--version':
      case '-V': {
        if (inlineValue !== null) { errors.push(`flag ${bare} takes no value`); break; }
        if (bare === '--strict') opts.strict = true;
        else if (bare === '--quiet') opts.quiet = true;
        else if (bare === '--self-test') opts.selfTest = true;
        else if (bare === '--help' || bare === '-h') opts.help = true;
        else opts.version = true;
        break;
      }
      case '--ledger': { const v = takeValue(); if (v === null || v.startsWith('--')) errors.push('--ledger requires a value'); else opts.ledger = v; break; }
      case '--note': { const v = takeValue(); if (v === null || v.startsWith('--')) errors.push('--note requires a value'); else opts.note = v; break; }
      case '--threshold': {
        const v = takeValue();
        const n = Number(v);
        if (v === null || v.startsWith('--') || !Number.isFinite(n) || n < 0) errors.push('--threshold requires a non-negative number');
        else opts.thresholdPct = n;
        break;
      }
      case '--max-file-mb': {
        const v = takeValue();
        const n = Number(v);
        if (v === null || v.startsWith('--') || !Number.isFinite(n) || n <= 0) errors.push('--max-file-mb requires a positive number');
        else opts.maxFileMb = n;
        break;
      }
      case '--limit': {
        const v = takeValue();
        const n = Number(v);
        if (v === null || v.startsWith('--') || !Number.isInteger(n) || n <= 0) errors.push('--limit requires a positive integer');
        else opts.limit = n;
        break;
      }
      case '--out': { const v = takeValue(); if (v === null || v.startsWith('--')) errors.push('--out requires a value'); else opts.out = v; break; }
      default: {
        if (bare.startsWith('-')) errors.push(`unknown flag: ${arg}`);
        else positionals.push(arg);
      }
    }
  }
  if (positionals.length > 1) errors.push(`unexpected argument: ${positionals[1]}`);
  if (positionals.length === 1) opts.command = positionals[0];
  return { opts, errors };
}

export function helpText() {
  let out = 'repo-bloat.mjs — tracked-repo bloat ledger + regression gate\n\n';
  out += 'Usage: node tools/repo-bloat.mjs <collect|check|report|markdown> [options]\n\nCommands:\n';
  out += '  collect   measure now, append a snapshot, seed/extend the accepted set\n';
  out += '  check     fail on growth beyond --threshold or offenders not yet accepted\n';
  out += '  report    print the last snapshots\n';
  out += '  markdown  render a markdown table (--out file, default stdout)\n\nOptions:\n';
  for (const [flag, desc] of FLAG_DECLARATIONS) out += `  ${flag.padEnd(18)} ${desc}\n`;
  return out + '\nExit codes: 0 ok/warn, 1 regression (or warn with --strict), 2 bad usage.\n';
}

const COMMANDS = new Set(['collect', 'check', 'report', 'markdown']);

/**
 * Command implementations. Every one takes (opts, io, deps) and RETURNS an
 * exit code. deps seams (measure/sha/now/readLedger/writeLedger) exist so the
 * self-test can run the full CLI in-process with zero git spawns.
 */
export function cmdCollect(opts, io, deps) {
  const current = deps.measure(opts.maxFileMb);
  let ledger;
  try {
    ledger = deps.readLedger(opts.ledger);
  } catch (e) {
    io.stderr(`repo-bloat: ${e.message}\n`);
    return 2;
  }
  if (!ledger) {
    ledger = { version: 1, tool: 'repo-bloat', accepted: [], snapshots: [] };
  }
  const prevBytes = ledger.snapshots.length ? ledger.snapshots[ledger.snapshots.length - 1].bytes : null;
  const snapshot = {
    timestamp: deps.now().toISOString(),
    gitSha: deps.sha(),
    note: opts.note || '',
    files: current.files,
    bytes: current.bytes,
    maxFileMb: opts.maxFileMb,
    offenders: current.offenders,
    top: current.top,
  };
  ledger.snapshots.push(snapshot);
  if (ledger.snapshots.length > 200) ledger.snapshots = ledger.snapshots.slice(-200);
  // Ratchet: accepted only ever GROWS here (union), so re-collecting can never
  // launder a removed offender's record out of the audit trail — it stays in
  // past snapshots; the accepted set simply stops gating it.
  const accepted = new Set(ledger.accepted || []);
  let seeded = 0;
  for (const o of current.offenders) {
    if (!accepted.has(o.path)) { accepted.add(o.path); seeded += 1; }
  }
  ledger.accepted = [...accepted].sort();
  try {
    deps.writeLedger(opts.ledger, ledger);
  } catch (e) {
    io.stderr(`repo-bloat: cannot write ledger: ${e.message}\n`);
    return 2;
  }
  const delta = prevBytes === null || prevBytes === 0 ? null : ((current.bytes - prevBytes) / prevBytes) * 100;
  io.stdout(
    `repo-bloat: snapshot written (${current.files} files, ${human(current.bytes)}` +
    `${delta === null ? '' : `, ${delta >= 0 ? '+' : ''}${delta.toFixed(1)}% vs prev`}) — ` +
    `${current.offenders.length} offender(s), ${seeded} newly accepted -> ${opts.ledger}\n`
  );
  return 0;
}

export function cmdCheck(opts, io, deps) {
  const current = deps.measure(opts.maxFileMb);
  let ledger = null;
  try {
    ledger = deps.readLedger(opts.ledger);
  } catch (e) {
    io.stderr(`repo-bloat: ${e.message}\n`);
    return 2;
  }
  const baseline = ledger && ledger.snapshots.length ? ledger.snapshots[ledger.snapshots.length - 1] : null;
  const verdict = evaluate({ current, baseline, accepted: ledger ? ledger.accepted : [], opts });
  if (!opts.quiet) io.stdout(`repo-bloat v${TOOL_VERSION} — check (ledger: ${opts.ledger})\n`);
  if (!baseline) {
    if (!opts.quiet) io.stdout('  no baseline recorded — run `collect` to seed the ledger (advisory until then)\n');
    if (!opts.quiet) io.stdout(`  current  ${current.files} files, ${human(current.bytes)}, ${current.offenders.length} offender(s)\n`);
    io.stdout('repo-bloat: WARN — no baseline; growth is ungated.\n');
    return 0;
  }
  const g = verdict.growthPct === null ? 'n/a' : `${verdict.growthPct >= 0 ? '+' : ''}${verdict.growthPct.toFixed(1)}%`;
  if (!opts.quiet) io.stdout(`  baseline ${baseline.files} files, ${human(baseline.bytes)} (${baseline.timestamp})\n`);
  if (!opts.quiet) io.stdout(`  current  ${current.files} files, ${human(current.bytes)} (growth ${g}, threshold ${opts.thresholdPct}%)\n`);
  if (!opts.quiet) {
    for (const o of verdict.newOffenders.slice(0, 10)) io.stdout(`  NEW      ${o.kind.padEnd(16)} ${human(o.bytes).padStart(10)}  ${o.path}\n`);
    if (verdict.newOffenders.length > 10) io.stdout(`  ... and ${verdict.newOffenders.length - 10} more new offenders\n`);
  }
  if (verdict.level === 'fail') {
    const why = [];
    if (verdict.regressed) why.push(`tracked bytes grew ${g} > threshold ${opts.thresholdPct}%`);
    if (verdict.newOffenders.length) why.push(`${verdict.newOffenders.length} new offender(s) not in the accepted set`);
    io.stdout(`repo-bloat: FAIL — ${why.join('; ')}.\n`);
    if (!opts.quiet) io.stdout('  fix: remove the bloat from git (git rm --cached <file>), or review it and re-run `collect` to accept.\n');
    return 1;
  }
  if (verdict.level === 'warn') {
    io.stdout(`repo-bloat: WARN — ${verdict.acceptedOffenders.length} accepted offender(s) still tracked (visible debt).\n`);
    return opts.strict ? 1 : 0;
  }
  io.stdout('repo-bloat: OK — no growth beyond threshold, no new offenders.\n');
  return 0;
}

export function cmdReport(opts, io, deps) {
  let ledger = null;
  try {
    ledger = deps.readLedger(opts.ledger);
  } catch (e) {
    io.stderr(`repo-bloat: ${e.message}\n`);
    return 2;
  }
  if (!ledger || !ledger.snapshots.length) {
    io.stdout(`repo-bloat: no snapshots in ${opts.ledger} — run \`collect\` first.\n`);
    return 0;
  }
  const limit = opts.limit ?? 5;
  const shown = ledger.snapshots.slice(-limit);
  io.stdout(`repo-bloat ledger: ${opts.ledger} (${ledger.snapshots.length} snapshot(s), accepted: ${(ledger.accepted || []).length})\n`);
  // Walk from the snapshot BEFORE the window so the first printed delta is
  // against its true predecessor, not against nothing.
  let prev = ledger.snapshots.length - shown.length > 0
    ? ledger.snapshots[ledger.snapshots.length - shown.length - 1]
    : null;
  for (const s of shown) {
    if (opts.quiet) { prev = s; continue; }
    const delta = prev === null || prev.bytes === 0 ? '   n/a' : `${(((s.bytes - prev.bytes) / prev.bytes) * 100).toFixed(1).padStart(6)}%`;
    io.stdout(`  ${s.timestamp}  ${String(s.files).padStart(5)} files  ${human(s.bytes).padStart(11)}  ${delta}${s.note ? `  ${s.note}` : ''}\n`);
    prev = s;
  }
  return 0;
}

export function cmdMarkdown(opts, io, deps) {
  let ledger = null;
  try {
    ledger = deps.readLedger(opts.ledger);
  } catch (e) {
    io.stderr(`repo-bloat: ${e.message}\n`);
    return 2;
  }
  if (!ledger || !ledger.snapshots.length) {
    io.stdout(`repo-bloat: no snapshots in ${opts.ledger} — run \`collect\` first.\n`);
    return 0;
  }
  const limit = opts.limit ?? 10;
  const shown = ledger.snapshots.slice(-limit);
  const lines = [
    '# Repo bloat trend',
    '',
    `Generated from \`${opts.ledger}\` — \`node tools/repo-bloat.mjs markdown\`.`,
    '',
    '| Snapshot | Files | Tracked bytes | Δ vs prev | Offenders | Note |',
    '|----------|------:|--------------:|----------:|----------:|------|',
  ];
  let prev = ledger.snapshots.length - shown.length > 0
    ? ledger.snapshots[ledger.snapshots.length - shown.length - 1]
    : null;
  for (const s of shown) {
    const delta = prev === null || prev.bytes === 0 ? 'n/a' : `${(((s.bytes - prev.bytes) / prev.bytes) * 100).toFixed(1)}%`;
    lines.push(`| ${s.timestamp} | ${s.files} | ${human(s.bytes)} | ${delta} | ${s.offenders ? s.offenders.length : 0} | ${(s.note || '').replace(/\|/g, '\\|')} |`);
    prev = s;
  }
  lines.push('', `Accepted offenders (ratchet baseline): ${(ledger.accepted || []).length}`, '');
  const text = lines.join('\n');
  if (opts.out) {
    try {
      deps.writeFile(opts.out, text);
    } catch (e) {
      io.stderr(`repo-bloat: cannot write ${opts.out}: ${e.message}\n`);
      return 2;
    }
    io.stdout(`repo-bloat: markdown written -> ${opts.out}\n`);
    return 0;
  }
  io.stdout(text + '\n');
  return 0;
}

export const realDeps = {
  measure: (maxFileMb) => measureReal(maxFileMb),
  sha: () => gitSha(),
  now: () => new Date(),
  readLedger: (p) => loadLedger(path.resolve(ROOT, p)),
  writeLedger: (p, data) => saveLedger(path.resolve(ROOT, p), data),
  writeFile: (p, text) => {
    const abs = path.resolve(ROOT, p);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, text, 'utf8');
  },
};

/**
 * The single CLI entry point. RETURNS an exit code (never process.exit) so the
 * self-test can drive every path in-process. `deps` defaults to the real git /
 * filesystem implementations; tests inject fakes with zero spawns.
 */
export function run(argv, io = { stdout: (s) => process.stdout.write(s), stderr: (s) => process.stderr.write(s) }, deps = realDeps) {
  const { opts, errors } = parseArgs(argv);
  if (errors.length) {
    io.stderr(`repo-bloat: ${errors.join('; ')}\n`);
    io.stderr('run `node tools/repo-bloat.mjs --help`\n');
    return 2;
  }
  if (opts.help) { io.stdout(helpText()); return 0; }
  if (opts.version) { io.stdout(`repo-bloat ${TOOL_VERSION}\n`); return 0; }
  if (opts.selfTest) return runSelfTest(io);
  if (!opts.command) {
    io.stderr('repo-bloat: missing command — use collect | check | report | markdown (or --help)\n');
    return 2;
  }
  if (!COMMANDS.has(opts.command)) {
    io.stderr(`repo-bloat: unknown command "${opts.command}" — use collect | check | report | markdown (or --help)\n`);
    return 2;
  }
  const handlers = { collect: cmdCollect, check: cmdCheck, report: cmdReport, markdown: cmdMarkdown };
  return handlers[opts.command](opts, io, deps);
}

// ---- self-test (in-process, zero spawns) ------------------------------------

export function runSelfTest(io) {
  let passed = 0;
  let failed = 0;
  const check = (name, cond, extra = '') => {
    if (cond) { passed += 1; io.stdout(`  ok   ${name}\n`); }
    else { failed += 1; io.stdout(`  FAIL ${name}${extra ? ` — ${extra}` : ''}\n`); }
  };
  const runCapture = (argv, deps = undefined) => {
    const out = { stdout: '', stderr: '' };
    const cap = { stdout: (s) => { out.stdout += s; }, stderr: (s) => { out.stderr += s; } };
    const code = run(argv, cap, deps);
    return { code, out: out.stdout, err: out.stderr };
  };
  // Fake world: a small repo controlled via closures — zero git spawns.
  const fakeWorld = ({ bytes = 1000, offenders = [], ledger = null } = {}) => {
    const written = { ledger: null, file: null };
    const deps = {
      measure: () => ({ files: 2, bytes, offenders: offenders.map((o) => ({ ...o })), top: [] }),
      sha: () => 'fake-sha',
      now: () => new Date('2026-10-17T00:00:00Z'),
      readLedger: () => ledger,
      writeLedger: (p, data) => { written.ledger = { path: p, data }; },
      writeFile: (p, text) => { written.file = { path: p, text }; },
    };
    return { deps, written };
  };
  const snap = (bytes, offenders = []) => ({
    timestamp: '2026-10-01T00:00:00Z', gitSha: 'x', note: '', files: 2, bytes,
    maxFileMb: 1, offenders, top: [],
  });

  // D-contract: help / version.
  const help = runCapture(['--help']);
  check('help exits 0', help.code === 0, `got ${help.code}`);
  check('help lists Usage', help.out.includes('Usage:'));
  check('help documents every declared flag', FLAG_DECLARATIONS.every(([f]) => help.out.includes(f.split(' ')[0])));
  check('-h also exits 0', runCapture(['-h']).code === 0);
  const ver = runCapture(['--version']);
  check('--version exits 0', ver.code === 0);
  check('--version prints version', ver.out.includes(TOOL_VERSION));
  check('-V also exits 0', runCapture(['-V']).code === 0);

  // D-contract: bad usage exits 2, never runs a command.
  for (const bad of [['--bogus'], ['check', '--threshold'], ['check', '--threshold', 'abc'],
    ['check', '--limit', '1.5'], ['--strict=1'], ['--quiet=1', 'check'], ['collect', 'extra', 'positional']]) {
    const r = runCapture(bad);
    check(`bad usage exits 2: ${bad.join(' ')}`, r.code === 2, `got ${r.code}`);
  }
  check('missing command exits 2', runCapture([]).code === 2);
  check('unknown command exits 2', runCapture(['frobnicate']).code === 2);
  check('--flag=value form accepted', runCapture(['report', '--limit=1', '--ledger=nope.json']).code === 0);

  // Pure helpers (mutation-bite targets).
  check('human bytes', human(512) === '512 B');
  check('human KiB', human(2048) === '2.0 KiB');
  check('human MiB', human(3 * 1024 * 1024) === '3.00 MiB');
  check('human rejects garbage', human(NaN) === '?');
  check('isBloatPath flags a zip', isBloatPath('ai-chat-websites/Archive/x.zip'));
  check('isBloatPath flags dist/', isBloatPath('app/dist/assets/app.js'));
  check('isBloatPath flags node_modules/', isBloatPath('app/node_modules/x/y.js'));
  check('isBloatPath flags coverage/', isBloatPath('app/coverage/lcov.info'));
  check('isBloatPath flags .log', isBloatPath('debug.log'));
  check('isBloatPath ignores source', !isBloatPath('app/src/main.tsx'));
  check('isBloatPath ignores assets png', !isBloatPath('third-door-blink-controller/assets/images/icon.png'));
  check('isOverCap strictly greater (at cap = false)', !isOverCap(1024 * 1024, 1));
  check('isOverCap above cap = true', isOverCap(1024 * 1024 + 1, 1));
  const parsed = parseLsFiles('a.js\0b.js\0\0');
  check('parseLsFiles splits NUL and drops empties', parsed.length === 2 && parsed[0] === 'a.js');
  const summ = summarizeFiles([{ path: 'x/y.zip', bytes: 10 }, { path: 'x/main.ts', bytes: 5 }], 1);
  check('summarizeFiles totals + offender', summ.files === 2 && summ.bytes === 15 && summ.offenders.length === 1);
  check('classify kind pattern', classify('a/b.zip', 10, 1).kind === 'pattern');
  check('classify kind oversized', classify('a/b.png', 2 * 1024 * 1024, 1).kind === 'oversized');
  check('classify null when clean', classify('a/b.png', 10, 1) === null);

  // evaluate: the growth boundary IS the gate — exactly-at-threshold passes.
  const cur = { files: 2, bytes: 110, offenders: [] };
  const base = snap(100);
  const at = evaluate({ current: cur, baseline: base, accepted: [], opts: { thresholdPct: 10 } });
  check('growth EXACTLY at threshold is not regressed', at.regressed === false && at.level === 'ok', JSON.stringify(at));
  const over = evaluate({ current: { ...cur, bytes: 110.01 }, baseline: base, accepted: [], opts: { thresholdPct: 10 } });
  check('growth above threshold fails', over.regressed === true && over.level === 'fail');
  const shrink = evaluate({ current: { ...cur, bytes: 50 }, baseline: base, accepted: [], opts: { thresholdPct: 10 } });
  check('shrink never fails', shrink.regressed === false && shrink.level === 'ok');
  const off = { path: 'a/b.zip', bytes: 10, kind: 'pattern' };
  const withOff = { ...cur, offenders: [off] };
  const newOff = evaluate({ current: withOff, baseline: base, accepted: [], opts: { thresholdPct: 10 } });
  check('new offender fails', newOff.level === 'fail' && newOff.newOffenders.length === 1);
  const accOff = evaluate({ current: withOff, baseline: base, accepted: ['a/b.zip'], opts: { thresholdPct: 10 } });
  check('accepted offender warns', accOff.level === 'warn' && accOff.acceptedOffenders.length === 1 && accOff.newOffenders.length === 0);
  const none = evaluate({ current: cur, baseline: base, accepted: [], opts: { thresholdPct: 10 } });
  check('clean repo is ok', none.level === 'ok');
  const noBase = evaluate({ current: cur, baseline: null, accepted: [], opts: { thresholdPct: 10 } });
  check('no baseline warns (never silent pass/fail)', noBase.level === 'warn' && noBase.hasBaseline === false);

  // run() end-to-end against the fake world — still zero spawns.
  {
    const w = fakeWorld({ bytes: 1000 });
    const r = runCapture(['collect', '--ledger', 'L.json', '--note', 'seed'], w.deps);
    check('collect exits 0', r.code === 0, r.err);
    check('collect writes ledger with snapshot', Boolean(w.written.ledger && w.written.ledger.data.snapshots.length === 1));
    check('collect seeds accepted array', Array.isArray(w.written.ledger.data.accepted));
    check('collect records note', w.written.ledger.data.snapshots[0].note === 'seed');
    check('collect records git sha', w.written.ledger.data.snapshots[0].gitSha === 'fake-sha');
  }
  {
    const seeded = { version: 1, tool: 'repo-bloat', accepted: ['a/b.zip'], snapshots: [snap(1000, [{ path: 'a/b.zip', bytes: 10, kind: 'pattern' }])] };
    const ok = runCapture(['check', '--ledger', 'L.json'], fakeWorld({ bytes: 1000, offenders: [{ path: 'a/b.zip', bytes: 10, kind: 'pattern' }], ledger: seeded }).deps);
    check('check passes against matching baseline', ok.code === 0, ok.out + ok.err);
    const bad = runCapture(['check', '--ledger', 'L.json'], fakeWorld({ bytes: 2000, offenders: [{ path: 'a/b.zip', bytes: 10, kind: 'pattern' }], ledger: seeded }).deps);
    check('check fails on >threshold growth', bad.code === 1, bad.out);
    check('check FAIL line names the cause', bad.out.includes('FAIL') && bad.out.includes('100.0%'));
    const newFail = runCapture(['check', '--ledger', 'L.json'], fakeWorld({ bytes: 1000, offenders: [{ path: 'new/big.zip', bytes: 10, kind: 'pattern' }], ledger: seeded }).deps);
    check('check fails on new offender', newFail.code === 1 && newFail.out.includes('new/big.zip'));
    const strict = runCapture(['check', '--ledger', 'L.json', '--strict'], fakeWorld({ bytes: 1000, offenders: [{ path: 'a/b.zip', bytes: 10, kind: 'pattern' }], ledger: seeded }).deps);
    check('accepted offender: --strict exits 1', strict.code === 1);
    const nonStrict = runCapture(['check', '--ledger', 'L.json'], fakeWorld({ bytes: 1000, offenders: [{ path: 'a/b.zip', bytes: 10, kind: 'pattern' }], ledger: seeded }).deps);
    check('same offenders without --strict stay 0', nonStrict.code === 0);
    const quietOk = runCapture(['check', '--ledger', 'L.json', '--quiet'], fakeWorld({ bytes: 1000, offenders: [{ path: 'a/b.zip', bytes: 10, kind: 'pattern' }], ledger: seeded }).deps);
    check('check --quiet prints verdict only (no detail rows)', quietOk.code === 0 && quietOk.out.startsWith('repo-bloat:') && !quietOk.out.includes('baseline '));
    const quietBad = runCapture(['check', '--ledger', 'L.json', '--quiet'], fakeWorld({ bytes: 2000, offenders: [{ path: 'a/b.zip', bytes: 10, kind: 'pattern' }], ledger: seeded }).deps);
    check('check --quiet keeps FAIL verdict + exit 1', quietBad.code === 1 && quietBad.out.includes('repo-bloat: FAIL') && !quietBad.out.includes('  baseline'));
    const noBaseRun = runCapture(['check', '--ledger', 'missing.json'], fakeWorld({ bytes: 1000 }).deps);
    check('check with no ledger warns, exit 0', noBaseRun.code === 0 && noBaseRun.out.includes('no baseline'));
    const corruptWorld = fakeWorld({ bytes: 1000 });
    corruptWorld.deps.readLedger = () => { throw new Error('ledger is not valid JSON: L.json (boom)'); };
    const corruptRun = runCapture(['check', '--ledger', 'L.json'], corruptWorld.deps);
    check('corrupt ledger exits 2 (never silent green)', corruptRun.code === 2);
  }
  {
    const seeded = { version: 1, tool: 'repo-bloat', accepted: [], snapshots: [snap(1000), snap(1100)] };
    const r = runCapture(['report', '--ledger', 'L.json', '--limit', '1'], fakeWorld({ ledger: seeded }).deps);
    check('report exits 0 and prints rows', r.code === 0 && r.out.includes('snapshot(s)'));
    const rQuiet = runCapture(['report', '--ledger', 'L.json', '--quiet'], fakeWorld({ ledger: seeded }).deps);
    check('report --quiet prints summary only (no rows)', rQuiet.code === 0 && rQuiet.out.includes('snapshot(s)') && !rQuiet.out.includes('2026-10-01T00:00:00Z'));
    const r2 = runCapture(['report', '--ledger', 'L.json'], fakeWorld({ ledger: null }).deps);
    check('report without ledger exits 0 with guidance', r2.code === 0 && r2.out.includes('collect'));
    const md = runCapture(['markdown', '--ledger', 'L.json'], fakeWorld({ ledger: seeded }).deps);
    check('markdown stdout has table header', md.code === 0 && md.out.includes('| Snapshot | Files |'));
    const mdWorld = fakeWorld({ ledger: seeded });
    const mdOut = runCapture(['markdown', '--ledger', 'L.json', '--out', 'report.md'], mdWorld.deps);
    check('markdown --out routes through deps.writeFile', mdOut.code === 0 && Boolean(mdWorld.written.file && mdWorld.written.file.path === 'report.md'));
  }

  io.stdout(`self-test: ${passed} passed, ${failed} failed\n`);
  return failed ? 1 : 0;
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) process.exit(run(process.argv.slice(2)));







