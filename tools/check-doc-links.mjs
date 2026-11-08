import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * check-doc-links.mjs — verifies that every relative link in tracked Markdown files
 * resolves to a real file in this workspace (and that any `#anchor` fragment resolves
 * to a real heading in the target file). Catches stale doc references after
 * moves/renames/deletions (the exact failure mode of the 2026-09 doc consolidation).
 *
 *   node tools/check-doc-links.mjs            # report + exit 1 on broken links
 *   node tools/check-doc-links.mjs --quiet    # only print broken links
 *   node tools/check-doc-links.mjs --help     # usage (Round 12 D: unknown flags exit 2)
 *   node tools/check-doc-links.mjs --self-test # prove the scanners fire (22 checks)
 *
 * Skips: node_modules/.git/build/dist/.venv/docs/api (generated), external URLs, pure anchors.
 */
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BASELINE_PATH = path.join(ROOT, 'docs', 'metrics', 'doc-links-baseline.json');

// ── Non-interactive argv tokenizer (Round 12 D hardening) ──────────────
// Boolean flags only; unknown flags and stray positionals exit 2 instead
// of being silently ignored. No stdin prompts, ever.
const argv = process.argv.slice(2);
const BOOLEAN_FLAGS = new Set(['--quiet', '--json', '--self-test', '--list', '--count', '--version', '--suggest', '--check', '--update-baseline', '--fail-fast']);
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
    if (!BOOLEAN_FLAGS.has(key)) {
      console.error(`check-doc-links: unknown flag "${key}" — see \`node tools/check-doc-links.mjs --help\``);
      process.exit(2);
    }
    if (eq >= 0) {
      console.error(`check-doc-links: flag "${key}" takes no value — see \`node tools/check-doc-links.mjs --help\``);
      process.exit(2);
    }
    flags[key] = true;
    continue;
  }
  positionals.push(a);
}

function usage() {
  console.log(
    [
      'check-doc-links.mjs — verify relative links in tracked Markdown resolve (non-interactive)',
      '',
      'Usage: node tools/check-doc-links.mjs [--quiet] [--json] [--list] [--check] [--update-baseline]',
      '',
      'Flags:',
      '  --quiet   only print broken links (no summary line)',
      '  --json    emit machine-readable JSON (files, checked, broken, brokenLinks[] with line numbers)',
      '  --self-test prove the scanners fire on synthetic fixtures and exit',
      '  --list    enumerate every relative link with verdict (ok/broken)',
      '  --suggest print "did you mean?" suggestions for broken links',
      '  --fail-fast  stop at the first broken link (CI-friendly)',
      '  --version print version and exit 0',
      '  --help    print this text and exit 0',
      '',
      'Exit codes: 0 = all links resolve, 1 = broken links found, 2 = bad usage.',
      'Unknown flags and unexpected arguments exit 2.',
    ].join('\n'),
  );
}

if (flags['--help']) {
  usage();
  process.exit(0);
}
if (flags['--version']) {
  console.log('check-doc-links 1.1.0');
  process.exit(0);
}
if (positionals.length) {
  console.error(`check-doc-links: unexpected argument "${positionals[0]}" — flags only (see \`node tools/check-doc-links.mjs --help\`)`);
  process.exit(2);
}
const quiet = flags['--quiet'] === true;
const countMode = flags['--count'] === true;
const failFast = flags['--fail-fast'] === true;
const checkMode = flags['--check'] === true;
const updateBaseline = flags['--update-baseline'] === true;
const SKIP_DIRS = new Set([
  'node_modules', '.git', 'build', 'dist', '.venv', '.output', 'AppData',
  'docs/api', '.vexp', '.renitor', '.pytest_cache', '.ruff_cache',
  'modular-hub-modernization',
]);
const LINK_RE = /\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;

