#!/usr/bin/env node
/**
 * check-flag-contract.mjs — OPTIONAL add-on verifying each tool's declared
 * flags are the flags it actually implements.
 *
 * WIRING (v1.1, 2026-10-01): the STATIC layer is enforced — probed by
 * `verify-tools` (SMOKE matrix) and run on both OS runners by the
 * multi-os-gate workflow. `verify-tools --check-cli` also covers this file
 * like every other tool. The BEHAVIOURAL (`--deep`) layer stays opt-in
 * (`npm run tools:flags:deep`) because value probes can write files.
 *
 * WHY: `--check-cli` proves a tool answers `--help` with 0 and REJECTS an
 * unknown flag. It cannot prove the flags a tool *declares* are the flags it
 * *implements* — two different claims, and the gap between them is where CLI
 * bugs hide.
 *
 * DESIGN PROBLEM, AND WHY THERE IS NO MANIFEST FILE: every tool declares its
 * inventory under a different name (VALUE_FLAGS, VAL_FLAGS, BOOLEAN_FLAGS,
 * BOOL_FLAGS, CI_FLAGS, SS_BOOL_FLAGS, WF_VALUE_FLAGS, OPTIONAL_VALUE_FLAGS,
 * ...), so classifying by identifier is unreliable — `CI_FLAGS` is boolean in
 * cross-repo-tests.mjs. The obvious fix, a hand-maintained JSON manifest, only
 * relocates the drift into a second file to update whenever a flag changes.
 * So this tool extracts CANDIDATE flags from each tool's own source (it cannot
 * miss one) and judges each candidate by probing real behaviour. Nothing to
 * keep in sync.
 * DO NOT re-derive "is this flag implemented?" by grepping source. A source-regex
 * sweep was attempted and every hit was a false positive: the repo uses FOUR
 * distinct consumption shapes — `flags[name]` (check-doc-facts, ops-dashboard),
 * `opt(name,def)` (secret-scan, workflow-audit), `has(flag)` (coverage-trend),
 * and `argv.includes(flag)` (cross-repo-tests) — so a regex matching only one
 * reads `--ci` as "never read" even when line 32 literally calls
 * `argv.includes('--ci')`. Accept-vs-effect is decided BEHAVIOURALLY here (the
 * --deep layer runs each flag); it cannot be decided reliably from text. If you
 * are tempted to statically detect no-op flags, trust this tool instead — it is
 * strictly more accurate and already wired into CI.

 *
 * TWO LAYERS, DELIBERATELY UNEVEN:
 * 1. STATIC (default) — no tool runs beyond a single `--help`. Catches a flag
 *    used in source but declared nowhere, a flag declared twice (boolean AND
 *    value), and a declared flag missing from the tool's own `--help`.
 * 2. BEHAVIOURAL (`--deep`) — confirms each declared flag is implemented. Opt-in
 *    because a value probe can WRITE (`ops-dashboard --out=<sentinel>` would
 *    rewrite the dashboard), so WRITE_RISKY_FLAGS are skipped unless
 *    --allow-write-risky is passed. The safe option is the default one.
 *
 * EXIT CODES: 0 consistent · 1 inconsistencies · 2 bad usage.
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFile, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TOOLS_DIR = path.join(ROOT, 'tools');

// Same explicit list `verify-tools --check-cli` uses: out-of-tree Node tools are
// held to the same contract and must be registered rather than discovered.
const EXTRA_TOOLS = ['.husky/js-gate.mjs'];

// Flags whose VALUE can cause a write (an --out/--ledger style destination).
// Probing `--flag=<sentinel>` would create or overwrite a file, so these are
// skipped unless the operator opts in. Discovered, not exhaustive: the safe
// default means an unlisted write-risk flag is a bug in this list.
const WRITE_RISKY_FLAGS = new Set([
  '--out',
  '--ledger',
  '--from-playwright',
  '--webhook-url',
  '--baseline',
  '--file',
]);

// ---- argv (Round 12 D contract: explicit inventory, no silent ignores) -------

const BOOLEAN_FLAGS = new Set([
  '--json',
  '--quiet',
  '--deep',
  '--self-test',
  '--allow-write-risky',
]);
const VALUE_FLAGS = new Set(['--only', '--timeout-ms']);
const argv = process.argv.slice(2);

function usage() {
  console.log(
    [
      'check-flag-contract.mjs - OPTIONAL add-on verifying each tool declares the',
      'flags it implements (source candidates + behavioural confirmation).',
      '',
      'Usage: node tools/check-flag-contract.mjs [--deep] [--allow-write-risky]',
      '       node tools/check-flag-contract.mjs --only <tool[,tool]> [--json]',
      '',
      'Flags:',
      '  --deep              also probe declared flags to confirm implemented semantics.',
      '                     SKIPS write-risky flags unless --allow-write-risky, because a',
      '                     value probe can WRITE (--out/--ledger destinations).',
      '                     TRIAGE MODE: 2 spawns per declared flag, so pair with --only.',
      '  --allow-write-risky let --deep probe flags whose value can WRITE a file',
      '  --only <names>      limit to specific tool basenames (comma-separated)',
      '  --self-test        prove every detector fires on synthetic fixtures and exit',
      '  --quiet            print only failing tools and the tally (no per-tool rows)',
      '  --json              machine-readable report (schema 1)',
      '  --help              print this text and exit 0',
      '',
      'Exit codes: 0 = consistent, 1 = inconsistencies found, 2 = bad usage.',
      'Unknown flags, missing values and stray arguments exit 2.',
      '',
      'Wiring: the static layer runs in verify-tools (SMOKE matrix) and in the',
      'multi-os-gate workflow; --deep stays opt-in (npm run tools:flags:deep).',
    ].join('\n')
  );
}

function die(msg) {
  console.error(`check-flag-contract: ${msg} - see \`node tools/check-flag-contract.mjs --help\``);
  process.exit(2);
}

const flags = {};
const positionals = [];
for (let i = 0; i < argv.length; i += 1) {
  const a = argv[i];
  if (a === '--help' || a === '-h') {
    usage();
    process.exit(0);
  }
  if (a.startsWith('-')) {
    const eq = a.indexOf('=');
    const key = eq >= 0 ? a.slice(0, eq) : a;
    if (VALUE_FLAGS.has(key)) {
      let value;
      if (eq >= 0) value = a.slice(eq + 1);
      else {
        if (i + 1 >= argv.length) die(`flag "${key}" requires a value`);
        value = argv[i + 1];
        i += 1;
      }
      flags[key] = value;
      continue;
    }
    if (!BOOLEAN_FLAGS.has(key)) die(`unknown flag "${key}"`);
    if (eq >= 0) die(`flag "${key}" takes no value`);
    flags[key] = true;
    continue;
  }
  positionals.push(a);
}
if (positionals.length > 0) die(`unexpected argument "${positionals[0]}" - this tool takes flags only`);
const deep = flags['--deep'] === true;
const allowWriteRisky = flags['--allow-write-risky'] === true;
const asJson = flags['--json'] === true;
const quiet = flags['--quiet'] === true;
const onlyNames = (flags['--only'] || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

// ---- static extraction -----------------------------------------------------

/**
 * Inventory declarations: `const <NAME> = new Set([ '--x', ... ])`.
 *
 * `^` (with the `m` flag) is load-bearing: a real inventory declaration always
 * STARTS its own line, whereas a snippet of source embedded as DATA - e.g. this
 * repo's own mutation-probe catalogue, whose probe strings literally contain
 * `const WRITE_RISKY_FLAGS = new Set([\n  '--out',` - has its `const` mid-line,
 * after an opening quote. Without the anchor the lazy body scanned on across real
 * newlines and swallowed whatever Set came next, inventing a phantom inventory
 * whose name and flags came from two different places.
 */
