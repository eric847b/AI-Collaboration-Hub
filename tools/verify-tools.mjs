#!/usr/bin/env node
/**
 * verify-tools.mjs — one-command health check for all workspace Node tooling.
 *
 * v2 (2026-10-01): every smoke result is *classified*, not just pass/fail.
 *   - `ok`   — tool behaved
 *   - `warn` — advisory condition that is NOT a code fault (the OPS-dashboard
 *              freshness probe: a stale dashboard is an ops signal, and its own
 *              per-section timestamps already say "regenerate me")
 *   - `fail` — real drift: syntax error, broken link, secret, missing artifact,
 *              missing markers, uncovered manifest, malformed handoff, …
 * Only `fail` breaks the default exit code; `--strict` promotes `warn` to a
 * failure so CI can opt into "regenerate the dashboard or the build is red".
 * This removes the false-FAIL that made verify-tools red on any tree whose
 * committed dashboard was >24h old (observed live 2026-10-01: 10 sections at
 * 45.9h while every tool was actually healthy).
 *
 * v2.1 (2026-10-01): no silent greens. `--only <typo>` used to select zero tools,
 * print "0 tools, 0 failed" and exit 0 — a false pass of exactly the class v2
 * fixed. An unmatched selector is now a hard `fail` (`no-tools-matched`, exit 1),
 * an empty tools/ directory is `no-tools-discovered` (same exit), and a
 * non-numeric `--max-age-hours` is a runner setup error (exit 2) instead of being
 * forwarded to the dashboard probe as garbage.
 *
 *   node tools/verify-tools.mjs                      # syntax + smoke of every tool
 *   node tools/verify-tools.mjs --strict             # warns also fail (parity DIFF, stale dashboard)
 *   node tools/verify-tools.mjs --json               # machine-readable report (schema 1)
 *   node tools/verify-tools.mjs --quiet              # only problems + one summary line
 *   node tools/verify-tools.mjs --list               # print the smoke matrix, run nothing
 *   node tools/verify-tools.mjs --self-test          # unit-test classifier/arg logic, run nothing
 *   node tools/verify-tools.mjs --only ops-dashboard.mjs   # triage one probe
 *   node tools/verify-tools.mjs --max-age-hours 48   # forwarded to ops-dashboard --check
 *
 * Steps per tool in tools/*.mjs|*.cjs (auto-discovered, sorted):
 *   1. `node --check` syntax validation (fast, no side effects)
 *   2. tool-specific read-only smoke invocation (SMOKE matrix); tools whose
 *      smoke would spawn servers or write artifacts stay syntax-checked only.
 *
 * Exit codes: 0 all green (warns allowed unless --strict) · 1 failures (or warns
 * under --strict; an unmatched `--only` selector counts as a failure) · 2 runner
 * setup error (cannot list tools/, invalid `--max-age-hours`).
 */
import { execFileSync, execFile } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TOOLS_DIR = path.join(ROOT, 'tools');

const argv = process.argv.slice(2);
const has = (flag) => argv.includes(flag);
const opt = (name, def) => {
  const i = argv.indexOf(name);
  return i >= 0 && i + 1 < argv.length ? argv[i + 1] : def;
};

const strict = has('--strict');
const asJson = has('--json');
const quiet = has('--quiet');
const maxAgeHours = opt('--max-age-hours', '');
const onlyArg = opt('--only', '');


/**
 * Read-only smoke argv per tool basename. `undefined` = syntax-check only
 * (server-spawning or artifact-writing tools stay syntax-checked). Every entry
 * must be side-effect free — asserted by the self-test below.
 */
const SMOKE = {
  'check-doc-links.mjs': ['--quiet'],
  'check-doc-facts.mjs': [],
  'check-flag-contract.mjs': [],
  'extension-check.mjs': ['--quiet'],
  'secret-scan.mjs': ['--quiet'],
  'workflow-audit.mjs': ['--quiet'],
  'dependabot-check.mjs': [],
  'handoff-check.mjs': ['--quiet'],
  'sync-parity.mjs': ['check'],
  'new-project.mjs': ['--self-test'],
  'bundle-trend.cjs': ['report', '--limit', '1'],
  'coverage-trend.cjs': ['report', '--limit', '1'],
  'flake-tracker.cjs': ['report', '--limit', '1'],
  'ops-dashboard.mjs': ['--check'],
  'telemetry-collector.mjs': ['report', '--limit', '1'],
  'telemetry-export.mjs': ['--self-test'],
  // Cheap and read-only on purpose: a bare run would spawn every probed tool's
  // --self-test, which is far too slow (and pointlessly heavy) for a smoke row.
  // `--self-test` is the better pick now that the tool has one: it is equally
  // instant and actually asserts the verdict logic rather than just listing ids.
  'mutation-probe.mjs': ['--self-test'],
};

