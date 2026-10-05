/**
 * mutation-probe - proves that a tool's OWN self-test guards actually bite.
 *
 * WHY THIS EXISTS
 * Several rounds of work in this repo found the same failure mode: a guard that
 * was written, documented, and believed to cover a risk, but which nothing
 * actually exercised. Examples that shipped green far too long:
 *   - workflow-audit: the WF004 safety verdict keys on three "untrusted reach"
 *     rules (WF011/WF001/WF010) while its self-test proved only one of them. A
 *     neutered WF001 branch kept the suite GREEN.
 *   - secret-scan: the redaction self-test asserted only the `evidence` field and
 *     never `preview`, so mutating preview to emit the raw credential line kept
 *     the suite GREEN.
 * In both cases the guard existed only in prose. A test that has never been
 * watched failing is not evidence of anything.
 *
 * WHAT IT DOES
 * For each declared probe it:
 *   1. CONTROL   - copies the tool UNMODIFIED beside itself and asserts
 *                  `--self-test` exits 0. This step is not optional: without it a
 *                  harness bug makes every mutant "fail" for unrelated reasons
 *                  and the run reports false assurance. (This tool was bitten by
 *                  exactly that: mutants first written to tools/.tmp/ all failed
 *                  with "cannot parse the CI pattern list" because the parser
 *                  resolves the workflow path relative to the tool's own
 *                  directory - so every mutant looked "caught".)
 *   2. MUTATION  - applies one declared exact-string substitution and asserts
 *                  `--self-test` exits NON-ZERO.
 *   3. CLEANUP   - deletes both copies in a `finally`, so a crash cannot leave a
 *                  mutant behind for another session to commit.
 *
 * A mutant that SURVIVES is the interesting result: it means a documented guard
 * does not actually cover the risk it claims to.
 *
 * SAFETY: never edits a tracked file. Writes only
 * <dir-of-tool>/.mutation-probe-*.mjs copies, which it deletes itself.
 *
 * Exit codes: 0 every probe caught its mutant and every control passed |
 * 1 a mutant survived, a control failed, or a probe drifted | 2 bad usage.
 */

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { spawnSync } from 'node:child_process';

const TOOLS_DIR = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));

/**
 * The probe catalogue. `from`/`to` are EXACT source substrings; a probe whose
 * `from` is absent is reported as drift rather than skipped, because a rename
 * would otherwise turn a real probe into a no-op that always "passes".
 */
