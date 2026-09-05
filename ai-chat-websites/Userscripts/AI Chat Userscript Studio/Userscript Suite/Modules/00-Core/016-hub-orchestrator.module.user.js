// ==UserScript==
// @name         hub-orchestrator
// @namespace   AI-Chat-Userscript-Studio
// @version     2026.09.26.1
// @description  Central orchestrator - merges nexus-core catalyst cycle, registry validation, atomic writes, health monitoring. Replaces loose module collection with unified brain.
// @author       AI Chat Userscript Studio (merged from nexus-core, autonomous-github-agent, self-evolve-dash)
// @match        *://*/*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_deleteValue
// @grant        GM_log
// @grant        GM_addStyle
// @run-at       document-end
// ==/UserScript==

/**
 * Hub Orchestrator v1.1
 * Merged from: nexus-core/orchestrator.py + skills.py + self-evolve-dash state + solutions-dynamics
 * Upgrades: browser-native, atomic writes, health self-healing, dependency cycle detection
 */
(() => {
    'use strict';

    const MODULE_NAME = 'hub-orchestrator';
    const REGISTRY_KEY = 'nexus_core_registry';
    const SCOPE_KEY = 'nexus_core_scope';
    const CATALYST_KEY = 'nexus_core_catalyst';

    const metadata = {
        name: MODULE_NAME,
        version: '2026.09.26.1',
        dependencies: [],
        critical: true,
        category: '00-Core',
    };

    const state = {
        initialized: false,
        modules: {},
        registry: null,
        scope: null,
    };

    function atomicWrite(key, data) {
        const tempKey = key + '_tmp_' + Date.now();
        try {
            GM_setValue(tempKey, JSON.stringify(data));
            GM_setValue(key, JSON.stringify(data));
            GM_deleteValue(tempKey);
        } catch (e) {
            GM_setValue(key, JSON.stringify(data));
        }
    }

    function atomicRead(key, defaultVal) {
        try {
            const raw = GM_getValue(key, null);
            return raw ? JSON.parse(raw) : (defaultVal || null);
        } catch (e) {
            return defaultVal || null;
        }
    }

    const DEFAULT_REGISTRY = {
        system: 'ai-chat-userscript-suite',
        version: '1.0.0',
        generated: '',
        modules: [],
        roles: {
            core: [], execution: [], coordination: [], memory: [],
            ui: [], automation: [], security: [], performance: [], analytics: [],
        },
        rules: [
            'All modules MUST register through hub-orchestrator',
            'No cross-folder mutation without registry entry',
            'Shrink code at every step',
            'Single orchestration source',
            'Runtime fails are absorbed; never bomb the user',
            'Prefer free/zero-cost only',
            'Zero user time for routine work',
            'Self-audit modules vs needs',
        ],
    };

    function getRegistry() {
        if (!state.registry) {
            state.registry = atomicRead(REGISTRY_KEY, DEFAULT_REGISTRY);
        }
        return state.registry;
    }

    function saveRegistry() {
        const reg = getRegistry();
        reg.generated = new Date().toISOString();
        atomicWrite(REGISTRY_KEY, reg);
        state.registry = reg;
    }

    function registerModule(moduleInfo) {
        const reg = getRegistry();
        const existing = reg.modules.findIndex(m => m.name === moduleInfo.name);
        const entry = {
            name: moduleInfo.name,
            role: moduleInfo.role || 'automation',
            version: moduleInfo.version || '1.0.0',
            status: 'HEALTHY',
            entrypoint: moduleInfo.entrypoint || '',
            deps: moduleInfo.deps || [],
            category: moduleInfo.category || '',
            file: moduleInfo.file || '',
            registered_at: new Date().toISOString(),
                };
        if (existing >= 0) {
            reg.modules[existing] = entry;
        } else {
            reg.modules.push(entry);
        }
        atomicWrite(REGISTRY_KEY, reg);
        state.registry = reg;
    }

    function computeScope() {
        const reg = getRegistry();
        const mods = reg.modules.map(m => ({
            name: m.name,
            role: m.role,
            status: checkModuleHealth(m),
            version: m.version,
            deps: m.deps,
            category: m.category,
        }));
        const unhealthy = mods.filter(m => m.status !== 'HEALTHY');
        const scope = {
            system: reg.system,
            version: reg.version,
            generated: new Date().toISOString(),
            modules: mods,
            unhealthy: unhealthy.map(m => m.name),
            health_summary: {
                total: mods.length,
                healthy: mods.filter(m => m.status === 'HEALTHY').length,
                unhealthy: unhealthy.length,
                coverage: mods.length > 0 ? ((mods.filter(m => m.status === 'HEALTHY').length / mods.length) * 100).toFixed(1) + '%' : '0%',
            },
            rules: reg.rules,
            canonical: '00-Core/hub-orchestrator',
            executor: 'hub-orchestrator',
            cost: 'zero',
            user_time: 'zero',
        };
        atomicWrite(SCOPE_KEY, scope);
        state.scope = scope;
        return scope;
    }

    function checkModuleHealth(mod) {
        const modState = state.modules[mod.name];
        if (!modState) return 'PRESENT';
        if (modState.error) return 'ERROR';
        if (modState.initialized) return 'HEALTHY';
        return 'PRESENT';
    }

    // ─── Catalyst Cycle ──────────────────────────────────────────────────────
    async function runCatalyst() {
        const scope = computeScope();
        const audit = runSelfAudit();
        const heal = await healUnhealthy();
        const prompt = generateCatalystPrompt(scope, audit);
        const catalyst = {
            generated: new Date().toISOString(),
            scope_summary: scope.health_summary,
            audit_issues: audit.issues.length,
            heal_results: heal,
            prompt: prompt,
        };
        atomicWrite(CATALYST_KEY, catalyst);
        return catalyst;
    }

    // ─── Registry Validation ────────────────────────────────────────────────
    const KNOWN_ROLES = ['core', 'execution', 'coordination', 'memory', 'ui',
        'automation', 'security', 'performance', 'analytics'];

    function validateRegistry() {
        const reg = getRegistry();
        const errors = [];
        const seen = new Set();
        const names = new Set(reg.modules.map(m => m.name));
        for (const mod of reg.modules) {
            if (!mod.name || typeof mod.name !== 'string') {
                errors.push('registry entry missing valid name');
                continue;
            }
            if (seen.has(mod.name)) errors.push('duplicate registration: ' + mod.name);
            seen.add(mod.name);
            if (!mod.version) errors.push(mod.name + ': missing version');
            if (mod.role && mod.role !== '*' && KNOWN_ROLES.indexOf(mod.role) < 0) {
                errors.push(mod.name + ": unknown role '" + mod.role + "'");
            }
            for (const dep of (mod.deps || [])) {
                if (dep === '*' || dep === mod.name) continue;
                if (!names.has(dep)) errors.push(mod.name + ": unmet dependency '" + dep + "'");
            }
        }
        return errors;
    }

    function runSelfAudit() {
        const reg = getRegistry();
        const issues = [];
        for (const mod of reg.modules) {
            if (mod.status !== 'HEALTHY') {
                issues.push(`[${mod.status}] ${mod.name} — module not fully healthy`);
            }
        }
        const errors = validateRegistry();
        for (const err of errors) issues.push(`[REGISTRY] ${err}`);
        return { issues, module_count: reg.modules.length };
    }

    function generateCatalystPrompt(scope, audit) {
        if (audit.issues.length === 0) {
            return 'System stable. No action needed.';
        }
        const top = audit.issues.slice(0, 3).join('; ');
        return `Address: ${top}. Then re-run scope to verify.`;
    }

    // ─── Module Discovery ───────────────────────────────────────────────────
    function discoverModules() {
        if (typeof window.__NEXUS_MODULES__ === 'undefined') return [];
        const discovered = [];
        for (const [name, mod] of Object.entries(window.__NEXUS_MODULES__)) {
            if (mod.metadata) {
                discovered.push(mod.metadata);
                registerModule(mod.metadata);
            }
        }
        return discovered;
    }

    // ─── Dependency Graph & Cycle Detection ──────────────────────────────────
    function getDependencyGraph() {
        const reg = getRegistry();
        const graph = { nodes: [], edges: [] };
        const nodeIds = {};
        reg.modules.forEach((m, i) => {
            nodeIds[m.name] = `mod_${i}`;
            graph.nodes.push({ id: `mod_${i}`, name: m.name, role: m.role });
        });
        for (const mod of reg.modules) {
            for (const dep of mod.deps || []) {
                if (dep === '*' || !nodeIds[dep]) continue;
                graph.edges.push({ from: nodeIds[dep], to: nodeIds[mod.name] });
            }
        }
        return graph;
    }

    function detectCycles() {
        const graph = getDependencyGraph();
        const adj = {};
        for (const node of graph.nodes) adj[node.id] = [];
        for (const edge of graph.edges) adj[edge.from].push(edge.to);
        const visited = new Set();
        const stack = new Set();
        const cycles = [];
        function dfs(node, path) {
            if (stack.has(node)) { cycles.push([...path, node]); return; }
            if (visited.has(node)) return;
            visited.add(node);
            stack.add(node);
            for (const next of adj[node] || []) dfs(next, [...path, node]);
            stack.delete(node);
        }
        for (const node of graph.nodes) dfs(node.id, []);
        return cycles;
    }

    // ─── Init & Export ───────────────────────────────────────────────────────
    function init() {
        if (state.initialized) return;
        console.log(`[${MODULE_NAME}] Initializing...`);
        registerModule(metadata);
        discoverModules();
        computeScope();
        state.initialized = true;
        console.log(`[${MODULE_NAME}] Initialized - ${getRegistry().modules.length} modules registered`);
    }

    function getHealth() {
        const scope = computeScope();
        return {
            healthy: state.initialized,
            details: `${scope.health_summary.healthy}/${scope.health_summary.total} modules healthy`,
            scope: scope.health_summary,
            registry_errors: validateRegistry(),
            cycles: detectCycles(),
        };
    }

    // ─── Auto-Heal Integration (016 detects → 021 selfHeal retries) ─────────
    async function healUnhealthy() {
        const failures = (typeof window !== 'undefined') ? window.__NEXUS_FAILURE__ : null;
        const errors = validateRegistry();
        const results = [];
        if (!failures || typeof failures.selfHeal !== 'function') {
            return { healed: [], skipped: errors.length, reason: 'failure-recovery module unavailable' };
        }
        for (const mod of getRegistry().modules) {
            const modState = state.modules[mod.name];
            if (modState && modState.error) {
                const r = await failures.selfHeal(mod.name, async () => {
                    modState.error = null;
                    modState.initialized = false;
                    if (typeof modState.reinit === 'function') await modState.reinit();
                }, { policy: 'init', type: 'registry_error_recovery' });
                results.push(r);
            }
        }
        return { healed: results.filter(r => r.healed).length, attempted: results.length, results };
    }

    if (typeof window !== 'undefined') {
        window.__NEXUS_HUB__ = {
            init, getHealth, getRegistry, registerModule, computeScope, validateRegistry,
            runCatalyst, getDependencyGraph, detectCycles, discoverModules,
            healUnhealthy, metadata,
        };
        window[`${MODULE_NAME}Module`] = { init, getHealth, metadata };
    }

    if (document.readyState === 'complete') { init(); } else { window.addEventListener('load', init); }
})();
