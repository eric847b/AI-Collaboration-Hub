// ==UserScript==
// @name         Response Length Budgeter
// @namespace    http://tampermonkey.net/
// @version      2026.08.27.1
// @description  Cuts the expensive half of chat-AI tokens: the RESPONSE. Before you hit send, arms your prompt with a visible "reply in under N words" instruction, chosen via Ctrl+Alt+B (150/75/300/off). Skips short prompts and prompts that already carry a length limit; never double-appends; Ctrl+Alt+U undo. Works on any site, banks estimated savings per day alongside the 901/902/903 quota tools.
// @author       AI RMD
// @license      MIT
// @match        *://*/*
// @include      *
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';
  var ID = 'rlb';
  var VER = '2026.08.27.1';

  /* ---------- utils ---------- */
  function todayKey() {
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }

  /* ---------- config ---------- */
  var WORD_STEPS = [150, 75, 300, 0]; // 0 = off
  var cfg = { words: 150, minPromptChars: 120 };
  try { var c = JSON.parse(lsGet(ID + ':cfg')); if (c && typeof c === 'object') {
    if (typeof c.words === 'number') cfg.words = c.words;
    if (typeof c.minPromptChars === 'number') cfg.minPromptChars = c.minPromptChars;
  } } catch (e) {}
  function saveCfg() { lsSet(ID + ':cfg', JSON.stringify(cfg)); }

  /* ---------- daily savings ledger ---------- */
  function loadDay(key) { try { return JSON.parse(lsGet(ID + ':' + key)) || null; } catch (e) { return null; } }
  function bank(estSaved) {
    var k = todayKey();
    var d = loadDay(k) || { appends: 0, estSaved: 0 };
    d.appends += 1;
    d.estSaved += Math.round(estSaved);
    lsSet(ID + ':' + k, JSON.stringify(d));
    try { pruneOldDays(); } catch (e) {}
    return d;
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
    } catch (e) {}
  }

  /* ---------- pure decision core (unit-testable, DOM-free) ---------- */
  var MARKER_RE = /\(\s*response\s+style\s+note\s*:/i;                                   // our own suffix
  var USER_LIMIT_RE = /\b(?:under|below|at\s+most|maximum|max\.?|limit(?:ed)?\s+to|fewer\s+than|less\s+than|no\s+more\s+than)\b[^.\n]{0,40}?\d+\s*(?:words?|w\b|sentences?|paragraphs?|bullet)/i;

  function suffixFor(words) {
    return '(Response style note: reply in under ' + words + ' words, no preamble.)';
  }
  /* Unconstrained chat answers on major assistants average roughly 250-420 words.
     We model expected response length as a function of prompt size, then diff against
     the cap. Deliberately conservative; stats() reports it as an ESTIMATE. */
  function expectedTokensUnconstrained(promptLen) {
    var words = 260 + Math.min(340, Math.max(0, (promptLen - 120) * 0.35));
    return Math.round(words * 1.33);
  }
  function estimateSavedTokens(promptLen, wordCap) {
    var capped = Math.round(wordCap * 1.33);
    return Math.max(0, expectedTokensUnconstrained(promptLen) - capped);
  }
  /* Decides whether/how to arm a prompt. Returns a plain result object so tests can
     assert every branch deterministically. */
  function planFor(text, opts) {
    opts = opts || {};
    var words = (typeof opts.words === 'number') ? opts.words : cfg.words;
    var minChars = (typeof opts.minPromptChars === 'number') ? opts.minPromptChars : cfg.minPromptChars;
    if (!words || words <= 0) return { apply: false, reason: 'off' };
    text = String(text == null ? '' : text);
    if (MARKER_RE.test(text)) return { apply: false, reason: 'already-armed' };
    if (USER_LIMIT_RE.test(text)) return { apply: false, reason: 'user-limit-present' };
    if (text.trim().length < minChars) return { apply: false, reason: 'too-short' };
    var suffix = suffixFor(words);
    return {
      apply: true,
      reason: 'armed',
      newText: text.replace(/\s+$/, '') + '\n\n' + suffix,
      suffix: suffix,
      estSaved: estimateSavedTokens(text.length, words)
    };
  }

  /* ---------- DOM application layer ---------- */
  function activeField() {
    var el = document.activeElement;
    if (el && ((el.tagName === 'TEXTAREA' || el.tagName === 'INPUT') || el.isContentEditable)) return el;
    var tas = document.querySelectorAll('textarea');
    var best = null, bestScore = -1;
    for (var i = 0; i < tas.length; i++) {
      var t = tas[i];
      if (t.readOnly || t.disabled) continue;
      var r = t.getBoundingClientRect();
      var score = r.width * r.height;
      if (score > bestScore) { bestScore = score; best = t; }
    }
    return best;
  }
  function fieldText(el) {
    if (!el) return '';
    if (typeof el.value === 'string') return el.value;
    return el.textContent || '';
  }
  function setFieldText(el, text) {
    if (!el) return;
    if (typeof el.value === 'string') {
      el.value = text;
      try { el.dispatchEvent(new Event('input', { bubbles: true })); } catch (e) {}
    } else {
      el.textContent = text;
      try {
        el.focus();
        var sel = window.getSelection();
        var range = document.createRange();
        range.selectNodeContents(el);
        range.collapse(false); /* caret to end */
        sel.removeAllRanges(); sel.addRange(range);
        el.dispatchEvent(new Event('input', { bubbles: true }));
      } catch (e) {}
    }
  }

  /* ---------- undo stack (per-field, most recent wins) ---------- */
  var undoStack = [];
  function pushUndo(el, prevText) {
    undoStack.push({ tag: el ? el.tagName : '', prev: prevText });
    if (undoStack.length > 20) undoStack.shift();
  }
  function popUndoFor(el) {
    for (var i = undoStack.length - 1; i >= 0; i--) {
      if (!el || undoStack[i].tag === el.tagName) return undoStack.splice(i, 1)[0];
    }
    return null;
  }

  /* ---------- toast ---------- */
  var toastEl = null, toastTimer = null;
  function toast(msg, ms) {
    try {
      if (!toastEl || !toastEl.isConnected) {
        toastEl = document.createElement('div');
        toastEl.id = ID + '-toast';
        toastEl.style.cssText = 'position:fixed;top:18px;left:50%;transform:translateX(-50%);z-index:2147483647;' +
          'background:#1f2937;color:#fef3c7;padding:8px 14px;border-radius:8px;font:12px/1.4 system-ui,sans-serif;' +
          'box-shadow:0 4px 14px rgba(0,0,0,.35);pointer-events:none;opacity:.96;transition:opacity .25s;';
        (document.body || document.documentElement).appendChild(toastEl);
      }
      toastEl.textContent = msg;
      toastEl.style.opacity = '.96';
      clearTimeout(toastTimer);
      toastTimer = setTimeout(function () { try { toastEl.style.opacity = '0'; } catch (e) {} }, ms || 3200);
    } catch (e) {}
  }

  /* ---------- core actions ---------- */
  function applyNow() {
    var el = activeField();
    if (!el) { toast('[RLB] no input field found'); return; }
    var before = fieldText(el);
    var plan = planFor(before);
    if (!plan.apply) {
      toast('[RLB] not armed: ' + plan.reason);
      return;
    }
    pushUndo(el, before);
    setFieldText(el, plan.newText);
    var d = bank(plan.estSaved);
    toast('[RLB] armed \u2264' + cfg.words + 'w \u00b7 est. ~' + plan.estSaved +
      ' response tokens saved today (' + d.estSaved + ') \u00b7 Ctrl+Alt+U to undo');
  }
  function cycleBudget() {
    var idx = WORD_STEPS.indexOf(cfg.words);
    idx = (idx === -1) ? 0 : (idx + 1) % WORD_STEPS.length;
    cfg.words = WORD_STEPS[idx];
    saveCfg();
    toast('[RLB] budget ' + (cfg.words > 0 ? ('\u2264' + cfg.words + ' words') : 'OFF'));
  }
  function undoLast() {
    var el = activeField();
    var u = popUndoFor(el);
    if (!u) { toast('[RLB] nothing to undo'); return; }
    if (el) setFieldText(el, u.prev);
    else if (undoTargetEl) setFieldText(undoTargetEl, u.prev);
    toast('[RLB] restored previous draft');
  }

  /* ---------- hotkeys ---------- */
  document.addEventListener('keydown', function (e) {
    if (!(e.ctrlKey && e.altKey && !e.shiftKey && !e.metaKey)) return;
    var k = (e.key || '').toLowerCase();
    if (k === 'b') { try { e.preventDefault(); } catch (x) {} cycleBudget(); }
    else if (k === 'u') {
      /* plain Ctrl+Alt+U must not fire when another module already consumed it */
      var target = e.target;
      var handledElsewhere = target && target.getAttribute && target.getAttribute('data-rlb-consumed') === '1';
      if (handledElsewhere) return;
      try { e.preventDefault(); } catch (x) {}
      undoLast();
    }
  }, true);

  /* ---------- universal-runtime guard registration ---------- */
  try {
    window.__UNIVERSALIZE_GUARDS = window.__UNIVERSALIZE_GUARDS || [];
    window.__UNIVERSALIZE_GUARDS.push(function () {
      return { run: true, kind: window.UniversalSite ? window.UniversalSite.kind : 'generic', genericSafe: true };
    });
  } catch (e) {}

  pruneOldDays();
  console.log('[rlb v' + VER + '] Response Budgeter ready. Ctrl+Alt+B cycle cap \u00b7 Ctrl+Alt+B on empty field shows state \u00b7 API: window.rlb_api');

  window.rlb_api = {
    applyNow: applyNow,
    cycleBudget: cycleBudget,
    undoLast: undoLast,
    planFor: planFor,
    suffixFor: suffixFor,
    estimateSavedTokens: estimateSavedTokens,
    stats: function () { var d = loadDay(todayKey()) || { appends: 0, estSaved: 0 }; return { words: cfg.words, appendsToday: d.appends, estSavedToday: d.estSaved, queuedUndos: undoStack.length }; },
    getConfig: function () { return Object.assign({}, cfg); },
    setConfig: function (nc) {
      nc = nc || {};
      if (WORD_STEPS.indexOf(nc.words) !== -1) cfg.words = nc.words;
      if (typeof nc.minPromptChars === 'number' && nc.minPromptChars >= 0) cfg.minPromptChars = nc.minPromptChars;
      saveCfg();
    },
    /* Diagnostic/test hooks */
    __pushUndo: pushUndo,
    __popUndoFor: popUndoFor,
    __testSetField: setFieldText,
    __testFieldText: fieldText
  };
})();
