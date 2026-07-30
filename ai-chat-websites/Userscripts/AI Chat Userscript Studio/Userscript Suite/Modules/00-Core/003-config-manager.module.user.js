// ==UserScript==
// @name         ConfigManager (Compatibility Layer)
// @version      2026.07.04.0
// @description  ChatGPT - Delegates to Hub's ConfigManager for backward compatibility
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
// @grant        GM_getValue
// @grant        GM_setValue
// ==/UserScript==

/**
 * ConfigManager Compatibility Layer
 * @deprecated This module now delegates to the Hub's built-in ConfigManager.
 * Core functionality is maintained in 00-hub.user.js to eliminate duplication.
 */
(function() {
    'use strict';

    const HYBRID_MODE = true;

    /**
     * Module-specific default configurations
     * @deprecated These are now centralized in the Hub's DEFAULT_CONFIG
     */
    const LEGACY_MODULE_DEFAULTS = {
        hub: { theme: 'system', debugMode: false, autoScroll: false, infinityMode: false },
        automation: { infinityModeActive: false, delayAfterApply: 2000, delayAfterSkip: 500, maxRetries: 3 },
        errorHandling: { maxRetries: 3, retryDelay: 1000, circuitBreaker: { threshold: 3, timeout: 60000 } },
        ui: { theme: 'light', enableKeyboardShortcuts: true, feedbackDuration: 3000 },
        promptSplitter: { maxCharsPerPart: 15000, minCharsPerPart: 1000, delayBetweenMessages: 1200 },
        codeShrinker: { autoShrink: false, shrinkLevel: 'minify' }
    };

    /**
     * Creates a thin compatibility wrapper that delegates to Hub's ConfigManager
     */
    function createCompatibilityLayer() {
        const hubConfig = window.ConfigManager;

        if (!hubConfig) {
            console.warn('[ConfigManager] Hub not available, running in standalone mode');
            return createStandaloneConfigManager();
        }

        console.log('[ConfigManager] Using Hub configuration (hybrid mode)');

        // Create delegation wrapper
        const wrapper = {
            config: hubConfig._config || {},

            init() {
                // Hub initializes itself; no-op in hybrid mode
                console.log('[ConfigManager] Hybrid mode: initialization delegated to Hub');
            },

            get(module, key) {
                if (module && typeof module === 'object') {
                    // Support key-value pattern being swapped
                    key = module;
                    module = 'hub';
                }
                if (key) {
                    // Try module-specific config first, then fall back to hub global
                    const moduleConfig = hubConfig.getConfig(module);
                    return moduleConfig[key] !== undefined ? moduleConfig[key] : hubConfig.get(key);
                }
                return hubConfig.getConfig(module);
            },

            getConfig(module) {
                return hubConfig.getConfig(module);
            },

            set(module, key, value) {
                if (module && typeof module === 'object') {
                    value = module;
                    module = 'hub';
                }
                hubConfig.updateConfig(module, { [key]: value });
            },

            save() {
                // Hub handles persistence automatically; no-op in hybrid mode
            },

            getDefaultConfig(module) {
                return LEGACY_MODULE_DEFAULTS[module] || {};
            },

            updateConfig(module, settings) {
                hubConfig.updateConfig(module, settings);
            },

            notifyModule(module, payload) {
                // Hub's ConfigManager already handles notifications via its _notify method
                // No additional work needed
            }
        };

        return wrapper;
    }

    /**
     * Fallback standalone config if Hub is not present
     */
    function createStandaloneConfigManager() {
        const DEFAULT_CONFIG = Object.freeze({
            prefix: 'chatgptHub',
            autoScroll: false,
            darkMode: false,
            autoPromptEnabled: true,
            autoPromptInterval: 300000,
            characterLimit: 4000,
            retryDelay: 1000,
            maxRetries: 3,
            debugMode: false,
            customPrompts: [],
            apiKey: '',
            temperature: 0.7,
            maxTokens: 16384,
            enableMarkdown: true,
            enableKeyboardShortcuts: true,
            theme: 'system',
            maxHistoryItems: 1000,
            retryBackoff: true,
            maxBackoffDelay: 30000,
            enableCache: true,
            cacheExpiration: 3600,
            maxCacheSize: 2000,
            privacyMode: true,
            maxConcurrentRequests: 32,
            requestTimeout: 120000,
            enablePerformanceMetrics: true,
            enableMemoryManagement: true,
            maxMemoryUsage: 8192,
            garbageCollectionInterval: 30000,
            enableExport: true,
            exportFormats: Object.freeze(['txt', 'md', 'json', 'html', 'pdf', 'csv', 'xml'])
        });

        const configManager = {
            config: {},
            moduleConfigs: new Map(),

            init() {
                try {
                    const stored = GM_getValue('chatgptHubConfig', '{}');
                    this.config = typeof stored === 'string' ? JSON.parse(stored) : stored || {};
                } catch (e) {
                    console.error('[ConfigManager] Config parse error:', e);
                    this.config = {};
                }
                this.ensureDefaults();
            },

            ensureDefaults() {
                this.config.hub = this.config.hub || { theme: 'system', debugMode: false };
                this.config.automation = this.config.automation || {
                    infinityMode: false, delayAfterApply: 2000, maxRetries: 3
                };
                this.config.errorHandling = this.config.errorHandling || {
                    maxRetries: 3, retryDelay: 1000, circuitBreaker: { threshold: 3, timeout: 60000 }
                };
                this.config.ui = this.config.ui || { theme: 'light' };
                this.save();
            },

            get(module, key) {
                const moduleConfig = this.config[module] || {};
                const defaultConfig = this.getDefaultConfig(module);

                if (key === undefined) {
                    return Object.assign({}, defaultConfig, moduleConfig);
                }

                return moduleConfig[key] !== undefined ? moduleConfig[key] : defaultConfig[key];
            },

            getConfig(module) {
                return Object.assign({}, this.getDefaultConfig(module), this.config[module] || {});
            },

            set(module, key, value) {
                this.config[module] = this.config[module] || {};
                let updatePayload;

                if (typeof key === 'object' && key !== null && value === undefined) {
                    updatePayload = Object.assign({}, key);
                    this.config[module] = Object.assign({}, this.config[module], key);
                } else {
                    this.config[module][key] = value;
                    updatePayload = { [key]: value };
                }

                this.save();
                this.notifyModule(module, updatePayload);
            },

            save() {
                try {
                    GM_setValue('chatgptHubConfig', JSON.stringify(this.config));
                } catch (e) {
                    console.error('[ConfigManager] Config save error:', e);
                }
            },

            getDefaultConfig(module) {
                const defaults = {
                    hub: { theme: 'system', debugMode: false, autoScroll: false, infinityMode: false },
                    automation: { infinityModeActive: false, delayAfterApply: 2000, delayAfterSkip: 500, maxRetries: 3 },
                    errorHandling: { maxRetries: 3, retryDelay: 1000, circuitBreaker: { threshold: 3, timeout: 60000 } },
                    ui: { theme: 'light', enableKeyboardShortcuts: true, feedbackDuration: 3000 },
                    promptSplitter: { maxCharsPerPart: 15000, minCharsPerPart: 1000, delayBetweenMessages: 1200 },
                    codeShrinker: { autoShrink: false, shrinkLevel: 'minify' }
                };
                return defaults[module] || {};
            },

            updateConfig(module, settings) {
                this.config[module] = { ...(this.config[module] || {}), ...settings };
                this.save();
                this.notifyModule(module, settings);
            },

            notifyModule(module, payload) {
                try {
                    const moduleInstance = window.ModuleRegistry?.get(module);
                    if (moduleInstance && typeof moduleInstance.onConfigUpdate === 'function') {
                        moduleInstance.onConfigUpdate(payload);
                    }
                } catch (e) {
                    console.error(`[ConfigManager] Error notifying module ${module}:`, e);
                }
            }
        };

        return configManager;
    }

    // Initialize compatibility layer
    const configManager = HYBRID_MODE ? createCompatibilityLayer() : createStandaloneConfigManager();

    // Export to global scope (only if Hub hasn't already set it)
    if (!window.ConfigManager) {
        window.ConfigManager = configManager;
    }

    console.log('[ConfigManager] Compatibility layer initialized v2026.07.04.0');
})();
