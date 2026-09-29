#!/usr/bin/env node
/**
 * ops-dashboard.mjs — repo-level observability dashboard.
 * Aggregates the telemetry that already exists in this workspace into one Markdown view:
 *   - CI workflow inventory (from disk — the source of truth)
 *   - workspace Node tooling inventory
 *   - bundle-size ledger (latest snapshot + trend deltas)
 *   - coverage-trend ledger (latest snapshot + lines-% sparklines)
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

function coverageSection() {
  const lines = [];
  const fmt = (v) => (v === null || v === undefined ? 'n/a' : `${Number(v).toFixed(1)}%`);
  const ledger = readJsonSafe(path.join('docs', 'metrics', 'coverage-history.json'));
  const entries = ledger && Array.isArray(ledger.entries) ? ledger.entries : [];
  if (entries.length === 0) {
    lines.push('## Coverage Trends', '', '_Empty — run `node tools/coverage-trend.cjs collect` after running vitest coverage._', '');
    return { id: 'coverage', lines };
  }
  const GRAINS = ' .:-=+*#%@';
  const spark = (series) => {
    const nums = series.filter((v) => v !== null && v !== undefined);
    if (nums.length === 0) return '(no data)';
    const lo = Math.min(...nums);
    const hi = Math.max(...nums);
    const span = hi - lo || 1;
    return series
      .map((v) => {
        if (v === null || v === undefined) return ' ';
        const i = Math.min(GRAINS.length - 1, Math.floor(((v - lo) / span) * (GRAINS.length - 1)));
        return GRAINS[i];
      })
      .join('');
  };
  const latest = entries[entries.length - 1];
  const names = Object.keys(latest.projects || {}).sort();
  lines.push(`## Coverage Trends (latest: ${latest.timestamp}, ${latest.gitSha})`, '');
  lines.push('| Project | Lines | Stmts | Funcs | Branches | Status | Trend |');
  lines.push('|---------|------:|------:|------:|---------:|--------|-------|');
  for (const n of names) {
    const pr = latest.projects[n] || {};
    const s = pr.summary || {};
    const series = entries.map((e) => {
      const p = (e.projects || {})[n];
      return p && p.summary ? p.summary.lines : null;
    });
    lines.push(`| ${n} | ${fmt(s.lines)} | ${fmt(s.statements)} | ${fmt(s.functions)} | ${fmt(s.branches)} | ${pr.status || 'pending'} | \`${spark(series)}\` |`);
  }
  lines.push('', '_Full history: `docs/metrics/coverage-report.md` (`node tools/coverage-trend.cjs markdown`)._', '');
  return { id: 'coverage', lines };
}

function flakeSection() {
  const lines = [];
  const fmt = (v) => (v === null || v === undefined ? 'n/a' : `${Number(v).toFixed(1)}%`);
  const ledger = readJsonSafe(path.join('docs', 'metrics', 'flake-history.json'));
  const entries = ledger && Array.isArray(ledger.entries) ? ledger.entries : [];
  if (entries.length === 0) {
    lines.push('## Flaky Tests', '', '_Empty — record a run: `node tools/flake-tracker.cjs record --suite <name> --tests N --passed N`._', '');
    return { id: 'flakes', lines };
  }
  const suites = [...new Set(entries.map((e) => e.suite))].sort();
  const latest = entries[entries.length - 1];
  lines.push(`## Flaky Tests (latest: ${latest.timestamp}, ${latest.gitSha})`, '');
  lines.push('| Suite | Tests | Passed | Retries | Flakes | Flake rate |');
  lines.push('|-------|------:|-------:|--------:|-------:|-----------:|');
  for (const s of suites) {
    const last = [...entries].reverse().find((e) => e.suite === s);
    lines.push(`| ${s} | ${last.tests} | ${last.passed} | ${last.retries} | ${last.flakes} | ${fmt(last.rate)} |`);
  }
  lines.push('', '_Full history: `docs/metrics/flake-report.md` (`node tools/flake-tracker.cjs markdown`)._', '');
  return { id: 'flakes', lines };
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
  // Machine telemetry aggregation (Round 12 B): summarize the three
  // machine-written reports into ops-actionable trends instead of dumping
  // raw key counts. All reads are best-effort — a missing/unparseable
  // report degrades to a one-line note, never a throw.
  const lines = [];
  lines.push('## Machine-Generated Reports', '');
  const agent = readJsonSafe('agent-report.json');
  const ops = readJsonSafe('auto-ops-report.json');
  const ledger = readJsonSafe('auto-fix-ledger.json');

  // --- agent-report.json: task success rate + run recency ---
  if (agent) {
    const tasks = Array.isArray(agent.tasks) ? agent.tasks : [];
    const ok = tasks.filter((t) => t && t.success === true).length;
    const rate = tasks.length > 0 ? `${((ok / tasks.length) * 100).toFixed(1)}%` : 'n/a';
    const byType = {};
    for (const t of tasks) {
      const k = (t && t.type) || 'unknown';
      byType[k] = (byType[k] || 0) + 1;
    }
    const typeStr = Object.keys(byType).sort().map((k) => `${k}=${byType[k]}`).join(', ') || '—';
    lines.push(`- \`agent-report.json\`: solved=${agent.solved ?? 'n/a'} success=${ok}/${tasks.length} (${rate}) duplicates_closed=${agent.duplicates_closed ?? 'n/a'} scanned_at=${agent.scanned_at ?? 'n/a'} types[${typeStr}]`);
  } else {
    lines.push('- `agent-report.json`: _not readable / absent_');
  }

  // --- auto-ops-report.json: ops actions taken + error budget ---
  if (ops) {
    const dd = (ops.duplicate_drafts) || {};
    const sb = (ops.stale_branches) || {};
    const dc = (ops.dependabot_conflicts) || {};
    const dm = (ops.dependabot_merges) || {};
    const pl = (ops.policy_lockfile_spam) || {};
    const count = (a) => (Array.isArray(a) ? a.length : 0);
    const actions = count(dd.closed) + count(sb.deleted) + count(dc.rebase_requests) + count(dc.recreate_requests) + count(dm.merged);
    const errs = count(dd.errors) + count(sb.errors) + count(dc.errors) + count(dm.errors) + count(pl.errors);
    const kept = count(dd.kept);
    const skipped = count(dc.skipped) + count(dm.skipped);
    lines.push(`- \`auto-ops-report.json\`: actions_taken=${actions} (drafts_closed=${count(dd.closed)} branches_deleted=${count(sb.deleted)} merges=${count(dm.merged)} rebases=${count(dc.rebase_requests) + count(dc.recreate_requests)}) kept=${kept} skipped=${skipped} errors=${errs} scanned_at=${ops.scanned_at ?? 'n/a'}`);
  } else {
    lines.push('- `auto-ops-report.json`: _not readable / absent_');
  }

  // --- auto-fix-ledger.json: fix success rate by problem_type x status ---
  if (ledger) {
    const entries = Array.isArray(ledger.entries) ? ledger.entries : [];
    const byType = {};
    const byStatus = {};
    let prs = 0;
    let reappears = 0;
    for (const e of entries) {
      if (!e) continue;
      byType[e.problem_type || 'unknown'] = (byType[e.problem_type || 'unknown'] || 0) + 1;
      byStatus[e.status || 'unknown'] = (byStatus[e.status || 'unknown'] || 0) + 1;
      if (e.pr_number !== null && e.pr_number !== undefined) prs += 1;
      reappears += Number(e.reappear_count) || 0;
    }
    // "Resolved" = terminal success statuses only. Notably pending_verify
    // counts as open work, not failure — it must NOT match a /verif/ regex.
    const resolvedKeys = Object.keys(byStatus).filter((k) => /^(merged|fixed|verified|resolved|closed|done|success)$/i.test(k));
    const resolved = resolvedKeys.reduce((n, k) => n + byStatus[k], 0);
    const rate = entries.length > 0 ? `${((resolved / entries.length) * 100).toFixed(1)}%` : 'n/a';
    const typeStr = Object.keys(byType).sort().map((k) => `${k}=${byType[k]}`).join(', ') || '—';
    const statusStr = Object.keys(byStatus).sort().map((k) => `${k}=${byStatus[k]}`).join(', ') || '—';
    lines.push(`- \`auto-fix-ledger.json\`: entries=${entries.length} resolved=${resolved} (${rate}) prs_linked=${prs} reappears=${reappears} updated_at=${ledger.updated_at ?? 'n/a'}`);
    lines.push(`  - by_type: ${typeStr}`);
    lines.push(`  - by_status: ${statusStr}`);
  } else {
    lines.push('- `auto-fix-ledger.json`: _not readable / absent_');
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
const SECTION_IDS = ['workflows', 'tooling', 'bundle', 'coverage', 'flakes', 'parity', 'doclinks', 'extension', 'machine-reports', 'telemetry'];

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

function telemetrySinkSection() {
  // Runtime error-telemetry sink (Round 12): the loopback collector
  // (tools/telemetry-collector.mjs serve / telemetry-export.mjs) appends
  // validated browser errors to a local JSONL ledger. Summarize it here so the
  // chosen "self-hosted, aggregate into the OPS dashboard" path closes end to
  // end. Best-effort: absent/unreadable/degenerate sinks degrade to one note.
  const lines = [];
  lines.push('## Runtime Error Telemetry', '');
  const sink = path.join(ROOT, 'tools', '.tmp', 'telemetry', 'events.jsonl');
  if (!fs.existsSync(sink)) {
    lines.push('_sink absent — start the collector with `npm run telemetry:serve` (events land here once apps export via `node tools/telemetry-export.mjs`)_', '');
    return { id: 'telemetry', lines };
  }
  let events = [];
  try {
    events = fs.readFileSync(sink, 'utf8').split(/\r?\n/).filter((l) => l.trim().length > 0)
      .map((l) => JSON.parse(l));
  } catch {
    lines.push('_sink unreadable — check `tools/.tmp/telemetry/events.jsonl`_', '');
    return { id: 'telemetry', lines };
  }
  if (events.length === 0) {
    lines.push('_sink empty — nothing exported yet_', '');
    return { id: 'telemetry', lines };
  }
  const byApp = {};
  const byKind = {};
  const byMsg = {};
  let last = null;
  for (const e of events) {
    if (!e) continue;
    byApp[e.appId || 'unknown'] = (byApp[e.appId || 'unknown'] || 0) + 1;
    byKind[e.kind || 'unknown'] = (byKind[e.kind || 'unknown'] || 0) + 1;
    const key = `${e.appId || 'unknown'}: ${String(e.message || '').slice(0, 80)}`;
    byMsg[key] = (byMsg[key] || 0) + 1;
    const ts = e.receivedAt || e.ts;
    if (typeof ts === 'string' && (last === null || ts > last)) last = ts;
  }
  const fmt = (obj) => {
    const parts = Object.entries(obj).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([k, v]) => `${k}=${v}`);
    return parts.length > 0 ? parts.join(', ') : '—';
  };
  lines.push(`- events=${events.length} apps[${fmt(byApp)}] kinds[${fmt(byKind)}] last=${last ?? 'n/a'}`);
  lines.push('', 'Top messages:', '');
  for (const [k, v] of Object.entries(byMsg).sort((a, b) => b[1] - a[1]).slice(0, 5)) {
    lines.push(`- ${v}x \`${k.replace(/`/g, '')}\``);
  }
  lines.push('');
  return { id: 'telemetry', lines };
}

const sections = [
  workflowsSection(),
  toolingSection(),
  bundleSection(),
  coverageSection(),
  flakeSection(),
  toolOutputSection('parity', 'Fleet Mirror Parity', 'node tools/sync-parity.mjs check'),
  toolOutputSection('doclinks', 'Markdown Link Health', 'node tools/check-doc-links.mjs'),
  extensionSection(),
  machineReportsSection(),
  telemetrySinkSection(),
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