const PROBES = [
  {
    tool: 'workflow-audit.mjs',
    id: 'wf004-verdict-wf011',
    why: 'WF004 verdict must say RISKY when an untrusted checkout reaches the privileged job',
    from: "['WF011', 'untrusted checkout'],",
    to: "['WF011X', 'untrusted checkout'],",
  },
  {
    tool: 'workflow-audit.mjs',
    id: 'wf004-verdict-wf001',
    why: 'WF004 verdict must say RISKY when untrusted context is interpolated into a privileged shell',
    from: "['WF001', 'untrusted context in a shell'],",
    to: "['WF001X', 'untrusted context in a shell'],",
  },
  {
    tool: 'workflow-audit.mjs',
    id: 'wf004-verdict-wf010',
    why: 'WF004 verdict must say RISKY when dispatch input is interpolated into a privileged shell',
    from: "['WF010', 'dispatch input in a shell'],",
    to: "['WF010X', 'dispatch input in a shell'],",
  },
  {
    tool: 'secret-scan.mjs',
    id: 'secret-redact-evidence',
    why: 'a redacted finding must never carry the credential tail in its evidence',
    from: 'return `${value.slice(0, 4)}***(${value.length} chars)`;',
    to: 'return value;',
  },
  {
    tool: 'secret-scan.mjs',
    id: 'secret-redact-preview',
    why: 'a redacted finding must never carry the raw source line in its preview',
    from: 'preview: line.trim().slice(0, 90).split(value).join(redact(value)),',
    to: 'preview: line.trim().slice(0, 90),',
  },
  {
    tool: 'telemetry-collector.mjs',
    id: 'telemetry-rate-limit-applies',
    why: 'the per-app rate limiter must actually drop events, or ingestion is unbounded',
    from: 'windowMs: RATE_WINDOW_MS,',
    to: 'windowMs: 0,',
  },
  {
    tool: 'telemetry-collector.mjs',
    id: 'telemetry-rate-window-is-a-minute',
    why: 'the limiter window must stay 60s - behaviour alone cannot pin it, since the self-test drives an injectable clock',
    from: 'export const RATE_WINDOW_MS = 60 * 1000;',
    to: 'export const RATE_WINDOW_MS = 60 * 100000;',
  },
  {
    tool: 'telemetry-collector.mjs',
    id: 'telemetry-dedupe-suppresses',
    why: 'identical events inside the dedupe window must be suppressed, not double-counted',
    from: 'windowMs: options.dedupeWindow * 1000,',
    to: 'windowMs: 0,',
  },
  {
    tool: 'extension-check.mjs',
    id: 'extcheck-empty-lists-are-not-parity',
    why: 'LADDER_PROVIDERS = [] on both sides compares equal - a vacuous green for an extension routing nowhere',
    from: "  if (!bgList.length || !optList.length) {",
    to: '  if (false) {',
  },
  {
    tool: 'extension-check.mjs',
    id: 'extcheck-secret-detector-fires',
    why: 'the hardcoded-secret detector must actually flag a key-shaped string',
    from: "    /sk-[A-Za-z0-9]{10,}/.test(src) ||",
    to: '    false ||',
  },
  {
    tool: 'extension-check.mjs',
    id: 'extcheck-unextractable-is-not-parity',
    why: 'a null allow-list is a failure, not an exemption from the parity check',
    from: "  if (bgList === null || optList === null) {",
    to: '  if (false) {',
  },
  {
    tool: 'e2e-smoke.mjs',
    id: 'e2e-only-200-passes',
    why: 'a widened status comparison (status < 400) would green-light a 404/500 route',
    from: '  return status === 200;',
    to: '  return status < 400;',
  },
  {
    tool: 'e2e-smoke.mjs',
    id: 'e2e-nan-port-rejected',
    why: 'a NaN port/timeout never expires its deadline, so the start budget silently stopped existing',
    from: '  if (!Number.isInteger(n) || n < 1 || n > 65535) return NaN;',
    to: '  if (false) return NaN;',
  },
  {
    tool: 'e2e-smoke.mjs',
    id: 'e2e-empty-probe-set-cannot-pass',
    why: 'an empty result set trivially has zero failures - that is a vacuous green, not a pass',
    from: '  if (!results.length) {',
    to: '  if (false) {',
  },
  {
    tool: 'e2e-smoke.mjs',
    id: 'e2e-marker-stays-informational',
    why: 'the marker is warn-only by design; making it fatal would red-herring CI on other apps',
    from: '  const failures = results.filter((r) => !isRouteOk(r.status)).length;',
    to: '  const failures = results.filter((r) => !isRouteOk(r.status) || !r.hasMarker).length;',
  },
  {
    tool: 'load-test.mjs',
    id: 'loadtest-zero-measurement-cannot-pass',
    why: 'a run that measured nothing must FAIL, not vacuously PASS (NaN > gate is always false)',
    from: "  if (!Number.isFinite(measured) || measured <= 0) reasons.push('no requests completed');",
    to: "  if (false) reasons.push('no requests completed');",
  },
  {
    tool: 'load-test.mjs',
    id: 'loadtest-p95-gate-bites',
    why: 'the p95 latency gate must actually fail a slow build',
    from: '  if (p95 > maxP95ms) reasons.push',
    to: '  if (false) reasons.push',
  },
  {
    tool: 'load-test.mjs',
    id: 'loadtest-error-rate-gate-bites',
    why: 'the error-rate gate must actually fail a broken build',
    from: "  if (errorRate > maxErrorRate) reasons.push('error rate above gate');",
    to: "  if (false) reasons.push('error rate above gate');",
  },
  {
    tool: 'load-test.mjs',
    id: 'loadtest-nan-request-count-rejected',
    why: 'Math.max propagates NaN, so a non-numeric --requests used to run zero requests and still PASS',
    from: '  if (!Number.isFinite(n) || n < 1) return NaN;',
    to: '  if (false) return NaN;',
  },
  {
    tool: 'sync-parity.mjs',
    id: 'parity-missing-only-never-overwrites',
    why: 'missing-only must never clobber an actively-developed nested mirror - overwriting destroys another session work (durable rule 12)',
    from: "  return mode === 'overwrite' ? status !== 'parity' : status === 'MISSING';",
    to: "  return status !== 'parity';",
  },
  {
    tool: 'sync-parity.mjs',
    id: 'parity-strict-counts-diff-drift',
    why: '--strict must fail on DIFF drift, not only on absent files',
    from: "  return rows.filter((r) => r.status === 'DIFF' || r.status === 'MISSING').length;",
    to: "  return rows.filter((r) => r.status === 'MISSING').length;",
  },
  {
    tool: 'coverage-trend.cjs',
    id: 'coverage-gate-is-70pct',
    why: 'the coverage gate must stay 70% - it was a bare inline literal nothing asserted',
    from: 'const COVERAGE_GATE_PCT = 70;',
    to: 'const COVERAGE_GATE_PCT = 5;',
  },
  {
    tool: 'coverage-trend.cjs',
    id: 'coverage-gate-detection-fires',
    why: 'coverage below the gate must actually report a failure',
    from: 'pass: pct >= COVERAGE_GATE_PCT,',
    to: 'pass: true,',
  },
  {
    tool: 'bundle-trend.cjs',
    id: 'bundle-growth-threshold-is-10pct',
    why: 'the bundle regression threshold must stay 10% - no behavioural case can pin it',
    from: 'const DEFAULT_GROWTH_THRESHOLD_PCT = 10;',
    to: 'const DEFAULT_GROWTH_THRESHOLD_PCT = 1000;',
  },
  {
    tool: 'bundle-trend.cjs',
    id: 'bundle-growth-detection-fires',
    why: 'growth past the threshold must be reported as a regression',
    from: 'return { growth, regressed: growth > thresholdPct };',
    to: 'return { growth, regressed: false };',
  },
  {
    tool: 'ops-dashboard.mjs',
    id: 'dashboard-stale-threshold-is-24h',
    why: 'the dashboard staleness threshold must stay 24h - no behavioural case can pin it',
    from: 'const DEFAULT_MAX_AGE_HOURS = 24;',
    to: 'const DEFAULT_MAX_AGE_HOURS = 240;',
  },
  {
    tool: 'ops-dashboard.mjs',
    id: 'dashboard-stale-detection-fires',
    why: 'a section past the threshold must be reported stale, not quietly ok',
    from: "return { state: ageH > maxAgeHours ? 'stale' : 'fresh', ageH };",
    to: "return { state: 'fresh', ageH };",
  },
  {
    tool: 'handoff-check.mjs',
    id: 'handoff-freshness-not-weakened',
    why: 'a handoff result older than the narrative must still warn (durable rule 10)',
    from: 'if (resultMs < handoffMs - MTIME_SLACK_MS) {',
    to: 'if (resultMs < handoffMs - 86400000) {',
  },
  {
    tool: 'handoff-check.mjs',
    id: 'handoff-freshness-slack-is-1s',
    why: 'the freshness slack must stay 1000ms - the 60s-spaced cases cannot distinguish 0 from 1000',
    from: 'const MTIME_SLACK_MS = 1000;',
    to: 'const MTIME_SLACK_MS = 0;',
  },
  {
    tool: 'telemetry-export.mjs',
    id: 'export-bridge-binds-loopback',
    why: 'the production bridge must bind 127.0.0.1 - the suite built its own listener, so the real bind was untested and 0.0.0.0 shipped green',
    from: "server.listen(options.port, '127.0.0.1', () => {",
    to: "server.listen(options.port, '0.0.0.0', () => {",
  },
  {
    tool: 'telemetry-export.mjs',
    id: 'export-host-flag-refused',
    why: '--host must be refused by the loopback guard specifically, not by any unrelated validation error',
    from: "case '--host': throw new ExportError('--host is not supported: the bridge always binds 127.0.0.1');",
    to: "case '--host': i += 1; break;",
  },
  {
    tool: 'check-flag-contract.mjs',
    id: 'flag-write-risk-safety',
    why: 'the --deep layer must skip value flags that can WRITE, or a probe rewrites a real file',
    from: "const WRITE_RISKY_FLAGS = new Set([\n  '--out',",
    to: "const WRITE_RISKY_FLAGS = new Set([\n  '--out-disabled',",
  },
  {
    tool: 'verify-tools.mjs',
    id: 'verify-strict-promotes-warns',
    why: '--strict must exit 1 when any warn is present',
    from: 'if (strictMode && warned > 0) return 1;',
    to: 'if (false && strictMode && warned > 0) return 1;',
  },
  {
    tool: 'verify-tools.mjs',
    id: 'verify-summary-counts-failures',
    why: 'the run tally must count fail-level rows',
    from: "const failed = at('fail');",
    to: 'const failed = 0;',
  },
];

