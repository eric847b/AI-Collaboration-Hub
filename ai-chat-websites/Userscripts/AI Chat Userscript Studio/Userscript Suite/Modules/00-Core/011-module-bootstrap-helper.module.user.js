// ==UserScript==
// @name         Module Bootstrap Helper
// @version      2026.07.04.0
// @description  ChatGPT - Shared bootstrap helper for module config loading and registration
// @author       AI RMD
// @match        https://chat.openai.com/*
// @match        https://chatgpt.com/*
// @match        https://claude.ai/*
// @match        https://poe.com/*
// @match        https://perplexity.ai/*
// @match        https://www.perplexity.ai/*
// @match        https://pi.ai/*
// @match        https://you.com/*
// @match        https://gemini.google.com/*
// @match        https://aistudio.google.com/*
// @match        https://copilot.microsoft.com/*
// @match        https://chat.mistral.ai/*
// @grant        none
// ==/UserScript==

/**
 * ModuleBootstrapHelper - Shared helper for module bootstrap/config ceremony.
 * Provides:
 *  - safe config merge from ConfigManager
 *  - optional module registration
 *  - optional memory/registry hooks
 */
(function () {
    'use strict';

    const ModuleBootstrapHelper = {
        name: 'ModuleBootstrapHelper',
        version: '2026.07.04.0',
        dependencies: [],
        critical: false,

        state: {
            initialized: false
        },

        init() {
            this.state.initialized = true;
            console.log('[ModuleBootstrapHelper] Initialized');
            return true;
        },

        /**
         * Load module config from Hub ConfigManager with fallback defaults.
         * @param {Object} defaults
         * @param {string} moduleKey
         * @returns {Object}
         */
        loadConfig(defaults = {}, moduleKey = null) {
            const hubConfig = window.ConfigManager;
            if (!hubConfig || typeof hubConfig.getConfig !== 'function') {
                return defaults;
            }
            const key = moduleKey || (this.state.currentModuleKey || 'default');
            try {
                const cfg = hubConfig.getConfig(key);
                if (cfg && typeof cfg === 'object') {
                    return { ...defaults, ...cfg };
                }
            } catch (e) {
                console.warn('[ModuleBootstrapHelper] Config load failed:', e);
            }
            return defaults;
        },

        /**
         * Register module with Hub ModuleRegistry when available.
         * @param {string} name
         * @param {string} version
         * @param {Object} moduleObject
         * @param {Array} dependencies
         */
        register(name, version, moduleObject, dependencies = []) {
            const hubRegistry = window.ModuleRegistry;
            if (!hubRegistry || typeof hubRegistry.register !== 'function') {
                return false;
            }
            try {
                hubRegistry.register(name, version, {
                    ...moduleObject,
                    dependencies: dependencies || moduleObject.dependencies || []
                });
                return true;
            } catch (e) {
                console.warn('[ModuleBootstrapHelper] Registration failed:', e);
                return false;
            }
        },

        /**
         * Apply config update to module state/config object.
         * @param {Object} target
         * @param {Object} settings
         */
        applyConfigUpdate(target = {}, settings = {}) {
            if (!settings || typeof settings !== 'object') return target;
            Object.assign(target, settings);
            return target;
        },

        /**
         * Start a simple cleanup timer backed by Hub Config when available.
         * @param {Function} cleanupFn
         * @param {Object} options
         * @param {string} options.moduleKey
         * @param {string} options.defaultIntervalMs
         * @returns {Function} stop timer
         */
        startCleanupTimer(cleanupFn, options = {}) {
            const moduleKey = options.moduleKey || 'default';
            const defaultIntervalMs = Number(options.defaultIntervalMs || 0);
            let intervalId = null;
            let intervalMs = defaultIntervalMs;

            function refreshInterval() {
                if (intervalId) clearInterval(intervalId);
                intervalId = null;
                const hubConfig = window.ConfigManager;
                if (hubConfig && typeof hubConfig.getConfig === 'function') {
                    try {
                        const cfg = hubConfig.getConfig(moduleKey);
                        const candidate = Number(cfg && cfg.cleanupIntervalMs || 0);
                        if (candidate > 0) intervalMs = candidate;
                    } catch (e) {
                        console.warn('[ModuleBootstrapHelper] Timer config read failed:', e);
                    }
                }
                if (intervalMs > 0) {
                    intervalId = setInterval(() => {
                        try { cleanupFn(); } catch (e) { console.warn('[ModuleBootstrapHelper] Cleanup failed:', e); }
                    }, intervalMs);
                }
            }

            refreshInterval();
            return function stop() {
                if (intervalId) clearInterval(intervalId);
                intervalId = null;
            };
        }
    };

    if (typeof window !== 'undefined') {
        window.ModuleBootstrapHelper = ModuleBootstrapHelper;
    }

    console.log('[ModuleBootstrapHelper] Bootstrap helper initialized v2026.07.04.0');
})();