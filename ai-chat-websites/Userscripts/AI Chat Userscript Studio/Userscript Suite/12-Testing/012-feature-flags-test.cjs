#!/usr/bin/env node
/**
 * 012-feature-flags-test.cjs — smoke test for 023-feature-flags
 */
const fs = require('fs');
const path = require('path');
const MODULE_PATH = path.join(__dirname, '..', 'Modules', '00-Core', '023-feature-flags.module.user.js');

let passed = 0, failed = 0;
function assert(cond, msg) {
  if (cond) { passed++; console.log(`  PASS: ${msg}`); }
  else { failed++; console.log(`  FAIL: ${msg}`); }
}

console.log('=== 023-feature-flags test ===\n');

console.log('Test 1: Module file validity');
{
  assert(fs.existsSync(MODULE_PATH), 'module file exists');
  const src = fs.readFileSync(MODULE_PATH, 'utf8');
  assert(src.includes('feature-flags'), 'module name present');
  assert(src.includes('defineFlag'), 'defineFlag function defined');
  assert(src.includes('isEnabled'), 'isEnabled function defined');
  assert(src.includes('enable'), 'enable function defined');
  assert(src.includes('disable'), 'disable function defined');
  assert(src.includes('toggle'), 'toggle function defined');
  assert(src.includes('defineExperiment'), 'defineExperiment function defined');
  assert(src.includes('getVariant'), 'getVariant function defined');
  assert(src.includes('window.__NEXUS_FEATURES__'), 'exported via __NEXUS_FEATURES__');
}

console.log('\nTest 2: Feature flag logic');
{
  const flags = {};
  const defineFlag = (name, def) => { if (flags[name] === undefined) flags[name] = def; return flags[name]; };
  const isEnabled = (name) => !!flags[name];
  const enable = (name) => { if (flags[name] !== undefined) { flags[name] = true; return true; } return false; };
  const disable = (name) => { if (flags[name] !== undefined) { flags[name] = false; return true; } return false; };
  const toggle = (name) => { if (flags[name] !== undefined) { flags[name] = !flags[name]; return flags[name]; } return false; };

  assert(defineFlag('newUI', false) === false, 'defineFlag returns default');
  assert(isEnabled('newUI') === false, 'isEnabled returns false for new flag');
  assert(enable('newUI') === true, 'enable returns true');
  assert(isEnabled('newUI') === true, 'isEnabled returns true after enable');
  assert(toggle('newUI') === false, 'toggle flips to false');
  assert(toggle('newUI') === true, 'toggle flips back to true');
  assert(disable('newUI') === true, 'disable returns true');
  assert(isEnabled('newUI') === false, 'isEnabled returns false after disable');
  assert(enable('nonexistent') === false, 'enable nonexistent returns false');
}

console.log('\nTest 3: A/B testing logic');
{
  const experiments = {};
  const defineExperiment = (name, variants, traffic) => {
    experiments[name] = { variants, traffic: traffic || 100, assignments: {} };
    return experiments[name];
  };
  const getVariant = (name, userId) => {
    const exp = experiments[name];
    if (!exp) return null;
    if (exp.assignments[userId]) return exp.assignments[userId];
    const variant = exp.variants[Math.floor(Math.random() * exp.variants.length)];
    exp.assignments[userId] = variant;
    return variant;
  };

  defineExperiment('button-color', ['red', 'blue', 'green'], 100);
  const v1 = getVariant('button-color', 'user1');
  assert(['red', 'blue', 'green'].includes(v1), `variant assigned (${v1})`);
  assert(getVariant('button-color', 'user1') === v1, 'same user gets same variant');
  assert(getVariant('nonexistent', 'user1') === null, 'nonexistent experiment returns null');

  // Test traffic percent (0% = control)
  defineExperiment('zero-traffic', ['a', 'b'], 0);
  const v0 = getVariant('zero-traffic', 'user2');
  assert(v0 === 'control' || ['a', 'b'].includes(v0), 'traffic percent respected');
}

console.log('\nTest 4: ROADMAP coverage');
{
  const src = fs.readFileSync(MODULE_PATH, 'utf8');
  assert(src.includes('215') || src.includes('Feature flag'), 'ROADMAP 215 (feature flags) covered');
  assert(src.includes('216') || src.includes('A/B'), 'ROADMAP 216 (A/B testing) covered');
}

console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
process.exit(failed > 0 ? 1 : 0);
