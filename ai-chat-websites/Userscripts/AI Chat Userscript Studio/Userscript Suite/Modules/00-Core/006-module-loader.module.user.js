// ==UserScript==
// @name         ModuleLoader (Compatibility Layer)
// @version      2026.07.04.0
// @description  ChatGPT - Delegates to Hub's ModuleLoader for backward compatibility
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
// @grant        GM_xmlhttpRequest
// @grant        GM_getValue
// @grant        GM_setValue
// ==/UserScript==

/**
 * ModuleLoader Compatibility Layer
 * @deprecated This module now delegates to the Hub's built-in ModuleLoader.
 * Core functionality is maintained in 00-hub.user.js to eliminate duplication.
 */
(function() {
    'use strict';

    const HYBRID_MODE = true;

    /**
     * Creates a thin compatibility wrapper that delegates to Hub's ModuleLoader
     */
    function createCompatibilityLayer() {
        const hubLoader = window.ModuleLoader;

        if (!hubLoader) {
            console.warn('[ModuleLoader] Hub not available, running in standalone mode');
            return createStandaloneModuleLoader();
        }

        console.log('[ModuleLoader] Using Hub module loader (hybrid mode)');

        // Create delegation wrapper
        const wrapper = {
            async loadModule(name, url, options = {}) {
                return hubLoader.loadModule(name, url, options);
            },

            unloadModule(name) {
                if (hubLoader.unloadModule) {
                    hubLoader.unloadModule(name);
                }
            },

            getLoadedModuleNames() {
                return hubLoader.getLoadedModuleNames ? hubLoader.getLoadedModuleNames() : [];
            },

            getModuleState(name) {
                return hubLoader.getModuleState ? hubLoader.getModuleState(name) : null;
            },

            async loadFromDOM() {
                return hubLoader.loadFromDOM ? hubLoader.loadFromDOM() : [];
            },

            async loadFromURL(url) {
                return hubLoader.loadFromURL ? hubLoader.loadFromURL(url) : false;
            }
        };

        return wrapper;
    }

    /**
     * Fallback standalone module loader if Hub is not present
     */
    function createStandaloneModuleLoader() {
        const MAX_QUEUE_SIZE = 100;
        const MAX_LOADED_MODULES = 500;
        const FETCH_TIMEOUT = 30000;

        class ModuleLoader {
            #container = null;
            #loadedModules = new Map();
            #moduleStates = new Map();
            #abortController = null;
            #moduleQueue = [];
            #isProcessing = false;
            #loadMetrics = new Map();
            #retryAttempts = new Map();
            #maxRetries = 3;
            #retryDelay = 1000;
            #dependencyValidation = true;

            constructor(container, options = {}) {
                this.#container = container;
                this.#abortController = new AbortController();
                if (options.maxRetries) this.#maxRetries = options.maxRetries;
                if (options.retryDelay) this.#retryDelay = options.retryDelay;
                if (options.dependencyValidation !== undefined) {
                    this.#dependencyValidation = options.dependencyValidation;
                }
            }

            async loadModule(name, url, options = {}) {
                if (!name || typeof name !== 'string' || !name.trim()) {
                    throw new Error('Invalid module name: must be a non-empty string');
                }
                if (!url || typeof url !== 'string' || !url.trim()) {
                    throw new Error('Invalid module URL: must be a non-empty string');
                }

                const normalizedName = name.trim();

                if (this.#loadedModules.has(normalizedName)) {
                    console.warn(`[ModuleLoader] Module "${normalizedName}" already loaded`);
                    return this.#loadedModules.get(normalizedName);
                }

                if (this.#moduleQueue.length >= MAX_QUEUE_SIZE) {
                    throw new Error(`Module queue full (${MAX_QUEUE_SIZE} modules)`);
                }

                if (this.#loadedModules.size >= MAX_LOADED_MODULES) {
                    throw new Error(`Maximum loaded modules reached (${MAX_LOADED_MODULES})`);
                }

                if (options.batch !== false) {
                    this.#moduleQueue.push({ name: normalizedName, url, options });
                    if (!this.#isProcessing) {
                        await this.#processQueue();
                    }
                    return this.#loadedModules.get(normalizedName);
                }

                return this.#loadWithRetry(normalizedName, url, options);
            }

            async #loadWithRetry(name, url, options) {
                let lastError;
                const retries = this.#retryAttempts.get(name) || 0;

                for (let attempt = 0; attempt <= this.#maxRetries; attempt++) {
                    try {
                        const startTime = performance.now();
                        const module = await this.#fetchModule(url, { 
                            signal: this.#abortController.signal,
                            ...options 
                        });
                        const loadTime = performance.now() - startTime;

                        this.#loadedModules.set(name, module);
                        this.#moduleStates.set(name, { 
                            status: 'active', 
                            timestamp: Date.now(),
                            loadTime: loadTime
                        });
                        this.#loadMetrics.set(name, loadTime);
                        this.#retryAttempts.delete(name);

                        console.log(`[ModuleLoader] Module "${name}" loaded in ${loadTime.toFixed(2)}ms`);
                        return module;
                    } catch (error) {
                        lastError = error;
                        this.#retryAttempts.set(name, retries + 1);
                        if (attempt < this.#maxRetries) {
                            const delay = this.#retryDelay * Math.pow(2, attempt);
                            await new Promise(resolve => setTimeout(resolve, delay));
                        }
                    }
                }

                throw lastError;
            }

            async #fetchModule(url, options = {}) {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT);

                try {
                    const response = await fetch(url, {
                        signal: controller.signal,
                        ...options
                    });
                    clearTimeout(timeoutId);

                    if (!response.ok) {
                        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                    }

                    const code = await response.text();
                    const fn = new Function(code);
                    const result = fn();

                    if (result && typeof result.then === 'function') {
                        return await result;
                    }
                    return result;
                } catch (error) {
                    clearTimeout(timeoutId);
                    throw error;
                }
            }

            async #processQueue() {
                this.#isProcessing = true;
                while (this.#moduleQueue.length > 0) {
                    const { name, url, options } = this.#moduleQueue.shift();
                    try {
                        await this.loadModule(name, url, { ...options, batch: false });
                    } catch (error) {
                        console.error(`[ModuleLoader] Queue processing error for ${name}:`, error);
                    }
                }
                this.#isProcessing = false;
            }

            unloadModule(name) {
                const key = name.toLowerCase();
                const entry = this.#loadedModules.get(key);
                if (entry) {
                    if (typeof entry.cleanup === 'function') {
                        entry.cleanup();
                    }
                    this.#loadedModules.delete(key);
                    this.#moduleStates.delete(key);
                    console.log(`[ModuleLoader] Unloaded module: ${name}`);
                }
            }

            getLoadedModuleNames() {
                return Array.from(this.#loadedModules.keys());
            }

            getModuleState(name) {
                const key = name.toLowerCase();
                return this.#moduleStates.get(key) || { status: 'not_loaded' };
            }

            getMetrics() {
                const metrics = {};
                for (const [name, loadTime] of this.#loadMetrics) {
                    metrics[name] = { loadTime, status: this.#moduleStates.get(name)?.status || 'unknown' };
                }
                return metrics;
            }

            async loadFromDOM() {
                const modules = [];
                document.querySelectorAll("script[data-module]").forEach((script) => {
                    try {
                        const code = script.textContent;
                        const fn = new Function(code);
                        const result = fn();
                        if (result && typeof result.then === 'function') {
                            modules.push(result.catch(err => console.error('[ModuleLoader] DOM module error:', err)));
                        }
                    } catch (e) {
                        console.error('[ModuleLoader] Failed to load DOM module:', e);
                    }
                });
                await Promise.all(modules);
                return this.getLoadedModuleNames();
            }

            async loadFromURL(url) {
                try {
                    const response = await fetch(url);
                    const code = await response.text();
                    const fn = new Function(code);
                    const result = fn();
                    if (result && typeof result.then === 'function') {
                        const module = await result;
                        const name = module.name || 'unknown';
                        this.#loadedModules.set(name, module);
                        this.#moduleStates.set(name, { status: 'active', timestamp: Date.now() });
                        return true;
                    }
                    return false;
                } catch (e) {
                    console.error('[ModuleLoader] Failed to load module from URL:', e);
                    return false;
                }
            }

            clear() {
                this.#loadedModules.clear();
                this.#moduleStates.clear();
                this.#loadMetrics.clear();
                this.#retryAttempts.clear();
                this.#moduleQueue = [];
            }
        }

        return new ModuleLoader();
    }

    // Initialize compatibility layer
    const ModuleLoader = HYBRID_MODE ? createCompatibilityLayer() : createStandaloneModuleLoader();

    // Export to global scope (only if Hub hasn't already set it)
    if (!window.ModuleLoader) {
        window.ModuleLoader = ModuleLoader;
    }

    console.log('[ModuleLoader] Compatibility layer initialized v2026.07.04.0');
})();