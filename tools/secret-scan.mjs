#!/usr/bin/env node
/**
 * secret-scan.mjs - offline, dependency-free local counterpart of
 * .github/workflows/secret-scan.yml (durable rule #4: no secrets in the repo).
 *
 * The CI job can only tell you *after* you push. This runs the same rule set
 * locally, in ~1s, against the content you are actually about to ship:
 *
 *   node tools/secret-scan.mjs                # scan git-tracked files (working-tree content)
 *   node tools/secret-scan.mjs --staged       # scan the git INDEX (pre-commit use)
 *   node tools/secret-scan.mjs --all          # tracked + untracked-but-unignored
 *   node tools/secret-scan.mjs --strict       # warnings also fail (exit 1)
 *   node tools/secret-scan.mjs --self-test    # prove the detectors actually fire
 *   node tools/secret-scan.mjs --check-ci     # CI-twin parity assertions only
 *   node tools/secret-scan.mjs --list-rules   # print the compiled rule table
 *   node tools/secret-scan.mjs --quiet        # findings only (CI / hooks)
 *   node tools/secret-scan.mjs --json         # machine-readable report
 *   node tools/secret-scan.mjs --help         # usage
 *
 * Design notes
 *   - Offline and read-only: never writes, never calls the network, never mutates the index.
 *   - Provider rules mirror the CI regex list 1:1 so local and CI cannot drift.
 *   - Findings are REDACTED (prefix + length only) so a scan report can be pasted
 *     into a chat/issue without leaking the very secret it reports.
 *   - Placeholder/env-expansion lines are suppressed (YOUR_KEY, process.env, <...>, etc.).
 *   - `--self-test` builds synthetic tokens at RUNTIME (never literals in this file)
 *     and asserts every rule fires plus that clean lines stay clean - a green run of
 *     the scanner is evidence, not an assumption.
 *
 * Exit codes: 0 clean * 1 findings (errors, or warnings under --strict) * 2 setup error.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const has = (flag) => argv.includes(flag);
const quiet = has('--quiet');
const asJson = has('--json');
const strict = has('--strict');
const staged = has('--staged');
const includeUntracked = has('--all');
const selfTest = has('--self-test');
const verbose = has('--verbose');
const checkCi = has('--check-ci');
const listRules = has('--list-rules');

const MAX_BYTES = 2 * 1024 * 1024;

/**
 * Files that legitimately *document* the secret formats (this scanner and its CI
 * twin). They hold regex source, not secrets, and are excluded by design.
 */
const PATTERN_DOC_FILES = new Set(['tools/secret-scan.mjs', '.github/workflows/secret-scan.yml']);

/** Regex sources are kept as strings so this file never contains a matching literal. */
const RULES = [
  { id: 'openai-legacy', severity: 'error', re: '\\bsk-[A-Za-z0-9]{48}\\b' },
  { id: 'openai-project', severity: 'error', re: '\\bsk-proj-[A-Za-z0-9_-]{32,}' },
  { id: 'anthropic', severity: 'error', re: '\\bsk-ant-[A-Za-z0-9_-]{48,}' },
  { id: 'openrouter', severity: 'error', re: '\\bsk-or-v1-[a-f0-9]{32,64}' },
  { id: 'groq', severity: 'error', re: '\\bgsk_[A-Za-z0-9]{20,}' },
  { id: 'github-pat-classic', severity: 'error', re: '\\bghp_[A-Za-z0-9]{36}\\b' },
  { id: 'github-oauth', severity: 'error', re: '\\bgho_[A-Za-z0-9]{36}\\b' },
  { id: 'github-pat-fine-grained', severity: 'error', re: '\\bgithub_pat_[A-Za-z0-9_]{22,}' },
  { id: 'github-app-token', severity: 'error', re: '\\bghs_[A-Za-z0-9]{36}\\b' },
  { id: 'github-refresh-token', severity: 'error', re: '\\bghr_[A-Za-z0-9]{36}\\b' },
  { id: 'google-api-key', severity: 'error', re: '\\bAIza[A-Za-z0-9_-]{35}\\b' },
  { id: 'aws-access-key-id', severity: 'error', re: '\\bAKIA[0-9A-Z]{16}\\b' },
  { id: 'slack-token', severity: 'error', re: '\\bxox[baprs]-[A-Za-z0-9-]{10,}' },
  { id: 'stripe-live-key', severity: 'error', re: '\\bsk_live_[A-Za-z0-9]{24,}' },
  { id: 'huggingface-token', severity: 'error', re: '\\bhf_[A-Za-z0-9]{34,}' },
  { id: 'npm-token', severity: 'error', re: '\\bnpm_[A-Za-z0-9]{36}\\b' },
  { id: 'private-key-block', severity: 'error', re: '-----BEGIN [A-Z ]*PRIVATE KEY-----' },
  { id: 'jwt-token', severity: 'warn', re: '\\beyJ[A-Za-z0-9_-]{8,}\\.[A-Za-z0-9_-]{8,}\\.[A-Za-z0-9_-]{8,}' },
  {
    id: 'generic-high-entropy-assignment',
    severity: 'warn',
    flags: 'gi',
    re: '(?:api[_-]?key|apikey|access[_-]?key|secret|token|passw(?:or)?d|credential)["\']?\\s*[:=]\\s*["\']([A-Za-z0-9+/_=-]{32,})["\']',
    captureGroup: 1,
    minEntropy: 4.5,
  },
  {
    id: 'generic-long-hex-assignment',
    severity: 'warn',
    flags: 'gi',
    re: '(?:key|secret|token|credential)["\']?\\s*[:=]\\s*["\']([0-9a-f]{40,})["\']',
    captureGroup: 1,
    minEntropy: 3.4,
  },
];

