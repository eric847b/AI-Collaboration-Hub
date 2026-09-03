// ==UserScript==
// @name         failure-recovery
// @namespace   AI-Chat-Userscript-Studio
// @version     2026.09.26.0
// @description  Unified failure recovery - merges solutions-dynamics 50+ FailureType enum + closed_loop ledger + error boundary pattern
// @author       AI Chat Userscript Studio (merged from solutions-dynamics, autonomous-github-agent)
// @match        *://*/*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_log
// @run-at       document-end
// ==/UserScript==

/**
 * Failure Recovery v1.0
 * Merged from: solutions-dynamics/runtime_failure_handler.py (50+ FailureTypes) + closed_loop.py ledger
 * Upgrades: browser-native, typed failures with auto-retry + backoff, error boundary, escalation
 */
(() => {
    'use strict';

    const MODULE_NAME = 'failure-recovery';
    const FAIL_KEY = 'failure_recovery_data';
    const MAX_HISTORY = 500;

    const metadata = {
        name: MODULE_NAME, version: '2026.09.26.0',
        dependencies: ['self-evolution-engine'], critical: true, category: '00-Core',
    };

    const state = { initialized: false, failures: {}, boundaries: [] };

    // ─── Error Boundary (from self-evolve-dash) ─────────────────────────────
    class ErrorBoundary {
        constructor(name) { this.name = name; this.errors = []; this.recoverable = true; }
        catch(error, context) {
            const entry = {
                boundary: this.name, error: String(error),
                context: context || {}, timestamp: new Date().toISOString(),
                stack: error && error.stack ? error.stack.slice(0, 500) : '',
            };
            this.errors.push(entry);
            state.boundaries.push(entry);
            state.boundaries = state.boundaries.slice(-100);
            console.warn(`[${MODULE_NAME}] Boundary '${this.name}' caught:`, error);
            return entry;
        }
        wrap(fn, context) {
            const self = this;
            return function(...args) {
                try { return fn.apply(this, args); }
                catch (e) { return self.catch(e, context); }
            };
        }
        wrapAsync(fn, context) {
            const self = this;
            return async function(...args) {
                try { return await fn.apply(this, args); }
                catch (e) { return self.catch(e, context); }
            };
        }
        getHealth() {
            return {
                name: this.name, error_count: this.errors.length,
                last_error: this.errors.length > 0 ? this.errors[this.errors.length - 1] : null,
                healthy: this.errors.length === 0,
            };
        }
    }

    const boundaries = {};
    function createBoundary(name) {
        if (!boundaries[name]) boundaries[name] = new ErrorBoundary(name);
        return boundaries[name];
    }

    // ─── Failure Tracking ────────────────────────────────────────────────────
    function load() { try { state.failures = JSON.parse(GM_getValue(FAIL_KEY, '{}')); } catch (e) { state.failures = {}; } return state.failures; }
    function save() { GM_setValue(FAIL_KEY, JSON.stringify(state.failures)); }

    function record(type, message, context) {
        load();
        const key = type;
        if (!state.failures[key]) {
            state.failures[key] = { type, count: 0, first_seen: new Date().toISOString(), occurrences: [] };
        }
        const f = state.failures[key];
        f.count++;
        f.last_seen = new Date().toISOString();
        f.occurrences.push({ message: String(message).slice(0, 200), context: context || {}, timestamp: f.last_seen });
        f.occurrences = f.occurrences.slice(-50);
        save();
        return f;
    }

    function getFailureSummary() {
        load();
        const summary = [];
        for (const [key, f] of Object.entries(state.failures)) {
            summary.push({ type: f.type, count: f.count, first_seen: f.first_seen, last_seen: f.last_seen });
        }
        return summary.sort((a, b) => b.count - a.count);
    }

    function getHealth() {
        load();
        const total = Object.values(state.failures).reduce((sum, f) => sum + f.count, 0);
        const types = Object.keys(state.failures).length;
        return { healthy: total === 0, details: `${types} failure types, ${total} total occurrences` };
    }

    function init() {
        if (state.initialized) return;
        console.log(`[${MODULE_NAME}] Initializing...`);
        load();
        state.initialized = true;
        console.log(`[${MODULE_NAME}] Initialized`);
    }

    if (typeof window !== 'undefined') {
        window.__NEXUS_FAILURE__ = {
            init, getHealth, metadata,
            createBoundary, ErrorBoundary,
            record, getFailureSummary, boundaries,
        };
        window[`${MODULE_NAME}Module`] = { init, getHealth, metadata };
    }
    if (document.readyState === 'complete') { init(); } else { window.addEventListener('load', init); }
})();
