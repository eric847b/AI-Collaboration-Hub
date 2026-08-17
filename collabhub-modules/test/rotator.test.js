'use strict';
/**
 * Off-line verification of the FreeAIRotator's seamless failover.
 * Uses fake providers (no network) to prove it rotates 429 → 500 → 200
 * instantly, with no pause, and returns the working provider's output.
 */
const { FreeAIRotator } = require('../src/rotator');

let failures = 0;
let passed = 0;
function ok(cond, msg) {
  if (cond) {
    console.log('  ✓ ' + msg);
    passed++;
  } else {
    console.log('  ✗ FAIL: ' + msg);
    failures++;
  }
}

const fakeProviders = [
  {
    name: 'A',
    endpoint: 'https://a.local',
    // 429 → rate limited
    request_behavior: 429,
    extract: (b) => b.text || '',
  },
  {
    name: 'B',
    endpoint: 'https://b.local',
    request_behavior: 500, // server error
    extract: (b) => b.text || '',
  },
  {
    name: 'C',
    endpoint: 'https://c.local',
    request_behavior: 200, // success
    extract: (b) => b.text || '',
  },
];

(async function main() {
  const started = Date.now();
  const rotator = new FreeAIRotator({
    providers: fakeProviders,
    collectionPeriodMs: 5, // minimal cooldown → "no pause"
    maxAttempts: 6,
    request: async (url) => {
      const p = fakeProviders.find((x) => x.endpoint === url);
      if (p.request_behavior === 200) {
        return { status: 200, json: () => ({ text: 'OK from C' }), text: '' };
      }
      return { status: p.request_behavior, json: () => ({}), text: '' };
    },
  });

  const elapsed = Date.now() - started;

  const out = await rotator.complete('ping');
  ok(out.provider === 'C', `used provider C (got: ${out.provider})`);
  ok(out.text === 'OK from C', `returned expected output (got: ${out.text})`);
  ok(
    rotator.tally.rotations === 2,
    `rotated through A and B (rotations=${rotator.tally.rotations})`
  );
  ok(elapsed < 1000, `completed without meaningful pause (${elapsed}ms)`);

    // Second call should skip the (now cooling) A and B and go straight to C.
  const out2 = await rotator.complete('ping, again');
  ok(out2.provider === 'C', 'subsequent call used healthy C immediately');

  // ---- Multi-step run(): step accumulation + rotation on failover ----
  const stepProviders = [
    {
      name: 'A',
      endpoint: 'https://a.local',
      request_behavior: 429, // always fails -> failover to B
      extract: (b) => b.text || '',
    },
    {
      name: 'B',
      endpoint: 'https://b.local',
      request_behavior: 200,
      extract: (b) => b.text || '',
    },
  ];
  const steps = new FreeAIRotator({
    providers: stepProviders,
    collectionPeriodMs: 5,
    maxAttempts: 4,
    request: async (url) => {
      const p = stepProviders.find((x) => x.endpoint === url);
      if (p.request_behavior === 200) {
        return { status: 200, json: () => ({ text: 'OK from B' }), text: '' };
      }
      return { status: p.request_behavior, json: () => ({}), text: '' };
    },
  });
    const results = await steps.run({ steps: ['s1', 's2', 's3'] });
  ok(results.length === 3, `run() accumulated ${results.length}/3 steps`);
  ok(
    results.every((r) => r.provider === 'B' && r.text === 'OK from B'),
    'all steps returned B (failover rotated through A)'
  );
  ok(
    steps.tally.rotations > 0 && steps.tally.calls >= 3,
    `steps rotated/calls=rotations=${steps.tally.rotations} calls=${steps.tally.calls}`
  );

  console.log('\nSummary: passed=' + passed + ' failures=' + failures);
  process.exit(failures === 0 ? 0 : 1);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
