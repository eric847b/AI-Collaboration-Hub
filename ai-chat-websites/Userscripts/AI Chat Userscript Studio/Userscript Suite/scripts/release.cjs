#!/usr/bin/env node
'use strict';
/*
 * release.cjs — one command, entire suite, gated end-to-end
 *
 * Chains every quality gate in dependency order and succeeds ONLY if all pass:
 *
 *   1. validate      — repo configs + all userscripts parse (npm run validate)
 *   2. check:suite   — all eight regression harnesses green
 *   3. build:bundle  — dense bundle honors every module contract
 *   4. bundle        — modular bundler produces dist output
 *
 * Fail-fast: the first gate that exits non-zero aborts the chain with exit 1
 * (the later gates are skipped — no point proving contracts on a broken bundle).
 *
 * Usage:  node scripts/release.cjs     (or npm run release)
 * Exit 0 = whole suite is shippable.   Exit 1 = a gate failed.
 */
const { spawnSync } = require('child_process');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const GATES = [
  ['validate',      'repo configs + scripts parse',      ['npm', ['run', 'validate']]],
  ['check:suite',   'eight regression harnesses green',   ['npm', ['run', 'check:suite']]],
  ['build:bundle',   'dense bundle honors contracts',     ['npm', ['run', 'build:bundle']]],
  ['bundle',        'modular bundle builds',             ['npm', ['run', 'bundle']]]
];

const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';

function runGate([name, label, [bin, args]]) {
  const res = spawnSync(bin, args, {
    cwd: ROOT,
    shell: process.platform === 'win32',   // npm.cmd on win needs a shell
    timeout: 120000,
    stdio: 'inherit'
  });
  if (res.error || res.status !== 0) {
    console.log('\n  ✗ gate "' + name + '" FAILED (' + label + ')' + (res.error ? ' — ' + res.error.message : '') + '\n');
    return false;
  }
  console.log('  ✓ ' + name + ' — ' + label + '\n');
  return true;
}

console.log('\n━━ AI Guardian Suite — RELEASE GATE ━━\n');
for (const g of GATES) {
  if (!runGate(g)) {
    console.log('  ✗ RELEASE ABORTED — suite is not shippable.\n');
    process.exit(1);
  }
}
console.log('  ✅ RELEASE PASSED — all gates green, suite is shippable.\n');
process.exit(0);