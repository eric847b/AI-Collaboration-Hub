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
const BOOLEAN_FLAGS = new Set(['--quiet', '--self-test']);
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
'Usage: node tools/check-doc-facts.mjs [--only <file,...>] [--quiet]',
'',
'Verifies that count-bearing claims in AGENTS.md, docs/STATUS.md and',
'docs/ROADMAP.md still match runtime truth (totals derived from the',
'filesystem and from check-flag-contract --json).',
'',
'Flags:',
'  --only <file,...>  only check these files (comma-separated, repo-relative)',
'  --quiet            only print drifted facts (no summary line)',
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
return fs.readdirSync(path.join(ROOT, 'tools')).filter((f) => /\.(mjs|cjs)$/.test(f)).length;
}

/**
* Totals the docs are allowed to cite. Both are computed, never assumed:
*  - cliTotal  : what `--check-cli` audits (tools/ + out-of-tree).
*  - flagTotal : what check-flag-contract audits, read from its own --json
*                because it excludes ITSELF, so the two differ by one.
*/
function computeTotals() {
const cliTotal = countToolsOnDisk() + parseExtraTools(fs.readFileSync(path.join(ROOT, 'tools/verify-tools.mjs'), 'utf8')).length;
// NOTE: no --quiet here — check-flag-contract declares only
// --deep/--allow-write-risky/--only/--json, and an undeclared flag would
// exit 2 and silently turn this total into null.
const r = spawnSync(process.execPath, [path.join(ROOT, 'tools/check-flag-contract.mjs'), '--json'], {
cwd: ROOT,
encoding: 'utf8',
timeout: 120000,
});
let flagTotal = null;
try {
const parsed = JSON.parse(r.stdout || '');
if (Array.isArray(parsed.rows)) flagTotal = parsed.rows.length;
} catch {
flagTotal = null; // reported as a failure below, never silently skipped
}
return { cliTotal, flagTotal };
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

// ---- parseExtraTools: read from verify-tools, never a second copy ----
const vt = fs.readFileSync(path.join(ROOT, 'tools/verify-tools.mjs'), 'utf8');
check('extra tools are parsed from verify-tools', parseExtraTools(vt), ['.husky/js-gate.mjs']);
check('a missing list yields no extras', parseExtraTools('const NOPE = 1;'), []);

// ---- CLI contract, end to end (child runs WITHOUT --self-test) ----
const cli = (args) => {
const r = spawnSync(process.execPath, [SELF, ...args], { cwd: ROOT, encoding: 'utf8', timeout: 60000 });
return { code: r.status, out: `${r.stdout || ''}${r.stderr || ''}` };
};
check('--help exits 0', cli(['--help']).code, 0);
check('unknown flag exits 2', cli(['--nope']).code, 2);
check('unexpected positional exits 2', cli(['extra']).code, 2);
check('--only without a value exits 2', cli(['--only']).code, 2);
check('boolean given a value exits 2', cli(['--quiet=1']).code, 2);
check('--only=<bad path> exits 2 (no documents matched)', cli(['--only=nope.md']).code, 2);

const failed = cases.filter((c) => !c.pass);
for (const c of failed) {
console.error(`FAIL  ${c.name}`);
console.error(`      expected ${JSON.stringify(c.expected)}`);
console.error(`      actual   ${JSON.stringify(c.actual)}`);
}
console.log(`check-doc-facts self-test: ${cases.length - failed.length}/${cases.length} passed`);
process.exit(failed.length > 0 ? 1 : 0);
}

if (flags['--self-test'] === true) runSelfTest();

// ── Main ───────────────────────────────────────────────────────────────
const selected = flags['--only']
? String(flags['--only']).split(',').map((s) => s.trim()).filter(Boolean)
: DOC_FILES;

// False-green guard: checking nothing must never read as "all facts true".
const docs = selected.map((rel) => ({ rel, abs: path.join(ROOT, rel) }));
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
if (flagTotal === null) {
console.error('check-doc-facts: could not read check-flag-contract --json (the tool is broken) — that is itself a failure');
process.exit(1);
}
const totals = [cliTotal, flagTotal];
const workflowPath = path.join(ROOT, '.github/workflows/multi-os-gate.yml');
const workflowText = fs.existsSync(workflowPath) ? fs.readFileSync(workflowPath, 'utf8') : '';

const subjects = [
{ re: /--check-cli/gi, total: cliTotal, label: '--check-cli' },
{ re: /check-flag-contract/gi, total: flagTotal, label: 'check-flag-contract' },
];

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

for (const d of drifted) {
const hint = d.denominator === null ? '' : ` (live totals: ${totals.join(' / ')})`;
console.log(`STALE  ${d.file}  ${d.claimed}${hint}`);
}
if (!quiet) {
console.log(
`\ncheck-doc-facts: ${present.length} documents, ${totals.join(' + ')} live tool totals, ${drifted.length} drifted claim(s)`,
);
}
process.exit(drifted.length > 0 ? 1 : 0);