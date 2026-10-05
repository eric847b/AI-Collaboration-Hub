#!/usr/bin/env node
/**
 * load-test.mjs — dependency-free load tester for preview builds (plain Node http).
 *
 *   node tools/load-test.mjs --project nexus-infinity-hub [--requests 300] [--concurrency 15]
 *                            [--port 4173] [--timeout-ms 120000] [--max-error-rate 1] [--max-p95-ms 3000]
 *   node tools/load-test.mjs --url http://127.0.0.1:8080/ ...   (target an already-running server)
 *
 * With --project it starts `vite preview` for that project (dist/ must exist), waits for it,
 * runs a short warmup, then a measured phase with N concurrent workers. Reports RPS and
 * latency percentiles. Exit codes: 0 pass · 1 gate violation (error rate or p95) · 2 setup error.
 */
import { spawn } from 'node:child_process';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);

// Named so the self-test can pin them. Inlined literals were never asserted, so
// loosening a gate here would have silently green-lit a slow or broken build.
const DEFAULT_REQUESTS = 300;
const DEFAULT_CONCURRENCY = 15;
const DEFAULT_TIMEOUT_MS = 120000;
const DEFAULT_MAX_ERROR_RATE = 1; // percent
const DEFAULT_MAX_P95_MS = 3000;

// ---- Non-interactive argv tokenizer (Round 12 D hardening) ---------------------
// Every knob is a value flag, accepted as `--flag value` or `--flag=value`.
// Unknown flags, missing values and stray positionals exit 2 rather than being
// silently ignored. No stdin prompts.
const VALUE_FLAGS = new Set([
  '--url',
  '--project',
  '--port',
  '--requests',
  '--concurrency',
  '--timeout-ms',
  '--max-error-rate',
  '--max-p95-ms',
]);
const BOOL_FLAGS = new Set(['--help', '--self-test']);
const flags = {};
const positionals = [];
for (let i = 0; i < argv.length; i += 1) {
  const a = argv[i];
  if (a === '--help' || a === '-h') {
    flags['--help'] = true;
    continue;
  }
  if (BOOL_FLAGS.has(a)) {
    flags[a] = true;
    continue;
  }
  if (a.startsWith('-')) {
    const eq = a.indexOf('=');
    const key = eq >= 0 ? a.slice(0, eq) : a;
    if (!VALUE_FLAGS.has(key)) {
      console.error(`load-test: unknown flag "${key}" - see \`node tools/load-test.mjs --help\``);
      process.exit(2);
    }
    let value;
    if (eq >= 0) {
      value = a.slice(eq + 1);
    } else if (i + 1 < argv.length && !argv[i + 1].startsWith('-')) {
      value = argv[i + 1];
      i += 1;
    } else {
      console.error(`load-test: flag "${key}" requires a value - see \`node tools/load-test.mjs --help\``);
      process.exit(2);
    }
    flags[key] = value;
    continue;
  }
  positionals.push(a);
}

// ---- Pure helpers (self-tested) ---------------------------------------------------
// `Math.max(1, Number(x))` is NOT a guard: Math.max propagates NaN, so `--requests
// abc` produced NaN, which made the worker loop run zero times and the gate compare
// `NaN > 1` (always false) - the tool reported PASS having measured nothing.
// These validators are PURE (NaN means "reject") so the self-test can assert them
// in-process; `requireNumber` is the thin wrapper that turns a rejection into exit 2.
function coerceCount(raw, def) {
  if (raw === undefined) return def;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 1) return NaN;
  return Math.floor(n);
}

/** Gate thresholds must be finite and >= 0; a NaN gate disables itself silently. */
function coerceGate(raw, def) {
  if (raw === undefined) return def;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return NaN;
  return n;
}

function requireNumber(value, label, raw) {
  if (Number.isNaN(value)) {
    console.error(`load-test: ${label} must be a finite number (got ${JSON.stringify(raw)})`);
    process.exit(2);
  }
  return value;
}

function percentile(sorted, p) {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[Math.max(0, idx)];
}

/** Error rate over the number of requests actually completed, never the plan. */
function errorRatePercent(errors, measured) {
  if (!Number.isFinite(measured) || measured <= 0) return NaN;
  return (errors / measured) * 100;
}

/**
 * Gate verdict. `measured <= 0` is an explicit FAIL, not a vacuous pass: a run that
 * completed nothing must never be able to report PASS.
 */
