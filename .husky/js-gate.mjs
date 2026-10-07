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

// ---- Non-interactive argv tokenizer (Round 12 D hardening) ---------------------
// This tool takes NO flags: its input is a newline-separated file list on stdin.
// It previously ignored argv entirely, so `--help` exited 0 printing NOTHING
// and any typo'd flag was silently swallowed — the exact silent-ignore failure
// class the CLI contract exists to prevent, sitting in the pre-commit gate
// itself. Parsed BEFORE the stdin read so --help never blocks waiting on input.
const argv = process.argv.slice(2);

function usage() {
  console.log(
    [
      'js-gate.mjs - pre-commit JS syntax gate (single process, zero dependencies)',
      '',
      'Usage: printf \'%s\\n\' <files> | node .husky/js-gate.mjs',
      '',
      'Reads one file path per line from STDIN (space-safe) and syntax-checks each:',
      '  - classic scripts (.js/.cjs) in-process via vm.Script (BOM-tolerant;',
      '    `import` identifiers neutralized in *.user.js)',
      '  - ESM (.mjs, or .js in a type:module tree) via one `node --check` spawn',
      '',
      'Flags: none. Any argument is a usage error.',
      '  --help, -h   print this text and exit 0',
      '',
      'Exit codes: 0 = all files parsed, 1 = at least one syntax error.',
      'Unknown flags and unexpected arguments exit 2.',
    ].join('\n')
  );
}

for (const a of argv) {
  if (a === '--help' || a === '-h') {
    usage();
    process.exit(0);
  }
  if (a.startsWith('-')) {
    console.error(`[pre-commit] js-gate: unknown flag "${a}" - see \`node .husky/js-gate.mjs --help\``);
    process.exit(2);
  }
  console.error(`[pre-commit] js-gate: unexpected argument "${a}" - input arrives on STDIN, not argv (see --help)`);
  process.exit(2);
}

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
    // Userscripts may reference `import` as an identifier (e.g. `typeof import ===
    // 'function'`) or use dynamic import(). Neither executes in a classic userscript
    // context, but vm.Script treats `import` as a reserved word and throws. Neutralize
    // every standalone `import` identifier before the classic-script check.
    if (f.endsWith('.user.js')) {
      src = src.replace(/\bimport\b/g, '__import__');
    }
    new vm.Script(src, { filename: f });
  } catch (e) {
    // Node >= 20.19 resolves ambiguous .js files by MODULE-SYNTAX DETECTION,
    // so a valid ESM file living in a commonjs package (the eslint.config.js
    // flat-config style) fails the classic-script parse above while plain
    // "node --check" accepts it. Re-ask Node itself before failing: a file Node
    // accepts must never block a commit - this false-red stalled the merge that
    // carried third-door-blink-controller/eslint.config.js. Genuine syntax
    // errors fail BOTH checks and still block (userscripts keep the neutralized
    // path above, so they are excluded from the fallback).
    if (e instanceof SyntaxError && /\b(import|export)\b/.test(e.message) && !f.endsWith('.user.js')) {
      const fb = spawnSync(process.execPath, ['--check', f], { stdio: 'ignore' });
      if (fb.status === 0) continue;
    }
    const msg = e instanceof SyntaxError ? `${e.name}: ${e.message}` : String(e);
    console.error(`[pre-commit] syntax FAIL: ${f}\n  ${msg.split('\n')[0]}`);
    fail = 1;
  }
}
process.exit(fail);