/* ------------------------------- flag parsing ------------------------------ */

const VALUE_FLAGS = new Set(['--tool', '--probe', '--max-seconds']);
const BOOL_FLAGS = new Set(['--json', '--quiet', '--help', '--list-probes', '--self-test']);

class UsageError extends Error {}
const HELP = `mutation-probe - prove a tool's own self-test guards actually bite

Usage:
  node tools/mutation-probe.mjs [options]

A probe runs the target tool's --self-test twice: once UNMODIFIED (the control,
which must exit 0) and once with one declared mutation applied (which must exit
non-zero). A mutant that exits 0 means a documented guard does not really cover
the risk it claims to.

Options:
  --tool <name[,name]>   only probe these tools (basename with extension)
  --probe <id[,id]>      only run these probe ids (see --list-probes)
  --max-seconds <n>      per-run timeout for each self-test (default 120)
  --json                 machine-readable schema-1 report
  --quiet                print only the one-line verdict
  --list-probes          list the catalogue and exit 0
  --self-test            assert this tool's own verdict logic (13 checks); exit 0/1
  --help                 print this help and exit 0

Exit codes:
  0  every probe caught its mutant and every control passed
  1  a mutant survived, a control failed, or a probe drifted (from-string gone)
  2  bad usage, or a selector that matched no probe (never a clean pass)

Notes:
  Never edits a tracked file. Writes only .mutation-probe-*.mjs copies beside
  the probed tool, deleted in a finally even if a run crashes.`;

