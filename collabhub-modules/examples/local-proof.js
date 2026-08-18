'use strict';
/**
 * Local proof script — demonstrates the FreeAI rotator working
 * entirely offline (no network, no API key). It uses fake providers
 * that simulate 429 → 500 → 200 failover, exactly as the offline
 * test does, but runs end‑to‑end through the real rotator code.
 *
 * Run:
 *   node examples/local-proof.js
 *
 * Output (example):
 *   ✗ All free AI providers exhausted this round (8 rotations, 8 calls)
 *   (or, with a local lane available, the working provider's output)
 */
const { FreeAIRotator } = require('../src/rotator');

// 3 fake providers: A always 429, B always 500, C always 200
const fakeProviders = [
  {
    name: 'A',
    endpoint: 'https://a.local',
    // Simulate rate‑limit
    request_behavior: 429,
    extract: (b) => b.text || '',
  },
  {
    name: 'B',
    endpoint: 'https://b.local',
    // Simulate server error
    request_behavior: 500,
    extract: (b) => b.text || '',
  },
  {
    name: 'C',
    endpoint: 'https://c.local',
    // Success
    request_behavior: 200,
    extract: (b) => b.text || '',
  },
];

// A tiny Node transport that reads the fake behavior
async function nodeRequest(url, { method, headers, body }) {
  const p = fakeProviders.find((x) => x.endpoint === url);
  if (!p) return { status: 500, json: () => ({}), text: '' };
  if (p.request_behavior === 200) {
    return { status: 200, json: () => ({ text: 'OK from C' }), text: '' };
  }
  // For non‑200 we just return the behavior status; the rotator will
  // mark it failed and rotate on.
  return { status: p.request_behavior, json: () => ({}), text: '' };
}

async function main() {
  const rotator = new FreeAIRotator({
    providers: fakeProviders,
    collectionPeriodMs: 5, // minimal cooldown → "no pause"
    maxAttempts: 6,
    request: nodeRequest,
  });

  const started = Date.now();
  try {
    const out = await rotator.complete('ping');
    console.log('✓ Success from', out.provider, ':', out.text);
    console.log('Rotations:', rotator.tally.rotations, 'Calls:', rotator.tally.calls);
  } catch (e) {
    console.log('✗ All free AI providers exhausted this round', {
      rotations: rotator.tally.rotations,
      calls: rotator.tally.calls,
    });
  }
  const elapsed = Date.now() - started;
  console.log('Elapsed:', elapsed, 'ms (should be < 1000 for "no pause")');
}

main().catch((err) => {
  console.error('✗ unexpected error', err);
  process.exit(1);
});
