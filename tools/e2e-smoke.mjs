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
      '  --help               print this text and exit 0',
      '',
      'Exit codes: 0 = pass, 1 = smoke failure, 2 = setup/bad usage.',
      'Unknown flags and unexpected arguments exit 2.',
    ].join('\n'),
  );
}

if (flags['--help']) {
  usage();
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

const port = Number(flags['--port'] ?? '4173');
// Slow-laptop default: 10 min server-start budget (was 60s). Override with --timeout <seconds>.
const timeoutMs = Number(flags['--timeout'] ?? '600') * 1000;
const marker = flags['--marker'] ?? '<div id="root"';

// Repeatable --route <path> probes (synthetic multi-route checks). Default: "/".
const routes = flags['--route'] ? [...flags['--route']] : [];
if (!routes.length) routes.push('/');

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
  let failures = 0;
  for (const route of routes) {
    try {
      const res = await fetchOnce(`http://127.0.0.1:${port}${route}`);
      const hasMarker = res.body.includes(marker);
      const ok = res.status === 200;
      console.log(`e2e-smoke: ${project} GET ${route} -> HTTP ${res.status} (${res.body.length}B, marker=${hasMarker ? 'found' : 'missing'})${ok ? '' : ' FAIL'}`);
      if (!ok) failures++;
      if (!hasMarker && route === routes[0]) {
        console.warn(`e2e-smoke: warning — marker "${marker}" not present in response (informational)`);
      }
    } catch (err) {
      console.error(`e2e-smoke: ${project} GET ${route} -> FAIL ${err.message}`);
      failures++;
    }
  }
  if (failures === 0) {
    exitCode = 0;
  } else {
    console.error(`e2e-smoke: FAIL — ${failures} of ${routes.length} routes answered non-200`);
  }
} catch (err) {
  console.error(`e2e-smoke: FAIL — ${err.message}`);
  if (previewTail.trim()) console.error(`--- preview output (tail) ---\n${previewTail.trim()}`);
} finally {
  killTree(child);
}
process.exit(exitCode);
