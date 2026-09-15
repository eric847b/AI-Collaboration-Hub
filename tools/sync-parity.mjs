#!/usr/bin/env node
'use strict';
/**
 * sync-parity.mjs — reusable, mapping-driven fleet mirror parity tool.
 * Replaces the one-off manual SHA256 sweeps documented in docs/SYNC_CATALYST.md.
 *
 *   node tools/sync-parity.mjs check  [--map tools/parity-map.json] [--strict]
 *   node tools/sync-parity.mjs sync   [--map tools/parity-map.json]
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
const cmd = argv.find((a) => !a.startsWith('--')) || 'check';
const opt = (name, def) => {
  const i = argv.indexOf(name);
  return i >= 0 && i + 1 < argv.length ? argv[i + 1] : def;
};
const strict = argv.includes('--strict');
const mapFile = path.isAbsolute(opt('--map', '')) ? opt('--map', '') : path.join(ROOT, opt('--map', 'tools/parity-map.json'));

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

function survey(pair) {
  const nestedRoot = path.resolve(ROOT, pair.nestedRoot);
  const rows = [];
  for (const f of listPairFiles(pair)) {
    const nestedAbs = path.join(nestedRoot, f.rel);
    const nestedExists = fs.existsSync(nestedAbs);
    const status = !nestedExists ? 'MISSING' : sha256(f.abs) === sha256(nestedAbs) ? 'parity' : 'DIFF';
    rows.push({ rel: f.rel, status });
  }
  return rows;
}

function apply(pair, rows) {
  const stdRoot = path.resolve(ROOT, pair.standaloneRoot);
  const nestedRoot = path.resolve(ROOT, pair.nestedRoot);
  let copied = 0;
  for (const row of rows) {
    const shouldCopy = pair.mode === 'overwrite' ? row.status !== 'parity' : row.status === 'MISSING';
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

const map = loadMap();
let violations = 0;
for (const pair of map.pairs) {
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
    violations += rows.filter((r) => r.status === 'DIFF' || r.status === 'MISSING').length;
  }
}
if (cmd === 'sync') console.log('\nsync-parity: sync applied. Re-run `check` to verify all overwrite-mode pairs are at parity.');
if (strict && violations > 0) {
  console.error(`sync-parity: STRICT — ${violations} overwrite-mode file(s) not at parity.`);
  process.exit(1);
}
process.exit(0);