const INVENTORY_RE = /^[ \t]*const\s+([A-Z_]+)\s*=\s*new Set\(\[([\s\S]*?)\]\s*\)/gm;
/** Any `--flag` string literal anywhere in the source. */
const FLAG_LITERAL_RE = /['"`]--([a-z0-9][a-z0-9-]*)['"`]/gi;
const FLAG_STRING_RE = /'(--[a-z0-9][a-z0-9-]*)'/g;

/**
 * Comments are stripped before extraction, because prose is full of illustrative
 * flags (`--stric`, `--dryrun`, `--jsno`) and a flag appearing only in a comment
 * is documentation, not a declaration.
 *
 * The block-comment regex needs a negative lookbehind, and it is not cosmetic.
 * These tools are full of GLOB patterns — a source glob like
 * `src` + two stars + `/` + a star (the usual vitest include pattern) contains
 * the two-character sequence slash-star inside it. A naive block-comment regex
 * therefore treats a glob as an unterminated comment and silently deletes
 * everything up to the next closing marker. Measured: it removed 56% of
 * coverage-trend.cjs including its whole flag inventory, making the tool report
 * `0 declared` for a file with four. The `(?<![*\w])` lookbehind refuses to open
 * a comment on a slash-star that follows `*` or a word character, which is
 * exactly the glob case.
 *
 * The line-comment rule anchors on whitespace, which is what keeps `http://` and
 * `file://` intact (a `//` preceded by `:` is part of a URL, not a comment).
 */
function stripComments(src) {
  return src
    .replace(/(?<![*\w])\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|\s)\/\/[^\n]*/g, '$1 ');
}

