#!/usr/bin/env node
// quick-health.mjs — sub-second workspace health triage for the GitHub monorepo.
// v4: run(argv, io) returns an exit code (never calls process.exit itself), so
//     the self-test exercises every CLI path IN-PROCESS with zero subprocess
//     spawns (v3 spawned node ~15x and took >60s; v4 self-tests in <1s).
// Tiers: ok=0, warn=0 (1 with --strict), fail=1, bad usage=2 (D-contract).
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TOOL_VERSION = '4.23.0';
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
const SUGGESTIONS = {
  configs: 'npm run gate',
  workflows: 'actionlint .github/workflows/*.yml',
  lockfiles: 'npm install (regenerate lockfiles)',
  engines: 'install Node >=26 (see .nvmrc)',
  hooks: 'restore .husky/pre-commit',
  handoff: 'write .renitor/handoff-result.json',
  handoffmd: 'regenerate .renitor/current-handoff.md',
  wiring: 'restore tools/workspace-gate.ps1 + parity map',
  bloat: 'node tools/repo-bloat.mjs collect',
  stray: 'remove stray dotfiles in tools/',
  dashboard: 'node tools/ops-dashboard.mjs',
  tmpfiles: 'rm -rf tools/.tmp',
  nodemodules: 'npm install',
  roadmap: 'restore docs/ROADMAP.md (## 2. Open Work)',
  status: 'regenerate docs/STATUS.md',
  verifytools: 'restore tools/verify-tools.mjs',
  agentsmd: 'restore AGENTS.md',
  gitclean: 'git add/commit or stash',
  branch: 'git checkout a feature branch',
  gitremote: 'git remote add origin <url>',
  gitignore: 'add node_modules/.env to .gitignore',
  rootpkg: 'fix root package.json',
  readme: 'add README.md',
  license: 'add a LICENSE file',
  changelog: 'add CHANGELOG.md',
  contributing: 'add CONTRIBUTING.md',
  devcontainer: 'add .devcontainer/ config',
};
const ALL_CHECK_IDS = ['configs', 'workflows', 'lockfiles', 'engines', 'hooks', 'handoff', 'handoffmd', 'wiring', 'bloat', 'stray', 'dashboard', 'tmpfiles', 'nodemodules', 'roadmap', 'status', 'verifytools', 'agentsmd', 'gitclean', 'branch', 'gitremote', 'gitignore', 'rootpkg', 'readme', 'license', 'changelog', 'contributing', 'devcontainer'];

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

function checkStray() {
  const dir = path.join(ROOT, 'tools');
  const stray = [];
  try {
    for (const f of fs.readdirSync(dir)) {
      if (f.startsWith('.') && /\.(mjs|cjs|ps1|json)$/.test(f)) stray.push(f);
    }
  } catch (e) {
    return { id: 'stray', label: 'stray', level: 'warn', detail: `tools/ unreadable: ${e.message}`, findings: [e.message] };
  }
  if (stray.length === 0) return { id: 'stray', label: 'stray', level: 'ok', detail: 'no stray dotfiles in tools/', findings: [] };


  return { id: 'stray', label: 'stray', level: 'warn', detail: `${stray.length} stray dotfile(s) in tools/ (${stray.slice(0, 3).join(', ')}${stray.length > 3 ? ', ...' : ''})`, findings: stray };
}

function checkHandoffMd() {
  const file = path.join(ROOT, '.renitor', 'current-handoff.md');
  if (!fs.existsSync(file)) return { id: 'handoffmd', label: 'handoffmd', level: 'warn', detail: '.renitor/current-handoff.md missing', findings: [] };
  const raw = fs.readFileSync(file, 'utf8');
  if (raw.length < 50) return { id: 'handoffmd', label: 'handoffmd', level: 'warn', detail: 'current-handoff.md suspiciously short', findings: [] };
  return { id: 'handoffmd', label: 'handoffmd', level: 'ok', detail: 'current-handoff.md present', findings: [] };
}

