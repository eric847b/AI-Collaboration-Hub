'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const MODULE_PATH = path.resolve(__dirname, '..', 'Modules', '00-Core', '032-testing-quality.module.user.js');
const source = fs.readFileSync(MODULE_PATH, 'utf8');

let passed = 0, failed = 0;
function test(name, fn) {
    try { fn(); passed++; console.log(`  PASS  ${name}`); }
    catch (e) { failed++; console.log(`  FAIL  ${name}: ${e.message}`); }
}

const sandbox = {
    window: {},
    GM_setValue: (k, v) => { sandbox._store = sandbox._store || {}; sandbox._store[k] = v; },
    GM_getValue: (k, d) => { sandbox._store = sandbox._store || {}; return sandbox._store[k] !== undefined ? sandbox._store[k] : d; },
    GM_log: () => {},
    Date, JSON, Math, WeakRef, Object, Array, String, Number, Boolean,
};
sandbox.window.__NEXUS_HUB__ = { registerModule: () => {} };
const ctx = vm.createContext(sandbox);
vm.runInContext(source, ctx, { filename: '032-testing-quality.module.user.js' });
const m = sandbox.window.__NEXUS_TESTING_QUALITY__;
assert(m, 'module should export __NEXUS_TESTING_QUALITY__');

console.log('\n=== Module 032: Testing & Quality (201-220) ===\n');

// --- 201: Unit test coverage ---
test('201 registerSuite', () => {
    m.registerSuite('suite1', [{ name: 't1', fn: () => {} }]);
    assert.deepStrictEqual(JSON.stringify(m.getSuiteNames()), JSON.stringify(['suite1']));
});
test('201 runSuite passes', () => {
    const r = m.runSuite('suite1');
    assert.strictEqual(r.passed, 1); assert.strictEqual(r.failed, 0);
});
test('201 runSuite fails', () => {
    m.registerSuite('suite2', [{ name: 'bad', fn: () => { throw new Error('fail'); } }]);
    const r = m.runSuite('suite2');
    assert.strictEqual(r.failed, 1); assert.strictEqual(r.results[0].ok, false);
});
test('201 runAllSuites', () => {
    const all = m.runAllSuites();
    assert.strictEqual(all.length, 2);
});

// --- 202: Integration test suite ---
test('202 createIntegrationSuite', async () => {
    const s = m.createIntegrationSuite('int1', [{ name: 'step1', action: async () => {} }]);
    const r = await s.run();
    assert.strictEqual(r.passed, 1); assert.strictEqual(r.failed, 0);
});

// --- 203: End-to-end testing ---
test('203 createE2EScenario', async () => {
    const s = m.createE2EScenario('e2e1', [async () => 42]);
    const r = await s.run();
    assert.strictEqual(r.passed, 1); assert.strictEqual(r.results[0].result, 42);
});

