// ==UserScript==
// @name         Universal Site Adapter
// @namespace    http://tampermonkey.net/
// @version      2026.08.27.1
// @description  UniversalSite runtime - heuristically locates the page's primary text input, send button, and scrollable content surface on ANY website so modules work generically instead of targeting one chat AI site.
// @author       AI RMD
// @license      MIT
// @match        *://*/*
// @include      *
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';

  var ADAPTER_NAME = 'UniversalSite';
  var ADAPTER_VERSION = '2026.08.27.1';
  if (window[ADAPTER_NAME]) {
    return; // already installed on this page
  }

  /**
   * Detect the most likely "page kind" using robust heuristics that work on any site.
   * Returns a keyed descriptor rather than assuming a single chat vendor.
   */
  function detectPageKind() {
    var host = String(window.location.hostname || '').toLowerCase();
    var path = String(window.location.pathname || '');
    var isChatDomain = /(chatgpt|openai|claude|poe|perplexity|pi\.ai|you\.com|gemini|aistudio|copilot|mistral|phind|blackbox|duck\.ai)/.test(host);
    var hasChatInput = false;

    // A plausible chat surface: a real (visible, non-hidden) textarea/contenteditable
    // paired nearby with a "send"-like button.
    try {
      var inputs = document.querySelectorAll('textarea, [contenteditable="true"], [contenteditable="plaintext-only"]');
      for (var i = 0; i < inputs.length; i++) {
        var el = inputs[i];
        var r = el.getBoundingClientRect && el.getBoundingClientRect();
        if (el.offsetWidth > 60 && el.offsetHeight > 20 && r && r.width > 0 && r.height > 0) {
          hasChatInput = true;
          break;
        }
      }
    } catch (e) { /* ignore */ }

    var kind = 'generic';
    if (isChatDomain && hasChatInput) kind = 'chat';
    else if (isChatDomain) kind = 'chat-domain';
    else if (hasChatInput) kind = 'chat-like';

    return {
      host: host,
      path: path,
      isChatDomain: isChatDomain,
      hasChatInput: hasChatInput,
      kind: kind,
      url: window.location.href
    };
  }

  /**
   * Locate the primary text entry surface (textarea or contenteditable) on any page.
   * Prefers the largest visible textarea/editor, else the largest visible textarea.
   */
  function findInput(desc) {
    var selectors = [
      'textarea[placeholder]',
      'textarea',
      '[contenteditable="true"]',
      '[contenteditable="plaintext-only"]',
      'input[type="text"]',
      'input[type="search"]'
    ];
    var maxScore = -1;
    var best = null;

    try {
      for (var s = 0; s < selectors.length; s++) {
        var nodes = document.querySelectorAll(selectors[s]);
        for (var i = 0; i < nodes.length; i++) {
          var el = nodes[i];
          if (el.offsetWidth < 60 || el.offsetHeight < 16) continue;
          var area = el.offsetWidth * el.offsetHeight;
          var score = area + (el.tagName === 'TEXTAREA' || el.isContentEditable ? 10000 : 0);
          if (score > maxScore) {
            maxScore = score;
            best = el;
          }
        }
      }
    } catch (e) { /* ignore */ }

    return best;
  }

  /**
   * Heuristically find a "send" / submit button near the given input.
   */
  function findSendButton(input) {
    if (!input) return null;
    var candidates = ['button[type="submit"]', 'button[aria-label*="send" i]', 'button[title*="send" i]', '[role="button"][aria-label*="send" i]'];
    try {
      for (var c = 0; c < candidates.length; c++) {
        var found = document.querySelector(candidates[c]);
        if (found) return found;
      }
    } catch (e) { /* ignore */ }
    return null;
  }

  /**
   * Find the main scrollable content container (the "messages" region on chat sites,
   * or the page's main scroll element on any site).
   */
  function findScrollable() {
    var candidates = Array.prototype.slice.call(document.querySelectorAll('main, [role="main"], article, .overflow-y-auto, [data-testid]'));
    var best = null;
    var bestHeight = 0;
    try {
      for (var i = 0; i < candidates.length; i++) {
        var el = candidates[i];
        var h = el.scrollHeight || 0;
        if (h > bestHeight) {
          bestHeight = h;
          best = el;
        }
      }
    } catch (e) { /* ignore */ }
    return best || (document.scrollingElement || document.documentElement);
  }

  var desc = detectPageKind();
  var input = findInput(desc);
  var api = {
    name: ADAPTER_NAME,
    version: ADAPTER_VERSION,
    page: desc,
    kind: desc.kind,
    isChatLike: function () { return desc.kind !== 'generic'; },
    getInput: function () { return input; },
    getSendButton: function () { return findSendButton(input); },
    getScrollable: function () { return findScrollable(); },
    detect: detectPageKind,
    refresh: function () { desc = detectPageKind(); input = findInput(desc); return desc; }
  };

  window.UniversalSite = api;
  window.UniverSalSiteAdapter = api;
  console.log('[UniversalSite] page kind = ' + desc.kind + ' (host=' + desc.host + ', hasChatInput=' + desc.hasChatInput + ')');
})();