function checkAgentsMd() {
  const file = path.join(ROOT, 'AGENTS.md');
  if (!fs.existsSync(file)) return { id: 'agentsmd', label: 'agentsmd', level: 'warn', detail: 'AGENTS.md missing', findings: [] };
  const raw = fs.readFileSync(file, 'utf8');
  if (raw.length < 100) return { id: 'agentsmd', label: 'agentsmd', level: 'warn', detail: 'AGENTS.md suspiciously short', findings: [] };
  return { id: 'agentsmd', label: 'agentsmd', level: 'ok', detail: 'AGENTS.md present', findings: [] };
}

function checkVerifyTools() {
  const file = path.join(ROOT, 'tools', 'verify-tools.mjs');
  if (!fs.existsSync(file)) return { id: 'verifytools', label: 'verifytools', level: 'warn', detail: 'tools/verify-tools.mjs missing', findings: [] };
  return { id: 'verifytools', label: 'verifytools', level: 'ok', detail: 'verify-tools.mjs present', findings: [] };
}

function checkStatus() {
  const file = path.join(ROOT, 'docs', 'STATUS.md');
  if (!fs.existsSync(file)) return { id: 'status', label: 'status', level: 'warn', detail: 'docs/STATUS.md missing', findings: [] };
  const raw = fs.readFileSync(file, 'utf8');
  if (raw.length < 100) return { id: 'status', label: 'status', level: 'warn', detail: 'STATUS.md suspiciously short', findings: [] };
  return { id: 'status', label: 'status', level: 'ok', detail: 'STATUS.md present', findings: [] };
}

function checkRoadmap() {
  const file = path.join(ROOT, 'docs', 'ROADMAP.md');
  if (!fs.existsSync(file)) return { id: 'roadmap', label: 'roadmap', level: 'warn', detail: 'docs/ROADMAP.md missing', findings: [] };
  const raw = fs.readFileSync(file, 'utf8');
  if (!raw.includes('## 2. Open Work')) return { id: 'roadmap', label: 'roadmap', level: 'warn', detail: 'ROADMAP.md lacks open-work section', findings: [] };
  return { id: 'roadmap', label: 'roadmap', level: 'ok', detail: 'ROADMAP.md present', findings: [] };
}

function checkNodeModules() {
  const dir = path.join(ROOT, 'node_modules');
  if (!fs.existsSync(dir)) return { id: 'nodemodules', label: 'nodemodules', level: 'warn', detail: 'node_modules missing (run: npm install)', findings: [] };
  const pkg = path.join(dir, '.package-lock.json');
  return { id: 'nodemodules', label: 'nodemodules', level: 'ok', detail: 'node_modules present', findings: [] };
}

function checkTmpFiles() {
  const dir = path.join(ROOT, 'tools', '.tmp');
  if (!fs.existsSync(dir)) return { id: 'tmpfiles', label: 'tmpfiles', level: 'ok', detail: 'no tools/.tmp directory', findings: [] };
  const files = [];
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else files.push(path.relative(ROOT, p));
    }
  };
  try { walk(dir); } catch (e) { return { id: 'tmpfiles', label: 'tmpfiles', level: 'warn', detail: `tools/.tmp unreadable: ${e.message}`, findings: [e.message] }; }
  if (files.length === 0) return { id: 'tmpfiles', label: 'tmpfiles', level: 'ok', detail: 'tools/.tmp empty', findings: [] };
  return { id: 'tmpfiles', label: 'tmpfiles', level: 'warn', detail: `${files.length} file(s) in tools/.tmp (${files.slice(0, 2).join(', ')}${files.length > 2 ? ', ...' : ''})`, findings: files };
}

function checkDashboard() {
  const file = path.join(ROOT, 'docs', 'metrics', 'OPS-DASHBOARD.md');
  if (!fs.existsSync(file)) return { id: 'dashboard', label: 'dashboard', level: 'warn', detail: 'OPS-DASHBOARD.md missing (run: node tools/ops-dashboard.mjs)', findings: [] };
  const raw = fs.readFileSync(file, 'utf8');
  if (!raw.includes('<!-- ops-section:')) return { id: 'dashboard', label: 'dashboard', level: 'warn', detail: 'OPS-DASHBOARD.md lacks section markers (regenerate)', findings: [] };
  const stamps = [...raw.matchAll(/<!-- ops-section:[a-z-]+ ts:([^ ]+) -->/g)].map((m) => m[1]);
  return { id: 'dashboard', label: 'dashboard', level: 'ok', detail: `OPS-DASHBOARD.md present (${stamps.length} sections)`, findings: [] };
}

