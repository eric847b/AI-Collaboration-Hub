#!/usr/bin/env node
/**
 * extension-check.mjs — read-only health check for the ai-chat-websites
 * Unified AI Assistant Suite browser extension.
 *
 * Obsoletes ad-hoc manual review of the extension folder with a single
 * dependency-free static check (no chrome runtime, no network):
 *
 *   node tools/extension-check.mjs            # human-readable report, exit 0/1
 *   node tools/extension-check.mjs --quiet    # failures only (for CI / gates)
 *
 * What it verifies (all read-only, never executes extension code):
 *   1. manifest.json — valid JSON, MV3, background.service_worker,
 *      options_page, required permissions + provider host_permissions.
 *   2. background.js — MODEL_LADDER + user-ladder plumbing present
 *      (LADDER_PROVIDERS, validateLadder, getRoutingLadder,
 *      routedTier(prompt, ladder), runLadder), Gemini + Ollama response
 *      parsing branches present.
 *   3. options.html — routing-ladder UI present (enable checkbox, JSON
 *      textarea, status div, client-side validateLadderClient, storage keys).
 *   4. Parity — LADDER_PROVIDERS allow-list in background.js matches the
 *      client-side mirror in options.html (prevents drift between the two
 *      duplicated validators).
 *   5. Secrets — no hardcoded secret literals (sk-*, xox*, ghp_*) in the
 *      extension sources.
 *
 * Exit codes: 0 all green · 1 any failure · 2 runner setup error.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const EXT = path.join(ROOT, 'ai-chat-websites', 'Userscripts', 'extension');

// ---- Non-interactive argv tokenizer (Round 12 D hardening) ---------------------
// Boolean flags only. Unknown flags, `--flag=value` on a boolean, and stray
// positionals all exit 2 instead of being silently ignored. No stdin prompts.
const argv = process.argv.slice(2);
const BOOLEAN_FLAGS = new Set(['--quiet', '--self-test']);
const flags = {};
const positionals = [];
for (const a of argv) {
  if (a === '--help' || a === '-h') {
    flags['--help'] = true;
    continue;
  }
  if (a.startsWith('-')) {
    const eq = a.indexOf('=');
    const key = eq >= 0 ? a.slice(0, eq) : a;
    if (!BOOLEAN_FLAGS.has(key)) {
      console.error(`extension-check: unknown flag "${key}" - see \`node tools/extension-check.mjs --help\``);
      process.exit(2);
    }
    if (eq >= 0) {
      console.error(`extension-check: flag "${key}" takes no value - see \`node tools/extension-check.mjs --help\``);
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
      'extension-check.mjs - read-only health check for the ai-chat-websites Unified AI Assistant Suite extension',
      '',
      'Usage: node tools/extension-check.mjs [--quiet]',
      '',
      'Flags:',
      '  --quiet   print only the summary line plus failures (no per-check "ok" lines)',
  '  --self-test  prove the parity + secret rules bite (no extension needed)  [no extension]',
      '  --help    print this text and exit 0',
      '',
      'Checks: manifest MV3 fields, ladder plumbing in background.js/options.html,',
      'provider allow-list parity, and hardcoded-secret scans. Read-only.',
      '',
      'Exit codes: 0 = all green, 1 = at least one check failed, 2 = bad usage.',
      'Unknown flags and unexpected arguments exit 2.',
    ].join('\n')
  );
}

if (flags['--help']) {
  usage();
  process.exit(0);
}
if (positionals.length > 0) {
  console.error(
    `extension-check: unexpected argument "${positionals[0]}" - this tool takes flags only (see \`node tools/extension-check.mjs --help\`)`
  );
  process.exit(2);
}
const quiet = flags['--quiet'] === true;

// Dispatch BEFORE any file reading: the self-test must not depend on the extension
// tree being present, or it could not run in a checkout that has no extension.
if (flags['--self-test']) {
  runSelfTest();
  process.exit(0);
}

const failures = [];
const passes = [];
function check(name, ok, detail = '') {
  if (ok) passes.push(name);
  else failures.push(detail ? `${name} — ${detail}` : name);
}
function read(rel) {
  try {
    return fs.readFileSync(path.join(EXT, rel), 'utf8');
  } catch (e) {
    return null;
  }
}
function extractProviders(src) {
  // Matches: const LADDER_PROVIDERS = ['openai', ...] (either file)
  const m = src && src.match(/LADDER_PROVIDERS\s*=\s*\[([^\]]*)\]/);
  if (!m) return null;
  return [...m[1].matchAll(/['"]([a-z0-9-]+)['"]/g)].map((x) => x[1]).sort();
}

/**
 * Provider parity between background.js and options.html.
 *
 * An empty allow-list is NOT parity: `LADDER_PROVIDERS = []` on both sides compares
 * equal ([] === []) and would report green for an extension that routes to no
 * provider at all. Requiring non-empty on both sides keeps that vacuous pass out.
 * A null list means "not extractable", which is also a failure, not an exemption.
 */