function evaluateGates({ measured, errorRate, p95, maxErrorRate, maxP95ms }) {
  const reasons = [];
  if (!Number.isFinite(measured) || measured <= 0) reasons.push('no requests completed');
  if (!Number.isFinite(errorRate)) reasons.push('error rate not computable');
  if (errorRate > maxErrorRate) reasons.push('error rate above gate');
  if (p95 > maxP95ms) reasons.push('p95 latency above gate');
  return { failed: reasons.length > 0, reasons };
}

function usage() {
  console.log(
    [
      'load-test.mjs - dependency-free load tester for preview builds (plain Node http)',
      '',
      'Usage: node tools/load-test.mjs --project <app> [options]',
      '       node tools/load-test.mjs --url http://127.0.0.1:8080/ [options]',
      '',
      'Flags (all take a value; --flag value or --flag=value):',
      '  --project <app>          project folder with a built dist/ (starts `vite preview`)',
      '  --url <url>              target an already-running server instead of spawning preview',
      '  --port <n>               preview server port (default 4173)',
      '  --requests <n>           measured request count (default 300)',
      '  --concurrency <n>        parallel workers (default 15)',
      '  --timeout-ms <ms>        per-request timeout (default 120000 - slow-laptop budget)',
      '  --max-error-rate <pct>   error-rate gate, percent (default 1)',
      '  --max-p95-ms <ms>        p95 latency gate in ms (default 3000)',
      '  --self-test             prove the gates and thresholds bite; needs no server    [no server]',
      '  --help                   print this text and exit 0',
      '',
      'Exit codes: 0 = pass, 1 = gate violation (error rate or p95), 2 = setup error / bad usage.',
      'Unknown flags, missing flag values and unexpected arguments exit 2.',
    ].join('\n')
  );
}

function runSelfTest() {
  const failures = [];
  let ran = 0;
  const check = (name, cond) => { ran += 1; if (!cond) failures.push(name); };

  // Thresholds are pinned: an inline literal nobody asserted is how the 70%
  // coverage gate and the 10% bundle gate both hid before.
  check('default request count is 300', DEFAULT_REQUESTS === 300);
  check('default concurrency is 15', DEFAULT_CONCURRENCY === 15);
  check('default error-rate gate is 1%', DEFAULT_MAX_ERROR_RATE === 1);
  check('default p95 gate is 3000ms', DEFAULT_MAX_P95_MS === 3000);

  // coerceCount / coerceGate reject NaN, which is the whole point.
  check('coerceCount defaults', coerceCount(undefined, 300) === 300);
  check('coerceCount accepts a valid count', coerceCount('25', 300) === 25);
  check('coerceCount rejects NaN', Number.isNaN(coerceCount('abc', 300)));
  check('coerceCount rejects zero', Number.isNaN(coerceCount('0', 300)));
  check('coerceCount rejects a negative count', Number.isNaN(coerceCount('-5', 300)));
  check('coerceGate defaults', coerceGate(undefined, 3000) === 3000);
  check('coerceGate rejects NaN', Number.isNaN(coerceGate('abc', 3000)));
  check('coerceGate rejects Infinity', Number.isNaN(coerceGate('Infinity', 3000)));
  check('coerceGate accepts 0 (a deliberately open gate)', coerceGate('0', 3000) === 0);

  // percentile
  check('percentile of an empty sample is 0', percentile([], 95) === 0);
  check('percentile picks the p95 value', percentile([10, 20, 30, 40, 5000], 95) === 5000);
  check('percentile of one sample is that sample', percentile([7], 95) === 7);

  // error rate over the OBSERVED count
  check('error rate of 1/100 is 1%', errorRatePercent(1, 100) === 1);
  check('error rate of 0 completed is NaN, not Infinity', Number.isNaN(errorRatePercent(0, 0)));

  // THE FALSE-GREEN: a run that measured nothing must never report PASS.
  const emptyRun = evaluateGates({ measured: 0, errorRate: NaN, p95: 0, maxErrorRate: 1, maxP95ms: 3000 });
  check('a run with zero measured requests FAILS', emptyRun.failed === true);
  check('the zero-request failure is named', emptyRun.reasons.some((r) => r.includes('no requests completed')));
  const nanPlan = evaluateGates({ measured: NaN, errorRate: NaN, p95: 0, maxErrorRate: 1, maxP95ms: 3000 });
  check('a NaN request count FAILS rather than vacuously passing', nanPlan.failed === true);

  // Both gates still bite.
  const errFails = evaluateGates({ measured: 100, errorRate: 50, p95: 10, maxErrorRate: 1, maxP95ms: 3000 });
  check('a 50% error rate FAILS the 1% gate', errFails.failed === true);
  const slowFails = evaluateGates({ measured: 100, errorRate: 0, p95: 9000, maxErrorRate: 1, maxP95Ms: 3000, maxP95ms: 3000 });
  check('a 9000ms p95 FAILS the 3000ms gate', slowFails.failed === true);
  const bothPass = evaluateGates({ measured: 100, errorRate: 0, p95: 120, maxErrorRate: 1, maxP95ms: 3000 });
  check('a healthy run PASSES', bothPass.failed === false && bothPass.reasons.length === 0);
  check('boundary: error rate exactly at the gate passes', evaluateGates({ measured: 100, errorRate: 1, p95: 0, maxErrorRate: 1, maxP95ms: 3000 }).failed === false);
  check('boundary: p95 exactly at the gate passes', evaluateGates({ measured: 100, errorRate: 0, p95: 3000, maxErrorRate: 1, maxP95ms: 3000 }).failed === false);
  check('boundary: one ms over the p95 gate fails', evaluateGates({ measured: 100, errorRate: 0, p95: 3001, maxErrorRate: 1, maxP95Ms: 3000, maxP95ms: 3000 }).failed === true);

  if (failures.length) {
    console.error(`load-test self-test FAIL: ${failures.length} problem(s):`);
    for (const f of failures) console.error(`  FAIL  ${f}`);
    process.exit(1);
  }
  console.log(`load-test self-test: ${ran}/${ran} passed`);
}

