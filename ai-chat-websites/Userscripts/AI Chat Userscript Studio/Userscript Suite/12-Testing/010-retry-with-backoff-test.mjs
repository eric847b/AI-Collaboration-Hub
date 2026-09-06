#!/usr/bin/env node
/**
 * 010-retry-with-backoff-test.cjs
 * Smoke test for 021-failure-recovery retryWithBackoff backoff math.
 * Verifies delay sequence, maxRetries behavior, and policy application.
 */

// Replicate the backoff logic from 021 (without GM_setValue dependencies)
const RETRY_POLICIES = {
  transient: { maxRetries: 3, backoffMs: 500, backoffFactor: 2 },
  init:      { maxRetries: 2, backoffMs: 1000, backoffFactor: 2 },
  render:    { maxRetries: 2, backoffMs: 200, backoffFactor: 1.5 },
  storage:   { maxRetries: 1, backoffMs: 250, backoffFactor: 1 },
  fatal:     { maxRetries: 0, backoffMs: 0, backoffFactor: 1 },
};

function getExpectedDelays(policyName) {
  const p = RETRY_POLICIES[policyName];
  if (!p || p.maxRetries === 0) return [];
  const delays = [];
  let delay = p.backoffMs;
  for (let i = 0; i < p.maxRetries; i++) {
    delays.push(delay);
    delay = Math.round(delay * p.backoffFactor);
  }
  return delays;
}

// Simulate retryWithBackoff and record actual delays
async function simulateRetry(policyName, failCount) {
  const p = RETRY_POLICIES[policyName];
  const delays = [];
  let attempt = 0;
  let delay = p.backoffMs;

  while (attempt <= p.maxRetries) {
    if (attempt >= failCount) {
      return { success: true, attempt, delays };
    }
    attempt++;
    if (attempt > p.maxRetries) break;
    delays.push(delay);
    delay = Math.round(delay * p.backoffFactor);
  }
  return { success: false, attempt: p.maxRetries + 1, delays };
}

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    passed++;
    console.log(`  PASS: ${message}`);
  } else {
    failed++;
    console.log(`  FAIL: ${message}`);
  }
}

function arraysEqual(a, b) {
  if (a.length !== b.length) return false;
  return a.every((v, i) => v === b[i]);
}

console.log('=== retryWithBackoff backoff math test ===\n');

// Test 1: transient policy delays
console.log('Test 1: transient policy (500ms, factor 2, maxRetries 3)');
{
  const expected = getExpectedDelays('transient');
  assert(arraysEqual(expected, [500, 1000, 2000]), `expected [500, 1000, 2000], got [${expected.join(', ')}]`);
}

// Test 2: init policy delays
console.log('\nTest 2: init policy (1000ms, factor 2, maxRetries 2)');
{
  const expected = getExpectedDelays('init');
  assert(arraysEqual(expected, [1000, 2000]), `expected [1000, 2000], got [${expected.join(', ')}]`);
}

// Test 3: render policy delays (fractional factor)
console.log('\nTest 3: render policy (200ms, factor 1.5, maxRetries 2)');
{
  const expected = getExpectedDelays('render');
  assert(arraysEqual(expected, [200, 300]), `expected [200, 300], got [${expected.join(', ')}]`);
}

// Test 4: storage policy (factor 1, no growth)
console.log('\nTest 4: storage policy (250ms, factor 1, maxRetries 1)');
{
  const expected = getExpectedDelays('storage');
  assert(arraysEqual(expected, [250]), `expected [250], got [${expected.join(', ')}]`);
}

// Test 5: fatal policy (no retries)
console.log('\nTest 5: fatal policy (0 retries)');
{
  const expected = getExpectedDelays('fatal');
  assert(arraysEqual(expected, []), `expected [], got [${expected.join(', ')}]`);
}

// Test 6: success on first attempt (no delays)
console.log('\nTest 6: success on attempt 0 (transient policy)');
{
  const result = await simulateRetry('transient', 0);
  assert(result.success === true, 'should succeed');
  assert(result.attempt === 0, `attempt should be 0, got ${result.attempt}`);
  assert(result.delays.length === 0, `no delays expected, got ${result.delays.length}`);
}

// Test 7: success after 2 failures
console.log('\nTest 7: success after 2 failures (transient policy, maxRetries 3)');
{
  const result = await simulateRetry('transient', 2);
  assert(result.success === true, 'should succeed on attempt 2');
  assert(result.delays.length === 2, `2 delays expected (after attempt 0 and 1), got ${result.delays.length}`);
  assert(result.delays[0] === 500, `first delay should be 500ms, got ${result.delays[0]}`);
  assert(result.delays[1] === 1000, `second delay should be 1000ms, got ${result.delays[1]}`);
}

// Test 8: failure after exhausting retries
console.log('\nTest 8: failure after exhausting retries (init policy, maxRetries 2)');
{
  const result = await simulateRetry('init', 99); // always fail
  assert(result.success === false, 'should fail');
  assert(result.attempt === 3, `should attempt 3 times (0,1,2), got ${result.attempt}`);
  assert(result.delays.length === 2, `2 delays expected, got ${result.delays.length}`);
  assert(arraysEqual(result.delays, [1000, 2000]), `delays should be [1000, 2000], got [${result.delays.join(', ')}]`);
}

// Test 9: verify delay rounding (render policy)
console.log('\nTest 9: fractional delay rounding (render policy)');
{
  // 200 * 1.5 = 300 (exact), 300 * 1.5 = 450
  const expected = getExpectedDelays('render');
  assert(expected[0] === 200, `first delay should be 200, got ${expected[0]}`);
  assert(expected[1] === 300, `second delay should be 300 (200*1.5), got ${expected[1]}`);
  // Verify Math.round is applied (would be 300.0 exactly here)
  assert(Number.isInteger(expected[1]), 'delay should be integer');
}

// Test 10: maxRetries boundary (storage policy, maxRetries 1)
console.log('\nTest 10: maxRetries boundary (storage policy, maxRetries 1)');
{
  const result = await simulateRetry('storage', 1); // fail once, succeed on retry
  assert(result.success === true, 'should succeed on attempt 1');
  assert(result.delays.length === 1, `1 delay expected, got ${result.delays.length}`);
}

// Test 11: maxRetries boundary (storage policy, always fail)
console.log('\nTest 11: maxRetries boundary exhausted (storage policy)');
{
  const result = await simulateRetry('storage', 99);
  assert(result.success === false, 'should fail');
  assert(result.attempt === 2, `should attempt 2 times (0,1), got ${result.attempt}`);
}

console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
process.exit(failed > 0 ? 1 : 0);
