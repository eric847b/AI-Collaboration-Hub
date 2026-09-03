// ==UserScript==
// @name         Prompt Compressor
// @namespace    http://tampermonkey.net/
// @version      2026.08.27.1
// @description  Shrinks prompts BEFORE sending on any site: strips filler/politeness noise, condenses wordy phrases, removes duplicated sentences and excess whitespace, then shows exactly how many tokens you saved. Free-tier ChatGPT quota lasts far longer.
// @author       AI RMD
// @license      MIT
// @match        *://*/*
// @include      *
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';
  var ID = '902-prompt-compressor';
  var VER = '2026.08.27.1';

  function estTokens(t) {
    if (!t) return 0;
    var w = (t.trim().match(/\S+/g) || []).length;
    return Math.max(Math.ceil(t.length / 4), Math.ceil(w * 1.33));
  }

  /* ---------------- compression engine (pure, testable) ---------------- */

  var PHRASE_MAP = [
    [/in order to\b/gi, 'to'],
    [/due to the fact that\b/gi, 'because'],
    [/at this point in time\b/gi, 'now'],
    [/at the present moment\b/gi, 'now'],
    [/for the purpose of\b/gi, 'for'],
    [/in the event that\b/gi, 'if'],
    [/in spite of the fact that\b/gi, 'although'],
    [/with regard to\b/gi, 'about'],
    [/with respect to\b/gi, 'about'],
    [/prior to\b/gi, 'before'],
    [/subsequent to\b/gi, 'after'],
    [/a (?:large )?number of\b/gi, 'many'],
    [/the majority of\b/gi, 'most'],
    [/utilize\b/gi, 'use'],
    [/utilizing\b/gi, 'using'],
    [/commence\b/gi, 'start'],
    [/terminate\b/gi, 'end'],
    [/it is important to (?:note|remember) that\s*/gi, ''],
    [/please (?:be aware|note)(?: that)?\s*/gi, ''],
    [/i would like you to\b/gi, ''],
    [/i want you to\b/gi, ''],
    [/could you please\b/gi, ''],
    [/can you please\b/gi, ''],
    [/kindly\b/gi, '']
  ];

  var FILLER_WORDS = /\b(?:basically|actually|literally|definitely|certainly|obviously|honestly|really|simply|kind of|sort of|you know|i mean)\b[,\s]*/gi;

  var OPENERS = /^(?:hi|hey|hello|good\s+(?:morning|afternoon|evening))[!,.]?\s*/i;
  var THANKS_TAIL = /[\s,]*(?:thanks?(?:\s+(?:you|a lot|so much))?|thank you)[.!\s]*$/i;
  var PLEASE_LEAD = /^please[, ]+/i;

  function compress(raw) {
    var out = String(raw == null ? '' : raw);
    out = out.replace(/\r\n/g, '\n');
    for (var i = 0; i < PHRASE_MAP.length; i++) out = out.replace(PHRASE_MAP[i][0], PHRASE_MAP[i][1]);
    out = out.replace(FILLER_WORDS, '');
    out = out.replace(OPENERS, '');
    out = out.replace(PLEASE_LEAD, '');
    out = out.replace(THANKS_TAIL, '');

    // De-duplicate consecutive repeated sentences (works without lookbehind).
    var sentences = out.split(/([.!?]+)\s+/);
    var parts = [];
    for (var s = 0; s < sentences.length; s += 2) {
      var text = sentences[s] || '';
      if (sentences[s + 1]) text += sentences[s + 1];
      if (text.trim()) parts.push(text.trim());
    }
    var resultTexts = [];
    var lastNorm = '';
    for (var k = 0; k < parts.length; k++) {
      var norm = parts[k].toLowerCase().replace(/[^a-z0-9]+/g, '');
      if (norm && norm === lastNorm) continue; // consecutive duplicate sentence
      lastNorm = norm;
      resultTexts.push(parts[k]);
    }
    out = resultTexts.join(' ');

    // Whitespace collapse (preserve intentional paragraph breaks).
    out = out.replace(/[ \t]{2,}/g, ' ').replace(/\n{3,}/g, '\n\n').replace(/\n\s+/g, '\n').trim();
    return out;
  }

  /* ------------------------------ UI wiring ------------------------------ */

  var ui = { bar: null, stat: null, _t: null, lastOriginal: '' };

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
  function setValue(el, v) {
    if (el.tagName === 'TEXTAREA') { el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); }
    else {
      try { el.focus(); document.execCommand('selectAll', false, null); document.execCommand('insertText', false, v); }
      catch (err) { el.innerText = v; el.dispatchEvent(new InputEvent('input', { bubbles: true })); }
    }
  }
  function setCaretEnd(el) {
    try { el.focus(); var r = document.createRange(); r.selectNodeContents(el); r.collapse(false);
      var sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(r); } catch (e) {}
  }

  function doCompress() {
    var el = findField();
    if (!el) return flashStat('\u2702 no input found', '#b91c1c');
    var orig = getValue(el);
    if (!orig.trim()) return flashStat('nothing to compress', '#92400e');
    var before = estTokens(orig);
    var smaller = compress(orig);
    var after = estTokens(smaller);
    if (smaller.length >= orig.length) return flashStat('already tight \u2014 nothing removed', '#92400e');
    ui.lastOriginal = orig;
    setValue(el, smaller);
    if (el.isContentEditable) setCaretEnd(el);
    var saved = before - after;
    flashStat('\u2702 saved ~' + saved + ' tokens (' + Math.round(saved * 100 / Math.max(1, before)) + '%)', '#15803d');
  }
  function undo() {
    var el = findField();
    if (!el || !ui.lastOriginal) return flashStat('nothing to undo', '#374151');
    setValue(el, ui.lastOriginal);
    flashStat('undone', '#374151');
  }
  function flashStat(text, color) {
    if (!ui.stat) return;
    ui.stat.textContent = text; ui.stat.style.color = '#fff'; ui.stat.style.background = color;
    clearTimeout(ui._t);
    ui._t = setTimeout(clearStat, 4000);
  }
  function clearStat() { if (ui.stat) { ui.stat.textContent = ''; ui.stat.style.background = 'transparent'; } }

  function ensureBar() {
    var el = findField();
    if (!el) return;
    if (ui.bar && ui.bar.isConnected) { position(el); return; }
    var host = document.createElement('div');
    host.id = ID + '-bar';
    host.style.cssText = 'position:absolute;z-index:2147482999;display:flex;gap:6px;align-items:center;';
    var mk = function (label, fn, bg) {
      var b = document.createElement('button'); b.textContent = label;
      b.style.cssText = 'border:0;border-radius:6px;padding:3px 9px;cursor:pointer;font:11px system-ui,sans-serif;background:' + bg + ';color:#fff;box-shadow:0 1px 6px rgba(0,0,0,.25);';
      b.onmousedown = function (ev) { ev.preventDefault(); fn(); }; // avoid stealing focus
      return b;
    };
    host.appendChild(mk('\u2702 Compress', doCompress, '#2563eb'));
    host.appendChild(mk('Undo', undo, '#6b7280'));
    var st = document.createElement('span'); st.style.cssText = 'font:11px system-ui,sans-serif;padding:3px 8px;border-radius:6px;';
    ui.stat = st; host.appendChild(st);
    (document.body || document.documentElement).appendChild(host);
    ui.bar = host;
    position(el);
  }
  function position(fieldEl) {
    if (!ui.bar || !fieldEl) return;
    var r = fieldEl.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) return; // hidden right now
    ui.bar.style.left = Math.max(8, r.left) + 'px';
    ui.bar.style.top = Math.max(8, r.top - 30) + 'px';
  }

  var posTimer = setInterval(function () { try { ensureBar(); } catch (e) {} }, 1500);

  document.addEventListener('keydown', function (e) {
    if (e.ctrlKey && e.altKey && (e.key === 'c' || e.key === 'C')) { e.preventDefault(); try { doCompress(); } catch (err) {} }
  }, true);

  window.addEventListener('beforeunload', function () { clearInterval(posTimer); });

  try {
    window.__UNIVERSALIZE_GUARDS = window.__UNIVERSALIZE_GUARDS || [];
    window.__UNIVERSALIZE_GUARDS.push(function () { return { run: true, kind: window.UniversalSite ? window.UniversalSite.kind : 'generic', genericSafe: true }; });
  } catch (e) {}

  console.log('[' + ID + '] v' + VER + ' ready (Ctrl+Alt+C compresses active draft). API: window.pcp_api');
  window.pcp_api = {
    compressText: compress,
    compressActiveField: doCompress,
    estimate: estTokens
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ensureBar);
  else ensureBar();
})();
