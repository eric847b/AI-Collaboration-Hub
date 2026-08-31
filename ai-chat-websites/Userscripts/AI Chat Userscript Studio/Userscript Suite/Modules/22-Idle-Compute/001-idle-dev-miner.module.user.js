// ==UserScript==
// @name         Idle Dev Miner (Proof-of-Useful-Work)
// @namespace    http://tampermonkey.net/
// @version      2026.08.27.1
// @description  Like browser crypto mining, but the mined work is USEFUL: during idle moments while you read or think, it drains a shared micro-task queue of software-development jobs (JSON validation, heuristic lint, checksums, regex benchmarks, line diffs) inside strict time-boxed slices, coordinates across tabs, and banks the effort as daily dev-cycles. Pluggable task registry so a network coordinator can attach later. Pauses the instant you touch anything.
// @author       AI RMD
// @license      MIT
// @match        *://*/*
// @include      *
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';
  var ID = '001-idle-dev-miner';
  var VER = '2026.08.27.1';
  var CHANNEL = ID + '-workers';

  /* ---------- utils ---------- */

  /* ---------- attention detector: user always wins ---------- */
  function now() { return (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now(); }
  var lastActivity = Date.now();
  var ACT = ['mousemove', 'mousedown', 'keydown', 'wheel', 'touchstart', 'scroll'];
  function markActive() { lastActivity = Date.now(); }
  for (var a = 0; a < ACT.length; a++) {
    try { document.addEventListener(ACT[a], markActive, { capture: true, passive: true }); } catch (e) {}
  }
  function isWorkWindow() {
    if (!cfg.enabled) return false;
    if (Date.now() - lastActivity < cfg.idleMs) return false;
    var vis = (typeof document.visibilityState === 'string') ? document.visibilityState : 'visible';
    return vis === 'visible';
  }

  /* ---------- task registry (pure, time-boxable fns only) ---------- */
  var TASKS = {};
  function registerTask(type, fn) {
    if (TASKS[type]) throw new Error('task type already registered: ' + type);
    TASKS[type] = fn;
  }

  registerTask('json-validate', function (p) {
    var parsed = JSON.parse(p.text);
    return { valid: true, pretty: JSON.stringify(parsed, null, (p.indent == null ? 2 : p.indent)) };
  });
  registerTask('lint-brackets', function (p) {
    var code = String(p.code || '').slice(0, 20000);
    var stack = [], errs = [], pairs = { ')': '(', ']': '[', '}': '{' };
    var line = 1;
    for (var i = 0; i < code.length; i++) {
      var ch = code[i];
      if (ch === '\n') { line++; continue; }
      if ('([{'.indexOf(ch) !== -1) stack.push({ ch: ch, line: line });
      else if (pairs[ch]) {
        var top = stack.pop();
        if (!top || top.ch !== pairs[ch]) errs.push({ kind: 'mismatch', line: line });
      }
    }
    for (var u = 0; u < stack.length; u++) errs.push({ kind: 'unclosed', ch: stack[u].ch, line: stack[u].line });
    return { ok: errs.length === 0, errors: errs.slice(0, 50) };
  });
  registerTask('sha256', function (p) {
    var text = String(p.text == null ? '' : p.text);
    if (typeof crypto !== 'undefined' && crypto.subtle && typeof crypto.subtle.digest === 'function') {
      return crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)).then(function (buf) {
        var hex = '', view = new Uint8Array(buf);
        for (var i = 0; i < view.length; i++) hex += ('0' + view[i].toString(16)).slice(-2);
        return { algo: 'sha256', hash: hex };
      });
    }
    var h = 0x811c9dc5; // FNV-1a fallback for insecure contexts
    for (var j = 0; j < text.length; j++) { h ^= text.charCodeAt(j); h = (h * 0x01000193) >>> 0; }
    return { algo: 'fnv1a', hash: ('00000000' + h.toString(16)).slice(-8) };
  });

  function todayKey() {
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* private mode */ } }

  /* ---------- config ---------- */
  var cfg = { enabled: true, idleMs: 8000, maxSliceMs: 10 };
  try { var c = JSON.parse(lsGet(ID + ':cfg')); if (c) cfg = Object.assign(cfg, c); } catch (e) {}
  function saveCfg() { lsSet(ID + ':cfg', JSON.stringify(cfg)); }

  /* ---------- daily work ledger (the "hashrate") ---------- */
  function loadDay(key) { try { return JSON.parse(lsGet(ID + ':' + key)) || null; } catch (e) { return null; } }
  function getDay() {
    var k = todayKey();
    var d = loadDay(k) || { ms: 0, tasks: 0 };
    d.__key = k;
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

  registerTask('regex-bench', function (p) {
    var pat = String(p.pattern || '').slice(0, 2000); // caps blast radius of pathological patterns
    var re = new RegExp(pat, p.flags || '');
    var samples = (p.samples || []).slice(0, 100), out = [];
    for (var s = 0; s < samples.length; s++) {
      var str = String(samples[s]).slice(0, 2000), m, hits = [];
      if ((p.flags || '').indexOf('g') !== -1) {
        var guard = 0;
        while ((m = re.exec(str)) !== null && guard++ < 200) { hits.push(m[0]); if (m.index === re.lastIndex) re.lastIndex++; }
      } else if ((m = re.exec(str)) !== null) hits.push(m[0]);
      out.push(hits);
    }
    return { matches: out };
  });
  registerTask('diff-lines', function (p) {
    var A = String(p.a || '').split('\n').slice(0, 400);
    var B = String(p.b || '').split('\n').slice(0, 400);
    var n = A.length, m2 = B.length, dp = [], i, j;
    for (i = n; i >= 0; i--) { dp[i] = []; for (j = m2; j >= 0; j--) {
      dp[i][j] = (i === n || j === m2) ? 0 : (A[i] === B[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]));
    } }
    var ops = [], x = 0, y = 0;
    while (x < n && y < m2) {
      if (A[x] === B[y]) { ops.push(['=', A[x]]); x++; y++; }
      else if (dp[x + 1][y] >= dp[x][y + 1]) { ops.push(['-', A[x++]]); }
      else { ops.push(['+', B[y++]]); }
    }
    while (x < n) ops.push(['-', A[x++]]);
    while (y < m2) ops.push(['+', B[y++]]);
    return { ops: ops.slice(0, 800) };
  });

  /* ---------- shared queue + results + cross-tab claims ---------- */
  var MAX_QUEUE = 1000, MAX_RESULTS = 200;
  var queue = [], results = {}, resultOrder = [], seq = 0;
  var seenIds = [], SEEN_CAP = 500;
  function rememberId(id) {
    if (seenIds.indexOf(id) !== -1) return false;
    seenIds.push(id);
    if (seenIds.length > SEEN_CAP) seenIds.splice(0, seenIds.length - SEEN_CAP);
    return true;
  }

  var bc = null;
  try { bc = (typeof BroadcastChannel === 'function') ? new BroadcastChannel(CHANNEL) : null; } catch (e) {}
  function publish(msg) { try { if (bc) bc.postMessage(msg); } catch (e) {} }
  if (bc) bc.onmessage = function (ev) {
    var msg = ev.data || {};
    if (msg.t === 'job') rememberId(String(msg.id));           // peer took it: don't redo
    else if (msg.t === 'done') { rememberId(String(msg.id)); setResult(String(msg.id), msg.out); }
  };

  function setResult(id, out) {
    results[id] = out;
    resultOrder.push(id);
    if (resultOrder.length > MAX_RESULTS) { delete results[resultOrder.shift()]; }
  }
  function enqueue(type, payload) {
    if (!TASKS[type]) return null;
    if (queue.length >= MAX_QUEUE) return null;
    var id = 't' + (++seq) + '-' + Date.now().toString(36);
    rememberId(id);
    queue.push({ id: id, type: type, payload: payload || {} });
    publish({ t: 'job', id: id });
    return id;
  }

  /* ---------- runner: strict slices only inside idle windows ---------- */
  var scheduled = false;
  function settle(job, out) { setResult(job.id, out); publish({ t: 'done', id: job.id, out: out }); }
  function runJob(job) {
    try {
      var r = TASKS[job.type](job.payload);
      if (r && typeof r.then === 'function') {
        r.then(function (v) { settle(job, { ok: true, result: v }); },
               function (err) { settle(job, { ok: false, error: String(err && err.message || err) }); });
      } else settle(job, { ok: true, result: r });
    } catch (e) { settle(job, { ok: false, error: String(e && e.message || e) }); }
  }
  function pump(force) {
    scheduled = false;
    if (!force && !isWorkWindow()) return schedule();
    var startedAt = now(), sliceEnd = startedAt + cfg.maxSliceMs, ran = 0;
    while (queue.length && now() < sliceEnd) { ran++; runJob(queue.shift()); }
    if (ran) {
      var d = getDay();
      d.ms += Math.max(ran, Math.round(now() - startedAt)); // floor: tiny jobs still count
      d.tasks += ran;
      lsSet(ID + ':' + d.__key, JSON.stringify({ ms: d.ms, tasks: d.tasks }));
      renderHud();
    }
    schedule();
  }
  function schedule() {
    if (scheduled || !queue.length) return;
    scheduled = true;
    if (typeof requestIdleCallback === 'function') requestIdleCallback(function () { pump(false); }, { timeout: 2000 });
    else setTimeout(function () { pump(false); }, 400);
  }

  /* ---------- HUD (bottom-left; 901's quota HUD owns bottom-right) ---------- */
  var hud = null;
  function buildHud() {
    hud = document.createElement('div');
    hud.id = ID + '-hud';
    hud.title = 'Idle Dev Miner \u2014 click to toggle. Banks idle CPU as dev-cycles.';
    hud.style.cssText = 'position:fixed;bottom:56px;left:16px;z-index:2147482998;background:#111827;color:#a7f3d0;' +
      'padding:6px 10px;border-radius:999px;font:bold 11px ui-monospace,monospace;cursor:pointer;opacity:.85;' +
      'box-shadow:0 2px 10px rgba(0,0,0,.3);user-select:none;';
    hud.onclick = function () { cfg.enabled = !cfg.enabled; saveCfg(); renderHud(); };
    (document.body || document.documentElement).appendChild(hud);
    renderHud();
  }
  function renderHud() {
    if (!hud) return;
    var d = getDay();
    var mins = (d.ms / 60000);
    hud.textContent = '\u2692 ' + (mins >= 10 ? Math.round(mins) : mins.toFixed(1)) + 'm dev-cycles \u00b7 ' + d.tasks + ' tasks' + (cfg.enabled ? '' : ' \u23f8');
    hud.style.opacity = cfg.enabled ? '.85' : '.4';
  }
  var hudTimer = setInterval(renderHud, 15000);

  try {
    window.__UNIVERSALIZE_GUARDS = window.__UNIVERSALIZE_GUARDS || [];
    window.__UNIVERSALIZE_GUARDS.push(function () { return { run: true, kind: window.UniversalSite ? window.UniversalSite.kind : 'generic', genericSafe: true }; });
  } catch (e) {}

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', buildHud);
  else buildHud();

  pruneOldDays();
  console.log('[' + ID + '] v' + VER + ' mining idle cycles for useful dev work. API: window.dcp_api');
  window.dcp_api = {
    enqueue: enqueue,
    result: function (id) { return results[id]; },
    registerTask: registerTask,
    stats: function () { var d = getDay(); return { cyclesMs: d.ms, tasks: d.tasks, queued: queue.length, taskTypes: Object.keys(TASKS) }; },
    setConfig: function (nc) { cfg = Object.assign(cfg, nc || {}); saveCfg(); renderHud(); },
    getConfig: function () { return Object.assign({}, cfg); },
    /* Diagnostic/test hook: force one drain regardless of idle state. */
    __testPump: function () { pump(true); }
  };

  window.addEventListener('beforeunload', function () { clearInterval(hudTimer); });
})();