#!/usr/bin/env node
/**
 * handoff-check.mjs - validator for the .renitor session-handoff contract (rule #10).
 *
 * AGENTS.md requires that when a session stops it writes `.renitor/handoff-result.json`
 * and refreshes `.renitor/current-handoff.md`. Nothing ever validated that shape, so a
 * malformed or half-written handoff silently broke the next session's onboarding. This
 * tool turns the contract into a *checked* invariant:
 *
 *   node tools/handoff-check.mjs              # schema + freshness report
 *   node tools/handoff-check.mjs --strict     # warnings also fail (exit 1)
 *   node tools/handoff-check.mjs --json       # machine-readable report
 *   node tools/handoff-check.mjs --quiet      # findings only (hooks / CI)
 *   node tools/handoff-check.mjs --verbose    # per-field detail
 *   node tools/handoff-check.mjs --file <p>   # validate a specific document
 *   node tools/handoff-check.mjs --self-test  # prove every validator fires on fixtures
 *   node tools/handoff-check.mjs --help       # usage
 *
 * Design notes
 *   - Read-only and offline: never writes, never calls the network, never mutates `.renitor/`.
 *   - `.renitor/` is machine-local + gitignored, so a missing file is NOT an error: the tool
 *     degrades to "skipped (machine-local)" with exit 0, keeping CI green (durable rule #5).
 *   - Freshness: `handoff-result.json` must not be OLDER than `current-handoff.md`, otherwise
 *     the handoff was refreshed but the result was forgotten - exactly the failure rule #10
 *     exists to prevent.
 *   - `--self-test` builds valid + deliberately-broken fixtures in a temp dir and asserts each
 *     defect is caught, so a green run is evidence rather than an assumption.
 *   - Dependency-free (node builtins only) so it runs in CI and in the pre-commit hook.
 *
 * Exit codes: 0 ok * 1 problems (or warnings under --strict) * 2 setup error.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);
const arg = (flag) => {
  const i = argv.indexOf(flag);
  return i === -1 ? null : (argv[i + 1] ?? null);
};

const asJson = has('--json');
const strict = has('--strict');
const quiet = has('--quiet');
const verbose = has('--verbose');
const selfTest = has('--self-test');
const fileOverride = arg('--file');

if (has('--help') || has('-h')) {
  console.log(
    [
      'handoff-check.mjs - validator for the .renitor session-handoff contract (rule #10)',
      '',
      'usage: node tools/handoff-check.mjs [options]',
      '',
      '  --strict        treat warnings as failures (exit 1)',
      '  --json          machine-readable report',
      '  --quiet         findings only (CI / hooks)',
      '  --verbose       print per-field detail',
      '  --file <path>   validate a specific handoff-result document',
      '  --self-test     prove every validator fires on synthetic fixtures',
      '  -h, --help      this text',
      '',
      'exit codes: 0 ok | 1 problems | 2 setup error',
    ].join('\n'),
  );
  process.exit(0);
}

/** Lifecycle states; anything else is a typo that would confuse the next session. */
const STATUSES = ['completed', 'partial', 'blocked', 'stopped', 'in-progress'];

/** Required top-level keys mapped to the expected shape. 'object' means "array". */
const REQUIRED = {
  schema: 'number',
  status: 'string',
  summary: 'string',
  changedPaths: 'object',
  validation: 'object',
  needsUserDecision: 'boolean',
};

/** Optional keys that are accepted (and reported when absent from this list). */
const KNOWN_OPTIONAL = ['nextSteps', 'blockers', 'notes', 'branch', 'commit', 'session'];

/** mtime helper - freshness compares the two handoff artefacts. */
function mtime(p) {
  try {
    return fs.statSync(p).mtimeMs;
  } catch {
    return null;
  }
}
/**
 * Validate a parsed handoff document.
 * @param {unknown} doc
 * @returns {{errors: string[], warnings: string[], info: string[]}}
 */