// --- 204: Visual regression ---
test('204 captureSnapshot', () => {
    m.captureSnapshot('snap1', 'hello');
    assert.deepStrictEqual(JSON.stringify(m.listSnapshots()), JSON.stringify(['snap1']));
});
test('204 compareSnapshot match', () => {
    const r = m.compareSnapshot('snap1', 'hello');
    assert.strictEqual(r.match, true); assert.strictEqual(r.diff, 0);
});
test('204 compareSnapshot diff', () => {

// --- 207: Security scanning ---
test('207 scanSecurity finds eval', () => {
    const r = m.scanSecurity('eval("code")');
    assert.strictEqual(r.critical, 1); assert(r.findings[0].rule === 'eval-usage');
});
test('207 scanSecurity finds innerHTML', () => {
    const r = m.scanSecurity('el.innerHTML = "<div>"');
    assert(r.high >= 1);
});
test('207 scanSecurity clean code', () => {
    const r = m.scanSecurity('const x = 1 + 2;');
    assert.strictEqual(r.critical, 0); assert.strictEqual(r.high, 0);
});

// --- 208: Dependency auditing ---
test('208 auditDependencies', () => {
    const r = m.auditDependencies([{ name: 'lodash', version: '4.17.21' }, { name: 'bad' }]);
    assert.strictEqual(r.total, 2); assert.strictEqual(r.ok, 1); assert.strictEqual(r.failing, 1);
});

// --- 209: License compliance ---
test('209 checkLicenseCompliance', () => {
    const r = m.checkLicenseCompliance([{ name: 'a', license: 'MIT' }, { name: 'b', license: 'GPL-3.0' }]);
    assert.strictEqual(r.approved, 1); assert.strictEqual(r.copyleft, 1);
});

// --- 210: Code coverage reports ---
test('210 recordCoverage & getCoverageReport', () => {
    m.recordCoverage('file1.js', { 1: 5, 2: 0, 3: 3 }, { 1: 2, 2: 0 });
    const r = m.getCoverageReport();
    assert.strictEqual(r.fileCount, 1);
    assert(Math.abs(r.files['file1.js'].lineCoverage - 200 / 3) < 0.01);
});

// --- 211: Mutation testing ---
test('211 mutateCode negate-condition', () => {
    const r = m.mutateCode('if (a === b)', 'negate-condition');
    assert(r.includes('!=='));
});
test('211 runMutationTest', () => {
    const orig = (a, b) => a + b;
    const mutant = (a, b) => a - b;
    const r = m.runMutationTest('mut1', orig, mutant, [[1, 2], [3, 4]]);
    assert.strictEqual(r.killed, 2); assert.strictEqual(r.survived, 0); assert.strictEqual(r.score, 100);
});

// --- 213: Chaos engineering ---
test('213 createChaosExperiment', () => {
    m.createChaosExperiment('exp1', { networkLatency: 100, cpuStress: true });
    const list = m.listExperiments();
    assert.strictEqual(list.length, 1); assert.strictEqual(list[0].name, 'exp1');
});
test('213 runChaosExperiment', () => {
    const r = m.runChaosExperiment('exp1');
    assert.strictEqual(r.status, 'completed'); assert.strictEqual(r.injections, 2);

// --- 215: Feature flags ---
test('215 createFlag', () => {
    m.createFlag('flag1', true);
    assert.deepStrictEqual(JSON.stringify(m.listFlags()), JSON.stringify([{ name: 'flag1', enabled: true }]));
});
test('215 evaluateFlag enabled', () => {
    const r = m.evaluateFlag('flag1', { userId: 'u1' });
    assert.strictEqual(r.enabled, true);
});
test('215 evaluateFlag disabled', () => {
    m.createFlag('flag2', false);
    const r = m.evaluateFlag('flag2', {});
    assert.strictEqual(r.enabled, false); assert.strictEqual(r.reason, 'disabled');
});
test('215 evaluateFlag percentage', () => {
    m.createFlag('flag3', true, { percentage: 50 });
    const r = m.evaluateFlag('flag3', { userId: 'user123' });
    assert('enabled' in r); assert.strictEqual(r.reason, 'percentage-rollout');
});

// --- 216: A/B testing framework ---
test('216 createExperiment', () => {
    m.createExperiment('expAB', [{ name: 'control', weight: 50 }, { name: 'treatment', weight: 50 }]);
    const v = m.assignVariant('expAB', 'user1');
    assert(['control', 'treatment'].includes(v));
});
test('216 recordConversion', () => {
    const r = m.recordConversion('expAB', 'user1', 10);
    assert(r !== null); assert.strictEqual(r.value, 10);
});

// --- 217: Gradual rollouts ---
test('217 createRollout', () => {
    m.createRollout('roll1', [{ percentage: 10 }, { percentage: 50 }, { percentage: 100 }]);
    const s = m.getRolloutStatus('roll1');
    assert.strictEqual(s.totalStages, 3); assert.strictEqual(s.percentage, 10);
});
test('217 advanceRollout', () => {
    const r = m.advanceRollout('roll1');
    assert.strictEqual(r.currentStage, 1); assert.strictEqual(r.percentage, 50);
});

// --- 218: Rollback mechanisms ---
test('218 createRollbackPoint', () => {
    m.createRollbackPoint('rb1', { version: 'v1' });
    const list = m.listRollbackPoints();
    assert.strictEqual(list.length, 1); assert.strictEqual(list[0].name, 'rb1');
});
test('218 executeRollback', () => {
    const r = m.executeRollback('rb1');
    assert.strictEqual(r.status, 'rolled-back'); assert.deepStrictEqual(r.snapshot, { version: 'v1' });
});

// --- 219: Blue-green deployment ---
test('219 createBlueGreenDeployment', () => {
    m.createBlueGreenDeployment('bg1', { blueVersion: 'v1', greenVersion: 'v2' });
    const s = m.getBlueGreenStatus('bg1');
    assert.strictEqual(s.current, 'blue'); assert.strictEqual(s.blue.status, 'active');
});
test('219 switchBlueGreen', () => {
    const r = m.switchBlueGreen('bg1');
    assert.strictEqual(r.current, 'green'); assert.strictEqual(r.active.status, 'active');
});

// --- 220: Canary analysis ---
test('220 analyzeCanary healthy', () => {
    m.createCanaryDeployment('canary3', { baselineMetrics: { latency: 100, errorRate: 1 } });
    const r = m.analyzeCanary('canary3', { latency: 95, errorRate: 0.9 });
    assert.strictEqual(r.verdict, 'healthy'); assert.strictEqual(r.regressions, 0);
});
test('220 analyzeCanary critical', () => {
    m.createCanaryDeployment('canary4', { baselineMetrics: { latency: 100, errorRate: 1, throughput: 1000 } });
    const r = m.analyzeCanary('canary4', { latency: 200, errorRate: 5, throughput: 500 });
    assert.strictEqual(r.verdict, 'critical'); assert(r.regressions >= 2);
});

console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`);
process.exit(failed > 0 ? 1 : 0);
});

// --- 214: Canary deployments ---
test('214 createCanaryDeployment', () => {
    m.createCanaryDeployment('canary1', { canaryPercentage: 10 });
    const d = m.getDeployments();
    assert.strictEqual(d[0].name, 'canary1'); assert.strictEqual(d[0].canaryPercentage, 10);
});
test('214 promoteCanary', () => {
    const r = m.promoteCanary('canary1');
    assert.strictEqual(r.status, 'promoted'); assert.strictEqual(r.canaryPercentage, 100);
});
test('214 rollbackCanary', () => {
    m.createCanaryDeployment('canary2', {});
    const r = m.rollbackCanary('canary2');
    assert.strictEqual(r.status, 'rolled-back'); assert.strictEqual(r.canaryPercentage, 0);
});
    const r = m.compareSnapshot('snap1', 'world');
    assert.strictEqual(r.match, false); assert(r.diff > 0);
});

// --- 205: Performance benchmarks ---
test('205 benchmark', () => {
    const r = m.benchmark('bench1', () => { let s = 0; for (let i = 0; i < 100; i++) s += i; }, 50);
    assert.strictEqual(r.iterations, 50); assert(r.mean >= 0); assert(r.median >= 0);
    assert(r.p95 >= r.median); assert(r.max >= r.min);
});
test('205 compareBenchmarks', () => {
    m.benchmark('benchA', () => {}, 10);
    m.benchmark('benchB', () => {}, 10);
    const c = m.compareBenchmarks('benchA', 'benchB');
    assert(c !== null); assert('percentChange' in c);
});

// --- 206: Memory leak detection ---
test('206 trackMemory & checkLeak', () => {
    const obj = { x: 1 };
    const t = m.trackMemory('mem1', obj);
    const r = m.checkLeak(t);
    assert.strictEqual(r.alive, true); assert.strictEqual(r.label, 'mem1');
});
test('206 detectLeakGrowth', () => {
    const r = m.detectLeakGrowth([1, 2, 3, 4, 5, 6, 7, 8]);
    assert.strictEqual(r.growing, true); assert(r.ratio > 0.7);
});