/** Placeholder / env-expansion markers - a line containing any of these is not a leaked secret. */
const PLACEHOLDER = new RegExp(
  [
    'process\\.env',
    'import\\.meta\\.env',
    'os\\.environ',
    'getenv\\(',
    'EnvVar',
    'YOUR[_-]?[A-Z]*KEY',
    'your[-_][a-z-]*key',
    'xxxx',
    '<[A-Za-z0-9_.-]{2,}>',
    'placeholder',
    'redacted',
    'changeme',
    'change[_-]me',
    'dummy',
    'not[_-]?a[_-]?real',
    'abc123',
    'example\\.com',
    'foobar',
  ].join('|'),
  'i',
);

function sh(cmd, args) {
  return execFileSync(cmd, args, {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    maxBuffer: 64 * 1024 * 1024,
  });
}

function shZ(cmd, args) {
  const out = execFileSync(cmd, args, {
    cwd: ROOT,
    encoding: 'buffer',
    stdio: ['ignore', 'pipe', 'pipe'],
    maxBuffer: 64 * 1024 * 1024,
  });
  return out.toString('utf8').split('\0').filter(Boolean);
}

/** Shannon entropy per character; random base64 ~5.7-6.0, random hex ~4.0, prose ~4.2. */
function entropy(s) {
  const counts = new Map();
  for (const ch of s) counts.set(ch, (counts.get(ch) || 0) + 1);
  let h = 0;
  for (const n of counts.values()) {
    const p = n / s.length;
    h -= p * Math.log2(p);
  }
  return h;
}

/** Never echo a full credential into a report. */
function redact(value) {
  if (value.length <= 8) return `${value[0]}***(${value.length})`;
  return `${value.slice(0, 4)}***(${value.length} chars)`;
}

function compileRules(rules = RULES) {
  return rules.map((r) => ({ ...r, rx: new RegExp(r.re, r.flags || 'g') }));
}

/**
 * CI-twin pattern list, parsed out of .github/workflows/secret-scan.yml at
 * runtime. Stops the local rule set from silently drifting away from the CI
 * gate: if CI learns a pattern, --self-test fails until a synthetic sample
 * exercises it locally too. Returns null when the workflow is unreadable.
 */
function ciAlternations() {
  let yml;
  try {
    yml = fs.readFileSync(path.join(ROOT, '.github', 'workflows', 'secret-scan.yml'), 'utf8');
  } catch {
    return null;
  }
  const m = yml.match(/git grep -rIn -E '\(([^)]*)\)'/);
  if (!m) return null;
  return m[1]
    .split('|')
    .map((s) => s.trim())
    .filter(Boolean);
}

/** One failure string per CI pattern with no local sample ([] = in lockstep). */
function ciParityFailures(sample) {
  const alts = ciAlternations();
  if (!alts) return ['cannot parse the CI pattern list from .github/workflows/secret-scan.yml'];
  const failures = [];
  for (const alt of alts) {
    let rx;
    try {
      rx = new RegExp(alt);
    } catch {
      failures.push(`CI pattern is not a valid regex: ${alt}`);
      continue;
    }
    if (!Object.values(sample).some((v) => rx.test(v))) {
      failures.push(`CI pattern has no synthetic sample: ${alt}`);
    }
  }
  return failures;
}

/**
 * This file must never contain a literal that CI's `git grep` would flag —
 * the synthetic samples are therefore assembled at runtime, and this check
 * proves it permanently.
 */
function selfSourceHits() {
  const alts = ciAlternations();
  if (!alts) return [];
  const rx = new RegExp(`(?:${alts.join('|')})`, 'g');
  const lines = fs.readFileSync(path.join(ROOT, 'tools', 'secret-scan.mjs'), 'utf8').split(/\r?\n/);
  const hits = [];
  for (let i = 0; i < lines.length; i += 1) {
    const m = lines[i].match(rx);
    if (m) hits.push(`line ${i + 1}: ${redact(m[0])}`);
  }
  return hits;
}

