// ==UserScript==
// @name         analytics-engine
// @namespace    AI-Chat-Userscript-Studio
// @version      2026.09.26.1
// @description  Data & analytics engine: heatmaps, funnels, experiments, bandits, Q-learning (ROADMAP 262-280)
// @author       AI Chat Userscript Studio
// @match        *://*/*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_log
// @run-at       document-end
// ==/UserScript==

/**
 * Analytics Engine v1.0 - ROADMAP items 262-280 (Data & Analytics)
 * 262 heatmaps, 263 session replay, 264 recordings, 265 conversions, 266 funnels,
 * 267 cohorts, 268 retention, 269 churn, 270 LTV, 271 attribution, 272 ROI,
 * 273 A/B tests, 274 significance, 275 confidence intervals, 276 hypothesis tests,
 * 277 Bayesian inference, 278 multi-armed bandit, 279 Q-learning, 280 causal effect.
 */
(() => {
    "use strict";
    const MODULE_NAME = "analytics-engine";
    const CONFIG_KEY = "analytics_engine_config";
    const MAX_REPLAY_EVENTS = 2000;
    const DAY_MS = 86400000;
    const metadata = {
        name: MODULE_NAME,
        version: "2026.09.26.1",
        dependencies: [],
        critical: false,
        category: "00-Core",
    };
    const state = {
        initialized: false,
        heatmap: {}, // 262 "gx,gy" -> count
        replay: [], // 263 volatile ring buffer of {t, type, data}
        recordings: {}, // 264 name -> {startedAt, stoppedAt, events}
        activeRecording: null,
        conversions: {}, // 265 goal -> {count, value}
        funnels: {}, // 266 name -> {steps, stepCounts, entered, completed}
        cohorts: {}, // 267 userId -> period
        activity: {}, // 268 userId -> {firstSeen, lastSeen, days, hits30}
        revenue: {}, // 270 userId -> total
        attributions: {}, // 271 source -> amount
        spend: {}, // 272 channel -> amount
        experiments: {}, // 273-276 name -> {variants: {label: {views, conversions}}}
        bandits: {}, // 278 name -> {arms: {label: {alpha, beta}}}
        qtable: {}, // 279 "state|action" -> value
        settings: { ltvLifespanDays: 90, churnThresholdDays: 14, heatmapCell: 50 },
    };
    const PERSISTED_KEYS = [
        "heatmap",
        "recordings",
        "conversions",
        "funnels",
        "cohorts",
        "activity",
        "revenue",
        "attributions",
        "spend",
        "experiments",
        "bandits",
        "qtable",
        "settings",
    ];

    function load() {
        try {
            const raw = JSON.parse(GM_getValue(CONFIG_KEY, "{}")) || {};
            for (const key of PERSISTED_KEYS) if (raw[key] !== undefined) state[key] = raw[key];
        } catch (e) {
            /* corrupt storage -> start fresh */
        }
    }
    function save() {
        try {
            const out = {};
            for (const key of PERSISTED_KEYS) out[key] = state[key];
            GM_setValue(CONFIG_KEY, JSON.stringify(out));
        } catch (e) {
            /* storage unavailable -> keep in memory */
        }
    }
    function getInternalState() {
        return state;
    }
    function configureAnalytics(patch) {
        Object.assign(state.settings, patch || {});
        save();
        return { ...state.settings };
    }

    // --- statistics primitives (274-277) ---
    function erf(x) {
        const sign = x < 0 ? -1 : 1;
        const ax = Math.abs(x);
        const t = 1 / (1 + 0.3275911 * ax);
        const poly = ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t;
        return sign * (1 - poly * Math.exp(-ax * ax));
    }
    function normalCdf(z) {
        return 0.5 * (1 + erf(z / Math.SQRT2));
    }
    function twoProportionZ(x1, n1, x2, n2) {
        const p1 = n1 > 0 ? x1 / n1 : 0;
        const p2 = n2 > 0 ? x2 / n2 : 0;
        const pooled = (x1 + x2) / (n1 + n2 > 0 ? n1 + n2 : 1);
        const se = Math.sqrt(pooled * (1 - pooled) * (1 / (n1 > 0 ? n1 : 1) + 1 / (n2 > 0 ? n2 : 1)));
        const z = se > 0 ? (p1 - p2) / se : 0;
        return { z, p: 2 * (1 - normalCdf(Math.abs(z))), p1, p2 };
    }
    function waldInterval(x, n, zLevel) {
        const p = n > 0 ? x / n : 0;
        const z = zLevel || 1.96;
        const se = Math.sqrt((p * (1 - p)) / (n > 0 ? n : 1));
        return { point: p, lower: Math.max(0, p - z * se), upper: Math.min(1, p + z * se) };
    }
    function hypothesisTest(x1, n1, x2, n2, alpha) {
        const a = alpha || 0.05;
        const r = twoProportionZ(x1, n1, x2, n2);
        return { ...r, alpha: a, reject: r.p < a };
    }
    function betaPosterior(priorAlpha, priorBeta, successes, failures) {
        const a = priorAlpha + successes;
        const b = priorBeta + failures;
        return {
            alpha: a,
            beta: b,
            mean: a / (a + b),
            mode: a > 1 && b > 1 ? (a - 1) / (a + b - 2) : a / (a + b),
        };
    }
    function randNormal() {
        let u = 0;
        let v = 0;
        while (u === 0) u = Math.random();
        while (v === 0) v = Math.random();
        return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    }
    function randGamma(shape) {
        if (shape < 1) return randGamma(shape + 1) * Math.pow(Math.random(), 1 / shape);
        const d = shape - 1 / 3;
        const c = 1 / Math.sqrt(9 * d);
        for (;;) {
            const x = randNormal();
            let v = 1 + c * x;
            if (v <= 0) continue;
            v = v * v * v;
            const u = Math.random();
            if (u < 1 - 0.0331 * x * x * x * x) return d * v;
            if (Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v;
        }
    }
    function betaSample(a, b) {
        const x = randGamma(Math.max(a, 1e-6));
        const y = randGamma(Math.max(b, 1e-6));
        return x / (x + y || 1);
    }
    function diffInDiff(tBefore, tAfter, cBefore, cAfter) {
        return tAfter - tBefore - (cAfter - cBefore);
    }

    // --- 262 heatmaps ---
    function recordHeat(x, y) {
        const cell = state.settings.heatmapCell || 50;
        const key = Math.floor(x / cell) + "," + Math.floor(y / cell);
        state.heatmap[key] = (state.heatmap[key] || 0) + 1;
        save();
        return { key, count: state.heatmap[key] };
    }
    function getHeatmap() {
        const cells = Object.keys(state.heatmap).map((key) => {
            const parts = key.split(",");
            return { gx: Number(parts[0]), gy: Number(parts[1]), count: state.heatmap[key] };
        });
        let max = 0;
        let total = 0;
        for (const cellEntry of cells) {
            if (cellEntry.count > max) max = cellEntry.count;
            total += cellEntry.count;
        }
        return { cells, max, total };
    }

    // --- 263 session replay / 264 recordings ---
    function recordEvent(type, data) {
        const entry = { t: Date.now(), type, data: data === undefined ? null : data };
        state.replay.push(entry);
        if (state.replay.length > MAX_REPLAY_EVENTS) state.replay.shift();
        if (state.activeRecording) state.recordings[state.activeRecording].events.push(entry);
        return entry;
    }
    function getSessionReplay(sinceTs) {
        return state.replay.filter((entry) => !sinceTs || entry.t >= sinceTs).slice();
    }
    function startRecording(name) {
        if (state.activeRecording) stopRecording();
        state.recordings[name] = { startedAt: Date.now(), stoppedAt: null, events: [] };
        state.activeRecording = name;
        save();
        return name;
    }
    function stopRecording() {
        if (!state.activeRecording) return null;
        const rec = state.recordings[state.activeRecording];
        rec.stoppedAt = Date.now();
        const summary = {
            name: state.activeRecording,
            events: rec.events.length,
            durationMs: rec.stoppedAt - rec.startedAt,
        };
        state.activeRecording = null;
        save();
        return summary;
    }

    // --- 265 conversions ---
    function trackConversion(goal, value) {
        const slot = state.conversions[goal] || { count: 0, value: 0 };
        slot.count += 1;
        slot.value += typeof value === "number" ? value : 0;
        state.conversions[goal] = slot;
        save();
        return { ...slot };
    }

    // --- 266 funnels ---
    function defineFunnel(name, steps) {
        state.funnels[name] = {
            steps: steps.slice(),
            stepCounts: steps.map(() => 0),
            entered: 0,
            completed: 0,
        };
        save();
        return state.funnels[name];
    }
    function recordFunnelStep(name, stepIndex) {
        const f = state.funnels[name];
        if (!f || stepIndex < 0 || stepIndex >= f.steps.length) return null;
        f.stepCounts[stepIndex] += 1;
        if (stepIndex === 0) f.entered += 1;
        if (stepIndex === f.steps.length - 1) f.completed += 1;
        save();
        return f;
    }
    function analyzeFunnel(name) {
        const f = state.funnels[name];
        if (!f) return null;
        const base = f.entered || 1;
        const steps = f.steps.map((label, i) => ({
            label,
            count: f.stepCounts[i],
            rate: Math.round((f.stepCounts[i] / base) * 10000) / 10000,
            dropOff:
                i === 0 ? 0 : Math.round((1 - f.stepCounts[i] / (f.stepCounts[i - 1] || 1)) * 10000) / 10000,
        }));
        return {
            name,
            entered: f.entered,
            completed: f.completed,
            completionRate: Math.round((f.completed / base) * 10000) / 10000,
            steps,
        };
    }

    // --- 267 cohorts ---
    function assignCohort(userId, period) {
        const p = period || new Date(Date.now()).toISOString().slice(0, 7);
        state.cohorts[userId] = p;
        save();
        return p;
    }
    function getCohorts() {
        const groups = {};
        for (const [userId, period] of Object.entries(state.cohorts)) {
            (groups[period] = groups[period] || []).push(userId);
        }
        return groups;
    }

    // --- 268 retention / 269 churn ---
    function recordActivity(userId, ts) {
        const now = ts || Date.now();
        const a = state.activity[userId] || { firstSeen: now, lastSeen: now, days: {}, hits30: [] };
        a.lastSeen = Math.max(a.lastSeen, now);
        a.days[Math.floor((now - a.firstSeen) / DAY_MS)] = true;
        a.hits30.push(now);
        a.hits30 = a.hits30.filter((t) => now - t <= 30 * DAY_MS).slice(-200);
        state.activity[userId] = a;
        save();
        return a;
    }
    function getRetention() {
        const users = Object.entries(state.activity);
        const buckets = [1, 7, 30].map((offset) => {
            const eligible = users.filter(([, a]) => Math.floor((Date.now() - a.firstSeen) / DAY_MS) >= offset);
            const retained = eligible.filter(([, a]) => a.days[offset]).length;
            return {
                offset,
                eligible: eligible.length,
                retained,
                rate: eligible.length ? retained / eligible.length : null,
            };
        });
        return { users: users.length, buckets };
    }
    function predictChurn(userId) {
        const threshold = state.settings.churnThresholdDays || 14;
        const a = state.activity[userId];
        if (!a) return { userId, risk: 1, daysSinceLast: null, level: "unknown", reason: "no-activity" };
        const now = Date.now();
        const daysSinceLast = Math.floor((now - a.lastSeen) / DAY_MS);
        const recentHits = a.hits30.filter((t) => now - t <= 30 * DAY_MS).length;
        const inactivity = Math.min(1, daysSinceLast / threshold);
        const quiet = recentHits < 3 ? 0.3 : 0;
        const risk = Math.round(Math.min(1, inactivity * 0.7 + quiet) * 100) / 100;
        return { userId, risk, daysSinceLast, level: risk >= 0.6 ? "high" : risk >= 0.3 ? "medium" : "low" };
    }

    // --- 270 LTV / 271 attribution / 272 ROI ---
    function recordRevenue(userId, amount) {
        state.revenue[userId] = (state.revenue[userId] || 0) + amount;
        save();
        return state.revenue[userId];
    }
    function calculateLtv() {
        const payers = Object.keys(state.revenue).length;
        const total = Object.values(state.revenue).reduce((sum, v) => sum + v, 0);
        const arpu = payers ? total / payers : 0;
        const lifespanMonths = (state.settings.ltvLifespanDays || 90) / 30;
        return { payers, totalRevenue: total, arpu, lifespanMonths, ltv: arpu * lifespanMonths };
    }
    function attributeRevenue(amount, source) {
        state.attributions[source] = (state.attributions[source] || 0) + amount;
        save();
        return state.attributions[source];
    }
    function recordSpend(channel, amount) {
        state.spend[channel] = (state.spend[channel] || 0) + amount;
        save();
        return state.spend[channel];
    }
    function calculateRoi() {
        const rows = {};
        for (const channel of Object.keys(state.spend)) {
            const spend = state.spend[channel];
            const revenue = state.attributions[channel] || 0;
            rows[channel] = { spend, revenue, roi: spend > 0 ? (revenue - spend) / spend : null };
        }
        return rows;
    }

    // --- 273 A/B experiments / 274-276 statistics ---
    function createExperiment(name, variants) {
        const v = {};
        for (const label of variants) v[label] = { views: 0, conversions: 0 };
        state.experiments[name] = { variants: v, created: Date.now() };
        save();
        return state.experiments[name];
    }
    function recordExperimentView(name, variant) {
        const e = state.experiments[name];
        if (!e || !e.variants[variant]) return null;
        e.variants[variant].views += 1;
        save();
        return e.variants[variant];
    }
    function recordExperimentConversion(name, variant) {
        const e = state.experiments[name];
        if (!e || !e.variants[variant]) return null;
        e.variants[variant].conversions += 1;
        save();
        return e.variants[variant];
    }
    function getExperimentResults(name, alpha) {
        const e = state.experiments[name];
        if (!e) return null;
        const a = alpha || 0.05;
        const labels = Object.keys(e.variants);
        const rows = labels.map((label) => {
            const v = e.variants[label];
            return {
                label,
                views: v.views,
                conversions: v.conversions,
                rate: v.views ? v.conversions / v.views : 0,
                ci: waldInterval(v.conversions, v.views),
            };
        });
        const control = rows[0];
        const comparisons = rows.slice(1).map((row) => {
            const z = twoProportionZ(row.conversions, row.views, control.conversions, control.views);
            return { variant: row.label, vs: control.label, ...z, significant: z.p < a };
        });
        const winner = comparisons
            .filter((c) => c.significant && c.z > 0)
            .sort((x, y) => y.z - x.z)
            .map((c) => c.variant)[0];
        return { name, rows, comparisons, winner: winner || null, alpha: a };
    }

    // --- 278 multi-armed bandit (Thompson sampling) ---
    function createBandit(name, arms) {
        const a = {};
        for (const label of arms) a[label] = { alpha: 1, beta: 1 };
        state.bandits[name] = { arms: a };
        save();
        return state.bandits[name];
    }
    function recordReward(name, arm, success) {
        const post = state.bandits[name] && state.bandits[name].arms[arm];
        if (!post) return null;
        if (success) post.alpha += 1;
        else post.beta += 1;
        save();
        return { ...post };
    }
    function selectArm(name) {
        const b = state.bandits[name];
        if (!b) return null;
        let best = null;
        let bestSample = -1;
        for (const [arm, post] of Object.entries(b.arms)) {
            const sample = betaSample(post.alpha, post.beta);
            if (sample > bestSample) {
                bestSample = sample;
                best = arm;
            }
        }
        return best;
    }

    // --- 279 reinforcement learning (tabular Q-learning) ---
    function qUpdate(s, action, reward, nextState, learningRate, gamma) {
        const lr = learningRate || 0.1;
        const g = gamma || 0.9;
        let nextMax = 0;
        for (const key of Object.keys(state.qtable)) {
            if (key.indexOf(nextState + "|") === 0) nextMax = Math.max(nextMax, state.qtable[key]);
        }
        const key = s + "|" + action;
        const old = state.qtable[key] || 0;
        state.qtable[key] = old + lr * (reward + g * nextMax - old);
        save();
        return state.qtable[key];
    }
    function qBestAction(s) {
        let best = null;
        let bestValue = 0;
        for (const key of Object.keys(state.qtable)) {
            const sep = key.indexOf("|");
            if (key.slice(0, sep) !== s) continue;
            if (best === null || state.qtable[key] > bestValue) {
                best = key.slice(sep + 1);
                bestValue = state.qtable[key];
            }
        }
        return { action: best, value: best === null ? null : bestValue };
    }

    // --- 280 causal inference (difference-in-differences) ---
    function estimateCausalEffect(tBefore, tAfter, cBefore, cAfter) {
        return { effect: diffInDiff(tBefore, tAfter, cBefore, cAfter), parallelTrendAssumed: true };
    }

    function init() {
        if (state.initialized) return;
        load();
        state.initialized = true;
        console.log(`[${MODULE_NAME}] Initialized - ROADMAP 262-280 coverage active`);
    }
    function getHealth() {
        return {
            healthy: state.initialized,
            details:
                `${Object.keys(state.experiments).length} experiments, ` +
                `${Object.keys(state.bandits).length} bandits, ${state.replay.length} replay events`,
        };
    }
    if (typeof window !== "undefined") {
        window.__NEXUS_ANALYTICS__ = {
            init,
            getHealth,
            metadata,
            getInternalState,
            configureAnalytics,
            recordHeat,
            getHeatmap,
            recordEvent,
            getSessionReplay,
            startRecording,
            stopRecording,
            trackConversion,
            defineFunnel,
            recordFunnelStep,
            analyzeFunnel,
            assignCohort,
            getCohorts,
            recordActivity,
            getRetention,
            predictChurn,
            recordRevenue,
            calculateLtv,
            attributeRevenue,
            recordSpend,
            calculateRoi,
            createExperiment,
            recordExperimentView,
            recordExperimentConversion,
            getExperimentResults,
            twoProportionZ,
            waldInterval,
            hypothesisTest,
            betaPosterior,
            createBandit,
            recordReward,
            selectArm,
            qUpdate,
            qBestAction,
            estimateCausalEffect,
        };
        window[`${MODULE_NAME}Module`] = { init, getHealth, metadata };
    }
    if (typeof document !== "undefined" && document.readyState === "complete") {
        init();
    } else if (typeof window !== "undefined") {
        window.addEventListener("load", init);
    }





})();
