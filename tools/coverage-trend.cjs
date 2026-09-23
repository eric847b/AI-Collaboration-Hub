#!/usr/bin/env node
'use strict';
/**
 * coverage-trend.cjs — workspace test-coverage ledger + trend views.
 *
 *   node tools/coverage-trend.cjs collect  [--ledger docs/metrics/coverage-history.json] [--note "..."]
 *   node tools/coverage-trend.cjs report   [--ledger ...] [--limit 5]
 *   node tools/coverage-trend.cjs markdown [--ledger ...] [--out docs/metrics/coverage-report.md]
 *
 * Mirrors the bundle-trend.cjs pattern: append-only ledger, report-only
 * commands (collect is the only writer), zero dependencies, plain Node.
 *
 * Data sources (read-only, never executes tests):
 *   - Node/vitest projects: <project>/coverage/coverage-summary.json (istanbul
 *     summary format, written by vitest --coverage / nyc). An empty or missing
 *     summary is recorded as a "pending" row, never a failure.
 *   - collabhub-modules: `npm test` plain-node suite; count of passed files is
 *     reported separately in the OPS Dashboard (static 18/18 contract).
 *   - Python projects: no coverage artifact is collected locally (CI advisory);
 *     the dashboard section shows "advisory / track via CI".
 *
 * Exit codes: 0 success (including "nothing collected"); 1 invalid usage.
 * collect/report/markdown NEVER fail the gate — coverage enforcement stays
 * with the per-project CI jobs (e.g. vitest --coverage gates at >=70%).
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const DEFAULT_LEDGER = path.join('docs', 'metrics', 'coverage-history.json');
const MAX_ENTRIES = 200;

// Projects whose coverage is tracked via a summary artifact (relative paths).
// Preferred artifact is the istanbul coverage-summary.json; when absent the
// tool falls back to decoding coverage-final.json (raw V8 per-file counters)
// with the same include/exclude semantics vitest applies locally:
//   include src/**/*.{ts,tsx}; exclude test/spec files, src/test/**,
//   src/main.tsx, src/vite-env.d.ts, src/App.tsx.
const COVERAGE_PROJECTS = [
  {
    name: 'nexus-infinity-hub',
    summaryPath: 'nexus-infinity-hub/coverage/coverage-summary.json',
    v8Path: 'nexus-infinity-hub/coverage/coverage-final.json',
    root: 'nexus-infinity-hub',
  },
  {
    name: 'self-evolve-dash',
    summaryPath: 'self-evolve-dash/coverage/coverage-summary.json',
    v8Path: 'self-evolve-dash/coverage/coverage-final.json',
    root: 'self-evolve-dash',
  },
];

// V8-decoder exclusion set: mirrors vitest.config.ts `coverage.exclude` for
// nexus-infinity-hub (test/spec files, setup dir, entry files). Paths are
// normalized to forward slashes and matched relative to the project root.
function v8Excluded(rel) {
  if (/(^|\/)[^/]*\.(test|spec)\.[^/]*$/.test(rel)) return true;
  if (rel.startsWith('src/test/')) return true;
  return rel === 'src/main.tsx' || rel === 'src/vite-env.d.ts' || rel === 'src/App.tsx';
}

// Decode raw V8 coverage (coverage-final.json) into istanbul-style
// { lines, statements, functions, branches } percentages. Only files under
// <root>/src/**.{ts,tsx} that survive v8Excluded() contribute.
function decodeV8(absPath, projectRoot) {
  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(absPath, 'utf8'));
  } catch {
    return null;
  }
  const files = parsed && typeof parsed === 'object' ? Object.keys(parsed) : [];
  let stmtHit = 0;
  let stmtTotal = 0;
  let fnHit = 0;
  let fnTotal = 0;
  let brHit = 0;
  let brTotal = 0;
  let counted = 0;
  for (const key of files) {
    const rel = path.relative(path.join(ROOT, projectRoot), key).split(path.sep).join('/');
    if (rel.startsWith('..') || !/^src\/.+\.tsx?$/.test(rel) || v8Excluded(rel)) continue;
    const entry = parsed[key];
    if (!entry || typeof entry !== 'object') continue;
    counted += 1;
    const s = entry.s || {};
    for (const id of Object.keys(s)) {
      stmtTotal += 1;
      if (s[id] > 0) stmtHit += 1;
    }
    const f = entry.f || {};
    for (const id of Object.keys(f)) {
      fnTotal += 1;
      if (f[id] > 0) fnHit += 1;
    }
    const b = entry.b || {};
    for (const id of Object.keys(b)) {
      const paths = Array.isArray(b[id]) ? b[id] : [b[id]];
      for (const n of paths) {
        brTotal += 1;
        if (n > 0) brHit += 1;
      }
    }
  }
  if (counted === 0 || (stmtTotal === 0 && fnTotal === 0 && brTotal === 0)) return null;
  const ratio = (hit, total) => (total > 0 ? (hit / total) * 100 : null);
  const lines = ratio(stmtHit, stmtTotal);
  return { lines, statements: lines, functions: ratio(fnHit, fnTotal), branches: ratio(brHit, brTotal) };
}
const NODE_TEST_PROJECT = 'collabhub-modules';

const argv = process.argv.slice(2);
const cmd = argv.find((a) => !a.startsWith('--')) || 'report';

function opt(name, def) {
  const i = argv.indexOf(name);
  return i >= 0 && i + 1 < argv.length ? argv[i + 1] : def;
}

function ledgerPath() {
  const given = opt('--ledger', '');
  return path.isAbsolute(given) ? given : path.join(ROOT, given || DEFAULT_LEDGER);
}

function gitSha() {
  try {
    return execSync('git rev-parse --short HEAD', { cwd: ROOT }).toString().trim();
  } catch {
    return 'unknown';
  }
}

function pct(n) {
  return n === null || n === undefined || Number.isNaN(n) ? null : Number(n);
}

// Read an istanbul coverage-summary.json; returns { lines, statements,
// functions, branches } percentages or null when absent/empty/unparseable.
function readIstanbulSummary(absPath) {
  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(absPath, 'utf8'));
  } catch {
    return null;
  }
  const total = parsed && parsed.total;
  if (!total) return null;
  const pick = (section) => {
    const s = total[section];
    return s && typeof s.pct === 'number' ? s.pct : null;
  };
  const out = {
    lines: pick('lines'),
    statements: pick('statements'),
    functions: pick('functions'),
    branches: pick('branches'),
  };
  // An empty summary (e.g. "{}" or a total with no numeric pcts) is pending.
  if (out.lines === null && out.statements === null && out.functions === null && out.branches === null) {
    return null;
  }
  return out;
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

function fmtPct(v) {
  return v === null || v === undefined ? 'n/a' : `${Number(v).toFixed(1)}%`;
}

function statusFor(summary) {
  if (!summary) return 'pending (no summary artifact - run vitest --coverage)';
  const lines = summary.lines;
  if (lines === null || lines === undefined) return 'pending';
  return lines >= 70 ? `pass (>=70% gate: ${Number(lines).toFixed(1)}% lines)` : `below gate (${Number(lines).toFixed(1)}% lines < 70%)`;
}

function snapshotProjects() {
  const projects = {};
  for (const p of COVERAGE_PROJECTS) {
    // Preferred: istanbul summary. Fallback: decode raw V8 counters.
    const fromSummary = readIstanbulSummary(path.join(ROOT, p.summaryPath));
    let summary = fromSummary;
    let artifact = p.summaryPath;
    let source = 'istanbul coverage-summary.json';
    if (!summary) {
      summary = decodeV8(path.join(ROOT, p.v8Path), p.root);
      if (summary) {
        artifact = p.v8Path;
        source = 'raw V8 coverage-final.json (vitest include/exclude applied)';
      }
    }
    projects[p.name] = { source, artifact, summary, status: statusFor(summary) };
  }
  return projects;
}

function collect() {
  const file = ledgerPath();
  const ledger = loadLedger(file);
  const entry = {
    timestamp: new Date().toISOString(),
    gitSha: gitSha(),
    note: opt('--note', ''),
    projects: snapshotProjects(),
  };
  ledger.entries.push(entry);
  while (ledger.entries.length > MAX_ENTRIES) ledger.entries.shift();
  saveLedger(file, ledger);
  console.log(`coverage-trend: snapshot recorded -> ${path.relative(ROOT, file)} (${entry.gitSha})`);
  for (const name of Object.keys(entry.projects).sort()) {
    const pr = entry.projects[name];
    const cov = pr.summary ? `lines ${fmtPct(pr.summary.lines)}, branches ${fmtPct(pr.summary.branches)}` : 'pending';
    console.log(`  ${name.padEnd(24)} ${cov}  [${pr.status}]`);
  }
  return 0;
}

function spark(values) {
  const blocks = ' .:-=+*#%@';
  const nums = values.filter((v) => v !== null && v !== undefined);
  if (nums.length === 0) return '(no data)';
  const lo = Math.min(...nums);
  const hi = Math.max(...nums);
  const span = hi - lo || 1;
  return values
    .map((v) => {
      if (v === null || v === undefined) return ' ';
      const idx = Math.min(blocks.length - 1, Math.floor(((v - lo) / span) * (blocks.length - 1)));
      return blocks[idx];
    })
    .join('');
}

function projectSeries(entries, name, metric) {
  return entries.map((e) => {
    const pr = e.projects && e.projects[name];
    const s = pr && pr.summary;
    return s ? pct(s[metric]) : null;
  });
}

function report() {
  const ledger = loadLedger(ledgerPath());
  const limit = Number(opt('--limit', '5'));
  const entries = ledger.entries.slice(-limit);
  if (entries.length === 0) {
    console.log('coverage-trend: ledger is empty. Run `collect` after running coverage in the Node projects.');
    return 0;
  }
  const names = Object.keys(entries[entries.length - 1].projects || {}).sort();
  for (const entry of entries) {
    console.log(`\n${entry.timestamp}  (${entry.gitSha}${entry.note ? `, ${entry.note}` : ''})`);
    for (const name of names) {
      const pr = (entry.projects || {})[name];
      if (!pr) {
        console.log(`  ${name.padEnd(24)} (not tracked in this snapshot)`);
        continue;
      }
      const s = pr.summary;
      const line = s
        ? `lines ${fmtPct(s.lines).padStart(7)}  stmts ${fmtPct(s.statements).padStart(7)}  funcs ${fmtPct(s.functions).padStart(7)}  br ${fmtPct(s.branches).padStart(7)}`
        : 'pending (no summary artifact)';
      console.log(`  ${name.padEnd(24)} ${line}`);
    }
  }
  console.log('\nTrend (lines %):');
  for (const name of names) {
    const series = projectSeries(entries, name, 'lines');
    console.log(`  ${name.padEnd(24)} ${spark(series)}  (latest ${fmtPct(series[series.length - 1])})`);
  }
  console.log('');
  return 0;
}

function markdown() {
  const file = ledgerPath();
  const outArg = opt('--out', '');
  const outPath = path.isAbsolute(outArg)
    ? outArg
    : path.join(ROOT, outArg || path.join('docs', 'metrics', 'coverage-report.md'));
  const ledger = loadLedger(file);
  const entries = ledger.entries.slice(-8).reverse();
  if (entries.length === 0) {
    console.log('coverage-trend: ledger is empty; nothing to render.');
    return 0;
  }
  const latest = entries[0];
  const names = Object.keys(latest.projects || {}).sort();
  const out = [];
  out.push('# Coverage Trend Report');
  out.push('');
  out.push('> Auto-generated by `node tools/coverage-trend.cjs markdown` — do not hand-edit.');
  out.push(`> Latest snapshot: ${latest.timestamp} (${latest.gitSha}${latest.note ? `, ${latest.note}` : ''}).`);
  out.push('');
  out.push('## Latest');
  out.push('');
  out.push('| Project | Lines | Statements | Functions | Branches | Status |');
  out.push('|---------|------:|-----------:|----------:|---------:|--------|');
  for (const name of names) {
    const pr = latest.projects[name] || {};
    const s = pr.summary || {};
    out.push(
      `| ${name} | ${fmtPct(s.lines)} | ${fmtPct(s.statements)} | ${fmtPct(s.functions)} | ${fmtPct(s.branches)} | ${pr.status || 'pending'} |`
    );
  }
  if (entries.length > 1) {
    out.push('');
    out.push(`## Trend — lines % (last ${entries.length} snapshots, oldest first)`);
    out.push('');
    out.push('```text');
    const chrono = [...entries].reverse();
    for (const name of names) {
      const series = projectSeries(chrono, name, 'lines');
      out.push(`${name.padEnd(24)} ${spark(series)}  (latest ${fmtPct(series[series.length - 1])})`);
    }
    out.push('```');
    out.push('');
    out.push('## Snapshots');
    out.push('');
    out.push(`| Snapshot | ${names.join(' | ')} |`);
    out.push(`|----------|${names.map(() => '----------|').join('')}`);
    for (const e of entries) {
      const cells = names.map((n) => {
        const pr = (e.projects || {})[n];
        return pr && pr.summary && pr.summary.lines !== null && pr.summary.lines !== undefined
          ? fmtPct(pr.summary.lines)
          : 'n/a';
      });
      out.push(`| ${e.timestamp} | ${cells.join(' | ')} |`);
    }
  }
  out.push('');
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, out.join('\n') + '\n', 'utf8');
  console.log(`coverage-trend: markdown report -> ${path.relative(ROOT, outPath)}`);
  return 0;
}

function main() {
  if (cmd === 'collect') return collect();
  if (cmd === 'report') return report();
  if (cmd === 'markdown') return markdown();
  console.error(`coverage-trend: unknown command "${cmd}" (expected: collect | report | markdown)`);
  return 1;
}

process.exitCode = main();
