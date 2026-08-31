// ==UserScript==
// @name         Attention Tollbooth (Reverse-Charge Meter)
// @namespace    http://tampermonkey.net/
// @version      2026.08.27.2
// @description  Reverse-charge economics for your attention, modeled on 1-900 numbers inverted: companies are the CALLERS, so every act that burns your time/CPU/screen is METERED against them in your currency-of-self valuation. A local judge scores each offense (Advisory/Tolled/Enforced/Repeat-offender) and enforcement physically throttles timer farms, caps runaway animation, and can dismiss extortion overlays. Daily ledger per host + cross-tab merge. Ctrl+Alt+T cycles Monitor/Gentle/Strict/Off.
// @author       AI RMD
// @license      MIT
// @match        *://*/*
// @include      *
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';
  var ID = 'atoll';
  var VER = '2026.08.27.2';

  /* ---------- utils ---------- */
  function todayKey() {
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  function num(v, dflt) { return (typeof v === 'number' && isFinite(v)) ? v : dflt; }

  /* ---------- config ---------- */
  var MODES = ['monitor', 'gentle', 'strict', 'off'];
  var cfg = {
    mode: 'gentle',          /* monitor | gentle | strict | off */
    valuePerHour: 36,        /* what an hour of your life is worth, in USD */
    overlayDismiss: false    /* strict-only physical removal; off by default */
  };
  try {
    var c = JSON.parse(lsGet(ID + ':cfg'));
    if (c && typeof c === 'object') {
      if (MODES.indexOf(c.mode) !== -1) cfg.mode = c.mode;
      if (typeof c.valuePerHour === 'number' && c.valuePerHour >= 0) cfg.valuePerHour = c.valuePerHour;
      if (typeof c.overlayDismiss === 'boolean') cfg.overlayDismiss = !!c.overlayDismiss;
    }
  } catch (e) {}
  function saveCfg() { lsSet(ID + ':' + 'cfg', JSON.stringify(cfg)); }

  /* ---------- pricing table (the tariff) ----------
     weight = how aggressively this class of act consumes a human life per event-unit.
     Long-running burns bill continuously per second; discrete acts bill per event. */
  var CATS = {
    'timer-farm':   { weight: 0.55, desc: 'background timer churn' },
    'anim-loop':    { weight: 0.40, desc: 'animation/frame burn' },
    'longtask':     { weight: 1.00, desc: 'main-thread stall (>50ms task)' },
    'overlay':      { weight: 2.00, desc: 'interstitial/extortion overlay' },
    'manual':       { weight: 0.25, desc: 'externally reported act' }
  };
  function catOf(name) { return CATS[name] || CATS.manual; }

  /* ---------- pure pricing ----------
     credits approximate human SECONDS consumed (weighted);
     usd = credits converted at the owner's self-valuation. */
  function priceEvent(cat, units) {
    var cd = catOf(cat);
    var u = Math.max(0, num(units, 0));
    return { credits: Math.round(u * cd.weight), usdAtValue: +(u * cd.weight * (num(cfg.valuePerHour, 36) / 3600)).toFixed(4) };
  }

  /* ---------- pure judge (the court) ----------
     Host history h: { strikes, billedCredits }. Event adds freshUnits.
     Escalation ladder = graduated due process: voice -> fine -> force -> ban. */
  function judgeEvent(h, cat, units, mode) {
    if (mode === 'off') return { verdict: 'ignore', reason: 'mode-off', enforce: [], rate: 0 };
    var p = priceEvent(cat, units);
    var before = h.strikes;
    h.strikes += (cat === 'longtask' || cat === 'overlay') ? 2 : 1;
    var enforced = [];
    if (mode === 'strict') {
      if (cat === 'timer-farm' || cat === 'anim-loop') enforced.push(cat === 'anim-loop' ? 'cap-fps' : 'floor-interval');
      if (cat === 'overlay' && cfg.overlayDismiss) enforced.push('dismiss-overlay');
      if (enforced.length === 0) enforced.push('observe');
    } else if (mode === 'gentle' && h.strikes >= 40 && (cat === 'timer-farm' || cat === 'anim-loop')) {
      enforced.push(cat === 'anim-loop' ? 'cap-fps' : 'floor-interval'); /* only chronic burners */
    }
    var verdict = 'advisory';
    if (p.credits > 0) verdict = 'tolled';
    if (h.strikes >= 80) { verdict = 'repeat-offender'; if (enforced.length === 0) enforced.push('observe-heavy'); }
    else if (h.strikes >= 20 && enforced.length) verdict = 'enforced';
    else if (before >= 8 && !enforced.length && h.strikes < 80) verdict = 'watchlist';
    return { verdict: verdict, reason: verdict, enforce: enforced, rate: p.usdAtValue, credits: p.credits };
  }

  /* ---------- host ledger ---------- */
function hostKey(host) { return ID + ':h:' + String(host || 'unknown').slice(0, 120); }
function loadHost(host) {
  try { return JSON.parse(lsGet(hostKey(host))) || { strikes: 0, billedCredits: 0 }; }
  catch (e) { return { strikes: 0, billedCredits: 0 }; }
}
function saveHost(host, h) { lsSet(hostKey(host), JSON.stringify(h)); }
function billDay(credits, usd) {
  var k = todayKey();
  var d = null;
  try { d = JSON.parse(lsGet(ID + ':' + k)); } catch (e) {}
  if (!d || typeof d !== 'object') d = { credits: 0, usd: 0, events: 0 };
  d.credits += credits; d.usd = +(d.usd + usd).toFixed(4); d.events += 1;
  lsSet(ID + ':' + k, JSON.stringify(d));
  try { pruneOld(); } catch (e) {}
}
function pruneOld() {
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

/* cross-tab merge: other tabs broadcast their day-totals; we keep the max seen */
try {
  var BC = window.BroadcastChannel ? new BroadcastChannel('atoll-ledger') : null;
  if (BC) {
    BC.onmessage = function (ev) {
      try {
        var m = ev.data || {}; if (m.t !== 'day' || !m.k) return;
        var mine = JSON.parse(lsGet(m.k) || 'null');
        if (!mine || typeof mine !== 'object') { lsSet(m.k, JSON.stringify(m.d)); return; }
        mine.credits = Math.max(mine.credits, m.d.credits);
        mine.usd = Math.max(mine.usd, m.d.usd);
        mine.events = Math.max(mine.events, m.d.events);
        lsSet(m.k, JSON.stringify(mine));
      } catch (e) {}
    };
  }
} catch (e) {}

/* ---------- enforcement primitives (all reversible, all guarded) ---------- */
var enforcedTags = [];
function tagOf(el, name) {
  if (!el.__atollTag) el.__atollTag = {};
  if (!el.__atollTag[name]) el.__atollTag[name] = { on: false, data: null };
  return el.__atollTag[name];
}

/* floor-interval: sub-250ms timers raised to 250ms ONLY when the judge orders it (strict, or chronic-burner in gentle) */
var MIN_MS = 250;
if (typeof window.setInterval === 'function' && !window.__atoll_timer_hooked) {
  window.__atoll_timer_hooked = true;
  var _si = window.setInterval.bind(window);
  window.setInterval = function (fn, ms) {
    var rest = Array.prototype.slice.call(arguments, 2);
    ms = num(ms, 0);
    if (ms > 0 && ms < MIN_MS) {
      /* the JUDGE decides; physics only follow the verdict */
      var v = report({ cat: 'timer-farm', units: ((MIN_MS - ms) / 1000) / 10 });
      if (v.enforce.indexOf('floor-interval') !== -1) {
        /* keep call-site semantics identical: same fn/args, just a slower clock */
        var args = [fn, MIN_MS].concat(rest);
        return _si.apply(null, args);
      }
    }
    return _si.apply(null, arguments);
  };
}

/* cap-fps: run at most ~20fps by skipping frames */
var FRAME_MIN = 50, lastFrame = 0;
if (typeof window.requestAnimationFrame === 'function' && !window.__atoll_raf_hooked) {
  window.__atoll_raf_hooked = true;
  var _raf = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = function (cb) {
    return _raf(function (t) {
      if (cfg.mode === 'strict') {
        if (t - lastFrame < FRAME_MIN) { _raf(function (t2) { cb(t2); }); return; }
      }
      lastFrame = t; cb(t);
    });
  };
}

/* longtask watcher: the PerformanceObserver variant is passive detection only */
try {
  if (window.PerformanceObserver && !window.__atoll_lt_hooked) {
    window.__atoll_lt_hooked = true;
    var po = new PerformanceObserver(function (list) {
      var es = list.getEntries() || [];
      for (var i = 0; i < es.length; i++) {
        var dur = num(es[i].duration, 0);
        if (dur >= 100) report({ cat: 'longtask', units: Math.min(5, dur / 500) });
      }
    });
    po.observe({ entryTypes: ['longtask'] });
  }
} catch (e) {}

/* ---------- report: every offense passes through here ---------- */
var lastReport = null;
function report(evt) {
  evt = evt || {};
  if (cfg.mode === 'off') return { verdict: 'ignore', reason: 'mode-off', enforce: [], rate: 0, credits: 0 };
  var host = 'unknown';
  try { host = location.hostname || host; } catch (e) {}
  if (typeof evt.cat !== 'undefined' && !CATS[evt.cat]) evt.cat = 'manual';
  var h = loadHost(host);
  var verdict = judgeEvent(h, evt.cat || 'manual', num(evt.units, 0), cfg.mode);
  h.billedCredits += verdict.credits || 0;
  saveHost(host, h);
  billDay(verdict.credits || 0, verdict.rate || 0);
  lastReport = { ts: Date.now(), host: host, cat: evt.cat || 'manual',
                 units: num(evt.units, 0), verdict: verdict.verdict,
                 enforce: verdict.enforce, rate: verdict.rate };
  try {
    if (BC) BC.postMessage({ t: 'day', k: ID + ':' + todayKey(),
                             d: JSON.parse(lsGet(ID + ':' + todayKey()) || '{}') });
  } catch (e) {}
  return verdict;
}

/* ---------- overlay tribunal ---------- */
var OVERLAY_RE = /(modal|overlay|popup|interstitial|paywall|newsletter|subscribe|signup|gate|dialog)/i;
function looksLikeExtortionOverlay(el) {
  if (!el || el.nodeType !== 1 || !el.tagName) return false;
  var sig = (el.id || '') + ' ' + (el.className && typeof el.className === 'string' ? el.className : '');
  if (!OVERLAY_RE.test(sig)) return false;
  var st = null;
  try { st = window.getComputedStyle(el); } catch (e) { return false; }
  return st && num(parseFloat(st.zIndex), 0) >= 100 &&
         (st.position === 'fixed' || st.position === 'absolute');
}
function dismissOverlay(el) {
  try {
    el.style.setProperty('display', 'none', 'important');
    el.setAttribute('data-atoll-dismissed', '1');
    return true;
  } catch (e) { return false; }
}
function scanOverlays() {
  if (cfg.mode !== 'strict') return;
  try {
    var nodes = document.querySelectorAll('div,section,aside');
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      if (el.getAttribute && el.getAttribute('data-atoll-dismissed')) continue;
      var t = tagOf(el, 'overlay');
      if (t.on) continue;
      if (looksLikeExtortionOverlay(el)) {
        t.on = true;
        var r = report({ cat: 'overlay', units: 6 });
        if (r.enforce.indexOf('dismiss-overlay') !== -1 && dismissOverlay(el)) t.data = 'dismissed';
        break; /* one conviction per scan */
      }
    }
  } catch (e) {}
}

/* ---------- HUD pill ---------- */
var hudEl = null;
function renderHud() {
  try {
    if (!hudEl || !hudEl.isConnected) {
      hudEl = document.createElement('div');
      hudEl.id = 'atoll-hud';
      hudEl.style.cssText = 'position:fixed;bottom:14px;left:50%;transform:translateX(-50%);z-index:2147483646;' +
        'background:#111827;color:#a7f3d0;padding:5px 12px;border-radius:999px;font:11px/1.4 system-ui,sans-serif;' +
        'box-shadow:0 2px 10px rgba(0,0,0,.35);cursor:pointer;opacity:.92;';
      (document.body || document.documentElement).appendChild(hudEl);
      if (hudEl.addEventListener) hudEl.addEventListener('click', cycleMode);
    }
    try {
      var d = JSON.parse(lsGet(ID + ':' + todayKey()) || 'null') || { credits: 0, usd: 0 };
      hudEl.textContent = '\u2696 ' + String(cfg.mode).toUpperCase() +
        ' \u00b7 today: ' + d.credits + ' cr \u2248 $' + Number(d.usd).toFixed(2);
    } catch (e) { hudEl.textContent = '\u2696 ' + String(cfg.mode).toUpperCase(); }
  } catch (e) {}
}

/* ---------- mode cycling + hotkey ---------- */
function cycleMode() {
  cfg.mode = MODES[(MODES.indexOf(cfg.mode) + 1) % MODES.length];
  saveCfg();
  renderHud();
  return cfg.mode;
}
document.addEventListener('keydown', function (e) {
  if (e.ctrlKey && e.altKey && !e.shiftKey && !e.metaKey &&
      String(e.key || '').toLowerCase() === 't') {
    try { e.preventDefault(); } catch (x) {}
    cycleMode();
  }
}, true);

/* periodic overlay scan (light: one shallow pass / 3s, strict mode only) */
try {
  if (!window.__atoll_scan_hooked) {
    window.__atoll_scan_hooked = true;
    var _siLocal = window.setInterval.bind(window);
    _siLocal(function () { try { scanOverlays(); } catch (e) {} }, 3000);
  }
} catch (e) {}

/* ---------- universal guard registration ---------- */
try {
  window.__UNIVERSALIZE_GUARDS = window.__UNIVERSALIZE_GUARDS || [];
  window.__UNIVERSALIZE_GUARDS.push(function () {
    return { run: cfg.mode !== 'off', kind: window.UniversalSite ? window.UniversalSite.kind : 'generic', genericSafe: true };
  });
} catch (e) {}

try { pruneOld(); } catch (e) {}
renderHud();
console.log('[atoll v' + VER + '] Attention Tollbooth ready \u00b7 Ctrl+Alt+T cycles Monitor/Gentle/Strict/Off \u00b7 API: window.atoll_api');

window.atoll_api = {
  report: report,
  judgeEvent: judgeEvent,
  priceEvent: priceEvent,
  scanOverlays: scanOverlays,
  cycleMode: cycleMode,
  getConfig: function () { return Object.assign({}, cfg); },
  setConfig: function (nc) {
    nc = nc || {};
    if (MODES.indexOf(nc.mode) !== -1) cfg.mode = nc.mode;
    if (typeof nc.valuePerHour === 'number' && nc.valuePerHour >= 0) cfg.valuePerHour = nc.valuePerHour;
    if (typeof nc.overlayDismiss === 'boolean') cfg.overlayDismiss = nc.overlayDismiss;
    saveCfg(); renderHud();
  },
  lastReport: function () { return lastReport ? Object.assign({}, lastReport) : null; },
  hostRecord: function (host) { return Object.assign({}, loadHost(host)); },
  stats: function () {
    try {
      var d = JSON.parse(lsGet(ID + ':' + todayKey()) || 'null') || { credits: 0, usd: 0, events: 0 };
      return { mode: cfg.mode, creditsToday: d.credits, usdToday: d.usd, eventsToday: d.events };
    } catch (e) { return { mode: cfg.mode, creditsToday: 0, usdToday: 0, eventsToday: 0 }; }
  },
  __dismissOverlay: dismissOverlay,
  __looksLikeExtortionOverlay: looksLikeExtortionOverlay
};
})();

