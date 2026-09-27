#!/usr/bin/env node
'use strict';
/**
 * bundle-trend.cjs — workspace bundle-size ledger + regression gate.
 *
 *   node tools/bundle-trend.cjs collect  [--ledger docs/metrics/bundle-history.json] [--note "..."] [--project <app>]
 *   node tools/bundle-trend.cjs check    [--ledger ...] [--threshold 10] [--webhook-url URL] [--project <app>]
 *   node tools/bundle-trend.cjs markdown [--ledger ...] [--out <file>] [--project <app>]
 *
 * Alerting: on regression, `check` emits GitHub Actions ::error:: annotations
 * when GITHUB_ACTIONS=true, and POSTs a best-effort webhook (never fails the
 * gate) when --webhook-url or BUNDLE_ALERT_WEBHOOK is set.
 *   node tools/bundle-trend.cjs report   [--ledger ...] [--limit 5] [--project <app>]
 *   node tools/bundle-trend.cjs checksum [--project nexus-infinity-hub]  (pre-build integrity manifest)
 *   node tools/bundle-trend.cjs verify   [--project nexus-infinity-hub]  (fail on drift vs manifest)
 *
 * Non-interactive by contract (Round 12 D re-scope): every input is an explicit
 * flag (`--flag value` or `--flag=value`); unknown commands/flags/projects exit
 * 2 with a usage message; `--help` prints usage and exits 0. No stdin prompts.
 *
 * The checksum/verify pair is the pre-build bundle-integrity gate: `checksum`
 * writes a SHA-256 manifest of every file in the app's build output dir(s)
 * (`dist/.checksum-manifest.json`); `verify` re-hashes and exits 1 on any
 * added/removed/changed file. On a slow laptop this is instant (plain Node
 * crypto, no browser, no server) and catches stale or half-written builds.
 *
 * Auto-discovers root-level Node projects (folder containing package.json) and measures their
 * build output dirs (dist / build / out / .output / release). `collect` appends a snapshot to the
 * ledger; `check` compares fresh local measurements against the most recent baseline per project
 * and exits 1 when any project grew by more than --threshold percent (shrinking never fails).
 * `report` prints the last few snapshots. No dependencies — plain Node.
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { createHash } = require('crypto');

const ROOT = path.resolve(__dirname, '..');
const DEFAULT_LEDGER = path.join('docs', 'metrics', 'bundle-history.json');
const OUT_DIRS = ['dist', 'build', 'out', '.output', 'release'];
const MAX_ENTRIES = 200;
const CHECKSUM_MANIFEST = '.checksum-manifest.json';

const argv = process.argv.slice(2);

// ── Non-interactive argv tokenizer (Round 12 D re-scope) ─────────────────────
// Splits argv into flags + positionals up front so a flag VALUE (e.g. the `1`
// in `--limit 1`) can never be mistaken for a subcommand, accepts both
// `--flag value` and `--flag=value`, and rejects unknown flags outright
// instead of silently ignoring typos. No stdin prompts, ever.
const VALUE_FLAGS = new Set([
  '--ledger',
  '--note',
  '--threshold',
  '--webhook-url',
  '--limit',
  '--project',
  '--out',
]);
const flags = {};
const positionals = [];
for (let i = 0; i < argv.length; i += 1) {
  const a = argv[i];
  if (a === '--help' || a === '-h') {
    flags['--help'] = true;
    continue;
  }
  if (a.startsWith('-')) {
    const eq = a.indexOf('=');
    const key = eq >= 0 ? a.slice(0, eq) : a;
    if (!VALUE_FLAGS.has(key)) {
      console.error(`bundle-trend: unknown flag "${key}" — see \`node tools/bundle-trend.cjs --help\``);
      process.exit(2);
    }
    let value;
    if (eq >= 0) value = a.slice(eq + 1);
    else if (i + 1 < argv.length) value = argv[(i += 1)];
    else {
      console.error(`bundle-trend: flag "${key}" requires a value — see \`node tools/bundle-trend.cjs --help\``);
      process.exit(2);
    }
    flags[key] = value;
    continue;
  }
  positionals.push(a);
}

function usage() {
  console.log(
    [
      'bundle-trend.cjs — workspace bundle-size ledger + regression gate (non-interactive)',
      '',
      'Usage: node tools/bundle-trend.cjs <command> [--flag value | --flag=value]',
      '',
      'Commands:',
      '  collect   snapshot build outputs into the ledger',
      '            flags: --ledger --note --project',
      '  check     fail when a project grew more than --threshold % (default 10)',
      '            flags: --ledger --threshold --webhook-url --project',
      '  report    print recent ledger entries',
      '            flags: --ledger --limit --project',
      '  markdown  write docs/metrics/bundle-report.md',
      '            flags: --ledger --out --project',
      '  checksum  write .checksum-manifest.json over build outputs (pre-build gate)',
      '            flags: --project',
      '  verify    fail when build outputs drift from the manifest',
      '            flags: --project',
      '',
      '  --help    print this text and exit 0',
      '',
      '--project scopes a run to ONE auto-discovered project (unknown project exits 2',
      'with the known list). Unknown commands/flags exit 2. There is no interactive',
      'mode: every input is an explicit flag.',
    ].join('\n'),
  );
}

if (flags['--help'] || (positionals[0] === 'help' && positionals.length === 1)) {
  usage();
  process.exit(0);
}

const cmd = positionals[0] || 'report';
const CMD_FLAGS = {
  collect: ['--ledger', '--note', '--project'],
  check: ['--ledger', '--threshold', '--webhook-url', '--project'],
  report: ['--ledger', '--limit', '--project'],
  markdown: ['--ledger', '--out', '--project'],
  checksum: ['--project'],
  verify: ['--project'],
};
if (positionals.length > 1) {
  console.error(`bundle-trend: unexpected argument "${positionals[1]}" — commands take flags only (see --help)`);
  process.exit(2);
}
if (!CMD_FLAGS[cmd]) {
  console.error(`bundle-trend: unknown command "${cmd}" — use collect | check | report | markdown | checksum | verify (or --help)`);
  process.exit(2);
}
for (const key of Object.keys(flags)) {
  if (key === '--help') continue;
  if (!CMD_FLAGS[cmd].includes(key)) {
    console.error(`bundle-trend: flag "${key}" is not valid for command "${cmd}" (allowed: ${CMD_FLAGS[cmd].join(' ')}) — see --help`);
    process.exit(2);
  }
}

function opt(name, def) {
  return Object.prototype.hasOwnProperty.call(flags, name) ? flags[name] : def;
}

// Re-scoped explicit scoping (Round 12 D): `--project <app>` limits
// collect/check/report/markdown/checksum/verify to one auto-discovered
// project. No stdin prompts, no bare second positional (it collides with
// flag values like `--limit 1`).
function projectScope() {
  return opt('--project', '');
}

function assertScope(scope) {
  if (!scope) return '';
  const known = listProjects();
  if (!known.includes(scope)) {
    console.error(`bundle-trend: unknown project "${scope}" — known: ${known.join(', ') || '(none)'}`);
    process.exit(2);
  }
  return scope;
}

function ledgerPath() {
  const given = opt('--ledger', '');
  return path.isAbsolute(given) ? given : path.join(ROOT, given || DEFAULT_LEDGER);
}

function listProjects() {
  return fs
    .readdirSync(ROOT, { withFileTypes: true })
    .filter((d) => d.isDirectory() && !d.name.startsWith('.'))
    .map((d) => d.name)
    .filter((n) => fs.existsSync(path.join(ROOT, n, 'package.json')))
    .sort();
}

function walkSize(dir) {
  let bytes = 0;
  let files = 0;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === 'node_modules') continue;
      const r = walkSize(p);
      bytes += r.bytes;
      files += r.files;
    } else if (e.isFile()) {
      bytes += fs.statSync(p).size;
      files += 1;
    }
  }
  return { bytes, files };
}

function measureProject(name) {
  const dirs = OUT_DIRS.map((d) => path.join(ROOT, name, d)).filter((p) => fs.existsSync(p));
  if (dirs.length === 0) return null;
  let bytes = 0;
  let files = 0;
  const perDir = {};
  for (const d of dirs) {
    const r = walkSize(d);
    perDir[path.basename(d)] = r.bytes;
    bytes += r.bytes;
    files += r.files;
  }
  return { bytes, files, dirs: perDir };
}

function measureAll() {
  const scope = assertScope(projectScope());
  const out = {};
  for (const name of listProjects()) {
    if (scope && name !== scope) continue;
    const m = measureProject(name);
    if (m) out[name] = m;
  }
  if (scope && !out[scope]) {
    console.error(`bundle-trend: project "${scope}" has no build output — build it first.`);
    process.exit(2);
  }
  return out;
}

function gitSha() {
  try {
    return execSync('git rev-parse --short HEAD', { cwd: ROOT }).toString().trim();
  } catch {
    return 'unknown';
  }
}

function human(n) {
  if (n >= 1024 * 1024) return (n / 1024 / 1024).toFixed(2) + ' MB';
  if (n >= 1024) return (n / 1024).toFixed(1) + ' KB';
  return n + ' B';
}

function loadLedger(file) {
  try {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (parsed && Array.isArray(parsed.entries)) return parsed;
  } catch {
    /* fall through to fresh ledger */
  }
  return { version: 1, entries: [] };
}

