#!/usr/bin/env node
/**
 * ops-dashboard.mjs — repo-level observability dashboard.
 * Aggregates the telemetry that already exists in this workspace into one Markdown view:
 *   - CI workflow inventory (from disk — the source of truth)
 *   - workspace Node tooling inventory
 *   - bundle-size ledger (latest snapshot + trend deltas)
 *   - fleet mirror parity (delegates to tools/sync-parity.mjs; auto-skips without clones)
 *   - Markdown link health (delegates to tools/check-doc-links.mjs)
 *   - machine-written reports (agent-report.json, auto-ops-report.json, auto-fix-ledger.json)
 *
  *   node tools/ops-dashboard.mjs [--out docs/metrics/OPS-DASHBOARD.md]
 *   node tools/ops-dashboard.mjs --check [--max-age-hours 24]
 *   node tools/ops-dashboard.mjs --refresh
 *
 * Idempotent regeneration: every section carries a `<!-- ops-section:<id>
 * ts:<iso> -->` marker recording when its CONTENT last changed. Unchanged
 * sections keep their original stamps and a fully unchanged run does not
 * rewrite the file at all (no git churn). `--check` exits 1 when the output
 * is missing, lacks markers, or any section is older than --max-age-hours
 * (the workspace gate consumes this as a warning; the daily cron workflow
 * refreshes the dashboard, so staleness is an ops signal, not a code fault).
 *
 * Report-only by design: exits 0 even when individual sections are degraded.
 */
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const opt = (name, def) => {
  const i = argv.indexOf(name);
  return i >= 0 && i + 1 < argv.length ? argv[i + 1] : def;
};
const outArg = opt('--out', '');
const OUT = path.isAbsolute(outArg) ? outArg : path.join(ROOT, outArg || path.join('docs', 'metrics', 'OPS-DASHBOARD.md'));

const readJsonSafe = (rel) => {
  try {
    return JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8'));
  } catch {
    return null;
  }
};

const human = (n) => {
  if (n >= 1024 * 1024) return (n / 1024 / 1024).toFixed(2) + ' MB';
  if (n >= 1024) return (n / 1024).toFixed(1) + ' KB';
  return n + ' B';
};

function summarizeJson(obj) {
  if (Array.isArray(obj)) return `array with ${obj.length} entries`;
  if (obj && typeof obj === 'object') {
    const keys = Object.keys(obj);
    const scalars = keys.filter((k) => typeof obj[k] !== 'object' || obj[k] === null).slice(0, 6);
    const detail = scalars.map((k) => `${k}=${JSON.stringify(obj[k])}`).join(', ');
    return `object with ${keys.length} keys${detail ? ` (${detail}${keys.length > scalars.length ? ', …' : ''})` : ''}`;
  }
  return JSON.stringify(obj);
}

function runTool(cmd) {
  try {
    return execSync(cmd, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  } catch (e) {
    const out = (e.stdout || '').trim();
    return out || `(tool exited ${e.status || '?'})`;
  }
}

// ---- section collectors -------------------------------------------------
// Each collector returns { id, lines }; ids are the stable keys referenced
// by the per-section freshness markers written into the generated Markdown.

function workflowsSection() {
  const lines = [];
  const dir = path.join(ROOT, '.github', 'workflows');
  const files = fs
    .readdirSync(dir)
    .filter((f) => /\.(yml|yaml)$/.test(f))
    .sort();
  lines.push(`## CI Workflows (${files.length})`, '');
  for (const f of files) lines.push(`- \`${f}\``);
  lines.push('');
  return { id: 'workflows', lines };
}

function toolingSection() {
  const lines = [];
  const dir = path.join(ROOT, 'tools');
  const files = fs.readdirSync(dir).filter((f) => /\.(mjs|cjs|ps1|json)$/.test(f)).sort();
  lines.push(`## Workspace Tooling (${files.length} files in tools/)`, '');
  for (const f of files) lines.push(`- \`${f}\``);
  lines.push('');
  return { id: 'tooling', lines };
}

function bundleSection() {
  const lines = [];
  const ledger = readJsonSafe(path.join('docs', 'metrics', 'bundle-history.json'));
  const entries = ledger && Array.isArray(ledger.entries) ? ledger.entries : [];
  if (entries.length === 0) {
    lines.push('## Bundle Ledger', '', '_Empty — run `node tools/bundle-trend.cjs collect` after building projects._', '');
    return { id: 'bundle', lines };
  }
  const latest = entries[entries.length - 1];
  const prev = entries.length > 1 ? entries[entries.length - 2] : null;
  const names = Object.keys(latest.projects || {}).sort();
  lines.push(`## Bundle Ledger (latest: ${latest.timestamp}, ${latest.gitSha})`, '');
  lines.push('| Project | Size | Files | vs prev |');
  lines.push('|---------|-----:|------:|---------|');
  for (const n of names) {
    let delta = '—';
    if (prev && prev.projects && prev.projects[n] && prev.projects[n].bytes > 0) {
      const growth = ((latest.projects[n].bytes - prev.projects[n].bytes) / prev.projects[n].bytes) * 100;
      delta = `${growth >= 0 ? '+' : ''}${growth.toFixed(1)}%`;
    }
    lines.push(`| ${n} | ${human(latest.projects[n].bytes)} | ${latest.projects[n].files} | ${delta} |`);
  }
  lines.push('');
  return { id: 'bundle', lines };
}

function toolOutputSection(id, title, cmd) {
  return { id, lines: [`## ${title}`, '', '```text', runTool(cmd), '```', ''] };
}

function extensionSection() {
  // Extension health is part of CI (multi-os-gate) via --quiet; inline the full
  // report here so the dashboard shows per-check findings, not just pass/fail.
  return {
    id: 'extension',
    lines: ['## Browser Extension (Unified AI Assistant Suite)', '', '```text', runTool('node tools/extension-check.mjs'), '```', ''],
  };
}

function machineReportsSection() {
  const lines = [];
  const reports = ['agent-report.json', 'auto-ops-report.json', 'auto-fix-ledger.json'];
  lines.push('## Machine-Generated Reports', '');
  for (const r of reports) {
    const data = readJsonSafe(r);
    lines.push(`- \`${r}\`: ${data ? summarizeJson(data) : '_not readable / absent_'}`);
  }
  lines.push('');
  return { id: 'machine-reports', lines };
}

// ---- freshness guard ------------------------------------------------------
// `--check` validates that every known section exists in the output and is
// younger than --max-age-hours (default 24 — matches the daily cron cadence).
// A missing output, a missing marker, or an unparseable stamp all count as
// stale so the failure is always actionable ("regenerate the dashboard").

const MARKER_RE = /^<!-- ops-section:([a-z0-9-]+) ts:(\S+) -->$/;
const SECTION_IDS = ['workflows', 'tooling', 'bundle', 'parity', 'doclinks', 'extension', 'machine-reports'];

function parseFreshness(raw) {
  const stamps = new Map();
  const bodies = new Map();
  if (!raw) return { stamps, bodies };
  const lines = raw.split(/\r?\n/);
  let current = null;
  let currentStart = -1;
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(MARKER_RE);
    if (!m) continue;
    if (current) bodies.set(current, lines.slice(currentStart, i).join('\n').trimEnd());
    current = m[1];
    stamps.set(current, m[2]);
    currentStart = i + 1;
  }
  if (current) bodies.set(current, lines.slice(currentStart).join('\n').trimEnd());
  return { stamps, bodies };
}

