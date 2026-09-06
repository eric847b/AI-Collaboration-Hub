// ==UserScript==
// @name         feature-flags
// @namespace   AI-Chat-Userscript-Studio
// @version     2026.09.26.1
// @description  Feature flags + A/B testing framework (ROADMAP 215-216)
// @author       AI Chat Userscript Studio
// @match        *://*/*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_log
// @run-at       document-end
// ==/UserScript==

/**
 * Feature Flags + A/B Testing v1.0
 * ROADMAP 215 (Feature flags), 216 (A/B testing framework)
 */
(() => {
    'use strict';
    const MODULE_NAME = 'feature-flags';
    const FLAGS_KEY = 'feature_flags_state';
    const metadata = { name: MODULE_NAME, version: '2026.09.26.1', dependencies: [], critical: false, category: '00-Core' };
    const state = { initialized: false, flags: {}, experiments: {} };

    function load() {
        try { const raw = GM_getValue(FLAGS_KEY, '{}'); const parsed = JSON.parse(raw); state.flags = parsed.flags || {}; state.experiments = parsed.experiments || {}; }
        catch (e) { state.flags = {}; state.experiments = {}; }
    }
    function save() { try { GM_setValue(FLAGS_KEY, JSON.stringify({ flags: state.flags, experiments: state.experiments })); } catch (e) { /* ignore */ } }

    // ─── Feature Flags (215) ───────────────────────────────────────────────────
    function defineFlag(name, defaultValue, description) {
        if (state.flags[name] === undefined) {
            state.flags[name] = { value: defaultValue, description: description || '', defined_at: new Date().toISOString() };
            save();
        }
        return state.flags[name].value;
    }

    function isEnabled(name) {
        const flag = state.flags[name];
        return flag ? !!flag.value : false;
    }

    function enable(name) {
        if (state.flags[name]) { state.flags[name].value = true; state.flags[name].updated_at = new Date().toISOString(); save(); return true; }
        return false;
    }

    function disable(name) {
        if (state.flags[name]) { state.flags[name].value = false; state.flags[name].updated_at = new Date().toISOString(); save(); return true; }
        return false;
    }

    function toggle(name) {
        if (state.flags[name]) { state.flags[name].value = !state.flags[name].value; state.flags[name].updated_at = new Date().toISOString(); save(); return state.flags[name].value; }
        return false;
    }

    function getFlag(name) { return state.flags[name] || null; }
    function listFlags() { return { ...state.flags }; }

    // ─── A/B Testing (216) ─────────────────────────────────────────────────────
    function defineExperiment(name, variants, trafficPercent) {
        if (!Array.isArray(variants) || variants.length < 2) return null;
        const exp = state.experiments[name] || { name, variants, traffic: trafficPercent || 100, defined_at: new Date().toISOString(), assignments: {} };
        state.experiments[name] = exp;
        save();
        return exp;
    }

    function getVariant(experimentName, userId) {
        const exp = state.experiments[experimentName];
        if (!exp) return null;
        if (exp.assignments[userId]) return exp.assignments[userId];
        const assigned = Math.random() * 100 < exp.traffic;
        if (!assigned) return 'control';
        const variant = exp.variants[Math.floor(Math.random() * exp.variants.length)];
        exp.assignments[userId] = variant;
        save();
        return variant;
    }

    function getExperiment(name) { return state.experiments[name] || null; }
    function listExperiments() { return { ...state.experiments }; }

    function init() {
        if (state.initialized) return;
        load();
        state.initialized = true;
        console.log(`[${MODULE_NAME}] Initialized - ${Object.keys(state.flags).length} flags, ${Object.keys(state.experiments).length} experiments`);
    }

    function getHealth() {
        return { healthy: state.initialized, details: `${Object.keys(state.flags).length} flags, ${Object.keys(state.experiments).length} experiments` };
    }

    if (typeof window !== 'undefined') {
        window.__NEXUS_FEATURES__ = { init, getHealth, metadata, defineFlag, isEnabled, enable, disable, toggle, getFlag, listFlags, defineExperiment, getVariant, getExperiment, listExperiments };
        window[`${MODULE_NAME}Module`] = { init, getHealth, metadata };
    }
    if (document.readyState === 'complete') { init(); } else { window.addEventListener('load', init); }
})();
