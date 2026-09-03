// ==UserScript==
// @name         ServiceContainer (Compatibility Layer)
// @version      2026.07.04.0
// @description  ChatGPT - Delegates to Hub's ServiceContainer for backward compatibility
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
 * ServiceContainer Compatibility Layer
 * @deprecated This module now delegates to the Hub's built-in ServiceContainer.
 * Core functionality is maintained in 00-hub.user.js to eliminate duplication.
 */
(function() {
    'use strict';

    const HYBRID_MODE = true;

    /**
     * Creates a thin compatibility wrapper that delegates to Hub's ServiceContainer
     */
    function createCompatibilityLayer() {
        const hubContainer = window.ServiceContainer;

        if (!hubContainer) {
            console.warn('[ServiceContainer] Hub not available, running in standalone mode');
            return createStandaloneServiceContainer();
        }

        console.log('[ServiceContainer] Using Hub container (hybrid mode)');

        // Create delegation wrapper
        const wrapper = {
            register(name, service, dependencies = []) {
                hubContainer.register(name, () => Promise.resolve(service), {
                    singleton: true,
                    dependencies
                });
                return wrapper;
            },

            async get(name) {
                try {
                    return await hubContainer.resolve(name);
                } catch (error) {
                    if (error.message.includes('not registered')) {
                        return hubContainer.services.get(name)?.instance || null;
                    }
                    throw error;
                }
            },

            reset() {
                hubContainer.reset();
            },

            getRegistered() {
                return Array.from(hubContainer.services.keys());
            },

            isInitialized(name) {
                const service = hubContainer.services.get(name);
                return service?.initialized || false;
            },

            getServiceHealth(name) {
                return hubContainer.services.get(name)?.health || null;
            },

            getDependencies(name) {
                const service = hubContainer.services.get(name);
                return Array.from(service?.dependencies || []);
            }
        };

        return wrapper;
    }

    /**
     * Fallback standalone container if Hub is not present
     */
    function createStandaloneServiceContainer() {
        class ServiceContainer {
            #services = new Map();
            #dependencies = new Map();
            #initializing = new Set();
            #initialized = new Set();
            #errors = new Map();

            register(name, service, dependencies = []) {
                if (typeof name !== 'string' || !name.trim()) {
                    throw new TypeError('Service name must be non-empty string');
                }
                if (this.#services.has(name)) {
                    throw new Error(`Service "${name}" already registered`);
                }
                this.#services.set(name, service);
                this.#dependencies.set(name, new Set(dependencies));
                return this;
            }

            async get(name) {
                if (!this.#services.has(name)) {
                    throw new Error(`Service "${name}" not registered`);
                }
                if (!this.#initialized.has(name)) {
                    await this.#initializeService(name);
                }
                return this.#services.get(name);
            }

            async #initializeService(name) {
                if (this.#initializing.has(name)) {
                    throw new Error(`Circular dependency for "${name}"`);
                }
                this.#initializing.add(name);
                try {
                    const deps = this.#dependencies.get(name) || new Set();
                    for (const dep of deps) {
                        await this.get(dep);
                    }
                    const service = this.#services.get(name);
                    if (typeof service.init === 'function') {
                        await service.init();
                    }
                    this.#initialized.add(name);
                    console.log(`[ServiceContainer] Service "${name}" initialized`);
                } catch (error) {
                    this.#errors.set(name, error.message);
                    console.error(`[ServiceContainer] Failed to initialize "${name}":`, error);
                    throw error;
                } finally {
                    this.#initializing.delete(name);
                }
            }

            reset() {
                this.#initialized.clear();
                this.#initializing.clear();
                this.#errors.clear();
            }

            getRegistered() {
                return Array.from(this.#services.keys());
            }

            isInitialized(name) {
                return this.#initialized.has(name);
            }
        }

        return new ServiceContainer();
    }

    // Initialize compatibility layer
    const ServiceContainer = HYBRID_MODE ? createCompatibilityLayer() : createStandaloneServiceContainer();

    // Export to global scope (only if Hub hasn't already set it)
    if (!window.ServiceContainer) {
        window.ServiceContainer = ServiceContainer;
    }

    console.log('[ServiceContainer] Compatibility layer initialized v2026.07.04.0');
})();