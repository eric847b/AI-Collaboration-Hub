#!/usr/bin/env node
/**
* check-doc-facts.mjs — verifies that count-bearing CLAIMS in the docs still
* match runtime truth. check-doc-links proves a doc *link* resolves; this
* proves a doc *number* is still true.
*
*   node tools/check-doc-facts.mjs            # report + exit 1 on drift
*   node tools/check-doc-facts.mjs --quiet    # only print drifted facts
*   node tools/check-doc-facts.mjs --help     # usage (Round 12 D: unknown flags exit 2)
*   node tools/check-doc-facts.mjs --self-test # prove the checkers fire on fixtures
 *   node tools/check-doc-facts.mjs --list     # every count-bearing claim + verdict
*
* WHY (real drift found 2026-10-01, not hypothetical): after the CLI-contract
* work, STATUS.md, ROADMAP.md and AGENTS.md all still claimed `--check-cli` was
* "19/19" while the tool reported 21/21 — three files, six claims, silently
* wrong. STATUS also claimed `--deep` "stays opt-in" after CI had been switched
* to run it, so a reader would have believed the behavioural layer was
* unverified in CI. Both were true when written; neither stayed true.
*
* Hand-copied counts cannot survive: a new tool in tools/ silently invalidates
* six numbers across three files and nothing notices. So the totals are derived
* here from the filesystem + the tools' own --json, and docs are only checked
* for MATCHING them.
*
* Two denominators, deliberately NOT assumed equal — this trips people up:
*   --check-cli          audits tools/*.mjs|*.cjs + out-of-tree tools   (21)
*   check-flag-contract  audits the same MINUS ITSELF (never audits the
*                        auditor)                                        (20)
* A doc may legitimately cite either, so a fraction is judged only when its
* denominator equals a live total.
*
* Tolerance: a fraction is checked ONLY when its denominator matches a live
* total, so dated "19/20" historical evidence stays valid and is not
* rewritten every time a tool lands.
*/
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SELF = fileURLToPath(import.meta.url);

// ── Non-interactive argv tokenizer (Round 12 D hardening) ──────────────
// Unknown flags, missing values, booleans given a value and stray positionals
// all exit 2 instead of being silently ignored. No stdin prompts, ever.
const VALUE_FLAGS = new Set(['--only']);
const BOOLEAN_FLAGS = new Set(['--quiet', '--self-test', '--json', '--list']);
const argv = process.argv.slice(2);
const flags = {};
const positionals = [];
for (let i = 0; i < argv.length; i += 1) {
const a = argv[i];
if (a === '--help' || a === '-h') {
flags['--help'] = true;
continue;
}
if (!a.startsWith('-')) {
positionals.push(a);
continue;
}
const eq = a.indexOf('=');
const key = eq >= 0 ? a.slice(0, eq) : a;
if (!VALUE_FLAGS.has(key) && !BOOLEAN_FLAGS.has(key)) {
console.error(`check-doc-facts: unknown flag "${key}" — see \`node tools/check-doc-facts.mjs --help\``);
process.exit(2);
}
if (BOOLEAN_FLAGS.has(key)) {
if (eq >= 0) {
console.error(`check-doc-facts: boolean flag "${key}" does not take a value — use \`${key}\``);
process.exit(2);
}
flags[key] = true;
continue;
}
const value = eq >= 0 ? a.slice(eq + 1) : argv[++i];
if (value === undefined || value === '') {
console.error(`check-doc-facts: "${key}" requires a value — see \`node tools/check-doc-facts.mjs --help\``);
process.exit(2);
}
flags[key] = value;
}

function usage() {
console.log(
[
'Usage: node tools/check-doc-facts.mjs [--only <file,...>] [--quiet] [--json] [--list] [--self-test]',
'',
'Verifies that count-bearing claims in AGENTS.md, docs/STATUS.md and',
'docs/ROADMAP.md still match runtime truth (totals derived from the',
'filesystem and from check-flag-contract --json).',
'',
'Flags:',
'  --only <file,...>  only check these files (comma-separated, repo-relative)',
'  --quiet            only print drifted facts (no summary line)',
'  --json             emit a schema-1 report instead of human lines',
'  --list             enumerate EVERY count-bearing claim found (ok / stale / illustration)',
'  --self-test        prove the checkers fire on synthetic fixtures and exit',
'  --help             print this text and exit 0',
'',
'Exit codes: 0 = every documented count still true, 1 = drift found,',
'            2 = bad usage (also: no documents matched — never a clean pass).',
'Unknown flags and unexpected arguments exit 2.',
].join('\n'),
);
}

