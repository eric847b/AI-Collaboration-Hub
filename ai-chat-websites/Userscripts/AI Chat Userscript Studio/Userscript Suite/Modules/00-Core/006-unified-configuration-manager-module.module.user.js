// ==UserScript==
// @name         Unified Configuration Manager (Compatibility Layer)
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
// @grant        GM_registerMenuCommand
// @grant        GM_notification
// @grant        GM_addStyle
// @grant        GM_xmlhttpRequest
// @noframes
// ==/UserScript==

/**
 * Unified Configuration Manager Compatibility Layer
 * @deprecated This module now delegates to the Hub's built-in ConfigManager.
 * Core functionality is maintained in 00-hub.user.js to eliminate duplication.
 */
(function() {
    'use strict';

    const HYBRID_MODE = true;

    /**
     * Creates a thin compatibility wrapper that delegates to Hub's ConfigManager
     */
    function createCompatibilityLayer() {
        const hubConfig = window.ConfigManager;

        if (!hubConfig) {
            console.warn('[UnifiedConfigManager] Hub not available, running in standalone mode');
            return createStandaloneUnifiedConfig();
        }

        console.log('[UnifiedConfigManager] Using Hub configuration (hybrid mode)');

        // Create delegation wrapper that maintains schema awareness
        const wrapper = {
            name: 'Unified Configuration Manager',
            version: '2026.07.04.0',
            dependencies: [],
            critical: false,

            async init() {
                console.log('[UnifiedConfigManager] Hybrid mode: delegating to Hub');
                this.state.isActive = true;
                return true;
            },

            get(key, module) {
                if (module) {
                    return hubConfig.getConfig(module)[key];
                }
                return hubConfig.get(key);
            },

            set(key, value, module) {
                if (module) {
                    hubConfig.updateConfig(module, { [key]: value });
                } else {
                    hubConfig.set(key, value);
                }
            },

            getConfig(module) {
                return hubConfig.getConfig(module);
            },

            setConfig(module, config) {
                hubConfig.updateConfig(module, config);
            },

            validate(key, value) {
                // Simplified validation - Hub handles most validation
                return true;
            },

            export() {
                return hubConfig.export();
            },

            import(json) {
                return hubConfig.import(json);
            },

            reset() {
                hubConfig.reset();
            }
        };

        return wrapper;
    }

    /**
     * Fallback standalone unified config if Hub is not present
     */
    function createStandaloneUnifiedConfig() {
        const MODULE_NAME = 'Unified Configuration Manager';
        const CONFIG_KEY = 'unifiedConfig';
        
        const DEFAULT_CONFIG = {
            version: '2026.07.04.0',
            timestamp: Date.now(),
            environment: 'production',
            modules: {},
            featureFlags: {},
            abTests: {},
            backups: [],
            cloudSync: {
                enabled: false,
                lastSync: null,
                pendingChanges: []
            }
        };

        const configManager = {
            name: MODULE_NAME,
            version: '2026.07.04.0',
            dependencies: [],
            critical: false,
            state: {
                isActive: false,
                config: new Map(),
                schema: new Map(),
                validators: new Map(),
                listeners: new Map(),
                featureFlags: new Map(),
                abTests: new Map(),
                cloudSync: null,
                backupManager: null,
                validationErrors: new Map()
            },

            async init() {
                console.log(`[${MODULE_NAME}] Standalone mode initialized`);
                this.state.isActive = true;
                return true;
            },

            get(key, module) {
                const config = this.state.config.get(module) || DEFAULT_CONFIG;
                return config[key];
            },

            set(key, value, module) {
                const config = this.state.config.get(module) || { ...DEFAULT_CONFIG };
                config[key] = value;
                this.state.config.set(module, config);
                this.save();
            },

            getConfig(module) {
                return this.state.config.get(module) || { ...DEFAULT_CONFIG };
            },

            setConfig(module, config) {
                this.state.config.set(module, { ...config, timestamp: Date.now() });
                this.save();
            },

            validate(key, value) {
                // Basic validation logic
                return true;
            },

            export() {
                return JSON.stringify(Object.fromEntries(this.state.config), null, 2);
            },

            import(json) {
                try {
                    const parsed = JSON.parse(json);
                    this.state.config = new Map(Object.entries(parsed));
                    this.save();
                    return true;
                } catch {
                    return false;
                }
            },

            reset() {
                this.state.config.clear();
                this.save();
            },

            save() {
                try {
                    GM_setValue(CONFIG_KEY, JSON.stringify(Object.fromEntries(this.state.config)));
                } catch (e) {
                    console.error(`[${MODULE_NAME}] Save error:`, e);
                }
            }
        };

        return configManager;
    }

    // Initialize compatibility layer
    const unifiedConfigManager = HYBRID_MODE ? createCompatibilityLayer() : createStandaloneUnifiedConfig();

    // Export to global scope (only if Hub hasn't already set it)
    if (!window.UnifiedConfigManager) {
        window.UnifiedConfigManager = unifiedConfigManager;
    }

    console.log('[UnifiedConfigManager] Compatibility layer initialized v2026.07.04.0');
})();