function validate(doc) {
  const errors = [];
  const warnings = [];
  const info = [];

  if (doc === null || typeof doc !== 'object' || Array.isArray(doc)) {
    return { errors: ['document is not a JSON object'], warnings, info };
  }

  // ---- required keys and their types
  for (const [key, type] of Object.entries(REQUIRED)) {
    if (!(key in doc)) {
      errors.push(`missing required key "${key}"`);
      continue;
    }
    if (type === 'object') {
      if (!Array.isArray(doc[key])) errors.push(`"${key}" must be an array`);
    } else if (typeof doc[key] !== type) {
      errors.push(`"${key}" must be a ${type} (got ${typeof doc[key]})`);
    }
  }

  // ---- schema version
  if (typeof doc.schema === 'number' && (!Number.isInteger(doc.schema) || doc.schema < 1)) {
    errors.push(`"schema" must be a positive integer (got ${doc.schema})`);
  }

  // ---- status enum
  if (typeof doc.status === 'string' && !STATUSES.includes(doc.status)) {
    errors.push(`"status" must be one of ${STATUSES.join(', ')} (got "${doc.status}")`);
  }

  // ---- summary must actually be able to onboard the next session
  if (typeof doc.summary === 'string') {
    const s = doc.summary.trim();
    if (s.length < 20) {
      errors.push('"summary" is too short to onboard the next session (min 20 chars)');
    }
    if (s.length > 2000) warnings.push('"summary" is very long (>2000 chars) - keep it skimmable');
  }

  // ---- changedPaths
  if (Array.isArray(doc.changedPaths)) {
    if (doc.changedPaths.length === 0) {
      warnings.push('"changedPaths" is empty - nothing recorded as changed');
    }
    doc.changedPaths.forEach((p, i) => {
      if (typeof p !== 'string' || p.trim() === '') {
        errors.push(`changedPaths[${i}] must be a non-empty string`);
      } else if (p.includes('\\')) {
        errors.push(`changedPaths[${i}] must use forward slashes ("${p}")`);
      } else if (path.isAbsolute(p)) {
        warnings.push(`changedPaths[${i}] is absolute ("${p}") - use repo-relative paths`);
      }
    });
  }
// ---- validation proofs: a handoff with no proven commands is not evidence
  if (Array.isArray(doc.validation)) {
    if (doc.validation.length === 0) {
      errors.push('"validation" is empty - a handoff with no proven commands is not evidence');
    }
    doc.validation.forEach((v, i) => {
      if (v === null || typeof v !== 'object' || Array.isArray(v)) {
        errors.push(`validation[${i}] must be an object {command, exitCode}`);
        return;
      }
      if (typeof v.command !== 'string' || v.command.trim() === '') {
        errors.push(`validation[${i}].command must be a non-empty string`);
      }
      if (!Number.isInteger(v.exitCode)) {
        errors.push(`validation[${i}].exitCode must be an integer`);
      } else if (v.exitCode !== 0) {
        warnings.push(`validation[${i}] recorded a FAILING command (exit ${v.exitCode}): ${v.command}`);
      }
    });
  }

  // ---- lifecycle coherence
  if (typeof doc.needsUserDecision === 'boolean') {
    if (doc.needsUserDecision && doc.status === 'completed') {
      warnings.push('"needsUserDecision" is true but "status" is completed - contradictory');
    }
    if (!doc.needsUserDecision && doc.status === 'blocked') {
      warnings.push('"status" is blocked but "needsUserDecision" is false - state what is needed');
    }
  }

  // ---- unknown keys are a smell: a typo silently drops information
  for (const key of Object.keys(doc)) {
    if (!(key in REQUIRED) && !KNOWN_OPTIONAL.includes(key)) {
      info.push(`unknown key "${key}" (known optional: ${KNOWN_OPTIONAL.join(', ')})`);
    }
  }

  return { errors, warnings, info };
}

/**
 * Freshness invariant: the machine-readable result must not be OLDER than the
 * narrative handoff. A stale result means a session refreshed the markdown but
 * forgot the JSON (or vice versa), which is precisely what rule #10 prevents.
 * Kept pure so `--self-test` can exercise it without touching `.renitor/`.
 *
 * @param {number|null} resultMs  mtime of handoff-result.json
 * @param {number|null} handoffMs mtime of current-handoff.md
 * @returns {{errors: string[], warnings: string[]}}
 */
