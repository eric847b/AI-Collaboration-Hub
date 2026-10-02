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
import { execFile } from 'node:child_process';
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

const BOOLEAN_FLAGS = new Set(['--json', '--quiet', '--deep', '--allow-write-risky']);
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
const onlyNames = (flags['--only'] || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

// ---- static extraction -----------------------------------------------------

/** Inventory declarations: `const <NAME> = new Set([ '--x', ... ])`. */
const INVENTORY_RE = /const\s+([A-Z_]+)\s*=\s*new Set\(\[([\s\S]*?)\]\s*\)/g;
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
      const saysUnknown = (r) => /unknown flag/i.test(r.out);
      const saysMissingValue = (r) => /requires? a value|needs a value|missing value/i.test(r.out);
      for (const f of owner.keys()) {
        if (WRITE_RISKY_FLAGS.has(f) && !allowWriteRisky) {
          behavioural.push({ flag: f, skipped: 'write-risky' });
          continue;
        }
        const bare = await runTool(rel, [f]);
        const verdict = { flag: f, bare: bare.code };
        if (bare.code !== 0 && saysMissingValue(bare)) {
          verdict.kind = 'value';
          const eq = await runTool(rel, [`${f}=zzz-invalid-sentinel`]);
          verdict.equals = eq.code;
          if (saysUnknown(eq) || saysMissingValue(eq)) {
            issues.push(`flag "${f}" declared in ${owner.get(f)} but rejected in --flag=value form`);
          }
        } else if (bare.code !== 0 && saysUnknown(bare)) {
          verdict.kind = 'ambiguous';
          const space = await runTool(rel, [f, 'zzz-invalid-sentinel']);
          verdict.space = space.code;
          if (space.code !== 0 && saysUnknown(space)) {
            issues.push(`flag "${f}" declared in ${owner.get(f)} but the tool reports it unknown`);
          } else {
            issues.push(
              `flag "${f}" declared in ${owner.get(f)}: its missing-value error calls the known flag "unknown" (exit ${bare.code} is right, the message misleads)`
            );
          }
        } else {
          verdict.kind = 'boolean';
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

await main();