function providersParity(bgList, optList) {
  if (bgList === null || optList === null) {
    return { ok: false, reason: 'LADDER_PROVIDERS not extractable' };
  }
  if (!bgList.length || !optList.length) {
    return { ok: false, reason: `empty LADDER_PROVIDERS (background=${bgList.length} options=${optList.length})` };
  }
  // Compare canonically: extractProviders happens to sort, but relying on that is an
  // accident of the caller. A JSON.stringify comparison is ORDER-SENSITIVE, so
  // ['a','b'] vs ['b','a'] would report a mismatch that does not exist.
  const a = [...bgList].sort();
  const b = [...optList].sort();
  const same = JSON.stringify(a) === JSON.stringify(b);
  return { ok: same, reason: `background=[${bgList}] options=[${optList}]` };
}

/** Pure so the self-test can prove the detectors actually fire. */
function hasHardcodedSecret(src) {
  return (
    /sk-[A-Za-z0-9]{10,}/.test(src) ||
    /xox[bap]-[A-Za-z0-9-]+/.test(src) ||
    /ghp_[A-Za-z0-9]{10,}/.test(src)
  );
}

// ---- 1. manifest.json -------------------------------------------------------
const manifestRaw = read('manifest.json');
let manifest = null;
if (manifestRaw === null) {
  check('manifest.json readable', false, 'file missing');
} else {
  try {
    manifest = JSON.parse(manifestRaw);
    check('manifest.json valid JSON', true);
  } catch (e) {
    check('manifest.json valid JSON', false, e.message);
  }
}
if (manifest) {
  check('manifest_version is 3', manifest.manifest_version === 3);
  check(
    'background.service_worker is background.js',
    manifest.background && manifest.background.service_worker === 'background.js',
    JSON.stringify(manifest.background || null),
  );
  check('options_page is options.html', manifest.options_page === 'options.html');
  const perms = manifest.permissions || [];
  check('permission: storage', perms.includes('storage'));
  check('permission: notifications', perms.includes('notifications'));
  const hosts = (manifest.host_permissions || []).join(' ');
  for (const h of ['api.openai.com', 'api.anthropic.com', 'generativelanguage.googleapis.com', 'localhost']) {
    check(`host_permission: ${h}`, hosts.includes(h));
  }
}

// ---- 2. background.js -------------------------------------------------------
const bg = read('background.js');
check('background.js readable', bg !== null);
if (bg !== null) {
  for (const token of [
    'MODEL_LADDER',
    'LADDER_PROVIDERS',
    'function validateLadder',
    'function getRoutingLadder',
    'function routedTier(prompt, ladder)',
    'function runLadder',
    'routingLadder',
    'routingLadderEnabled',
  ]) {
    check(`background.js contains ${token}`, bg.includes(token));
  }
  check('background.js parses Gemini candidates', bg.includes('candidates'));
  check('background.js parses Ollama response', bg.includes('result.response?.response'));
}

// ---- 3. options.html --------------------------------------------------------
const opt = read('options.html');
check('options.html readable', opt !== null);
if (opt !== null) {
  for (const token of [
    'id="routing-enabled"',
    'id="routing-ladder"',
    'id="ladder-status"',
    'validateLadderClient',
    'routingLadder',
    'routingLadderEnabled',
    'JSON.parse(ladderText)',
  ]) {
    check(`options.html contains ${token}`, opt.includes(token));
  }
}

