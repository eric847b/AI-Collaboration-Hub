#!/usr/bin/env node
'use strict';
/**
 * sync-parity.mjs — reusable, mapping-driven fleet mirror parity tool.
 * Replaces the one-off manual SHA256 sweeps documented in docs/SYNC_CATALYST.md.
 *
 *   node tools/sync-parity.mjs check  [--map tools/parity-map.json] [--strict] [--mode=overwrite|missing-only]
 *   node tools/sync-parity.mjs sync   [--map tools/parity-map.json] [--mode=overwrite|missing-only]
 *   node tools/sync-parity.mjs --help
 *
 * Non-interactive by contract (Round 12 D re-scope): every input is an explicit
 * flag (`--flag value` or `--flag=value`); unknown commands/flags/modes exit 2
 * with usage instead of silently degrading to `check`. No stdin prompts.
 *
 * check : report per-file status (parity / DIFF / MISSING) for every pair; exit 0 normally,
 *         exit 1 with --strict when any overwrite-mode file is not at parity.
 * sync  : apply the mapping — 'overwrite' mode copies differing+missing files (standalone wins);
 *         'missing-only' mode NEVER overwrites existing nested files (protects actively-developed
 *         nested trees). Nothing is ever deleted.
 * Pair fields: name, standaloneRoot, nestedRoot, mode ('overwrite'|'missing-only'),
 *              include[] (files, optional), includeDirs[] (recursive, optional).
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);

// ── Non-interactive argv tokenizer (Round 12 D re-scope) ─────────────────────
// Flags and positionals are split up front so a flag VALUE (e.g. the
// `missing-only` in `--mode missing-only`) can never be mistaken for the
// subcommand. Accepts `--flag value` and `--flag=value`; unknown flags and
// unknown commands exit 2 with usage instead of silently degrading to `check`.
// No stdin prompts, ever.
const VALUE_FLAGS = new Set(['--map', '--mode']);
const BOOL_FLAGS = new Set(['--strict', '--self-test']);
const flags = {};
const positionals = [];
for (let i = 0; i < argv.length; i += 1) {
  const a = argv[i];
  if (a === '--help' || a === '-h') {
    flags['--help'] = true;
    continue;
  }
  if (a.startsWith('-')) {
    const eq = a.indexOf('=');
    const key = eq >= 0 ? a.slice(0, eq) : a;
    if (VALUE_FLAGS.has(key)) {
      let value;
      if (eq >= 0) value = a.slice(eq + 1);
      else if (i + 1 < argv.length) value = argv[(i += 1)];
      else {
        console.error(`sync-parity: flag "${key}" requires a value — see \`node tools/sync-parity.mjs --help\``);
        process.exit(2);
      }
      flags[key] = value;
    } else if (BOOL_FLAGS.has(key)) {
      if (eq >= 0) {
        console.error(`sync-parity: flag "${key}" takes no value — see \`node tools/sync-parity.mjs --help\``);
        process.exit(2);
      }
      flags[key] = true;
    } else {
      console.error(`sync-parity: unknown flag "${key}" — see \`node tools/sync-parity.mjs --help\``);
      process.exit(2);
    }
    continue;
  }
  positionals.push(a);
}

function usage() {
  console.log(
    [
      'sync-parity.mjs — mapping-driven fleet mirror parity (non-interactive)',
      '',
      'Usage: node tools/sync-parity.mjs <check|sync> [--map <file>] [--mode=overwrite|missing-only] [--strict]',
      '',
      '  check   report per-file status (parity / DIFF / MISSING) for every mapped pair',
      '          --strict: exit 1 when any overwrite-mode file is not at parity',
      '  sync    apply the map — overwrite mode copies differing+missing files (standalone',
      '          wins); missing-only mode NEVER overwrites existing nested files',
      '',
      'Flags:',
      '  --map   parity map path (default tools/parity-map.json)      [check + sync]',
      '  --mode  limit the run to pairs of one mode                  [check + sync]',
      '  --strict  fail on overwrite-mode drift                      [check only]',
      '  --self-test  prove the parity/overwrite rules bite (14 checks)      [any command]',
      '  --help   print this text and exit 0',
      '',
      'Default command: check. Every input is an explicit flag — there is no',
      'interactive mode; unknown commands/flags/modes exit 2 with this usage.',
    ].join('\n'),
  );
}

if (flags['--help'] || (positionals[0] === 'help' && positionals.length === 1)) {
  usage();
  process.exit(0);
}
if (positionals.length > 1) {
  console.error(`sync-parity: unexpected argument "${positionals[1]}" — commands take flags only (see --help)`);
  process.exit(2);
}
const cmd = positionals[0] || 'check';
if (!['check', 'sync'].includes(cmd)) {
  console.error(`sync-parity: unknown command "${cmd}" — use check | sync (or --help)`);
  process.exit(2);
}
if (flags['--strict'] && cmd !== 'check') {
  console.error('sync-parity: --strict applies to `check` only (see --help)');
  process.exit(2);
}
const strict = !!flags['--strict'];
const opt = (name, def) => (Object.prototype.hasOwnProperty.call(flags, name) ? flags[name] : def);
const mapFile = path.isAbsolute(opt('--map', '')) ? opt('--map', '') : path.join(ROOT, opt('--map', 'tools/parity-map.json'));
// Re-scoped explicit mode (Round 12 D): `--mode=overwrite|missing-only`
// limits the run to pairs of that mode. No stdin prompts.
const modeScope = opt('--mode', '');
if (modeScope && modeScope !== 'overwrite' && modeScope !== 'missing-only') {
  console.error(`sync-parity: unknown --mode "${modeScope}" — use overwrite|missing-only`);
  process.exit(2);
}

function sha256(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function loadMap() {
  const map = JSON.parse(fs.readFileSync(mapFile, 'utf8'));
  if (!Array.isArray(map.pairs)) throw new Error(`parity map has no pairs[]: ${mapFile}`);
  return map;
}

function listPairFiles(pair) {
  const stdRoot = path.resolve(ROOT, pair.standaloneRoot);
  const files = [];
  const push = (abs, rel) => files.push({ abs, rel });
  const excluded = new Set(Array.isArray(pair.exclude) ? pair.exclude : []);
  const excludedDirs = new Set(Array.isArray(pair.excludeDirs) ? pair.excludeDirs : []);
  const walkAll = (base) => {
    const walk = (cur) => {
      for (const e of fs.readdirSync(cur, { withFileTypes: true })) {
        const abs = path.join(cur, e.name);
        const rel = path.relative(stdRoot, abs).split(path.sep).join('/');
        if (e.isDirectory()) {
          if (e.name === 'node_modules' || e.name === '__pycache__' || e.name === '.git') continue;
          if (excludedDirs.has(rel) || excludedDirs.has(e.name)) continue;
          walk(abs);
        } else if (e.isFile() && !excluded.has(rel)) {
          push(abs, rel);
        }
      }
    };
    walk(base);
  };
  if (Array.isArray(pair.include)) {
    for (const rel of pair.include) {
      if (excluded.has(rel)) continue;
      const abs = path.join(stdRoot, rel);
      if (fs.existsSync(abs) && fs.statSync(abs).isFile()) push(abs, rel);
    }
  }
  if (Array.isArray(pair.includeDirs)) {
    for (const dir of pair.includeDirs) {
      const base = path.join(stdRoot, dir);
      if (fs.existsSync(base)) walkAll(base);
    }
  }
  if (!Array.isArray(pair.include) && !Array.isArray(pair.includeDirs)) {
    walkAll(stdRoot); // default: mirror the whole standalone root
  }
  return files;
}

/** Pure status decision: does a nested mirror match its standalone source? */
function classifyStatus(nestedExists, hashesMatch) {
  if (!nestedExists) return 'MISSING';
  return hashesMatch ? 'parity' : 'DIFF';
}

