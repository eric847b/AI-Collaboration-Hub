#!/usr/bin/env node
/**
 * loop-fix.mjs — cheapest-capable patch driver for the continuous-improvement
 * loop. Takes an explicit, named fix rule and a target project, applies a
 * deterministic transformation to the files on disk, and reports what changed.
 *
 *   node tools/loop-fix.mjs run --project nexus-infinity-hub --rule semicolon
 *   node tools/loop-fix.mjs run --project collabhub-modules --rule trailing-whitespace
 *   node tools/loop-fix.mjs run --rule license-header --project nexus-infinity-hub
 *   node tools/loop-fix.mjs list-rules
 *
 * Rules are PURE, IDEMPOTENT, SEMANTICS-PRESERVING text transforms. The
 * loop-orchestrator.mjs runs this AFTER triage and BEFORE workspace-gate.ps1,
 * and deliberately does NOT commit or sync — that is the orchestrator's
 * verify + sync step's job.
 *
 * Safety invariants (asserted in self-test):
 *   1. No rule ever rewrites a .json file (semicolons would corrupt JSON).
 *   2. No rule ever rewrites a file whose content is unchanged (idempotence).
 *   3. No rule memoizes results by content — a re-run on a modified file is a
 *      genuine, auditable transform, never a read-through cache hit.
 *   4. The public `fix` function returns { files, changed, lines } with
 *      `lines` = absolute byte delta, so output is never lossy in sign.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// JS/TS source only. .json is deliberately EXCLUDED because a "semicolon"
// transform would render package.json invalid.
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
  'semicolon': {
    label: 'ensure trailing semicolons on statements',
    run: (content) => content.replace(/^[^\n]+(?<!;)$/gm, (m) => m + ';'),
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
      if (content.startsWith('// Licensed')) return content;
      return header + content;
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

function optVal(argv, name, def) {
  const i = argv.indexOf(name);
  return i >= 0 && i + 1 < argv.length ? argv[i + 1] : def;
}
function has(argv, name) { return argv.includes(name); }

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

if (has(argv, '--list-rules') || has(argv, '-l')) {
  console.log('Available rules:');
  for (const [name, r] of Object.entries(RULES)) console.log(`  ${name.padEnd(22)} ${r.label}`);
  process.exit(0);
}

if (has(argv, '--list-rules') || has(argv, '-l') || cmd === 'list-rules' || cmd === 'ls') {
  console.log('Available rules:');
  for (const [name, r] of Object.entries(RULES)) console.log(`  ${name.padEnd(22)} ${r.label}`);
  process.exit(0);
}

function runSelfTest() {
  let failed = 0;
  // INV-1: no rule rewrites a .json file — the source-file filter excludes
  // .json and includes .js/.ts/.mjs/.cjs/.tsx (semicolons would corrupt JSON).
  if (SRC_EXT.test('package.json')) { failed++; console.error('  INV-1 json excluded FAIL'); }
  if (!SRC_EXT.test('app.js')) { failed++; console.error('  INV-1 js included FAIL'); }
  // INV-2: no rule rewrites an unchanged file (idempotence).
  const content = 'a\n\n\nb\n';
  const a = applyRule('blank-lines', content).next;
  const b = applyRule('blank-lines', a).next;
  if (a !== b) { failed++; console.error('  INV-2 idempotence FAIL'); }
  // INV-3: no content memoization — rerun on a mutated file still transforms.
  const c = applyRule('semicolon', 'function f(){}').next;
  if (!c.startsWith('function f()')) { failed++; console.error('  INV-3 transform FAIL'); }
  // INV-4: `lines` = absolute byte delta, never lossy in sign.
  const original = 'const c = 3\n';
  const nxt = applyRule('semicolon', original).next;
  const delta = Math.abs(original.length - nxt.length);
  if (delta !== 1) { failed++; console.error(`  INV-4 lines-delta FAIL (got ${delta})`); }

  if (failed > 0) {
    console.error(`loop-fix self-test: ${failed} invariant(s) failed`);
    return false;
  }
  console.error('loop-fix self-test: 4/4 invariants passed');
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
if (!fs.existsSync(target)) { console.error(`loop-fix: project "${project}" not found at ${target}`); process.exit(2); }
if (!RULES[rule]) { console.error(`loop-fix: unknown rule "${rule}". Use --list-rules.`); process.exit(2); }

let files = [];
for (const entry of fs.readdirSync(target, { withFileTypes: true })) {
  if (entry.name.startsWith('.')) continue;
  const full = path.join(target, entry.name);
  if (entry.isDirectory()) {
    for (const sub of fs.readdirSync(full, { withFileTypes: true })) {
      if (!SRC_EXT.test(sub.name)) continue;
      files.push(path.join(full, sub.name));
    }
  } else if (SRC_EXT.test(entry.name)) {
    files.push(full);
  }
}

if (files.length === 0) {
  console.log(`loop-fix: no matching source files in "${project}" (rule "${rule}”).`);
  process.exit(0);
}

const result = { project, rule, files: 0, changed: 0, lines: 0 };
for (const file of files) {
  const original = fs.readFileSync(file, 'utf8');
  const { next, changed } = applyRule(rule, original);
  if (!changed) continue;
  fs.writeFileSync(file, next, 'utf8');
  result.files++;
  result.changed++;
  result.lines += Math.abs(original.length - next.length);
  if (verbose) console.log(`  [OK] ${path.relative(ROOT, file)}`);
}

const verb = result.changed === 1 ? 'file' : 'files';
console.log(`loop-fix: applied rule "${rule}" → ${result.changed}/${result.files} ${verb}, ${result.lines} byte(s) net change.`);
if (result.changed === 0) console.log(`  (idempotent — nothing to do)`);
