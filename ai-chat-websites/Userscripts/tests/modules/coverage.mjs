/**
 * Function/code coverage over Userscripts/modules via V8 coverage (Testing & Quality #108/#288).
 * Spawns run-all.mjs with NODE_V8_COVERAGE, aggregates covered bytes per module file
 * (vm scripts carry their real filenames), prints a per-file table and an overall %.
 * Exit code 1 when overall coverage is below the threshold (default 0.80).
 * Usage: node Userscripts/tests/modules/coverage.mjs [--check 0.80]
 */
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, readdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, basename, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const MODULES_DIR = join(HERE, '..', '..', 'modules');
const checkIdx = process.argv.indexOf('--check');
const THRESHOLD = checkIdx > -1 ? parseFloat(process.argv[checkIdx + 1]) : null;

/** Merge sorted [start,end) ranges, keeping the per-range covered flag for max-coverage merge. */
function unionRanges(ranges) {
  if (ranges.length === 0) return [];
  const sorted = [...ranges].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const merged = [sorted[0].slice()];
  for (let i = 1; i < sorted.length; i += 1) {
    const last = merged[merged.length - 1];
    const cur = sorted[i];
    if (cur[0] <= last[1]) {
      last[1] = Math.max(last[1], cur[1]);
      last[2] = last[2] || cur[2];
    } else {
      merged.push(cur.slice());
    }
  }
  return merged;
}

function coverageFromEntry(entry) {
  const ranges = [];
  for (const fn of entry.functions || []) {
    for (const r of fn.ranges || []) ranges.push([r.startOffset, r.endOffset, (r.count || 0) > 0]);
  }
  return unionRanges(ranges);
}

const tmp = mkdtempSync(join(tmpdir(), 'suite-cov-'));
const res = spawnSync(process.execPath, [join(HERE, 'run-all.mjs')], {
  encoding: 'utf8',
  env: { ...process.env, NODE_V8_COVERAGE: tmp }
});
const specOk = res.status === 0;

const files = readdirSync(tmp).filter((f) => f.endsWith('.json'));
const modNames = new Set(readdirSync(MODULES_DIR).filter((f) => f.endsWith('.js')).map((f) => f.toLowerCase()));
const totals = new Map();
for (const f of files) {
  let data;
  try { data = JSON.parse(readFileSync(join(tmp, f), 'utf8')); } catch { continue; }
  for (const entry of data.result || []) {
    const url = entry.url || '';
    if (!url.toLowerCase().includes('userscripts') || !url.toLowerCase().includes('modules')) continue;
    const file = basename(url).toLowerCase();
    if (!modNames.has(file)) continue;
    const ranges = coverageFromEntry(entry);
    const prev = totals.get(file) || [];
    totals.set(file, prev.concat(ranges));
  }
}
rmSync(tmp, { recursive: true, force: true });

let totalBytes = 0;
let coveredBytes = 0;
const rows = [];
for (const [file, ranges] of [...totals.entries()].sort()) {
  const merged = unionRanges(ranges);
  let t = 0;
  let c = 0;
  for (const [, end, covered] of merged) {
    const len = Math.max(0, end - (merged[merged.indexOf(merged.find((r) => r[1] === end))]?.[0] ?? 0));
    t += len;
    if (covered) c += len;
  }
  totalBytes += t;
  coveredBytes += c;
  rows.push([file, t, c]);
}
for (const name of modNames) {
  if (!totals.has(name)) rows.push([name, 0, 0]);
}
rows.sort();
console.log('  module coverage (covered/total bytes):');
for (const [file, t, c] of rows) {
  const pct = t > 0 ? ((c / t) * 100).toFixed(1) : '0.0';
  console.log(`   ${pct.padStart(6)}%  ${file}  (${c}/${t})`);
}
const overall = totalBytes > 0 ? coveredBytes / totalBytes : 0;
console.log(`  overall: ${(overall * 100).toFixed(1)}%  (${coveredBytes}/${totalBytes} bytes)`);
console.log(`  specs:   ${specOk ? 'pass' : 'FAIL'}`);
if (THRESHOLD !== null) {
  const ok = specOk && overall >= THRESHOLD;
  console.log(`  gate:    ${ok ? 'PASS' : 'FAIL'} (threshold ${(THRESHOLD * 100).toFixed(0)}%)`);
  process.exit(ok ? 0 : 1);
}
process.exit(specOk ? 0 : 1);
