#!/usr/bin/env node
'use strict';
/*
 * suite-check.cjs — one command, full-suite health gate
 *
 * The AI Guardian expansion produced eight regression harnesses. Individually they
 * prove each subsystem; collectively they only close the loop if someone remembers
 * to run all of them. This orchestrator makes that mechanical:
 *
 *   1. runs every *_harness*.cjs in scripts/__tests__ (in dependency-safe order),
 *   2. captures each process's exit code + extracts its pass/fail summary line,
 *   3. prints one table + ONE final verdict,
 *   4. exits 0 only if every harness exited 0.
 *
 * Usage:  node scripts/suite-check.cjs        (or npm run check:suite)
 * Exit 0 = suite healthy. Exit 1 = at least one harness failed (or crashed).
 */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const TESTS = path.join(ROOT, 'scripts', '__tests__');

const HARNESSES = [
  // corpus/legacy modules first, then the dense bundle gate last (depends on bundle)
  ['_quota-harness.cjs', 'Quota Guard (901–903)'],
  ['_idle-miner-harness.cjs', 'Idle Dev Miner'],
  ['_response-budget-harness.cjs', 'Response Budgeter'],
  ['_tollbooth-harness.cjs', 'Attention Tollbooth'],
  ['_supreme-court-harness.cjs', 'Supreme Court Dashboard'],
  ['_advisor-harness.cjs', 'Cost Advisor'],
  ['_router-harness.cjs', 'Tool Router'],
  ['_guardian-harness.cjs', 'AI Guardian Suite (dense bundle)']
];

function run(name) {
  const file = path.join(TESTS, name);
  if (!fs.existsSync(file)) return { err: 'missing harness file: ' + name };
  const res = spawnSync(process.execPath, [file], { encoding: 'utf8', timeout: 60000 });
  if (res.error) return { err: res.error.message };
  // extract the harness's summary line if it prints one
  let summary = '';
  const out = (res.stdout || '') + (res.stderr || '');
  const m = out.match(/([\d\s,]+)\s*pass\s*\/\s*([\d\s,]+)\s*fail/i);
  if (m) summary = (m[1] || '').replace(/\s/g, '') + ' pass / ' + (m[2] || '').replace(/\s/g, '') + ' fail';
  return { exit: res.status, summary, out };
}

function main() {
  console.log('\nAI Guardian Suite — full-suite health check\n');
  const results = [];
  let anyFail = false;

  for (const [name, label] of HARNESSES) {
    const r = run(name);
    if (r.err) {
      anyFail = true;
      results.push({ label, exit: 'ERR', summary: r.err });
      console.log('  ✗ ' + label + ' — ' + r.err);
      continue;
    }
    const ok = r.exit === 0;
    if (!ok) anyFail = true;
    results.push({ label, exit: r.exit, summary: r.summary });
    console.log('  ' + (ok ? '✓' : '✗') + ' ' + label + '  [' + (r.summary || 'exit ' + r.exit) + ']');
    if (!ok && r.exit === null && r.out) {
      console.log('    (timed out or crashed — tail: ' + (r.out.split('\n').filter(Boolean).slice(-3).join(' | ')) + ')');
    }
  }

  console.log('\n  ── summary ──');
  console.log('  total harnesses: ' + results.length);
  console.log('  passing:         ' + results.filter(r => r.exit === 0).length);
  console.log('  failing:         ' + results.filter(r => r.exit !== 0).length);
  if (anyFail) {
    console.log('\n  ✗ SUITE HEALTH FAILED — see failing harness(es) above.\n');
    process.exit(1);
  }
  console.log('\n  ✅ SUITE HEALTHY — all harnesses green (exit 0).\n');
  process.exit(0);
}

main();