// ---- 4. provider allow-list parity ------------------------------------------
if (bg !== null && opt !== null) {
  const bgProviders = extractProviders(bg);
  const optProviders = extractProviders(opt);
  check('background.js LADDER_PROVIDERS extractable', bgProviders !== null);
  check('options.html LADDER_PROVIDERS extractable', optProviders !== null);
  if (bgProviders && optProviders) {
    const parity = providersParity(bgProviders, optProviders);
    check(`LADDER_PROVIDERS parity (${bgProviders.join(',')})`, parity.ok, parity.reason);
  }
}

// ---- 5. secrets -------------------------------------------------------------
for (const [name, src] of [
  ['background.js', bg],
  ['options.html', opt],
]) {
  if (src === null) continue;
  check(`${name} has no hardcoded secrets`, !hasHardcodedSecret(src));
}

// ---- Self-test -----------------------------------------------------------------
// Assembled from fragments on purpose: a literal `sk-xxxx` in THIS file would make
// secret-scan flag the tool that scans for secrets, so the probes are built at runtime.
function runSelfTest() {
  const failures = [];
  let ran = 0;
  const check = (name, cond) => { ran += 1; if (!cond) failures.push(name); };

  // extractProviders
  check('providers extract from a normal list', JSON.stringify(extractProviders("const LADDER_PROVIDERS = ['openai', 'gemini'];")) === '["gemini","openai"]');
  check('providers are sorted, so ordering never fakes a mismatch', JSON.stringify(extractProviders("const LADDER_PROVIDERS = ['b', 'a'];")) === '["a","b"]');
  check('an empty list extracts as [] not null', JSON.stringify(extractProviders('const LADDER_PROVIDERS = [];')) === '[]');
  check('a missing list extracts as null', extractProviders('const SOMETHING_ELSE = 1;') === null);
  check('null source extracts as null', extractProviders(null) === null);

  // Parity: the vacuous green this closes is [] === [].
  check('identical non-empty lists are in parity', providersParity(['openai'], ['openai']).ok === true);
  check('different lists are NOT in parity', providersParity(['openai'], ['gemini']).ok === false);
  check('TWO EMPTY LISTS ARE NOT PARITY', providersParity([], []).ok === false);
  check('empty vs non-empty is not parity', providersParity([], ['openai']).ok === false);
  check('non-empty vs empty is not parity', providersParity(['openai'], []).ok === false);
  check('an unextractable list is not parity', providersParity(null, ['openai']).ok === false);
  check('order does not affect parity', providersParity(['a', 'b'], ['b', 'a']).ok === true);

  // Secret detectors must actually FIRE, not merely be present in the source.
  const FAKE_OPENAI = ['sk', 'A1b2C3d4E5f6'].join('-');
  const FAKE_SLACK = ['xoxb', '1234-5678-Abcd'].join('-');
  const FAKE_GH = ['ghp', 'aBcD1234eFgH5678'].join('_');
  check('an OpenAI-shaped key is detected', hasHardcodedSecret(`const k = "${FAKE_OPENAI}";`) === true);
  check('a Slack-shaped token is detected', hasHardcodedSecret(`const k = "${FAKE_SLACK}";`) === true);
  check('a GitHub-shaped token is detected', hasHardcodedSecret(`const k = "${FAKE_GH}";`) === true);
  check('an ordinary config file is clean', hasHardcodedSecret('const MODEL = "gpt-4o"; const X = 1;') === false);
  check('a too-short sk- fragment is not flagged', hasHardcodedSecret('sk-short') === false);
  // NOTE: no "sk-antigravity" style near-miss assertion. The detector is deliberately
  // fail-safe: any sk- plus 10+ alphanumerics is reported. Asserting an exemption would
  // push toward special-casing the regex, which is how detectors grow holes.

  if (failures.length) {
    console.error(`extension-check self-test FAIL: ${failures.length} problem(s):`);
    for (const f of failures) console.error(`  FAIL  ${f}`);
    process.exit(1);
  }
  console.log(`extension-check self-test: ${ran}/${ran} passed`);
}

// ---- report -----------------------------------------------------------------
if (!quiet || failures.length > 0) {
  console.log(`extension-check: ${passes.length} passed, ${failures.length} failed`);
  for (const f of failures) console.log(`  FAIL  ${f}`);
  if (!quiet) for (const p of passes) console.log(`  ok    ${p}`);
}
process.exit(failures.length > 0 ? 1 : 0);
