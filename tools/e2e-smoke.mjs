#!/usr/bin/env node
/**
 * e2e-smoke.mjs — serve a built Vite app with `vite preview` and smoke-test it.
 *
 *   node tools/e2e-smoke.mjs --project nexus-infinity-hub [--port 4173] [--timeout 60] [--marker '<div id="root"']
 *
 * Passes when the served root answers HTTP 200. Marker presence is reported but only
 * warns (layout shells differ). Exit codes: 0 pass · 1 smoke failure · 2 setup error.
 * Cross-platform: spawns npm via shell, kills the whole process tree (taskkill /T on Windows).
 */
import { spawn } from 'node:child_process';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const opt = (name, def) => {
  const i = args.indexOf(name);
  return i >= 0 && i + 1 < args.length ? args[i + 1] : def;
};

const project = opt('--project', '');
const pkgPath = path.join(ROOT, project, 'package.json');
if (!project || !fs.existsSync(pkgPath)) {
  console.error(`e2e-smoke: unknown project "${project || '(none)'}"`);
  process.exit(2);
}
if (!fs.existsSync(path.join(ROOT, project, 'dist'))) {
  console.error(`e2e-smoke: ${project}/dist missing — run "npm run build" first`);
  process.exit(2);
}

const port = Number(opt('--port', '4173'));
const timeoutMs = Number(opt('--timeout', '60')) * 1000;
const marker = opt('--marker', '<div id="root"');

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
    req.setTimeout(4000, () => req.destroy(new Error('request timeout')));
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
      await new Promise((r) => setTimeout(r, 500));
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
  const res = await waitForServer(deadline);
  const hasMarker = res.body.includes(marker);
  console.log(`e2e-smoke: ${project} GET / -> HTTP ${res.status} (${res.body.length}B, marker=${hasMarker ? 'found' : 'missing'})`);
  if (res.status === 200) {
    exitCode = 0;
  } else {
    console.error(`e2e-smoke: FAIL — expected HTTP 200, got ${res.status}`);
  }
  if (!hasMarker) {
    console.warn(`e2e-smoke: warning — marker "${marker}" not present in response (informational)`);
  }
} catch (err) {
  console.error(`e2e-smoke: FAIL — ${err.message}`);
  if (previewTail.trim()) console.error(`--- preview output (tail) ---\n${previewTail.trim()}`);
} finally {
  killTree(child);
}
process.exit(exitCode);
