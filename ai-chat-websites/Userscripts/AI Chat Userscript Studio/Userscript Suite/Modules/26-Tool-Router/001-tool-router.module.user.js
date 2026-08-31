// ==UserScript==
// @name         Tool Router (Cheapest Fit)
// @namespace    http://tampermonkey.net/
// @version      2026.08.27.1
// @description  When the Cost Advisor says SWITCH, names WHICH free/cheap AI tool still has budget. Reads daily spend plus free-tier rollovers, computes remaining capacity per provider, and routes the next prompt to the best fit. Ctrl+Alt+R to route.
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
  var ID = '26-tool-router';
  var VER = '2026.08.27.1';
  var DAY = 864e5;
  function todayKey() {
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  /* ---- built-in provider catalog (free-tier aware) ---- */
  // capacity :: estimated free daily tokens (or null = generous); priority lower = preferred
  var CATALOG = [
    { id: 'chatgpt', name: 'ChatGPT', host: 'chatgpt.com', capacity: 60000, notes: 'generous FREE tier' },
    { id: 'claude',  name: 'Claude',  host: 'claude.ai',  capacity: 60000, notes: 'good for prose/deep dives' },
    { id: 'gemini',  name: 'Gemini',  host: 'gemini.google.com', capacity: 90000, notes: 'large FREE window' },
    { id: 'copilot', name: 'Copilot', host: 'copilot.microsoft.com', capacity: 70000, notes: 'code-focused' },
    { id: 'mistral', name: 'Mistral', host: 'chat.mistral.ai', capacity: 80000, notes: 'developer-friendly FREE tier' }
  ];
  /* ---- per-provider spend ledger (localStorage) ---- */
  function loadDay(id) {
    try { return JSON.parse(W.localStorage.getItem(ID + ':' + id + ':' + todayKey())) || { used: 0 }; } catch (e) { return { used: 0 }; }
  }
  function saveDay(id, d) {
    try { W.localStorage.setItem(ID + ':' + id + ':' + todayKey(), JSON.stringify(d)); } catch (e) {}
  }

  /* ---- pure decision core: pick the cheapest provider that still fits ---- */
  function route(input) {
    input = input || {};
    var promptTokens = Number(input.promptTokens) || 240;
    var used = input.used || {};              // { providerId : tokens-used-today }
    var minFree = Number(input.minFree) || 0; // 0 = just needs headroom; >0 = require this much left
    var budget = Number(input.budget) || 0;   // 0 = ignore absolute cap, use each provider's capacity
    var best = null;
    for (var i = 0; i < CATALOG.length; i++) {
      var c = CATALOG[i];
      var usedT = used[c.id] || 0;
      var left = c.capacity - usedT;
      if (left - promptTokens < minFree) continue;       // can't fit + keep reserve
      if (budget > 0 && left < budget) continue;          // explicit leftover budget gate
      if (!best || c.capacity < best.capacity) {          // cheapest provider with headroom
        best = { id: c.id, name: c.name, host: c.host, notes: c.notes, left: left, used: usedT, capacity: c.capacity };
      }
    }
    if (!best) {
      // every provider is tapped out
      return {
        ok: false,
        msg: '⛔ ALL providers tapped for today — come back tomorrow / use offline tools.'
      };
    }
    return {
      ok: true,
      to: best,
      msg: '→ Best fit: ' + best.name + ' (~' + best.left + ' tok left for today) — ' + best.notes,
    };
  }

  /* ---- live integration: pull advisor state + route ---- */
  function pullAdvisor() {
    var st = { pctUsed: null, budget: null, savedTokens: 0 };
    try { var s = W.tqg_api && W.tqg_api.stats(); if (s) { st.pctUsed = s.pctUsed; st.budget = s.budget; } } catch (e) {}
    try { var t = W.sc_api && W.sc_api.totals(); if (t) { st.savedTokens = (t.inputSaved || 0) + (t.outputSaved || 0); } } catch (e) {}
    return st;
  }
  function adviseRouter(asking) {
    var st = pullAdvisor();
    var used = {};
    for (var i = 0; i < CATALOG.length; i++) used[CATALOG[i].id] = loadDay(CATALOG[i].id).used;
    var r = route({ promptTokens: 240, used: used });
    toast((asking ? 'Router: ' : '') + r.msg);
    return r;
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

  function defineApi() {
    W.router_api = {
      route: route,
      catalog: function () { return CATALOG.map(function (c) { return { id: c.id, name: c.name, host: c.host, capacity: c.capacity }; }); },
      charge: function (id, tokens) {
        for (var i = 0; i < CATALOG.length; i++) if (CATALOG[i].id === id) {
          var d = loadDay(id); d.used += tokens; saveDay(id, d); return d;
        }
        return null;
      },
      reset: function (id) { if (id) { saveDay(id, { used: 0 }); return true; } return false; }
    };
    W.__router_internals = { route: route, loadDay: loadDay, saveDay: saveDay, CATALOG: CATALOG, advise: adviseRouter, pullAdvisor: pullAdvisor };
  }
  function init() {
    try { defineApi(); } catch (e) {}
    W.addEventListener('keydown', function (e) {
      if (e.ctrlKey && e.altKey && (e.key || '').toLowerCase() === 'r') { e.preventDefault(); adviseRouter(true); }
    }, true);
    W.__ROUTER_GUARD = function () { return { run: true, genericSafe: true }; };
    console.log('[' + ID + '] v' + VER + ' ready. API window.router_api');
    return true;
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();