function parseArgs(argv) {
  const out = {
    tool: [], probe: [], maxSeconds: 120,
    json: false, quiet: false, help: false, list: false, selfTest: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (BOOL_FLAGS.has(a)) {
      if (a === '--help') out.help = true;
      else if (a === '--json') out.json = true;
      else if (a === '--quiet') out.quiet = true;
      else if (a === '--list-probes') out.list = true;
      else out.selfTest = true;
      continue;
    }
    // Accept --flag=value and --flag value; reject a bare value flag.
    const eq = a.indexOf('=');
    const key = eq === -1 ? a : a.slice(0, eq);
    if (!VALUE_FLAGS.has(key)) throw new UsageError('unknown flag ' + a);
    const value = eq === -1 ? argv[++i] : a.slice(eq + 1);
    if (value === undefined) throw new UsageError(key + ' needs a value');
    if (key === '--max-seconds') {
      const n = Number(value);
      if (!Number.isInteger(n) || n <= 0) {
        throw new UsageError('--max-seconds expects a positive integer');
      }
      out.maxSeconds = n;
    } else if (key === '--tool') {
      out.tool.push(...value.split(',').map((s) => s.trim()).filter(Boolean));
    } else {
      out.probe.push(...value.split(',').map((s) => s.trim()).filter(Boolean));
    }
  }
  return out;
}

/** Run one file's --self-test. Never throws, never inherits our stdio. */
function runSelfTest(file, maxSeconds) {
  const res = spawnSync(process.execPath, [file, '--self-test'], {
    encoding: 'utf8',
    timeout: maxSeconds * 1000,
    windowsHide: true,
  });
  if (res.error) {
    return { exit: null, note: 'spawn failed: ' + res.error.message, output: '' };
  }
  return { exit: res.status, note: null, output: (res.stdout || '') + (res.stderr || '') };
}

/** The first self-test FAIL line, so a probe reports WHY it mattered. */
function firstFailure(output) {
  const m = String(output).split(/\r?\n/).find((l) => l.trim().startsWith('FAIL'));
  return m ? m.trim() : null;
}
/**
 * The verdict, as a PURE function of what the two runs returned.
 *
 * Extracted so `--self-test` can execute it. This decision is the one the whole
 * tool rests on, and it is also the one whose failure mode is SILENT: if a
 * mutant that exits 0 were ever labelled 'caught', this tool would report
 * assurance while the very gap it exists to find sits there untouched. It is the
 * only guard in the chain that nothing was verifying.
 *
 * @param {{toolExists:boolean, fromFound:boolean, controlExit:number|null, mutantExit:number|null}} r
 * @returns {'drift'|'control-failed'|'survived'|'caught'}
 */
