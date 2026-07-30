// ==UserScript==
// @name         Memory Management (Compatibility Layer)
// @version      2026.07.04.0
// @description  ChatGPT - Delegates to Hub memory/config services; preserves memory management API
// @author       AI RMD
// @match        https://chat.openai.com/*
// @match        https://chatgpt.com/*
// @match        https://claude.ai/*
// @match        https://perplexity.ai/*
// @match        https://www.perplexity.ai/*
// @grant        GM_getValue
// @grant        GM_setValue
// ==/UserScript==

/**
 * MemoryManagement Compatibility Layer
 * @deprecated Memory management behavior can be centralized in the Hub.
 * This module preserves the prior `window.AIRMDMemoryManagement` API surface
 * while delegating to hub-managed config/memory services when available.
 */
(function () {
    'use strict';

    const HYBRID_MODE = true;

    function createCompatibilityLayer() {
        const hubConfig = window.ConfigManager;
        const hubRegistry = window.ModuleRegistry;
        const hubMemory = window.MemoryManager;

        if (!hubConfig) {
            console.warn('[MemoryManagement] Hub not available, running in standalone mode');
            return createStandaloneMemoryLayer();
        }

        console.log('[MemoryManagement] Using Hub-backed config/memory (hybrid mode)');

        const state = {
            config: {
                enabled: true
            },
            _trackedDisposables: new Set(),
            _pools: new Set()
        };

        function getConfig() {
            try {
                return hubConfig.getConfig('airmdmemorymanagement') || {};
            } catch {
                return {};
            }
        }

        function tuneGarbageCollection() {
            if (typeof window.gc !== 'function') return false;
            try { window.gc(); } catch {}
            return true;
        }

        function createMemoryPool(factory = () => ({}), reset = null) {
            const pool = [];
            const entry = {
                allocate() { return pool.length > 0 ? pool.pop() : factory(); },
                deallocate(item) {
                    if (item == null) return;
                    if (typeof reset === 'function') reset(item);
                    pool.push(item);
                },
                size() { return pool.length; },
                clear() { pool.length = 0; }
            };
            state._pools.add(entry);
            return entry;
        }

        function trackDisposable(value) {
            if (value != null) state._trackedDisposables.add(value);
            return value;
        }

        function releaseTracked() {
            let released = 0;
            state._trackedDisposables.forEach((value) => {
                try {
                    if (typeof value.dispose === 'function') value.dispose();
                    else if (typeof value.destroy === 'function') value.destroy();
                    else if (typeof value.abort === 'function') value.abort();
                    else if (typeof value.disconnect === 'function') value.disconnect();
                    released += 1;
                } catch (error) {
                    console.warn('[MemoryManagement] Failed to release tracked value:', error);
                }
            });
            state._trackedDisposables.clear();
            return released;
        }

        function estimateObjectSize(value) {
            try { return JSON.stringify(value).length; } catch { return 0; }
        }

        function initApi() {
            const cfg = getConfig();
            state.config = { ...state.config, ...cfg };
            if (hubRegistry && typeof hubRegistry.register === 'function') {
                try { hubRegistry.register('016-memory-management', '2026.07.04.0', moduleApi); } catch {}
            }
            return {
                trackedDisposables: state._trackedDisposables.size,
                pools: state._pools.size
            };
        }

        const moduleApi = {
            name: 'AIRMDMemoryManagement',
            version: '2026.07.04.0',
            dependencies: [],
            critical: false,

            tuneGarbageCollection,
            createMemoryPool,
            trackDisposable,
            releaseTracked,
            estimateObjectSize,
            init: initApi,

            onConfigUpdate(settings) {
                if (settings) Object.assign(state.config, settings);
            }
        };

        if (typeof window !== 'undefined') {
            window.AIRMDMemoryManagement = moduleApi;
        }
        return moduleApi;
    }

    function createStandaloneMemoryLayer() {
        const state = {
            config: { enabled: true },
            _trackedDisposables: new Set(),
            _pools: new Set()
        };

        function tuneGarbageCollection() {
            if (typeof window.gc !== 'function') return false;
            try { window.gc(); } catch {}
            return true;
        }
        function createMemoryPool(factory = () => ({}), reset = null) {
            const pool = [];
            const entry = {
                allocate() { return pool.length > 0 ? pool.pop() : factory(); },
                deallocate(item) {
                    if (item == null) return;
                    if (typeof reset === 'function') reset(item);
                    pool.push(item);
                },
                size() { return pool.length; },
                clear() { pool.length = 0; }
            };
            state._pools.add(entry);
            return entry;
        }
        function trackDisposable(value) {
            if (value != null) state._trackedDisposables.add(value);
            return value;
        }
        function releaseTracked() {
            let released = 0;
            state._trackedDisposables.forEach((value) => {
                try {
                    if (typeof value.dispose === 'function') value.dispose();
                    else if (typeof value.destroy === 'function') value.destroy();
                    else if (typeof value.abort === 'function') value.abort();
                    else if (typeof value.disconnect === 'function') value.disconnect();
                    released += 1;
                } catch (error) {
                    console.warn('[MemoryManagement] Failed to release tracked value:', error);
                }
            });
            state._trackedDisposables.clear();
            return released;
        }
        function estimateObjectSize(value) {
            try { return JSON.stringify(value).length; } catch { return 0; }
        }
        function initApi() {
            return {
                trackedDisposables: state._trackedDisposables.size,
                pools: state._pools.size
            };
        }

        const moduleApi = {
            name: 'AIRMDMemoryManagement',
            version: '2026.07.04.0',
            dependencies: [],
            critical: false,
            tuneGarbageCollection,
            createMemoryPool,
            trackDisposable,
            releaseTracked,
            estimateObjectSize,
            init: initApi,
            onConfigUpdate(settings) {
                if (settings) Object.assign(state.config, settings);
            }
        };

        if (typeof window !== 'undefined') window.AIRMDMemoryManagement = moduleApi;
        return moduleApi;
    }

    const moduleApi = HYBRID_MODE ? createCompatibilityLayer() : createStandaloneMemoryLayer();
    if (typeof window !== 'undefined' && !window.AIRMDMemoryManagement) {
        window.AIRMDMemoryManagement = moduleApi;
    }
    console.log('[MemoryManagement] Compatibility layer initialized v2026.07.04.0');
})();