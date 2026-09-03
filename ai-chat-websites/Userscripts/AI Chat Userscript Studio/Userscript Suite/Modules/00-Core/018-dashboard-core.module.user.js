// ==UserScript==
// @name         dashboard-core
// @namespace   AI-Chat-Userscript-Studio
// @version     2026.09.26.1
// @description  Dashboard core - live health/registry/failure dashboard wired to hub-orchestrator, module-registry, failure-recovery, evolution + FPS/memory + analytics + catalyst trigger
// @author       AI Chat Userscript Studio (merged from self-evolve-dash, nexus-core)
// @match        *://*/*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_log
// @grant        GM_addStyle
// @grant        GM_registerMenuCommand
// @run-at       document-end
// ==/UserScript==

/**
 * Dashboard Core v1.1 — WIRED
 * Merged from: self-evolve-dash (PerformanceMonitor, HealthDashboard, analytics) + nexus-core (scope, graph)
 * Upgrades: live panels fed by __NEXUS_HUB__ / __NEXUS_REGISTRY__ / __NEXUS_FAILURE__ /
 * __NEXUS_EVOLUTION__ / __NEXUS_CONSENSUS__; runCatalyst() trigger; draggable persistable panel;
 * FPS meter that only samples while open; module status grid with per-module health.
 */