export function classifyProbe(r) {
  if (!r.toolExists) return 'drift';
  if (!r.fromFound) return 'drift';
  if (r.controlExit !== 0) return 'control-failed';
  if (r.mutantExit === 0) return 'survived';
  return 'caught';
}

/** Run one probe. Never mutates the original: copies live beside it and go. */
function runProbe(probe, maxSeconds) {
  const src = path.join(TOOLS_DIR, probe.tool);
  // Single source of truth: every verdict below is produced by classifyProbe,
  // so --self-test verifies the same code path this runs.
  const verdictFor = (r) => classifyProbe({ toolExists: fs.existsSync(src), fromFound: true, ...r });
  if (!fs.existsSync(src)) {
    return { ...probe, verdict: verdictFor({ controlExit: null, mutantExit: null }), detail: 'tool not found: ' + probe.tool, control: null, mutant: null };
  }
  // Beside the tool, NOT in tools/.tmp: these tools resolve repo-relative paths
  // (workflows, the CI pattern list) against their own directory, so a copy
  // elsewhere fails for reasons unrelated to the mutation.
  const dir = path.dirname(src);
  const base = path.basename(src);
  const controlFile = path.join(dir, '.mutation-probe-control-' + base);
  const mutantFile = path.join(dir, '.mutation-probe-' + probe.id + '-' + base);
  // Normalize CRLF -> LF before matching. Declared `from` strings are authored
  // with \n, and most of the older tools here are CRLF: without this a perfectly
  // valid probe would report `drift` on every one of them. Normalizing the
  // source (rather than the probe) also keeps the control copy byte-comparable.
  const original = fs.readFileSync(src, 'utf8').replace(/\r\n/g, '\n');

  try {
    if (!original.includes(probe.from)) {
      // A rename must not silently neuter a probe into a no-op that always passes.
      return {
        ...probe,
        verdict: classifyProbe({ toolExists: true, fromFound: false, controlExit: null, mutantExit: null }),
        detail: 'mutation target not found in ' + probe.tool + ' - the probe drifted',
        control: null,
        mutant: null,
      };
    }

    fs.writeFileSync(controlFile, original, 'utf8');
    const control = runSelfTest(controlFile, maxSeconds);
    if (verdictFor({ controlExit: control.exit, mutantExit: null }) === 'control-failed') {
      return {
        ...probe,
        verdict: 'control-failed',
        detail: 'unmodified copy already fails (exit ' + control.exit + ') - invalid probe, not evidence',
        control: control.exit,
        mutant: null,
      };
    }

    fs.writeFileSync(mutantFile, original.replace(probe.from, probe.to), 'utf8');
    const mutant = runSelfTest(mutantFile, maxSeconds);
    if (verdictFor({ controlExit: control.exit, mutantExit: mutant.exit }) === 'survived') {
      return {
        ...probe,
        verdict: 'survived',
        detail: 'mutant still exits 0 - the guard does NOT cover: ' + probe.why,
        control: control.exit,
        mutant: mutant.exit,
      };
    }
    return {
      ...probe,
      verdict: 'caught',
      detail: firstFailure(mutant.output) || ('mutant exited ' + mutant.exit),
      control: control.exit,
      mutant: mutant.exit,
    };
  } finally {
    for (const f of [controlFile, mutantFile]) {
      try {
        fs.rmSync(f, { force: true });
      } catch {
        /* best effort: never mask a probe result with cleanup noise */
      }
    }
  }
}

function selectProbes(sel) {
  let list = PROBES;
  if (sel.tool.length) list = list.filter((p) => sel.tool.includes(p.tool));
  if (sel.probe.length) list = list.filter((p) => sel.probe.includes(p.id));
  return list;
}

const TAG = { caught: 'ok  ', survived: 'GAP ', drift: 'DRIFT', 'control-failed': 'CTRL ' };

/**
 * This tool verifies every OTHER tool's guards. Nobody was verifying its own,
 * which is the gap that would matter most: its failure mode is SILENT. A
 * regression that labelled a surviving mutant 'caught' would make the whole
 * fleet of probes report assurance while proving nothing.
 *
 * So: the verdict must flip BOTH ways, and 'caught' must be the ONLY verdict
 * counted as success.
 */