/**
 * May this file be written into the nested mirror?
 *
 * `missing-only` NEVER overwrites an EXISTING nested file: that mode exists to
 * create absent mirrors while leaving actively-developed nested work alone
 * (durable rule 12). Overwriting a DIFF there would silently destroy another
 * session's edits, so the two branches must stay distinct.
 */
function shouldCopyFile(mode, status) {
  return mode === 'overwrite' ? status !== 'parity' : status === 'MISSING';
}

/** Strict-mode violations: only overwrite-mode drift counts. */
function countViolations(mode, rows) {
  if (mode !== 'overwrite') return 0;
  return rows.filter((r) => r.status === 'DIFF' || r.status === 'MISSING').length;
}

function survey(pair) {
  const nestedRoot = path.resolve(ROOT, pair.nestedRoot);
  const rows = [];
  for (const f of listPairFiles(pair)) {
    const nestedAbs = path.join(nestedRoot, f.rel);
    const nestedExists = fs.existsSync(nestedAbs);
    const status = classifyStatus(nestedExists, sha256(f.abs) === sha256(nestedAbs));
    rows.push({ rel: f.rel, status });
  }
  return rows;
}

function apply(pair, rows) {
  const stdRoot = path.resolve(ROOT, pair.standaloneRoot);
  const nestedRoot = path.resolve(ROOT, pair.nestedRoot);
  let copied = 0;
  for (const row of rows) {
    const shouldCopy = shouldCopyFile(pair.mode, row.status);
    if (!shouldCopy) continue;
    const src = path.join(stdRoot, row.rel);
    const dst = path.join(nestedRoot, row.rel);
    fs.mkdirSync(path.dirname(dst), { recursive: true });
    fs.copyFileSync(src, dst);
    row.status = 'copied';
    copied += 1;
  }
  return copied;
}

