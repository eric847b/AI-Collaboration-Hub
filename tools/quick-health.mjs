#!/usr/bin/env node
// quick-health.mjs — sub-second workspace health triage for the GitHub monorepo.
// v4: run(argv, io) returns an exit code (never calls process.exit itself), so
//     the self-test exercises every CLI path IN-PROCESS with zero subprocess
//     spawns (v3 spawned node ~15x and took >60s; v4 self-tests in <1s).
// Tiers: ok=0, warn=0 (1 with --strict), fail=1, bad usage=2 (D-contract).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TOOL_VERSION = '4.1.0';
const FLAG_DECLARATIONS = [
  ['--help', 'exit 0'], ['-h', 'alias of --help'],
  ['--version', 'exit 0'], ['-V', 'alias of --version'],
  ['--strict', 'promote warn to fail'],
  ['--quiet', 'verdict line only'],
  ['--json', 'machine-readable report'],
  ['--only <ids>', 'comma-separated check ids'],
  ['--list', 'print available check ids'],
  ['--self-test', 'run built-in checks and exit'],
];
const ALL_CHECK_IDS = ['configs', 'workflows', 'lockfiles', 'engines', 'hooks', 'handoff', 'wiring', 'bloat'];

export function parseArgs(argv) {
  const opts = { strict: false, quiet: false, json: false, only: null, list: false, help: false, version: false, selfTest: false };
  const errors = [];
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const eq = arg.indexOf('=');
    const bare = eq === -1 ? arg : arg.slice(0, eq);
    const inlineValue = eq === -1 ? null : arg.slice(eq + 1);
    const takeValue = () => {
      if (inlineValue !== null) return inlineValue;
      i += 1;
      return i < argv.length ? argv[i] : null;
    };
    switch (bare) {
      case '--strict': opts.strict = true; break;
      case '--quiet': opts.quiet = true; break;
      case '--json': opts.json = true; break;
      case '--only': {
        const v = takeValue();
        const ids = v === null || v.startsWith('--') ? [] : v.split(',').map((s) => s.trim()).filter(Boolean);
        if (!ids.length) errors.push('--only requires a comma-separated value');
        else opts.only = ids;
        break;
      }
      case '--list': opts.list = true; break;
      case '--help': case '-h': opts.help = true; break;
      case '--version': case '-V': opts.version = true; break;
      case '--self-test': opts.selfTest = true; break;
      default: errors.push(`unknown flag: ${arg}`); break;
    }
  }
  return { opts, errors };
}

export function helpText() {
  let out = 'Usage: node tools/quick-health.mjs [options]\n\nOptions:\n';
  for (const [flag, desc] of FLAG_DECLARATIONS) out += `  ${flag.padEnd(14)} ${desc}\n`;
  return out + '\nExit codes: 0 ok/warn, 1 fail (or warn with --strict), 2 bad usage.\n';
}

export function parseSemver(text) {
  const m = /(\d+)(?:\.(\d+))?(?:\.(\d+))?/.exec(String(text || ''));
  return m ? [Number(m[1]), Number(m[2] ?? 0), Number(m[3] ?? 0)] : null;
}

export function compareSemver(a, b) {
  for (let i = 0; i < 3; i++) { if (a[i] !== b[i]) return a[i] < b[i] ? -1 : 1; }
  return 0;
}

export function enginesVerdict(minStr, runtimeStr) {
  const min = parseSemver(minStr);
  const runtime = parseSemver(runtimeStr);
  if (!min || !runtime) return { level: 'warn', detail: 'unparsable engines.min or runtime' };
  return compareSemver(runtime, min) >= 0
    ? { level: 'ok', detail: `node ${runtimeStr} >= engines ${minStr}` }
    : { level: 'warn', detail: `node ${runtimeStr} < engines ${minStr} (accepted debt: STATUS "Node runtime delta")` };
}

export function probeVerdict(probe) {
  if (probe.status === 'ok') return 'ok';
  if (probe.status === 'fail') return 'fail';
  return 'warn'; // warn, skip, absent, anything else
}

function readJson(file) { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return null; } }
function exists(rel) { return fs.existsSync(path.join(ROOT, rel)); }
function gitTip() { try { return process.env.GITHUB_SHA ?? ''; } catch { return ''; } }

