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
const quiet = process.argv.includes('--quiet');

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
    check(
      `LADDER_PROVIDERS parity (${bgProviders.join(',')})`,
      JSON.stringify(bgProviders) === JSON.stringify(optProviders),
      `background=[${bgProviders}] options=[${optProviders}]`,
    );
  }
}

// ---- 5. secrets -------------------------------------------------------------
for (const [name, src] of [
  ['background.js', bg],
  ['options.html', opt],
]) {
  if (src === null) continue;
  check(
    `${name} has no hardcoded secrets`,
    !/sk-[A-Za-z0-9]{10,}/.test(src) && !/xox[bap]-[A-Za-z0-9-]+/.test(src) && !/ghp_[A-Za-z0-9]{10,}/.test(src),
  );
}

// ---- report -----------------------------------------------------------------
if (!quiet || failures.length > 0) {
  console.log(`extension-check: ${passes.length} passed, ${failures.length} failed`);
  for (const f of failures) console.log(`  FAIL  ${f}`);
  if (!quiet) for (const p of passes) console.log(`  ok    ${p}`);
}
process.exit(failures.length > 0 ? 1 : 0);