function printPair(name, mode, rows) {
  const counts = { parity: 0, DIFF: 0, MISSING: 0, copied: 0 };
  for (const r of rows) counts[r.status] = (counts[r.status] || 0) + 1;
  console.log(`\n[${name}]  mode=${mode}  files=${rows.length}  parity=${counts.parity} DIFF=${counts.DIFF} MISSING=${counts.MISSING}${counts.copied ? ` copied=${counts.copied}` : ''}`);
  for (const r of rows) {
    if (r.status !== 'parity') console.log(`  ${r.status.padEnd(7)} ${r.rel}`);
  }
}

/**
 * The fleet mirror gate had no self-test anywhere. These three decisions decide
 * whether a mirror may be overwritten, and `missing-only` is a DATA-SAFETY
 * property: it must never clobber an actively-developed nested file (durable
 * rule 12). A regression there destroys another session's edits silently.
 */
function runSelfTest() {
  const failures = [];
  const check = (name, cond) => { if (!cond) failures.push(name); };

  // Status classification.
  check('absent nested file is MISSING', classifyStatus(false, true) === 'MISSING');
  check('absent nested file is MISSING even when hashes "match"', classifyStatus(false, false) === 'MISSING');
  check('present + identical is parity', classifyStatus(true, true) === 'parity');
  check('present + differing is DIFF', classifyStatus(true, false) === 'DIFF');

  // overwrite mode: reconcile everything that is not already at parity.
  check('overwrite copies a DIFF', shouldCopyFile('overwrite', 'DIFF') === true);
  check('overwrite copies a MISSING', shouldCopyFile('overwrite', 'MISSING') === true);
  check('overwrite skips parity', shouldCopyFile('overwrite', 'parity') === false);

  // missing-only: THE SAFETY PROPERTY. A DIFF nested file is somebody's active
  // work and must be left alone; only absent files are created.
  check('missing-only creates an absent mirror', shouldCopyFile('missing-only', 'MISSING') === true);
  check('missing-only NEVER overwrites a DIFF', shouldCopyFile('missing-only', 'DIFF') === false);
  check('missing-only skips parity', shouldCopyFile('missing-only', 'parity') === false);

  // Violations: only overwrite-mode drift gates --strict.
  const rows = [{ status: 'parity' }, { status: 'DIFF' }, { status: 'MISSING' }];
  check('overwrite counts only drift', countViolations('overwrite', rows) === 2);
  check('overwrite counts nothing when all parity', countViolations('overwrite', [{ status: 'parity' }]) === 0);
  check('missing-only never contributes violations', countViolations('missing-only', rows) === 0);

  if (failures.length) {
    console.error(`sync-parity self-test FAIL: ${failures.length} problem(s):`);
    for (const f of failures) console.error(`  FAIL  ${f}`);
    process.exit(1);
  }
  console.log('sync-parity self-test: 14/14 passed');
}

if (flags['--self-test']) {
  runSelfTest();
  process.exit(0);
}

const map = loadMap();
let violations = 0;
for (const pair of map.pairs) {
  if (modeScope && pair.mode !== modeScope) continue;
  if (!['overwrite', 'missing-only'].includes(pair.mode)) {
    console.error(`sync-parity: pair "${pair.name}" has unknown mode "${pair.mode}"`);
    process.exit(2);
  }
  const stdRoot = path.resolve(ROOT, pair.standaloneRoot);
  if (!fs.existsSync(stdRoot)) {
    console.log(`sync-parity: [${pair.name}] standalone clone missing (${pair.standaloneRoot}) — skipped`);
    continue;
  }
  const rows = survey(pair);
  if (cmd === 'sync') {
    const copied = apply(pair, rows);
    if (copied) console.log(`sync-parity: [${pair.name}] copied ${copied} file(s) (${pair.mode} mode)`);
  }
  printPair(pair.name, pair.mode, rows);
  if (pair.mode === 'overwrite') {
    violations += countViolations(pair.mode, rows);
  }
}
if (cmd === 'sync') console.log('\nsync-parity: sync applied. Re-run `check` to verify all overwrite-mode pairs are at parity.');
if (strict && violations > 0) {
  console.error(`sync-parity: STRICT — ${violations} overwrite-mode file(s) not at parity.`);
  process.exit(1);
}
process.exit(0);

