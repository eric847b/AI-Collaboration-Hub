#!/usr/bin/env node
'use strict';
/**
 * bundle-trend.cjs — workspace bundle-size ledger + regression gate.
 *
 *   node tools/bundle-trend.cjs collect  [--ledger docs/metrics/bundle-history.json] [--note "..."]
 *   node tools/bundle-trend.cjs check    [--ledger ...] [--threshold 10]
 *   node tools/bundle-trend.cjs report   [--ledger ...] [--limit 5]
 *
 * Auto-discovers root-level Node projects (folder containing package.json) and measures their
 * build output dirs (dist / build / out / .output / release). `collect` appends a snapshot to the
 * ledger; `check` compares fresh local measurements against the most recent baseline per project
 * and exits 1 when any project grew by more than --threshold percent (shrinking never fails).
 * `report` prints the last few snapshots. No dependencies — plain Node.
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const DEFAULT_LEDGER = path.join('docs', 'metrics', 'bundle-history.json');
const OUT_DIRS = ['dist', 'build', 'out', '.output', 'release'];
const MAX_ENTRIES = 200;

const argv = process.argv.slice(2);
const cmd = argv.find((a) => !a.startsWith('--')) || 'report';
function opt(name, def) {
  const i = argv.indexOf(name);
  return i >= 0 && i + 1 < argv.length ? argv[i + 1] : def;
}

function ledgerPath() {
  const given = opt('--ledger', '');
  return path.isAbsolute(given) ? given : path.join(ROOT, given || DEFAULT_LEDGER);
}

function listProjects() {
  return fs
    .readdirSync(ROOT, { withFileTypes: true })
    .filter((d) => d.isDirectory() && !d.name.startsWith('.'))
    .map((d) => d.name)
    .filter((n) => fs.existsSync(path.join(ROOT, n, 'package.json')))
    .sort();
}

function walkSize(dir) {
  let bytes = 0;
  let files = 0;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === 'node_modules') continue;
      const r = walkSize(p);
      bytes += r.bytes;
      files += r.files;
    } else if (e.isFile()) {
      bytes += fs.statSync(p).size;
      files += 1;
    }
  }
  return { bytes, files };
}

function measureProject(name) {
  const dirs = OUT_DIRS.map((d) => path.join(ROOT, name, d)).filter((p) => fs.existsSync(p));
  if (dirs.length === 0) return null;
  let bytes = 0;
  let files = 0;
  const perDir = {};
  for (const d of dirs) {
    const r = walkSize(d);
    perDir[path.basename(d)] = r.bytes;
    bytes += r.bytes;
    files += r.files;
  }
  return { bytes, files, dirs: perDir };
}

function measureAll() {
  const out = {};
  for (const name of listProjects()) {
    const m = measureProject(name);
    if (m) out[name] = m;
  }
  return out;
}

function gitSha() {
  try {
    return execSync('git rev-parse --short HEAD', { cwd: ROOT }).toString().trim();
  } catch {
    return 'unknown';
  }
}

function human(n) {
  if (n >= 1024 * 1024) return (n / 1024 / 1024).toFixed(2) + ' MB';
  if (n >= 1024) return (n / 1024).toFixed(1) + ' KB';
  return n + ' B';
}

function loadLedger(file) {
  try {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (parsed && Array.isArray(parsed.entries)) return parsed;
  } catch {
    /* fall through to fresh ledger */
  }
  return { version: 1, entries: [] };
}

function saveLedger(file, ledger) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(ledger, null, 2) + '\n', 'utf8');
}

function baselineFor(ledger, project) {
  for (let i = ledger.entries.length - 1; i >= 0; i -= 1) {
    const entry = ledger.entries[i];
    if (entry.projects && entry.projects[project]) {
      return { bytes: entry.projects[project].bytes, at: entry.timestamp };
    }
  }
  return null;
}

function collect() {
  const file = ledgerPath();
  const measured = measureAll();
  const names = Object.keys(measured);
  if (names.length === 0) {
    console.log('bundle-trend: no build outputs found — nothing collected. Build projects first.');
    return 0;
  }
  const ledger = loadLedger(file);
  const projects = {};
  for (const name of names) {
    projects[name] = { bytes: measured[name].bytes, files: measured[name].files, dirs: measured[name].dirs };
  }
  ledger.entries.push({
    timestamp: new Date().toISOString(),
    gitSha: gitSha(),
    note: opt('--note', ''),
    projects,
  });
  while (ledger.entries.length > MAX_ENTRIES) ledger.entries.shift();
  saveLedger(file, ledger);
  console.log(`bundle-trend: snapshot recorded (${names.length} project(s)) -> ${path.relative(ROOT, file)}`);
  for (const name of names) {
    console.log(`  ${name.padEnd(34)} ${human(projects[name].bytes).padStart(10)}  (${projects[name].files} files)`);
  }
  return 0;
}

function check() {
  const file = ledgerPath();
  const threshold = Number(opt('--threshold', '10'));
  const measured = measureAll();
  const names = Object.keys(measured);
  if (names.length === 0) {
    console.log('bundle-trend: no local build outputs — nothing to check (pass).');
    return 0;
  }
  const ledger = loadLedger(file);
  let failed = false;
  console.log(`bundle-trend: regression gate (fail when growth > +${threshold}%)`);
  for (const name of names) {
    const base = baselineFor(ledger, name);
    if (!base) {
      console.log(`  ${name.padEnd(34)} no baseline yet (${human(measured[name].bytes)}) — skip`);
      continue;
    }
    const growth = base.bytes > 0 ? ((measured[name].bytes - base.bytes) / base.bytes) * 100 : 0;
    const tag = growth > threshold ? 'FAIL' : 'ok  ';
    if (growth > threshold) failed = true;
    console.log(
      `  ${name.padEnd(34)} ${human(base.bytes).padStart(10)} -> ${human(measured[name].bytes).padStart(10)}` +
        `  (${growth >= 0 ? '+' : ''}${growth.toFixed(1)}%)  ${tag}  [baseline ${base.at}]`
    );
  }
  if (failed) {
    console.error('bundle-trend: REGRESSION detected — see FAIL rows above.');
    return 1;
  }
  console.log('bundle-trend: no regressions.');
  return 0;
}

function report() {
  const ledger = loadLedger(ledgerPath());
  const limit = Number(opt('--limit', '5'));
  const entries = ledger.entries.slice(-limit);
  if (entries.length === 0) {
    console.log('bundle-trend: ledger is empty. Run `collect` after building projects.');
    return 0;
  }
  for (const entry of entries) {
    console.log(`\n${entry.timestamp}  (${entry.gitSha}${entry.note ? `, ${entry.note}` : ''})`);
    const names = Object.keys(entry.projects || {}).sort();
    for (const name of names) {
      console.log(`  ${name.padEnd(34)} ${human(entry.projects[name].bytes).padStart(10)}  (${entry.projects[name].files} files)`);
    }
  }
  return 0;
}

const handlers = { collect, check, report };
if (!handlers[cmd]) {
  console.error(`bundle-trend: unknown command "${cmd}" — use collect | check | report`);
  process.exit(2);
}
process.exit(handlers[cmd]());
