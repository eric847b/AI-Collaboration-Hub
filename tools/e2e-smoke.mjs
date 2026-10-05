#!/usr/bin/env node
/**
 * e2e-smoke.mjs — serve a built Vite app with `vite preview` and smoke-test it.
 *
 *   node tools/e2e-smoke.mjs --project nexus-infinity-hub [--port 4173] [--timeout 600] [--marker '<div id="root"'] [--route / --route /dashboard ...]
 *
 * Passes when every probed route answers HTTP 200 (default route: "/"; repeat
 * --route to probe more paths — a dependency-free synthetic multi-route check).
 * Marker presence is reported but only warns (layout shells differ). Exit codes:
 * 0 pass · 1 smoke failure · 2 setup error.
 * Cross-platform: spawns npm via shell, kills the whole process tree (taskkill /T on Windows).
 */
import { spawn, spawnSync } from 'node:child_process';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);

// ── Non-interactive argv tokenizer (Round 12 D hardening) ──────────────
// Value flags: --project --port --timeout --marker --route (repeatable).
// Unknown flags and stray positionals exit 2 instead of being silently
// ignored. No stdin prompts, ever.
const VALUE_FLAGS = new Set(['--project', '--port', '--timeout', '--marker', '--route']);
const flags = {};
const positionals = [];
for (let i = 0; i < args.length; i += 1) {
  const a = args[i];
  if (a === '--help' || a === '-h') {
    flags['--help'] = true;
    continue;
  }
  if (a === '--self-test') {
    flags['--self-test'] = true;
    continue;
  }
  if (a.startsWith('-')) {
    const eq = a.indexOf('=');
    const key = eq >= 0 ? a.slice(0, eq) : a;
    if (!VALUE_FLAGS.has(key)) {
      console.error(`e2e-smoke: unknown flag "${key}" — see \`node tools/e2e-smoke.mjs --help\``);
      process.exit(2);
    }
    let value;
    if (eq >= 0) {
      value = a.slice(eq + 1);
    } else if (i + 1 < args.length) {
      value = args[i + 1];
      i += 1;
    } else {
      console.error(`e2e-smoke: flag "${key}" requires a value — see \`node tools/e2e-smoke.mjs --help\``);
      process.exit(2);
    }
    if (key === '--route') {
      if (!flags['--route']) flags['--route'] = [];
      flags['--route'].push(value);
    } else {
      flags[key] = value;
    }
    continue;
  }
  positionals.push(a);
}

// ---- Pure helpers (self-tested) ---------------------------------------------------
// `--port abc` / `--timeout abc` used to yield NaN. A NaN deadline makes
// `Date.now() > deadline` false forever, so the server-start budget silently
// stopped existing and the tool hung rather than failing fast.
function coercePort(raw) {
  if (raw === undefined) return 4173;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1 || n > 65535) return NaN;
  return n;
}

function coerceTimeoutSeconds(raw) {
  if (raw === undefined) return 600;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return NaN;
  return n;
}

function requireNumber(value, label, raw) {
  if (Number.isNaN(value)) {
    console.error(`e2e-smoke: ${label} must be a finite number (got ${JSON.stringify(raw)})`);
    process.exit(2);
  }
  return value;
}

/** Only 200 passes. 204/301/404/500 are all failures - pinned, because a widened
 *  comparison (`status < 400`, `status >= 200`) would green-light a broken route. */
function isRouteOk(status) {
  return status === 200;
}

/**
 * Route list defaults to ["/"]. An empty or blank route is a typo, not a request to
 * the site root, so it is dropped rather than silently becoming "/".
 */
function normalizeRoutes(provided) {
  const list = (provided || []).map((r) => String(r).trim()).filter((r) => r.length > 0);
  return list.length ? list : ['/'];
}

/**
 * The marker is INFORMATIONAL by design: it warns, it never fails a run. Pinning
 * that matters in both directions - making it fatal would red-herring CI on any app
 * whose root node markup differs.
 */
function evaluateRoutes(results) {
  // Zero results is a FAIL, not a vacuous pass: an empty array trivially has zero
  // failures, which would report green having probed nothing. normalizeRoutes makes
  // it unreachable today; this keeps it unreachable if that ever changes.
  if (!results.length) {
    return { failures: 0, warned: 0, passed: false, exitCode: 1, noResults: true };
  }
  const failures = results.filter((r) => !isRouteOk(r.status)).length;
  const warned = results.filter((r) => !r.hasMarker).length;
  return { failures, warned, passed: failures === 0, exitCode: failures === 0 ? 0 : 1, noResults: false };
}