if (flags['--help']) {
usage();
process.exit(0);
}
if (positionals.length) {
console.error(`check-doc-facts: unexpected argument "${positionals[0]}" — flags only (see \`node tools/check-doc-facts.mjs --help\`)`);
process.exit(2);
}
const quiet = flags['--quiet'] === true;

/** Documents that make count claims. Narrow and deliberate, not a tree walk. */
const DOC_FILES = ['AGENTS.md', 'docs/STATUS.md', 'docs/ROADMAP.md'];

// ── Pure fact extractors, kept apart from main() so --self-test drives the
// EXACT production path instead of a copy that can silently drift.
/**
 * Words that mean "this fraction is being TALKED ABOUT", not "this fraction is
 * the current claim".
 *
 * Found by the tool flagging its own docs: explaining the 19/19 bug requires
 * writing 19/19, and a checker that cannot tell an illustration from a claim
 * trains people to ignore it. Two kinds:
 *  - past tense  — dated negative-path evidence ("a probe drops it to 19/20")
 *  - illustration — "stale 19/19 claims", "claims like 19/19", "e.g. 19/19"
 */
const NON_CLAIM_CUE =
/(?:\b(?:drops?|dropped|used\s+to|previously|formerly|historically|was|were|back\s+in|before|then|stale)\b|\be\.g\.|\bi\.e\.|\bfor\s+example\b|\bsuch\s+as\b|\blike\b)[^.]{0,24}$/i;

/**
 * Claims are found by SUBJECT, not by denominator.
 *
 * The bug that motivated this tool was "19/19" written when the live total was
 * 21. A denominator-matching rule misses exactly that case — 19 is not a live
 * total, so the fraction looks irrelevant and is skipped. Anchoring on the
 * subject that OWNS the count ("--check-cli" → cliTotal) catches it.
 *
 * The doc's claim and the tool's real total must tell the same story, so both
 * halves of the fraction are checked against the live total.
 */
function claimFindings(text, subjects, relFile) {
const out = [];
for (const { re, total, label } of subjects) {
re.lastIndex = 0;
let m;
while ((m = re.exec(text)) !== null) {
const window = text.slice(m.index, m.index + 160);
const f = window.match(/(\d+)\/(\d+)/);
if (!f) continue; // subject mentioned, no count attached
const numerator = Number(f[1]);
const denominator = Number(f[2]);
if (numerator === total && denominator === total) continue; // true claim
// The cue can sit BEFORE the subject ("six stale `--check-cli` 19/19 claims"),
// so look back before the subject too, not just at the gap after it.
const before =
text.slice(Math.max(0, m.index - 60), m.index) + window.slice(0, window.indexOf(f[0]));
if (NON_CLAIM_CUE.test(before)) continue; // illustration or dated evidence
out.push({ file: relFile, claimed: f[0], subject: label, total });
}
}
return out;
}

/**
 * EVERY subject-anchored count with its verdict — the informational mirror of
 * claimFindings above and what `--list` prints. Same window, same illustration
 * cue, but nothing is skipped: a true claim is `ok`, a mismatch is `stale`,
 * dated/illustrative text is `illustration`. The gate itself keeps using
 * claimFindings (which returns only what must FAIL) so the two cannot blur —
 * a list that quietly dropped true claims would hide exactly what a reader
 * opened it to audit.
 */
