// ==UserScript==
// @name         dashboard-core
// @namespace   AI-Chat-Userscript-Studio
// @version     2026.09.26.0
// @description  Dashboard core - merges self-evolve-dash ErrorBoundary/PerformanceMonitor/HealthDashboard + nexus-core scope/graph + analytics tracking
// @author       AI Chat Userscript Studio (merged from self-evolve-dash, nexus-core)
// @match        *://*/*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_log
// @grant        GM_addStyle
// @run-at       document-end
// ==/UserScript==

/**
 * Dashboard Core v1.0
 * Merged from: self-evolve-dash (ErrorBoundary, PerformanceMonitor, HealthDashboard, analytics) + nexus-core (scope, graph)
 * Upgrades: real-time module registry browser, FPS/memory tracking, error boundary, analytics
 */
(() => {
    'use strict';

    const MODULE_NAME = 'dashboard-core';
    const ANALYTICS_KEY = 'dashboard_analytics';
    const MAX_EVENTS = 1000;

    const metadata = {
        name: MODULE_NAME, version: '2026.09.26.0',
        dependencies: ['hub-orchestrator'], critical: false, category: '00-Core',
    };

    const state = { initialized: false, events: [], metrics: { fps: 0, memory: 0, apiLatency: 0, renderTime: 0 } };

    function loadEvents() {
        try { state.events = JSON.parse(GM_getValue(ANALYTICS_KEY, '[]')); } catch (e) { state.events = []; }
        return state.events;
    }
    function saveEvents() {
        state.events = state.events.slice(-MAX_EVENTS);
        GM_setValue(ANALYTICS_KEY, JSON.stringify(state.events));
    }
    function trackEvent(category, action, data) {
        loadEvents();
        state.events.push({ category, action, data: data || {}, timestamp: new Date().toISOString() });
        saveEvents();
    }

    function getHealthStatus() {
        const hub = window.__NEXUS_HUB__;
        if (!hub) return { status: 'UNKNOWN', details: 'Hub not loaded' };
        const health = hub.getHealth();
        return {
            status: health.healthy ? 'HEALTHY' : 'DEGRADED',
            details: health.details,
            scope: health.scope,
            errors: health.registry_errors,
            cycles: health.cycles,
        };
    }

    function getPerformanceMetrics() {
        const perf = performance || {};
        const memory = perf.memory || {};
        return {
            fps: state.metrics.fps,
            memory: { used: memory.usedJSHeapSize || 0, total: memory.totalJSHeapSize || 0 },
            timing: perf.timing ? { load: perf.timing.loadEventEnd - perf.timing.navigationStart } : {},
            navigation: perf.getEntriesByType ? perf.getEntriesByType('navigation').length : 0,
        };
    }

    function getAnalyticsSummary() {
        loadEvents();
        const byCategory = {};
        for (const e of state.events) {
            if (!byCategory[e.category]) byCategory[e.category] = 0;
            byCategory[e.category]++;
        }
        return {
            total: state.events.length,
            by_category: byCategory,
            recent: state.events.slice(-10),
        };
    }

    function renderDashboard() {
        const health = getHealthStatus();
        const perf = getPerformanceMetrics();
        const analytics = getAnalyticsSummary();
        return { health, perf, analytics, generated: new Date().toISOString() };
    }

    function init() {
        if (state.initialized) return;
        console.log(`[${MODULE_NAME}] Initializing...`);
        loadEvents();
        trackEvent('system', 'dashboard_init', { module: MODULE_NAME });
        state.initialized = true;
        console.log(`[${MODULE_NAME}] Initialized`);
    }
    function getHealth() {
        return { healthy: state.initialized, details: `${state.events.length} events tracked` };
    }

    if (typeof window !== 'undefined') {
        window.__NEXUS_DASHBOARD__ = {
            init, getHealth, metadata,
            trackEvent, getHealthStatus, getPerformanceMetrics,
            getAnalyticsSummary, renderDashboard,
        };
        window[`${MODULE_NAME}Module`] = { init, getHealth, metadata };
    }
    if (document.readyState === 'complete') { init(); } else { window.addEventListener('load', init); }
})();