function usage() {
  console.log(
    [
      'e2e-smoke.mjs — serve a built Vite app and assert HTTP 200 per route (non-interactive)',
      '',
      'Usage: node tools/e2e-smoke.mjs --project <app> [--port <n>] [--timeout <seconds>] [--marker <text>] [--route <path> ...]',
      '',
      'Flags:',
      '  --project <app>      project folder with a built dist/ (required)',
      '  --port <n>           preview server port (default 4173)',
      '  --timeout <seconds>  server-start budget (default 600)',
      '  --marker <text>      substring expected in the response body (warn-only)',
      '  --route <path>       probe an extra route (repeatable; default "/")',
      '  --self-test         prove the 200-only rule and NaN rejection bite (no server)    [no server]',
      '  --help               print this text and exit 0',
      '',
      'Exit codes: 0 = pass, 1 = smoke failure, 2 = setup/bad usage.',
      'Unknown flags and unexpected arguments exit 2.',
    ].join('\n'),
  );
}

function runSelfTest() {
  const failures = [];
  let ran = 0;
  const check = (name, cond) => { ran += 1; if (!cond) failures.push(name); };

  // Only 200 passes. A widened comparison would green-light a broken route.
  check('200 passes', isRouteOk(200) === true);
  check('404 fails', isRouteOk(404) === false);
  check('500 fails', isRouteOk(500) === false);
  check('301 fails (a redirect is not a served route)', isRouteOk(301) === false);
  check('204 fails', isRouteOk(204) === false);
  check('0 fails (a transport failure)', isRouteOk(0) === false);
  check('undefined status fails', isRouteOk(undefined) === false);

  // NaN port/timeout must be rejected: a NaN deadline never expires.
  check('port defaults to 4173', coercePort(undefined) === 4173);
  check('a valid port parses', coercePort('8080') === 8080);
  check('a NaN port is rejected', Number.isNaN(coercePort('abc')));
  check('port 0 is rejected', Number.isNaN(coercePort('0')));
  check('port 70000 is rejected', Number.isNaN(coercePort('70000')));
  check('a fractional port is rejected', Number.isNaN(coercePort('80.5')));
  check('timeout defaults to 600s', coerceTimeoutSeconds(undefined) === 600);
  check('a valid timeout parses', coerceTimeoutSeconds('30') === 30);
  check('a NaN timeout is rejected', Number.isNaN(coerceTimeoutSeconds('abc')));
  check('a zero timeout is rejected', Number.isNaN(coerceTimeoutSeconds('0')));
  check('a negative timeout is rejected', Number.isNaN(coerceTimeoutSeconds('-1')));

  // Route normalization.
  check('no routes means the site root', JSON.stringify(normalizeRoutes(undefined)) === '["/"]');
  check('an empty list means the site root', JSON.stringify(normalizeRoutes([])) === '["/"]');
  check('a blank route is dropped', JSON.stringify(normalizeRoutes([''])) === '["/"]');
  check('a whitespace route is dropped', JSON.stringify(normalizeRoutes(['   '])) === '["/"]');
  check('explicit routes are kept in order', JSON.stringify(normalizeRoutes(['/a', '/b'])) === '["/a","/b"]');
  check('routes are trimmed', JSON.stringify(normalizeRoutes([' /a '])) === '["/a"]');

  // Verdicts.
  check('all-200 passes', evaluateRoutes([{ status: 200, hasMarker: true }]).passed === true);
  check('all-200 exits 0', evaluateRoutes([{ status: 200, hasMarker: true }]).exitCode === 0);
  check('one 404 fails', evaluateRoutes([{ status: 200, hasMarker: true }, { status: 404, hasMarker: false }]).passed === false);
  check('one 404 exits 1', evaluateRoutes([{ status: 200, hasMarker: true }, { status: 404, hasMarker: false }]).exitCode === 1);
  check('the failure is counted', evaluateRoutes([{ status: 200, hasMarker: true }, { status: 404, hasMarker: false }]).failures === 1);
  check('an all-404 run fails', evaluateRoutes([{ status: 404, hasMarker: false }]).passed === false);
  check('no results at all does NOT pass (a vacuous green is a false green)', evaluateRoutes([]).passed === false);

  // The marker is informational: a missing marker warns, it never fails.
  const noMarker = evaluateRoutes([{ status: 200, hasMarker: false }]);
  check('a missing marker still passes', noMarker.passed === true);
  check('a missing marker is counted as a warning', noMarker.warned === 1);

  if (failures.length) {
    console.error(`e2e-smoke self-test FAIL: ${failures.length} problem(s):`);
    for (const f of failures) console.error(`  FAIL  ${f}`);
    process.exit(1);
  }
  console.log(`e2e-smoke self-test: ${ran}/${ran} passed`);
}