function saveLedger(file, ledger) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(ledger, null, 2) + '\n', 'utf8');
}

function baselineFor(ledger, project) {
  for (let i = ledger.entries.length - 1; i >= 0; i -= 1) {
    const entry = ledger.entries[i];
    if (entry.projects && entry.projects[project]) {
      return { bytes: entry.projects[project].bytes, at: entry.timestamp };
    }
  }
  return null;
}

function collect() {
  const file = ledgerPath();
  const measured = measureAll();
  const names = Object.keys(measured);
  if (names.length === 0) {
    console.log('bundle-trend: no build outputs found — nothing collected. Build projects first.');
    return 0;
  }
  const ledger = loadLedger(file);
  const projects = {};
  for (const name of names) {
    projects[name] = { bytes: measured[name].bytes, files: measured[name].files, dirs: measured[name].dirs };
  }
  ledger.entries.push({
    timestamp: new Date().toISOString(),
    gitSha: gitSha(),
    note: opt('--note', ''),
    projects,
  });
  while (ledger.entries.length > MAX_ENTRIES) ledger.entries.shift();
  saveLedger(file, ledger);
  console.log(`bundle-trend: snapshot recorded (${names.length} project(s)) -> ${path.relative(ROOT, file)}`);
  for (const name of names) {
    console.log(`  ${name.padEnd(34)} ${human(projects[name].bytes).padStart(10)}  (${projects[name].files} files)`);
  }
  return 0;
}

