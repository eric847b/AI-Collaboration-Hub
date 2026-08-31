// ==UserScript==
// @name         Cost Advisor (Go / No-Go)
// @namespace    http://tampermonkey.net/
// @version      2026.08.27.1
// @description  Turns the suite's daily accounts into a plain pre-send decision: GO / HOLD / SWITCH / STOP. Reads the Quota Guard + Supreme Court live totals and predicts whether the next prompt fits today's budget. Press Ctrl+Alt+G to pull current advice.
// @author       Eric + Cline
// @license      MIT
// @match        *://*/*
// @include      *
// @grant        none
// @run-at       document-idle
// ==/UserScript==
(function () {
  'use strict';
  var W = window, D = document;
  var ID = '25-cost-advisor';
  var VER = '2026.08.27.1';
  var DEFAULT_BUDGET = 60000;
  var DEFAULT_PROMPT_TOKENS = 240;

  /* ---- pure decision core (unit-testable, no DOM) ---- */
  function advice(input) {
    input = input || {};
    var pct = Number(input.pctUsed) || 0;
    var budget = Number(input.budget) || DEFAULT_BUDGET;
    var promptTokens = Number(input.promptTokens) || DEFAULT_PROMPT_TOKENS;
    var savedTokens = Number(input.savedTokens) || 0;
    var asking = !!input.asking;

    var headroom = 100 - pct + (savedTokens / budget * 100);
    var predicted = pct + (promptTokens / budget * 100);

    if (pct >= 100) return { action: 'stop', tier: 4, msg: '⛔ Budget exhausted — stop sending today.' };
    if (predicted >= 100) return { action: 'switch', tier: 3, msg: "This prompt would exceed today's budget — switch to a cheaper/free tool or trim hard." };
    if (headroom <= 10) return { action: 'hold', tier: 2, msg: '≈' + Math.round(pct) + '% used — savings nearly spent; hold or compress aggressively.' };
    if (pct >= 90) {
      // at/over 90% the savings credit decides: enough headroom → compress (advise), else hold
      return { action: 'advise', tier: 2, msg: '≥90% used — compress now; you still have ~' + Math.round(headroom) + '% credit left.' };
    }
    if (pct >= 75) return { action: 'advise', tier: 1, msg: '≥75% used — compress this prompt before sending.' };
    return { action: 'go', tier: 0, msg: 'GO — you have ' + Math.round(headroom) + '% headroom left today.' };
  }

  /* ---- gather live state from sibling accounts (optional) ---- */
  function pull() {
    var st = { pctUsed: null, budget: DEFAULT_BUDGET, promptTokens: DEFAULT_PROMPT_TOKENS, savedTokens: 0 };
    try { if (W.tqg_api && W.tqg_api.stats) { var s = W.tqg_api.stats(); st.pctUsed = s.pctUsed; st.budget = s.budget; } } catch (e) {}
    try { if (W.sc_api && W.sc_api.totals) { var t = W.sc_api.totals(); st.savedTokens = (t.inputSaved || 0) + (t.outputSaved || 0); } } catch (e) {}
    return st;
  }
  function toast(msg) {
    try {
      var t = D.createElement('div');
      t.textContent = msg;
      t.style.cssText = 'position:fixed;top:16px;right:16px;z-index:2147483647;background:#111827;color:#f9fafb;padding:10px 14px;border-radius:8px;font:13px system-ui;box-shadow:0 4px 16px rgba(0,0,0,.35);max-width:360px';
      (D.body || D.documentElement).appendChild(t);
      setTimeout(function () { t.remove(); }, 5000);
    } catch (e) {}
  }
  function advise(asking) {
    var st = pull(); st.asking = asking;
    var a = advice(st);
    toast((asking ? 'Advisor: ' : '') + a.msg);
    return a;
  }

  function defineApi() {
    W.advice_api = {
      decide: advice,
      advice: { decide: advice, current: function (asking) { return advise(!!asking); } },
      stats: pull,
      getConfig: function () { return { defaultBudget: DEFAULT_BUDGET, defaultPromptTokens: DEFAULT_PROMPT_TOKENS }; }
    };
    W.__advisor_internals = { advice: advice, pull: pull, advise: advise };
  }
  function init() {
    try { defineApi(); } catch (e) {}
    W.addEventListener('keydown', function (e) {
      if (e.ctrlKey && e.altKey && (e.key || '').toLowerCase() === 'g') { e.preventDefault(); advise(true); }
    }, true);
    console.log('[' + ID + '] v' + VER + ' ready. API window.advice_api');
    return true;
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();