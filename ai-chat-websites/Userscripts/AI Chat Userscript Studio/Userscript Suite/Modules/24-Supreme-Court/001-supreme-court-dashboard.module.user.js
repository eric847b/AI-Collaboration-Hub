// ==UserScript==
// @name         Supreme Court Dashboard (Daily Bill of Attention)
// @namespace    ai-chat-userscript-studio.supreme
// @version      2026.08.27.1
// @description  One bench above all suites: aggregates token spend, drafts saved, idle dev-cycles earned and attention tolls owed into a live daily bill with verdicts and a 30-day ledger. Ctrl+Alt+D toggles.
// @author       Eric + Cline
// @match        *://*/*
// @run-at       document-idle
// @noframes
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  var ID = 'sc';
  var VER = '2026.08.27.1';
  var CFG_KEY = ID + ':cfg';
  var LEDGER_KEY = ID + ':ledger';
  var BILL_PREFIX = ID + ':bill:';
  var MAX_LEDGER_DAYS = 30;

  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  function lsDel(k) { try { localStorage.removeItem(k); } catch (e) {} }

  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function todayKey() {
    var d = new Date();
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }

  var cfg = { showPill: true, pollMs: 15000 };
  try { var c0 = JSON.parse(lsGet(CFG_KEY)); if (c0 && typeof c0 === 'object') cfg = Object.assign(cfg, c0); } catch (e) {}
  function saveCfg() { lsSet(CFG_KEY, JSON.stringify(cfg)); }

  function safeCall(fn) {
    try { var r = fn(); return (r && typeof r === 'object') ? r : null; }
    catch (e) { return null; }
  }

  /* ------ collectors: one bench seat per sibling court ------
     Each returns {value,detail,num?,extra?} or null when absent. */
  var COLLECTORS = [
    { id: 'quota', group: 'SPEND', label: 'Input tokens (Quota Guard)',
      run: function () {
        if (!(window.tqg_api && window.tqg_api.stats)) return null;
        var s = safeCall(window.tqg_api.stats); if (!s) return null;
        return { value: s.tokens + ' tok', detail: s.pctUsed + '% of ' + s.budget + ' budget', num: Number(s.tokens) || 0, extra: { pct: s.pctUsed } };
      } },
    { id: 'dupguard', group: 'SPEND', label: 'Prompts sent (Dup Guard)',
      run: function () {
        if (!(window.dsg_api && window.dsg_api.sentCountToday)) return null;
        var n = null;
        try { n = window.dsg_api.sentCountToday(); } catch (e) { n = null; }
        if (typeof n !== 'number') return null;
        return { value: n + ' sends', detail: 'fingerprints today', num: n };
      } },
    { id: 'budgeter', group: 'SAVED', group2: true, label: 'Response tokens deferred (Budgeter)',
      run: function () {
        if (!(window.rlb_api && window.rlb_api.stats)) return null;
        var s = safeCall(window.rlb_api.stats); if (!s) return null;
        return { value: '~' + s.estSavedToday + ' tok', detail: s.appendsToday + ' prompts armed', num: Number(s.estSavedToday) || 0 };
      } },
    { id: 'miner', group: 'EARNED', label: 'Idle dev-cycles (Miner)',
      run: function () {
        if (!(window.dcp_api && window.dcp_api.stats)) return null;
        var s = safeCall(window.dcp_api.stats); if (!s) return null;
        var min = Math.round(((Number(s.cyclesMs) || 0) / 60000) * 10) / 10;
        return { value: min + ' min', detail: s.tasks + ' tasks done', num: min };
      } },
    { id: 'toll', group: 'TAXED', label: 'Attention tolls levied (Tollbooth)',
      run: function () {
        if (!(window.atoll_api && window.atoll_api.stats)) return null;
        var s = safeCall(window.atoll_api.stats); if (!s) return null;
        var v = (Number(s.usdToday) > 0 ? '$' + Number(s.usdToday).toFixed(2) : s.creditsToday + ' cr');
        return { value: v, detail: s.eventsToday + ' burn events \u00b7 mode ' + s.mode, num: Number(s.creditsToday) || 0, extra: { usd: Number(s.usdToday) || 0 } };
      } },
    { id: 'compressor', group: 'INFO', label: 'Draft compressor',
      run: function () {
        if (!(window.pcp_api && window.pcp_api.compressText)) return null;
        return { value: 'armed', detail: 'Ctrl+Alt+C on any draft' };
      } }
  ];

  function collectRows() {
    var rows = [], sources = 0;
    for (var i = 0; i < COLLECTORS.length; i++) {
      var c = COLLECTORS[i], out = null;
      try { out = c.run(); } catch (e) { out = null; }
      if (out) { out.id = c.id; out.group = c.group; out.label = c.label; sources++; rows.push(out); }
      else rows.push({ id: c.id, group: c.group, label: c.label, value: '\u2014', detail: 'not installed', num: null });
    }
    return { rows: rows, sources: sources };
  }

  function buildBill(collected) {
    var t = { spentTok: 0, sends: 0, savedTok: 0, earnMin: 0, taxedCr: 0, taxedUsd: 0 };
    var budgetPct = null;
    for (var i = 0; i < collected.rows.length; i++) {
      var r = collected.rows[i]; if (r.num == null) continue;
      if (r.id === 'quota') { t.spentTok += r.num; if (r.extra && typeof r.extra.pct === 'number') budgetPct = r.extra.pct; }
      else if (r.id === 'dupguard') t.sends += r.num;
      else if (r.id === 'budgeter') t.savedTok += r.num;
      else if (r.id === 'miner') t.earnMin += r.num;
      else if (r.id === 'toll') { t.taxedCr += r.num; if (r.extra) t.taxedUsd += (r.extra.usd || 0); }
    }
    t.taxedUsd = Math.round(t.taxedUsd * 100) / 100;
    return { date: todayKey(), generatedAt: new Date().toISOString(), totals: t,
             budgetPct: budgetPct, sources: collected.sources, verdict: verdictFor(t, budgetPct, collected.sources) };
  }

  function verdictFor(t, pct, sources) {
    if (!sources) return 'No courts in session \u2014 install suite modules.';
    if (typeof pct === 'number' && pct >= 100) return 'Budget overrun \u2014 compress drafts and tax offenders.';
    if (typeof pct === 'number' && pct >= 75) return 'Near the red line \u2014 ration remaining tokens.';
    if ((t.savedTok || 0) > 0 && ((t.taxedUsd || 0) + (t.taxedCr || 0)) > 0) return 'Citizen in credit \u2014 defenses held, trolls taxed.';
    if ((t.savedTok || 0) > 0) return 'Defenses holding \u2014 output budgets armed.';
    if (((t.taxedUsd || 0) + (t.taxedCr || 0)) > 0) return 'Debts collected.';
    if ((t.earnMin || 0) > 0) return 'Idle hours converted to dev-cycles.';
    return 'Quiet docket.';
  }

  /* ---------- ledger: archive on date change, prune >30 days ---------- */
  function loadLedger() {
    try { var l = JSON.parse(lsGet(LEDGER_KEY)); if (Array.isArray(l)) return l; } catch (e) {}
    return [];
  }
  function saveLedger(l) { lsSet(LEDGER_KEY, JSON.stringify(l.slice(-MAX_LEDGER_DAYS))); }

  function rollOverIfNeeded(nowKey) {
    nowKey = nowKey || todayKey();
    var archived = 0;
    try {
      for (var i = localStorage.length - 1; i >= 0; i--) {
        var k = localStorage.key(i);
        if (k && k.indexOf(BILL_PREFIX) === 0 && k !== BILL_PREFIX + nowKey) {
          try {
            var b = JSON.parse(lsGet(k));
            if (b && b.date && b.totals) {
              var led = loadLedger();
              led.push({ date: b.date, totals: b.totals });
              led.sort(function (a, c) { return a.date < c.date ? -1 : 1; });
              saveLedger(led);
              archived++;
            }
          } catch (e) { /* corrupt bill: drop */ }
          lsDel(k);
        }
      }
    } catch (e) { /* storage opaque */ }
    return archived;
  }

  /* ------------------------------ UI layer ------------------------------ */
  function el(tag, style, txt) {
    var e = document.createElement(tag);
    for (var k in (style || {})) e.style[k] = style[k];
    if (txt != null) e.textContent = txt;
    return e;
  }

  var hud = null, rowsBox = null, verdBox = null, ledBox = null, genBox = null;
  var pollTimer = null;

  function buildPanel() {
    if (hud) return hud;
    hud = el('div', {
      position: 'fixed', right: '12px', bottom: '52px', zIndex: 2147483646,
      width: '330px', maxHeight: '70vh', overflowY: 'auto',
      background: '#0e1420', color: '#d8e2f2', border: '1px solid #2b3a55',
      borderRadius: '10px', padding: '10px 12px', fontSize: '12px',
      fontFamily: 'ui-monospace,Menlo,Consolas,monospace', display: 'none',
      boxShadow: '0 6px 24px rgba(0,0,0,.45)'
    });
    var title = el('div', { fontWeight: '700', marginBottom: '6px', color: '#9fc1ff' },
      '\u2696 Supreme Court \u2014 Bill of Attention');
    verdBox = el('div', { margin: '6px 0', padding: '6px 8px', background: '#16233a', borderLeft: '3px solid #4f7cff' });
    rowsBox = el('div');
    ledBox = el('div', { marginTop: '8px', paddingTop: '6px', borderTop: '1px solid #22314c', color: '#8fa3c4' });
    genBox = el('div', { marginTop: '6px', color: '#66799c' });
    var hint = el('div', { marginTop: '6px', color: '#5d739a' }, 'Ctrl+Alt+D toggle \u00b7 Ctrl+Alt+R refresh');
    hud.appendChild(title); hud.appendChild(verdBox); hud.appendChild(rowsBox);
    hud.appendChild(ledBox); hud.appendChild(genBox); hud.appendChild(hint);
    try { document.documentElement.appendChild(hud); } catch (e) { hud = null; }
    return hud;
  }

  function renderInto() {
    var p = buildPanel(); if (!p) return null;
    var c = collectRows();
    var bill = buildBill(c);
    persistBill(bill);
    var g = {};
    for (var i = 0; i < c.rows.length; i++) {
      var r = c.rows[i];
      (g[r.group] = g[r.group] || []).push(r);
    }
    rowsBox.textContent = '';
    ['SPEND', 'SAVED', 'EARNED', 'TAXED', 'INFO'].forEach(function (grp) {
      if (!g[grp]) return;
      rowsBox.appendChild(el('div', { marginTop: '5px', fontWeight: '700', color: '#7ee08a' }, grp));
      g[grp].forEach(function (r) {
        var line = el('div', { display: 'flex', justifyContent: 'space-between', gap: '8px' });
        line.appendChild(el('span', { color: '#b9c8e2' }, r.label));
        line.appendChild(el('span', {}, r.value));
        rowsBox.appendChild(line);
        if (r.detail) rowsBox.appendChild(el('div', { color: '#66799c', fontSize: '11px', paddingLeft: '6px' }, '\u00b7 ' + r.detail));
      });
    });
    verdBox.textContent = '\u2696 ' + bill.verdict + (typeof bill.budgetPct === 'number' ? (' (' + bill.budgetPct + '%)') : '');
    var led = lastArchived(7);
    ledBox.textContent = '';
    ledBox.appendChild(el('div', {}, led.length ? 'Last days:' : 'No archived bills yet.'));
    led.slice(-5).forEach(function (L) {
      var t = L.totals || {};
      ledBox.appendChild(el('div', { color: '#8fa3c4' },
        L.date + ' \u00b7 spent ' + (t.spentTok || 0) + ' tok \u00b7 saved ~' + (t.savedTok || 0) +
        ' \u00b7 taxed $' + (Number(t.taxedUsd) || 0).toFixed(2)));
    });
    genBox.textContent = 'Generated ' + new Date().toLocaleTimeString() + ' \u00b7 v' + VER;
    return bill;
  }

    /* ---- missing-in-chunk helpers: bill persistence + archived-day lookup ---- */
  function persistBill(bill) {
    try { lsSet(BILL_PREFIX + bill.date, JSON.stringify(bill)); } catch (e) {}
  }
  function lastArchived(n) {
    try { return loadLedger().slice(-Math.max(1, n | 0)); } catch (e) { return []; }
  }

  /* ---------------------- pill, hotkeys, poll, boot ----------------------- */
  var pill = null, isOpen = false;
  var pollTimer = null;

  function buildPill() {
    if (pill) return pill;
    pill = el('div', {
      position: 'fixed', right: '12px', bottom: '12px', zIndex: 2147483645,
      background: '#16233a', color: '#9fc1ff', border: '1px solid #2b3a55',
      borderRadius: '999px', padding: '3px 10px', fontSize: '11px', cursor: 'pointer',
      fontFamily: 'ui-monospace,Menlo,Consolas,monospace'
    }, '\u2696 bill');
    try { pill.addEventListener('click', function () { toggle(); }); } catch (e) {}
    try { document.documentElement.appendChild(pill); } catch (e) { pill = null; }
    return pill;
  }

  function setOpen(v) {
    isOpen = !!v;
    if (isOpen) buildPanel();
    if (hud) hud.style.display = isOpen ? 'block' : 'none';
    if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
    if (!isOpen) return;
    renderInto();
    pollTimer = setInterval(function () { if (isOpen) renderInto(); }, Number(cfg.pollMs) || 15000);
  }
  function toggle() { setOpen(!isOpen); }

  function onKey(e) {
    try {
      if (e.ctrlKey && e.altKey && (e.key === 'd' || e.key === 'D')) { e.preventDefault(); toggle(); }
      else if (e.ctrlKey && e.altKey && (e.key === 'r' || e.key === 'R')) { if (isOpen) renderInto(); }
    } catch (err) {}
  }

  /* ------------------------------ public API ------------------------------ */
  var api = {
    toggle: toggle,
    open: function () { setOpen(true); },
    close: function () { setOpen(false); },
    refresh: function () { rollOverIfNeeded(); return renderInto(); },
    bill: function () { return buildBill(collectRows()); },
    ledger: loadLedger
  };
  try { window.sc_api = api; } catch (e) {}

  var internals = {
    collectRows: collectRows, buildBill: buildBill, verdictFor: verdictFor,
    persistBill: persistBill, lastArchived: lastArchived,
    rollOverIfNeeded: rollOverIfNeeded, loadLedger: loadLedger, saveLedger: saveLedger,
    todayKey: todayKey, renderInto: renderInto, setOpen: setOpen, cfg: cfg
  };
  try { window.__sc_internals = internals; } catch (e) {}
  if (typeof module !== 'undefined' && module.exports) { try { module.exports = internals; } catch (e) {} }

  /* --------------------------------- boot -------------------------------- */
  function boot() {
    try { rollOverIfNeeded(); } catch (e) {}
    if (cfg.showPill) buildPill();
    try { window.addEventListener('keydown', onKey, true); } catch (e) {}
  }
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      try { document.addEventListener('DOMContentLoaded', boot); } catch (e) { boot(); }
    } else boot();
  }
})();
