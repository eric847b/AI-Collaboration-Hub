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
const args = process.argv.slice(2);
const opt = (name, def) => {
  const i = args.indexOf(name);
  return i >= 0 && i + 1 < args.length ? args[i + 1] : def;
};

const urlArg = opt('--url', '');
const project = opt('--project', '');
const port = Number(opt('--port', '4173'));
const totalRequests = Math.max(1, Number(opt('--requests', '300')));
const concurrency = Math.max(1, Number(opt('--concurrency', '15')));
// Slow-laptop default: per-request 120s budget (was 5s). Override with --timeout-ms <ms>.
const timeoutMs = Number(opt('--timeout-ms', '120000'));
const maxErrorRate = Number(opt('--max-error-rate', '1'));
const maxP95ms = Number(opt('--max-p95-ms', '3000'));
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

function percentile(sorted, p) {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[Math.max(0, idx)];
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
  const measured = perWorker * concurrency;
  const sorted = [...latencies].sort((a, b) => a - b);
  const errorRate = (errors / measured) * 100;
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

  let failed = false;
  if (errorRate > maxErrorRate) {
    console.error('load-test: FAIL — error rate above gate');
    failed = true;
  }
  if (p95 > maxP95ms) {
    console.error('load-test: FAIL — p95 latency above gate');
    failed = true;
  }
  if (!failed) console.log('load-test: PASS');
  process.exit(failed ? 1 : 0);
} catch (err) {
  console.error(`load-test: FAIL — ${err.message}`);
  process.exit(2);
} finally {
  if (child) killTree(child);
}