if (flags['--help']) {
  usage();
  process.exit(0);
}
if (flags['--self-test']) {
  runSelfTest();
  process.exit(0);
}
if (positionals.length > 0) {
  console.error(
    `load-test: unexpected argument "${positionals[0]}" - this tool takes flags only (see \`node tools/load-test.mjs --help\`)`
  );
  process.exit(2);
}

const opt = (name, def) => (flags[name] === undefined ? def : flags[name]);

const urlArg = opt('--url', '');
const project = opt('--project', '');
const port = Number(opt('--port', '4173'));
const totalRequests = requireNumber(coerceCount(flags['--requests'], DEFAULT_REQUESTS), '--requests', flags['--requests']);
const concurrency = requireNumber(coerceCount(flags['--concurrency'], DEFAULT_CONCURRENCY), '--concurrency', flags['--concurrency']);
// Slow-laptop default: per-request 120s budget (was 5s). Override with --timeout-ms <ms>.
const timeoutMs = requireNumber(coerceGate(flags['--timeout-ms'], DEFAULT_TIMEOUT_MS), '--timeout-ms', flags['--timeout-ms']);
const maxErrorRate = requireNumber(coerceGate(flags['--max-error-rate'], DEFAULT_MAX_ERROR_RATE), '--max-error-rate', flags['--max-error-rate']);
const maxP95ms = requireNumber(coerceGate(flags['--max-p95-ms'], DEFAULT_MAX_P95_MS), '--max-p95-ms', flags['--max-p95-ms']);
const targetUrl = urlArg || `http://127.0.0.1:${port}/`;

const pkgPath = path.join(ROOT, project, 'package.json');
if (!urlArg && (!project || !fs.existsSync(pkgPath))) {
  console.error(`load-test: provide --url, or a valid --project ("${project || '(none)'}")`);
  process.exit(2);
}
if (!urlArg && !fs.existsSync(path.join(ROOT, project, 'dist'))) {
  console.error(`load-test: ${project}/dist missing — run "npm run build" first`);
  process.exit(2);
}

function killTree(child) {
  try {
    if (process.platform === 'win32') {
      spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore', shell: true });
    } else {
      try {
        process.kill(-child.pid, 'SIGTERM');
      } catch {
        child.kill('SIGTERM');
      }
      const t = setTimeout(() => {
        try {
          process.kill(-child.pid, 'SIGKILL');
        } catch {
          /* already gone */
        }
      }, 2000);
      t.unref();
    }
  } catch {
    /* best effort */
  }
}

