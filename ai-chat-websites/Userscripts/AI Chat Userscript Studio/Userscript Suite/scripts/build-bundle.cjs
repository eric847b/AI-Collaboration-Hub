#!/usr/bin/env node
'use strict';
/*
 * build-bundle.cjs — AI Guardian Suite consistency gate
 *
 * The dense bundle (dist/AI-Guardian-Suite.user.js) is a hand-tuned, shared-kernel
 * re-write of the standalone modules under Modules/. Densification is where regressions
 * hide (this session found four: a dropped compressor rule, an RLB off-step, a bare
 * save() arg, a lost 0-off-step). This gate stops them shipping:
 *
 *   1. sanity: bundle exists + `node --check` parses
 *   2. contracts: runs the authoritative harness (scripts/__tests__/_guardian-harness.cjs)
 *      which encodes every module's public contract against the live bundle and exits 0/1
 *
 * The harness is the single source of truth for the dense API surface (ATOLL._price,
 * RLB.cycle/arm, DCP.enqueue{promise}, etc.) — this gate delegates to it rather than
 * re-deriving shapes, which itself would be a regression vector.
 *
 * Usage:  node scripts/build-bundle.cjs            (or npm run build)
 * Exit 0 = bundle is syntactically valid AND contract-clean. Exit 1 = drift/failure.
 */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const BUNDLE = path.join(ROOT, 'dist', 'AI-Guardian-Suite.user.js');
const HARNESS = path.join(ROOT, 'scripts', '__tests__', '_guardian-harness.cjs');

const log = (s) => process.stdout.write(s);

function fail(msg) {
  log('\n  ✗ ' + msg + '\n');
  process.exit(1);
}

function main() {
  log('\nAI Guardian Suite — build gate\n');

  // 1 · sanity
  if (!fs.existsSync(BUNDLE)) fail('bundle not found at dist/AI-Guardian-Suite.user.js');
  log('  ✓ bundle exists\n');

  const nm = spawnSync('node', ['--check', BUNDLE]);
  if (nm.status !== 0) { log(nm.stderr ? nm.stderr.toString() : ''); fail('bundle has syntax errors (node --check)'); }
  log('  ✓ node --check passes\n');

  if (!fs.existsSync(HARNESS)) fail('contract harness not found: ' + HARNESS);

  // 2 · contracts (authoritative)
  log('  → running contract harness...\n');
  const res = spawnSync('node', [HARNESS], { stdio: 'inherit' });
  if (res.status !== 0) fail('bundle contracts FAILED — drift detected (see harness output)');
  log('  ✓ all module contracts hold in dense bundle\n');
  log('\n  ✅ Build gate passed — bundle is ready to ship.\n');
  process.exit(0);
}

main();