function enumerateClaims(text, subjects, relFile) {
  const out = [];
  for (const { re, total, label } of subjects) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(text)) !== null) {
      const window = text.slice(m.index, m.index + 160);
      const f = window.match(/(\d+)\/(\d+)/);
      if (!f) continue; // subject mentioned, no count attached
      const before =
        text.slice(Math.max(0, m.index - 60), m.index) + window.slice(0, window.indexOf(f[0]));
      const status = NON_CLAIM_CUE.test(before)
        ? 'illustration'
        : Number(f[1]) === total && Number(f[2]) === total
          ? 'ok'
          : 'stale';
      out.push({ file: relFile, subject: label, claimed: f[0], status });
    }
  }
  return out;
}

/**
 * Totals + per-subject matrix for enumerated claims — the shape `--list --json`
 * reports as `claimSummary`. Derived from the SAME claims array it ships with,
 * so the matrix cannot disagree with the rows a human reads; the self-test
 * re-derives every total from the live report and compares both directions
 * (overall and per subject), so a summary that drifts from its own claims
 * fails CI instead of misleading a dashboard.
 */
function buildClaimSummary(claims) {
  const s = { total: claims.length, ok: 0, stale: 0, illustration: 0, bySubject: {} };
  for (const c of claims) {
    s[c.status] += 1;
    const b = (s.bySubject[c.subject] ||= { total: 0, ok: 0, stale: 0, illustration: 0 });
    b.total += 1;
    b[c.status] += 1;
  }
  return s;
}

/**
* Fact 2 — a doc may claim CI runs the `--deep` layer. That is only true while
* the workflow actually invokes it, and "stays opt-in" was exactly the stale
* claim that got left behind. Returns 'agrees' | 'drifts' | 'silent'.
*/
function deepClaimVerdict(docText, workflowText) {
const claimsDeep = /CI step[^.\n]{0,40}runs `--deep`|that same CI step runs `--deep`/i.test(docText);
// "stays opt-in" is only a CLAIM about CI when it is not qualified as a local
// statement ("opt-in locally"), so the negative lookahead is load-bearing.
// Backticks are OPTIONAL in these patterns on purpose: a verified negative test
// showed the wording is easy to reproduce without them (and a doc written by a
// different hand may omit them). Requiring them would silently miss the claim.
const claimsOptIn = /(?:`--deep`|--deep) stays opt-in(?!\s+locally)/i.test(docText);
const workflowRunsDeep = /check-flag-contract\.mjs['"]?[^\n]*--deep/.test(workflowText);
if (!claimsDeep && !claimsOptIn) return 'silent';
// The doc's claim and the workflow must tell the SAME story. Claiming CI runs
// `--deep` when it does not is drift; claiming it is opt-in when CI runs it is
// equally drift — that stale claim is exactly what was left behind on 2026-10-01.
if (claimsDeep) return workflowRunsDeep ? 'agrees' : 'drifts';
return workflowRunsDeep ? 'drifts' : 'agrees';
}

// ── Runtime truth: the two live totals, derived not hand-copied ─────────
/** Out-of-tree tools, read out of verify-tools so there is one source. */
function parseExtraTools(src) {
const m = src.match(/const EXTRA_TOOLS\s*=\s*\[([^\]]*)\]/);
if (!m) return [];
return [...m[1].matchAll(/'([^']+)'|"([^"]+)"/g)].map((x) => x[1] || x[2]).filter(Boolean);
}

function countToolsOnDisk() {
// Ignore dotfiles. Mutation probes copy a tool beside itself as
// `.mutation-probe-*.mjs` while --self-test runs. Counting those scratch
// files inflates cliTotal, makes documented N/N claims look drifted, and
// fails the unmodified control (Multi-OS gate stuck at 42/44).
return fs.readdirSync(path.join(ROOT, 'tools')).filter((f) => /\.(mjs|cjs)$/.test(f) && !f.startsWith('.')).length;
}

/**
 * Totals the docs are allowed to cite. Derived, never hand-copied.
 *
 * `flagTotal` is computed as `cliTotal - 1` under one stated invariant:
 * check-flag-contract audits everything `--check-cli` audits, MINUS ITSELF (an
 * auditor that audited its own source would be reasoning circularly). Deriving
 * it keeps this tool near-instant instead of paying ~5.5 s to spawn every tool
 * on every gate run and in both CI OS runners.
 *
 * That invariant is an ASSUMPTION here and a VERIFIED FACT in --self-test,
 * which spawns the real tool and compares. If check-flag-contract ever changes
 * who it audits, the self-test fails in CI instead of the docs quietly going
 * wrong — which is the whole point of having this tool.
 */
