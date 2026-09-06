// ==UserScript==
// @name         integrations-hub
// @namespace   AI-Chat-Userscript-Studio
// @version     2026.09.26.1
// @description  Integrations hub: GitHub, Discord, Email, Calendar (ROADMAP 241-260)
// @author       AI Chat Userscript Studio
// @match        *://*/*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_log
// @grant        GM_xmlhttpRequest
// @run-at       document-end
// ==/UserScript==

/**
 * Integrations Hub v1.0 — ROADMAP items 241-260
 */
(() => {
    'use strict';
    const MODULE_NAME = 'integrations-hub';
    const CONFIG_KEY = 'integrations_hub_config';
    const metadata = { name: MODULE_NAME, version: '2026.09.26.1', dependencies: [], critical: false, category: '00-Core' };
    const state = { initialized: false, configs: {} };

    function load() { try { state.configs = JSON.parse(GM_getValue(CONFIG_KEY, '{}')); } catch (e) { state.configs = {}; } }
    function save() { try { GM_setValue(CONFIG_KEY, JSON.stringify(state.configs)); } catch (e) {} }
    function httpRequest(url, method, headers, body) {
        return new Promise((resolve, reject) => {
            if (typeof GM_xmlhttpRequest === 'undefined') { reject(new Error('GM_xmlhttpRequest unavailable')); return; }
            GM_xmlhttpRequest({ method: method || 'GET', url, headers: headers || {}, data: body, onload: (r) => resolve({ status: r.status, body: r.responseText }), onerror: (e) => reject(e) });
        });
    }

    // GitHub (241)
    function configureGitHub(token, owner, repo) { state.configs.github = { token, owner, repo, configured_at: new Date().toISOString() }; save(); return state.configs.github; }
    async function createGitHubIssue(title, body) { const c = state.configs.github; if (!c?.token) throw new Error('GitHub not configured'); return httpRequest(`https://api.github.com/repos/${c.owner}/${c.repo}/issues`, 'POST', { Authorization: 'token ' + c.token, 'Content-Type': 'application/json' }, JSON.stringify({ title, body })); }
    async function getGitHubIssues(st) { const c = state.configs.github; if (!c?.token) throw new Error('GitHub not configured'); return httpRequest(`https://api.github.com/repos/${c.owner}/${c.repo}/issues?state=${st||'open'}`, 'GET', { Authorization: 'token ' + c.token }); }

    // Discord (250)
    function configureDiscord(webhookUrl) { state.configs.discord = { webhookUrl, configured_at: new Date().toISOString() }; save(); return state.configs.discord; }
    async function sendDiscordMessage(content, username) { const c = state.configs.discord; if (!c?.webhookUrl) throw new Error('Discord not configured'); return httpRequest(c.webhookUrl, 'POST', { 'Content-Type': 'application/json' }, JSON.stringify({ content: String(content).slice(0, 2000), username: username || 'AI Assistant' })); }

    // Email (255)
    function configureEmail(url, key) { state.configs.email = { url, key, configured_at: new Date().toISOString() }; save(); return state.configs.email; }
    async function sendEmail(to, subject, body) { const c = state.configs.email; if (!c?.url) throw new Error('Email not configured'); return httpRequest(c.url, 'POST', { Authorization: 'Bearer ' + (c.key||''), 'Content-Type': 'application/json' }, JSON.stringify({ to, subject, body: String(body).slice(0, 10000) })); }

    // Calendar (256)
    function configureCalendar(url, key) { state.configs.calendar = { url, key, configured_at: new Date().toISOString() }; save(); return state.configs.calendar; }
    async function createCalendarEvent(title, start, end, desc) { const c = state.configs.calendar; if (!c?.url) throw new Error('Calendar not configured'); return httpRequest(c.url, 'POST', { Authorization: 'Bearer ' + (c.key||''), 'Content-Type': 'application/json' }, JSON.stringify({ title, start, end, description: String(desc).slice(0,1000) })); }

    // Generic webhooks (242-249, 251-254, 257-260)
    function configureWebhook(name, url, headers) { if (!state.configs.webhooks) state.configs.webhooks = {}; state.configs.webhooks[name] = { url, headers: headers||{}, configured_at: new Date().toISOString() }; save(); return state.configs.webhooks[name]; }
    async function triggerWebhook(name, payload) { const wh = state.configs.webhooks?.[name]; if (!wh) throw new Error(`Webhook '${name}' not configured`); return httpRequest(wh.url, 'POST', { 'Content-Type': 'application/json', ...(wh.headers||{}) }, JSON.stringify(payload)); }
    function listWebhooks() { return { ...(state.configs.webhooks || {}) }; }

    function init() { if (state.initialized) return; load(); state.initialized = true; console.log(`[${MODULE_NAME}] Initialized`); }
    function getHealth() { return { healthy: state.initialized, details: `${Object.keys(state.configs).length} configs` }; }

    if (typeof window !== 'undefined') {
        window.__NEXUS_INTEGRATIONS__ = { init, getHealth, metadata, configureGitHub, createGitHubIssue, getGitHubIssues, configureDiscord, sendDiscordMessage, configureEmail, sendEmail, configureCalendar, createCalendarEvent, configureWebhook, triggerWebhook, listWebhooks };
        window[`${MODULE_NAME}Module`] = { init, getHealth, metadata };
    }
    if (document.readyState === 'complete') { init(); } else { window.addEventListener('load', init); }
})();