function freshnessFindings(resultMs, handoffMs) {
  const errors = [];
  const warnings = [];
  if (resultMs === null || handoffMs === null) return { errors, warnings };
  // 1s slack absorbs filesystem timestamp granularity between two quick writes.
  if (resultMs < handoffMs - 1000) {
    warnings.push(
      'handoff-result.json is older than current-handoff.md - the result was not refreshed with the narrative',
    );
  }
  return { errors, warnings };
}

/**
 * Read and parse a handoff document.
 * @param {string} fp absolute path
 * @returns {{ok: boolean, doc?: unknown, error?: string, missing: boolean}}
 */
function loadDoc(fp) {
  let raw;
  try {
    raw = fs.readFileSync(fp, 'utf8');
  } catch (e) {
    const missing = e && e.code === 'ENOENT';
    return { ok: false, missing, error: missing ? `not found: ${fp}` : `cannot read ${fp} (${e.message})` };
  }
  try {
    // PowerShell 5.1 `Set-Content -Encoding utf8` prepends a UTF-8 BOM and
    // JSON.parse rejects it, so strip it before parsing (durable rule #11:
    // Windows PowerShell encoding traps). Without this, a handoff written from
    // PowerShell would be permanently unvalidatable.
    const text = raw.charCodeAt(0) === 0xfeff ? raw.slice(1) : raw;
    return { ok: true, missing: false, doc: JSON.parse(text) };
  } catch (e) {
    return { ok: false, missing: false, error: `invalid JSON in ${fp}: ${String(e.message).split('\n')[0]}` };
  }
}

// ---- self-test: prove every validator fires on a synthetic fixture -----------
/** Baseline document that MUST validate clean; defect cases mutate a copy. */
function validFixture() {
  return {
    schema: 1,
    status: 'completed',
    summary: 'Finished the handoff validator and wired it into verify-tools + CI.',
    changedPaths: ['tools/handoff-check.mjs', 'tools/verify-tools.mjs'],
    validation: [{ command: 'node tools/handoff-check.mjs --self-test', exitCode: 0 }],
    needsUserDecision: false,
  };
}

/**
 * One entry per validator, each asserting the expected bucket + substring.
 * `kind` is which of errors/warnings/info must carry the message.
 */
const DEFECT_CASES = [
  { id: 'not-an-object', kind: 'errors', needle: 'not a JSON object', doc: [] },
  {
    id: 'missing-summary',
    kind: 'errors',
    needle: 'missing required key "summary"',
    mutate: (d) => {
      delete d.summary;
      return d;
    },
  },
  {
    id: 'wrong-type-schema',
    kind: 'errors',
    needle: '"schema" must be a number',
    mutate: (d) => ({ ...d, schema: '1' }),
  },
  {
    id: 'array-key-not-array',
    kind: 'errors',
    needle: '"changedPaths" must be an array',
    mutate: (d) => ({ ...d, changedPaths: 'tools/x.mjs' }),
  },
  {
    id: 'schema-not-positive-int',
    kind: 'errors',
    needle: '"schema" must be a positive integer',
    mutate: (d) => ({ ...d, schema: 1.5 }),
  },
  {
    id: 'status-enum',
    kind: 'errors',
    needle: '"status" must be one of',
    mutate: (d) => ({ ...d, status: 'finished' }),
  },
  {
    id: 'summary-too-short',
    kind: 'errors',
    needle: '"summary" is too short',
    mutate: (d) => ({ ...d, summary: 'done' }),
  },
  {
    id: 'changed-paths-empty',
    kind: 'warnings',
    needle: '"changedPaths" is empty',
    mutate: (d) => ({ ...d, changedPaths: [] }),
  },
  {
    id: 'changed-path-non-string',
    kind: 'errors',
    needle: 'changedPaths[0] must be a non-empty string',
    mutate: (d) => ({ ...d, changedPaths: [42, 'ok.mjs'] }),
  },
  {
    id: 'changed-path-backslash',
    kind: 'errors',
    needle: 'must use forward slashes',
    mutate: (d) => ({ ...d, changedPaths: ['tools\\handoff-check.mjs'] }),
  },
  {
    id: 'changed-path-absolute',
    kind: 'warnings',
    needle: 'is absolute',
    mutate: (d) => ({ ...d, changedPaths: ['/home/u/repo/tools/x.mjs'] }),
  },
  {
    id: 'validation-empty',
    kind: 'errors',
    needle: '"validation" is empty',
    mutate: (d) => ({ ...d, validation: [] }),
  },
  {
    id: 'validation-not-object',
    kind: 'errors',
    needle: 'validation[0] must be an object',
    mutate: (d) => ({ ...d, validation: ['ran the gate'] }),
  },
  {
    id: 'validation-command-empty',
    kind: 'errors',
    needle: 'validation[0].command must be a non-empty string',
    mutate: (d) => ({ ...d, validation: [{ command: '   ', exitCode: 0 }] }),
  },
  {
    id: 'validation-exit-not-integer',
    kind: 'errors',
    needle: 'validation[0].exitCode must be an integer',
    mutate: (d) => ({ ...d, validation: [{ command: 'node x.mjs', exitCode: '0' }] }),
  },
  {
    id: 'validation-failing-command',
    kind: 'warnings',
    needle: 'recorded a FAILING command',
    mutate: (d) => ({ ...d, validation: [{ command: 'npm run gate', exitCode: 1 }] }),
  },
  {
    id: 'needs-decision-but-completed',
    kind: 'warnings',
    needle: '"needsUserDecision" is true but "status" is completed',
    mutate: (d) => ({ ...d, needsUserDecision: true }),
  },
  {
    id: 'blocked-without-decision',
    kind: 'warnings',
    needle: 'but "needsUserDecision" is false',
    mutate: (d) => ({ ...d, status: 'blocked', needsUserDecision: false }),
  },
  {
    id: 'unknown-key',
    kind: 'info',
    needle: 'unknown key "sammary"',
    mutate: (d) => ({ ...d, sammary: 'typo' }),
  },
  {
    id: 'known-optional-accepted',
    kind: 'info-none',
    needle: 'unknown key',
    mutate: (d) => ({ ...d, nextSteps: ['ship it'], blockers: [], branch: 'main' }),
  },
];

