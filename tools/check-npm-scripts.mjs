#!/usr/bin/env node
/**
 * check-npm-scripts.mjs - verify every `npm run <script>` reference in tracked
 * Markdown resolves to a real script in the root package.json.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);
const asJson = has('--json');
const quiet = has('--quiet');
const verbose = has('--verbose');
const failFast = has('--fail-fast');
const selfTest = has('--self-test');
const suggestMode = has('--suggest');
const listMode = has('--list');
const checkMode = has('--check');
const updateBaseline = has('--update-baseline');
const BASELINE_PATH = path.join(ROOT, 'docs', 'metrics', 'npm-scripts-baseline.json');

const BOOLEAN_FLAGS = new Set(['--json', '--quiet', '--verbose', '--self-test', '--list', '--check', '--update-baseline', '--version', '--suggest', '--fail-fast']);
const VALUE_FLAGS = new Set();

function rejectBadFlags() {
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--help' || a === '-h') continue;
    if (!a.startsWith('-')) { console.error('check-npm-scripts: unexpected argument "' + a + '"'); process.exit(2); }
    const eq = a.indexOf('=');
    const key = eq >= 0 ? a.slice(0, eq) : a;
    if (BOOLEAN_FLAGS.has(key)) {
      if (eq >= 0) { console.error('check-npm-scripts: flag "' + key + '" takes no value'); process.exit(2); }
      continue;
    }
    if (!VALUE_FLAGS.has(key)) { console.error('check-npm-scripts: unknown flag "' + key + '"'); process.exit(2); }
  }
}

function usage() {
  console.log(['check-npm-scripts.mjs - verify npm run refs in tracked Markdown',
    'Usage: node tools/check-npm-scripts.mjs [--quiet] [--json] [--verbose] [--list] [--check] [--update-baseline] [--suggest] [--fail-fast] [--version]',
    '  --self-test        run the built-in self-test and exit',
    '  --list             enumerate every ref with verdict (ok/stale/ignored)',
    '  --check            ratchet: fail only on NEW stale refs vs baseline',
    '  --update-baseline  (re)seed docs/metrics/npm-scripts-baseline.json',
    '  --suggest          print "did you mean?" suggestions for stale refs',
    '  --version          print version and exit',
    'Ignore a ref: add <!-- npm-scripts: ignore --> on the same or preceding line.',
    'Ignore a whole file: add <!-- npm-scripts: ignore-file --> anywhere in it.',
    'Exit codes: 0 ok, 1 stale/new-stale, 2 bad usage.'].join('\\n'));
}

if (argv.includes('--help') || argv.includes('-h')) { usage(); process.exit(0); }
if (has('--version')) { console.log('check-npm-scripts 1.2.0'); process.exit(0); }
rejectBadFlags();

const SKIP_DIRS = new Set(['node_modules', '.git', 'build', 'dist', '.venv', '.output', '.vexp', '.renitor']);
const SKIP_FILES = new Set(['docs/metrics/OPS-DASHBOARD.md']);

function isMarkdown(file) { return /\.(md|mdx)$/i.test(file); }

function walk(dir, out) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) {
      if (SKIP_DIRS.has(e.name)) continue;
      walk(path.join(dir, e.name), out);
    } else if (isMarkdown(e.name)) {
      const rel = path.relative(ROOT, path.join(dir, e.name)).split(path.sep).join('/');
      if (SKIP_FILES.has(rel)) continue;
      out.push(path.join(dir, e.name));
    }
  }
  return out;
}

function loadScriptsForDir(dir) {
  // Walk up from dir to find nearest package.json
  let cur = dir;
  while (true) {
    const candidate = path.join(cur, 'package.json');
    if (fs.existsSync(candidate)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(candidate, 'utf8'));
        return { scripts: Object.keys(pkg.scripts || {}), root: cur };
      } catch { return { scripts: [], root: cur }; }
    }
    const parent = path.dirname(cur);
    if (parent === cur) return { scripts: [], root: null };
    cur = parent;
  }
}

const scriptsCache = new Map();
function scriptsForFile(file) {
  const dir = path.dirname(file);
  if (scriptsCache.has(dir)) return scriptsCache.get(dir);
  const res = loadScriptsForDir(dir);
  const set = new Set(res.scripts);
  scriptsCache.set(dir, { set, root: res.root });
  return scriptsCache.get(dir);
}

function extractRefs(text) {
  const fileIgnored = /<!--\s*npm-scripts:\s*ignore-file\s*-->/.test(text);
  const refs = [];
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const prev = i > 0 ? lines[i - 1] : '';
    const ignored = fileIgnored || /<!--\s*npm-scripts:\s*ignore\s*-->/.test(line) || /<!--\s*npm-scripts:\s*ignore\s*-->/.test(prev);
    const re = /npm run (?:`([^`]+)`|"([^"]+)"|'([^']+)'|([A-Za-z0-9:_-]+))/g;
    let m;
    while ((m = re.exec(line)) !== null) {
      const name = m[1] || m[2] || m[3] || m[4];
      if (name) refs.push({ name, line: i + 1, raw: m[0], ignored });
    }
  }
  return refs;
}

function scanFile(file, scriptsSet) {
  const text = fs.readFileSync(file, 'utf8');
  const refs = extractRefs(text);
  const out = [];
  for (const r of refs) {
    if (r.ignored) { out.push({ ...r, exists: true, ignored: true }); continue; }
    out.push({ ...r, exists: scriptsSet.has(r.name), ignored: false });
  }
  return out;
}

function levenshtein(a, b) {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    let cur = [i];
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i-1] === b[j-1] ? 0 : 1;
      cur[j] = Math.min(prev[j] + 1, cur[j-1] + 1, prev[j-1] + cost);
    }
    prev = cur;
  }
  return prev[b.length];
}
function suggest(name, scripts) {
  let best = null; let bestD = Infinity;
  for (const s of scripts) {
    const d = levenshtein(name, s);
    if (d < bestD) { bestD = d; best = s; }
  }
  return bestD <= 3 ? best : null;
}
function runSelfTest() {
  const cases = [];
  const check = (name, actual, expected) => {
    const pass = JSON.stringify(actual) === JSON.stringify(expected);
    cases.push({ name, pass, actual, expected });
  };
  const t1 = 'Use `npm run gate` and npm run "quality" plus npm run build:all and npm run \'docs:check\'.';
  const r1 = extractRefs(t1);
  check('extractRefs counts 4 refs', r1.length, 4);
  check('suggest finds closest', suggest('gat', ['gate', 'quality']), 'gate');
  check('suggest returns null for distant', suggest('zzzzz', ['gate', 'quality']), null);
  check('extractRefs unquoted name', r1[0].name, 'gate');
  check('extractRefs quoted double', r1[1].name, 'quality');
  check('extractRefs hyphen/colon name', r1[2].name, 'build:all');
  check('extractRefs single-quoted', r1[3].name, 'docs:check');
  const t2 = 'line1\nrun npm run gate here\nline3';
  const r2 = extractRefs(t2);
  check('extractRefs line number', r2[0].line, 2);
  const t3 = '<!-- npm-scripts: ignore -->\nnpm run nope';
  const r3 = extractRefs(t3);
  check('ignored marker skips ref from stale', r3[0].ignored, true);
  const t4 = '<!-- npm-scripts: ignore-file -->\nnpm run nope';
  const r4 = extractRefs(t4);
  check('ignored file skips all refs', r4[0].ignored, true);
  const walked = walk(ROOT, []);
  check('walk skips generated OPS-DASHBOARD.md', walked.some((f) => f.endsWith('OPS-DASHBOARD.md')), false);
  const set = new Set(['gate', 'quality']);
  check('known resolves', set.has('gate'), true);
  check('unknown missing', set.has('nope'), false);
  const selfPath = fileURLToPath(import.meta.url);
  const cli = (args) => {
    const r = spawnSync(process.execPath, [selfPath, ...args], { cwd: ROOT, encoding: 'utf8', timeout: 60000 });
    return { code: r.status, out: (r.stdout || '') + (r.stderr || '') };
  };
  check('--help exits 0', cli(['--help']).code, 0);
  check('unknown flag exits 2', cli(['--nope']).code, 2);
  check('unexpected positional exits 2', cli(['extra']).code, 2);
  const vr = cli(['--version']);
  check('--version exits 0', vr.code, 0);
  check('--version prints name', vr.out.includes('check-npm-scripts'), true);
  const cr = cli(['--check']);
  check('--check exits 0 or 1 (not 2)', cr.code === 0 || cr.code === 1, true);
  const jr = cli(['--json']);
  let jok = false;
  try { const j = JSON.parse(jr.out); jok = Array.isArray(j.staleRefs) && typeof j.files === 'number'; } catch { jok = false; }
  check('--json emits parseable JSON', jok, true);
  const failed = cases.filter((c) => !c.pass);
  for (const c of failed) {
    console.error('FAIL  ' + c.name);
    console.error('      expected ' + JSON.stringify(c.expected));
    console.error('      actual   ' + JSON.stringify(c.actual));
  }
  console.log('check-npm-scripts self-test: ' + (cases.length - failed.length) + '/' + cases.length + ' passed');
  process.exit(failed.length > 0 ? 1 : 0);
}

if (selfTest) { runSelfTest(); }

const files = walk(ROOT, []);
let stale = 0;
let ignored = 0;
const staleRefs = [];
const allRefs = [];
const rootScripts = loadScriptsForDir(ROOT).scripts;
const rootReferenced = new Set();
for (const file of files) {
  const relFile = path.relative(ROOT, file).split(path.sep).join('/');
  const { set } = scriptsForFile(file);
  for (const row of scanFile(file, set)) {
    allRefs.push({ file: relFile, ...row });
    if (row.ignored) { ignored += 1; if (listMode && !asJson) console.log('IGNORED  ' + relFile + ':' + row.line + '  ->  ' + row.raw); continue; }
    if (!row.exists) {
      stale += 1;
      staleRefs.push({ file: relFile, script: row.name, line: row.line, raw: row.raw });
      const sug = suggestMode ? suggest(row.name, [...scriptsForFile(file).set]) : null;
      if (!asJson && (!quiet || listMode)) console.log('STALE  ' + relFile + ':' + row.line + '  ->  ' + row.raw + (sug ? '  (did you mean "' + sug + '"?)' : ''));
      if (failFast) break;
    } else {
      if (listMode && !asJson) console.log('OK      ' + relFile + ':' + row.line + '  ->  ' + row.raw);
      if (scriptsForFile(file).root === ROOT) {
        rootReferenced.add(row.name);
      }
    }
  }
  if (failFast && stale > 0) break;
}
const orphans = rootScripts.filter((s) => !rootReferenced.has(s));



if (asJson) {
  const payload = { files: files.length, checked: allRefs.length, stale, ignored, staleRefs, orphans: verbose ? orphans : undefined };
  if (listMode) payload.refs = allRefs.map((r) => ({ file: r.file, line: r.line, script: r.name, raw: r.raw, verdict: r.ignored ? 'ignored' : (r.exists ? 'ok' : 'stale') }));
  console.log(JSON.stringify(payload, null, 2));
} else if (!quiet || listMode) {
  console.log('\\ncheck-npm-scripts: ' + files.length + ' markdown files, ' + allRefs.length + ' npm-run refs checked, ' + stale + ' stale, ' + ignored + ' ignored');
  if (verbose && orphans.length) {
    console.log('never-referenced root scripts (' + orphans.length + '): ' + orphans.join(', '));
  }
}
// ---- ratchet baseline (optional) -----------------------------------------
const baselineKey = (r) => r.file + '::' + r.script;
if (updateBaseline) {
  const baseline = {
    generatedAt: new Date().toISOString(),
    count: staleRefs.length,
    refs: staleRefs.map((r) => ({ file: r.file, script: r.script })),
  };
  fs.mkdirSync(path.dirname(BASELINE_PATH), { recursive: true });
  fs.writeFileSync(BASELINE_PATH, JSON.stringify(baseline, null, 2) + '\n');
  if (!asJson && !quiet) console.log('baseline updated: ' + staleRefs.length + ' accepted stale refs -> ' + path.relative(ROOT, BASELINE_PATH));
}
let newStale = stale;
if (checkMode) {
  let baseline = null;
  try { baseline = JSON.parse(fs.readFileSync(BASELINE_PATH, 'utf8')); } catch { baseline = null; }
  if (!baseline) {
    console.error('check-npm-scripts: no baseline at ' + path.relative(ROOT, BASELINE_PATH) + ' - run with --update-baseline first');
    process.exit(2);
  }
  const accepted = new Set((baseline.refs || []).map(baselineKey));
  const newRefs = staleRefs.filter((r) => !accepted.has(baselineKey(r)));
  newStale = newRefs.length;
  const shrunk = (baseline.refs || []).filter((b) => !staleRefs.some((r) => baselineKey(r) === baselineKey(b))).length;
  if (!asJson) {
    console.log('baseline: ' + (baseline.refs || []).length + ' accepted, current: ' + staleRefs.length + ', new: ' + newRefs.length + ', resolved: ' + shrunk);
    for (const r of newRefs) console.log('NEW-STALE  ' + r.file + ':' + r.line + '  ->  ' + r.raw);
  }
}
process.exit(checkMode ? (newStale > 0 ? 1 : 0) : (stale > 0 ? 1 : 0));