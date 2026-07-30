// ==UserScript==
// @name         ModuleRegistry (Compatibility Layer)
// @version      2026.07.04.0
// @description  ChatGPT - Delegates to Hub's ModuleRegistry for backward compatibility
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
 * ModuleRegistry Compatibility Layer
 * @deprecated This module now delegates to the Hub's built-in ModuleRegistry.
 * Core functionality is maintained in 00-hub.user.js to eliminate duplication.
 */
(function() {
    'use strict';

    const HYBRID_MODE = true;

    /**
     * Creates a thin compatibility wrapper that delegates to Hub's ModuleRegistry
     */
    function createCompatibilityLayer() {
        const hubRegistry = window.ModuleRegistry;

        if (!hubRegistry) {
            console.warn('[ModuleRegistry] Hub not available, running in standalone mode');
            return createStandaloneRegistry();
        }

        console.log('[ModuleRegistry] Using Hub registry (hybrid mode)');

        // Create delegation wrapper
        const wrapper = {
            modules: hubRegistry.modules,
            initTime: Date.now(),

            register(name, version, module) {
                // Hub expects object-style registration with name property
                if (typeof name === 'string') {
                    module = { name, version, module };
                }
                const result = hubRegistry.register(module);
                return result?.module || result || module;
            },

            get(name) {
                return hubRegistry.get(name);
            },

            list() {
                return hubRegistry.list();
            },

            async executeAll(methodName, ...args) {
                return hubRegistry.executeAll(methodName, ...args);
            },

            getHealth() {
                return hubRegistry.getHealth();
            },

            executeAllSync(methodName, ...args) {
                // Hub version is async-first, so we need to adapt
                const modules = hubRegistry.list();
                const results = [];
                for (const mod of modules) {
                    const instance = hubRegistry.get(mod.name);
                    if (instance && typeof instance[methodName] === 'function') {
                        try {
                            results.push({
                                name: mod.name,
                                success: true,
                                result: instance[methodName](...args)
                            });
                        } catch (error) {
                            results.push({ name: mod.name, success: false, error: error.message });
                        }
                    }
                }
                return results;
            }
        };

        return wrapper;
    }

    /**
     * Fallback standalone registry if Hub is not present
     */
    function createStandaloneRegistry() {
        const registry = {
            modules: new Map(),
            initTime: Date.now(),

            register(name, version, module) {
                if (typeof name === 'object' && name !== null) {
                    module = name;
                    name = name.name || 'unknown';
                    version = name.version || '1.0.0';
                }
                const normalizedName = String(name).toLowerCase();
                if (this.modules.has(normalizedName)) {
                    console.warn(`[ModuleRegistry] Module "${name}" already registered`);
                    return this.modules.get(normalizedName).module;
                }
                this.modules.set(normalizedName, {
                    name: module.name || name,
                    version: module.version || version || '1.0.0',
                    module,
                    loaded: true,
                    loadTime: Date.now()
                });
                return module;
            },

            get(name) {
                return this.modules.get(String(name).toLowerCase())?.module || null;
            },

            list() {
                return Array.from(this.modules.entries()).map(([, info]) => ({
                    name: info.name,
                    version: info.version,
                    loaded: info.loaded,
                    loadTime: info.loadTime
                }));
            },

            async executeAll(methodName, ...args) {
                const results = [];
                for (const [name, info] of this.modules.entries()) {
                    if (typeof info.module[methodName] === 'function') {
                        try {
                            const start = performance.now();
                            const result = await info.module[methodName](...args);
                            results.push({
                                name,
                                success: true,
                                result,
                                duration: performance.now() - start
                            });
                        } catch (error) {
                            results.push({ name, success: false, error: error.message });
                        }
                    }
                }
                return results;
            },

            getHealth() {
                const now = Date.now();
                return Array.from(this.modules.entries()).map(([name, info]) => ({
                    name,
                    uptime: now - info.loadTime,
                    healthy: info.loaded && !info.error
                }));
            },

            executeAllSync(methodName, ...args) {
                const modules = Array.from(this.modules.values());
                const results = [];
                for (const moduleInfo of modules) {
                    if (typeof moduleInfo.module[methodName] === 'function') {
                        try {
                            results.push({
                                name: moduleInfo.name,
                                success: true,
                                result: moduleInfo.module[methodName](...args)
                            });
                        } catch (error) {
                            results.push({ name: moduleInfo.name, success: false, error: error.message });
                            if (moduleInfo.critical) throw error;
                        }
                    }
                }
                return results;
            }
        };

        return registry;
    }

    // Initialize compatibility layer
    const registry = HYBRID_MODE ? createCompatibilityLayer() : createStandaloneRegistry();

    // Export to global scope (only if Hub hasn't already set it)
    if (!window.ModuleRegistry) {
        window.ModuleRegistry = registry;
    }

    console.log('[ModuleRegistry] Compatibility layer initialized v2026.07.04.0');
})();