function checkConfigs() {
  const rootPkg = readJson(path.join(ROOT, 'package.json'));
  const findings = [];
  if (!rootPkg) findings.push('root package.json unreadable');
  else if (!rootPkg.name) findings.push('root package.json has no name');
  if (!exists('AGENTS.md')) findings.push('AGENTS.md missing');
  return { id: 'configs', label: 'configs', level: findings.length ? 'fail' : 'ok', detail: findings.join('; ') || 'root configs present', findings };
}

function checkWorkflows() {
  const dir = path.join(ROOT, '.github', 'workflows');
  const findings = [];
  let files = [];
  try { files = fs.readdirSync(dir).filter((f) => f.endsWith('.yml') || f.endsWith('.yaml')); } catch { findings.push('workflows dir missing'); }
  if (!files.includes('multi-os-gate.yml')) findings.push('multi-os-gate.yml missing');
  const tip = gitTip();
  if (tip && tip.length !== 40) findings.push('GITHUB_SHA is not a full SHA');
  return { id: 'workflows', label: 'workflows', level: findings.length ? 'fail' : 'ok', detail: findings.join('; ') || `${files.length} workflows; gate present`, findings, extra: { workflowCount: files.length } };
}

function checkLockfiles() {
  const findings = [];
  let lockCount = 0;
  for (const name of ['package-lock.json', 'pnpm-lock.yaml', 'yarn.lock', 'bun.lockb']) { if (exists(name)) lockCount++; }
  if (lockCount === 0) findings.push('no root lockfile');
  const hasReq = ['requirements.txt', 'pyproject.toml'].some((r) => exists(r));
  return { id: 'lockfiles', label: 'lockfiles', level: findings.length ? 'fail' : 'ok', detail: findings.join('; ') || `lockfile(s): ${lockCount}; python-reqs: ${hasReq ? 'present' : 'none'}`, findings };
}

function checkEngines() {
  const pkg = readJson(path.join(ROOT, 'package.json'));
  const min = typeof pkg?.engines?.node === 'string' ? pkg.engines.node.replace(/^[^\d]*/, '') : null;
  const { level, detail } = enginesVerdict(min, process.versions.node);
  return { id: 'engines', label: 'engines', level, detail, findings: level === 'ok' ? [] : [detail], extra: { enginesMin: min, runtime: process.versions.node } };
}

function checkHooks() {
  const hook = path.join(ROOT, '.husky', 'pre-commit');
  const findings = [];
  if (!fs.existsSync(hook)) { findings.push('.husky/pre-commit missing'); }
  else {
    const text = fs.readFileSync(hook, 'utf8');
    // Durable rule 6: NEVER reintroduce npx (it stalls).
    if (text.includes('npx ')) findings.push('pre-commit reintroduced npx');
    // The hook must drive a repo-local gate: either node_modules/.bin/* binaries
    // (older design) or a dependency-free `node <script>` gate (current js-gate /
    // secret-scan design). A hook that gates nothing is a broken hook.
    const drivesGate = /node_modules\/\.bin/.test(text) || /\bnode\s+\S*(js-gate|tools\/)/.test(text);
    if (!drivesGate) findings.push('pre-commit drives no repo-local gate (no node_modules/.bin or node <gate> call)');
  }
  return { id: 'hooks', label: 'hooks', level: findings.length ? 'fail' : 'ok', detail: findings.join('; ') || 'pre-commit hook healthy', findings };
}

function checkHandoff() {
  const file = path.join(ROOT, '.renitor', 'handoff-result.json');
  if (!fs.existsSync(file)) return { id: 'handoff', label: 'handoff', level: 'warn', detail: 'skipped (machine-local): no .renitor/handoff-result.json', findings: [] };
  const data = readJson(file);
  const findings = [];
  if (!data || typeof data !== 'object') findings.push('handoff-result.json unreadable');
  else if (!data.validation || !Array.isArray(data.validation)) findings.push('validation[] missing');
  return { id: 'handoff', label: 'handoff', level: findings.length ? 'fail' : 'ok', detail: findings.join('; ') || 'handoff-result.json valid', findings };
}