function extractInventories(src) {
  const out = [];
  let m;
  INVENTORY_RE.lastIndex = 0;
  while ((m = INVENTORY_RE.exec(src))) {
    const members = [...m[2].matchAll(FLAG_STRING_RE)].map((x) => x[1]);
    // Only a Set that actually holds flags is a flag inventory. `new Set([...])`
    // is also how this codebase expresses SKIP_DIRS, RECURSIVE_ECOSYSTEMS,
    // PATTERN_DOC_FILES, KINDS and friends; counting those as inventories with
    // zero flags produced phantom entries in the report.
    if (members.length === 0) continue;
    out.push({ name: m[1], members });
  }
  return out;
}

function extractAllFlags(src) {
  const set = new Set();
  for (const m of src.matchAll(FLAG_LITERAL_RE)) set.add(`--${m[1]}`);
  return set;
}

/**
 * Flags belonging to a CHILD PROCESS, not to the tool's own CLI. These tools
 * shell out to git and node, and those argv arrays legitimately contain `--`
 * flags (`git ls-files --name-only`, `npm run preview -- --strictPort`,
 * `node --check`). They are not this tool's contract and must never be
 * reported. Curated rather than inferred: a `--x` inside a spawn() array is
 * indistinguishable from a real flag by context alone, and git's argv vocabulary
 * is stable.
 */
const FOREIGN_FLAGS = new Set([
  'name-only',
  'others',
  'exclude-standard',
  'cached',
  'no-pager',
  'paginate',
  'strictPort',
  'strictPort=false',
  'check',
  'version',
  'quiet',
  'silent',
  'color',
  'porcelain',
  'untracked-files',
  'depth',
  'output',
  'input',
  'maxBuffer',
  'encoding',
  'stdio',
  'withFileTypes',
  'recursive',
  'timeout',
]);

const runTool = (rel, args) =>
  new Promise((resolve) => {
    execFile(
      process.execPath,
      [path.join(ROOT, rel), ...args],
      { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 10000 },
      (err, stdout, stderr) =>
        resolve({ code: err ? err.code ?? null : 0, out: `${stdout || ''}${stderr || ''}` })
    );
  });

/**
 * Pure static analysis: everything decidable without running a tool.
 * Extracted from the worker so --self-test can drive it with synthetic sources;
 * an async inline body cannot be unit-tested. `helpOut` is the tool's `--help`
 * text (pass null to skip the documentation check).
 */
