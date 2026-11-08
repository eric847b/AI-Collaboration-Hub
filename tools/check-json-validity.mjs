#!/usr/bin/env node
/**
 * check-json-validity.mjs - verify every tracked *.json file parses as valid JSON.
 *
 *   node tools/check-json-validity.mjs            # report + exit 1 on invalid
 *   node tools/check-json-validity.mjs --quiet    # only invalid files
 *   node tools/check-json-validity.mjs --json      # machine-readable report
 *   node tools/check-json-validity.mjs --check     # ratchet: fail on NEW invalid vs baseline
 *   node tools/check-json-validity.mjs --update-baseline  # (re)seed baseline
 *   node tools/check-json-validity.mjs --self-test # prove the scanners fire
 *   node tools/check-json-validity.mjs --help      # usage
 *
 * Exit codes: 0 = all valid, 1 = invalid JSON found, 2 = bad usage.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BASELINE_PATH = path.join(ROOT, 'docs', 'metrics', 'json-validity-baseline.json');
const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);
const asJson = has('--json');
const quiet = has('--quiet');
const selfTest = has('--self-test');
const listMode = has('--list');
const countMode = has('--count');
const checkMode = has('--check');
const updateBaseline = has('--update-baseline');
const failFast = has('--fail-fast');
const BOOLEAN_FLAGS = new Set(['--json', '--quiet', '--self-test', '--version', '--list', '--count', '--check', '--update-baseline', '--fail-fast']);

function rejectBadFlags() {
  for (const a of argv) {
    if (a === '--help' || a === '-h') continue;
    if (!a.startsWith('-')) { console.error('check-json-validity: unexpected argument "' + a + '"'); process.exit(2); }
    const eq = a.indexOf('=');
    const key = eq >= 0 ? a.slice(0, eq) : a;
    if (!BOOLEAN_FLAGS.has(key)) { console.error('check-json-validity: unknown flag "' + key + '"'); process.exit(2); }
    if (eq >= 0) { console.error('check-json-validity: flag "' + key + '" takes no value'); process.exit(2); }
  }
}
function usage() {
  console.log(['check-json-validity.mjs - verify tracked JSON files parse',
    'Usage: node tools/check-json-validity.mjs [--quiet] [--json] [--self-test] [--list] [--check] [--update-baseline] [--fail-fast] [--version]',
    '  --list            enumerate every file with verdict (ok/invalid)',
    '  --check           ratchet: fail only on NEW invalid files vs baseline',
    '  --update-baseline (re)seed docs/metrics/json-validity-baseline.json',
    'Exit codes: 0 ok, 1 invalid, 2 bad usage.'].join('\n'));
}
if (argv.includes('--help') || argv.includes('-h')) { usage(); process.exit(0); }
if (has('--version')) { console.log('check-json-validity 1.0.0'); process.exit(0); }
rejectBadFlags();

const SKIP_DIRS = new Set(['node_modules', '.git', 'build', 'dist', '.venv', '.output', '.vexp']);
function walk(dir, out) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) { if (SKIP_DIRS.has(e.name)) continue; walk(path.join(dir, e.name), out); }
    else if (e.name.endsWith('.json')) out.push(path.join(dir, e.name));
  }
  return out;
}

function stripJsonComments(text) {
  // Remove // line comments and /* */ block comments (JSONC support).
  let out = '';
  let i = 0;
  const n = text.length;
  while (i < n) {
    if (text[i] === '"' ) {
      // copy string verbatim
      out += text[i];
      i += 1;
      while (i < n) {
        out += text[i];
        if (text[i] === '\\') { out += text[i+1] || ''; i += 2; continue; }
        if (text[i] === '"') { i += 1; break; }
        i += 1;
      }
      continue;
    }
    if (text[i] === '/' && text[i+1] === '/') {
      while (i < n && text[i] !== '\n') i += 1;
      continue;
    }
    if (text[i] === '/' && text[i+1] === '*') {
      i += 2;
      while (i < n && !(text[i] === '*' && text[i+1] === '/')) i += 1;
      i += 2;
      continue;
    }
    out += text[i];
    i += 1;
  }
  return out;
}

function stripBom(text) {
  if (text.charCodeAt(0) === 0xfeff) return text.slice(1);
  return text;
}
function stripTrailingCommas(text) {
  // Remove trailing commas before } or ] (JSONC tolerance). String-aware.
  let out = '';
  let i = 0;
  const n = text.length;
  while (i < n) {
    if (text[i] === '"') {
      out += text[i]; i += 1;
      while (i < n) {
        out += text[i];
        if (text[i] === '\\') { out += text[i+1] || ''; i += 2; continue; }
        if (text[i] === '"') { i += 1; break; }
        i += 1;
      }
      continue;
    }
    if (text[i] === ',') {
      let j = i + 1;
      while (j < n && /\s/.test(text[j])) j += 1;
      if (j < n && (text[j] === '}' || text[j] === ']')) { i += 1; continue; }
    }
    out += text[i]; i += 1;
  }
  return out;
}