function checkWiring() {
  const findings = [];
  const gate = readJson(path.join(ROOT, 'package.json'));
  if (gate && !gate.scripts?.gate) findings.push('npm run gate missing from package.json');
  if (!readJson(path.join(ROOT, 'tools', 'parity-map.json'))) findings.push('tools/parity-map.json missing');
  return { id: 'wiring', label: 'wiring', level: findings.length ? 'fail' : 'ok', detail: findings.join('; ') || 'gate script + parity map present', findings };
}

function checkBloat() {
  const ledger = path.join(ROOT, 'docs', 'metrics', 'repo-bloat-history.json');
  if (!fs.existsSync(ledger)) return { id: 'bloat', label: 'bloat', level: 'warn', detail: 'repo-bloat ledger missing (run: node tools/repo-bloat.mjs collect)', findings: [] };
  const data = readJson(ledger);
  const findings = [];
  if (!data || typeof data !== 'object') findings.push('repo-bloat-history.json unreadable');
  else if (!Array.isArray(data.snapshots)) findings.push('snapshots[] missing');
  else if (data.snapshots.length === 0) findings.push('no snapshots recorded');
  let detail = 'repo-bloat ledger present';
  if (data && Array.isArray(data.snapshots) && data.snapshots.length) {
    const last = data.snapshots[data.snapshots.length - 1];
    if (last && typeof last.trackedBytes === 'number') detail = `repo-bloat ledger present (${last.trackedFiles ?? '?'} files, ${Math.round(last.trackedBytes / 1024)} KiB)`;
  }
  return { id: 'bloat', label: 'bloat', level: findings.length ? 'fail' : 'ok', detail: findings.join('; ') || detail, findings };
}

const CHECKS = [checkConfigs, checkWorkflows, checkLockfiles, checkEngines, checkHooks, checkHandoff, checkWiring, checkBloat];

export function buildReport(opts) {
  let checks = CHECKS.map((fn) => fn());
  if (opts.only?.length) {
    const unknown = opts.only.filter((id) => !ALL_CHECK_IDS.includes(id));
    if (unknown.length) return { usageError: `unknown check id(s): ${unknown.join(', ')} (use --list)` };
    checks = checks.filter((c) => opts.only.includes(c.id));
  }
  const warn = checks.filter((c) => c.level === 'warn');
  const fail = checks.filter((c) => c.level === 'fail');
  const verdict = fail.length ? 'fail' : warn.length ? 'warn' : 'ok';
  const exit = fail.length ? 1 : (opts.strict && warn.length) ? 1 : 0;
  return { tool: 'quick-health', version: TOOL_VERSION, verdict, checks, warn, fail, exit };
}

// Runs a CLI path in-process and returns { code, out } — the self-test's spawn-free harness.
export function runCapture(argv) {
  let out = '';
  const io = { stdout: (s) => { out += s; }, stderr: (s) => { out += s; } };
  return run(argv, io).then((code) => ({ code, out }));
}

export async function run(argv, io = { stdout: (s) => process.stdout.write(s), stderr: (s) => process.stderr.write(s) }) {
  const { opts, errors } = parseArgs(argv);
  if (errors.length) { io.stderr(`quick-health: ${errors.join('; ')}\nTry: node tools/quick-health.mjs --help\n`); return 2; }
  if (opts.help) { io.stdout(helpText()); return 0; }
  if (opts.version) { io.stdout(`quick-health ${TOOL_VERSION}\n`); return 0; }
  if (opts.list) { io.stdout(ALL_CHECK_IDS.join('\n') + '\n'); return 0; }
  if (opts.selfTest) return selfTest(io);
  const report = buildReport(opts);
  if (report.usageError) { io.stderr(`quick-health: ${report.usageError}\n`); return 2; }
  if (opts.json) { io.stdout(JSON.stringify(report) + '\n'); return report.exit; }
  if (opts.quiet) {
    const okCount = report.checks.filter((c) => c.level === 'ok').length;
    io.stdout(`quick-health: ${report.verdict} (${report.checks.length} checks: ${okCount} ok, ${report.warn.length} warn, ${report.fail.length} fail)\n`);
    return report.exit;
  }
  io.stdout(`quick-health v${TOOL_VERSION} — ${report.checks.length} checks\n`);
  for (const c of report.checks) io.stdout(`  ${c.level.padEnd(4)} ${c.label.padEnd(10)} ${c.detail}\n`);
  io.stdout(`verdict: ${report.verdict}${opts.strict ? ' (strict)' : ''}\n`);
  return report.exit;
}