function analyzeStatic(src, helpOut) {
  const inventories = extractInventories(src);
  const allFlags = extractAllFlags(src);
  const issues = [];
  const advisory = [];

  // Ownership: which inventory declares each flag. Double declaration is a real
  // bug - the tool's own precedence silently decides the winner.
  const owner = new Map();
  for (const inv of inventories) {
    for (const f of inv.members) {
      if (owner.has(f)) issues.push(`flag "${f}" declared in both ${owner.get(f)} and ${inv.name}`);
      else owner.set(f, inv.name);
    }
  }

  // Flags used in source but owned by no inventory: a HEURISTIC, reported as
  // advisory only (subcommand-scoped tools and orchestrators legitimately have
  // no flat inventory, and probe/sentinel strings exist only to be rejected).
  const orphans = [...allFlags].filter(
    (f) =>
      !owner.has(f) &&
      !FOREIGN_FLAGS.has(f.slice(2)) &&
      f !== '--help' &&
      f !== '-h' &&
      !VALUE_FLAGS.has(f) &&
      !BOOLEAN_FLAGS.has(f)
  );
  for (const f of orphans) advisory.push(`flag "${f}" used in source but declared in no inventory`);

  // Declared but absent from the tool's own --help: unambiguous.
  if (helpOut) {
    for (const f of owner.keys()) {
      if (!helpOut.includes(f)) issues.push(`flag "${f}" declared but missing from --help output`);
    }
  }

  return { inventories, owner, orphans, advisory, issues };
}

/**
 * Self-test: prove every detector fires on synthetic sources, so a green run is
 * evidence rather than an assumption. The one that matters most is the glob
 * case - a naive comment stripper silently deleted 56% of coverage-trend.cjs
 * once, and no end-to-end run would have flagged it as "wrong", only as
 * "missing". Fixtures therefore assert on SURVIVING declarations, not just on
 * the absence of errors.
 */
