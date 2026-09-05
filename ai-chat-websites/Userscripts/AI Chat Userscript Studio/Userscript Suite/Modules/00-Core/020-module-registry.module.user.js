// ==UserScript==
// @name         module-registry
// @namespace   AI-Chat-Userscript-Studio
// @version     2026.09.26.0
// @description  Module registry - merges nexus-core registry.json with roles/deps/entrypoint/health + validation + topological sort
// @author       AI Chat Userscript Studio (merged from nexus-core/registry.json + orchestrator.py)
// @match        *://*/*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_deleteValue
// @grant        GM_log
// @run-at       document-end
// ==/UserScript==

/**
 * Module Registry v1.0
 * Merged from: nexus-core/registry.json + orchestrator.py validation
 * Upgrades: browser-native, auto-discovery, topological sort, health dashboard data
 */
(() => {
    'use strict';

    const MODULE_NAME = 'module-registry';
    const REG_KEY = 'module_registry_data';
    const VALID_ROLES = ['core', 'execution', 'coordination', 'memory', 'ui', 'automation', 'security', 'performance', 'analytics', 'unclassified'];

    const metadata = {
        name: MODULE_NAME, version: '2026.09.26.0',
        dependencies: ['hub-orchestrator'], critical: true, category: '00-Core',
    };

    const state = { initialized: false, modules: [], lastScan: null };

    function load() { try { state.modules = JSON.parse(GM_getValue(REG_KEY, '[]')); } catch (e) { state.modules = []; } return state.modules; }
    function save() { GM_setValue(REG_KEY, JSON.stringify(state.modules)); }

    function register(entry) {
        load();
        const idx = state.modules.findIndex(m => m.name === entry.name);
        const record = {
            name: entry.name,
            role: VALID_ROLES.includes(entry.role) ? entry.role : 'unclassified',
            version: entry.version || '1.0.0', status: entry.status || 'HEALTHY',
            entrypoint: entry.entrypoint || '', deps: Array.isArray(entry.deps) ? entry.deps : [],
            category: entry.category || '', file: entry.file || '', description: entry.description || '',
            registered_at: new Date().toISOString(),
        };
        if (idx >= 0) state.modules[idx] = record; else state.modules.push(record);
        save();
        return record;
    }
    function remove(name) { load(); state.modules = state.modules.filter(m => m.name !== name); save(); }
    function getByName(name) { load(); return state.modules.find(m => m.name === name) || null; }
    function getByRole(role) { load(); return state.modules.filter(m => m.role === role); }
    function getByCategory(cat) { load(); return state.modules.filter(m => m.category === cat); }

    function validate() {
        load();
        const errors = [];
        const names = state.modules.map(m => m.name);
        if (new Set(names).size !== names.length) errors.push('Duplicate module names');
        for (const mod of state.modules) {
            if (!VALID_ROLES.includes(mod.role)) errors.push(`Invalid role '${mod.role}' for '${mod.name}'`);
            for (const dep of mod.deps || []) {
                if (dep !== '*' && !names.includes(dep)) errors.push(`Unknown dep '${dep}' for '${mod.name}'`);
            }
        }
        return { valid: errors.length === 0, errors };
    }

    function topologicalSort() {
        load();
        const names = state.modules.map(m => m.name);
        const inDeg = {}; const adj = {};
        for (const n of names) { inDeg[n] = 0; adj[n] = []; }
        for (const mod of state.modules) {
            for (const dep of (mod.deps || [])) {
                if (dep !== '*' && adj[dep]) { adj[dep].push(mod.name); inDeg[mod.name] = (inDeg[mod.name] || 0) + 1; }
            }
        }
        const queue = names.filter(n => inDeg[n] === 0);
        const sorted = [];
        while (queue.length > 0) {
            const node = queue.shift(); sorted.push(node);
            for (const nb of adj[node] || []) { inDeg[nb]--; if (inDeg[nb] === 0) queue.push(nb); }
        }
        return sorted;
    }

    function getStats() {
        load();
        const byRole = {}; const byStatus = {};
        for (const m of state.modules) { byRole[m.role] = (byRole[m.role] || 0) + 1; byStatus[m.status] = (byStatus[m.status] || 0) + 1; }
        return { total: state.modules.length, by_role: byRole, by_status: byStatus };
    }

    function scanExisting() {
        load();
        const found = [];
        if (typeof window.__NEXUS_MODULES__ !== 'undefined') {
            for (const [name, mod] of Object.entries(window.__NEXUS_MODULES__)) {
                if (mod.metadata) { register(mod.metadata); found.push(name); }
            }
        }
        state.lastScan = new Date().toISOString();
        return found;
    }

    // ─── Extended Auto-Discovery (scan all __NEXUS_*Module__ globals) ────────
    function discoverFromGlobals() {
        load();
        const found = [];
        if (typeof window === 'undefined') return found;
        const nexusPrefix = '__NEXUS_';
        const moduleSuffix = 'Module';
        for (const key of Object.keys(window)) {
            if (!key.startsWith(nexusPrefix) || !key.endsWith(moduleSuffix)) continue;
            const mod = window[key];
            if (mod && mod.metadata && mod.metadata.name) {
                const existing = getByName(mod.metadata.name);
                if (!existing) {
                    register(mod.metadata);
                    found.push(mod.metadata.name);
                }
            }
        }
        // Also scan legacy MODULE_ID globals (old-style modules)
        for (const key of Object.keys(window)) {
            const mod = window[key];
            if (mod && mod.MODULE_NAME && mod.MODULE_ID) {
                const name = mod.MODULE_NAME;
                const existing = getByName(name);
                if (!existing) {
                    register({
                        name,
                        role: 'automation',
                        version: mod.MODULE_VERSION || '1.0.0',
                        status: 'HEALTHY',
                        category: 'legacy',
                        description: `Legacy module ${mod.MODULE_ID}`,
                    });
                    found.push(name);
                }
            }
        }
        state.lastScan = new Date().toISOString();
        return found;
    }

    function init() {
        if (state.initialized) return;
        console.log(`[${MODULE_NAME}] Initializing...`);
        load(); scanExisting(); discoverFromGlobals();
        state.initialized = true;
        console.log(`[${MODULE_NAME}] Initialized - ${state.modules.length} modules`);
    }
    function getHealth() { const v = validate(); return { healthy: v.valid, details: `${state.modules.length} registered, ${v.errors.length} errors` }; }

    if (typeof window !== 'undefined') {
        window.__NEXUS_REGISTRY__ = {
            init, getHealth, metadata, register, remove, getByName, getByRole, getByCategory,
            validate, topologicalSort, getStats, scanExisting, discoverFromGlobals,
        };
        window[`${MODULE_NAME}Module`] = { init, getHealth, metadata };
    }
    if (document.readyState === 'complete') { init(); } else { window.addEventListener('load', init); }
})();