// ---- self-test runner --------------------------------------------------------
if (selfTest) {
  const failures = [];

  // 1. the baseline fixture must be clean in every bucket
  const baseline = validate(validFixture());
  for (const kind of ['errors', 'warnings', 'info']) {
    for (const m of baseline[kind]) failures.push(`baseline fixture is not clean (${kind}): ${m}`);
  }

  // 2. every defect case must be caught, in the right bucket, with the right text
  let caught = 0;
  for (const c of DEFECT_CASES) {
    const doc = 'doc' in c ? c.doc : c.mutate(validFixture());
    const res = validate(doc);
    const bucket = res[c.kind === 'info-none' ? 'info' : c.kind] || [];
    const hit = bucket.some((m) => m.includes(c.needle));
    if (c.kind === 'info-none') {
      if (hit) failures.push(`false positive: ${c.id} (${c.needle})`);
      else caught += 1;
    } else if (!hit) {
      failures.push(`validator miss: ${c.id} (expected ${c.kind} ~ "${c.needle}")`);
    } else {
      caught += 1;
    }
  }

  // 3. freshness invariant - pure, exercised without touching .renitor/
  const t0 = 1_000_000;
  const FRESHNESS_CASES = 4;
  if (!freshnessFindings(t0, t0 + 60_000).warnings.some((m) => m.includes('older than current-handoff.md'))) {
    failures.push('freshness miss: an older result must warn');
  }
  if (freshnessFindings(t0 + 60_000, t0).warnings.length) {
    failures.push('freshness false positive: a newer result must not warn');
  }
  if (freshnessFindings(t0, t0).warnings.length) {
    failures.push('freshness false positive: equal mtimes must not warn');
  }
  if (freshnessFindings(null, t0).warnings.length || freshnessFindings(t0, null).warnings.length) {
    failures.push('freshness false positive: a missing artefact must not warn');
  }

  // 4. loader round-trip: valid JSON, broken JSON, absent file - in a temp dir
  let tmp = null;
  try {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'handoff-check-'));
    const good = path.join(tmp, 'good.json');
    fs.writeFileSync(good, JSON.stringify(validFixture()));
    if (!loadDoc(good).ok) failures.push('loader miss: a valid document must load');

    const bad = path.join(tmp, 'bad.json');
    fs.writeFileSync(bad, '{ "schema": 1,');
    const b = loadDoc(bad);
    if (b.ok || !/invalid JSON/.test(b.error)) failures.push('loader miss: broken JSON must report "invalid JSON"');

    const gone = loadDoc(path.join(tmp, 'absent.json'));
    if (gone.ok || !gone.missing) failures.push('loader miss: an absent file must be flagged missing (not fatal)');
  } catch (e) {
    failures.push(`loader self-test could not run: ${e.message}`);
  } finally {
    if (tmp) fs.rmSync(tmp, { recursive: true, force: true });
  }

  if (asJson) {
    console.log(
      JSON.stringify(
        {
          baseline: baseline.errors.length === 0 ? 'clean' : 'dirty',
          defectCases: DEFECT_CASES.length,
          caught,
          freshnessCases: FRESHNESS_CASES,
          loaderCases: 3,
          failures,
          ok: failures.length === 0,
        },
        null,
        2,
      ),
    );
  } else {
    console.log('\n# handoff-check self-test');
    console.log(
      `baseline fixture: ${baseline.errors.length === 0 ? 'clean' : 'DIRTY'} | ` +
        `${caught}/${DEFECT_CASES.length} defects caught | ${FRESHNESS_CASES} freshness cases | 3 loader cases`,
    );
    for (const f of failures) console.log(`FAIL  ${f}`);
    if (failures.length === 0) console.log('RESULT: clean');
  }
  process.exit(failures.length === 0 ? 0 : 1);
}

