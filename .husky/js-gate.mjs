// Pre-commit JS syntax gate — single process, zero dependencies.
// Replaces the per-file `node --check` spawn loop (~90 spawns stalled commits
// >30s here). CJS (.cjs/.js in a commonjs tree) is checked in-process via
// vm.Script; ESM (.mjs, or .js in a type:module tree) falls back to one
// goal-aware `node --check` spawn per file (rare). File list arrives on stdin,
// one path per line (space-safe).
import { readFileSync, existsSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { dirname, join, parse, sep } from 'node:path';
import vm from 'node:vm';
import { spawnSync } from 'node:child_process';

const files = [];
for await (const line of createInterface({ input: process.stdin })) {
  const t = line.trim();
  if (t) files.push(t);
}

const typeCache = new Map();
function isEsmJs(f) {
  const p = parse(f);
  if (p.ext === '.mjs') return true;
  if (p.ext !== '.js') return false;
  // Userscripts are classic scripts by definition (never ESM), regardless of
  // any nearby package.json "type": "module" (the suite manifest declares it
  // for package consumers, not for the userscripts themselves).
  if (f.endsWith('.user.js')) return false;
  let dir = dirname(f);
  while (true) {
    if (!typeCache.has(dir)) {
      const pkg = join(dir, 'package.json');
      typeCache.set(dir, existsSync(pkg) ? (JSON.parse(readFileSync(pkg, 'utf8')).type || 'commonjs') : null);
    }
    const type = typeCache.get(dir);
    if (type) return type === 'module';
    const parent = dirname(dir);
    if (parent === dir) return false;
    dir = parent;
  }
}

let fail = 0;
for (const f of files) {
  if (isEsmJs(f)) {
    const r = spawnSync(process.execPath, ['--check', f], { stdio: 'ignore' });
    if (r.status !== 0) {
      console.error(`[pre-commit] ESM syntax FAIL: ${f}`);
      fail = 1;
    }
    continue;
  }
  try {
    let src = readFileSync(f, 'utf8');
    if (src.charCodeAt(0) === 0xfeff) src = src.slice(1);
    new vm.Script(src, { filename: f });
  } catch (e) {
    const msg = e instanceof SyntaxError ? `${e.name}: ${e.message}` : String(e);
    console.error(`[pre-commit] syntax FAIL: ${f}\n  ${msg.split('\n')[0]}`);
    fail = 1;
  }
}
process.exit(fail);