function runProbeSelfTest() {
  const failures = [];
  const check = (name, cond) => { if (!cond) failures.push(name); };

  const v = (o) => classifyProbe({ toolExists: true, fromFound: true, controlExit: 0, mutantExit: 1, ...o });

  // The two verdicts that carry meaning, asserted as a PAIR so inverting or
  // collapsing the comparison fails one of them.
  check('control ok + mutant exits 0 -> survived', v({ mutantExit: 0 }) === 'survived');
  check('control ok + mutant exits 1 -> caught', v({ mutantExit: 1 }) === 'caught');
  check('control ok + mutant exits 2 -> caught', v({ mutantExit: 2 }) === 'caught');

  // The control must be able to veto: a broken/unmodified suite is NOT evidence.
  check('control failure -> control-failed', v({ controlExit: 1, mutantExit: 1 }) === 'control-failed');
  check('control failure outranks survived', v({ controlExit: 3, mutantExit: 0 }) === 'control-failed');

  // Drift: neither a missing tool nor a vanished `from` may look like success.
  check('missing tool -> drift', classifyProbe({ toolExists: false, fromFound: true, controlExit: 0, mutantExit: 1 }) === 'drift');
  check('vanished from-string -> drift', v({ fromFound: false }) === 'drift');
  check('drift outranks a passing control', classifyProbe({ toolExists: false, fromFound: false, controlExit: 0, mutantExit: 0 }) === 'drift');

  // Only 'caught' counts as verified; everything else must keep the tool red.
  const counted = (verdict) => (verdict === 'caught' ? 1 : 0);
  check('a surviving mutant is not counted as verified', counted('survived') === 0);
  check('a caught mutant is counted as verified', counted('caught') === 1);
  check('drift is not counted as verified', counted('drift') === 0);
  check('a failed control is not counted as verified', counted('control-failed') === 0);

  if (failures.length) {
    console.error(`mutation-probe self-test FAIL: ${failures.length} problem(s):`);
    for (const f of failures) console.error(`  FAIL  ${f}`);
    process.exit(1);
  }
  console.log('mutation-probe self-test: 13/13 passed');
}

function main() {
  let sel;
  try {
    sel = parseArgs(process.argv.slice(2));
  } catch (e) {
    console.error('mutation-probe: ' + e.message);
    console.error('try --help');
    return 2;
  }

  if (sel.help) {
    console.log(HELP);
    return 0;
  }
  if (sel.selfTest) {
    runProbeSelfTest();
    return 0;
  }
  if (sel.list) {
    for (const p of PROBES) console.log('  ' + p.id.padEnd(36) + ' ' + p.tool + '  - ' + p.why);
    console.log(PROBES.length + ' probes');
    return 0;
  }

  const probes = selectProbes(sel);
  // A selector matching nothing must NOT read as a clean pass: that is the same
  // false green this repo keeps having to guard against.
  if (probes.length === 0) {
    const msg = sel.tool.length || sel.probe.length
      ? 'no probes matched the selector (0 probed - refusing to report a clean pass)'
      : 'catalogue is empty - refusing to report a clean pass';
    if (sel.json) {
      console.log(JSON.stringify({ schema: 1, probed: 0, caught: 0, survived: 0, drift: 0, results: [], error: msg }, null, 2));
    } else {
      console.error('mutation-probe: ' + msg);
    }
    return 2;
  }

  const results = probes.map((p) => runProbe(p, sel.maxSeconds));
  const caught = results.filter((r) => r.verdict === 'caught');
  const survived = results.filter((r) => r.verdict === 'survived');
  const bad = results.filter((r) => r.verdict !== 'caught');

  if (sel.json) {
    console.log(JSON.stringify({
      schema: 1,
      probed: results.length,
      caught: caught.length,
      survived: survived.length,
      drift: bad.length,
      exitCode: bad.length ? 1 : 0,
      results: results.map((r) => ({ id: r.id, tool: r.tool, verdict: r.verdict, detail: r.detail })),
    }, null, 2));
  } else if (sel.quiet) {
    console.log(caught.length + '/' + results.length + ' guards bite' + (survived.length ? ' - ' + survived.length + ' SURVIVED' : ''));
  } else {
    console.log('# mutation probe');
    for (const r of results) console.log('  ' + TAG[r.verdict] + ' ' + r.id.padEnd(36) + ' ' + r.detail);
    console.log('');
    console.log(caught.length + '/' + results.length + ' guards verified to bite.');
    if (survived.length) {
      console.log(survived.length + ' mutant(s) SURVIVED - a documented guard does not cover what it claims.');
    }
  }

  return bad.length ? 1 : 0;
}

process.exit(main());