function levenshtein(a, b) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    let cur = [i];
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i-1] === b[j-1] ? 0 : 1;
      cur[j] = Math.min(prev[j] + 1, cur[j-1] + 1, prev[j-1] + cost);
    }
    prev = cur;
  }
  return prev[b.length];
}
function suggestFile(target, allFiles) {
  const base = path.basename(target);
  let best = null; let bestD = Infinity;
  for (const f of allFiles) {
    const d = levenshtein(base, path.basename(f));
    if (d < bestD) { bestD = d; best = f; }
  }
  return bestD <= 4 ? best : null;
}
function githubSlug(heading) {
  return String(heading)
    .trim()
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-');
}
const _headingCache = new Map();
function headingsFor(absPath) {
  if (_headingCache.has(absPath)) return _headingCache.get(absPath);
  let set = new Set();
  try {
    const text = fs.readFileSync(absPath, 'utf8');
    // ATX headings: # Heading
    for (const m of text.matchAll(/^#{1,6}\s+(.+?)\s*#*\s*$/gm)) {
      set.add(githubSlug(m[1]));
    }
    // Setext headings: Heading\n==== or Heading\n----
    for (const m of text.matchAll(/^(.+)\n(=+|-+)\s*$/gm)) {
      if (m[2].startsWith('=')) set.add(githubSlug(m[1]));
      else if (m[2].startsWith('-') && m[1].trim().length > 0) set.add(githubSlug(m[1]));
    }
    // HTML anchors: <a name="x">, <a id="x">, <hN id="x">
    for (const m of text.matchAll(/<(?:a|h[1-6])\b[^>]*?\s(?:name|id)\s*=\s*["']([^"']+)["'][^>]*>/gi)) {
      set.add(githubSlug(m[1]));
    }
  } catch { set = new Set(); }
  _headingCache.set(absPath, set);
  return set;
}


function suggestAnchor(absPath, fragment) {
  const hs = [...headingsFor(absPath)];
  if (!hs.length) return null;
  const target = githubSlug(decodeURIComponent(fragment));
  let best = null; let bestD = Infinity;
  for (const h of hs) {
    const d = levenshtein(target, h);
    if (d < bestD) { bestD = d; best = h; }
  }
  return bestD <= 4 && best !== target ? `#${best}` : null;
}


function isMarkdown(file) {
  return /\.(md|mdx)$/i.test(file);
}

function walk(dir, out) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) {
      const rel = path.relative(ROOT, path.join(dir, e.name)).split(path.sep).join('/');
      if (SKIP_DIRS.has(e.name) || SKIP_DIRS.has(rel) || e.name.startsWith('.')) continue;
      walk(path.join(dir, e.name), out);
    } else if (e.isFile() && isMarkdown(e.name)) {
      out.push(path.join(dir, e.name));
    }
  }
  return out;
}

/**
 * Pure link scanners, extracted from the main loop so --self-test drives the
 * EXACT production path instead of a copy that can silently drift.
 */
function isCheckableLink(raw) {
  const r = raw.trim();
  if (!r || r.startsWith('#') || /^[a-z]+:/i.test(r)) return false; // anchors, http(s):, mailto:, etc.
  return decodeURIComponent(r.split('#')[0]).length > 0;
}

function scanLinks(text, fileAbs) {
  const rows = [];
  LINK_RE.lastIndex = 0;
  let m;
  while ((m = LINK_RE.exec(text)) !== null) {
    const raw = m[1].trim();
    if (!isCheckableLink(raw)) continue;
    const hashIdx = raw.indexOf('#');
    const filePart = hashIdx >= 0 ? raw.slice(0, hashIdx) : raw;
    const fragment = hashIdx >= 0 ? raw.slice(hashIdx + 1) : '';
    const queryIdx = filePart.indexOf('?');
    const filePath = queryIdx >= 0 ? filePart.slice(0, queryIdx) : filePart;
    const target = decodeURIComponent(filePath);
    const abs = path.resolve(path.dirname(fileAbs), target);
    const fileExists = fs.existsSync(abs);
    let anchorOk = true;
    if (fileExists && fragment) {
      anchorOk = headingsFor(abs).has(githubSlug(decodeURIComponent(fragment)));
    }
    const exists = fileExists && anchorOk;
    const line = text.slice(0, m.index).split('\n').length;
    rows.push({ raw, target, fragment, abs, exists, anchorOk, fileExists, line });
  }
  return rows;
}

/**
 * Self-test: drive the REAL scanners with synthetic Markdown and assert the
 * classification, so a green run is evidence rather than an assumption. Covers
 * the four link kinds that must be SKIPPED (anchor, http/https/mailto), a
 * resolvable target, a missing target, #anchor stripping, the optional "title"
 * suffix, percent-encoding, and the non-interactive CLI contract (--help exit 0,
 * unknown flag / stray positional exit 2). Dispatched BELOW the const
 * declarations because it reaches LINK_RE/ROOT (temporal dead zone).
 */