function computeTotals() {
const extras = parseExtraTools(fs.readFileSync(path.join(ROOT, 'tools/verify-tools.mjs'), 'utf8'));
const cliTotal = countToolsOnDisk() + extras.length;
return { cliTotal, flagTotal: cliTotal - 1 };
}

/** The auditor under audit must exist, or the totals above are fiction. */
function totalsAreSane(cliTotal) {
return (
cliTotal >= 2 && fs.existsSync(path.join(ROOT, 'tools/check-flag-contract.mjs')) && fs.existsSync(path.join(ROOT, 'tools/verify-tools.mjs'))
);
}

/**
* Self-test: drive the REAL extractors with synthetic text so a green run is
* evidence, not an assumption. The fixtures reproduce the three claims that
* were actually stale on 2026-10-01, plus a control proving the checker does
* not simply flag every fraction it sees.
*/
function runSelfTest() {
const cases = [];
const check = (name, actual, expected) =>
cases.push({ name, pass: JSON.stringify(actual) === JSON.stringify(expected), actual, expected });
const T = [21, 20];

// ---- claimFindings: anchored on the subject that owns the count ----
const SUBJ = [{ re: /--check-cli/gi, total: 21, label: '--check-cli' }];
check('the real STATUS drift IS caught', claimFindings('**`--check-cli` 19/19 CLI contract**', SUBJ, 'x.md').map((f) => f.claimed), ['19/19']);
check('the real ROADMAP drift IS caught', claimFindings('`--check-cli` 19/19 tools honor the contract', SUBJ, 'x.md').length, 1);
check('the corrected claim passes', claimFindings('`--check-cli` 21/21 tools honor the contract', SUBJ, 'x.md').length, 0);
check('a subject with no count attached is fine', claimFindings('run `--check-cli` in CI', SUBJ, 'x.md').length, 0);
check('an unrelated count is not flagged', claimFindings('coverage 47/47 and gate 25/25', SUBJ, 'x.md').length, 0);
check('dated evidence next to a subject is tolerated', claimFindings('`--check-cli` 21/21 conform; a probe drops it to 19/20 exit 1', SUBJ, 'x.md').length, 0);
check('an ILLUSTRATION of the bug is not a claim', claimFindings('Motivated by real drift: six stale `--check-cli` 19/19 claims across three files', SUBJ, 'x.md').length, 0);
  // The reporting path itself. A drifted claim previously referenced an
  // identifier that did not exist, so the validator CRASHED (ReferenceError)
  // exactly when it had something to report - a validator that can only pass.
  // These two execute that path so it can never be untested again.
  check('a drifted claim renders its live-totals hint', formatHint({ denominator: 21 }, 23, 22), ' (live totals: 23 / 22)');
  check('a hintless finding renders an empty hint', formatHint({ denominator: null }), '');
check('a "claims like" illustration is not a claim', claimFindings('catches stale claims like "`--check-cli` 19/19" after the total moved', SUBJ, 'x.md').length, 0);
check('an "e.g." illustration is not a claim', claimFindings('e.g. `--check-cli` 19/19 is now wrong', SUBJ, 'x.md').length, 0);
check('CONTROL: a real claim is still caught after a cue word', claimFindings('`--check-cli` reports 21/22 tools honor the contract', SUBJ, 'x.md').length, 1);
check('drift records its subject', claimFindings('`--check-cli` 19/19', SUBJ, 'docs/STATUS.md').map((f) => f.subject), ['--check-cli']);
check('a partial count is drift too', claimFindings('`--check-cli` 20/21 conform', SUBJ, 'x.md').length, 1);
check('the flag-contract subject uses its own total', claimFindings('static 20/20 + deep 20/20', [{ re: /static/gi, total: 20, label: 'static' }], 'x.md').length, 0);
check('wrong total for that subject is drift', claimFindings('static 21/20', [{ re: /static/gi, total: 20, label: 'static' }], 'x.md').length, 1);

// ---- deepClaimVerdict ----
const WF_DEEP = "run: node tools/check-flag-contract.mjs --deep --quiet\n";
const WF_STATIC = 'run: node tools/check-doc-facts.mjs\n';
check('doc claims CI runs --deep, workflow does', deepClaimVerdict('that same CI step runs `--deep`', WF_DEEP), 'agrees');
check('doc claims CI runs --deep, workflow does NOT', deepClaimVerdict('that same CI step runs `--deep`', WF_STATIC), 'drifts');
check('stale "stays opt-in" against a deep workflow', deepClaimVerdict('`--deep` stays opt-in', WF_DEEP), 'drifts');
check('"stays opt-in" is honest when CI is static', deepClaimVerdict('`--deep` stays opt-in', WF_STATIC), 'agrees');
check('doc says nothing about deep', deepClaimVerdict('a doc with no claim here', WF_STATIC), 'silent');
check('local-only opt-in wording makes no CI claim', deepClaimVerdict('`--deep` stays opt-in locally because value probes can write', WF_DEEP), 'silent');

// ---- the invariant that lets the hot path skip a 5.5s spawn ----
// flagTotal is DERIVED as cliTotal - 1 in computeTotals(). Here that assumption
// is paid for: the real tool is spawned and compared, so if check-flag-contract
// ever changes who it audits, CI fails here instead of the docs going wrong.
{
const { cliTotal, flagTotal: derived } = computeTotals();
check('derived totals are sane', totalsAreSane(cliTotal), true);
check('INVARIANT-SHAPE derived flagTotal is cliTotal - 1', derived, cliTotal - 1);
// NOTE: no --quiet — check-flag-contract declares only
// --deep/--allow-write-risky/--only/--json; an undeclared flag exits 2.
const r = spawnSync(process.execPath, [path.join(ROOT, 'tools/check-flag-contract.mjs'), '--json'], {
cwd: ROOT,
encoding: 'utf8',
timeout: 180000,
});
let actual = null;
try {
const parsed = JSON.parse(r.stdout || '');
if (Array.isArray(parsed.rows)) actual = parsed.rows.length;
} catch {
actual = null;
}
check('check-flag-contract --json produced rows', actual !== null, true);
check('INVARIANT flagTotal === cliTotal - 1 (auditor excludes only itself)', actual, derived);
// The Multi-OS mutation probe copies this file to `.mutation-probe-*.mjs`
// beside itself and re-runs --self-test. Both inventories must ignore that
// scratch file or the unmodified control looks drifted (42/44).
const scratch = path.join(ROOT, 'tools/.mutation-probe-selftest-scratch.mjs');
const before = countToolsOnDisk();
fs.writeFileSync(scratch, '// not a tool\n');
let during;
let scratchRows = null;
try {
during = countToolsOnDisk();
const r2 = spawnSync(process.execPath, [path.join(ROOT, 'tools/check-flag-contract.mjs'), '--json'], {
cwd: ROOT,
encoding: 'utf8',
timeout: 180000,
});
try {
const parsed = JSON.parse(r2.stdout || '');
if (Array.isArray(parsed.rows)) scratchRows = parsed.rows.length;
} catch {
scratchRows = null;
}
} finally {
fs.rmSync(scratch, { force: true });
}
check('mutation-probe scratch copies are not counted as tools', during, before);
check('a mutation-probe scratch file does not change the audited tool count', scratchRows, actual);
}

// ---- parseExtraTools: read from verify-tools, never a second copy ----
const vt = fs.readFileSync(path.join(ROOT, 'tools/verify-tools.mjs'), 'utf8');
check('extra tools are parsed from verify-tools', parseExtraTools(vt), ['.husky/js-gate.mjs']);
check('a missing list yields no extras', parseExtraTools('const NOPE = 1;'), []);

// ---- CLI contract, end to end (child runs WITHOUT --self-test) ----
// Memoized: identical argv must not pay the process launch + full corpus
// scan twice (~1.5 s each here). The counters are ASSERTED by the self-test
// (3 calls cost at most 1 spawn), so silently dropping this cache or making
// the cache stop recording spawns both fail CI rather than quietly making
// the self-test slower or greener.
const cliCache = new Map();
let cliCalls = 0;
let cliSpawns = 0;
const cli = (args) => {
cliCalls++;
const key = JSON.stringify(args);
const hit = cliCache.get(key);
if (hit !== undefined) return hit;
cliSpawns++;
const r = spawnSync(process.execPath, [SELF, ...args], { cwd: ROOT, encoding: 'utf8', timeout: 60000 });
const res = { code: r.status, out: `${r.stdout || ''}${r.stderr || ''}` };
cliCache.set(key, res);
return res;
};
check('--help exits 0', cli(['--help']).code, 0);
check('unknown flag exits 2', cli(['--nope']).code, 2);
check('unexpected positional exits 2', cli(['extra']).code, 2);
check('--only without a value exits 2', cli(['--only']).code, 2);
check('boolean given a value exits 2', cli(['--quiet=1']).code, 2);
check('--only=<bad path> exits 2 (no documents matched)', cli(['--only=nope.md']).code, 2);

// ---- --json: implemented, documented, and parseable ---------------------
// A declared flag that is accepted but does nothing is precisely the defect
// class this tool exists to catch, so it gets an implementation test rather
// than an "it exits 0" test — a no-op would still exit 0.
{
const r = cli(['--json', '--quiet']);
let parsed = null;
try {
// Find the JSON line explicitly instead of using .pop(): with --json alone
// the human summary follows, so .pop() would parse the prose and "pass" by
// reporting null — a test that cannot fail. The JSON object is one line.
parsed = JSON.parse(r.out.split('\n').find((l) => l.trim().startsWith('{')));
} catch {
parsed = null;
}
check('--json --quiet emits a schema-1 object', parsed && parsed.schema, 1);
check('--json reports liveTotals', parsed && typeof parsed.liveTotals?.checkCli, 'number');
check('--json agrees with the human path on drift count', parsed && parsed.driftedCount, 0);
check('--json is listed in --help', cli(['--help']).out.includes('--json'), true);
check('--json alone still emits parseable JSON (prose may follow)', (() => {
try {
return JSON.parse(cli(['--json']).out.split('\n').find((l) => l.trim().startsWith('{'))).schema;
} catch {
return null;
}
})(), 1);
}
check('--json given a value exits 2 (it is boolean)', cli(['--json=1']).code, 2);

// ---- --list: a declared flag must DO something, not just parse ---------
// Same defect class as --json above: a flag that is accepted but does
// nothing still exits 0, so these assert on OUTPUT, never on the exit code.
{
  const statuses = (t) => enumerateClaims(t, SUBJ, 'x.md').map((c) => c.status);
  check('enumerateClaims labels a true claim ok', statuses('`--check-cli` 21/21 tools'), ['ok']);
  check('enumerateClaims labels a stale claim stale', statuses('`--check-cli` 19/19 tools'), ['stale']);
  check('enumerateClaims labels dated evidence illustration', statuses('six stale `--check-cli` 19/19 claims'), ['illustration']);
  check('enumerateClaims skips a subject with no count', statuses('run `--check-cli` in CI'), []);
  check('enumerateClaims carries the owning file', enumerateClaims('`--check-cli` 19/19', SUBJ, 'docs/STATUS.md')[0].file, 'docs/STATUS.md');
  // claimSummary as a pure function: totals and the by-subject matrix are
  // derived, never hand-added — key order matters (check() compares via
  // JSON.stringify), so this also pins the exact reported shape.
  check('buildClaimSummary totals every claim overall and per subject', buildClaimSummary([
    { file: 'a.md', subject: 's', claimed: '1/1', status: 'ok' },
    { file: 'b.md', subject: 's', claimed: '9/9', status: 'stale' },
    { file: 'c.md', subject: 't', claimed: '3/3', status: 'illustration' },
  ]), {
    total: 3, ok: 1, stale: 1, illustration: 1,
    bySubject: {
      s: { total: 2, ok: 1, stale: 1, illustration: 0 },
      t: { total: 1, ok: 0, stale: 0, illustration: 1 },
    },
  });
  const listing = cli(['--list']).out;
  check('--list rows carry a verdict token, or an explicit empty footer',
    /^\s*(OK|STALE|ILLUSTRATION)\s/m.test(listing) ? true : /no count-bearing claims found/.test(listing), true);
  check('--list prints the claims footer', /count-bearing claim\(s\)|no count-bearing claims found/.test(listing), true);
  check('--list is listed in --help', cli(['--help']).out.includes('--list'), true);
  check('--list given a value exits 2 (it is boolean)', cli(['--list=1']).code, 2);
  check('--list --json adds a claims array to the schema-1 report', (() => {
    try {
      const o = JSON.parse(cli(['--list', '--json', '--quiet']).out.split('\n').find((x) => x.trim().startsWith('{')));
      return Array.isArray(o.claims);
    } catch {
      return null;
    }
  })(), true);
  // Pins the --list ordering defect: the block must run AFTER the existence
  // guard, so a missing --only document exits 2 instead of ENOENT-crashing.
  check('--list with --only=<missing> exits 2 (list block runs after the guards)', cli(['--only=nosuch.md', '--list']).code, 2);
  // The matrix must mirror the rows: re-derive every overall AND per-subject
  // total from the LIVE report, so a claimSummary that lies about its own
  // claims array fails here rather than in a consumer's dashboard.
  check('--list --json claimSummary mirrors its claims array', (() => {
    try {
      const o = JSON.parse(cli(['--list', '--json', '--quiet']).out.split('\n').find((x) => x.trim().startsWith('{')));
      const s = o.claimSummary;
      const cl = o.claims;
      if (!s || !Array.isArray(cl)) return false;
      return s.total === cl.length
        && ['ok', 'stale', 'illustration'].every((k) => s[k] === cl.filter((c) => c.status === k).length)
        && Object.keys(s.bySubject).length > 0
        && Object.entries(s.bySubject).every(([sub, b]) => b.total === cl.filter((c) => c.subject === sub).length);
    } catch {
      return null;
    }
  })(), true);
  // Memo-cache pin: three identical argv must cost at most ONE process
  // launch. A dropped cache (or counters that stop recording) reverts the
  // self-test to one ~1.5 s spawn per check — measured, not assumed.
  {
    const c0 = cliCalls;
    const s0 = cliSpawns;
    cli(['--help']);
    cli(['--help']);
    cli(['--help']);
    check('repeated argv hit the cli memo cache (3 calls, at most 1 spawn)',
      cliCalls - c0 === 3 && cliSpawns - s0 <= 1, true);
  }
}


const failed = cases.filter((c) => !c.pass);
for (const c of failed) {
console.error(`FAIL  ${c.name}`);
console.error(`      expected ${JSON.stringify(c.expected)}`);
console.error(`      actual   ${JSON.stringify(c.actual)}`);
}
console.log(`check-doc-facts self-test: ${cases.length - failed.length}/${cases.length} passed (${cliSpawns} spawns / ${cliCalls} cli calls)`);
process.exit(failed.length > 0 ? 1 : 0);
}

