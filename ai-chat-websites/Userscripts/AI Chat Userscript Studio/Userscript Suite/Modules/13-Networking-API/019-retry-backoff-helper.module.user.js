// ==UserScript==
// @name         Retry Backoff Helper
// @namespace   AI-Chat-Userscript-Studio
// @version     1.0.0
// @description  Shared retry/backoff and degradation helper for resilient sends
// @match       *://*/*
// @grant       none
// @run-at      document-idle
// ==/UserScript==

/**
 * Shared helper for:
 * - exponential backoff retries
 * - adaptive degradation on repeated failure
 * - pause-aware execution via EventBus
 *
 * Other modules can reuse this instead of duplicating retry loops.
 */

(function() {
    'use strict';

    const MODULE_ID = '55-retry-backoff-helper';
    const MODULE_NAME = 'Retry Backoff Helper';

    const defaultOptions = () => ({
        maxRetries: 3,
        minRetries: 0,
        baseDelay: 1000,
        degradeMaxRetries: 0,
        degradeBaseDelay: 0,
        onRetry: null,
        ui: null,
        moduleName: 'unknown'
    });

    async function wait(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async function withPause(ui) {
        if (!ui || !ui.paused) return;
        await new Promise(resolve => {
            const onResume = (e) => {
                if (e && e.paused === false) {
                    window.EventBus && window.EventBus.off('promptSplitter:paused', handler);
                    resolve();
                }
            };
            const handler = onResume;
            window.EventBus && window.EventBus.on('promptSplitter:paused', handler);
        });
    }

    async function execute(fn, options) {
        const opts = { ...defaultOptions(), ...options };
        const activeMaxRetries = Math.max(opts.minRetries, opts.maxRetries);
        const activeBaseDelay = opts.baseDelay || opts.degradeBaseDelay;
        const maxAttempts = activeMaxRetries + 1;
        let attempt = 0;
        let lastError;

        while (++attempt <= maxAttempts) {
            await withPause(opts.ui);

            try {
                const result = await fn(attempt);
                return { success: true, result, attempt };
            } catch (error) {
                lastError = error;
                if (attempt >= maxAttempts) break;
                const delayMs = activeBaseDelay * Math.pow(2, attempt - 1);
                if (typeof opts.onRetry === 'function') opts.onRetry(attempt, activeMaxRetries, delayMs, error);
                if (opts.ui && typeof opts.ui.setRetryStatus === 'function') opts.ui.setRetryStatus(attempt, activeMaxRetries, delayMs);
                emitRetryMetric(opts.moduleName, { attempt, maxRetries: activeMaxRetries, delayMs, degraded: false });
                await wait(delayMs);
            }
        }

        const degradedMaxRetries = Math.max(opts.minRetries, Math.floor(activeMaxRetries / 2));
        const degradedDelay = activeBaseDelay ? Math.max(activeBaseDelay / 2, opts.degradeBaseDelay) : opts.degradeBaseDelay;
        const fallbackAttempts = degradedMaxRetries + 1;

        if (opts.ui && typeof opts.ui.statusLine === 'object') {
            opts.ui.statusLine.textContent = `Retrying with reduced retry budget`;
        }

        for (let fallbackAttempt = 1; fallbackAttempt <= fallbackAttempts; fallbackAttempt++) {
            await withPause(opts.ui);

            try {
                const result = await fn(fallbackAttempt, { degraded: true });
                return { success: true, result, attempt: fallbackAttempt, degraded: true };
            } catch (error) {
                lastError = error;
                if (fallbackAttempt >= fallbackAttempts) break;
                const delayMs = degradedDelay * Math.pow(2, fallbackAttempt - 1);
                if (typeof opts.onRetry === 'function') opts.onRetry(fallbackAttempt, degradedMaxRetries, delayMs, error);
                if (opts.ui && typeof opts.ui.setRetryStatus === 'function') opts.ui.setRetryStatus(fallbackAttempt, degradedMaxRetries, delayMs);
                emitRetryMetric(opts.moduleName, { attempt: fallbackAttempt, maxRetries: degradedMaxRetries, delayMs, degraded: true });
                await wait(delayMs);
            }
        }

        return { success: false, error: lastError };
    }

    async function emitRetryMetric(moduleName, detail) {
        try {
            const payload = { moduleName: moduleName || 'unknown', detail: detail || {}, timestamp: Date.now() };
            if (window.EventBus && typeof window.EventBus.emit === 'function') {
                window.EventBus.emit('resilience:metric', payload);
            }
            if (window.PerformanceMetrics && typeof window.PerformanceMetrics.increment === 'function') {
                window.PerformanceMetrics.increment('resilienceRetries');
            }
            try {
                const evt = new CustomEvent('HubResponse', { detail: { type: 'resilienceMetric', moduleName: payload.moduleName, detail: payload.detail, timestamp: payload.timestamp } });
                window.dispatchEvent(evt);
            } catch {}
        } catch {}
    }

    window.promptSplitterRetry = {
        execute,
        wait,
        withPause,
        defaultOptions,
        emitRetryMetric
    };

    console.log('[' + MODULE_ID + '] ' + MODULE_NAME + ' loaded');
})();