// ---- live check --------------------------------------------------------------
const RESULT_PATH = path.join(ROOT, '.renitor', 'handoff-result.json');
const HANDOFF_PATH = path.join(ROOT, '.renitor', 'current-handoff.md');
const target = fileOverride ? path.resolve(ROOT, fileOverride) : RESULT_PATH;

const loaded = loadDoc(target);
const errors = [];
const warnings = [];
const info = [];
let skipped = false;
let mode;

if (loaded.missing && !fileOverride) {
  // `.renitor/` is machine-local and gitignored: absence is expected in CI.
  skipped = true;
  mode = 'skipped (machine-local)';
} else if (!loaded.ok) {
  mode = 'invalid';
  errors.push(loaded.error);
} else {
  mode = 'validated';
  const res = validate(loaded.doc);
  errors.push(...res.errors);
  warnings.push(...res.warnings);
  info.push(...res.info);
  if (!fileOverride) {
    const fresh = freshnessFindings(mtime(RESULT_PATH), mtime(HANDOFF_PATH));
    errors.push(...fresh.errors);
    warnings.push(...fresh.warnings);
  }
}

const failed = errors.length > 0 || (strict && warnings.length > 0);
const relTarget = path.relative(ROOT, target).replace(/\\/g, '/');

if (asJson) {
  console.log(
    JSON.stringify(
      { target: relTarget, mode, errors, warnings, info, strict, ok: !failed, skipped },
      null,
      2,
    ),
  );
} else {
  if (errors.length || warnings.length || (verbose && info.length)) {
    console.log('\n# handoff-check findings');
    console.log('| Severity | Message |');
    console.log('|----------|---------|');
    for (const m of errors) console.log(`| error | ${m} |`);
    for (const m of warnings) console.log(`| warn | ${m} |`);
    if (verbose) for (const m of info) console.log(`| info | ${m} |`);
  }
  if (!quiet || errors.length || warnings.length) {
    console.log('\n# handoff-check summary');
    console.log(`target: ${relTarget}`);
    console.log(`mode: ${mode}${skipped ? ' (nothing to validate; CI stays green by design)' : ''}`);
    console.log(`findings: ${errors.length} error, ${warnings.length} warn${verbose ? `, ${info.length} info` : ''}${strict ? ' [--strict]' : ''}`);
    console.log(failed ? 'RESULT: FAIL' : 'RESULT: clean');
  }
  if (errors.length) {
    console.log('\nFix: write a handoff with schema/status/summary/changedPaths/validation/needsUserDecision');
    console.log('     (see the schema in AGENTS.md rule #10 and .renitor/current-handoff.md section 14).');
  }
}

process.exit(failed ? 1 : 0);