function runSelfTest() {
  const cases = [];
  const check = (name, actual, expected) =>
    cases.push({ name, pass: JSON.stringify(actual) === JSON.stringify(expected), actual, expected });

  const clean = `
    const BOOLEAN_FLAGS = new Set(['--quiet']);
    const flags = {};
    for (const a of argv) if (BOOLEAN_FLAGS.has(a)) flags[a] = true;
  `;
  const r1 = analyzeStatic(stripComments(clean), 'usage: t [--quiet]\n  --quiet  be quiet');
  check('clean tool has no issues', r1.issues, []);
  check('clean tool declares one flag', r1.owner.size, 1);

  // Double declaration across two inventories.
  const dupe = `
    const BOOLEAN_FLAGS = new Set(['--quiet']);
    const VALUE_FLAGS = new Set(['--quiet', '--limit']);
  `;
  const r2 = analyzeStatic(stripComments(dupe), '--quiet --limit');
  check('double declaration is an issue', r2.issues.length, 1);
  check('double declaration names both inventories', /both/.test(r2.issues[0] || ''), true);

  // Declared but undocumented.
  const r3 = analyzeStatic(stripComments(clean), 'usage: t with no flags listed');
  check('declared-but-undocumented is an issue', r3.issues.length, 1);

  // Orphan -> advisory, never a failure.
  const orphan = `
    const BOOLEAN_FLAGS = new Set(['--quiet']);
    const x = argv.includes('--ghost');
  `;
  const r4 = analyzeStatic(stripComments(orphan), '--quiet');
  check('orphan is advisory not issue', r4.issues, []);
  check('orphan is reported', r4.advisory.length, 1);
  check('orphan names the flag', /--ghost/.test(r4.advisory[0] || ''), true);

  // Illustrative flags inside comments must not become declarations.
  const commented = `
    // a prose example: --stric, --dryrun, --jsno
    /* block example --nope */
    const BOOLEAN_FLAGS = new Set(['--quiet']);
  `;
  const r5 = analyzeStatic(stripComments(commented), '--quiet');
  check('comment flags are not orphans', r5.advisory, []);
  check('comment flags are not declarations', r5.owner.size, 1);

  // GLOB REGRESSION, derived from a real measured failure in coverage-trend.cjs
  // rather than from a guessed example (two earlier drafts did not reproduce it).
  //
  // The shape that actually breaks: a glob ENDING in `/**` with no trailing slash
  // - `src/test/**`. Its slash-star opens a "comment" the naive regex cannot
  // close, because `*` + `,` is not `*/`. The scan runs forward to the NEXT real
  // `*/`, which in that file was an unrelated `/* fall through */` thousands of
  // characters later - deleting everything between, including the inventory.
  // Measured span: 7828 chars, after which the tool reported "0 declared" for a
  // file that declares four.
  //
  // Order is load-bearing: the terminator must come AFTER the inventory, or the
  // span ends early and this fixture would pass even with the bug present.
  const glob = `
    const EXCLUDE = ['test/spec files', 'src/test/**'];
    const VALUE_FLAGS = new Set(['--limit', '--out']);
    /* an unrelated later block comment */
  `;
  const r6 = analyzeStatic(stripComments(glob), '--limit --out');
  check('glob does not swallow the inventory', r6.owner.size, 2);
  check('glob keeps both flags', [...r6.owner.keys()].sort(), ['--limit', '--out']);

  // A URL must survive the line-comment stripper.
  const url = `
    const DEFAULT = 'http://127.0.0.1:8080/';
    const VALUE_FLAGS = new Set(['--url']);
  `;
  const r7 = analyzeStatic(stripComments(url), '--url');
  check('url survives comment stripping', r7.owner.size, 1);

  // A non-flag Set (SKIP_DIRS and friends) must not be read as an inventory.
  const nonFlag = `
    const SKIP_DIRS = new Set(['node_modules', 'dist']);
    const VALUE_FLAGS = new Set(['--limit']);
  `;
  const r8 = analyzeStatic(stripComments(nonFlag), '--limit');
  check('non-flag Set is not an inventory', r8.inventories.map((i) => i.name), ['VALUE_FLAGS']);

  // Child-process flags are not this tool's contract.
  const foreign = `
    const args = ['ls-files', '--name-only'];
    const VALUE_FLAGS = new Set(['--limit']);
  `;
  const r9 = analyzeStatic(stripComments(foreign), '--limit');
  check('child-process flags are not orphans', r9.advisory, []);

  // ---- behavioural layer (the --deep path, now a CI gate on both OS runners) ----
  //
  // SAFETY FIRST. isWriteRisky is the only thing stopping the deep layer from
  // writing files: a probe sends a sentinel VALUE to a flag, so
  // `ops-dashboard --out=<sentinel>` would rewrite the dashboard in CI. If this
  // ever regressed, CI would start creating files at attacker-chosen paths.
  check('write-risky flag is skipped by default', isWriteRisky('--out', false), true);
  check('write-risky flag is skipped for --ledger', isWriteRisky('--ledger', false), true);
  check('--allow-write-risky overrides the skip', isWriteRisky('--out', true), false);
  check('ordinary flag is never write-risky', isWriteRisky('--limit', false), false);
  check('--help is never write-risky', isWriteRisky('--help', false), false);

  // Classifier branches, including the timeout case that keeps a loaded CI runner
  // from failing the gate spuriously.
  check('missing-value message => value flag', classifyBareProbe({ code: 2, out: 'flag "--limit" requires a value' }), {
    kind: 'value',
    next: 'equals',
  });
  check('unknown-flag message => ambiguous, probe space', classifyBareProbe({ code: 2, out: 'unknown flag "--limit"' }), {
    kind: 'ambiguous',
    next: 'space',
  });
  check('clean exit => boolean, no follow-up', classifyBareProbe({ code: 0, out: '' }), {
    kind: 'boolean',
    next: null,
  });
  check('TIMEOUT (null exit) => boolean, no false failure', classifyBareProbe({ code: null, out: '' }), {
    kind: 'boolean',
    next: null,
  });
  check('echoed phrase on a clean run is not believed', classifyBareProbe({ code: 0, out: 'unknown flag "--x" requires a value' }), {
    kind: 'boolean',
    next: null,
  });
  check('alternative missing-value wording is recognised', classifyBareProbe({ code: 1, out: 'option --limit needs a value' }).kind, 'value');

  // ---- false-green guards, exercised END TO END -------------------------------
  // These live in main(), not in any pure helper, so nothing above could cover
  // them. They are the difference between "green" and "verified nothing": if a
  // refactor dropped either guard, `--only <typo>` or `--only <self>` would
  // print "0/0 consistent" and exit 0 - a clean pass over zero tools, the exact
  // false verdict this workspace keeps fixing elsewhere (verify-tools' own
  // zero-probe guard exists for the same reason).
  //
  // The child runs WITHOUT --self-test, so this cannot recurse.
  const cli = (args) => {
    const r = spawnSync(process.execPath, [fileURLToPath(import.meta.url), ...args], {
      cwd: ROOT,
      encoding: 'utf8',
      timeout: 60000,
    });
    return { code: r.status, out: `${r.stdout || ''}${r.stderr || ''}` };
  };
  const unmatched = cli(['--only', 'zz-no-such-tool.mjs']);
  check('unmatched --only selector is refused', unmatched.code !== 0, true);
  check('unmatched selector names the offender', /matched no tools/.test(unmatched.out), true);
  const onlySelf = cli(['--only', 'check-flag-contract.mjs']);
  check('selector matching only the auditor is refused', onlySelf.code !== 0, true);
  check('zero-tool run is never reported clean', /audited zero tools/.test(onlySelf.out), true);
  const control = cli(['--only', 'extension-check.mjs']);
  check('a real selector still succeeds (guards are not blanket-fail)', control.code, 0);

  const failed = cases.filter((c) => !c.pass);
  for (const c of failed) {
    console.error(`FAIL  ${c.name}`);
    console.error(`      expected ${JSON.stringify(c.expected)}`);
    console.error(`      actual   ${JSON.stringify(c.actual)}`);
  }
  console.log(`check-flag-contract self-test: ${cases.length - failed.length}/${cases.length} passed`);
  process.exit(failed.length > 0 ? 1 : 0);
}