if (flags['--self-test'] === true) runSelfTest();


// ── Main ───────────────────────────────────────────────────────────────
const asJson = flags['--json'] === true;
const list = flags['--list'] === true;

const selected = flags['--only']
? String(flags['--only']).split(',').map((s) => s.trim()).filter(Boolean)
: DOC_FILES;

// False-green guard: checking nothing must never read as "all facts true".
const docs = selected.map((rel) => ({ rel, abs: path.join(ROOT, rel) }));
// --list reads documents only AFTER the existence filter below: reading
// here would turn `--only=<missing>` into an ENOENT crash (exit 1) instead
// of the contract's "no documents matched" exit 2.

const present = docs.filter((d) => fs.existsSync(d.abs));
if (!present.length) {
console.error(
selected.length
? `check-doc-facts: no documents matched (${selected.join(', ')}) — refusing to report 0 drifted facts`
: 'check-doc-facts: no documents configured — refusing to report 0 drifted facts',
);
process.exit(2);
}

const { cliTotal, flagTotal } = computeTotals();
if (!totalsAreSane(cliTotal)) {
console.error(
`check-doc-facts: cannot derive live totals (cliTotal=${cliTotal}, tools/ or the auditor missing) — refusing to report 0 drifted facts`,
);
process.exit(1);
}
const workflowPath = path.join(ROOT, '.github/workflows/multi-os-gate.yml');
const workflowText = fs.existsSync(workflowPath) ? fs.readFileSync(workflowPath, 'utf8') : '';

