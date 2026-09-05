// ==UserScript==
// @name         platform-adapters
// @namespace   AI-Chat-Userscript-Studio
// @version     2026.09.26.0
// @description  Platform adapters - per-platform chat adapter traits (focus/getInput/getSend/getReply/history) for 13-Chat-Platforms, driven by platform-detector
// @author       AI Chat Userscript Studio
// @match        *://*/*
// @grant        GM_log
// @grant        GM_setValue
// @grant        GM_getValue
// @run-at       document-idle
// ==/UserScript==

/**
 * Platform Adapters v1.0
 * Builds a per-platform adapter that harmonizes DOM access across chat sites.
 * Delegates to ChatGPTUtils.chatAdapter when present (00-Core/008), else falls
 * back to platform-agnostic heuristics. Registers metadata for 020 auto-discovery.
 */
(() => {
    'use strict';

    const MODULE_NAME = 'platform-adapters';
    const MODULE_VERSION = '2026.09.26.0';

    const metadata = {
        name: MODULE_NAME,
        role: 'execution',
        version: MODULE_VERSION,
        deps: ['utilities', 'hub-orchestrator', 'platform-detector'],
        category: '13-Chat-Platforms',
    };

    function isVisible(el) {
        return !!(el && (el.offsetWidth || el.offsetHeight || el.getClientRects().length));
    }
    function isInputLike(el) {
        if (!el || !(el instanceof Element)) return false;
        if (el.tagName === 'TEXTAREA') return true;
        if (el.tagName === 'INPUT') {
            const t = (el.getAttribute('type') || 'text').toLowerCase();
            return !['checkbox', 'radio', 'button', 'submit', 'file'].includes(t);
        }
        return Boolean(el.isContentEditable);
    }
    function qa(sel, root) {
        const r = root || document;
        const el = typeof r.querySelector === 'function' ? r.querySelector(sel) : null;
        return isInputLike(el) ? el : null;
    }
    function collectMessages() {
        const out = [];
        const sels = ['[data-message-author-role]', '[data-testid="conversation-turn"]', '.message', '.prose'];
        const nodes = new Set();
        for (const s of sels) {
            document.querySelectorAll(s).forEach(n => nodes.add(n));
        }
        [...nodes].sort((a, b) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) ? -1 : 1)
            .forEach(n => {
                const text = (n.innerText || n.textContent || '').trim();
                const roleEl = n.querySelector && (n.querySelector('[data-message-author-role]'));
                const role = roleEl ? roleEl.getAttribute('data-message-author-role') : (n.getAttribute && n.getAttribute('data-message-author-role')) || (n.classList && (n.classList.contains('assistant') ? 'assistant' : 'user'));
                if (text) out.push({ role: role || 'unknown', text });
            });
        return out;
    }

    function getInput() {
        const found = qa('#prompt-textarea') || qa('textarea.ProseMirror') || qa('textarea[data-testid="prompt-textarea"]') ||
            qa('[contenteditable="true"].ProseMirror') || qa('[contenteditable="true"][data-placeholder]') || null;
        return found;
    }
    function getSend() {
        return document.querySelector('button[data-testid="send-button"], button[aria-label*="Send"], button[type="submit"]');
    }
    async function getReply() {
        const items = collectMessages();
        const last = [...items].reverse().find(m => m.role === 'assistant') || items[items.length - 1];
        return last ? last.text : '';
    }
    async function sendMessage(text) {
        const input = getInput();
        if (!input) throw new Error('no composer found');
        input.focus();
        if (typeof input.value === 'string') {
            const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set;
            setter.call(input, text);
            input.dispatchEvent(new Event('input', { bubbles: true }));
        } else {
            input.textContent = text;
            input.dispatchEvent(new InputEvent('input', { bubbles: true, data: text }));
        }
        const send = getSend();
        if (send) { send.click(); return true; }
        input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
        return true;
    }

    function buildAdapter() {
        const utils = (typeof window !== 'undefined') ? window.ChatGPTUtils : null;
        if (utils && utils.chatAdapter) {
            return Object.assign({}, utils.chatAdapter, {
                adapter_source: 'utilities',
                sendMessage,
                getInput,
                getReply,
            });
        }
        return {
            adapter_source: 'heuristic',
            sendMessage,
            getInput,
            getReply,
            getConversationHistory: async () => collectMessages(),
            isVisible,
        };
    }

    function init() {
        if (typeof window === 'undefined') return;
        if (!window.__NEXUS_PLATFORMS__) window.__NEXUS_PLATFORMS__ = {};
        const adapter = buildAdapter();
        window.__NEXUS_PLATFORMS__.adapter = adapter;
        if (!window.__NEXUS_MODULES__) window.__NEXUS_MODULES__ = {};
        window.__NEXUS_MODULES__[MODULE_NAME] = { metadata, adapter, buildAdapter };
        console.log(`[${MODULE_NAME}] adapter ready (source: ${adapter.adapter_source})`);
    }

    if (typeof window !== 'undefined') {
        window.__NEXUS_ADAPTERS__ = { buildAdapter, metadata };
        init();
    }
})();