/** Scan one text blob; returns findings {rule, severity, path, line, evidence, preview}. */
function scanText(relPath, text, rules) {
  const findings = [];
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    for (const rule of rules) {
      rule.rx.lastIndex = 0;
      const m = rule.rx.exec(line);
      if (!m) continue;
      const value = rule.captureGroup ? m[rule.captureGroup] : m[0];
      if (!value) continue;
      if (!verbose && PLACEHOLDER.test(line)) continue;
      if (rule.minEntropy && entropy(value) < rule.minEntropy) continue;
      findings.push({
        rule: rule.id,
        severity: rule.severity,
        path: relPath,
        line: i + 1,
        evidence: redact(value),
        preview: line.trim().slice(0, 90).split(value).join(redact(value)),
      });
    }
  }
  return findings;
}

// ---- CLI: --help / --list-rules (after RULES so the table exists) -------------
if (has('--help') || has('-h')) {
  console.log(`secret-scan.mjs - offline, read-only local twin of .github/workflows/secret-scan.yml

usage: node tools/secret-scan.mjs [options]

  --staged       scan the git INDEX (pre-commit use)
  --all          tracked + untracked-but-unignored files
  --self-test    prove every detector fires, clean lines stay clean, every CI
                 pattern is exercised, and THIS FILE would not trip CI
  --check-ci     CI-twin parity assertions only
  --list-rules   print the rule table and exit
  --json         machine-readable report
  --strict       warnings also fail (exit 1)
  --quiet        findings only
  --verbose      keep placeholder / env-expansion lines
  -h, --help     this text

exit codes: 0 clean | 1 findings | 2 setup error`);
  process.exit(0);
}

if (listRules) {
  console.log('\\n# secret-scan rules');
  console.log('| Rule | Severity | Pattern |');
  console.log('|------|----------|---------|');
  for (const r of RULES) console.log(`| ${r.id} | ${r.severity} | \`${r.re}\` |`);
  const ci = ciAlternations();
  console.log(
    `\\n${RULES.length} local rules | CI twin: ${
      ci ? `${ci.length} patterns parsed from secret-scan.yml` : 'workflow not readable'
    }`,
  );
  process.exit(0);
}

// ---- self-test: prove the detectors fire, and that clean lines stay clean -----
if (selfTest || checkCi) {
  const rules = compileRules();
  const b64 = 'aB3/dE5+fG7hI9jK1lM3nO5pQ7rS9tU1';
  const sample = {
    'openai-legacy': `sk-${'A1b2C3d4'.repeat(6)}`,
    'openai-project': `sk-proj-${'aB3dE5gH7jK9lM1nO3qR5sT7'.repeat(2)}`,
    anthropic: `sk-ant-${'Api01-'.repeat(8)}`,
    openrouter: `sk-or-v1-${'a1b2c3d4'.repeat(4)}`,
    groq: `gsk_${'Zx9'.repeat(7)}`,
    'github-pat-classic': `ghp_${'Aa1'.repeat(12)}`,
    'github-oauth': `gho_${'Zz9'.repeat(12)}`,
    'github-pat-fine-grained': `github_pat_${'11ABCDEFG0a'.repeat(2)}`,
    'github-app-token': `ghs_${'Qq1'.repeat(12)}`,
    'github-refresh-token': `ghr_${'Mm1'.repeat(12)}`,
    'google-api-key': `AIza${'SyD9_'.repeat(7)}`,
    'aws-access-key-id': `AKIA${'QWERTYUIOPASDFGH'}`,
    'slack-token': `xox${'b-'}${'123456789012'}-AbCdEfGhIjKl`,
    'stripe-live-key': `sk_live_${'51AbCdEfGhIjKlMnOpQrStUv'}`,
    'huggingface-token': `hf_${'AbCdEfGhIjKlMnOpQrStUvWxYz0123456789'}`,
    'npm-token': `npm_${'Ab1'.repeat(12)}`,
    'private-key-block': `-----BEGIN ${'RSA '}PRIVATE KEY-----`,
    'jwt-token': 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dQw4w9WgXcQ-abcdef',
    'generic-high-entropy-assignment': `apiKey = "${b64}${b64}"`,
    'generic-long-hex-assignment': `secret = "3f8a1c9e7b5d2f4a6c8e0b1d3f5a7c9e2b4d6f8a"`,
  };
  const clean = [
    'const apiKey = process.env.OPENAI_API_KEY;',
    'OPENAI_API_KEY=YOUR_KEY_HERE',
    'const token = "<your-token>";',
    'const secret = "changeme";',
    '// see .github/workflows/secret-scan.yml for the pattern list',
    'const url = "https://api.openai.com/v1/models";',
  ];
  const failures = [];
  for (const [id, value] of Object.entries(sample)) {
    const hits = scanText('<synthetic>', value, rules).filter((f) => f.rule === id);
    if (hits.length === 0) failures.push(`detector miss: ${id}`);
    else if (hits[0].evidence.includes(value.slice(-12))) failures.push(`redaction leak: ${id}`);
  }
  for (const line of clean) {
    const hits = scanText('<clean>', line, rules);
    if (hits.length > 0) failures.push(`false positive on clean line (${hits[0].rule}): ${line}`);
  }
  // Bound to CI in both directions: every CI pattern must be exercised here,
  // and this file must not itself contain a CI-matchable literal.
  failures.push(...ciParityFailures(sample));
  for (const hit of selfSourceHits()) failures.push(`self-source would trip the CI grep (${hit})`);
  const ciCount = (ciAlternations() || []).length;
  if (asJson) {
    console.log(
      JSON.stringify(
        {
          rules: rules.length,
          samples: Object.keys(sample).length,
          cleanLines: clean.length,
          ciPatterns: ciCount,
          failures,
          ok: failures.length === 0,
        },
        null,
        2,
      ),
    );
  } else {
    console.log(`\n# secret-scan ${selfTest ? 'self-test' : 'CI parity'}`);
    console.log(
      `detectors: ${Object.keys(sample).length}/${rules.length} exercised | ${clean.length} clean lines | ${ciCount} CI patterns mirrored`,
    );
    for (const f of failures) console.log(`FAIL  ${f}`);
    if (failures.length === 0) console.log('RESULT: clean');
  }
  process.exit(failures.length === 0 ? 0 : 1);
}