function check() {
  const file = ledgerPath();
  const threshold = Number(opt('--threshold', '10'));
  const measured = measureAll();
  const names = Object.keys(measured);
  if (names.length === 0) {
    console.log('bundle-trend: no local build outputs — nothing to check (pass).');
    return 0;
  }
  const ledger = loadLedger(file);
  let failed = false;
  const regressions = [];
  console.log(`bundle-trend: regression gate (fail when growth > +${threshold}%)`);
  for (const name of names) {
    const base = baselineFor(ledger, name);
    if (!base) {
      console.log(`  ${name.padEnd(34)} no baseline yet (${human(measured[name].bytes)}) — skip`);
      continue;
    }
    const growth = base.bytes > 0 ? ((measured[name].bytes - base.bytes) / base.bytes) * 100 : 0;
    const tag = growth > threshold ? 'FAIL' : 'ok  ';
    if (growth > threshold) {
      failed = true;
      regressions.push({ name, base: base.bytes, now: measured[name].bytes, growth });
    }
    console.log(
      `  ${name.padEnd(34)} ${human(base.bytes).padStart(10)} -> ${human(measured[name].bytes).padStart(10)}` +
        `  (${growth >= 0 ? '+' : ''}${growth.toFixed(1)}%)  ${tag}  [baseline ${base.at}]`
    );
  }
  if (failed) {
    console.error('bundle-trend: REGRESSION detected — see FAIL rows above.');
    emitAlerts(regressions, threshold);
    return 1;
  }
  console.log('bundle-trend: no regressions.');
  return 0;
}

