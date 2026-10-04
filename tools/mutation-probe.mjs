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
const BOOL_FLAGS = new Set(['--json', '--quiet', '--help', '--list-probes']);

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
    json: false, quiet: false, help: false, list: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (BOOL_FLAGS.has(a)) {
      if (a === '--help') out.help = true;
      else if (a === '--json') out.json = true;
      else if (a === '--quiet') out.quiet = true;
      else out.list = true;
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
/** Run one probe. Never mutates the original: copies live beside it and go. */
function runProbe(probe, maxSeconds) {
  const src = path.join(TOOLS_DIR, probe.tool);
  if (!fs.existsSync(src)) {
    return { ...probe, verdict: 'drift', detail: 'tool not found: ' + probe.tool, control: null, mutant: null };
  }
  // Beside the tool, NOT in tools/.tmp: these tools resolve repo-relative paths
  // (workflows, the CI pattern list) against their own directory, so a copy
  // elsewhere fails for reasons unrelated to the mutation.
  const dir = path.dirname(src);
  const base = path.basename(src);
  const controlFile = path.join(dir, '.mutation-probe-control-' + base);
  const mutantFile = path.join(dir, '.mutation-probe-' + probe.id + '-' + base);
  const original = fs.readFileSync(src, 'utf8');

  try {
    if (!original.includes(probe.from)) {
      // A rename must not silently neuter a probe into a no-op that always passes.
      return {
        ...probe,
        verdict: 'drift',
        detail: 'mutation target not found in ' + probe.tool + ' - the probe drifted',
        control: null,
        mutant: null,
      };
    }

    fs.writeFileSync(controlFile, original, 'utf8');
    const control = runSelfTest(controlFile, maxSeconds);
    if (control.exit !== 0) {
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
    if (mutant.exit === 0) {
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