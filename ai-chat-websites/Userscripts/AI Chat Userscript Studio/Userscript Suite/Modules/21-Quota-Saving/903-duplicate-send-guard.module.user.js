// ==UserScript==
// @name         Duplicate Send Guard
// @namespace    http://tampermonkey.net/
// @version      2026.08.27.2
// @description  Intercepts re-sending an identical prompt on any site BEFORE it burns tokens: keeps a per-day fingerprint log of submitted prompts, asks for confirmation on duplicates, and reports the approximate token cost of the resend you just avoided.
// @author       AI RMD
// @license      MIT
// @match        *://*/*
// @include      *
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';
  var ID = '903-duplicate-send-guard';
  var VER = '2026.08.27.2';

  function todayKey() {
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function loadStore(key) {
    try { return JSON.parse(localStorage.getItem(ID + ':' + key)) || { fingerprints: [] }; }
    catch (e) { return { fingerprints: [] }; }
  }
  function saveStore(key, storeObj) {
    try { localStorage.setItem(ID + ':' + key, JSON.stringify(storeObj)); } catch (e) { /* ignore */ }
  }

  var store = loadStore(todayKey());
  store.__key = todayKey();

  function rotateDay() {
    var k = todayKey();
    if (store.__key !== k) { store = loadStore(k); store.__key = k; }
  }
  function normalize(text) {
    return String(text || '').toLowerCase().replace(/[^a-z0-9]+/g, '').slice(0, 4000);
  }
  function fnv1a(str) {
    var h = 0x811c9dc5;
    for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = (h * 0x01000193) >>> 0; }
    return ('00000000' + h.toString(16)).slice(-8) + '-' + str.length.toString(36);
  }
  function fingerprint(text) { return fnv1a(normalize(text)); }
  function has(fp) { rotateDay(); return store.fingerprints.indexOf(fp) !== -1; }
  function remember(fp) {
    rotateDay();
    if (store.fingerprints.indexOf(fp) === -1) {
      store.fingerprints.push(fp);
      if (store.fingerprints.length > 300) store.fingerprints.splice(0, store.fingerprints.length - 300); // ring buffer
      saveStore(store.__key, store);
    }
  }
  function estTokens(t) {
    var w = (String(t).trim().match(/\S+/g) || []).length;
    return Math.max(Math.ceil(String(t).length / 4), Math.ceil(w * 1.33));
  }

  var cfg = { enabled: true, minLength: 80 };
  try { var c = JSON.parse(localStorage.getItem(ID + ':cfg')); if (c) cfg = Object.assign(cfg, c); } catch (e) {}

  var inputEl = null;

  function findField() {
    var sel = ['textarea[placeholder]', 'textarea', '[contenteditable="true"]', '[contenteditable="plaintext-only"]'];
    var best = null, bestScore = -1;
    for (var s = 0; s < sel.length; s++) {
      var nodes = document.querySelectorAll(sel[s]);
      for (var i = 0; i < nodes.length; i++) {
        var el = nodes[i];
        if (el.offsetWidth < 60 || el.offsetHeight < 18) continue;
        var score = el.offsetWidth * el.offsetHeight + ((el.tagName === 'TEXTAREA' || el.isContentEditable) ? 10000 : 0);
        if (score > bestScore) { bestScore = score; best = el; }
      }
    }
    return best;
  }
  function getValue(el) { return el.tagName === 'TEXTAREA' ? el.value : (el.innerText || ''); }

  setInterval(function () { try { inputEl = findField(); } catch (e) {} }, 2000);

  var suppressingOnce = false;

  function confirmDuplicate(text) {
    var cost = estTokens(text);
    return window.confirm(
      '[Duplicate Send Guard]\u26A0\uFE0F This exact prompt was ALREADY submitted today.\n' +
      'Re-sending costs roughly ANOTHER ~' + cost.toLocaleString() + ' tokens.\n\n' +
      'OK = send anyway   |   Cancel = keep editing'
    );
  }

  /* Confirm before a suspected duplicate leaves the box. Capture phase so we
     beat site handlers; suppression only affects THIS keypress cycle. */
  document.addEventListener('keydown', function (e) {
    if (!cfg.enabled || suppressingOnce) return;
    if (e.key !== 'Enter' || e.shiftKey || e.ctrlKey || e.metaKey || e.isComposing) return;
    var t = e.target;
    if (!t || !t.matches || !(t.matches('textarea') || t.matches('[contenteditable="true"], [contenteditable="plaintext-only"]'))) return;
    if (t.offsetWidth < 60 || t.offsetHeight < 18) return; // ignore tiny boxes (search fields etc.)
    var text = getValue(t);
    if (!text || text.trim().length < cfg.minLength) return;
    var fp = fingerprint(text);
    if (has(fp)) {
      if (!confirmDuplicate(text)) {
        e.preventDefault();
        e.stopImmediatePropagation();
        suppressingOnce = true;
        setTimeout(function () { suppressingOnce = false; }, 350);
      }
    }
    /* Record the fingerprint synchronously with the keypress: a tab closed
       milliseconds later must not lose the record (also keeps logic testable). */
    try { remember(fp); } catch (err) { /* storage full/private mode */ }
  }, true);

  /* Also cover click-based submit (paper-plane buttons). */
  document.addEventListener('click', function (e) {
    if (!cfg.enabled || !inputEl) return;
    var n = e.target;
    if (!n || !n.getBoundingClientRect) return;
    var label = ((n.getAttribute && (n.getAttribute('aria-label') || n.getAttribute('title'))) || n.id || '').toLowerCase();
    var nearInput = inputEl.contains(n) || n.contains(inputEl);
    var r = n.getBoundingClientRect();
    var looksSendy = /send|submit|arrow.?up/.test(label) ||
      (n.tagName === 'BUTTON' && nearInput && r.width <= 64 && r.height <= 64);
    if (!looksSendy) return;
    var text = getValue(inputEl);
    if (!text || text.trim().length < cfg.minLength) return;
    var fp = fingerprint(text);
    if (has(fp)) {
      if (!confirmDuplicate(text)) { e.preventDefault(); e.stopPropagation(); return; }
    }
    try { remember(fp); } catch (err) { /* ignore */ }
  }, true);

  console.log('[' + ID + '] v' + VER + ' armed \u2014 watching submits on this page.');

  window.dsg_api = {
    isDuplicate: function (text) { return has(fingerprint(text)); },
    forgetToday: function () { rotateDay(); store.fingerprints = []; saveStore(store.__key, store); },
    setConfig: function (nc) { cfg = Object.assign(cfg, nc || {}); try { localStorage.setItem(ID + ':cfg', JSON.stringify(cfg)); } catch (e) {} },
    getConfig: function () { return Object.assign({}, cfg); },
    sentCountToday: function () { rotateDay(); return store.fingerprints.length; }
  };

  try {
    window.__UNIVERSALIZE_GUARDS = window.__UNIVERSALIZE_GUARDS || [];
    window.__UNIVERSALIZE_GUARDS.push(function () { return { run: true, kind: window.UniversalSite ? window.UniversalSite.kind : 'generic', genericSafe: true }; });
  } catch (e) {}
})();