// ── Performance regression alerts (B1) ───────────────────────────────────────
// CI: emits ::error:: annotations when running under GitHub Actions (exit code
// unchanged). Webhook: best-effort JSON POST, never fails the gate.

function emitAlerts(regressions, threshold) {
  const isCI = process.env.GITHUB_ACTIONS === 'true';
  if (isCI) {
    for (const r of regressions) {
      const pct = `${r.growth >= 0 ? '+' : ''}${r.growth.toFixed(1)}%`;
      console.log(
        `::error title=bundle regression: ${r.name}::bundle grew ${pct} ` +
          `(${human(r.base)} -> ${human(r.now)}), over +${threshold}% threshold`
      );
    }
  }
  const url = opt('--webhook-url', '') || process.env.BUNDLE_ALERT_WEBHOOK || '';
  if (!url) return;
  const payload = JSON.stringify({
    text:
      `bundle-trend: ${regressions.length} bundle regression(s) over +${threshold}%\n` +
      regressions
        .map((r) => `• ${r.name}: ${human(r.base)} -> ${human(r.now)} (${r.growth >= 0 ? '+' : ''}${r.growth.toFixed(1)}%)`)
        .join('\n'),
  });
  try {
    const parsed = new URL(url);
    const mod = parsed.protocol === 'https:' ? require('https') : require('http');
    const req = mod.request(
      { hostname: parsed.hostname, port: parsed.port, path: parsed.pathname + parsed.search, method: 'POST' },
      (res) => {
        res.resume();
        console.log(`bundle-trend: alert webhook -> HTTP ${res.statusCode}`);
      }
    );
    req.on('error', (err) => console.error(`bundle-trend: alert webhook failed (non-fatal): ${err.message}`));
    req.setTimeout(5000, () => {
      req.destroy(new Error('timeout'));
      console.error('bundle-trend: alert webhook timed out (non-fatal)');
    });
    req.end(payload);
  } catch (err) {
    console.error(`bundle-trend: alert webhook skipped (non-fatal): ${err.message}`);
  }
}

function report() {
  const ledger = loadLedger(ledgerPath());
  const limit = Number(opt('--limit', '5'));
  const scope = assertScope(projectScope());
  const entries = ledger.entries.slice(-limit);
  if (entries.length === 0) {
    console.log('bundle-trend: ledger is empty. Run `collect` after building projects.');
    return 0;
  }
  for (const entry of entries) {
    console.log(`\n${entry.timestamp}  (${entry.gitSha}${entry.note ? `, ${entry.note}` : ''})`);
    const names = Object.keys(entry.projects || {}).sort().filter((n) => !scope || n === scope);
    for (const name of names) {
      console.log(`  ${name.padEnd(34)} ${human(entry.projects[name].bytes).padStart(10)}  (${entry.projects[name].files} files)`);
    }
  }
  return 0;
}

