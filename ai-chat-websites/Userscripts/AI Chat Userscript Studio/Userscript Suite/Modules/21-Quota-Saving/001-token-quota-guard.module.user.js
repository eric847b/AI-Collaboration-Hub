// ==UserScript==
// @name         Token Quota Guard
// @namespace    http://tampermonkey.net/
// @version      2026.08.27.1
// @description  Tracks estimated tokens sent from any page against a configurable daily budget (free-tier friendly), shows a live HUD, and warns at 75/90/100% usage so you never silently burn your ChatGPT free quota.
// @author       AI RMD
// @license      MIT
// @match        *://*/*
// @include      *
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';
  var ID = '901-token-quota-guard';
  var VER = '2026.08.27.1';

  /* ---- tiny util layer (standalone by design) ---- */
  function todayKey() {
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function estTokens(text) {
    if (!text) return 0;
    var words = (text.trim().match(/\S+/g) || []).length;
    // Blend char-based (~4 chars/token) and word-based (~1.33 tok/word) estimates.
    return Math.max(Math.ceil(text.length / 4), Math.ceil(words * 1.33));
  }
  function loadDay(key) {
    try { return JSON.parse(localStorage.getItem(ID + ':' + key)) || null; } catch (e) { return null; }
  }
  function saveDay(key, obj) {
    try { localStorage.setItem(ID + ':' + key, JSON.stringify(obj)); } catch (e) { /* private mode */ }
  }
  function pruneOldDays() {
    try {
      var dead = Date.now() - 15 * 864e5;
      for (var i = localStorage.length - 1; i >= 0; i--) {
        var k = localStorage.key(i);
        if (k && k.indexOf(ID + ':') === 0) {
          var ds = k.slice(ID.length + 1);
          if (/^\d{4}-\d{2}-\d{2}$/.test(ds) && new Date(ds + 'T23:59:59').getTime() < dead) localStorage.removeItem(k);
        }
      }
    } catch (e) { /* ignore */ }
  }

  var cfg = { enabled: true, dailyBudget: 60000 };
  try {
    var c = JSON.parse(localStorage.getItem(ID + ':cfg'));
    if (c) cfg = Object.assign(cfg, c);
  } catch (e) { /* ignore */ }
  function saveCfg() { try { localStorage.setItem(ID + ':cfg', JSON.stringify(cfg)); } catch (e) {} }

  var state = { tick: null, hud: null, detail: null, lastSnap: '', warned: {} };

  function getDay() {
    var k = todayKey();
    var d = loadDay(k) || { tokens: 0, sends: 0 };
    d.__key = k;
    return d;
  }
  function charge(tokens) {
    var d = getDay();
    d.tokens += tokens; d.sends += 1;
    saveDay(d.__key, { tokens: d.tokens, sends: d.sends });
    checkThresholds(d.tokens);
    render();
  }
  function pct() {
    var d = getDay();
    return cfg.dailyBudget > 0 ? (d.tokens / cfg.dailyBudget) : 0;
  }
  function toast(msg, color) {
    var t = document.createElement('div');
    t.textContent = msg;
    t.style.cssText = 'position:fixed;bottom:64px;right:16px;z-index:2147483000;background:' + color +
      ';color:#fff;padding:10px 14px;border-radius:8px;font:13px system-ui,sans-serif;box-shadow:0 4px 14px rgba(0,0,0,.35);max-width:320px;';
    (document.body || document.documentElement).appendChild(t);
    setTimeout(function () { t.remove(); }, 6000);
  }
  function checkThresholds(total) {
    if (!cfg.dailyBudget) return;
    [[75, '#b45309'], [90, '#dc2626'], [100, '#7f1d1d']].forEach(function (step) {
      var p = step[0];
      if (!state.warned[p] && total >= cfg.dailyBudget * p / 100) {
        state.warned[p] = true;
        var txt = p === 100
          ? '[Quota Guard] Daily budget REACHED (' + total.toLocaleString() + '/' + cfg.dailyBudget.toLocaleString() + ' est. tokens). Consider waiting for reset.'
          : '[Quota Guard] ' + p + '% of your daily token budget used (' + total.toLocaleString() + ').';
        toast(txt, step[1]);
        console.warn(txt);
        if (typeof GM_notification === 'function') { try { GM_notification({ text: txt, title: 'Token Quota Guard' }); } catch (e) {} }
      }
    });
  }
  function fmt(n) { return n >= 1000 ? (n / 1000).toFixed(1) + 'k' : String(n); }
  function render() {
    if (!state.hud) return;
    var d = getDay();
    var p = pct();
    var col = p >= 1 ? '#dc2626' : p >= 0.9 ? '#ea580c' : p >= 0.7 ? '#d97706' : '#059669';
    state.hud.style.background = col;
    state.hud.textContent = '\u26A1 ' + fmt(d.tokens) + ' / ' + fmt(cfg.dailyBudget);
    state.hud.title = 'Estimated tokens today (' + Math.round(p * 100) + '% of budget). Click for details.';
    if (state.detail && state.detail.style.display !== 'none') fillDetail();
  }
  function fillDetail() {
    var d = getDay();
    var avg = d.sends ? Math.round(d.tokens / d.sends) : 0;
    state.detail.firstChild.nodeValue = 'Today: ' + d.sends + ' sends \u2248 ' + d.tokens.toLocaleString() + ' tokens' +
      (avg ? ' (avg ' + avg + '/send)' : '') + '. Left: ' + Math.max(0, cfg.dailyBudget - d.tokens).toLocaleString();
  }

  /* Send detection heuristic: watch the primary big text field; when it goes
     from long-content -> empty, a message was very likely submitted. */
  function findField() {
    var sel = ['textarea', '[contenteditable="true"]', '[contenteditable="plaintext-only"]'];
    var best = null, bestArea = 0;
    for (var s = 0; s < sel.length; s++) {
      var nodes = document.querySelectorAll(sel[s]);
      for (var i = 0; i < nodes.length; i++) {
        var el = nodes[i];
        if (el.offsetWidth < 60 || el.offsetHeight < 18) continue;
        var area = el.offsetWidth * el.offsetHeight;
        if (area > bestArea) { bestArea = area; best = el; }
      }
    }
    return best;
  }
  function fieldValue(el) {
    if (!el) return '';
    return el.tagName === 'TEXTAREA' ? el.value : (el.innerText || el.textContent || '');
  }
  function poll() {
    if (!cfg.enabled) return;
    try {
      var el = findField();
      var v = fieldValue(el).trim();
      if (v.length >= 40) {
        state.lastSnap = v;
      } else if (state.lastSnap && v.length === 0) {
        charge(estTokens(state.lastSnap));
        state.lastSnap = '';
      }
    } catch (e) { /* never break page */ }
  }

  function buildUI() {
    var root = document.body || document.documentElement;
    state.hud = document.createElement('div');
    state.hud.id = ID + '-hud';
    state.hud.style.cssText = 'position:fixed;bottom:56px;right:16px;z-index:2147483000;color:#fff;' +
      'padding:6px 10px;border-radius:999px;font:bold 12px system-ui,sans-serif;cursor:pointer;opacity:.92;box-shadow:0 2px 10px rgba(0,0,0,.3);user-select:none;';
    state.detail = document.createElement('div');
    state.detail.id = ID + '-detail';
    state.detail.style.cssText = 'position:fixed;bottom:84px;right:16px;z-index:2147483000;display:none;background:rgba(20,20,25,.94);color:#eee;' +
      'padding:10px 12px;border-radius:8px;font:12px system-ui,sans-serif;max-width:280px;line-height:1.5;white-space:pre-wrap;';
    state.detail.appendChild(document.createTextNode(''));
    var act = document.createElement('div');
    act.style.cssText = 'margin-top:8px;display:flex;gap:6px;';
    var mkBtn = function (label, fn) {
      var b = document.createElement('button');
      b.textContent = label;
      b.style.cssText = 'flex:1;border:0;border-radius:5px;padding:4px 6px;cursor:pointer;font-size:11px;background:#3b82f6;color:#fff;';
      b.onclick = fn;
      return b;
    };
    act.appendChild(mkBtn('Set budget', function () {
      var v = prompt('Daily estimated-token budget:', String(cfg.dailyBudget));
      if (v !== null && !isNaN(parseInt(v, 10))) { cfg.dailyBudget = Math.max(100, parseInt(v, 10)); saveCfg(); render(); }
    }));
    act.appendChild(mkBtn('Reset today', function () {
      saveDay(todayKey(), { tokens: 0, sends: 0 }); state.warned = {}; render();
    }));
    act.appendChild(mkBtn('Close', function () { state.detail.style.display = 'none'; }));
    state.detail.appendChild(act);
    state.hud.onclick = function () { var s = state.detail.style; s.display = s.display === 'none' ? 'block' : 'none'; fillDetail(); };
    root.appendChild(state.hud);
    root.appendChild(state.detail);
    render();
  }

  function init() {
    try {
      pruneOldDays();
      buildUI();
      state.tick = setInterval(poll, 2500);
      window.addEventListener('beforeunload', function () { clearInterval(state.tick); });
      console.log('[' + ID + '] v' + VER + ' ready. API: window.tqg_api');
      window.tqg_api = {
        charge: charge,
        estimate: estTokens,
        stats: function () { var d = getDay(); return { tokens: d.tokens, sends: d.sends, pctUsed: Math.round(pct() * 100), budget: cfg.dailyBudget }; },
        setConfig: function (nc) { cfg = Object.assign(cfg, nc || {}); saveCfg(); render(); },
        getConfig: function () { return Object.assign({}, cfg); }
      };
      return true;
    } catch (e) { console.error('[' + ID + '] init failed', e); return false; }
  }

  /* Universal-runtime marker: safe on ALL sites */
  try {
    window.__UNIVERSALIZE_GUARDS = window.__UNIVERSALIZE_GUARDS || [];
    window.__UNIVERSALIZE_GUARDS.push(function () { return { run: true, kind: window.UniversalSite ? window.UniversalSite.kind : 'generic', genericSafe: true }; });
  } catch (e) { /* ignore */ }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