function freshnessCheck() {
  const maxAgeHours = parseFloat(opt('--max-age-hours', '24'));
  if (!fs.existsSync(OUT)) {
    console.error(`ops-dashboard: freshness FAIL — ${path.relative(ROOT, OUT)} does not exist; run: node tools/ops-dashboard.mjs`);
    process.exit(1);
  }
  const raw = fs.readFileSync(OUT, 'utf8');
  const { stamps } = parseFreshness(raw);
  const now = Date.now();
  let stale = 0;
  console.log(`ops-dashboard: freshness check (max age ${maxAgeHours}h)`);
  for (const id of SECTION_IDS) {
    const ts = stamps.get(id);
    const parsed = ts ? Date.parse(ts) : NaN;
    if (!ts || !Number.isFinite(parsed)) {
      console.log(`  ${id.padEnd(16)} no timestamp marker — regenerate`);
      stale += 1;
      continue;
    }
    const ageH = (now - parsed) / 3.6e6;
    if (ageH > maxAgeHours) {
      console.log(`  ${id.padEnd(16)} ${ageH.toFixed(1)}h  STALE (> ${maxAgeHours}h)`);
      stale += 1;
    } else {
      console.log(`  ${id.padEnd(16)} ${ageH.toFixed(1)}h  ok`);
    }
  }
     if (stale > 0) {
    console.log(`ops-dashboard: ${stale} stale/unknown section(s) — run: node tools/ops-dashboard.mjs`);
    process.exit(1);
  }
  console.log(`ops-dashboard: all ${SECTION_IDS.length} sections fresh`);
}

// ---- main ----------------------------------------------------------------

if (argv.includes('--check')) {
  freshnessCheck();
  process.exit(0);
}

const sections = [
  workflowsSection(),
  toolingSection(),
  bundleSection(),
  toolOutputSection('parity', 'Fleet Mirror Parity', 'node tools/sync-parity.mjs check'),
  toolOutputSection('doclinks', 'Markdown Link Health', 'node tools/check-doc-links.mjs'),
  extensionSection(),
  machineReportsSection(),
];

const existingRaw = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8') : null;
const { stamps: oldStamps, bodies: oldBodies } = parseFreshness(existingRaw);

  const nowIso = new Date().toISOString();
  const forceRefresh = argv.includes('--refresh');
let anyChanged = false;
const blocks = [];
for (const s of sections) {
  const body = s.lines.join('\n').trimEnd();
    const unchanged = oldBodies.has(s.id) && oldBodies.get(s.id) === body;
  if (!unchanged) anyChanged = true;
  const ts = (forceRefresh || !unchanged || !oldStamps.has(s.id)) ? nowIso : oldStamps.get(s.id);
  blocks.push(`<!-- ops-section:${s.id} ts:${ts} -->\n${body}`);
}

// Idempotence: a fully unchanged, non-refresh run leaves the file byte-identical.
if (existingRaw !== null && !anyChanged && !forceRefresh) {
  console.log(`ops-dashboard: unchanged -> ${path.relative(ROOT, OUT)} (no section changed, not rewritten)`);
  process.exit(0);
}

const header = [
  '# OPS Dashboard',
  '',
  `> Auto-generated by \`node tools/ops-dashboard.mjs\` — do not hand-edit. Generated: ${nowIso}`,
  `> Per-section timestamps record when each section's content last changed; validate with \`--check\`.`,
];
const content = header.join('\n') + '\n\n' + blocks.join('\n\n') + '\n';
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, content, 'utf8');
console.log(`ops-dashboard: written -> ${path.relative(ROOT, OUT)} (${content.split('\n').length} lines, ${sections.length} sections stamped)`);