function markdown() {
  const file = ledgerPath();
  const outArg = opt('--out', '');
  const outPath = path.isAbsolute(outArg) ? outArg : path.join(ROOT, outArg || path.join('docs', 'metrics', 'bundle-report.md'));
  const ledger = loadLedger(file);
  const scope = assertScope(projectScope());
  const entries = ledger.entries.slice(-5).reverse();
  if (entries.length === 0) {
    console.log('bundle-trend: ledger is empty; nothing to render. Run `collect` after building projects.');
    return 0;
  }
  const latest = entries[0];
  const names = Object.keys(latest.projects || {})
    .sort()
    .filter((n) => !scope || n === scope);
  const lines = [];
  lines.push('# Bundle Size Report');
  lines.push('');
  lines.push(`> Auto-generated by \`node tools/bundle-trend.cjs markdown\` — do not hand-edit.`);
  lines.push(`> Latest snapshot: ${latest.timestamp} (${latest.gitSha}${latest.note ? `, ${latest.note}` : ''}).`);
  lines.push('');
  lines.push('## Latest');
  lines.push('');
  lines.push('| Project | Size | Files |');
  lines.push('|---------|-----:|------:|');
  for (const name of names) {
    lines.push(`| ${name} | ${human(latest.projects[name].bytes)} | ${latest.projects[name].files} |`);
  }
  if (entries.length > 1) {
    lines.push('');
    lines.push(`## Trend (last ${entries.length} snapshots)`);
    lines.push('');
    lines.push(`| Snapshot | ${names.join(' | ')} |`);
    lines.push(`|----------|${names.map(() => '----------|').join('')}`);
    for (const e of entries) {
      const cells = names.map((n) => (e.projects && e.projects[n] ? human(e.projects[n].bytes) : '—'));
      lines.push(`| ${e.timestamp} | ${cells.join(' | ')} |`);
    }
  }
  lines.push('');
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, lines.join('\n') + '\n', 'utf8');
  console.log(`bundle-trend: markdown report -> ${path.relative(ROOT, outPath)}`);
  return 0;
}
// ── Pre-build integrity gate (checksum / verify) ─────────────────────────────

function sha256File(p) {
  return createHash('sha256').update(fs.readFileSync(p)).digest('hex');
}

function outDirsFor(projectRoot) {
  return OUT_DIRS.map((d) => path.join(projectRoot, d)).filter((p) => fs.existsSync(p));
}

function checksumTargets() {
  const wanted = assertScope(opt('--project', ''));
  const names = wanted
    ? [wanted]
    : listProjects().filter((n) => outDirsFor(path.join(ROOT, n)).length > 0);
  return names
    .map((name) => {
      const root = path.join(ROOT, name);
      const dirs = outDirsFor(root);
      return { name, root, dirs };
    })
    .filter((t) => t.dirs.length > 0);
}

function hashTree(projectRoot, dirs, skipRel) {
  const files = {};
  let bytes = 0;
  for (const dir of dirs) {
    const stack = [dir];
    while (stack.length) {
      const cur = stack.pop();
      for (const e of fs.readdirSync(cur, { withFileTypes: true })) {
        const p = path.join(cur, e.name);
        if (e.isDirectory()) {
          stack.push(p);
        } else if (e.isFile()) {
          const rel = path.relative(projectRoot, p).split(path.sep).join('/');
          if (rel === skipRel) continue;
          const size = fs.statSync(p).size;
          files[rel] = { sha256: sha256File(p), size };
          bytes += size;
        }
      }
    }
  }
  return { files, bytes };
}

function loadManifest(file) {
  try {
    const m = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (m && m.version === 1 && m.project && m.files && typeof m.files === 'object') return m;
  } catch {
    /* caller reports the setup error */
  }
  return null;
}

