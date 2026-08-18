'use strict';
/**
 * ESM smoke test for the FreeAI rotator facade (src/rotator.mjs).
 *
 * Run with:
 *   node src/__esm_smoke.mjs
 *   npm run test:esm   (if wired into package.json)
 *
 * Verifies that the ESM named exports (`FreeAirRotator`, `defaultProviders`,
 * `delay`) are real static bindings (Node's CJS->ESM interop does not always
 * surface names from `module.exports`), and that multi-step `run()` with
 * failover works end-to-end through the ESM façade — all offline.
 */
import { FreeAIRotator, defaultProviders, delay } from './rotator.mjs';
import defaultExport from './rotator.mjs';

let pass = 0;
let fail = 0;
function assert(cond, msg) {
  if (cond) {
    pass++;
    console.log('  \u2713 ' + msg);
  } else {
    fail++;
    console.error('  \u2717 ' + msg);
  }
}

// 1. Named exports are statically detectable.
assert(typeof FreeAIRotator === 'function', 'FreeAIRotator is a function (class)');
assert(Array.isArray(defaultProviders()) === true, 'defaultProviders() returns an array (n=' + defaultProviders().length + ')');
assert(defaultProviders().length >= 8, 'default pool has >= 8 lanes');
assert(typeof delay === 'function', 'delay is a function');

// 2. Default export mirrors the named bindings.
assert(typeof defaultExport.FreeAIRotator === 'function', 'default export exposes FreeAIRotator');
assert(Array.isArray(defaultExport.defaultProviders()), 'default export exposes defaultProviders');
assert(typeof defaultExport.delay === 'function', 'default export exposes delay');

// 3. delay() actually waits (smoke).
const t0 = Date.now();
await delay(10);
assert(Date.now() - t0 >= 5, 'delay() awaits ~requested ms');

// 4. End-to-end multi-step run() with failover through the ESM façade.
let calls = 0;
const providers = [
  {
    name: 'A',
    free: true,
    endpoint: 'https://a.example/v1/chat/completions',
    headers: () => ({ 'Content-Type': 'application/json' }),
    body: (text) => ({ messages: [{ role: 'user', content: text }] }),
    extract: (body) => body.choices?.[0]?.message?.content || '',
  },
  {
    name: 'B',
    free: true,
    endpoint: 'https://b.example/v1/chat/completions',
    headers: () => ({ 'Content-Type': 'application/json' }),
    body: (text) => ({ messages: [{ role: 'user', content: text }] }),
    extract: (body) => body.choices?.[0]?.message?.content || '',
  },
];

function makeRequest(name, status, text) {
  return async (url, { headers, body }) => {
    calls++;
    // Provider A always fails (429) to force failover to B.
    if (url.includes('a.example')) {
      return { status: 429, json: () => ({}), text: '{"error":"rate limited"}' };
    }
    return {
      status,
      json: () => ({ choices: [{ message: { content: text } }] }),
      text: JSON.stringify({ choices: [{ message: { content: text } }] }),
    };
  };
}

const rotator = new FreeAIRotator({
  providers,
  request: makeRequest('A', 200, 'OK from ' + 'B via ESM'),
});
const task = { steps: ['step A', 'step B'] };
const results = await rotator.run(task);

assert(results.length === 2, 'run() accumulated 2/2 steps');
assert(results.every((r) => r.text === 'OK from B via ESM'), 'all steps returned B (failover rotated through A in ESM)');
assert(results[0].provider === 'B' && results[1].provider === 'B', 'each step attributed to provider B');
assert(rotator.tally.calls >= 3, 'rotator made >=3 requests via ESM façade (calls=' + rotator.tally.calls + ')');
assert(rotator.tally.rotations >= 1, 'rotator rotated at least once (failover from A to B, rotations=' + rotator.tally.rotations + ')');

console.log('\nSummary (esm smoke): passed=' + pass + ' failures=' + fail);
if (fail > 0) process.exitCode = 1;
