// ==UserScript==
// @name         self-evolution-engine
// @namespace   AI-Chat-Userscript-Studio
// @version     2026.09.26.0
// @description  Self-evolution engine - merges nexus-core improve(), closed_loop fix ledger, solutions-dynamics FailureType recovery. Self-audit, fix tracking, escalation.
// @author       AI Chat Userscript Studio (merged from nexus-core, autonomous-github-agent, solutions-dynamics)
// @match        *://*/*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_deleteValue
// @grant        GM_log
// @grant        GM_addStyle
// @run-at       document-end
// ==/UserScript==

/**
 * Self-Evolution Engine v1.0
 * Merged from: nexus-core/orchestrator.py improve() + closed_loop.py + runtime_failure_handler.py
 * Upgrades: browser-native ledger, typed failures with auto-recovery, fix verification, escalation
 */
(() => {
    'use strict';

    const MODULE_NAME = 'self-evolution-engine';
    const LEDGER_KEY = 'evolution_ledger';
    const FAILURE_KEY = 'evolution_failures';
    const MAX_LEDGER = 200;

    const metadata = {
        name: MODULE_NAME,
        version: '2026.09.26.0',
        dependencies: ['hub-orchestrator'],
        critical: true,
        category: '00-Core',
    };

    const state = { initialized: false, ledger: [], failures: {} };

    // ─── Failure Types (from solutions-dynamics/runtime_failure_handler.py) ──
    const FailureTypes = {
        // Network
        CONNECTION_TIMEOUT: { category: 'network', retryable: true, maxRetries: 3, backoff: 2000 },
        DNS_FAILURE: { category: 'network', retryable: true, maxRetries: 2, backoff: 5000 },
        SSL_ERROR: { category: 'network', retryable: false },
        RATE_LIMITED: { category: 'network', retryable: true, maxRetries: 5, backoff: 10000 },
        NETWORK_UNREACHABLE: { category: 'network', retryable: true, maxRetries: 3, backoff: 5000 },
        // Resource
        OUT_OF_MEMORY: { category: 'resource', retryable: true, maxRetries: 1, backoff: 1000 },
        DISK_SPACE: { category: 'resource', retryable: false },
        FILE_NOT_FOUND: { category: 'resource', retryable: false },
        PERMISSION_DENIED: { category: 'resource', retryable: false },
        RESOURCE_LOCKED: { category: 'resource', retryable: true, maxRetries: 3, backoff: 2000 },
        // Dependency
        MISSING_MODULE: { category: 'dependency', retryable: false },
        VERSION_MISMATCH: { category: 'dependency', retryable: false },
        IMPORT_ERROR: { category: 'dependency', retryable: false },
        CONFIG_MISSING: { category: 'dependency', retryable: true, maxRetries: 1, backoff: 0 },
        ENV_VAR_MISSING: { category: 'dependency', retryable: false },
        // API
        API_TIMEOUT: { category: 'api', retryable: true, maxRetries: 3, backoff: 3000 },
        AUTH_FAILURE: { category: 'api', retryable: true, maxRetries: 1, backoff: 0 },
        INVALID_RESPONSE: { category: 'api', retryable: true, maxRetries: 2, backoff: 1000 },
        QUOTA_EXCEEDED: { category: 'api', retryable: true, maxRetries: 1, backoff: 60000 },
        SERVICE_UNAVAILABLE: { category: 'api', retryable: true, maxRetries: 5, backoff: 10000 },
        // Data
        JSON_PARSE_ERROR: { category: 'data', retryable: false },
        INVALID_FORMAT: { category: 'data', retryable: false },
        CORRUPT_DATA: { category: 'data', retryable: false },
        SCHEMA_MISMATCH: { category: 'data', retryable: true, maxRetries: 1, backoff: 0 },
        NULL_POINTER: { category: 'data', retryable: false },
        // Concurrency
        DEADLOCK: { category: 'concurrency', retryable: true, maxRetries: 2, backoff: 5000 },
        RACE_CONDITION: { category: 'concurrency', retryable: true, maxRetries: 3, backoff: 1000 },
        THREAD_TIMEOUT: { category: 'concurrency', retryable: true, maxRetries: 2, backoff: 3000 },
        LOCK_TIMEOUT: { category: 'concurrency', retryable: true, maxRetries: 3, backoff: 2000 },
        DATABASE_LOCK: { category: 'concurrency', retryable: true, maxRetries: 5, backoff: 5000 },
        // Syntax/Logic
        TYPE_ERROR: { category: 'syntax', retryable: false },
        INDEX_ERROR: { category: 'syntax', retryable: false },
        KEY_ERROR: { category: 'syntax', retryable: false },
        ATTRIBUTE_ERROR: { category: 'syntax', retryable: false },
        VALUE_ERROR: { category: 'syntax', retryable: false },
        // System
        PROCESS_KILLED: { category: 'system', retryable: false },
        SIGNAL_RECEIVED: { category: 'system', retryable: false },
        PATH_NOT_FOUND: { category: 'system', retryable: false },
        FILE_IN_USE: { category: 'system', retryable: true, maxRetries: 3, backoff: 2000 },
        MAX_ITERATIONS: { category: 'system', retryable: false },
        // Recovery
        RECOVERY_FAILED: { category: 'recovery', retryable: false },
        FALLBACK_EXHAUSTED: { category: 'recovery', retryable: false },
    };

    function getFailureConfig(type) {
        return FailureTypes[type] || { category: 'unknown', retryable: false };
    }


    function loadLedger() {
        try { state.ledger = JSON.parse(GM_getValue(LEDGER_KEY, '[]')); }
        catch (e) { state.ledger = []; }
        return state.ledger;
    }
    function saveLedger() {
        state.ledger = state.ledger.slice(-MAX_LEDGER);
        GM_setValue(LEDGER_KEY, JSON.stringify(state.ledger));
    }
    function loadFailures() {
        try { state.failures = JSON.parse(GM_getValue(FAILURE_KEY, '{}')); }
        catch (e) { state.failures = {}; }
        return state.failures;
    }
    function saveFailures() { GM_setValue(FAILURE_KEY, JSON.stringify(state.failures)); }

    function recordFix(problemType, title, details) {
        loadLedger();
        state.ledger.push({
            problem_type: problemType, title: String(title).slice(0, 200),
            details: details || '', recorded_at: new Date().toISOString(),
            status: 'pending_verify', reappear_count: 0,
        });
        saveLedger();
        return state.ledger[state.ledger.length - 1];
    }
    function markVerified(problemType) {
        loadLedger();
        let n = 0;
        for (const entry of state.ledger) {
            if (entry.problem_type === problemType && entry.status === 'pending_verify') {
                entry.status = 'verified'; entry.verified_at = new Date().toISOString(); n++;
            }
        }
        if (n) saveLedger();
        return n;
    }

    function recordFailure(type, context) {
        loadFailures();
        const config = getFailureConfig(type);
        const key = type + '_' + (context || 'default');
        if (!state.failures[key]) {
            state.failures[key] = {
                type, category: config.category, count: 0,
                first_seen: new Date().toISOString(), retries: [],
            };
        }
        const failure = state.failures[key];
        failure.count++;
        failure.last_seen = new Date().toISOString();
        saveFailures();
        return { failure, config, shouldRetry: shouldRetryFailure(failure, config) };
    }
    function shouldRetryFailure(failure, config) {
        if (!config.retryable) return false;
        return failure.retries.length < config.maxRetries;
    }
    function getBackoffDelay(failure, config) {
        if (!config.backoff) return 0;
        return config.backoff * Math.pow(2, failure.retries.length);
    }
    function attemptRecovery(type, context, recoveryFn) {
        const { failure, config, shouldRetry } = recordFailure(type, context);
        if (!shouldRetry) return Promise.resolve({ recovered: false, reason: 'max_retries' });
        const delay = getBackoffDelay(failure, config);
        failure.retries.push({ attempted_at: new Date().toISOString(), delay_ms: delay });
        saveFailures();
        return new Promise(resolve => {
            setTimeout(async () => {
                try {
                    const result = await recoveryFn();
                    failure.retries[failure.retries.length - 1].success = true;
                    saveFailures();
                    resolve({ recovered: true, result });
                } catch (e) {
                    failure.retries[failure.retries.length - 1].error = String(e);
                    saveFailures();
                    resolve({ recovered: false, error: e });
                }
            }, delay);
        });
    }
    function runAudit() {
        loadLedger();
        loadFailures();
        const issues = [];
        const verified = state.ledger.filter(e => e.status === 'verified').length;
        const pending = state.ledger.filter(e => e.status === 'pending_verify').length;
        const reappeared = state.ledger.filter(e => e.status === 'reappeared').length;
        const activeFailures = Object.values(state.failures).filter(f => f.count > 0);
        const criticalFailures = activeFailures.filter(f => !getFailureConfig(f.type).retryable);
        if (reappeared > 0) issues.push(`[ESCALATED] ${reappeared} problems reappeared after fix`);
        if (criticalFailures.length) issues.push(`[CRITICAL] ${criticalFailures.length} unrecoverable failures`);
        if (pending > 5) issues.push(`[BACKLOG] ${pending} fixes pending verification`);
        return {
            issues, healthy: issues.length === 0,
            ledger: { total: state.ledger.length, verified, pending, reappeared },
            failures: { total: activeFailures.length, critical: criticalFailures.length },
        };
    }

    function init() {
        if (state.initialized) return;
        console.log(`[${MODULE_NAME}] Initializing...`);
        loadLedger();
        loadFailures();
        state.initialized = true;
        console.log(`[${MODULE_NAME}] Initialized`);
    }
    function getHealth() {
        const audit = runAudit();
        return {
            healthy: audit.healthy,
            details: `${audit.ledger.verified} fixes verified, ${audit.failures.total} failure types tracked`,
            audit,
        };
    }

    if (typeof window !== 'undefined') {
        window.__NEXUS_EVOLUTION__ = {
            init, getHealth, metadata, FailureTypes,
            recordFix, markVerified, noteReappearance,
            recordFailure, attemptRecovery, getFailureConfig, runAudit,
        };
        window[`${MODULE_NAME}Module`] = { init, getHealth, metadata };
    }
    if (document.readyState === 'complete') { init(); } else { window.addEventListener('load', init); }
})();