if (flags['--help']) {
  usage();
  process.exit(0);
}
if (flags['--self-test']) {
  runSelfTest();
  process.exit(0);
}
if (positionals.length) {
  console.error(`e2e-smoke: unexpected argument "${positionals[0]}" — flags only (see \`node tools/e2e-smoke.mjs --help\`)`);
  process.exit(2);
}

const project = flags['--project'] || '';
const pkgPath = path.join(ROOT, project, 'package.json');
if (!project || !fs.existsSync(pkgPath)) {
  console.error(`e2e-smoke: unknown project "${project || '(none)'}"`);
  process.exit(2);
}
if (!fs.existsSync(path.join(ROOT, project, 'dist'))) {
  console.error(`e2e-smoke: ${project}/dist missing — run "npm run build" first`);
  process.exit(2);
}

const port = requireNumber(coercePort(flags['--port']), '--port', flags['--port']);
// Slow-laptop default: 10 min server-start budget (was 60s). Override with --timeout <seconds>.
const timeoutMs = requireNumber(coerceTimeoutSeconds(flags['--timeout']), '--timeout', flags['--timeout']) * 1000;
const marker = flags['--marker'] ?? '<div id="root"';

// Repeatable --route <path> probes (synthetic multi-route checks). Default: "/".
const routes = normalizeRoutes(flags['--route']);

function killTree(child) {
  try {
    if (process.platform === 'win32') {
      // Synchronous: process.exit() runs right after, which would otherwise
      // kill an in-flight async taskkill and orphan the preview tree (whose
      // inherited stdio pipes then wedge the calling console).
      spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
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

function fetchOnce(url) {
  return new Promise((resolve, reject) => {
    const req = http.get(url, (res) => {
      let body = '';
      res.on('data', (chunk) => {
        if (body.length < 65536) body += chunk;
      });
      res.on('end', () => resolve({ status: res.statusCode, body }));
    });
    req.on('error', reject);
    // Slow-laptop budget: 120s per probe + 1s poll (were 30s/500ms).
    req.setTimeout(120000, () => req.destroy(new Error('request timeout')));
  });
}

async function waitForServer(deadline) {
  const url = `http://127.0.0.1:${port}/`;
  for (;;) {
    if (Date.now() > deadline) {
      throw new Error(`preview server did not answer within ${Math.round(timeoutMs / 1000)}s`);
    }
    try {
      return await fetchOnce(url);
    } catch {
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
}

const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
const scripts = pkg.scripts || {};
const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const cmdArgs =
  typeof scripts.preview === 'string'
    ? ['run', 'preview', '--', '--port', String(port), '--strictPort']
    : ['exec', 'vite', 'preview', '--', '--port', String(port), '--strictPort'];

const child = spawn([npmCmd, ...cmdArgs].join(' '), {
  cwd: path.join(ROOT, project),
  shell: true,
  stdio: ['ignore', 'pipe', 'pipe'],
  detached: process.platform !== 'win32',
});
let previewTail = '';
child.stdout.on('data', (d) => {
  previewTail = (previewTail + d).slice(-2000);
});
child.stderr.on('data', (d) => {
  previewTail = (previewTail + d).slice(-2000);
});

const deadline = Date.now() + timeoutMs;
let exitCode = 1;
try {
  await waitForServer(deadline);
  const results = [];
  for (const route of routes) {
    try {
      const res = await fetchOnce(`http://127.0.0.1:${port}${route}`);
      const hasMarker = res.body.includes(marker);
      const ok = isRouteOk(res.status);
      console.log(`e2e-smoke: ${project} GET ${route} -> HTTP ${res.status} (${res.body.length}B, marker=${hasMarker ? 'found' : 'missing'})${ok ? '' : ' FAIL'}`);
      if (!hasMarker && route === routes[0]) {
        console.warn(`e2e-smoke: warning — marker "${marker}" not present in response (informational)`);
      }
      results.push({ status: res.status, hasMarker });
    } catch (err) {
      console.error(`e2e-smoke: ${project} GET ${route} -> FAIL ${err.message}`);
      results.push({ status: 0, hasMarker: false });
    }
  }
  const verdict = evaluateRoutes(results);
  if (verdict.passed) {
    exitCode = 0;
  } else {
    console.error(`e2e-smoke: FAIL — ${verdict.failures} of ${results.length} routes answered non-200`);
  }
} catch (err) {
  console.error(`e2e-smoke: FAIL — ${err.message}`);
  if (previewTail.trim()) console.error(`--- preview output (tail) ---\n${previewTail.trim()}`);
} finally {
  killTree(child);
}
process.exit(exitCode);
