// ==UserScript==
// @name         Caching Strategies (Compatibility Layer)
// @namespace    http://tampermonkey.net/
// @version      2026.07.04.0
// @description  ChatGPT - Delegates to the Hub cache/config services for cache behavior
// @author       AI RMD
// @license      MIT
// @match        https://chat.openai.com/*
// @match        https://chatgpt.com/*
// @match        https://claude.ai/*
// @match        https://perplexity.ai/*
// @match        https://www.perplexity.ai/*
// @grant        GM_getValue
// @grant        GM_setValue
// ==/UserScript==

/**
 * CachingStrategies Compatibility Layer
 * @deprecated Caching behavior is centralized in the hub/config/cache paths.
 * This module preserves the prior `window.AIRMDCachingStrategies` API surface
 * while delegating to the hub-managed cache/config when available.
 */
(function () {
    'use strict';

    const HYBRID_MODE = true;

    function createCompatibilityLayer() {
        const hubConfig = window.ConfigManager;
        const hubRegistry = window.ModuleRegistry;
        const hubMemory = window.MemoryManager;

        if (!hubConfig) {
            console.warn('[CachingStrategies] Hub not available, running in standalone mode');
            return createStandaloneCacheLayer();
        }

        console.log('[CachingStrategies] Using Hub-backed cache/config (hybrid mode)');

        const state = {
            cleanupIntervalMs: 0,
            _cleanupTimer: null
        };

        function getConfig() {
            return ModuleBootstrapHelper.loadConfig({}, 'airmdcachingstrategies');
        }

        function startCleanupTimer() {
            if (state._cleanupTimer) {
                clearInterval(state._cleanupTimer);
                state._cleanupTimer = null;
            }

            const cfg = getConfig();
            const interval = Number(cfg.cleanupIntervalMs || 0);
            state.cleanupIntervalMs = interval;
            if (interval > 0) {
                state._cleanupTimer = setInterval(() => {
                    try { clearExpired(); } catch (e) { console.warn('[CachingStrategies] cleanup error', e); }
                }, interval);
            }
        }

        function setCache(key, value, ttl = 0) {
            const expiresAt = ttl > 0 ? Date.now() + ttl : 0;
            try {
                const payload = { value, expiresAt, ttl, updatedAt: Date.now() };
                GM_setValue('airmdCache:' + String(key), JSON.stringify(payload));
                if (hubMemory && typeof hubMemory.check === 'function') hubMemory.check();
            } catch (e) {
                console.warn('[CachingStrategies] setCache failed', e);
            }
            return value;
        }

        function getCache(key) {
            try {
                const raw = GM_getValue('airmdCache:' + String(key), null);
                if (!raw) return null;
                const entry = typeof raw === 'string' ? JSON.parse(raw) : raw;
                if (entry && entry.expiresAt && entry.expiresAt <= Date.now()) {
                    invalidate(key);
                    return null;
                }
                return entry && typeof entry.value !== 'undefined' ? entry.value : null;
            } catch {
                return null;
            }
        }

        function invalidate(key) {
            try { GM_setValue('airmdCache:' + String(key), null); } catch {}
        }

        function clearExpired() {
            try {
                const all = GM_listValues ? GM_listValues() : [];
                const now = Date.now();
                for (const k of all) {
                    if (typeof k === 'string' && k.startsWith('airmdCache:')) {
                        const raw = GM_getValue(k, null);
                        if (!raw) continue;
                        const entry = typeof raw === 'string' ? JSON.parse(raw) : raw;
                        if (entry && entry.expiresAt && entry.expiresAt <= now) {
                            GM_setValue(k, null);
                        }
                    }
                }
                if (hubMemory && typeof hubMemory.check === 'function') hubMemory.check();
            } catch (e) {
                console.warn('[CachingStrategies] clearExpired failed', e);
            }
        }

        function clearAll() {
            try {
                const all = GM_listValues ? GM_listValues() : [];
                for (const k of all) {
                    if (typeof k === 'string' && k.startsWith('airmdCache:')) {
                        GM_setValue(k, null);
                    }
                }
            } catch {}
        }

        function getStats() {
            try {
                const all = GM_listValues ? GM_listValues() : [];
                let count = 0;
                let expired = 0;
                const now = Date.now();
                for (const k of all) {
                    if (typeof k === 'string' && k.startsWith('airmdCache:')) {
                        count++;
                        const raw = GM_getValue(k, null);
                        const entry = typeof raw === 'string' ? JSON.parse(raw) : raw;
                        if (entry && entry.expiresAt && entry.expiresAt <= now) expired++;
                    }
                }
                return { keys: count, expired, size: Math.max(0, count - expired) };
            } catch {
                return { keys: 0, expired: 0, size: 0 };
            }
        }

        function distributedCachingInfo() {
            return { mode: 'local-gm', backend: 'GM storage', shared: false };
        }

        function initApi() {
            const cfg = getConfig();
            state.cleanupIntervalMs = Number(cfg.cleanupIntervalMs || 0);
            startCleanupTimer();
            ModuleBootstrapHelper.register('006-caching-strategies', '2026.07.04.0', moduleApi);
        }

        const moduleApi = {
            name: 'CachingStrategies',
            version: '2026.07.04.0',
            dependencies: [],
            critical: false,

            setCache,
            getCache,
            getOrLoad(key, loader, ttl = 0) {
                const cached = getCache(key);
                if (cached !== null) return Promise.resolve(cached);
                return Promise.resolve()
                    .then(() => loader())
                    .then((value) => {
                        setCache(key, value, ttl);
                        return value;
                    });
            },
            invalidate: invalidate,
            clearExpired,
            clearAll,
            getStats,
            distributedCachingInfo,
            init: initApi,

            onConfigUpdate(settings) {
                if (settings && typeof settings.cleanupIntervalMs !== 'undefined') {
                    state.cleanupIntervalMs = Number(settings.cleanupIntervalMs || 0);
                    startCleanupTimer();
                }
            }
        };

        if (typeof window !== 'undefined') {
            window.AIRMDCachingStrategies = moduleApi;
        }
        return moduleApi;
    }

    function createStandaloneCacheLayer() {
        const cache = new Map();
        const pendingLoads = new Map();
        let _cleanupTimer = null;
        let cleanupIntervalMs = 0;

        function setCache(key, value, ttl = 0) {
            const expiresAt = ttl > 0 ? Date.now() + ttl : 0;
            cache.set(key, { value, expiresAt });
            return value;
        }
        function getCache(key) {
            const c = cache.get(key);
            if (!c) return null;
            if (c.expiresAt && c.expiresAt <= Date.now()) { cache.delete(key); return null; }
            return c.value;
        }
        function invalidate(key) { cache.delete(key); }
        function clearExpired() {
            const now = Date.now();
            for (const [k, c] of cache.entries()) {
                if (c.expiresAt && c.expiresAt <= now) cache.delete(k);
            }
        }
        function clearAll() { cache.clear(); pendingLoads.clear(); }
        function getStats() {
            let expired = 0;
            const now = Date.now();
            for (const c of cache.values()) { if (c.expiresAt && c.expiresAt <= now) expired++; }
            return { keys: cache.size, expired, size: cache.size - expired };
        }
        function distributedCachingInfo() { return { mode: 'memory', backend: 'Map', shared: false }; }
        function startCleanupTimer() {
            if (_cleanupTimer) clearInterval(_cleanupTimer);
            _cleanupTimer = null;
            if (cleanupIntervalMs > 0) _cleanupTimer = setInterval(clearExpired, cleanupIntervalMs);
        }
        function initApi() {
            const saved = GM_getValue('airmdCacheConfig', null);
            if (saved) {
                try { cleanupIntervalMs = Number(JSON.parse(saved).cleanupIntervalMs || 0); } catch {}
            }
            startCleanupTimer();
        }
        function getOrLoad(key, loader, ttl = 0) {
            const cached = getCache(key);
            if (cached !== null) return Promise.resolve(cached);
            if (pendingLoads.has(key)) return pendingLoads.get(key);
            const pending = Promise.resolve()
                .then(() => loader())
                .then((value) => { setCache(key, value, ttl); pendingLoads.delete(key); return value; })
                .catch((error) => { pendingLoads.delete(key); throw error; });
            pendingLoads.set(key, pending);
            return pending;
        }

        const moduleApi = {
            name: 'CachingStrategies',
            version: '2026.07.04.0',
            dependencies: [],
            critical: false,
            setCache,
            getCache,
            getOrLoad,
            invalidate,
            clearExpired,
            clearAll,
            getStats,
            distributedCachingInfo,
            init: initApi,
            onConfigUpdate(settings) {
                if (settings && typeof settings.cleanupIntervalMs !== 'undefined') {
                    cleanupIntervalMs = Number(settings.cleanupIntervalMs || 0);
                    startCleanupTimer();
                }
            }
        };

        if (typeof window !== 'undefined') window.AIRMDCachingStrategies = moduleApi;
        return moduleApi;
    }

    const moduleApi = HYBRID_MODE ? createCompatibilityLayer() : createStandaloneCacheLayer();
    if (typeof window !== 'undefined' && !window.AIRMDCachingStrategies) {
        window.AIRMDCachingStrategies = moduleApi;
    }
    console.log('[CachingStrategies] Compatibility layer initialized v2026.07.04.0');
})();