function runSelfTest() {
  const cases = [];
  const check = (name, actual, expected) =>
    cases.push({ name, pass: JSON.stringify(actual) === JSON.stringify(expected), actual, expected });

  // ---- pure classification (no filesystem) ----
  check('anchor-only is skipped', isCheckableLink('#section'), false);
  check('http is skipped', isCheckableLink('http://x.example/a.md'), false);
  check('https is skipped', isCheckableLink('https://x.example/a.md'), false);
  check('mailto is skipped', isCheckableLink('mailto:a@b.c'), false);
  check('relative path is checkable', isCheckableLink('./docs/x.md'), true);
  check('bare filename is checkable', isCheckableLink('AGENTS.md'), true);
  check('empty target is skipped', isCheckableLink(''), false);

  // ---- scanLinks against a real file (this tool's own directory) ----
  const selfDir = path.join(ROOT, 'tools');
  const rows = scanLinks(
    [
      '[ok](TOOLING_GUIDE.md)', // real file next to the synthetic doc
      '[missing](definitely/not/here.md)', // never exists
      '[email](mailto:a@b.c)', // skipped
      '[anchor](#top)', // skipped
      '[web](https://example.com/x.md)', // skipped
      '[titled](TOOLING_GUIDE.md "T")', // title suffix, real target
      '[anchored](TOOLING_GUIDE.md#quick-start)', // #stripped + anchor must resolve to a real heading
      '[badanchor](TOOLING_GUIDE.md#definitely-not-a-heading)', // anchor does not resolve -> broken
      '[queried](TOOLING_GUIDE.md?v=1)', // query string stripped, real target
      '[encoded](TOOLING%5F%47UIDE.md)', // decodeURIComponent -> TOOLING_GUIDE.md
    ].join('\n'),
    path.join(selfDir, 'SYNTHETIC.md'),
  );
  check('scanLinks counts only checkable links', rows.length, 7);
  check('scanLinks keeps the resolvable targets', rows.filter((r) => r.exists).length, 5);
  check('scanLinks flags the missing target', rows.filter((r) => !r.exists).map((r) => r.raw), [
    'definitely/not/here.md',
    'TOOLING_GUIDE.md#definitely-not-a-heading',
  ]);
  check('anchor is stripped from the path', rows.some((r) => r.target === 'TOOLING_GUIDE.md'), true);
  check('percent-encoding is decoded', rows.some((r) => r.raw.includes('%5F') && r.target === 'TOOLING_GUIDE.md'), true);

  // ---- CLI contract, end to end (the child runs WITHOUT --self-test) ----
  const cli = (args) => {
    const r = spawnSync(process.execPath, [fileURLToPath(import.meta.url), ...args], {
      cwd: ROOT,
      encoding: 'utf8',
      timeout: 60000,
    });
    return { code: r.status, out: `${r.stdout || ''}${r.stderr || ''}` };
  };
  check('--help exits 0', cli(['--help']).code, 0);
  check('unknown flag exits 2', cli(['--nope']).code, 2);
  check('--list exits 0', cli(['--list']).code, 0);
  check('--suggest exits 0', cli(['--suggest']).code, 0);
   const cr = cli(['--check']);
   check('--check exits 0 or 1 (not 2)', cr.code === 0 || cr.code === 1, true);
  check('unexpected positional exits 2', cli(['extra']).code, 2);
  const jr = cli(['--json']);
  check('--json exits 0', jr.code, 0);
  let jok = false;
  try { const j = JSON.parse(jr.out); jok = Array.isArray(j.brokenLinks) && typeof j.files === 'number'; } catch { jok = false; }
  check('suggestAnchor suggests closest heading', suggestAnchor(path.join(selfDir, 'TOOLING_GUIDE.md'), 'quik-start'), '#quick-start');
  check('suggestAnchor returns null for exact match', suggestAnchor(path.join(selfDir, 'TOOLING_GUIDE.md'), 'quick-start'), null);
  check('--json emits parseable JSON', jok, true);

  const failed = cases.filter((c) => !c.pass);
  for (const c of failed) {
    console.error(`FAIL  ${c.name}`);
    console.error(`      expected ${JSON.stringify(c.expected)}`);
    console.error(`      actual   ${JSON.stringify(c.actual)}`);
  }
  console.log(`check-doc-links self-test: ${cases.length - failed.length}/${cases.length} passed`);
  process.exit(failed.length > 0 ? 1 : 0);
}

