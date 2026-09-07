#!/usr/bin/env node
/**
 * 015-analytics-engine-test.cjs — smoke test for 026-analytics-engine (ROADMAP 262-280)
 * Loads the REAL module in a vm sandbox with stubbed GM_* APIs.
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const MODULE_PATH = path.join(__dirname, '..', 'Modules', '00-Core', '026-analytics-engine.module.user.js');

let passed = 0, failed = 0;
function assert(cond, msg) {
  if (cond) { passed++; console.log(`  PASS: ${msg}`); }
  else { failed++; console.log(`  FAIL: ${msg}`); }
}

console.log('=== 026-analytics-engine test ===\n');

// --- sandbox-load the real module ---
const storage = {};
const sandbox = {
  console: { log() {} },
  GM_setValue: (k, v) => { storage[k] = v; },
  GM_getValue: (k, d) => (k in storage ? storage[k] : d),
  document: { readyState: 'complete' },
};
sandbox.window = sandbox;
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(MODULE_PATH, 'utf8'), sandbox, { filename: '026-analytics-engine.module.user.js' });
const A = sandbox.window.__NEXUS_ANALYTICS__;

console.log('Test 1: Module load + file validity');
{
  assert(fs.existsSync(MODULE_PATH), 'module file exists');
  assert(!!A, 'module self-registered on window.__NEXUS_ANALYTICS__');
  assert(A.metadata && A.metadata.name === 'analytics-engine', 'metadata exported');
  assert(A.getHealth().healthy === true, 'init() ran and reports healthy');
  const src = fs.readFileSync(MODULE_PATH, 'utf8');
  for (const item of [262, 263, 264, 265, 266, 267, 268, 269, 270, 271, 272, 273, 274, 275, 276, 277, 278, 279, 280]) {
    assert(src.includes(String(item)), `ROADMAP ${item} referenced`);
  }
}

console.log('\nTest 2: Heatmaps (262)');
{
  A.recordHeat(10, 10);
  A.recordHeat(12, 14);
  A.recordHeat(300, 300);
  const hm = A.getHeatmap();
  assert(hm.total === 3, 'heatmap total counts all records');
  assert(hm.max === 2, 'heatmap max tracks hottest cell');
  assert(hm.cells.length === 2, 'heatmap buckets same-cell clicks together');
}

console.log('\nTest 3: Session replay + recordings (263/264)');
{
  A.recordEvent('page-view', { path: '/' });
  A.startRecording('sess1');
  A.recordEvent('click', { x: 1, y: 2 });
  const summary = A.stopRecording();
  assert(summary && summary.events === 1, 'recording captures only in-session events');
  assert(A.getSessionReplay().length === 2, 'replay ring buffer holds all events');
  assert(A.stopRecording() === null, 'stopRecording without active recording returns null');
}

console.log('\nTest 4: Conversions + funnel analysis (265/266)');
{
  A.trackConversion('signup', 9.99);
  A.trackConversion('signup', 9.99);
  const conv = A.trackConversion('signup');
  assert(conv.count === 3, 'conversion counter increments');
  assert(Math.abs(conv.value - 19.98) < 1e-9, 'conversion value sums numeric revenue');
  A.defineFunnel('signup-funnel', ['view', 'click', 'join']);
  A.recordFunnelStep('signup-funnel', 0);
  A.recordFunnelStep('signup-funnel', 0);
  A.recordFunnelStep('signup-funnel', 1);
  A.recordFunnelStep('signup-funnel', 2);
  const fn = A.analyzeFunnel('signup-funnel');
  assert(fn.entered === 2 && fn.completed === 1, 'funnel entry/completion counted');
  assert(fn.completionRate === 0.5, 'funnel completion rate correct');
  assert(fn.steps[1].dropOff === 0.5, 'step drop-off computed vs previous step');
}

console.log('\nTest 5: Cohorts, retention, churn (267/268/269)');
{
  A.assignCohort('u1');
  const cohorts = A.getCohorts();
  const firstPeriod = Object.keys(cohorts)[0];
  assert(firstPeriod && cohorts[firstPeriod].includes('u1'), 'cohort assignment grouped by period');
  A.recordActivity('r-new');
  const st = A.getInternalState();
  const now = Date.now();
  st.activity['r-user'] = { firstSeen: now - 8 * 86400000, lastSeen: now - 86400000, days: { 1: true, 7: true }, hits30: [] };
  const ret = A.getRetention();
  const d7 = ret.buckets.find((b) => b.offset === 7);
  assert(d7 && d7.eligible === 1 && d7.retained === 1 && d7.rate === 1, 'D7 retention computed from activity days');
  const churnOld = A.predictChurn('r-user');
  assert(churnOld.daysSinceLast === 1 && churnOld.level === 'medium', 'churn heuristic blends inactivity + quiet window');
  assert(A.predictChurn('ghost').risk === 1, 'unknown user gets max churn risk');
}

console.log('\nTest 6: LTV, attribution, ROI (270/271/272)');
{
  A.recordRevenue('u1', 100);
  A.recordRevenue('u2', 50);
  const ltv = A.calculateLtv();
  assert(ltv.payers === 2 && ltv.arpu === 75, 'ARPU = total revenue / paying users');
  assert(ltv.ltv === 225, 'LTV = ARPU * lifespan months (90d default)');
  A.recordSpend('ads', 50);
  A.attributeRevenue(150, 'ads');
  const roi = A.calculateRoi();
  assert(roi.ads && roi.ads.roi === 2, 'ROI = (attributed revenue - spend) / spend');
}

console.log('\nTest 7: A/B experiments + statistics (273-276)');
{
  A.createExperiment('exp1', ['control', 'variant']);
  for (let i = 0; i < 100; i++) A.recordExperimentView('exp1', 'control');
  for (let i = 0; i < 100; i++) A.recordExperimentView('exp1', 'variant');
  for (let i = 0; i < 10; i++) A.recordExperimentConversion('exp1', 'control');
  for (let i = 0; i < 25; i++) A.recordExperimentConversion('exp1', 'variant');
  const res = A.getExperimentResults('exp1');
  const control = res.rows.find((r) => r.label === 'control');
  const variant = res.rows.find((r) => r.label === 'variant');
  assert(control.rate === 0.1 && variant.rate === 0.25, 'variant conversion rates computed');
  const ci = A.waldInterval(10, 100);
  assert(ci.lower < 0.1 && 0.1 < ci.upper, 'Wald confidence interval brackets the point estimate');
  const sig = res.comparisons[0];
  assert(sig.p < 0.05 && sig.significant === true, 'two-proportion z-test flags significant lift');
  assert(res.winner === 'variant', 'experiment winner declared from significant positive lift');
  assert(A.hypothesisTest(10, 100, 25, 100, 0.05).reject === true, 'hypothesis test rejects clear difference');
  assert(A.hypothesisTest(10, 100, 12, 100, 0.05).reject === false, 'hypothesis test keeps noise unrejected');
}

console.log('\nTest 8: Bayesian inference (277)');
{
  const post = A.betaPosterior(1, 1, 8, 2);
  assert(post.alpha === 9 && post.beta === 3, 'Beta-Binomial posterior parameters updated');
  assert(post.mean === 0.75, 'posterior mean = alpha / (alpha + beta)');
}

console.log('\nTest 9: Multi-armed bandit (278)');
{
  A.createBandit('b1', ['explore', 'exploit']);
  for (let i = 0; i < 30; i++) {
    A.recordReward('b1', 'exploit', Math.random() < 0.9);
    A.recordReward('b1', 'explore', Math.random() < 0.1);
  }
  let exploitWins = 0;
  for (let i = 0; i < 40; i++) {
    const arm = A.selectArm('b1');
    if (arm !== 'explore' && arm !== 'exploit') {
      assert(false, 'Thompson sampling always selects a known arm');
      break;
    }
    if (i === 39) assert(true, 'Thompson sampling always selects a known arm');
    if (arm === 'exploit') exploitWins++;
  }
  assert(exploitWins >= 30, `better arm dominates Thompson draws (${exploitWins}/40)`);
}

console.log('\nTest 10: Q-learning + causal effect (279/280)');
{
  const v = A.qUpdate('s1', 'left', 1, 's2');
  assert(Math.abs(v - 0.1) < 1e-12, 'Q-value moves toward reward with default learning rate');
  A.qUpdate('s1', 'right', 0.5, 's2');
  const best = A.qBestAction('s1');
  assert(best.action === 'left' && Math.abs(best.value - 0.1) < 1e-12, 'greedy policy picks highest-value action');
  assert(A.estimateCausalEffect(10, 30, 10, 15).effect === 15, 'difference-in-differences effect estimate');
}

console.log('\nTest 11: Persistence');
{
  const raw = JSON.parse(storage.analytics_engine_config);
  assert(raw && raw.experiments && raw.experiments.exp1, 'state persisted to GM storage');
  assert(raw.settings && raw.settings.ltvLifespanDays === 90, 'settings persisted with defaults');
}

console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
process.exit(failed > 0 ? 1 : 0);



