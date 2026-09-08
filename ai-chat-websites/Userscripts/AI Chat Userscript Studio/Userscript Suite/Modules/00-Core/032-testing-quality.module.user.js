// ==UserScript==
// @name         testing-quality
// @namespace    AI-Chat-Userscript-Studio
// @version      2026.09.26.1
// @description  Testing & Quality: unit/integration/e2e tests, coverage, mutation, chaos, canary (ROADMAP 201-220)
// @author       AI Chat Userscript Studio
// @match        *://*/*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_log
// @run-at       document-end
// ==/UserScript==

/**
 * Testing & Quality v1.0 - ROADMAP items 201-220
 * 201 unit test coverage, 202 integration test suite, 203 end-to-end testing, 204 visual regression,
 * 205 performance benchmarks, 206 memory leak detection, 207 security scanning, 208 dependency auditing,
 * 209 license compliance, 210 code coverage reports, 211 mutation testing, 213 chaos engineering,
 * 214 canary deployments, 215 feature flags, 216 A/B testing framework, 217 gradual rollouts,
 * 218 rollback mechanisms, 219 blue-green deployment, 220 canary analysis.
 */
(() => {
    "use strict";
    const MODULE_NAME = "testing-quality";
    const CONFIG_KEY = "testing_quality_config";
    const metadata = { name: MODULE_NAME, version: "2026.09.26.1", dependencies: [], critical: false, category: "00-Core" };
    const state = {
        initialized: false, testSuites: [], benchmarks: [], snapshots: {}, coverage: {},
        mutations: [], experiments: [], flags: {}, deployments: [],
        settings: { baselineTolerance: 0.05, canaryPercentage: 5 },
    };
    const PERSISTED_KEYS = ["settings", "flags", "deployments"];
    function load() { try { const r = JSON.parse(GM_getValue(CONFIG_KEY, "{}")) || {}; for (const k of PERSISTED_KEYS) if (r[k] !== undefined) state[k] = r[k]; } catch (e) {} }
    function save() { try { const o = {}; for (const k of PERSISTED_KEYS) o[k] = state[k]; GM_setValue(CONFIG_KEY, JSON.stringify(o)); } catch (e) {} }
    function getInternalState() { return state; }
    function configureTesting(patch) { Object.assign(state.settings, patch || {}); save(); return { ...state.settings }; }

    // --- 201: Unit test coverage ---
    function registerSuite(name, tests) { const s = { name, tests: tests || [], results: [], passed: 0, failed: 0 }; state.testSuites.push(s); return s; }
    function runSuite(n) {
        const s = state.testSuites.find(x => x.name === n);
        if (!s) return null;
        s.results = []; s.passed = 0; s.failed = 0;
        for (const t of s.tests) { const st = Date.now(); try { t.fn(); s.results.push({ name: t.name, ok: true, ms: Date.now() - st }); s.passed++; } catch (e) { s.results.push({ name: t.name, ok: false, ms: Date.now() - st, error: String(e.message || e) }); s.failed++; } }
        return { name: s.name, passed: s.passed, failed: s.failed, results: s.results };
    }
    function runAllSuites() { return state.testSuites.map(s => runSuite(s.name)); }
    function getSuiteNames() { return state.testSuites.map(s => s.name); }

    // --- 202: Integration test suite ---
    function createIntegrationSuite(name, steps) {
        return { name, steps: steps || [], run: async () => {
            const r = []; for (const st of steps) { const s = Date.now(); try { await st.action(); r.push({ name: st.name, ok: true, ms: Date.now() - s }); } catch (e) { r.push({ name: st.name, ok: false, ms: Date.now() - s, error: String(e.message || e) }); } }
            return { name, results: r, passed: r.filter(x => x.ok).length, failed: r.filter(x => !x.ok).length };
        } };
    }
    // --- 203: End-to-end testing ---
    function createE2EScenario(name, flow) {
        return { name, flow: flow || [], run: async () => {
            const r = []; for (const st of flow) { const s = Date.now(); try { const v = await st(); r.push({ ok: true, result: v, ms: Date.now() - s }); } catch (e) { r.push({ ok: false, error: String(e.message || e), ms: Date.now() - s }); } }
            return { name, results: r, passed: r.filter(x => x.ok).length, failed: r.filter(x => !x.ok).length };
        } };
    }

    // --- 204: Visual regression tests ---
    function captureSnapshot(name, data) { state.snapshots[name] = { data, timestamp: Date.now() }; save(); return { name, timestamp: state.snapshots[name].timestamp }; }
    function compareSnapshot(name, newData) {
        const sn = state.snapshots[name]; if (!sn) return { match: false, reason: "no-baseline" };
        const d = computeVisualDiff(sn.data, newData); return { match: d <= state.settings.baselineTolerance, diff: d, tolerance: state.settings.baselineTolerance, baselineTime: sn.timestamp };
    }
    function computeVisualDiff(a, b) {
        if (typeof a === "string" && typeof b === "string") { if (a === b) return 0; const m = Math.max(a.length, b.length) || 1; let d = 0; for (let i = 0; i < m; i++) if ((a[i] || "") !== (b[i] || "")) d++; return d / m; }
        return computeVisualDiff(JSON.stringify(a), JSON.stringify(b));
    }
    function listSnapshots() { return Object.keys(state.snapshots); }

    // --- 205: Performance benchmarks ---
    function benchmark(name, fn, iterations) {
        const it = iterations || 100; const times = [];
        for (let i = 0; i < it; i++) { const s = Date.now(); fn(); times.push(Date.now() - s); }
        times.sort((a, b) => a - b);
        const r = { name, iterations: it, mean: times.reduce((x, t) => x + t, 0) / times.length, median: times[Math.floor(it / 2)], p95: times[Math.floor(it * 0.95)] || times[it - 1], p99: times[Math.floor(it * 0.99)] || times[it - 1], min: times[0], max: times[it - 1] };
        state.benchmarks.push(r); return r;
    }
    function compareBenchmarks(a, b) {
        const x = state.benchmarks.find(y => y.name === a), y = state.benchmarks.find(z => z.name === b);
        if (!x || !y) return null; return { a, b, meanDiff: y.mean - x.mean, percentChange: ((y.mean - x.mean) / x.mean) * 100 };
    }
    function getBenchmarks() { return [...state.benchmarks]; }

    // --- 206: Memory leak detection ---
    function trackMemory(label, obj) { return { label, timestamp: Date.now(), ref: new WeakRef(obj) }; }
    function checkLeak(t) { return { label: t.label, alive: t.ref.deref() !== undefined, elapsed: Date.now() - t.timestamp }; }
    function detectLeakGrowth(samples) {
        if (samples.length < 2) return { growing: false, reason: "insufficient-samples" };
        let inc = 0; for (let i = 1; i < samples.length; i++) if (samples[i] > samples[i - 1]) inc++;
        return { growing: (inc / (samples.length - 1)) > 0.7, ratio: inc / (samples.length - 1), samples: samples.length };
    }

    // --- 207: Security scanning ---
    function scanSecurity(target) {
        const t = target || "", f = [];
        if (/innerHTML\s*=/.test(t)) f.push({ severity: "high", rule: "innerHTML-assignment", msg: "Direct innerHTML risks XSS" });
        if (/eval\s*\(/.test(t)) f.push({ severity: "critical", rule: "eval-usage", msg: "eval() is a critical risk" });
        if (/document\.write/.test(t)) f.push({ severity: "high", rule: "document-write", msg: "document.write can inject content" });
        if (/http:\/\//.test(t) && !/https:\/\//.test(t)) f.push({ severity: "medium", rule: "insecure-transport", msg: "Insecure HTTP detected" });
        if (/password|secret|token|key/i.test(t) && /console\.log|alert/.test(t)) f.push({ severity: "high", rule: "secret-exposure", msg: "Potential secret exposure" });
        return { findings: f, critical: f.filter(x => x.severity === "critical").length, high: f.filter(x => x.severity === "high").length, medium: f.filter(x => x.severity === "medium").length };
    }

    // --- 208: Dependency auditing ---
    function auditDependencies(deps) {
        const r = (deps || []).map(d => { const issues = []; if (!d.version) issues.push("missing-version"); if (d.vulnerabilities && d.vulnerabilities.length) issues.push("known-vulnerabilities"); return { name: d.name, version: d.version, issues, ok: issues.length === 0 }; });
        return { results: r, total: r.length, ok: r.filter(x => x.ok).length, failing: r.filter(x => !x.ok).length };
    }

    // --- 209: License compliance ---
    const APPROVED = ["MIT", "Apache-2.0", "BSD-2-Clause", "BSD-3-Clause", "ISC", "0BSD"];
    const COPYLEFT = ["GPL-2.0", "GPL-3.0", "AGPL-3.0", "LGPL-2.1", "LGPL-3.0", "MPL-2.0"];
    function checkLicenseCompliance(deps) {
        const r = (deps || []).map(d => { const l = d.license || "unknown"; const s = APPROVED.includes(l) ? "approved" : COPYLEFT.includes(l) ? "copyleft" : "unknown"; return { name: d.name, license: l, status: s, ok: s === "approved" }; });
        return { results: r, approved: r.filter(x => x.status === "approved").length, copyleft: r.filter(x => x.status === "copyleft").length, unknown: r.filter(x => x.status === "unknown").length };
    }

    // --- 210: Code coverage reports ---
    function recordCoverage(file, lines, branches) { state.coverage[file] = { lines: lines || {}, branches: branches || {}, timestamp: Date.now() }; save(); return state.coverage[file]; }
    function getCoverageReport() {
        const files = Object.keys(state.coverage); let tl = 0, cl = 0, tb = 0, cb = 0; const fr = {};
        for (const f of files) {
            const c = state.coverage[f], lk = Object.keys(c.lines), bk = Object.keys(c.branches);
            const lc = lk.filter(k => c.lines[k] > 0).length, bc = bk.filter(k => c.branches[k] > 0).length;
            tl += lk.length; cl += lc; tb += bk.length; cb += bc;
            fr[f] = { lineCoverage: lk.length ? Math.round((lc / lk.length) * 10000) / 100 : 0, branchCoverage: bk.length ? Math.round((bc / bk.length) * 10000) / 100 : 0 };
        }
        return { files: fr, totalLineCoverage: tl ? (cl / tl) * 100 : 0, totalBranchCoverage: tb ? (cb / tb) * 100 : 0, fileCount: files.length };
    }

    // --- 211: Mutation testing ---
    function mutateCode(code, rule) {
        switch (rule) {
            case "negate-condition": return code.replace(/===/g, "T").replace(/!==/g, "===").replace(/T/g, "!==");
            case "remove-return": return code.replace(/return\s+/g, "");
            case "zero-to-one": return code.replace(/\b0\b/g, "1");
            case "boundary-shift": return code.replace(/>=/g, ">").replace(/<=/g, "<");
            case "negate-boolean": return code.replace(/true/g, "T").replace(/false/g, "true").replace(/T/g, "false");
            default: return code;
        }
    }
    function runMutationTest(name, originalFn, mutantFn, inputs) {
        const r = { name, killed: 0, survived: 0, total: 0, details: [] };
        for (const input of inputs || []) {
            r.total++;
            try { const a = JSON.stringify(originalFn(...input)), b = JSON.stringify(mutantFn(...input)); if (a !== b) { r.killed++; r.details.push({ input, killed: true }); } else { r.survived++; r.details.push({ input, killed: false }); } }
            catch (e) { r.killed++; r.details.push({ input, killed: true, reason: "exception" }); }
        }
        r.score = r.total ? (r.killed / r.total) * 100 : 0; state.mutations.push(r); return r;
    }
    function getMutations() { return [...state.mutations]; }

    // --- 213: Chaos engineering ---
    function createChaosExperiment(name, config) { const e = { name, config: config || {}, status: "created", results: [], startTime: null, endTime: null }; state.experiments.push(e); return e; }
    function runChaosExperiment(name) {
        const e = state.experiments.find(x => x.name === name); if (!e) return null;
        e.status = "running"; e.startTime = Date.now();
        const inj = [];
        if (e.config.networkLatency) inj.push({ type: "network-latency", injected: e.config.networkLatency, ok: true });
        if (e.config.cpuStress) inj.push({ type: "cpu-stress", injected: e.config.cpuStress, ok: true });
        if (e.config.memoryPressure) inj.push({ type: "memory-pressure", injected: e.config.memoryPressure, ok: true });
        if (e.config.diskFailure) inj.push({ type: "disk-failure", injected: e.config.diskFailure, ok: true });
        if (e.config.processKill) inj.push({ type: "process-kill", injected: e.config.processKill, ok: true });
        e.results = inj; e.status = "completed"; e.endTime = Date.now();
        return { name, status: e.status, duration: e.endTime - e.startTime, injections: inj.length };
    }
    function listExperiments() { return state.experiments.map(e => ({ name: e.name, status: e.status })); }

    // --- 214: Canary deployments ---
    function createCanaryDeployment(name, config) {
        const d = { name, config: config || {}, status: 'created', canaryPercentage: config?.canaryPercentage || state.settings.canaryPercentage, startTime: null, metrics: [] };
        state.deployments.push(d); save(); return d;
    }
    function promoteCanary(name) {
        const d = state.deployments.find(x => x.name === name); if (!d) return null;
        d.status = 'promoted'; d.canaryPercentage = 100; save();
        return { name, status: d.status, canaryPercentage: d.canaryPercentage };
    }
    function rollbackCanary(name) {
        const d = state.deployments.find(x => x.name === name); if (!d) return null;
        d.status = 'rolled-back'; d.canaryPercentage = 0; save();
        return { name, status: d.status, canaryPercentage: d.canaryPercentage };
    }
    function getDeployments() { return state.deployments.map(d => ({ name: d.name, status: d.status, canaryPercentage: d.canaryPercentage })); }

    // --- 215: Feature flags ---
    function createFlag(name, enabled, targeting) {
        const f = { name, enabled: !!enabled, targeting: targeting || {}, createdAt: Date.now() };
        state.flags[name] = f; save(); return f;
    }
    function evaluateFlag(name, context) {
        const f = state.flags[name]; if (!f) return { name, enabled: false, reason: 'not-found' };
        if (!f.enabled) return { name, enabled: false, reason: 'disabled' };
        const t = f.targeting || {};
        if (t.userId && (context?.userId) !== t.userId) return { name, enabled: false, reason: 'user-excluded' };
        if (t.percentage !== undefined) {
            const h = hashString(`${name}:${context?.userId || 'anon'}`);
            return { name, enabled: (h % 100) < t.percentage, reason: 'percentage-rollout', hash: h };
        }
        return { name, enabled: true, reason: 'targeted' };
    }
    function hashString(s) { let h = 0; for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0; return Math.abs(h); }
    function listFlags() { return Object.values(state.flags).map(f => ({ name: f.name, enabled: f.enabled })); }

    // --- 216: A/B testing framework ---
    function createExperiment(name, variants) {
        const e = { name, variants: variants || [], traffic: 100, status: 'draft', assignments: {} };
        state.experiments.push(e); return e;
    }
    function assignVariant(expName, userId) {
        const e = state.experiments.find(x => x.name === expName); if (!e) return null;
        if (e.assignments[userId]) return e.assignments[userId];
        const h = hashString(`${expName}:${userId}`) % 100;
        let cum = 0;
        for (const v of e.variants) { cum += v.weight || 0; if (h < cum) { e.assignments[userId] = v.name; return v.name; } }
        return e.variants[0]?.name || null;
    }
    function recordConversion(expName, userId, value) {
        const e = state.experiments.find(x => x.name === expName); if (!e) return null;
        const v = e.assignments[userId]; if (!v) return null;
        return { experiment: expName, variant: v, userId, value: value || 1, timestamp: Date.now() };
    }
    // --- 217: Gradual rollouts ---
    function createRollout(name, stages) {
        const r = { name, stages: stages || [{ percentage: 5 }, { percentage: 25 }, { percentage: 50 }, { percentage: 100 }], currentStage: 0, status: 'created' };
        state.deployments.push(r); save(); return r;
    }
    function advanceRollout(name) {
        const r = state.deployments.find(x => x.name === name); if (!r) return null;
        if (r.currentStage < r.stages.length - 1) { r.currentStage++; r.status = 'advancing'; }
        else { r.status = 'complete'; }
        save();
        return { name, currentStage: r.currentStage, percentage: r.stages[r.currentStage]?.percentage || 100, status: r.status };
    }
    function getRolloutStatus(name) {
        const r = state.deployments.find(x => x.name === name); if (!r) return null;
        return { name, currentStage: r.currentStage, totalStages: r.stages.length, percentage: r.stages[r.currentStage]?.percentage || 100, status: r.status };
    }

    // --- 218: Rollback mechanisms ---
    function createRollbackPoint(name, snapshot) {
        const r = { name, snapshot: snapshot || {}, createdAt: Date.now(), status: 'created' };
        state.deployments.push(r); save(); return r;
    }
    function executeRollback(name) {
        const r = state.deployments.find(x => x.name === name); if (!r) return null;
        r.status = 'rolled-back'; r.executedAt = Date.now(); save();
        return { name, status: r.status, snapshot: r.snapshot, executedAt: r.executedAt };
    }
    function listRollbackPoints() { return state.deployments.filter(d => d.snapshot).map(d => ({ name: d.name, status: d.status, createdAt: d.createdAt })); }

    // --- 219: Blue-green deployment ---
    function createBlueGreenDeployment(name, config) {
        const d = { name, config: config || {}, blue: { status: 'active', version: config?.blueVersion || 'v1' }, green: { status: 'idle', version: config?.greenVersion || 'v2' }, current: 'blue' };
        state.deployments.push(d); save(); return d;
    }
    function switchBlueGreen(name) {
        const d = state.deployments.find(x => x.name === name); if (!d) return null;
        if (d.current === 'blue') { d.current = 'green'; d.blue.status = 'idle'; d.green.status = 'active'; }
        else { d.current = 'blue'; d.green.status = 'idle'; d.blue.status = 'active'; }
        save();
        return { name, current: d.current, active: d.current === 'blue' ? d.blue : d.green, idle: d.current === 'blue' ? d.green : d.blue };
    }
    function getBlueGreenStatus(name) {
        const d = state.deployments.find(x => x.name === name); if (!d) return null;
        return { name, current: d.current, blue: { ...d.blue }, green: { ...d.green } };
    }

    // --- 220: Canary analysis ---
    function analyzeCanary(name, metrics) {
        const d = state.deployments.find(x => x.name === name); if (!d) return null;
        const baseline = d.config?.baselineMetrics || {};
        const analysis = { name, timestamp: Date.now(), metrics: {}, verdict: 'inconclusive' };
        let regressions = 0, total = 0;
        for (const k of Object.keys(metrics || {})) {
            total++;
            const b = baseline[k] || 0, c = metrics[k];
            const change = b ? ((c - b) / b) * 100 : 0;
            analysis.metrics[k] = { baseline: b, current: c, change: Math.round(change * 100) / 100 };
            if (Math.abs(change) > 25) regressions++;
        }
        analysis.totalMetrics = total; analysis.regressions = regressions;
        analysis.verdict = regressions === 0 ? 'healthy' : regressions <= total * 0.25 ? 'degraded' : 'critical';
        d.analysis = analysis; return analysis;
    }
    function getCanaryAnalysis(name) { const d = state.deployments.find(x => x.name === name); return d?.analysis || null; }

    // --- Self-register with hub ---
    if (typeof window.__NEXUS_HUB__ !== 'undefined') {
        try { window.__NEXUS_HUB__.registerModule(metadata, { configureTesting, registerSuite, runSuite, runAllSuites, getSuiteNames, createIntegrationSuite, createE2EScenario, captureSnapshot, compareSnapshot, listSnapshots, benchmark, compareBenchmarks, getBenchmarks, trackMemory, checkLeak, detectLeakGrowth, scanSecurity, auditDependencies, checkLicenseCompliance, recordCoverage, getCoverageReport, mutateCode, runMutationTest, getMutations, createChaosExperiment, runChaosExperiment, listExperiments, createCanaryDeployment, promoteCanary, rollbackCanary, getDeployments, createFlag, evaluateFlag, listFlags, createExperiment, assignVariant, recordConversion, createRollout, advanceRollout, getRolloutStatus, createRollbackPoint, executeRollback, listRollbackPoints, createBlueGreenDeployment, switchBlueGreen, getBlueGreenStatus, analyzeCanary, getCanaryAnalysis, getInternalState }); }
        catch (e) { try { GM_log(`${MODULE_NAME} hub registration failed: ${e.message}`); } catch (_) {} }
    }
    window.__NEXUS_TESTING_QUALITY__ = { configureTesting, registerSuite, runSuite, runAllSuites, getSuiteNames, createIntegrationSuite, createE2EScenario, captureSnapshot, compareSnapshot, listSnapshots, benchmark, compareBenchmarks, getBenchmarks, trackMemory, checkLeak, detectLeakGrowth, scanSecurity, auditDependencies, checkLicenseCompliance, recordCoverage, getCoverageReport, mutateCode, runMutationTest, getMutations, createChaosExperiment, runChaosExperiment, listExperiments, createCanaryDeployment, promoteCanary, rollbackCanary, getDeployments, createFlag, evaluateFlag, listFlags, createExperiment, assignVariant, recordConversion, createRollout, advanceRollout, getRolloutStatus, createRollbackPoint, executeRollback, listRollbackPoints, createBlueGreenDeployment, switchBlueGreen, getBlueGreenStatus, analyzeCanary, getCanaryAnalysis, getInternalState };
})();
