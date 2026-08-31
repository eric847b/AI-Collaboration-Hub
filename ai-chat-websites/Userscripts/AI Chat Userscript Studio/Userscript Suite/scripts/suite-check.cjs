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
    const detail = ok ? (r.summary || 'exit 0') : ((r.summary ? r.summary + ' — ' : '') + 'exit ' + r.exit);
    console.log('  ' + (ok ? '✓' : '✗') + ' ' + label + '  [' + detail + ']');
    if (!ok && r.exit === null && r.out) {
      console.log('    (timed out or crashed — tail: ' + (r.out.split('\n').filter(Boolean).slice(-3).join(' | ')) + ')');
    }
  }

  console.log('\n  ── summary ──');
    // Toolchain regression guard — locks the zero-node_modules guarantee.
  // Fails the gate if any future change re-introduces node_modules refs in the
  // pre-commit hook, an npm-install lifecycle, or non-empty devDependencies.
  let toolchainFail = false;
  const hubPkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  const repoRoot = (() => { let d = ROOT; while (d !== path.dirname(d) && !fs.existsSync(path.join(d, '.git'))) d = path.dirname(d); return d; })();
  const rootPkg = fs.existsSync(path.join(repoRoot, 'package.json')) ? JSON.parse(fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8')) : null;
    // Strip full-line # comments first so legitimate mentions (e.g. the comment
  // "zero node_modules required") don't false-positive; only actual CODE
  // references to node_modules (like node_modules/.bin/<tool>) are a regression.
  const preHookRaw = fs.readFileSync(path.join(repoRoot, '.husky', 'pre-commit'), 'utf8');
  const preHook = preHookRaw.split('\n').map(l => l.trim().startsWith('#') ? '' : l).join('\n');
  const guarantees = [
    ['suite devDependencies empty', hubPkg && Object.keys(hubPkg.devDependencies || {}).length === 0],
    ['root devDependencies empty', rootPkg && Object.keys(rootPkg.devDependencies || {}).length === 0],
    ['hook contains no node_modules references', !preHook.includes('node_modules')],
    ['hook delegates to js-gate.mjs', preHook.includes('js-gate.mjs')],
    ['js-gate.mjs present at repo root', fs.existsSync(path.join(repoRoot, '.husky', 'js-gate.mjs'))]
  ];
  for (const [label, ok] of guarantees) {
    if (!ok) toolchainFail = true;
    results.push({ label: 'Toolchain: ' + label, exit: ok ? 0 : 1, summary: ok ? 'guaranteed' : 'regression detected' });
    console.log('  ' + (ok ? '✓' : '✗') + ' Toolchain: ' + label + '  [' + (ok ? 'guaranteed' : 'regression detected') + ']');
  }

  // Parse gate — every shippable source must be syntactically valid JavaScript.
  // Catches undeclared private fields, truncated concatenations, and other
  // fatal-parse defects no functional harness covers: parse (never execute)
  // the hub, every Modules/** userscript, and the dist bundle when present.
  const vm = require('vm');
  let parseFail = false;
  const parseTargets = [path.join(ROOT, '00-hub.user.js')];
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith('.user.js')) parseTargets.push(p);
    }
  };
  walk(path.join(ROOT, 'Modules'));
  for (const f of parseTargets) {
    let ok = true, msg = 'parsed';
    try { new vm.Script(fs.readFileSync(f, 'utf8'), { filename: path.relative(ROOT, f) }); }
    catch (e) { ok = false; msg = e.message.split('\n')[0]; }
    if (!ok) parseFail = true;
    results.push({ label: 'Parse: ' + path.relative(ROOT, f), exit: ok ? 0 : 1, summary: msg });
    console.log('  ' + (ok ? '✓' : '✗') + ' Parse: ' + path.relative(ROOT, f) + '  [' + msg + ']');
  }
  const distBundle = path.join(ROOT, 'dist', 'ai-chat-userscript-suite.bundle.user.js');
  if (fs.existsSync(distBundle)) {
    let ok = true, msg = 'parsed';
    try { new vm.Script(fs.readFileSync(distBundle, 'utf8'), { filename: 'dist bundle' }); }
    catch (e) { ok = false; msg = e.message.split('\n')[0]; }
    if (!ok) parseFail = true;
    results.push({ label: 'Parse: dist bundle', exit: ok ? 0 : 1, summary: msg });
    console.log('  ' + (ok ? '✓' : '✗') + ' Parse: dist bundle  [' + msg + ']');
  }

  console.log('  total harnesses: ' + results.length);
  console.log('  passing:         ' + results.filter(r => r.exit === 0).length);
  console.log('  failing:         ' + results.filter(r => r.exit !== 0).length);
    if (anyFail || toolchainFail || parseFail) {
    console.log('\n  ✗ SUITE HEALTH FAILED — see failing harness(es) above.\n');
    process.exit(1);
  }
  console.log('\n  ✅ SUITE HEALTHY — all harnesses green (exit 0).\n');
  process.exit(0);
}

main();