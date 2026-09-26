#!/usr/bin/env node
'use strict';
/**
 * flake-tracker.cjs - test flake-rate ledger plus trend views.
 * record | report | markdown. Mirrors bundle/coverage-trend pattern.
 * A flake is a test that failed then passed on retry in the same run.
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const DEFAULT_LEDGER = path.join('docs', 'metrics', 'flake-history.json');
const MAX_ENTRIES = 200;

const argv = process.argv.slice(2);
const cmd = (argv.find((a) => ['record', 'report', 'markdown'].includes(a)) || 'report');

function opt(name, def) {
  const i = argv.indexOf(name);
  return i >= 0 && i + 1 < argv.length ? argv[i + 1] : def;
}
function ledgerPath() {
  const given = opt('--ledger', '');
  return path.isAbsolute(given) ? given : path.join(ROOT, given || DEFAULT_LEDGER);
}
function gitSha() {
  try {
    return execSync('git rev-parse --short HEAD', { cwd: ROOT }).toString().trim();
  } catch {
    return 'unknown';
  }
}
function loadLedger(file) {
  try {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (parsed && Array.isArray(parsed.entries)) return parsed;
  } catch { /* fresh ledger */ }
  return { version: 1, entries: [] };
}
function saveLedger(file, ledger) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(ledger, null, 2) + '\n', 'utf8');
}
const num = (v, d) => {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : d;
};
function record() {
  const suite = opt('--suite', '');
  if (!suite || !/^[a-z0-9][a-z0-9:_-]*$/i.test(suite)) {
    console.error('flake-tracker: record needs --suite <name>');
    return 1;
  }
  const note = opt('--note', '');
  let tests, passed, failed, retries, flakes;
  const pwFile = opt('--from-playwright', '');
  if (pwFile) {
    const abs = path.isAbsolute(pwFile) ? pwFile : path.join(ROOT, pwFile);
    let parsed;
    try {
      parsed = JSON.parse(fs.readFileSync(abs, 'utf8'));
    } catch {
      console.error('flake-tracker: cannot read playwright report ' + pwFile);
      return 1;
    }
    const stats = (parsed && parsed.stats) || {};
    const flaky = num(stats.flaky, 0);
    const unexpected = num(stats.unexpected, 0);
    const expected = num(stats.expected, 0);
    const skipped = num(stats.skipped, 0);
    tests = expected + unexpected + flaky + skipped;
    passed = expected; failed = unexpected; retries = flaky; flakes = flaky;
  } else {
    tests = num(opt('--tests', ''), NaN);
    passed = num(opt('--passed', ''), NaN);
    if (!Number.isFinite(tests) || !Number.isFinite(passed) || passed > tests) {
      console.error('flake-tracker: needs --tests N --passed N plus optional --failed/--retries/--flakes');
      return 1;
    }
    failed = num(opt('--failed', tests - passed), tests - passed);
    retries = num(opt('--retries', 0), 0);
    flakes = argv.includes('--flakes') ? num(opt('--flakes', 0), 0) : Math.min(retries, passed);
  }
  const rate = tests > 0 ? (flakes / tests) * 100 : null;
  const file = ledgerPath();
  const ledger = loadLedger(file);
  ledger.entries.push({ timestamp: new Date().toISOString(), gitSha: gitSha(), suite, note, tests, passed, failed, retries, flakes, rate });
  while (ledger.entries.length > MAX_ENTRIES) ledger.entries.shift();
  saveLedger(file, ledger);
  console.log('flake-tracker: recorded ' + suite + ': ' + passed + '/' + tests + ' passed, retries=' + retries + ' flakes=' + flakes);
  return 0;
}
const GRAINS = ' .:-=+*#%@';
const fmtRate = (v) => (v === null || v === undefined ? 'n/a' : Number(v).toFixed(1) + '%');
function suiteSeries(entries, suite) {
  return entries.filter((e) => e.suite === suite).map((e) => (typeof e.rate === 'number' ? e.rate : null));
}
function spark(series) {
  const nums = series.filter((v) => v !== null && v !== undefined);
  if (nums.length === 0) return '(no data)';
  const lo = Math.min(...nums);
  const hi = Math.max(...nums);
  const span = hi - lo || 1;
  return series.map((v) => {
    if (v === null || v === undefined) return ' ';
    return GRAINS[Math.min(GRAINS.length - 1, Math.floor(((v - lo) / span) * (GRAINS.length - 1)))];
  }).join('');
}
function report() {
  const limit = num(opt('--limit', 5), 5);
  const ledger = loadLedger(ledgerPath());
  const entries = ledger.entries.slice(-Math.max(limit, 1));
  if (entries.length === 0) {
    console.log('flake-tracker: ledger is empty; record a run first.');
    return 0;
  }
  const suites = [...new Set(ledger.entries.map((e) => e.suite))].sort();
  for (const e of entries) {
    console.log(e.timestamp + ' (' + e.gitSha + ', ' + e.suite + (e.note ? ', ' + e.note : '') + ')');
    console.log('  tests=' + e.tests + ' passed=' + e.passed + ' failed=' + e.failed + ' retries=' + e.retries + ' flakes=' + e.flakes + ' rate=' + fmtRate(e.rate));
  }
  console.log('');
  console.log('Flake rate trend (%, latest last):');
  for (const s of suites) {
    const series = suiteSeries(ledger.entries, s);
    console.log('  ' + s.padEnd(28) + ' ' + spark(series) + ' (latest ' + fmtRate(series[series.length - 1]) + ')');
  }
  console.log('');
  return 0;
}
function markdown() {
  const file = ledgerPath();
  const outArg = opt('--out', '');
  const outPath = path.isAbsolute(outArg) ? outArg : path.join(ROOT, outArg || path.join('docs', 'metrics', 'flake-report.md'));
  const ledger = loadLedger(file);
  const entries = ledger.entries.slice(-8).reverse();
  if (entries.length === 0) {
    console.log('flake-tracker: ledger is empty; nothing to render.');
    return 0;
  }
  const latest = entries[0];
  const suites = [...new Set(ledger.entries.map((e) => e.suite))].sort();
  const out = [];
  out.push('# Flaky-Test Report');
  out.push('');
  out.push('> Auto-generated by `node tools/flake-tracker.cjs markdown` - do not hand-edit.');
  out.push('> Latest snapshot: ' + latest.timestamp + ' (' + latest.gitSha + ', suite ' + latest.suite + ').');
  out.push('');
  out.push('## Latest per suite');
  out.push('');
  out.push('| Suite | Tests | Passed | Failed | Retries | Flakes | Flake rate |');
  out.push('|-------|------:|-------:|-------:|--------:|-------:|-----------:|');
  for (const s of suites) {
    const last = [...ledger.entries].reverse().find((e) => e.suite === s);
    out.push('| ' + s + ' | ' + last.tests + ' | ' + last.passed + ' | ' + last.failed + ' | ' + last.retries + ' | ' + last.flakes + ' | ' + fmtRate(last.rate) + ' |');
  }
  if (ledger.entries.length > 1) {
    out.push('');
    out.push('## Trend - flake rate % (oldest first)');
    out.push('');
    out.push('```text');
    for (const s of suites) {
      const series = suiteSeries([...ledger.entries], s);
      out.push(s.padEnd(28) + ' ' + spark(series) + ' (latest ' + fmtRate(series[series.length - 1]) + ')');
    }
    out.push('```');
  }
  out.push('');
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, out.join('\n') + '\n', 'utf8');
  console.log('flake-tracker: markdown report -> ' + path.relative(ROOT, outPath));
  return 0;
}
function main() {
  if (cmd === 'record') return record();
  if (cmd === 'report') return report();
  if (cmd === 'markdown') return markdown();
  console.error('flake-tracker: unknown command "' + cmd + '" (expected: record | report | markdown)');
  return 1;
}
process.exitCode = main();