// Dispatched here, BELOW the const declarations: runSelfTest() reaches LINK_RE/ROOT.
if (flags['--self-test'] === true) runSelfTest();

const listMode = flags['--list'] === true;
const suggestMode = flags['--suggest'] === true;
const files = walk(ROOT, []);
const jsonMode = flags['--json'] === true;
let broken = 0;
let checked = 0;
const brokenLinks = [];
const allLinks = [];
for (const file of files) {
  if (failFast && broken > 0) break;
  const relFile = path.relative(ROOT, file).split(path.sep).join('/');
  const text = fs.readFileSync(file, 'utf8');
  for (const row of scanLinks(text, file)) {
    checked += 1;
    allLinks.push({ file: relFile, target: row.target, fragment: row.fragment, raw: row.raw, line: row.line, exists: row.exists, anchorOk: row.anchorOk });
    if (!row.exists) {
      broken += 1;
      brokenLinks.push({ file: relFile, target: row.target, fragment: row.fragment, raw: row.raw, line: row.line });
      const fileSug = suggestMode ? suggestFile(row.target, files.map((f) => path.relative(ROOT, f))) : null;
      const anchorSug = suggestMode && row.fileExists && row.fragment && !row.anchorOk ? suggestAnchor(row.abs, row.fragment) : null;
      const sug = fileSug || anchorSug;
      if (!jsonMode) console.log(`BROKEN  ${relFile}  ->  ${row.raw}` + (sug ? `  (did you mean "${sug}"?)` : ''));
      if (failFast) break;
    } else if (listMode && !jsonMode) {
      console.log(`OK      ${relFile}  ->  ${row.raw}`);
    }
  }
}
if (jsonMode) {
  const payload = { files: files.length, checked, broken, brokenLinks };
  if (listMode) payload.links = allLinks.map((r) => ({ ...r, verdict: r.exists ? 'ok' : 'broken' }));
  console.log(JSON.stringify(payload, null, 2));
} else if (!quiet && !countMode) {
  console.log(`\ncheck-doc-links: ${files.length} markdown files, ${checked} relative links checked, ${broken} broken`);
}
// ---- ratchet baseline (optional) -----------------------------------------
const linkKey = (b) => `${b.file}::${b.target}#${b.fragment || ''}`;
if (updateBaseline) {
  const baseline = { generatedAt: new Date().toISOString(), count: brokenLinks.length, links: brokenLinks.map(linkKey) };
  fs.mkdirSync(path.dirname(BASELINE_PATH), { recursive: true });
  fs.writeFileSync(BASELINE_PATH, JSON.stringify(baseline, null, 2) + '\n');
  if (!quiet) console.log('baseline updated: ' + brokenLinks.length + ' accepted broken links -> ' + path.relative(ROOT, BASELINE_PATH));
}
let newBroken = broken;
if (checkMode) {
  let baseline = null;
  try { baseline = JSON.parse(fs.readFileSync(BASELINE_PATH, 'utf8')); } catch { baseline = null; }
  if (!baseline) {
    console.error('check-doc-links: no baseline at ' + path.relative(ROOT, BASELINE_PATH) + ' - run with --update-baseline first');
    process.exit(2);
  }
  const accepted = new Set(baseline.links || []);
  const newLinks = brokenLinks.filter((b) => !accepted.has(linkKey(b)));
  newBroken = newLinks.length;
  const resolved = (baseline.links || []).filter((k) => !brokenLinks.some((b) => linkKey(b) === k)).length;
  if (!quiet) {
    console.log('baseline: ' + (baseline.links || []).length + ' accepted, current: ' + brokenLinks.length + ', new: ' + newLinks.length + ', resolved: ' + resolved);
    for (const b of newLinks) console.log('NEW-BROKEN  ' + b.file + ':' + b.line + '  ->  ' + b.raw);
  }
}
if (countMode) { console.log(checked); process.exit(0); }
process.exit(checkMode ? (newBroken > 0 ? 1 : 0) : (broken > 0 ? 1 : 0));
