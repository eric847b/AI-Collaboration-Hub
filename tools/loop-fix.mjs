#!/usr/bin/env node
/**
 * loop-fix.mjs — cheapest-capable patch driver for the continuous-improvement
 * loop. Takes an explicit, named fix rule and a target project, applies a
 * deterministic transformation to the files on disk, and reports what changed.
 *
 *   node tools/loop-fix.mjs run --project nexus-infinity-hub --rule license-header
 *   node tools/loop-fix.mjs run --project collabhub-modules --rule trailing-whitespace
 *   node tools/loop-fix.mjs run --rule license-header --project nexus-infinity-hub
 *   node tools/loop-fix.mjs list-rules
 *
 * Rules are PURE, IDEMPOTENT, SEMANTICS-PRESERVING text transforms. The
 * loop-orchestrator.mjs runs this as a --self-test health-check step (no
 * auto-mutation rule is configured). It deliberately does NOT commit or
 * sync — that is the orchestrator's verify + sync step's job.
 *
 * Safety invariants (asserted in self-test):
 *   1. No rule ever rewrites a .json file (text transforms would corrupt JSON).
 *   2. No rule ever rewrites a file whose content is unchanged (idempotence).
 *   3. No rule memoizes results by content — a re-run on a modified file is a
 *      genuine, auditable transform, never a read-through cache hit.
 *   4. The CLI reports { files, changed, lines } with `lines` = absolute
 *      byte delta, so output is never lossy in sign. `applyRule` is the
 *      pure public entry point and returns { next, changed }.
 *   5. license-header is idempotent on shebang files: the header is inserted
 *      after the shebang line and a second run changes nothing (B4).
 *   6. Project targets must resolve inside the workspace root, and
 *      symlinked entries are never collected for rewriting (B2).
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// JS/TS source only. .json is deliberately EXCLUDED because text
// transforms would render package.json invalid.
const SRC_EXT = /\.(js|mjs|cjs|ts|tsx)$/;

const RULES = {
  'trailing-whitespace': {
    label: 'strip trailing whitespace',
    run: (content) => content.replace(/[ \t]+$/gm, ''),
  },
  'blank-lines': {
    label: 'collapse multiple blank lines to one',
    run: (content) => content.replace(/\n{3,}/g, '\n\n'),
  },
  'license-header': {
    label: 'add Apache-2.0 header to .js/.mjs/.cjs/.ts/.tsx files',
    run: (content) => {
      const header = (
        '// Licensed under the Apache License, Version 2.0 (the "License");\n' +
        '// you may not use this file except in compliance with the License.\n' +
        '// Unless required by applicable law or agreed to in writing, software\n' +
        '// distributed under the License is distributed on an "AS IS" BASIS,\n' +
        '// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.\n' +
        '// See the License for the specific language governing permissions and\n' +
        '// limitations under the License.\n'
      );
      // A leading BOM is preserved verbatim and the header goes after it
      // (and after any shebang) — otherwise the BOM+shebang is broken (N1).
      // The already-headed check must look past the shebang: checking
      // only the file start made a second run insert a duplicate header
      // (B4 — the rule was not idempotent on shebang files).
      let prefix = '';
      let body = content;
      if (body.startsWith('\uFEFF')) {
        prefix = '\uFEFF';
        body = body.slice(1);
      }
      if (body.startsWith('#!')) {
        const nl = body.indexOf('\n');
        if (nl === -1) return content; // shebang-only file: nothing safe to do
        prefix += body.slice(0, nl + 1);
        body = body.slice(nl + 1);
      }
      if (body.startsWith('// Licensed')) return content;
      return prefix + header + body;
    },
  },
};

/**
 * Apply one named rule to a single file. Pure — does not mutate until the
 * caller persists the result.
 */
export function applyRule(ruleName, content) {
  const rule = RULES[ruleName];
  if (!rule) throw new Error(`unknown rule "${ruleName}"`);
  const next = rule.run(content);
  return { next, changed: next !== content };
}

export function getRules() { return RULES; }

/**
 * True when `candidate` resolves to a directory strictly inside `root`
 * (both already resolved). Pure — the self-test pins it without touching
 * the filesystem. The root itself is NOT inside itself: `--project .`
 * must be rejected, or the rule would scan (and rewrite) the whole repo.
 */
export function isWithinRoot(root, candidate) {
  const rel = path.relative(root, candidate);
  return rel !== '' && !rel.startsWith('..') && !path.isAbsolute(rel);
}

/**
 * List the .js/.mjs/.cjs/.ts/.tsx files under `target` (one level deep).
 * Symlinked entries are skipped: a symlink inside the target could point
 * outside the workspace root, and following it would let a rule write
 * outside the project (B2).
 */
