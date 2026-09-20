#!/usr/bin/env node
/**
 * verify-tools.mjs — one-command health check for all workspace Node tooling.
 *
 * Obsoletes the manual per-tool ritual (node --check each file, then running
 * each report tool separately) with a single dependency-free runner:
 *
 *   node tools/verify-tools.mjs            # syntax + smoke run of every tool
 *   node tools/verify-tools.mjs --strict   # also fail on parity DIFFs
 *
 * Steps per tool in tools/*.mjs|*.cjs (auto-discovered, sorted):
 *   1. `node --check` syntax validation (fast, no side effects)
 *   2. tool-specific smoke invocation with read-only/report flags:
 *      - check-doc-links.mjs  -> --quiet (exit 1 on broken links)
 *      - extension-check.mjs    -> --quiet (exit 1 on extension drift)
 *      - secret-scan.mjs      -> --quiet (exit 1 on a hardcoded secret)
 *      - handoff-check.mjs    -> --quiet (exit 1 on a malformed .renitor handoff)
 *      - sync-parity.mjs      -> check [--strict] (report-only; never syncs)
 *      - bundle-trend.cjs     -> report --limit 1 (read-only ledger read)
 *      - ops-dashboard.mjs    -> --check (read-only freshness validation;
 *                                generation itself rewrites its output file)
 *      - load-test.mjs / e2e-smoke.mjs -> syntax-checked only (they spawn servers)
 *      - any other tool       -> syntax-checked only
 *
 * Exit codes: 0 all green · 1 any failure · 2 runner setup error.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TOOLS_DIR = path.join(ROOT, 'tools');
const strict = process.argv.includes('--strict');

/** Read-only smoke commands per tool basename; null = syntax-check only. */
const SMOKE = {
  'check-doc-links.mjs': ['--quiet'],
  'extension-check.mjs': ['--quiet'],
  'secret-scan.mjs': ['--quiet'],
  'workflow-audit.mjs': ['--quiet'],
  'handoff-check.mjs': ['--quiet'],
  'sync-parity.mjs': strict ? ['check', '--strict'] : ['check'],
  'bundle-trend.cjs': ['report', '--limit', '1'],
  'ops-dashboard.mjs': ['--check'],
};

function run(cmd, args) {
  try {
    const out = execFileSync(cmd, args, {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      // Generous per-tool budget for slow laptops: 5 min (was 60s).
      timeout: 300000,
    }).trim();
    return { ok: true, out };
  } catch (e) {
    const out = ((e.stdout || '') + (e.stderr || '')).trim();
    return { ok: false, out: out || `(exited ${e.status ?? '?'})` };
  }
}

let tools;
try {
  tools = fs
    .readdirSync(TOOLS_DIR)
    .filter((f) => /\.(mjs|cjs)$/.test(f))
    .sort();
} catch (e) {
  console.error(`verify-tools: cannot list tools/ — ${e.message}`);
  process.exit(2);
}

let failed = 0;
const rows = [];
for (const tool of tools) {
  const abs = path.join(TOOLS_DIR, tool);
  const syntax = run(process.execPath, ['--check', abs]);
  if (!syntax.ok) {
    failed += 1;
    rows.push({ tool, syntax: 'FAIL', smoke: '—' });
    console.error(`FAIL  ${tool}  syntax:\n${syntax.out}\n`);
    continue;
  }
  const smokeArgs = SMOKE[tool];
  if (smokeArgs === undefined) {
    rows.push({ tool, syntax: 'ok', smoke: 'skipped (side effects)' });
    continue;
  }
  const smoke = run(process.execPath, [abs, ...smokeArgs]);
  rows.push({ tool, syntax: 'ok', smoke: smoke.ok ? 'ok' : 'FAIL' });
  if (!smoke.ok) {
    failed += 1;
    console.error(`FAIL  ${tool} ${smokeArgs.join(' ')}:\n${smoke.out}\n`);
  }
}

console.log('\n# tools verification');
console.log('| Tool | Syntax | Smoke |');
console.log('|------|--------|-------|');
for (const r of rows) console.log(`| ${r.tool} | ${r.syntax} | ${r.smoke} |`);
console.log(
  `\nverify-tools: ${rows.length} tools, ${rows.length - failed} green, ${failed} failed${strict ? ' (--strict)' : ''}.`
);
process.exit(failed > 0 ? 1 : 0);
