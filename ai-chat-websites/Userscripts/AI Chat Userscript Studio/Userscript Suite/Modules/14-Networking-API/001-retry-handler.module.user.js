// ==UserScript==
// @name         Retry Handler with Exponential Backoff
// @namespace    AI-Chat-Userscript-Studio
// @version      1.2.0
// @description  Implements retry logic with exponential backoff for network requests
// @match        *://*/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

/**
 * AI Chat Userscript Studio - Retry Handler Module
 *
 * Provides retry logic with exponential backoff for handling network failures.
 * Features:
 * - Configurable retry attempts and delays
 * - Exponential backoff with maximum total time
 * - Automatic logging and error handling
 */

(function() {
    'use strict';

    const MODULE_ID = '15-retry-handler';
    const MODULE_NAME = 'Retry Handler';
    const MODULE_VERSION = '1.2.0';

    class RetryHandler {
        constructor() {
            this.dependencies = [];
            this.critical = false;
            this.config = {
                enabled: true,
                maxRetries: 5,
                baseDelay: 1000,
                maxTotalTime: 120000,
                backoffFactor: 2,
                retryOnNetworkError: true,
                retryOn5xx: true,
                retryOn429: true
            };
            this.state = {
                initialized: false,
                totalRetries: 0,
                totalFailures: 0
            };
        }

        async init() {
            try {
                console.log(`[${MODULE_ID}] Initializing ${MODULE_NAME} v${MODULE_VERSION}`);
                this.loadConfig();
                this.exposeAPI();
                this.state.initialized = true;
                console.log(`[${MODULE_ID}] Initialization complete`);
                return true;
            } catch (error) {
                console.error(`[${MODULE_ID}] Initialization failed:`, error);
                return false;
            }
        }

        checkDependencies() { return true; }

        loadConfig() {
            try {
                const stored = localStorage.getItem(`${MODULE_ID}-config`);
                if (stored) {
                    const parsed = JSON.parse(stored);
                    this.config = { ...this.config, ...parsed };
                }
            } catch (error) {
                console.warn(`[${MODULE_ID}] Failed to load config:`, error);
            }
        }

        saveConfig() {
            try { localStorage.setItem(`${MODULE_ID}-config`, JSON.stringify(this.config)); }
            catch (error) { console.warn(`[${MODULE_ID}] Failed to save config:`, error); }
        }

        async withRetry(fn, maxRetries = this.config.maxRetries, baseDelay = this.config.baseDelay) {
            let lastError; let totalTime = 0; const startTime = Date.now();
            for (let attempt = 0; attempt <= maxRetries; attempt++) {
                try { return await fn(); }
                catch (error) {
                    lastError = error; totalTime = Date.now() - startTime;
                    if (attempt < maxRetries && totalTime < this.config.maxTotalTime) {
                        const delay = baseDelay * Math.pow(this.config.backoffFactor, attempt);
                        console.log(`[${MODULE_ID}] Retry attempt ${attempt + 1}/${maxRetries} after ${delay}ms`);
                        this.state.totalRetries++;
                        await new Promise(resolve => setTimeout(resolve, delay));
                    }
                }
            }
            this.state.totalFailures++;
            throw lastError;
        }

        exposeAPI() {
            window[`${MODULE_ID}_api`] = {
                getConfig: () => this.getConfig(),
                setConfig: (cfg) => this.setConfig(cfg),
                init: () => this.init(),
                destroy: () => this.destroy(),
                withRetry: (fn, retries, delay) => this.withRetry(fn, retries, delay)
            };
            window[`${MODULE_ID}_instance`] = this;
        }

        getConfig() { return { ...this.config }; }
        setConfig(newConfig) { this.config = { ...this.config, ...newConfig }; this.saveConfig(); }
        destroy() {
            delete window[`${MODULE_ID}_api`];
            delete window[`${MODULE_ID}_instance`];
            this.state.initialized = false;
        }
    }

    const instance = new RetryHandler();
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => instance.init());
    } else {
        instance.init();
    }
    window.addEventListener('beforeunload', () => instance.destroy());
})();