export function collectSourceFiles(target) {
  const files = [];
  for (const entry of fs.readdirSync(target, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue;
    if (entry.name === 'node_modules') continue;
    if (entry.isSymbolicLink()) continue;
    const full = path.join(target, entry.name);
    if (entry.isDirectory()) {
      for (const sub of fs.readdirSync(full, { withFileTypes: true })) {
        if (sub.name === 'node_modules') continue;
        if (sub.isSymbolicLink()) continue;
        if (!SRC_EXT.test(sub.name)) continue;
        files.push(path.join(full, sub.name));
      }
    } else if (SRC_EXT.test(entry.name)) {
      files.push(full);
    }
  }
  return files;
}

function optVal(argv, name, def) {
  const i = argv.indexOf(name);
  return i >= 0 && i + 1 < argv.length ? argv[i + 1] : def;
}
function has(argv, name) { return argv.includes(name); }

// B3: the CLI below runs ONLY when this file is the entry script.
// Importing it (e.g. `import { applyRule } from './loop-fix.mjs'`) used to
// run the top-level argument parsing and kill the importer with
// process.exit(2). The exported pure API stays usable from any harness.
const isMain = (() => {
  try {
    return fs.realpathSync(process.argv[1] || '') === fileURLToPath(import.meta.url);
  } catch { return false; }
})();

if (isMain) {
const argv = process.argv.slice(2);

// --help MUST be checked FIRST, before any other argument processing
if (has(argv, '--help')) {
  console.log('usage: node tools/loop-fix.mjs run --project <name> --rule <rule> [--verbose]');
  console.log('       node tools/loop-fix.mjs list-rules');
  console.log('');
  console.log('Rules:');
  for (const [name, r] of Object.entries(RULES)) console.log('  ' + name.padEnd(22) + r.label);
  console.log('');
  console.log('Apply a rule: node tools/loop-fix.mjs run --project <name> --rule <rule> [--verbose]');
  console.log('List rules:   node tools/loop-fix.mjs list-rules');
  process.exit(0);
}
const cmd = argv[0] || 'run';

if (has(argv, '--list-rules') || has(argv, '-l') || cmd === 'list-rules' || cmd === 'ls') {
  console.log('Available rules:');
  for (const [name, r] of Object.entries(RULES)) console.log(`  ${name.padEnd(22)} ${r.label}`);
  process.exit(0);
}

function runSelfTest() {
  let failed = 0;
  // INV-1: no rule rewrites a .json file — the source-file filter excludes
  // .json and includes .js/.ts/.mjs/.cjs/.tsx (text transforms would corrupt JSON).
  if (SRC_EXT.test('package.json')) { failed++; console.error('  INV-1 json excluded FAIL'); }
  if (!SRC_EXT.test('app.js')) { failed++; console.error('  INV-1 js included FAIL'); }
  // INV-2: no rule rewrites an unchanged file (idempotence).
  const content = 'a\n\n\nb\n';
  const a = applyRule('blank-lines', content).next;
  const b = applyRule('blank-lines', a).next;
  if (a !== b) { failed++; console.error('  INV-2 idempotence FAIL'); }
  // INV-3: no content memoization — rerun on a mutated file still transforms.
  const c = applyRule('trailing-whitespace', 'const x = 1;   \n').next;
  if (c !== 'const x = 1;\n') { failed++; console.error('  INV-3 transform FAIL'); }
  // INV-4: `lines` = absolute byte delta, never lossy in sign.
  const original = 'const c = 3;  \n';
  const nxt = applyRule('trailing-whitespace', original).next;
  const delta = Math.abs(original.length - nxt.length);
  if (delta !== 2) { failed++; console.error(`  INV-4 lines-delta FAIL (got ${delta})`); }
  // INV-5: license-header is idempotent on shebang files (B4): the header
  // lands after the shebang line, and a second run changes nothing.
  const shebang = '#!/usr/bin/env node\nconsole.log(1);\n';
  const h1 = applyRule('license-header', shebang).next;
  const h2 = applyRule('license-header', h1).next;
  if (h1 !== h2) { failed++; console.error('  INV-5 license-header shebang idempotence FAIL'); }
  if (!h1.startsWith('#!/usr/bin/env node\n// Licensed')) { failed++; console.error('  INV-5 license-header after shebang FAIL'); }
  const plain = 'console.log(1);\n';
  const p1 = applyRule('license-header', plain).next;
  if (applyRule('license-header', p1).next !== p1) { failed++; console.error('  INV-5 license-header plain idempotence FAIL'); }
  if (applyRule('license-header', '#!/usr/bin/env node').next !== '#!/usr/bin/env node') { failed++; console.error('  INV-5 license-header shebang-only FAIL'); }
  // N1: a leading BOM is preserved and the header goes after BOM+shebang.
  const bom = '\uFEFF#!/usr/bin/env node\nconsole.log(1);\n';
  const b1 = applyRule('license-header', bom).next;
  const b2 = applyRule('license-header', b1).next;
  if (b1 !== b2) { failed++; console.error('  INV-5 license-header BOM idempotence FAIL'); }
  if (!b1.startsWith('\uFEFF#!/usr/bin/env node\n// Licensed')) { failed++; console.error('  INV-5 license-header BOM placement FAIL'); }
  // INV-6: project targets stay inside the root, and symlinked entries are
  // never collected for rewriting (B2).
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'loop-fix-inv6-'));
  try {
    if (!isWithinRoot(tmp, path.join(tmp, 'proj'))) { failed++; console.error('  INV-6 isWithinRoot inside FAIL'); }
    if (isWithinRoot(tmp, tmp)) { failed++; console.error('  INV-6 isWithinRoot root-itself FAIL'); }
    if (isWithinRoot(tmp, path.join(tmp, '..', 'etc'))) { failed++; console.error('  INV-6 isWithinRoot dotdot FAIL'); }
    fs.writeFileSync(path.join(tmp, 'real.mjs'), 'const a = 1;\n');
    fs.symlinkSync(path.join(tmp, 'real.mjs'), path.join(tmp, 'link.mjs'));
    fs.mkdirSync(path.join(tmp, 'sub'));
    fs.writeFileSync(path.join(tmp, 'sub', 'inner.mjs'), 'const b = 2;\n');
    fs.symlinkSync(path.join(tmp, 'sub'), path.join(tmp, 'linkdir'));
    const found = collectSourceFiles(tmp).map((f) => path.basename(f)).sort();
    if (JSON.stringify(found) !== JSON.stringify(['inner.mjs', 'real.mjs'])) { failed++; console.error(`  INV-6 symlink skip FAIL (got ${found})`); }
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }

  if (failed > 0) {
    console.error(`loop-fix self-test: ${failed} invariant(s) failed`);
    return false;
  }
  console.error('loop-fix self-test: 6/6 invariants passed');
  return true;
}