(() => {
    'use strict';

    const MODULE_NAME = 'dashboard-core';
    const ANALYTICS_KEY = 'dashboard_analytics';
    const POS_KEY = 'dashboard_panel_pos';
    const MAX_EVENTS = 1000;

    const metadata = {
        name: MODULE_NAME, version: '2026.09.26.1',
        dependencies: ['hub-orchestrator'], critical: false, category: '00-Core',
    };

    const state = {
        initialized: false, events: [],
        metrics: { fps: 0, memory: 0, apiLatency: 0, renderTime: 0 },
        panel: null, open: false, rafId: 0, refreshTimer: 0, frames: 0, lastFpsAt: 0,
    };

    // ─── Analytics ──────────────────────────────────────────────────────────
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
    function getAnalyticsSummary() {
        loadEvents();
        const byCategory = {};
        for (const e of state.events) byCategory[e.category] = (byCategory[e.category] || 0) + 1;
        return { total: state.events.length, by_category: byCategory, recent: state.events.slice(-10) };
    }

    // ─── Sibling access (soft deps — all guarded) ───────────────────────────
    function sibling(ns) { try { return window[ns] || null; } catch (e) { return null; } }

    function collectSnapshot() {
        const hub = sibling('__NEXUS_HUB__');
        const reg = sibling('__NEXUS_REGISTRY__');
        const fail = sibling('__NEXUS_FAILURE__');
        const snap = { generated: new Date().toISOString(), hub: null, registry: null, failures: [], siblings: {}, perf: getPerformanceMetrics(), analytics: getAnalyticsSummary() };
        if (hub) { try { snap.hub = hub.getHealth(); } catch (e) { snap.hub = { healthy: false, details: 'error: ' + e.message }; } }
        if (reg) {
            try {
                const v = reg.validate();
                snap.registry = { stats: reg.getStats(), valid: v.valid, errors: v.errors };
            } catch (e) { snap.registry = { error: e.message }; }
        }
        if (fail) { try { snap.failures = fail.getFailureSummary(); } catch (e) { /* non-fatal */ } }
        const nsMap = {
            hub: '__NEXUS_HUB__', registry: '__NEXUS_REGISTRY__', failure: '__NEXUS_FAILURE__',
            evolution: '__NEXUS_EVOLUTION__', consensus: '__NEXUS_CONSENSUS__',
        };
        for (const [label, ns] of Object.entries(nsMap)) {
            const m = sibling(ns);
            snap.siblings[label] = m
                ? (typeof m.getHealth === 'function' ? m.getHealth() : { healthy: true, details: 'loaded' })
                : { healthy: null, details: 'not loaded' };
        }
        return snap;
    }

    // ─── Performance ────────────────────────────────────────────────────────
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
    function fpsLoop(ts) {
        if (!state.open) { state.rafId = 0; return; }
        state.frames++;
        if (!state.lastFpsAt) state.lastFpsAt = ts;
        if (ts - state.lastFpsAt >= 1000) {
            state.metrics.fps = Math.round((state.frames * 1000) / (ts - state.lastFpsAt));
            state.frames = 0; state.lastFpsAt = ts;
        }
        state.rafId = requestAnimationFrame(fpsLoop);
    }
    function startFps() { if (!state.rafId) { state.frames = 0; state.lastFpsAt = 0; state.rafId = requestAnimationFrame(fpsLoop); } }
    function stopFps() { if (state.rafId) { cancelAnimationFrame(state.rafId); state.rafId = 0; } }

    function getHealthStatus() {
        const hub = sibling('__NEXUS_HUB__');
        if (!hub) return { status: 'UNKNOWN', details: 'Hub not loaded' };
        const health = hub.getHealth();
        return {
            status: health.healthy ? 'HEALTHY' : 'DEGRADED',
            details: health.details, scope: health.scope,
            errors: health.registry_errors, cycles: health.cycles,
        };
    }

    function renderDashboard() {
        const snap = collectSnapshot();
        snap.health = getHealthStatus();
        return snap;
    }

    // ─── Live panel ─────────────────────────────────────────────────────────
    function buildPanel() {
        if (state.panel) return state.panel;
        const p = document.createElement('div');
        p.id = 'nexus-dashboard-core';
        p.setAttribute('style', [
            'position:fixed', 'top:12px', 'right:12px', 'z-index:2147483646',
            'width:340px', 'max-height:70vh', 'overflow:auto',
            'background:#0f1117', 'color:#d7dae0', 'border:1px solid #2b3140',
            'border-radius:8px', 'font:12px/1.45 ui-monospace,Consolas,monospace',
            'box-shadow:0 6px 24px rgba(0,0,0,.45)', 'display:none', 'padding:10px 12px',
        ].join(';'));
        p.innerHTML = [
            '<div id="nx-dash-head" style="display:flex;justify-content:space-between;align-items:center;cursor:move;user-select:none">',
            '  <b style="color:#7aa2f7">⬢ Nexus Dashboard</b>',
            '  <span><button data-act="catalyst" title="Run catalyst cycle" style="margin-right:6px">⚡</button>',
            '  <button data-act="close" style="cursor:pointer">✕</button></span>',
            '</div>',
            '<div id="nx-dash-body" style="margin-top:8px;white-space:pre-wrap">…</div>',
        ].join('\n');
        document.body.appendChild(p);

        p.querySelector('[data-act="close"]').addEventListener('click', () => togglePanel(false));
        p.querySelector('[data-act="catalyst"]').addEventListener('click', () => {
            const hub = sibling('__NEXUS_HUB__');
            trackEvent('dashboard', 'catalyst_trigger');
            if (hub && typeof hub.runCatalyst === 'function') {
                try { const r = hub.runCatalyst(); flash('Catalyst: ' + JSON.stringify(r).slice(0, 120)); }
                catch (e) { flash('Catalyst error: ' + e.message); }
            } else flash('Hub has no runCatalyst()');
        });
        makeDraggable(p, p.querySelector('#nx-dash-head'));
        state.panel = p;
        return p;
    }

    function flash(msg) {
        const body = state.panel && state.panel.querySelector('#nx-dash-body');
        if (body) body.textContent = '⚡ ' + msg;
        refresh();
    }

    function makeDraggable(p, handle) {
        let sx = 0, sy = 0, ox = 0, oy = 0, dragging = false;
        handle.addEventListener('mousedown', (e) => {
            dragging = true; sx = e.clientX; sy = e.clientY;
            const r = p.getBoundingClientRect(); ox = r.left; oy = r.top; e.preventDefault();
        });
        window.addEventListener('mousemove', (e) => {
            if (!dragging) return;
            p.style.left = Math.max(0, ox + e.clientX - sx) + 'px';
            p.style.top = Math.max(0, oy + e.clientY - sy) + 'px';
            p.style.right = 'auto';
        });
        window.addEventListener('mouseup', () => {
            if (!dragging) return;
            dragging = false;
            try { GM_setValue(POS_KEY, JSON.stringify({ left: p.style.left, top: p.style.top })); } catch (e) { /* ok */ }
        });
        try {
            const saved = JSON.parse(GM_getValue(POS_KEY, 'null'));
            if (saved && saved.left) { p.style.left = saved.left; p.style.top = saved.top; p.style.right = 'auto'; }
        } catch (e) { /* ok */ }
    }

    function render() {
        if (!state.panel || !state.open) return;
        const snap = renderDashboard(); // collectSnapshot + hub health
        const h = snap.health || {};
        const dot = h.status === 'HEALTHY' ? '🟢' : h.status === 'DEGRADED' ? '🟠' : '⚪';
        const sib = Object.entries(snap.siblings || {})
            .map(([k, v]) => `${v.healthy === true ? '🟢' : v.healthy === false ? '🔴' : '⚪'} ${k}`)
            .join('\n');
        const reg = snap.registry && snap.registry.stats
            ? `modules=${snap.registry.stats.total} valid=${snap.registry.valid}` : 'registry not loaded';
        const fails = Array.isArray(snap.failures)
            ? snap.failures.slice(0, 5).map(f => `• ${f.type || f.failure_type || '?'} ×${f.count || 1}`).join('\n') : '';
        state.panel.querySelector('#nx-dash-body').textContent = [
            `${dot} hub: ${h.status || 'UNKNOWN'} — ${h.details || ''}`,
            reg,
            `fps=${snap.perf.fps}  mem=${Math.round(snap.perf.memory.used / 1048576)}MB`,
            `events=${snap.analytics.total}`,
            '', '— siblings —', sib,
            fails ? '\n— recent failures —\n' + fails : '',
        ].join('\n');
    }

    function refresh() {
        clearInterval(state.refreshTimer);
        state.refreshTimer = setInterval(render, 2000);
        render();
    }

    function togglePanel(open) {
        state.open = open;
        const p = buildPanel();
        p.style.display = open ? 'block' : 'none';
        if (open) { startFps(); refresh(); trackEvent('dashboard', 'open'); }
        else { stopFps(); clearInterval(state.refreshTimer); }
    }

    // ─── Lifecycle ──────────────────────────────────────────────────────────
    function init() {
        if (state.initialized) return;
        state.initialized = true;
        loadEvents();
        trackEvent('dashboard', 'init');
        try { GM_registerMenuCommand('Toggle Nexus Dashboard', () => togglePanel(!state.open)); } catch (e) { /* ok */ }
        // Auto-open once per page when hub already healthy
        setTimeout(() => { const hub = sibling('__NEXUS_HUB__'); if (hub) { try { if (hub.getHealth().healthy) togglePanel(true); } catch (e) { /* ok */ } } }, 1500);
    }
    function shutdown() {
        stopFps(); clearInterval(state.refreshTimer);
        if (state.panel) { state.panel.remove(); state.panel = null; }
        state.initialized = false;
    }

    init();
})();