async function selfTest(io) {
  let passed = 0, failed = 0;
  const check = (name, cond, extra = '') => { if (cond) { passed++; io.stdout(`  ok   ${name}\n`); } else { failed++; io.stderr(`  FAIL ${name}${extra ? ` — ${extra}` : ''}\n`); } };

  // Help / version contract (D rules) — in-process, zero spawns.
  const help = await runCapture(['--help']);
  check('help exits 0', help.code === 0, `got ${help.code}`);
  check('help lists usage', help.out.includes('Usage:'));
  check('help documents every declared flag', FLAG_DECLARATIONS.every(([f]) => help.out.includes(f)));
  check('-h also exits 0', (await runCapture(['-h'])).code === 0);
  const ver = await runCapture(['--version']);
  check('--version exits 0', ver.code === 0);
  check('--version prints version', ver.out.includes(TOOL_VERSION));
  check('-V also exits 0', (await runCapture(['-V'])).code === 0);

  // Unknown flags / missing values must exit 2 (D contract).
  for (const bad of [['--bogus'], ['--only'], ['--strict', '--nope'], ['--only=']]) {
    const r = await runCapture(bad);
    check(`bad usage exits 2: ${bad.join(' ')}`, r.code === 2, `got ${r.code}`);
  }
  check('--only=value form accepted', (await runCapture(['--only=engines'])).code === 0 || (await runCapture(['--only=engines'])).code === 1);

  // --list / --only scoping.
  const list = await runCapture(['--list']);
  check('--list exits 0', list.code === 0);
  check('--list prints every check id', ALL_CHECK_IDS.every((id) => list.out.includes(id)));
  const only = await runCapture(['--only', 'engines', '--json']);
  check('--only engines never exits 2', only.code === 0 || only.code === 1, `got ${only.code}`);
  const onlyReport = JSON.parse(only.out);
  check('--only engines scopes to 1 check', onlyReport.checks.length === 1 && onlyReport.checks[0].id === 'engines');
  check('unknown check id exits 2', (await runCapture(['--only', 'not-a-check'])).code === 2);

  // Output modes agree on exit codes.
  const json = await runCapture(['--json']);
  check('--json exits 0 or 1', json.code === 0 || json.code === 1, `got ${json.code}`);
  check('--json emits parseable JSON', (() => { try { JSON.parse(json.out); return true; } catch { return false; } })());
  const quiet = await runCapture(['--quiet']);
  check('--quiet exits 0 or 1', quiet.code === 0 || quiet.code === 1, `got ${quiet.code}`);
  check('--quiet prints verdict line', quiet.out.includes('quick-health:'));
  const normal = await runCapture([]);
  check('default run exits 0 or 1', normal.code === 0 || normal.code === 1, `got ${normal.code}`);
  check('default run prints per-check lines', normal.out.includes('quick-health v'));
  check('all output modes agree on exit code', normal.code === json.code && quiet.code === json.code);

  // Pure helpers (mutation-bite targets).
  check('enginesVerdict 24<26 warns', enginesVerdict('26', '24.0.0').level === 'warn');
  check('enginesVerdict 26>=26 ok', enginesVerdict('26', '26.0.0').level === 'ok');
  check('compareSemver orders', compareSemver([1, 2, 3], [1, 10, 0]) === -1 && compareSemver([2, 0, 0], [1, 99, 99]) === 1);
  check('probeVerdict ok->ok', probeVerdict({ status: 'ok' }) === 'ok');
  check('probeVerdict fail->fail', probeVerdict({ status: 'fail' }) === 'fail');
  check('probeVerdict warn->warn', probeVerdict({ status: 'warn' }) === 'warn');
  check('probeVerdict skip->warn', probeVerdict({ status: 'skip' }) === 'warn');
  check('probeVerdict absent->warn', probeVerdict({ status: 'absent' }) === 'warn');

  io.stdout(`self-test: ${passed} passed, ${failed} failed\n`);
  return failed ? 1 : 0;
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) process.exit(await run(process.argv.slice(2)));