// ---- source selection --------------------------------------------------------
let files;
let sourceLabel;
try {
  if (staged) {
    files = shZ('git', ['diff', '--cached', '--name-only', '--diff-filter=ACMR', '-z']);
    sourceLabel = 'git index (staged)';
  } else if (includeUntracked) {
    files = [...shZ('git', ['ls-files', '-z']), ...shZ('git', ['ls-files', '--others', '--exclude-standard', '-z'])];
    sourceLabel = 'tracked + untracked-unignored';
  } else {
    files = shZ('git', ['ls-files', '-z']);
    sourceLabel = 'git-tracked';
  }
} catch (e) {
  console.error(`secret-scan: cannot enumerate files (${String(e.message).split('\n')[0]})`);
  console.error('secret-scan: run this inside the repository working tree, with git available.');
  process.exit(2);
}

const rules = compileRules();
const findings = [];
const skipped = [];
let scanned = 0;

for (const rel of [...new Set(files)].sort()) {
  if (PATTERN_DOC_FILES.has(rel.replace(/\\/g, '/'))) {
    skipped.push(rel);
    continue;
  }
  let text;
  try {
    text = staged ? sh('git', ['show', `:${rel}`]) : fs.readFileSync(path.join(ROOT, rel), 'utf8');
  } catch {
    skipped.push(rel); // binary, submodule, or removed between listing and read
    continue;
  }
  if (text.length > MAX_BYTES || text.includes('\0')) {
    skipped.push(rel);
    continue;
  }
  scanned += 1;
  findings.push(...scanText(rel, text, rules));
}

// ---- report ------------------------------------------------------------------
const errors = findings.filter((f) => f.severity === 'error');
const warnings = findings.filter((f) => f.severity === 'warn');
const failed = errors.length > 0 || (strict && warnings.length > 0);

if (asJson) {
  console.log(
    JSON.stringify({ source: sourceLabel, scanned, skipped: skipped.length, errors, warnings, strict, ok: !failed }, null, 2),
  );
} else {
  if (findings.length > 0) {
    console.log('\n# secret-scan findings');
    console.log('| Severity | Rule | Location | Evidence |');
    console.log('|----------|------|----------|----------|');
    for (const f of findings) console.log(`| ${f.severity} | ${f.rule} | ${f.path}:${f.line} | ${f.evidence} |`);
  }
  if (!quiet || findings.length > 0) {
    console.log('\n# secret-scan summary');
    console.log(`source: ${sourceLabel}`);
    console.log(`scanned: ${scanned} files | skipped: ${skipped.length} (binary/pattern-doc) | rules: ${rules.length}`);
    console.log(`findings: ${findings.length} (${errors.length} error, ${warnings.length} warn)${strict ? ' [--strict]' : ''}`);
    console.log(failed ? 'RESULT: FAIL' : 'RESULT: clean');
  }
  if (findings.length > 0) {
    console.log('\nFix: keep the value in ~/.cline/data/settings/providers.json (local) or an encrypted Actions secret (CI).');
  }
}

process.exit(failed ? 1 : 0);