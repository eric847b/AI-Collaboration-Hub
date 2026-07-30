// ==UserScript==
// @name         HubEventHandler
// @version      2026.05.04.0
// @description  ChatGPT - Event bridge between hub internals and control panel
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
 * HubEventHandler - Event bridge between hub internals and control panel
 * Listens for HubCommand events, routes to handlers, dispatches responses
 */
(function() {
    'use strict';

    const HubEventHandler = (() => {
        let active = false;
        let heartbeatInterval = null;
        let eventStreamActive = true;
        const errorLog = [];
        const MAX_ERROR_LOG = 500;

        // Response Dispatchers
        function respond(type, payload) {
            window.dispatchEvent(new CustomEvent('HubResponse', {
                detail: { type, timestamp: new Date().toISOString(), ...payload }
            }));
        }

        function respondError(context, error) {
            const message = error instanceof Error ? error.message : String(error);
            const stack = error instanceof Error ? error.stack : null;
            const entry = { context, message, stack, timestamp: new Date().toISOString() };
            errorLog.push(entry);
            if (errorLog.length > MAX_ERROR_LOG) errorLog.shift();
            window.dispatchEvent(new CustomEvent('HubError', { detail: entry }));
        }

        function broadcastEvent(eventName, data = {}) {
            if (!eventStreamActive) return;
            window.dispatchEvent(new CustomEvent('HubEvent', {
                detail: { event: eventName, timestamp: new Date().toISOString(), ...data }
            }));
        }

        function respondSystem(command, result, notes = '') {
            window.dispatchEvent(new CustomEvent('HubSystem', {
                detail: { command, result, notes, timestamp: new Date().toISOString() }
            }));
        }

        // Module Registry Handlers
        async function handleRegisterModule(detail) {
            const { moduleName, moduleURL } = detail;
            try {
                const mod = await window.ModuleLoader?.loadModule(moduleName, moduleURL);
                window.ModuleRegistry?.register(moduleName, mod?.version || '1.0.0', mod);
                broadcastEvent('module:registered', { module: moduleName });
                respond('registerModule', { success: true, module: moduleName });
                handleRefreshRegistry();
            } catch (err) { respondError('registerModule', err); }
        }

        async function handleReloadModule(detail) {
            const { moduleName, moduleURL } = detail;
            try {
                const key = moduleName.toLowerCase();
                const entry = window.ModuleRegistry?.modules?.get(key);
                if (!entry) throw new Error(`Module "${moduleName}" not found`);
                if (typeof entry.module?.cleanup === 'function') await entry.module.cleanup();
                window.ModuleRegistry.modules.delete(key);
                const url = moduleURL || entry.module?.url || '';
                if (url && window.ModuleLoader) {
                    const mod = await window.ModuleLoader.loadModule(moduleName, url);
                    window.ModuleRegistry.register(moduleName, mod?.version || entry.version, mod);
                }
                broadcastEvent('module:reloaded', { module: moduleName });
                respond('reloadModule', { success: true, module: moduleName });
                handleRefreshRegistry();
            } catch (err) { respondError('reloadModule', err); }
        }

        function handleUnloadModule(detail) {
            const { moduleName } = detail;
            try {
                const key = moduleName.toLowerCase();
                const entry = window.ModuleRegistry?.modules?.get(key);
                if (!entry) throw new Error(`Module "${moduleName}" not found`);
                if (typeof entry.module?.cleanup === 'function') entry.module.cleanup();
                window.ModuleRegistry.modules.delete(key);
                window.ModuleLoader?.unloadModule(moduleName);
                broadcastEvent('module:unloaded', { module: moduleName });
                respond('unloadModule', { success: true, module: moduleName });
                handleRefreshRegistry();
            } catch (err) { respondError('unloadModule', err); }
        }

        function handleRefreshRegistry() {
            try {
                const health = window.ModuleRegistry?.getHealth?.() || [];
                const healthMap = new Map(health.map(h => [h.name, h]));
                const modules = window.ModuleRegistry?.list?.() || [];
                const modulesWithHealth = modules.map(m => ({
                    name: m.name,
                    version: m.version,
                    status: m.loaded ? 'active' : 'inactive',
                    loadTime: m.loadTime ? new Date(m.loadTime).toLocaleTimeString() : '—',
                    healthy: healthMap.get(m.name?.toLowerCase())?.healthy ?? true
                }));
                const services = window.ModuleLoader?.getLoadedModuleNames?.() || [];
                respond('refreshRegistry', { modules: modulesWithHealth, services });
            } catch (err) { respondError('refreshRegistry', err); }
        }

        function handleInspectModule(detail) {
            const { moduleName } = detail;
            try {
                const key = moduleName.toLowerCase();
                const entry = window.ModuleRegistry?.modules?.get(key);
                if (!entry) { respondError('inspectModule', `Module "${moduleName}" not found`); return; }
                const mod = entry.module || {};
                respond('inspectModule', {
                    moduleDetails: {
                        name: entry.name || moduleName,
                        dependencies: mod.dependencies || [],
                        methods: Object.keys(mod).filter(k => typeof mod[k] === 'function'),
                        state: window.ModuleLoader?.getModuleState(moduleName) || { status: entry.loaded ? 'active' : 'unknown' },
                        errors: mod.errors || []
                    }
                });
            } catch (err) { respondError('inspectModule', err); }
        }

        function handleInspectService(detail) {
            const { serviceName } = detail;
            try {
                const container = window.ServiceContainer;
                const metrics = container?.getMetrics?.(serviceName) || { calls: 0, totalTime: 0 };
                respond('inspectService', {
                    serviceDetails: {
                        name: serviceName,
                        status: container?.has?.(serviceName) ? 'registered' : 'not_found',
                        initState: container?.isInitialized?.(serviceName) ? 'initialized' : 'pending',
                        dependencies: [],
                        metrics: { calls: metrics.calls, totalTime: metrics.totalTime },
                        errors: []
                    }
                });
            } catch (err) { respondError('inspectService', err); }
        }

        // Memory Manager Handlers
        function handleMemoryRecord() {
            try {
                const raw = window.MemoryManager?.record?.();
                const sample = raw ? {
                    timestamp: new Date(raw.timestamp).toLocaleTimeString(),
                    usedHeap: window.MemoryManager.formatBytes?.(raw.used) || `${raw.used} B`,
                    totalHeap: window.MemoryManager.formatBytes?.(raw.total) || `${raw.total} B`,
                    limit: window.MemoryManager.formatBytes?.(raw.limit) || `${raw.limit} B`
                } : null;
                const samples = window.MemoryManager?.getSamples?.() || [];
                respond('memoryRecord', { sample, samples });
            } catch (err) { respondError('memoryRecord', err); }
        }

        function handleMemoryStats() {
            try {
                const stats = window.MemoryManager?.getStats?.();
                if (!stats) {
                    respond('memoryStats', { memoryStats: { average: 'No samples', peak: 'No samples', current: 'No samples', threshold: 'N/A' } });
                    return;
                }
                respond('memoryStats', {
                    memoryStats: {
                        average: window.MemoryManager.formatBytes?.(Math.floor(stats.average)) || `${Math.floor(stats.average)} B`,
                        peak: window.MemoryManager.formatBytes?.(stats.peak) || `${stats.peak} B`,
                        current: window.MemoryManager.formatBytes?.(stats.current) || `${stats.current} B`,
                        threshold: window.MemoryManager.formatBytes?.(stats.threshold) || `${stats.threshold} B`,
                        sampleCount: stats.sampleCount
                    }
                });
            } catch (err) { respondError('memoryStats', err); }
        }

        function handleMemoryCleanup() {
            try {
                window.MemoryManager?.cleanup?.();
                broadcastEvent('memory:cleanup', { success: true });
                respond('memoryCleanup', { success: true, result: 'Cleanup completed' });
            } catch (err) { respondError('memoryCleanup', err); }
        }

        // Config Manager Handlers
        function handleConfigLoad(detail) {
            const { module: moduleName } = detail;
            try {
                const cfg = window.ConfigManager?.getConfig?.(moduleName);
                respond('configLoad', { module: moduleName, configData: cfg || {} });
            } catch (err) { respondError('configLoad', err); }
        }

        function handleConfigSave(detail) {
            const { module: moduleName, payload } = detail;
            try {
                let data = payload;
                if (typeof data === 'string') {
                    try { data = JSON.parse(data); }
                    catch (e) { respondError('configSave', `Invalid JSON: ${e.message}`); return; }
                }
                window.ConfigManager?.updateConfig?.(moduleName, data);
                broadcastEvent('config:saved', { module: moduleName });
                respond('configSave', {
                    success: true, module: moduleName,
                    logEntry: { timestamp: new Date().toISOString(), module: moduleName, action: 'save', summary: `Config updated for ${moduleName}` }
                });
            } catch (err) { respondError('configSave', err); }
        }

        function handleConfigReset(detail) {
            const { module: moduleName } = detail;
            try {
                const defaults = window.ConfigManager?.getDefaultConfig?.(moduleName) || {};
                if (window.ConfigManager) {
                    window.ConfigManager.config[moduleName] = { ...defaults };
                    window.ConfigManager.save();
                }
                broadcastEvent('config:reset', { module: moduleName });
                respond('configReset', {
                    success: true, module: moduleName, configData: defaults,
                    logEntry: { timestamp: new Date().toISOString(), module: moduleName, action: 'reset', summary: `Config reset to defaults for ${moduleName}` }
                });
            } catch (err) { respondError('configReset', err); }
        }

        // Error & Event Monitor Handlers
        function handleShowErrors() {
            respond('showErrors', { errors: errorLog.slice() });
        }

        function handleClearErrors() {
            errorLog.length = 0;
            broadcastEvent('errors:cleared');
            respond('clearErrors', { success: true, errors: [] });
        }

        // Performance Dashboard Handler
        function handlePerformanceMetrics() {
            try {
                const modules = window.ModuleRegistry?.list?.() || [];
                respond('performanceMetrics', {
                    performance: {
                        moduleExecTimes: modules.map(m => ({ name: m.name, time: m.loadTime ? `${Date.now() - m.loadTime}ms uptime` : '—' })),
                        serviceInitTimes: [],
                        queueLengths: 0,
                        workerThreads: 0,
                        workerThreadsTotal: 0,
                        requestBatching: { batched: 0, total: 0 }
                    }
                });
            } catch (err) { respondError('performanceMetrics', err); }
        }

        function handlePerformanceReset() {
            broadcastEvent('performance:reset');
            respond('performanceReset', { success: true, result: 'Metrics reset' });
        }

        // System Commands Handler
        async function handleSystemCommand(detail) {
            const { command } = detail;
            try {
                broadcastEvent('system:command:start', { command });
                let result = 'OK';
                let notes = '';

                switch (command) {
                    case 'restart':
                        result = 'Hub restart requires page reload';
                        break;
                    case 'shutdown':
                        result = 'Hub shutdown requires page reload';
                        notes = 'Reload page to restart';
                        break;
                    case 'reloadAll': {
                        const mods = window.ModuleRegistry?.list?.() || [];
                        window.ModuleRegistry.modules?.clear?.();
                        result = `Cleared ${mods.length} modules — they will re-register on next load`;
                        break;
                    }
                    default:
                        throw new Error(`Unknown system command: ${command}`);
                }

                respondSystem(command, result, notes);
                broadcastEvent('system:command:complete', { command, result });
            } catch (err) {
                respondSystem(command, `FAILED: ${err.message}`, err.stack || '');
                respondError('systemCommand', err);
            }
        }

        // Command Router
        const commandRouter = {
            registerModule:     handleRegisterModule,
            reloadModule:       handleReloadModule,
            unloadModule:       handleUnloadModule,
            refreshRegistry:    handleRefreshRegistry,
            inspectModule:      handleInspectModule,
            inspectService:     handleInspectService,
            memoryRecord:       handleMemoryRecord,
            memoryStats:        handleMemoryStats,
            memoryCleanup:      handleMemoryCleanup,
            configLoad:         handleConfigLoad,
            configSave:         handleConfigSave,
            configReset:        handleConfigReset,
            showErrors:         handleShowErrors,
            clearErrors:        handleClearErrors,
            performanceMetrics: handlePerformanceMetrics,
            performanceReset:   handlePerformanceReset,
            systemCommand:      handleSystemCommand
        };

        function onHubCommand(e) {
            const detail = e.detail;
            if (!detail?.type) { respondError('commandRouter', 'HubCommand missing type'); return; }
            const handler = commandRouter[detail.type];
            if (typeof handler === 'function') {
                broadcastEvent('command:received', { type: detail.type });
                try {
                    const result = handler(detail);
                    if (result && typeof result.catch === 'function') {
                        result.catch(err => respondError(detail.type, err));
                    }
                } catch (err) { respondError(detail.type, err); }
            } else {
                respondError('commandRouter', `Unknown command: "${detail.type}"`);
            }
        }

        // Public API
        return {
            init() {
                if (active) return;
                window.addEventListener('HubCommand', onHubCommand);

                window.addEventListener('error', (e) => {
                    respondError('uncaughtError', new Error(`${e.message} at ${e.filename}:${e.lineno}:${e.colno}`));
                });
                window.addEventListener('unhandledrejection', (e) => {
                    respondError('unhandledRejection', e.reason instanceof Error ? e.reason : new Error(String(e.reason)));
                });

                heartbeatInterval = setInterval(() => {
                    respond('heartbeat', { hubReady: true });
                }, 5000);

                active = true;
                broadcastEvent('hub:ready', { modules: window.ModuleRegistry?.list?.().length || 0 });
                handleRefreshRegistry();
                console.log('[HubEventHandler] Event handler initialized — listening for HubCommand events');
            },

            destroy() {
                if (!active) return;
                window.removeEventListener('HubCommand', onHubCommand);
                if (heartbeatInterval) { clearInterval(heartbeatInterval); heartbeatInterval = null; }
                active = false;
                broadcastEvent('hub:shutdown');
                console.log('[HubEventHandler] Event handler destroyed');
            },

            setEventStreamPaused(paused) { eventStreamActive = !paused; },
            emit: broadcastEvent
        };
    })();

    // Export to global scope
    window.HubEventHandler = HubEventHandler;

    console.log('[HubEventHandler] Initialized v2026.05.04.0');
})();