const subjects = [
{ re: /--check-cli/gi, total: cliTotal, label: '--check-cli' },
{ re: /check-flag-contract/gi, total: flagTotal, label: 'check-flag-contract' },
];


// --list runs AFTER the existence + totals guards above, so it inherits the
// exit-2 / exit-1 protections instead of crashing past them (the first
// version of this block read every selected file before the filter and took
// the whole tool down with an ENOENT on `--only=<missing>`).
const listedClaims = list
  ? present.flatMap((d) => enumerateClaims(fs.readFileSync(d.abs, 'utf8'), subjects, d.rel))
  : null;
if (list) {
  const width = Math.max(4, ...listedClaims.map((c) => c.file.length));
  for (const c of listedClaims) {
    console.log(`${c.status.toUpperCase().padEnd(12)} ${c.file.padEnd(width)}  ${c.claimed.padEnd(7)} ${c.subject}`);
  }
  const n = (s) => listedClaims.filter((c) => c.status === s).length;
  console.log(
    listedClaims.length
      ? `\n${listedClaims.length} count-bearing claim(s): ${n('ok')} ok, ${n('stale')} stale, ${n('illustration')} illustration`
      : '(no count-bearing claims found)',
  );
}
const drifted = [];
for (const doc of present) {
const text = fs.readFileSync(doc.abs, 'utf8');
drifted.push(...claimFindings(text, subjects, doc.rel));
if (deepClaimVerdict(text, workflowText) === 'drifts') {
const saysRuns = /CI step[^.\n]{0,40}runs `--deep`|that same CI step runs `--deep`/i.test(text);
drifted.push({
file: doc.rel,
claimed: saysRuns
? 'claims the CI step runs `--deep`, but multi-os-gate.yml does not'
: 'calls `--deep` opt-in, but the CI step actually runs it',
denominator: null,
});
}
}