function isValidJson(text) {
  const trimmed = stripBom(text).trim();
  if (trimmed === '') return true; // empty file is not "invalid JSON" (nothing to parse)
  try { JSON.parse(trimmed); return true; } catch {}
  try { JSON.parse(stripJsonComments(trimmed)); return true; } catch {}
  try { JSON.parse(stripTrailingCommas(stripJsonComments(trimmed))); return true; } catch {}
  return false;
}


function runSelfTest() {
  const cases = [];
  const check = (name, actual, expected) => cases.push({ name, pass: JSON.stringify(actual) === JSON.stringify(expected), actual, expected });
  let threw = false;
  try { JSON.parse('{ bad }'); } catch { threw = true; }
  check('invalid JSON throws', threw, true);
  check('valid JSON parses', JSON.parse('{"a":1}').a, 1);
  check('JSONC parses', isValidJson('{"a":1 // x\n}'), true);
  check('trailing comma parses', isValidJson('{"a":1,}'), true);
  check('nested trailing comma parses', isValidJson('{"a":[1,2,],}'), true);
  check('empty file is valid', isValidJson(''), true);
  check('stripJsonComments removes //', stripJsonComments('{"a":1 // x}').trim(), '{"a":1');
  const selfPath = fileURLToPath(import.meta.url);
  const cli = (args) => { const r = spawnSync(process.execPath, [selfPath, ...args], { cwd: ROOT, encoding: 'utf8', timeout: 60000 }); return { code: r.status, out: (r.stdout||'')+(r.stderr||'') }; };
  check('--help exits 0', cli(['--help']).code, 0);
  check('unknown flag exits 2', cli(['--nope']).code, 2);
  const lr = cli(['--list']);
  check('--list exits 0', lr.code, 0);
  const vr = cli(['--version']);
  check('--version exits 0', vr.code, 0);
  check('--version prints name', vr.out.includes('check-json-validity'), true);
const cr = cli(['--check']);
check('--check exits 0 or 1 (not 2)', cr.code === 0 || cr.code === 1, true);
  const failed = cases.filter((c) => !c.pass);
  for (const c of failed) { console.error('FAIL  ' + c.name); console.error('      expected ' + JSON.stringify(c.expected)); console.error('      actual   ' + JSON.stringify(c.actual)); }
  console.log('check-json-validity self-test: ' + (cases.length - failed.length) + '/' + cases.length + ' passed');
  process.exit(failed.length > 0 ? 1 : 0);
}
if (selfTest) runSelfTest();

const files = walk(ROOT, []);
let invalid = 0;
const bad = [];
for (const file of files) {
  const rel = path.relative(ROOT, file).split(path.sep).join('/');
  if (path.basename(file).startsWith('tmp-')) continue; // test fixtures
  const text = fs.readFileSync(file, 'utf8');
  if (!isValidJson(text)) {
    invalid += 1;
    let err = 'invalid JSON';
    try { JSON.parse(text.trim()); } catch (e) { err = e.message; }
    bad.push({ file: rel, error: err });
    if (!asJson && (!quiet || listMode)) console.log('INVALID  ' + rel + '  ->  ' + err);
    if (failFast) break;
  } else if (listMode && !asJson) {
    console.log('OK      ' + rel);
  }
}
if (asJson) console.log(JSON.stringify({ files: files.length, invalid, bad }, null, 2));
else if (!quiet && !countMode) console.log('\ncheck-json-validity: ' + files.length + ' json files, ' + invalid + ' invalid');
// ---- ratchet baseline (optional) -----------------------------------------
const baselineKey = (b) => b.file;
if (updateBaseline) {
  const baseline = { generatedAt: new Date().toISOString(), count: bad.length, files: bad.map((b) => b.file) };
  fs.mkdirSync(path.dirname(BASELINE_PATH), { recursive: true });
  fs.writeFileSync(BASELINE_PATH, JSON.stringify(baseline, null, 2) + '\n');
  if (!asJson && !quiet) console.log('baseline updated: ' + bad.length + ' accepted invalid files -> ' + path.relative(ROOT, BASELINE_PATH));
}
let newInvalid = invalid;
if (checkMode) {
  let baseline = null;
  try { baseline = JSON.parse(fs.readFileSync(BASELINE_PATH, 'utf8')); } catch { baseline = null; }
  if (!baseline) {
    console.error('check-json-validity: no baseline at ' + path.relative(ROOT, BASELINE_PATH) + ' - run with --update-baseline first');
    process.exit(2);
  }
  const accepted = new Set((baseline.files || []));
  const newFiles = bad.filter((b) => !accepted.has(b.file));
  newInvalid = newFiles.length;
  const resolved = (baseline.files || []).filter((f) => !bad.some((b) => b.file === f)).length;
  if (!asJson) {
    console.log('baseline: ' + (baseline.files || []).length + ' accepted, current: ' + bad.length + ', new: ' + newFiles.length + ', resolved: ' + resolved);
    for (const b of newFiles) console.log('NEW-INVALID  ' + b.file + '  ->  ' + b.error);
  }
}
if (countMode) { console.log(files.length); process.exit(0); }
process.exit(checkMode ? (newInvalid > 0 ? 1 : 0) : (invalid > 0 ? 1 : 0));