/** Tokens that must never appear in a smoke probe (they mutate state). */
const DESTRUCTIVE_TOKENS = [
  'sync',
  'push',
  'collect',
  'serve',
  'prune',
  '--update-baseline',
  '--refresh',
  '--fix',
  '--write',
  '--all',
];

function smokeArgsFor(tool, { strictMode = strict, dashboardMaxAge = maxAgeHours } = {}) {
  const base = SMOKE[tool];
  if (base === undefined) return undefined;
  const args = base.slice();
  if (tool === 'sync-parity.mjs' && strictMode) args.push('--strict');
  if (tool === 'ops-dashboard.mjs' && dashboardMaxAge) args.push('--max-age-hours', String(dashboardMaxAge));
  return args;
}

/**
 * Map a raw smoke outcome onto a tier. `res.out` is the combined stdout+stderr
 * of the failed probe; reasons are stable machine-greppable slugs.
 */
function classifySmoke(tool, res) {
  if (res.ok) return { level: 'ok', reason: null };
  const text = String(res.out || '');
  if (tool === 'ops-dashboard.mjs') {
    if (/does not exist/i.test(text)) return { level: 'fail', reason: 'dashboard-output-missing' };
    if (/no timestamp marker/i.test(text)) return { level: 'fail', reason: 'dashboard-markers-missing' };
    if (/STALE \(>/i.test(text) || /stale\/unknown section/i.test(text)) {
      return { level: 'warn', reason: 'dashboard-stale' };
    }
  }
  return { level: 'fail', reason: `smoke-exit-${res.status ?? '?'}` };
}

function exitCodeFor({ failed, warned }, strictMode = strict) {
  if (failed > 0) return 1;
  if (strictMode && warned > 0) return 1;
  return 0;
}

/**
 * Single source of truth for the run tally, derived from the rows themselves so
 * the printed line, the JSON summary and the exit code can never disagree.
 * `toolsAttempted` counts probes actually run - the synthetic guard row is a
 * failure notice, not a tool.
 */
function summarize(rows, toolsAttempted = rows.length, strictMode = strict) {
  const at = (level) => rows.filter((r) => r.level === level).length;
  const failed = at('fail');
  const warned = at('warn');
  return {
    tools: toolsAttempted,
    ok: at('ok'),
    warn: warned,
    failed,
    strict: strictMode,
    exitCode: exitCodeFor({ failed, warned }, strictMode),
  };
}

function clean(out, limit = 900) {
  const text = String(out ?? '').replace(/\r/g, '').trim();
  return text.length > limit ? `${text.slice(0, limit)}…` : text;
}

/**
 * `--only <tool[,tool]>` narrows the matrix for triage (empty selector = all).
 * Returns names in the caller's original (sorted) order, so output stays stable.
 */
function selectTools(all, selector) {
  const wanted = String(selector || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (wanted.length === 0) return all.slice();
  return all.filter((t) => wanted.includes(t));
}

/**
 * v2.1 false-green guard: verify-tools must never exit 0 having run zero tools.
 * Two ways that happens — `--only typo.mjs` matches nothing, or tools/ yields no
 * `.mjs`/`.cjs` at all (wrong cwd, empty checkout). Both return a synthetic
 * failing row; a non-empty `selected` list returns null.
 */
function selectionGuard(selected, selector) {
  if (selected.length > 0) return null;
  const wanted = String(selector || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const matchedNothing = wanted.length > 0;
  return {
    tool: '(selector)',
    syntax: '-',
    smoke: '-',
    level: 'fail',
    reason: matchedNothing ? 'no-tools-matched' : 'no-tools-discovered',
    detail: matchedNothing
      ? `--only '${wanted.join(', ')}' matched no tools/*.{mjs,cjs} - check the spelling (node tools/verify-tools.mjs --list)`
      : 'no tools/*.{mjs,cjs} discovered - wrong working directory, or tools/ is empty?',
  };
}

/**
 * `--max-age-hours` reaches ops-dashboard through child argv, so anything that is
 * not a non-negative finite number is a setup error (exit 2), never a probe.
 * Empty string = "use the probe's own default".
 */
function invalidMaxAge(value) {
  const v = String(value ?? '').trim();
  if (v === '') return false;
  const n = Number(v);
  return !Number.isFinite(n) || n < 0;
}


// ---- self-test -------------------------------------------------------------

function runSelfTest() {
  const cases = [];
  const check = (name, actual, expected) =>
    cases.push({ name, pass: JSON.stringify(actual) === JSON.stringify(expected), actual, expected });

  // classification: healthy tool
  check('ok passes through', classifySmoke('check-doc-links.mjs', { ok: true, out: '' }), { level: 'ok', reason: null });

  // classification: a stale dashboard is advisory, never a code fault
  const staleOut =
    '  parity  45.9h  STALE (> 24h)' +
    'ops-dashboard: 1 stale/unknown section(s) - run: node tools/ops-dashboard.mjs';
  check('stale dashboard warns', classifySmoke('ops-dashboard.mjs', { ok: false, status: 1, out: staleOut }).level, 'warn');
  check('stale reason slug', classifySmoke('ops-dashboard.mjs', { ok: false, out: staleOut }).reason, 'dashboard-stale');
  check(
    'missing markers still fail',
    classifySmoke('ops-dashboard.mjs', { ok: false, out: '  workflows  no timestamp marker - regenerate' }).level,
    'fail'
  );
  check(
    'missing output still fails',
    classifySmoke('ops-dashboard.mjs', { ok: false, out: 'freshness FAIL - OPS-DASHBOARD.md does not exist' }).reason,
    'dashboard-output-missing'
  );

  // classification: every other failure stays hard
  check('other tool failure is hard', classifySmoke('secret-scan.mjs', { ok: false, status: 1, out: 'finding' }).level, 'fail');
  check('exit status is surfaced', classifySmoke('handoff-check.mjs', { ok: false, status: 3, out: '' }).reason, 'smoke-exit-3');

  // exit-code semantics
  check('green exits 0', exitCodeFor({ failed: 0, warned: 0 }), 0);
  check('warn alone exits 0', exitCodeFor({ failed: 0, warned: 2 }), 0);
  check('warn under --strict exits 1', exitCodeFor({ failed: 0, warned: 2 }, true), 1);
  check('fail exits 1', exitCodeFor({ failed: 1, warned: 0 }), 1);
  check('fail dominates --strict', exitCodeFor({ failed: 1, warned: 5 }, true), 1);

  // summary derivation: rows are the single source of truth for the tally
  check(
    'summary counts every level',
    (() => {
      const s = summarize([{ level: 'ok' }, { level: 'warn' }, { level: 'fail' }], 3);
      return [s.tools, s.ok, s.warn, s.failed, s.exitCode];
    })(),
    [3, 1, 1, 1, 1]
  );
  check('summary ignores guard rows in the tool count', summarize([{ level: 'fail' }], 0).tools, 0);
  check('summary exit follows strict', summarize([{ level: 'warn' }], 1, true).exitCode, 1);
  check('summary stays green without failures', summarize([{ level: 'ok' }, { level: 'ok' }], 2).exitCode, 0);
  check('summary flags strict mode', summarize([], 0, true).strict, true);

  // argument plumbing
  check('parity default args', smokeArgsFor('sync-parity.mjs', { strictMode: false }), ['check']);
  check('parity strict args', smokeArgsFor('sync-parity.mjs', { strictMode: true }), ['check', '--strict']);
  check('dashboard default args', smokeArgsFor('ops-dashboard.mjs', { dashboardMaxAge: '' }), ['--check']);
  check('dashboard max-age passthrough', smokeArgsFor('ops-dashboard.mjs', { dashboardMaxAge: '48' }), [
    '--check',
    '--max-age-hours',
    '48',
  ]);
  check('unknown tool is syntax-only', smokeArgsFor('load-test.mjs', {}), undefined);
  check(
    'matrix entries are copied',
    smokeArgsFor('check-doc-links.mjs', {}).length === SMOKE['check-doc-links.mjs'].length,
    true
  );

  // --only selector
  check('selector keeps one tool', selectTools(['a.mjs', 'b.mjs'], 'b.mjs'), ['b.mjs']);
  check('empty selector keeps all', selectTools(['a.mjs', 'b.mjs'], ''), ['a.mjs', 'b.mjs']);
  check('selector takes a comma list + spaces', selectTools(['a.mjs', 'b.mjs', 'c.mjs'], ' a.mjs , c.mjs '), ['a.mjs', 'c.mjs']);
  check('unknown selector selects nothing', selectTools(['a.mjs'], 'zz.mjs'), []);
  check('selector never mutates the input', (() => {
    const all = ['a.mjs', 'b.mjs'];
    selectTools(all, '');
    return all.length;
  })(), 2);

  // false-green guard: running zero tools must never look like a clean run
  check('unmatched selector is a failure', selectionGuard([], 'zz.mjs')?.level ?? null, 'fail');
  check('unmatched selector reason slug', selectionGuard([], 'zz.mjs').reason, 'no-tools-matched');
  check('unmatched selector names the typo', selectionGuard([], 'zz.mjs').detail.includes("'zz.mjs'"), true);
  check('matched selector is not guarded', selectionGuard(['a.mjs'], 'a.mjs'), null);
  check('partial match is not guarded', selectionGuard(['a.mjs'], 'a.mjs,zz.mjs'), null);
  check('a non-empty selection is never guarded', selectionGuard(['a.mjs'], ''), null);
  check('empty tools dir is a failure', selectionGuard([], '').reason, 'no-tools-discovered');
  check('guard row is not ok-level', selectionGuard([], '').level === 'ok', false);

  // setup validation: --max-age-hours must be a non-negative finite number
  check('empty max-age is allowed', invalidMaxAge(''), false);
  check('numeric max-age is allowed', invalidMaxAge('48'), false);
  check('zero max-age is allowed', invalidMaxAge('0'), false);
  check('non-numeric max-age is rejected', invalidMaxAge('soon'), true);
  check('negative max-age is rejected', invalidMaxAge('-3'), true);
  check('infinite max-age is rejected', invalidMaxAge('Infinity'), true);

  // end-to-end CLI paths that run ZERO probes (fast, so the self-test stays cheap).
  // These cover the tail of the runner - printing and exit - which unit checks on
  // pure helpers cannot reach (a removed counter variable once crashed there).
  const cli = (args) => {
    try {
      const out = execFileSync(process.execPath, [fileURLToPath(import.meta.url), ...args], {
        cwd: ROOT,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
        timeout: 60000,
      });
      return { code: 0, out };
    } catch (e) {
      return { code: e.status ?? null, out: ((e.stdout || '') + (e.stderr || '')).trim() };
    }
  };
  const guardRun = cli(['--only', 'zz-no-such-tool.mjs', '--quiet']);
  check('cli rejects an unmatched selector', guardRun.code, 1);
  check('cli prints the summary after the guard', /1 failed\./.test(guardRun.out), true);
  check('cli names the guard reason', guardRun.out.includes('no-tools-matched'), true);
  check('cli rejects a bad --max-age-hours', cli(['--max-age-hours', 'soon']).code, 2);

  // matrix safety: side-effect free, no self-recursion, arrays only
  const offenders = [];
  for (const [tool, args] of Object.entries(SMOKE)) {
    if (!Array.isArray(args)) offenders.push(`${tool} (not an array)`);
    if (tool === 'verify-tools.mjs') offenders.push(`${tool} (self-recursion)`);
    for (const token of args) if (DESTRUCTIVE_TOKENS.includes(token)) offenders.push(`${tool} ${token}`);
  }
  check('smoke matrix is side-effect free', offenders, []);

  const failed = cases.filter((c) => !c.pass);
  for (const c of failed) {
    console.error(`FAIL  ${c.name}`);
    console.error(`      expected ${JSON.stringify(c.expected)}`);
    console.error(`      actual   ${JSON.stringify(c.actual)}`);
  }
  console.log(`verify-tools self-test: ${cases.length - failed.length}/${cases.length} passed`);
  process.exit(failed.length > 0 ? 1 : 0);
}


// ---- cli -------------------------------------------------------------------

function usage() {
  console.log(
    [
      'usage: node tools/verify-tools.mjs [--strict] [--json] [--quiet] [--list] [--self-test] [--only <tool,...>] [--max-age-hours <h>]',
      '',
      '  --strict          promote advisory warns (stale dashboard, parity DIFF) to failures',
      '  --json            machine-readable report (schema 1)',
      '  --quiet           print only problems + a one-line summary',
      '  --list            print the smoke matrix and exit',
      '  --self-test       unit-test classification/arg logic and exit',
      '  --check-cli       assert every tool answers --help with 0 and rejects an unknown',
      '                    flag with a non-zero usage exit (Round 12 D contract), then exit',
      '  --only            restrict the run to specific tool basenames (comma-separated; an',
      '                    unmatched name fails the run instead of reporting a clean zero)',
      '  --max-age-hours   forwarded to ops-dashboard.mjs --check (default: tool default 24;',
      '                    must be a non-negative number or the run exits 2)',
    ].join('\n')
  );
}

/**
 * Explicit flag inventory (Round 12 D hardening). Anything outside this set is
 * a typo and must exit 2 instead of being silently ignored - a misspelled
 * `--strict` used to run a full un-strict gate and still report green.
 * Single pass, so a repeated flag or a value that itself starts with `-` can
 * never desync the scan.
 */
const WF_BOOL_FLAGS = new Set([
  '--strict',
  '--json',
  '--quiet',
  '--list',
  '--self-test',
  '--check-cli',
]);
const VALUE_FLAGS = new Set(['--only', '--max-age-hours']);

if (has('--help') || has('-h')) {
  usage();
  process.exit(0);
}
for (let i = 0; i < argv.length; i += 1) {
  const a = argv[i];
  if (!a.startsWith('-')) {
    console.error(
      `verify-tools: unexpected argument "${a}" - this tool takes flags only (see \`node tools/verify-tools.mjs --help\`)`
    );
    process.exit(2);
  }
  const eq = a.indexOf('=');
  const key = eq >= 0 ? a.slice(0, eq) : a;
  if (key !== '--help' && key !== '-h' && !WF_BOOL_FLAGS.has(key) && !VALUE_FLAGS.has(key)) {
    console.error(`verify-tools: unknown flag "${key}" - see \`node tools/verify-tools.mjs --help\``);
    process.exit(2);
  }
  if (WF_BOOL_FLAGS.has(key) && eq >= 0) {
    console.error(`verify-tools: flag "${key}" takes no value - see \`node tools/verify-tools.mjs --help\``);
    process.exit(2);
  }
  if (VALUE_FLAGS.has(key) && eq >= 0) {
    // `opt()` resolves values via argv.indexOf('--only'), so the `--only=x`
    // form would parse here and then be silently ignored downstream. Reject it
    // rather than accept a flag that does nothing.
    console.error(
      `verify-tools: flag "${key}" takes its value as a separate argument, not "${a}" - see \`node tools/verify-tools.mjs --help\``
    );
    process.exit(2);
  }
  if (VALUE_FLAGS.has(key)) {
    if (i + 1 >= argv.length) {
      console.error(`verify-tools: flag "${key}" requires a value - see \`node tools/verify-tools.mjs --help\``);
      process.exit(2);
    }
    i += 1;
  }
}
if (has('--self-test')) runSelfTest();
if (invalidMaxAge(maxAgeHours)) {
  console.error(`verify-tools: --max-age-hours expects a non-negative number, got '${maxAgeHours}'`);
  process.exit(2);
}
/**
 * Round 12 D CLI contract, enforced instead of merely documented.
 *
 * Every tool in tools/*.mjs|*.cjs must (a) answer `--help` with exit 0 and
 * (b) REJECT an unknown flag with a non-zero usage exit instead of silently
 * ignoring it. Rationale: a silently-ignored typo is the worst class of tool
 * bug — `--stric` ran a lenient scan, `--dryrun` scaffolded real files, and
 * `--jsno` handed prose to a JSON-parsing CI caller, all while reporting a
 * confident exit 0.
 *
 * The unknown-flag exit is required to be non-zero rather than exactly 2
 * because a few tools document 1 as their usage-error code (new-project.mjs);
 * what matters is that the mistake is loud, never silent.
 *
 * Both probes are cheap and side-effect free: an unknown flag must be rejected
 * BEFORE any work, so a conformant tool never scans, scaffolds or spawns here.
 */
async function checkCliContract() {
  // Node tools that live OUTSIDE tools/ and are therefore not found by the
  // directory scan. They are held to the same contract and must be listed
  // explicitly — that scan's blind spot is exactly how .husky/js-gate.mjs
  // shipped a `--help` that exited 0 printing nothing while ignoring every flag.
  // Explicit and short on purpose: an entry here is a standing claim that this
  // out-of-tree file exposes a CLI, so adding one should be a deliberate act.
  const EXTRA_TOOLS = ['.husky/js-gate.mjs'];

  let scanned;
  try {
    scanned = fs
      .readdirSync(TOOLS_DIR)
      .filter((f) => !f.startsWith('.') && /\.(mjs|cjs)$/.test(f))
      .sort()
      .map((f) => `tools/${f}`);
  } catch (e) {
    console.error(`verify-tools: cannot list tools/ — ${e.message}`);
    process.exit(2);
  }
  // Repo-relative paths throughout, so an entry can live anywhere (tools/ or not).
  const tools = [...scanned, ...EXTRA_TOOLS];

  // Probes run CONCURRENTLY (bounded pool). Sequentially this was 38 serial
  // Node cold-starts, which dominated the gate on a loaded machine; the probes
  // are independent read-only processes, so there is nothing to serialize. A
  // bounded pool keeps the burst small enough not to starve the rest of the box.
  const PROBE_TIMEOUT_MS = 10000;
  const PROBE_CONCURRENCY = 6;

  const probe = (tool, args) =>
    new Promise((resolve) => {
      execFile(
        process.execPath,
        [path.join(ROOT, tool), ...args],
        { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: PROBE_TIMEOUT_MS },
        (err, stdout, stderr) => {
          // No error => the tool exited 0, i.e. it ACCEPTED the unknown flag.
          if (!err) return resolve(0);
          // Non-zero exit is a rejection and perfectly normal here. execFile
          // reports it as an Error carrying `.code` (and `.status`), NOT
          // reliably `.status` — reading only `.status` yielded null for a
          // clean exit-2 and made every tool look broken.
          const code = err.code ?? err.status;
          if (typeof code === 'number') return resolve(code);
          // Killed by the timeout, or died on a signal: a hang, still a failure.
          return resolve(`signal:${err.signal ?? 'unknown'}`);
        }
      );
    });

  const rows = new Array(tools.length);
  let cursor = 0;
  let failed = 0;
  const worker = async () => {
    for (;;) {
      const i = cursor++;
      if (i >= tools.length) return;
      const tool = tools[i];
      const [helpCode, badCode] = await Promise.all([
        probe(tool, ['--help']),
        // Accepted (0) means a silently-ignored typo — the bug this catches.
        probe(tool, ['--definitely-not-a-flag']),
      ]);
      const helpOk = helpCode === 0;
      const badOk = typeof badCode === 'number' && badCode !== 0;
      const ok = helpOk && badOk;
      if (!ok) failed += 1;
      rows[i] = { tool, help: helpCode, unknown: badCode, ok };
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(PROBE_CONCURRENCY, tools.length) }, () => worker())
  );

  if (asJson) {
    console.log(JSON.stringify({ schema: 1, mode: 'check-cli', rows, failed }, null, 2));
  } else if (!quiet) {
    console.log('\n# CLI contract (Round 12 D)');
    console.log('| Tool | --help | unknown flag | Verdict |');
    console.log('|------|--------|---------------|---------|');
    for (const r of rows) {
      console.log(
        `| ${r.tool} | ${r.help === 0 ? 'ok' : r.help} | ${r.unknown === 0 ? 'IGNORED' : `rejected (${r.unknown})`} | ${r.ok ? 'ok' : 'FAIL'} |`
      );
    }
  }
  const line = `verify-tools --check-cli: ${rows.length - failed}/${rows.length} tools honor the --help / reject-unknown contract.`;
  if (quiet || asJson) console.log(line);
  else console.log(`\n${line}`);
  process.exit(failed > 0 ? 1 : 0);
}

// Awaited: the probe pool is async, and an un-awaited call would let the
// module finish (and the process exit) before any probe had reported.
if (has('--check-cli')) await checkCliContract();
if (has('--list')) {
  for (const [tool, args] of Object.entries(SMOKE)) console.log(`${tool}${args.length ? ` ${args.join(' ')}` : ''}`);
  console.log(`${Object.keys(SMOKE).length} smoke probes; every other tool is syntax-checked only`);
  process.exit(0);
}

// ---- runner ----------------------------------------------------------------

function run(cmd, args) {
  try {
    const out = execFileSync(cmd, args, {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      // Generous per-tool budget for slow laptops: 5 min (was 60s).
      timeout: 300000,
    }).trim();
    return { ok: true, status: 0, out };
  } catch (e) {
    const out = ((e.stdout || '') + (e.stderr || '')).trim();
    return { ok: false, status: e.status ?? null, out: out || `(exited ${e.status ?? '?'})` };
  }
}

let tools;
try {
  tools = fs
    .readdirSync(TOOLS_DIR)
    .filter((f) => !f.startsWith('.') && /\.(mjs|cjs)$/.test(f))
    .sort();
} catch (e) {
  console.error(`verify-tools: cannot list tools/ - ${e.message}`);
  process.exit(2);
}

const rows = [];

// v2.1: a selector matching nothing is a failure, never a clean zero-tool run.
const selected = selectTools(tools, onlyArg);
const guard = selectionGuard(selected, onlyArg);
if (guard) {
  rows.push(guard);
  console.error(`FAIL  ${guard.reason}: ${guard.detail}`);
}

for (const tool of selected) {
  const abs = path.join(TOOLS_DIR, tool);
  const syntax = run(process.execPath, ['--check', abs]);
  if (!syntax.ok) {
    rows.push({ tool, syntax: 'FAIL', smoke: '-', level: 'fail', reason: 'syntax-error', detail: clean(syntax.out) });
    console.error(`FAIL  ${tool}  syntax (syntax-error):\n${syntax.out}\n`);
    continue;
  }
  const smokeArgs = smokeArgsFor(tool);
  if (smokeArgs === undefined) {
    rows.push({ tool, syntax: 'ok', smoke: 'skipped (side effects)', level: 'ok', reason: null, detail: '' });
    continue;
  }
  const smoke = run(process.execPath, [abs, ...smokeArgs]);
  const verdict = classifySmoke(tool, smoke);
  rows.push({
    tool,
    syntax: 'ok',
    smoke: verdict.level === 'ok' ? 'ok' : verdict.level,
    level: verdict.level,
    reason: verdict.reason,
    detail: verdict.level === 'ok' ? '' : clean(smoke.out),
  });
  if (verdict.level === 'fail') {
    console.error(`FAIL  ${tool} ${smokeArgs.join(' ')} (${verdict.reason}):\n${smoke.out}\n`);
  } else if (verdict.level === 'warn') {
    console.error(`WARN  ${tool} ${smokeArgs.join(' ')} (${verdict.reason}) - advisory, not a code fault`);
    console.error(
      verdict.reason === 'dashboard-stale'
        ? '      run: node tools/ops-dashboard.mjs   (or pass --strict to make this fatal)'
        : '      pass --strict to make this fatal'
    );
  }
}

const summary = summarize(rows, selected.length);

if (asJson) {
  console.log(
    JSON.stringify(
      {
        schema: 1,
        generatedAt: new Date().toISOString(),
        root: ROOT,
        selector: onlyArg || null,
        maxAgeHours: maxAgeHours || null,
        guard: guard ? guard.reason : null,
        rows,
        summary,
      },
      null,
      2
    )
  );
} else {
  const line = `verify-tools: ${summary.tools} tools, ${summary.ok} green, ${summary.warn} warn, ${summary.failed} failed${summary.strict ? ' (--strict)' : ''}.`;
  if (!quiet) {
    console.log('\n# tools verification');
    console.log('| Tool | Syntax | Smoke | Level |');
    console.log('|------|--------|-------|-------|');
    for (const r of rows) console.log(`| ${r.tool} | ${r.syntax} | ${r.smoke} | ${r.level} |`);
    console.log(`\n${line}`);
    if (summary.warn > 0 && !summary.strict) {
      console.log('verify-tools: warns are advisory ops signals - pass --strict to make them fatal.');
    }
  } else {
    console.log(line);
  }
}

process.exit(summary.exitCode);