/**
 * The "(live totals: ...)" suffix on a drifted claim.
 *
 * Extracted so the self-test can EXECUTE it. This used to be inline in the
 * reporting loop below and referenced an identifier that did not exist, so the
 * one path a validator exists for - reporting drift - threw a ReferenceError
 * instead of reporting. It survived only because nothing ran it until a claim
 * actually went stale.
 */
function formatHint(d, cli, flag) {
  return d.denominator === null ? '' : ` (live totals: ${cli} / ${flag})`;
}
// Machine-readable path. Emitted BEFORE the human lines so a consumer can
// parse stdout without having to skip prose, and so --json alone still works
// even when --quiet suppresses the summary.
if (asJson) {
console.log(
JSON.stringify({
schema: 1,
documents: present.length,
liveTotals: { checkCli: cliTotal, flagContract: flagTotal },
drifted: drifted.map((d) => ({ file: d.file, claimed: d.claimed, subject: d.subject ?? null })),
driftedCount: drifted.length,
  ...(list ? { claims: listedClaims, claimSummary: buildClaimSummary(listedClaims) } : {}),
ok: drifted.length === 0,
}),
);
}
for (const d of drifted) {
  const hint = formatHint(d, cliTotal, flagTotal);
console.log(`STALE  ${d.file}  ${d.claimed}${hint}`);
}
if (!quiet && !list) {
console.log(
`\ncheck-doc-facts: ${present.length} documents, ${cliTotal} + ${flagTotal} live tool totals, ${drifted.length} drifted claim(s)`,
);
}
process.exit(drifted.length > 0 ? 1 : 0);