if (has(argv, '--self-test')) { process.exit(runSelfTest() ? 0 : 1); }
const project = optVal(argv, '--project', '');
const rule = optVal(argv, '--rule', '');
const verbose = has(argv, '--verbose');

if (!project || !rule) {
  console.error('usage: node tools/loop-fix.mjs run --project <name> --rule <rule> [--verbose]');
  console.error('       node tools/loop-fix.mjs list-rules');
  process.exit(2);
}

const target = path.join(ROOT, project);
// B2: the project must resolve to a directory strictly inside the root.
// `--project .` (rel === '') and any `..` escape are rejected, and a
// symlinked project dir must still resolve inside the root.
if (!isWithinRoot(ROOT, target)) { console.error(`loop-fix: project "${project}" must name a directory inside the workspace root`); process.exit(2); }
if (!fs.existsSync(target)) { console.error(`loop-fix: project "${project}" not found at ${target}`); process.exit(2); }
if (!isWithinRoot(fs.realpathSync(ROOT), fs.realpathSync(target))) { console.error(`loop-fix: project "${project}" resolves outside the workspace root`); process.exit(2); }
if (!RULES[rule]) { console.error(`loop-fix: unknown rule "${rule}". Use --list-rules.`); process.exit(2); }

const files = collectSourceFiles(target);

if (files.length === 0) {
  console.log(`loop-fix: no matching source files in "${project}" (rule "${rule}").`);
  process.exit(0);
}

const result = { project, rule, files: 0, changed: 0, lines: 0 };
for (const file of files) {
  result.files++;
  const original = fs.readFileSync(file, 'utf8');
  const { next, changed } = applyRule(rule, original);
  if (!changed) continue;
  fs.writeFileSync(file, next, 'utf8');
  result.changed++;
  result.lines += Math.abs(original.length - next.length);
  if (verbose) console.log(`  [OK] ${path.relative(ROOT, file)}`);
}

const verb = result.changed === 1 ? 'file' : 'files';
console.log(`loop-fix: applied rule "${rule}" → ${result.changed}/${result.files} ${verb}, ${result.lines} byte(s) net change.`);
if (result.changed === 0) console.log(`  (idempotent — nothing to do)`);
} // end if (isMain) — B3: importing this module must not run the CLI