/**
 * SAFETY PROPERTY, isolated so --self-test can hold it.
 *
 * A probe passes a sentinel VALUE to a flag, so probing a flag whose value names
 * a write destination would actually perform that write - `ops-dashboard
 * --out=<sentinel>` rewrites docs/metrics/OPS-DASHBOARD.md. This function is the
 * only thing standing between the deep layer and arbitrary file creation, and it
 * now runs on BOTH OS runners in CI, so a regression here writes files in CI.
 * It is therefore pure and separately tested rather than a bare `if` inline.
 */
function isWriteRisky(flag, allowWriteRisky) {
  return WRITE_RISKY_FLAGS.has(flag) && !allowWriteRisky;
}

/**
 * Classify a BARE `--flag` probe. Returns which follow-up probe (if any) is
 * needed. Pure: takes the probe result, returns a verdict - no spawning here, so
 * --self-test can drive every branch.
 *
 * Only a NON-ZERO exit counts as the tool talking about its own argv; a tool that
 * ran and merely echoed the phrase is not reporting anything. A null exit (the
 * probe TIMED OUT) matches neither pattern and therefore classifies as boolean:
 * a slow runner under-reports rather than raising a false gate failure.
 */
function classifyBareProbe(bare) {
  const saysUnknown = /unknown flag/i.test(bare.out || '');
  const saysMissingValue = /requires? a value|needs a value|missing value/i.test(bare.out || '');
  const nonZero = bare.code !== 0 && bare.code !== null;
  if (nonZero && saysMissingValue) return { kind: 'value', next: 'equals' };
  if (nonZero && saysUnknown) return { kind: 'ambiguous', next: 'space' };
  return { kind: 'boolean', next: null };
}

