// ==UserScript==
// @name         platform-detector
// @namespace   AI-Chat-Userscript-Studio
// @version     2026.09.26.0
// @description  Chat platform detector - maps hostname to platform id + capability traits for 13-Chat-Platforms adapters; feeds registry via __NEXUS_MODULES__
// @author       AI Chat Userscript Studio
// @match        *://*/*
// @grant        GM_log
// @grant        GM_setValue
// @grant        GM_getValue
// @run-at       document-idle
// ==/UserScript==

/**
 * Chat Platform Detector v1.0
 * Detects the current chat platform from hostname and exposes:
 *   window.__NEXUS_PLATFORMS__.detect() -> { id, host, isSupported, caps }
 * Also registers metadata into the global module map so 020-module-registry
 * auto-discovery (scanExisting + discoverFromGlobals) picks it up.
 */
(() => {
    'use strict';

    const MODULE_NAME = 'platform-detector';
    const MODULE_VERSION = '2026.09.26.0';

    const metadata = {
        name: MODULE_NAME,
        role: 'coordination',
        version: MODULE_VERSION,
        deps: ['utilities', 'hub-orchestrator'],
        category: '13-Chat-Platforms',
    };

    const PLATFORMS = [
        { id: 'chatgpt',    hosts: ['chatgpt.com', 'chat.openai.com'],                                   caps: ['composer', 'markdown', 'image-gen', 'file-upload', 'code-interpreter'] },
        { id: 'claude',     hosts: ['claude.ai'],                                                       caps: ['composer', 'markdown', 'file-upload', 'artifacts'] },
        { id: 'gemini',     hosts: ['gemini.google.com'],                                               caps: ['composer', 'file-upload', 'image-gen', 'search'] },
        { id: 'aistudio',   hosts: ['aistudio.google.com'],                                             caps: ['composer', 'code', 'file-upload'] },
        { id: 'copilot',    hosts: ['copilot.microsoft.com'],                                           caps: ['composer', 'code'] },
        { id: 'perplexity', hosts: ['perplexity.ai', 'www.perplexity.ai'],                              caps: ['composer', 'web-search', 'file-upload'] },
        { id: 'poe',        hosts: ['poe.com'],                                                         caps: ['composer', 'multi-model'] },
        { id: 'pi',        hosts: ['pi.ai'],                                                           caps: ['composer' ] },
        { id: 'you',       hosts: ['you.com'],                                                        caps: ['composer', 'web-search'] },
        { id: 'mistral',    hosts: ['chat.mistral.ai'],                                                 caps: ['composer', 'code'] },
        { id: 'openrouter', hosts: ['openrouter.ai'],                                                   caps: ['composer', 'multi-model'] },
    ];

    function detect() {
        const host = (typeof location !== 'undefined') ? location.hostname.toLowerCase() : '';
        const match = PLATFORMS.find(p => p.hosts.includes(host));
        return Object.freeze({
            id: match ? match.id : 'unknown',
            host,
            isSupported: Boolean(match),
            caps: match ? match.caps : [],
        });
    }

    function initDetector() {
        const d = detect();
        if (typeof window !== 'undefined') {
            if (!window.__NEXUS_PLATFORMS__) window.__NEXUS_PLATFORMS__ = {};
            window.__NEXUS_PLATFORMS__.detect = detect;
            window.__NEXUS_PLATFORMS__ = {
                detect,
                current: d,
                platforms: PLATFORMS,
                metadata,
            };
            if (!window.__NEXUS_MODULES__) window.__NEXUS_MODULES__ = {};
            window.__NEXUS_MODULES__[MODULE_NAME] = { metadata, detect, getCurrent: () => detect() };
        }
        console.log(`[${MODULE_NAME}] detected platform: ${d.id} (${d.host})`);
        return d;
    }

    if (typeof window !== 'undefined') initDetector();
})();