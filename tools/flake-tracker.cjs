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

// ---- Non-interactive argv tokenizer (Round 12 D hardening) ---------------------
// Commands are positionals (record | report | markdown); every knob is a value
// flag accepted as `--flag value` or `--flag=value`. `--flakes` is the one
// optional-value flag: bare `--flakes` means 0, `--flakes 3` sets the count.
// Unknown flags, unknown commands and missing values exit 2. No stdin prompts.
const COMMANDS = ['record', 'report', 'markdown'];
const VALUE_FLAGS = new Set([
  '--ledger',
  '--suite',
  '--note',
  '--from-playwright',
  '--tests',
  '--passed',
  '--failed',
  '--retries',
  '--limit',
  '--out',
]);
const OPTIONAL_VALUE_FLAGS = new Set(['--flakes']);
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
    // Membership FIRST: a token in no inventory is an unknown flag, full stop.
    // Only a DECLARED flag may then be reported as missing its value — calling
    // a known flag "unknown" misleads the user into thinking they mistyped it.
    if (!VALUE_FLAGS.has(key) && !OPTIONAL_VALUE_FLAGS.has(key)) {
      console.error(`flake-tracker: unknown flag "${key}" - see \`node tools/flake-tracker.cjs --help\``);
      process.exit(2);
    }
    let value;
    if (eq >= 0) {
      value = a.slice(eq + 1);
    } else if (i + 1 < argv.length && !argv[i + 1].startsWith('-')) {
      value = argv[i + 1];
      i += 1;
    } else if (OPTIONAL_VALUE_FLAGS.has(key)) {
      value = true;
    } else {
      console.error(`flake-tracker: flag "${key}" requires a value - see \`node tools/flake-tracker.cjs --help\``);
      process.exit(2);
    }
    flags[key] = value;
    continue;
  }
  positionals.push(a);
}

function usage() {
  console.log(
    [
      'flake-tracker.cjs - test flake-rate ledger plus trend views (mirrors bundle/coverage-trend)',
      '',
      'Usage: node tools/flake-tracker.cjs <command> [options]',
      '',
      'Commands:',
      '  record     append one run snapshot to the ledger (the only writer)',
      '  report     print recent runs + per-suite flake-rate trend (default)',
      '  markdown   render docs/metrics/flake-report.md',
      '',
      'Flags (all take a value; --flag value or --flag=value):',
      '  --suite <name>            suite id for `record` (required there)',
      '  --tests <n>               total tests for `record`',
      '  --passed <n>              passed count for `record`',
      '  --failed <n>             failed count (default: tests - passed)',
      '  --retries <n>             retry count (default 0)',
      '  --flakes [<n>]            flake count (bare flag means 0; default min(retries, passed))',
      '  --from-playwright <path>  derive counts from a Playwright JSON report',
      '  --note <text>             free-text note stored with the entry',
      '  --ledger <path>           ledger file (default docs/metrics/flake-history.json)',
      '  --limit <n>               rows shown by `report` (default 5)',
      '  --out <path>              markdown output (default docs/metrics/flake-report.md)',
      '  --help                    print this text and exit 0',
      '',
      'Exit codes: 0 = success, 1 = command failure, 2 = bad usage.',
      'Unknown flags, unknown commands and missing flag values exit 2.',
    ].join('\n')
  );
}

if (flags['--help']) {
  usage();
  process.exit(0);
}
if (positionals.length > 1) {
  console.error(
    `flake-tracker: unexpected argument "${positionals[1]}" - expected at most one command (see \`node tools/flake-tracker.cjs --help\`)`
  );
  process.exit(2);
}
if (positionals.length === 1 && !COMMANDS.includes(positionals[0])) {
  console.error(
    `flake-tracker: unknown command "${positionals[0]}" (expected: ${COMMANDS.join(' | ')}) - see \`node tools/flake-tracker.cjs --help\``
  );
  process.exit(2);
}
const cmd = positionals[0] || 'report';

function opt(name, def) {
  return flags[name] === undefined ? def : flags[name];
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
    // `--flakes` is an optional-value flag: the tokenizer stores `true` for the
    // bare form, which must mean 0 (num(true) would coerce to 1).
    const flakeFlag = flags['--flakes'];
    flakes =
      flakeFlag === undefined
        ? Math.min(retries, passed)
        : num(flakeFlag === true ? 0 : flakeFlag, 0);
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