function requestOnce(url, timeout) {
  return new Promise((resolve) => {
    const start = performance.now();
    const req = http.get(url, (res) => {
      res.resume();
      res.on('end', () => resolve({ ok: res.statusCode === 200, status: res.statusCode, latencyMs: performance.now() - start }));
    });
    req.on('error', () => resolve({ ok: false, status: 0, latencyMs: performance.now() - start, error: true }));
    req.setTimeout(timeout, () => {
      req.destroy();
      resolve({ ok: false, status: 0, latencyMs: performance.now() - start, error: true });
    });
  });
}

function waitForServer(url, deadline) {
  return new Promise((resolve, reject) => {
    const poll = async () => {
      if (Date.now() > deadline) return reject(new Error('preview server did not answer in time'));
      // Slow-laptop budget: 120s probe + 1s poll (were 2s/400ms).
      const r = await requestOnce(url, 120000);
      if (r.ok) return resolve();
      setTimeout(poll, 1000);
    };
    poll().catch(reject);
  });
}

function runWorkers(url, perWorker, workers, timeout) {
  const latencies = [];
  const statuses = new Map();
  let errors = 0;
  const worker = async () => {
    for (let i = 0; i < perWorker; i += 1) {
      const r = await requestOnce(url, timeout);
      latencies.push(r.latencyMs);
      if (!r.ok) errors += 1;
      statuses.set(r.status, (statuses.get(r.status) || 0) + 1);
    }
  };
  const started = performance.now();
  const all = Array.from({ length: workers }, () => worker());
  return Promise.all(all).then(() => ({ latencies, statuses, errors, seconds: (performance.now() - started) / 1000 }));
}

let child = null;
try {
  if (!urlArg) {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    const scripts = pkg.scripts || {};
    const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
    const cmdArgs =
      typeof scripts.preview === 'string'
        ? ['run', 'preview', '--', '--port', String(port), '--strictPort']
        : ['exec', 'vite', 'preview', '--', '--port', String(port), '--strictPort'];
    child = spawn([npmCmd, ...cmdArgs].join(' '), {
      cwd: path.join(ROOT, project),
      shell: true,
      stdio: 'ignore',
      detached: process.platform !== 'win32',
    });
    // Slow-laptop budget: 10 min server-start (was 60s).
    await waitForServer(targetUrl, Date.now() + 600000);
  }

  // Warmup (not measured)
  for (let i = 0; i < 10; i += 1) await requestOnce(targetUrl, timeoutMs);

  const perWorker = Math.ceil(totalRequests / concurrency);
  const { latencies, statuses, errors, seconds } = await runWorkers(targetUrl, perWorker, concurrency, timeoutMs);
  const measured = latencies.length; // observed, not the plan
  const sorted = [...latencies].sort((a, b) => a - b);
  const errorRate = errorRatePercent(errors, measured);
  const rps = measured / seconds;
  const p50 = percentile(sorted, 50);
  const p95 = percentile(sorted, 95);
  const p99 = percentile(sorted, 99);
  const statusLine = [...statuses.entries()].sort((a, b) => a[0] - b[0]).map(([s, n]) => `${s}:${n}`).join('  ');

  console.log(`load-test: ${measured} requests, ${concurrency} workers, ${seconds.toFixed(2)}s`);
  console.log(`  RPS            ${rps.toFixed(1)}`);
  console.log(`  latency p50    ${p50.toFixed(0)} ms`);
  console.log(`  latency p95    ${p95.toFixed(0)} ms  (gate <= ${maxP95ms} ms)`);
  console.log(`  latency p99    ${p99.toFixed(0)} ms`);
  console.log(`  errors         ${errors}/${measured} (${errorRate.toFixed(2)}%)  (gate <= ${maxErrorRate}%)`);
  console.log(`  statuses       ${statusLine}`);

  const { failed, reasons } = evaluateGates({ measured, errorRate, p95, maxErrorRate, maxP95ms });
  for (const reason of reasons) console.error(`load-test: FAIL - ${reason}`);
  if (!failed) console.log('load-test: PASS');
  process.exit(failed ? 1 : 0);
} catch (err) {
  console.error(`load-test: FAIL — ${err.message}`);
  process.exit(2);
} finally {
  if (child) killTree(child);
}