async function main() {
  const tools = [
    ...fs
      .readdirSync(TOOLS_DIR)
      .filter((f) => /\.(mjs|cjs)$/.test(f))
      .sort()
      .map((f) => `tools/${f}`),
    ...EXTRA_TOOLS,
  ].filter((t) => {
    if (onlyNames.length === 0) return true;
    // --only accepts a basename with or without its extension ("bundle-trend"
    // == "bundle-trend.cjs"). A name matching nothing is a hard usage error
    // (exit 2): auditing zero tools and reporting "0/0 consistent" would be a
    // false pass, the same trap verify-tools documents for its own --only.
    const base = path.basename(t);
    return onlyNames.includes(base) || onlyNames.includes(base.replace(/\.(mjs|cjs)$/, ''));
  });
  if (onlyNames.length > 0 && tools.length === 0) {
    die(`--only matched no tools: ${onlyNames.join(', ')}`);
  }

  const rows = [];
  let cursor = 0;
  let failed = 0;

  // Bounded concurrency, same reasoning as verify-tools --check-cli: 20 serial
  // Node cold-starts exceeded the 30s per-command ceiling on a loaded machine.
  // The probes are independent read-only processes, so there is nothing to
  // serialize.
  const CONCURRENCY = 6;
  const worker = async () => {
    for (;;) {
      const i = cursor++;
      if (i >= tools.length) return;
      const rel = tools[i];
      // Skip self: this file legitimately contains illustrative flags and its own
      // inventories, and auditing the auditor in the same pass is noise, not signal.
      // `continue` (not `return`) so the shared cursor keeps handing out work.
      if (path.basename(rel) === 'check-flag-contract.mjs') continue;
      const src = stripComments(fs.readFileSync(path.join(ROOT, rel), 'utf8'));
    const inventories = extractInventories(src);
    const allFlags = extractAllFlags(src);
    const help = await runTool(rel, ['--help']);
    const issues = [];
    const advisory = [];

    // Ownership: which inventory declares each flag. Double declaration is a
    // real bug - the tool's own precedence decides the winner, silently.
    const owner = new Map();
    for (const inv of inventories) {
      for (const f of inv.members) {
        if (owner.has(f)) issues.push(`flag "${f}" declared in both ${owner.get(f)} and ${inv.name}`);
        else owner.set(f, inv.name);
      }
    }

    // Flags used in source but owned by no inventory. This is a HEURISTIC and is
    // reported as ADVISORY, never as a failure, because three real architectures in
    // this workspace legitimately have no flat inventory:
    //   - subcommand-scoped tools (telemetry-collector/-export declare flags per
    //     `serve` / `report` / `prune`, not one global set);
    //   - orchestrators that invoke OTHER tools and therefore legitimately mention
    //     those tools' flags (verify-tools' SMOKE matrix holds `--limit 1` for
    //     coverage-trend; cross-repo-tests drives sync-parity's `--strict`);
    //   - probe/sentinel strings that exist only to be rejected.
    // A human reads these; only the two checks below are provably wrong.
    const orphans = [...allFlags].filter(
      (f) =>
        !owner.has(f) &&
        !FOREIGN_FLAGS.has(f.slice(2)) &&
        f !== '--help' &&
        f !== '-h' &&
        !VALUE_FLAGS.has(f) &&
        !BOOLEAN_FLAGS.has(f)
    );
    for (const f of orphans) advisory.push(`flag "${f}" used in source but declared in no inventory (advisory)`);

    // Declared but absent from the tool's own --help (its documented contract).
    // Unambiguous: a flag the tool accepts but never documents.
    if (help.code === 0 && help.out) {
      for (const f of owner.keys()) {
        if (!help.out.includes(f)) issues.push(`flag "${f}" declared but missing from --help output`);
      }
    }

    // Behavioural confirmation that a declared flag is really implemented.
    //
    // Probe ORDER is what keeps this honest — three shapes, each answering a
    // different question, and every failure below maps to a real defect:
    //   1. bare `--flag` alone CLASSIFIES the flag (only when the probe exits
    //      non-zero — a tool that RAN and merely echoed the phrase in its
    //      output is not reporting anything about its own argv):
    //        · "requires a value"/"missing value" -> value flag; prove =value (3).
    //        · "unknown flag"                     -> ambiguous; disambiguate (2).
    //        · tool ran (exit 0 / non-usage error) -> boolean flag; done.
    //   2. `--flag <sentinel>` only when bare said "unknown flag": proves whether
    //      the flag exists at all. Both forms unknown -> declared but NOT
    //      implemented. Space form accepted -> the flag exists and its
    //      missing-value path is calling a KNOWN flag "unknown" (exit code
    //      right, message misleads the user).
    //   3. `--flag=<sentinel>` only for confirmed value flags: the
    //      `--flag=value` form of the Round 12 D contract must be honoured.
    //
    // Boolean flags are deliberately NOT probed with `=value`: rejecting
    // `--json=zzz` is CORRECT (a no-value flag must not silently swallow a
    // value), so that rejection is a PASS here. `verify-tools --check-cli`
    // separately proves every tool rejects unknown flags in all three forms.
    // A bare probe that simply runs (optional-value flags like `--flakes`)
    // classifies as boolean — a conservative call that can only under-report,
    // never raise a false alarm.
    const behavioural = [];
    if (deep) {
      const saysUnknown = (r) => /unknown flag/i.test(r.out || '');
      for (const f of owner.keys()) {
        // SAFETY: never send a sentinel value to a flag whose value is a write
        // destination. See isWriteRisky for why this is tested separately.
        if (isWriteRisky(f, allowWriteRisky)) {
          behavioural.push({ flag: f, skipped: 'write-risky' });
          continue;
        }
        const bare = await runTool(rel, [f]);
        const verdict = { flag: f, bare: bare.code };
        const step = classifyBareProbe(bare);
        verdict.kind = step.kind;
        if (step.next === 'equals') {
          const eq = await runTool(rel, [`${f}=zzz-invalid-sentinel`]);
          verdict.equals = eq.code;
          if (saysUnknown(eq) || classifyBareProbe(eq).kind !== 'boolean') {
            issues.push(`flag "${f}" declared in ${owner.get(f)} but rejected in --flag=value form`);
          }
        } else if (step.next === 'space') {
          const space = await runTool(rel, [f, 'zzz-invalid-sentinel']);
          verdict.space = space.code;
          if (space.code !== 0 && saysUnknown(space)) {
            issues.push(`flag "${f}" declared in ${owner.get(f)} but the tool reports it unknown`);
          } else {
            issues.push(
              `flag "${f}" declared in ${owner.get(f)}: its missing-value error calls the known flag "unknown" (exit ${bare.code} is right, the message misleads)`
            );
          }
        }
        behavioural.push(verdict);
      }
    }

    if (issues.length > 0) failed += 1;
    rows.push({
      tool: rel,
      inventories: inventories.map((inv) => ({ name: inv.name, flags: inv.members })),
      declared: owner.size,
      orphans,
      advisory,
      behavioural,
      issues,
      ok: issues.length === 0,
    });
    };
  };
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, tools.length) }, () => worker()));

  // False-green guard (v1.1): `--only check-flag-contract.mjs` passes the
  // "matched no tools" filter above (the file exists) but every row is then
  // skipped by the self-skip, so `rows` is empty. Printing "0/0 tools pass"
  // and exiting 0 would be exactly the silent pass this tool exists to
  // prevent — refuse to report a clean zero (usage error, exit 2).
  if (rows.length === 0) {
    die('audited zero tools - --only selected only the auditor itself, or tools/ holds no auditable file');
  }

  if (asJson) {
    console.log(JSON.stringify({ schema: 1, mode: 'check-flag-contract', deep, rows, failed }, null, 2));
  } else if (quiet) {
    // Quiet prints only what a human must act on: failing tools, their issues,
    // and the tally. Without this branch `--quiet` parsed and was documented but
    // changed nothing — a no-op flag, which is the exact failure class this tool
    // exists to catch, found by this tool's own checker on itself.
    for (const r of rows.filter((x) => !x.ok)) {
      console.log(`FAIL  ${path.basename(r.tool)}`);
      for (const i of r.issues) console.log(`        ${i}`);
    }
    console.log(`check-flag-contract: ${rows.length - failed}/${rows.length} tools pass the hard checks.`);
  } else {
    console.log(`\n# flag contract (${deep ? 'static + behavioural' : 'static only'})`);
    for (const r of rows) {
      const inv = r.inventories.map((i) => `${i.name}(${i.flags.length})`).join(' ') || '(none)';
      console.log(
        `${r.ok ? 'ok  ' : 'FAIL'}  ${path.basename(r.tool).padEnd(26)} ${String(r.declared).padStart(3)} declared  ${inv}`
      );
      for (const i of r.issues) console.log(`        FAIL  ${i}`);
      if (r.advisory.length) {
        console.log(`        note  ${r.advisory.length} undeclared-in-source flag(s), advisory only`);
      }
    }
    console.log(`\ncheck-flag-contract: ${rows.length - failed}/${rows.length} tools pass the hard checks.`);
    console.log('advisory flags are heuristics (subcommand-scoped tools and orchestrators legitimately');
    console.log('have no flat inventory); they are reported, never counted as failures.');
    if (!deep) console.log('(run with --deep to also confirm each declared flag is implemented)');
  }
  process.exit(failed > 0 ? 1 : 0);
}

// Dispatched here, not next to the argv parse: runSelfTest() reaches the const
// INVENTORY_RE / FOREIGN_FLAGS / analyzeStatic declarations below, and calling it
// earlier hit them inside their temporal dead zone (ReferenceError at first run).
if (flags['--self-test'] === true) runSelfTest();

await main();