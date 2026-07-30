// ==UserScript==
// @name         Custom Instruction Profiles
// @version      2026.06.26.3
// @description  AI Chat Userscript Suite - Module 19: Custom Instruction Profiles
// @author       AI Chat Userscript Studio
// @match        https://chat.openai.com/*
// @match        https://chatgpt.com/*
// @match        https://claude.ai/*
// @match        https://poe.com/*
// @match        https://www.perplexity.ai/*
// @match        https://perplexity.ai/*
// @match        https://pi.ai/*
// @match        https://you.com/*
// @match        https://gemini.google.com/*
// @match        https://aistudio.google.com/*
// @match        https://copilot.microsoft.com/*
// @match        https://chat.mistral.ai/*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_log
// @run-at       document-idle
// ==/UserScript==

var MODULE_ID = 'module-' + 19;
var MODULE_NAME = 'Custom Instruction Profiles';

(function() {
    'use strict';

    // Module namespace
    window[MODULE_ID] = window[MODULE_ID] || {};

    // Initialization
    var module = window[MODULE_ID];
    module.id = MODULE_ID;
    module.name = MODULE_NAME;
    module.version = '2026.06.26.3';

    if (typeof GM_setValue !== 'undefined') {
        GM_setValue(MODULE_ID + '_loaded', 'true');
    }

    // Auto-initialize
    try {
        if (typeof module.init === 'function') {
            module.init();
        }
    } catch (e) {
        console.warn('[' + MODULE_ID + '] init failed:', e);
    }

    console.log('[' + MODULE_ID + '] ' + MODULE_NAME + ' loaded');
})();