function checksum() {
  const targets = checksumTargets();
  if (targets.length === 0) {
    console.error('bundle-trend: no build outputs found — build first, then checksum writes <out>/.checksum-manifest.json.');
    return 2;
  }
  for (const t of targets) {
    const mpath = path.join(t.dirs[0], CHECKSUM_MANIFEST);
    const relManifest = path.relative(t.root, mpath).split(path.sep).join('/');
    const dirsKey = JSON.stringify(t.dirs.map((d) => path.relative(t.root, d).split(path.sep).join('/')));
    const { files, bytes } = hashTree(t.root, t.dirs, relManifest);
    const prev = loadManifest(mpath);
    if (
      prev &&
      prev.primaryDir === path.basename(t.dirs[0]) &&
      JSON.stringify(prev.dirs) === dirsKey &&
      JSON.stringify(prev.files) === JSON.stringify(files)
    ) {
      console.log(`  ${t.name.padEnd(34)} unchanged since ${prev.timestamp} (${Object.keys(files).length} files, ${human(bytes)}) — manifest left as-is`);
      continue;
    }
    const manifest = {
      version: 1,
      project: t.name,
      timestamp: new Date().toISOString(),
      gitSha: gitSha(),
      primaryDir: path.basename(t.dirs[0]),
      dirs: t.dirs.map((d) => path.relative(t.root, d).split(path.sep).join('/')),
      totals: { files: Object.keys(files).length, bytes },
      files,
    };
    fs.writeFileSync(mpath, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
    const drifted = prev ? ` [drifted since ${prev.timestamp}: ${prev.totals ? prev.totals.files : '?'} -> ${manifest.totals.files} files]` : '';
    console.log(`  ${t.name.padEnd(34)} manifest ${prev ? 'refreshed' : 'written'} (${manifest.totals.files} files, ${human(bytes)}) -> ${path.relative(ROOT, mpath)}${drifted}`);
  }
  return 0;
}

function verify() {
  const targets = checksumTargets();
  if (targets.length === 0) {
    console.error('bundle-trend: no build outputs found — nothing to verify.');
    return 2;
  }
  let failed = false;
  for (const t of targets) {
    const mpath = path.join(t.dirs[0], CHECKSUM_MANIFEST);
    const manifest = loadManifest(mpath);
    if (!manifest) {
      console.error(`  ${t.name.padEnd(34)} FAIL — no valid manifest at ${path.relative(ROOT, mpath)} (run \`checksum\` first)`);
      failed = true;
      continue;
    }
    const relManifest = path.relative(t.root, mpath).split(path.sep).join('/');
    const { files } = hashTree(t.root, t.dirs, relManifest);
    const changed = [];
    const removed = [];
    const added = [];
    for (const [rel, meta] of Object.entries(manifest.files)) {
      const cur = files[rel];
      if (!cur) removed.push(rel);
      else if (cur.sha256 !== meta.sha256) changed.push(rel);
    }
    for (const rel of Object.keys(files)) {
      if (!manifest.files[rel]) added.push(rel);
    }
    const drift = [
      ...changed.map((rel) => ['changed', rel]),
      ...removed.map((rel) => ['removed', rel]),
      ...added.map((rel) => ['added', rel]),
    ];
    if (drift.length > 0) {
      failed = true;
      console.log(`  ${t.name.padEnd(34)} DRIFT — ${changed.length} changed, ${removed.length} removed, ${added.length} added`);
      for (const [kind, rel] of drift.slice(0, 10)) console.log(`      ${kind.padEnd(7)} ${rel}`);
      if (drift.length > 10) console.log(`      … and ${drift.length - 10} more`);
    } else {
      console.log(`  ${t.name.padEnd(34)} clean (${Object.keys(manifest.files).length} files match manifest)`);
    }
  }
  if (failed) {
    console.error('bundle-trend: VERIFY FAILED — build outputs drifted from the checksum manifest.');
    return 1;
  }
  console.log('bundle-trend: all manifests verified.');
  return 0;
}

const handlers = { collect, check, report, markdown, checksum, verify };
// Command validity was already enforced by the CMD_FLAGS gate above — this is
// a defensive backstop only.
if (!handlers[cmd]) {
  console.error(`bundle-trend: unknown command "${cmd}" — use collect | check | report | markdown | checksum | verify (or --help)`);
  process.exit(2);
}
process.exit(handlers[cmd]());
