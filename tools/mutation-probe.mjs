#!/usr/bin/env node
/**
 * Mutation Probe Tool v5
 *
 * Proves a tool's OWN self-test guards actually bite:
 * runs the target's --self-test twice — once UNMODIFIED (control, must exit 0)
 * and once with one declared mutation applied (must exit non-zero), then restores
 * the original in a finally block. A mutant that still exits 0 means a documented
 * guard does not really cover the risk it claims to.
 *
 * Exit codes:
 *   0  every probe caught its mutant and every control passed
 *   1  a mutant survived, a control failed, or a probe drifted (from-string gone)
 *   2  bad usage, or a selector that matched no probe (never a clean pass)
 *
 * Usage:
 *   node tools/mutation-probe.mjs [options]
 *
 * Options:
 *   --help              print this text and exit 0
 *   -h                  alias of --help
 *   --version           print version and exit 0
 *   -V                  alias of --version
 *   --tool <t>[,t]      tool name(s) to probe (basename with extension)
 *   --probe <id>[,id]   probe ID(s) to run
 *   --max-seconds <n>   max seconds per self-test run (default 120)
 *   --json              machine-readable JSON report
 *   --quiet             print only the one-line verdict
 *   --list-probes       list available probes and exit 0
 *   --self-test         assert this tool's own verdict logic; exit 0/1
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TOOLS_DIR = path.join(ROOT, 'tools');
const TOOL_VERSION = '5.0.0';
const DEFAULT_MAX_SECONDS = 120;

const FLAG_DECLARATIONS = [
  ['--help', 'print this text and exit 0'],
  ['-h', 'alias of --help'],
  ['--version', 'print version and exit 0'],
  ['-V', 'alias of --version'],
  ['--tool <t>[,t]', 'tool name(s) to probe (basename with extension)'],
  ['--probe <id>[,id]', 'probe ID(s) to run'],
  ['--max-seconds <n>', 'max seconds per self-test run (default 120)'],
  ['--json', 'machine-readable JSON report'],
  ['--quiet', 'print only the one-line verdict'],
  ['--list-probes', 'list available probes and exit 0'],
  ['--self-test', "assert this tool's own verdict logic; exit 0/1"],
];

const valueFlags = new Set(['--tool', '--probe', '--max-seconds']);
const booleanFlags = new Set([
  '--help', '-h', '--version', '-V', '--json', '--quiet', '--list-probes', '--self-test',
]);

function parseArgs(argv) {
  const options = new Map();
  for (let i = 0; i < argv.length; i += 1) {
    const raw = argv[i];
    const equalsAt = raw.indexOf('=');
    const option = equalsAt < 0 ? raw : raw.slice(0, equalsAt);
    const normalized =
      option === '-h' ? '--help' : option === '-V' ? '--version' : option;
    if (valueFlags.has(normalized)) {
      const value = equalsAt < 0 ? argv[++i] : raw.slice(equalsAt + 1);
      if (!value || value.startsWith('-')) {
        console.error(`Error: ${normalized} requires a value`);
        return { ok: false, code: 2 };
      }
      options.set(normalized, value);
    } else if (booleanFlags.has(normalized) && equalsAt < 0) {
      options.set(normalized, true);
    } else {
      console.error(`Error: unknown option "${option}"`);
      return { ok: false, code: 2 };
    }
  }
  return { ok: true, options };
}

function splitList(value) {
  return String(value || '')
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function runTool(toolPath, toolArgs, timeoutMs) {
  const fullPath = path.resolve(TOOLS_DIR, toolPath);
  try {
    const result = execFileSync(process.execPath, [fullPath, ...toolArgs], {
      maxBuffer: 1024 * 1024,
      encoding: 'utf8',
      timeout: timeoutMs,
    });
    return { ok: true, exitCode: 0, out: result.trim() };
  } catch (e) {
    const out = ((e.stdout || '') + (e.stderr || '')).trim();
    const exitCode = e.status !== undefined ? e.status : 1;
    return { ok: false, exitCode, out };
  }
}

// ---------------------------------------------------------------------------
// Catalogue: concrete probes against real tools with self-tests.
//
// Each from-string is taken verbatim from the target's live source so a probe
// reports `drift` (not a silent pass) the moment that string disappears.
// ---------------------------------------------------------------------------

const PROBE_MUTATIONS = [
  {
    id: 'verify-tools-exit-code',
    tool: 'verify-tools.mjs',
    mutations: [
      {
        from: "check('fail exits 1', exitCodeFor({ failed: 1, warned: 0 }), 1);",
        to: "check('fail exits 1', exitCodeFor({ failed: 1, warned: 0 }), 0);",
        why: 'exit-code assertion expects 0 for a failing run, weakening the guard',
      },
    ],
  },
  {
    id: 'secret-scan-exit-code',
    tool: 'secret-scan.mjs',
    mutations: [
      {
        from: "    'openai-legacy': `sk-${'A1b2C3d4'.repeat(6)}`,",
        to: "    'openai-legacy': 'nope-not-a-secret-at-all',",
        why: 'a sample secret no longer matches its detector, so the no-miss guard must fire',
      },
    ],
  },
  {
    id: 'workflow-audit-exit-code',
    tool: 'workflow-audit.mjs',
    mutations: [
      {
        from: "if (documented.join(',') !== implemented.join(',')) {",
        to: "if (documented.join(',') !== implemented.join(';')) {",
        why: 'rule/implementation agreement check always reports a mismatch, weakening the guard',
      },
    ],
  },
  {
    id: 'check-flag-contract-exit-code',
    tool: 'check-flag-contract.mjs',
    mutations: [
      {
        from: "check('clean tool declares one flag', r1.owner.size, 1);",
        to: "check('clean tool declares one flag', r1.owner.size, 2);",
        why: 'flag-count assertion expects 2 flags for a clean single-flag tool, weakening the guard',
      },
    ],
  },
  {
    id: 'quick-health-exit-code',
    tool: 'quick-health.mjs',
    mutations: [
      {
        from: "check('enginesVerdict 24<26 warns', enginesVerdict('26', '24.0.0').level === 'warn');",
        to: "check('enginesVerdict 24<26 warns', enginesVerdict('26', '24.0.0').level === 'ok');",
        why: 'engines verdict assertion expects ok for a 24<26 warn, weakening the guard',
      },
    ],
  },
];

function toolExists(tool) {
  return fs.existsSync(path.resolve(TOOLS_DIR, tool));
}

function buildCatalogue() {
  return PROBE_MUTATIONS.filter((p) => toolExists(p.tool));
}

function selectCatalogue(catalogue, toolArg, probeArg) {
  let selected = catalogue;
  if (toolArg) {
    const wanted = new Set(splitList(toolArg));
    selected = selected.filter((p) => wanted.has(p.tool));
  }
  if (probeArg) {
    const wanted = new Set(splitList(probeArg));
    selected = selected.filter((p) => wanted.has(p.id));
  }
  return selected;
}

// ---------------------------------------------------------------------------
// Mutation application / restoration (original always restored in finally)
// ---------------------------------------------------------------------------

function applyMutationTo(toolPath, from, to) {
  const fullPath = path.resolve(TOOLS_DIR, toolPath);
  const src = fs.readFileSync(fullPath, 'utf8');
  if (!src.includes(from)) {
    throw new Error('from-string gone for ' + JSON.stringify(from));
  }
  const mutated = src.replace(from, to);
  if (mutated === src) {
    throw new Error('mutation produced no change for ' + JSON.stringify(from));
  }
  const backup = fullPath + '.mutation-probe-backup-' + process.pid + '.bak';
  fs.writeFileSync(backup, src, 'utf8');
  fs.writeFileSync(fullPath, mutated, 'utf8');
  return backup;
}

function runProbe(probe, timeoutMs) {
  const results = [];
  const fullPath = path.resolve(TOOLS_DIR, probe.tool);
  const originalSrc = fs.readFileSync(fullPath, 'utf8');

  // Control: unmodified --self-test must exit 0.
  const control = runTool(probe.tool, ['--self-test'], timeoutMs);
  const controlPass = control.exitCode === 0;

  for (const m of probe.mutations) {
    let backup = null;
    try {
      backup = applyMutationTo(probe.tool, m.from, m.to);
      const r = runTool(probe.tool, ['--self-test'], timeoutMs);
      results.push({
        id: probe.id,
        tool: probe.tool,
        from: m.from,
        to: m.to,
        why: m.why,
        caught: r.exitCode !== 0,
        out: r.out,
      });
    } catch (e) {
      results.push({
        id: probe.id,
        tool: probe.tool,
        from: m.from,
        to: m.to,
        why: m.why,
        caught: false,
        drift: true,
        out: e.message,
      });
    } finally {
      // Always restore from the ground-truth snapshot captured before any
      // mutation; the backup file is secondary and removed either way.
      try { fs.writeFileSync(fullPath, originalSrc, 'utf8'); } catch {}
      try { if (backup && fs.existsSync(backup)) fs.unlinkSync(backup); } catch {}
    }
  }

  return { tool: probe.tool, controlPass, controlOut: control.out, mutants: results };
}

// ---------------------------------------------------------------------------
// Self-test: prove THIS tool's own verdict logic using synthetic fixtures
// ---------------------------------------------------------------------------

const SELFTEST_DIR = path.join(TOOLS_DIR, '.tmp', 'mutation-probe-selftest');

function writeSelfTestFixture(name, src) {
  fs.mkdirSync(SELFTEST_DIR, { recursive: true });
  const fullPath = path.join(SELFTEST_DIR, name);
  fs.writeFileSync(fullPath, src, 'utf8');
  return name;
}

const FAIL_FIXTURE = `#!/usr/bin/env node
process.exit(1);
`;

function runSelfTest() {
  const failures = [];
  const check = (cond, msg) => {
    if (!cond) failures.push(msg);
  };

  // Clean slate
  if (fs.existsSync(SELFTEST_DIR)) fs.rmSync(SELFTEST_DIR, { recursive: true, force: true });
  fs.mkdirSync(SELFTEST_DIR, { recursive: true });

  const timeoutMs = DEFAULT_MAX_SECONDS * 1000;

  // Fixture whose self-test passes normally and fails under mutation -> CAUGHT.
  const caughtSrc = `#!/usr/bin/env node
const code = 0;
process.exit(code);
`;
  writeSelfTestFixture('probe-caught.mjs', caughtSrc);
  const caught = runProbe(
    { id: 'st-caught', tool: '.tmp/mutation-probe-selftest/probe-caught.mjs', mutations: [{ from: 'process.exit(code);', to: 'process.exit(1);', why: 'exit 0 -> 1' }] },
    timeoutMs
  );
  check(caught.controlPass === true, 'self-test control should pass');
  check(caught.mutants.length === 1 && caught.mutants[0].caught === true, 'self-test mutant should be CAUGHT');

  // No-op mutation (from == to) produces no change -> drift, not a clean pass.
  const noopSrc = `#!/usr/bin/env node
process.exit(0);
`;
  writeSelfTestFixture('probe-noop.mjs', noopSrc);
  const noop = runProbe(
    { id: 'st-noop', tool: '.tmp/mutation-probe-selftest/probe-noop.mjs', mutations: [{ from: 'process.exit(0);', to: 'process.exit(0);', why: 'no-op mutation' }] },
    timeoutMs
  );
  check(noop.mutants.length === 1 && noop.mutants[0].drift === true, 'self-test no-op mutation should report drift');

  // Fixture whose from-string is absent -> drift.
  const driftSrc = `#!/usr/bin/env node
process.exit(0);
`;
  writeSelfTestFixture('probe-drift.mjs', driftSrc);
  const drift = runProbe(
    { id: 'st-drift', tool: '.tmp/mutation-probe-selftest/probe-drift.mjs', mutations: [{ from: 'no-such-string-here', to: 'x', why: 'absent from-string' }] },
    timeoutMs
  );
  check(drift.mutants.length === 1 && drift.mutants[0].drift === true, 'self-test absent from-string should report drift');

  // Control failure: fixture whose self-test already fails -> controlPass=false.
  writeSelfTestFixture('probe-badcontrol.mjs', FAIL_FIXTURE);
  const badControl = runProbe(
    { id: 'st-badcontrol', tool: '.tmp/mutation-probe-selftest/probe-badcontrol.mjs', mutations: [] },
    timeoutMs
  );
  check(badControl.controlPass === false, 'self-test failing control should be controlPass=false');

  // Cleanup synthetic fixtures
  try { fs.rmSync(SELFTEST_DIR, { recursive: true, force: true }); } catch {}

  if (failures.length > 0) {
    console.error('mutation-probe v5 self-test FAIL:');
    for (const f of failures) console.error(`  FAIL  ${f}`);
    return 1;
  }
  console.log('mutation-probe v5 self-test: verdict logic OK');
  return 0;
}

function printHelp() {
  const lines = [
    `mutation-probe v${TOOL_VERSION} — prove a tool's own self-test guards actually bite`,
    '',
    'Usage:',
    '  node tools/mutation-probe.mjs [options]',
    '',
    'Options:',
  ];
  for (const [flag, desc] of FLAG_DECLARATIONS) {
    lines.push(`  ${flag.padEnd(30)} ${desc}`);
  }
  lines.push('', 'Exit codes:', '  0  every probe caught its mutant and every control passed', '  1  a mutant survived, a control failed, or a probe drifted', '  2  bad usage, or a selector that matched no probe (never a clean pass)');
  console.log(lines.join('\n'));
}

function listProbes(catalogue) {
  if (catalogue.length === 0) {
    console.log('No probes available');
    return;
  }
  for (const p of catalogue) {
    const tag = p.mutations.length > 0 ? 'READY' : 'NO_MUTATIONS';
    console.log(`${tag}  ${p.id}  (${p.tool})`);
    for (const m of p.mutations) {
      console.log(`       ${JSON.stringify(m.from)} -> ${JSON.stringify(m.to)}  (${m.why})`);
    }
  }
}

function runCatalogue(catalogue, toolArg, probeArg, { json, quiet, timeoutMs }) {
  const selected = selectCatalogue(catalogue, toolArg, probeArg);
  if (selected.length === 0) {
    const selector = toolArg || probeArg || '';
    console.error(`FAIL: no probes matched the selector: ${selector}`);
    return { code: 2, allPassed: false, results: [] };
  }

  const results = [];
  let allPassed = true;

  for (const probe of selected) {
    const res = runProbe(probe, timeoutMs);
    const ok = res.controlPass && res.mutants.every((m) => !m.drift && m.caught);
    if (!ok) allPassed = false;
    results.push(res);
    if (!quiet) {
      console.log((res.controlPass ? 'OK  ' : 'FAIL') + ' ' + res.tool);
      for (const m of res.mutants) {
        if (m.drift) {
          console.log(`       DRIFT  ${JSON.stringify(m.from)} -> ${JSON.stringify(m.to)}  (${m.out})`);
        } else {
          console.log(`       ${m.caught ? 'CAUGHT' : 'SURVIVED'}  ${JSON.stringify(m.from)} -> ${JSON.stringify(m.to)}  (${m.why})`);
        }
      }
    }
  }

  if (json) {
    console.log(
      JSON.stringify(
        {
          version: TOOL_VERSION,
          allPassed,
          probes: results.map((r) => ({
            tool: r.tool,
            controlPass: r.controlPass,
            mutants: r.mutants.map((m) => ({
              from: m.from,
              to: m.to,
              why: m.why,
              caught: m.caught,
              drift: !!m.drift,
            })),
          })),
        },
        null,
        2
      )
    );
  }

  if (quiet || json) {
    console.log(`mutation-probe v${TOOL_VERSION}: ${allPassed ? 'all probes caught their mutants' : 'some probes failed'}`);
  }

  return { code: allPassed ? 0 : 1, allPassed, results };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main(argv) {
  const parsed = parseArgs(argv);
  if (!parsed.ok) return parsed.code;
  const options = parsed.options;

  if (options.has('--help')) {
    printHelp();
    return 0;
  }

  if (options.has('--version')) {
    console.log(`mutation-probe ${TOOL_VERSION}`);
    return 0;
  }

  if (options.has('--list-probes')) {
    listProbes(buildCatalogue());
    return 0;
  }

  if (options.has('--self-test')) {
    return runSelfTest();
  }

  const timeoutMs = (Number(options.get('--max-seconds')) || DEFAULT_MAX_SECONDS) * 1000;
  return runCatalogue(buildCatalogue(), options.get('--tool'), options.get('--probe'), {
    json: options.has('--json'),
    quiet: options.has('--quiet'),
    timeoutMs,
  }).code;
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) process.exit(main(process.argv.slice(2)));