function checkGitClean() {
  let out = '';
  try {
    out = execFileSync('git', ['status', '--porcelain'], { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  } catch (e) {
    return { id: 'gitclean', label: 'gitclean', level: 'warn', detail: 'git status unavailable', findings: [] };
  }
  const lines = out.split(/\r?\n/).filter(Boolean);
  if (lines.length === 0) return { id: 'gitclean', label: 'gitclean', level: 'ok', detail: 'working tree clean', findings: [] };
  return { id: 'gitclean', label: 'gitclean', level: 'warn', detail: lines.length + ' uncommitted change(s)', findings: lines.slice(0, 10) };
}

function checkBranch() {
  let branch = '';
  let detached = false;
  try {
    branch = execFileSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    if (branch === 'HEAD') detached = true;
  } catch (e) {
    return { id: 'branch', label: 'branch', level: 'warn', detail: 'git branch unavailable', findings: [] };
  }
  if (detached) return { id: 'branch', label: 'branch', level: 'warn', detail: 'detached HEAD', findings: [] };
  const findings = [];
  if (branch === 'main' || branch === 'master') findings.push('on default branch (' + branch + ')');
  return { id: 'branch', label: 'branch', level: findings.length ? 'warn' : 'ok', detail: branch + (findings.length ? ' — ' + findings.join('; ') : ''), findings };
}

function checkGitRemote() {
  let out = '';
  try {
    out = execFileSync('git', ['remote', '-v'], { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  } catch (e) {
    return { id: 'gitremote', label: 'gitremote', level: 'warn', detail: 'git remote unavailable', findings: [] };
  }
  const lines = out.split(/\r?\n/).filter(Boolean);
  const hasOrigin = lines.some((l) => /^origin\s/.test(l));
  if (hasOrigin) return { id: 'gitremote', label: 'gitremote', level: 'ok', detail: 'origin remote configured', findings: [] };
  return { id: 'gitremote', label: 'gitremote', level: 'warn', detail: 'no origin remote', findings: lines };
}

function checkGitIgnore() {
  const file = path.join(ROOT, '.gitignore');
  if (!fs.existsSync(file)) return { id: 'gitignore', label: 'gitignore', level: 'warn', detail: '.gitignore missing', findings: [] };
  const raw = fs.readFileSync(file, 'utf8');
  const findings = [];
  if (!/^node_modules\/?$/m.test(raw) && !raw.includes('node_modules')) findings.push('node_modules not ignored');
  if (!raw.includes('.env')) findings.push('.env not ignored');
  return { id: 'gitignore', label: 'gitignore', level: findings.length ? 'warn' : 'ok', detail: findings.length ? findings.join('; ') : '.gitignore present', findings };
}

function checkRootPkg() {
  const file = path.join(ROOT, 'package.json');
  if (!fs.existsSync(file)) return { id: 'rootpkg', label: 'rootpkg', level: 'warn', detail: 'root package.json missing', findings: [] };
  let obj = null;
  try { obj = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) {
    return { id: 'rootpkg', label: 'rootpkg', level: 'fail', detail: 'root package.json invalid JSON', findings: [e.message] };
  }
  const findings = [];
  if (!obj.scripts) findings.push('no scripts');
  if (!obj.name) findings.push('no name');
  if (!obj.engines) findings.push('no engines');
  return { id: 'rootpkg', label: 'rootpkg', level: findings.length ? 'warn' : 'ok', detail: findings.length ? findings.join('; ') : (obj.name + ' ok'), findings };
}

function checkReadme() {
  const file = path.join(ROOT, 'README.md');
  if (!fs.existsSync(file)) return { id: 'readme', label: 'readme', level: 'warn', detail: 'README.md missing', findings: [] };
  const raw = fs.readFileSync(file, 'utf8');
  if (raw.length < 100) return { id: 'readme', label: 'readme', level: 'warn', detail: 'README.md suspiciously short', findings: [] };
  return { id: 'readme', label: 'readme', level: 'ok', detail: 'README.md present (' + raw.length + ' bytes)', findings: [] };
}

function checkLicense() {
  const candidates = ['LICENSE', 'LICENSE.md', 'LICENSE.txt'];
  for (const c of candidates) {
    if (fs.existsSync(path.join(ROOT, c))) return { id: 'license', label: 'license', level: 'ok', detail: c + ' present', findings: [] };
  }
  return { id: 'license', label: 'license', level: 'warn', detail: 'no LICENSE file', findings: [] };
}

function checkChangelog() {
  const candidates = ['CHANGELOG.md', 'CHANGELOG'];
  for (const c of candidates) {
    if (fs.existsSync(path.join(ROOT, c))) return { id: 'changelog', label: 'changelog', level: 'ok', detail: c + ' present', findings: [] };
  }
  return { id: 'changelog', label: 'changelog', level: 'warn', detail: 'no CHANGELOG file', findings: [] };
}

function checkContributing() {
  const candidates = ['CONTRIBUTING.md', 'CONTRIBUTING'];
  for (const c of candidates) {
    if (fs.existsSync(path.join(ROOT, c))) return { id: 'contributing', label: 'contributing', level: 'ok', detail: c + ' present', findings: [] };
  }
  return { id: 'contributing', label: 'contributing', level: 'warn', detail: 'no CONTRIBUTING file', findings: [] };
}

function checkDevcontainer() {
  const dir = path.join(ROOT, '.devcontainer');
  if (!fs.existsSync(dir)) return { id: 'devcontainer', label: 'devcontainer', level: 'warn', detail: '.devcontainer missing', findings: [] };
  return { id: 'devcontainer', label: 'devcontainer', level: 'ok', detail: '.devcontainer present', findings: [] };
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

const CHECKS = [checkConfigs, checkWorkflows, checkLockfiles, checkEngines, checkHooks, checkHandoff, checkHandoffMd, checkWiring, checkBloat, checkStray, checkDashboard, checkTmpFiles, checkNodeModules, checkRoadmap, checkStatus, checkVerifyTools, checkAgentsMd, checkGitClean, checkBranch, checkGitRemote, checkGitIgnore, checkRootPkg, checkReadme, checkLicense, checkChangelog, checkContributing, checkDevcontainer];

export function buildReport(opts) {
  let checks = CHECKS.map((fn) => fn());
  checks = checks.map((c) => ({ ...c, suggestion: c.level === 'ok' ? null : (SUGGESTIONS[c.id] || null) }));
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
  for (const c of report.checks) {
    io.stdout(`  ${c.level.padEnd(4)} ${c.label.padEnd(10)} ${c.detail}\n`);
    if (c.suggestion) io.stdout(`         -> ${c.suggestion}\n`);
  }
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

  // --only scoping works for EVERY check id (not just 'engines').
  for (const id of ALL_CHECK_IDS) {
    const r = await runCapture(['--only', id, '--json']);
    check(`--only ${id} never exits 2`, r.code === 0 || r.code === 1, `got ${r.code}`);
    let parsed = null;
    try { parsed = JSON.parse(r.out); } catch { parsed = null; }
    check(`--only ${id} emits parseable JSON`, !!parsed);
    check(`--only ${id} scopes to one check`, !!parsed && parsed.checks.length === 1 && parsed.checks[0].id === id);
    check(`--only ${id} check has valid tier`, !!parsed && ['ok', 'warn', 'fail'].includes(parsed.checks[0].level));
  }

  // Every check result carries the documented shape.
  const full = await runCapture(['--json']);
  const fullReport = JSON.parse(full.out);
  check('full report has all checks', fullReport.checks.length === ALL_CHECK_IDS.length);
  check('full report checks have id/label/detail/level', fullReport.checks.every((c) => typeof c.id === 'string' && typeof c.label === 'string' && typeof c.detail === 'string' && ['ok', 'warn', 'fail'].includes(c.level)));
  check('verdict is one of ok/warn/fail', ['ok', 'warn', 'fail'].includes(fullReport.verdict));

  // --quiet prints verdict line for scoped runs.
  const q2 = await runCapture(['--only', 'engines', '--quiet']);
  check('--quiet scopes verdict line', q2.out.includes('quick-health:'));

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