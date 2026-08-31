#!/usr/bin/env node
/* Regression harness: Attention Tollbooth (Modules/23-Attention-Toll/001)
   Runs the module in a mocked browser sandbox and drives every judicial path. */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');

const MOD = path.resolve(__dirname, '..', '..', 'Modules', '23-Attention-Toll', '001-attention-tollbooth.module.user.js');
const SRC = fs.readFileSync(MOD, 'utf8');

let pass = 0, fail = 0;
function ok(cond, name, extra) {
  if (cond) { pass++; console.log('  ok - ' + name); }
  else { fail++; console.log('  FAIL - ' + name + (extra !== undefined ? ' :: ' + JSON.stringify(extra) : '')); }
}
function section(t) { console.log('\n# ' + t); }

/* ---------- mock browser ---------- */
function makeLS() {
  const m = Object.create(null);
  return {
    getItem: k => (k in m ? m[k] : null),
    setItem: (k, v) => { m[k] = String(v); },
    removeItem: k => { delete m[k]; },
    key: i => Object.keys(m)[i] || null,
    get length() { return Object.keys(m).length; },
    _m: m
  };
}
function mkEl(tag) {
  const attrs = Object.create(null);
  const styles = [];
  return {
    tagName: String(tag || 'div').toUpperCase(), nodeType: 1,
    id: '', className: '', isConnected: true,
    style: { setProperty: (p, v) => styles.push([p, v]) }, _styles: styles,
    setAttribute: (n, v) => { attrs[n] = String(v); },
    getAttribute: n => (n in attrs ? attrs[n] : null),
    children: [], appendChild(c) { this.children.push(c); return c; },
    addEventListener() {}
  };
}
function makeEnv() {
  const ls = makeLS();
  const doc = {
    body: mkEl('body'),
    addEventListener(type, fn) { (doc._h[type] = doc._h[type] || []).push(fn); },
    _h: Object.create(null),
    createElement: tag => mkEl(tag),
    querySelectorAll: () => (doc._q || []),
    _q: []
  };
  const timers = { intervals: [], seq: 1 };
  const win = {
    setInterval(fn, ms) { timers.intervals.push({ fn, ms, id: timers.seq }); return timers.seq++; },
    clearInterval() {},
    requestAnimationFrame: null /* filled per-test */,
    document: doc, localStorage: ls,
    getComputedStyle: el => el.__cs || { zIndex: 'auto', position: 'static' }
  };
  win.window = win;
  const ctx = { window: win, document: doc, localStorage: ls, console,
                location: { hostname: 'strict.test' }, Date, Math, JSON,
                String, Number, Array, Object, RegExp, parseFloat, parseInt, isNaN, isFinite };
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  vm.runInContext(SRC + '\n//# sourceURL=atoll.module.js', ctx, { filename: 'atoll.module.js' });
  return { ctx, win, doc, ls, timers, api: win.atoll_api };
}

/* ---------- 1. pure pricing ---------- */
section('pure pricing');
{
  const { api } = makeEnv();
  const p1 = api.priceEvent('timer-farm', 10);
  ok(p1.credits === 6, 'priceEvent timer-farm x10 -> 6 cr (weight .55)', p1);
  ok(Math.abs(p1.usdAtValue - 0.055) < 1e-9, 'usd converts at $36/h self-valuation', p1);
  const p2 = api.priceEvent('not-a-category', 4);
  ok(p2.credits === 1, 'unknown category falls back to manual weight .25', p2);
  const p3 = api.priceEvent('overlay', -5);
  ok(p3.credits === 0 && p3.usdAtValue === 0, 'negative units clamp to zero', p3);
}

/* ---------- 2. judge ladder ---------- */
section('judge ladder');
{
  const { api } = makeEnv();
  const fresh = () => ({ strikes: 0, billedCredits: 0 });
  ok(api.judgeEvent(fresh(), 'timer-farm', 1, 'off').verdict === 'ignore', 'mode off -> ignore');
  const j1 = api.judgeEvent(fresh(), 'overlay', 6, 'monitor');
  ok(j1.verdict === 'tolled' && j1.enforce.length === 0 && j1.credits === 12,
     'monitor: overlay tolled (12cr) with zero physics', j1);
  const j2 = api.judgeEvent(fresh(), 'timer-farm', 1, 'strict');
  ok(j2.enforce.indexOf('floor-interval') !== -1 && j2.verdict === 'tolled',
     'strict: first timer offense floors immediately', j2);
  const j3 = api.judgeEvent({ strikes: 39, billedCredits: 0 }, 'anim-loop', 1, 'gentle');
  ok(j3.enforce.indexOf('cap-fps') !== -1, 'gentle chronic (40th strike) caps fps');
  const j5 = api.judgeEvent({ strikes: 79, billedCredits: 0 }, 'manual', 1, 'monitor');
  ok(j5.verdict === 'repeat-offender', '80th cumulative strike -> repeat-offender', j5);
}

/* ---------- 3. overlayDismiss flag ---------- */
section('dismiss policy flag');
{
  const { api } = makeEnv();
  api.setConfig({ mode: 'strict', overlayDismiss: false });
  const j = api.judgeEvent({ strikes: 0, billedCredits: 0 }, 'overlay', 6, 'strict');
  ok(j.enforce.indexOf('dismiss-overlay') === -1 && j.enforce.indexOf('observe') !== -1,
     'overlayDismiss=false -> tribunal observes only', j);
  api.setConfig({ overlayDismiss: true });
  const j2 = api.judgeEvent({ strikes: 0, billedCredits: 0 }, 'overlay', 6, 'strict');
  ok(j2.enforce.indexOf('dismiss-overlay') !== -1, 'overlayDismiss=true -> removal ordered');
}

/* ---------- 4. config validation ---------- */
section('config validation + persistence');
{
  const { api, ls } = makeEnv();
  api.setConfig({ mode: 'bogus' });
  ok(api.getConfig().mode === 'gentle', 'invalid mode rejected');
  api.setConfig({ valuePerHour: -3 });
  ok(api.getConfig().valuePerHour === 36, 'negative wage rejected');
  api.setConfig({ mode: 'strict', valuePerHour: 60 });
  ok(api.getConfig().mode === 'strict' && api.getConfig().valuePerHour === 60, 'valid config applied');
  ok(JSON.parse(ls.getItem('atoll:cfg')).valuePerHour === 60, 'config persisted to localStorage');
}

/* ---------- 5. report billing + off-mode inertness ---------- */
section('report pipeline');
{
  const e = makeEnv();
  e.api.setConfig({ mode: 'monitor' });
  const s0 = e.api.stats();
  e.ctx.location.hostname = 'biller.test';
  const v = e.api.report({ cat: 'overlay', units: 6 });
  ok(v.verdict === 'tolled' && v.rate > 0, 'overlay bills at positive $ rate', v);
  const s1 = e.api.stats();
  ok(s1.creditsToday - s0.creditsToday === 12 && s1.eventsToday - s0.eventsToday === 1,
     'day ledger credited 12 cr / 1 event', [s0, s1]);
  ok(e.api.hostRecord('biller.test').strikes === 2, 'host record accrued 2 strikes (heavy class)');
  ok(e.api.lastReport() && e.api.lastReport().cat === 'overlay', 'lastReport mirrors conviction');

  const before = e.api.stats();
  e.api.setConfig({ mode: 'off' });
  const vOff = e.api.report({ cat: 'longtask', units: 5 });
  ok(vOff.credits === 0 && vOff.verdict === 'ignore', 'off-mode report ignored', vOff);
  const after = e.api.stats();
  ok(after.creditsToday === before.creditsToday && after.eventsToday === before.eventsToday,
     'off-mode touches NO ledgers');
}

/* ---------- 6. THE FIX: timer physics follow the verdict ---------- */
section('setInterval floor obeys the judge (regression)');
{
  const e = makeEnv();
  e.api.setConfig({ mode: 'strict' });
  e.ctx.location.hostname = 'strict.test';
  e.timers.intervals.length = 0;
  e.win.setInterval(() => {}, 100, 'a', 'b');
  const floored = e.timers.intervals[e.timers.intervals.length - 1];
  ok(floored.ms === 250, 'strict: 100ms farmed timer physically raised to 250ms', floored.ms);

  e.api.setConfig({ mode: 'monitor' });
  e.ctx.location.hostname = 'mfresh.test';
  e.timers.intervals.length = 0;
  e.win.setInterval(() => {}, 100);
  ok(e.timers.intervals[0].ms === 100, 'monitor: churn tolled in credits but clock untouched', e.timers.intervals[0].ms);

  e.api.setConfig({ mode: 'gentle' });
  e.ctx.location.hostname = 'gfresh.test';
  e.timers.intervals.length = 0;
  e.win.setInterval(() => {}, 50);
  ok(e.timers.intervals[0].ms === 50, 'gentle: first offense gets warning, not force', e.timers.intervals[0].ms);
  for (let i = 0; i < 42; i++) e.api.report({ cat: 'timer-farm', units: 0.01 }); /* become chronic */
  e.timers.intervals.length = 0;
  e.win.setInterval(() => {}, 50);
  ok(e.timers.intervals[0].ms === 250, 'gentle chronic burner (>=40 strikes) now forcibly floored', e.timers.intervals[0].ms);

  e.api.setConfig({ mode: 'off' });
  e.timers.intervals.length = 0;
  e.win.setInterval(() => {}, 10);
  ok(e.timers.intervals[0].ms === 10, 'off: passthrough identical, zero interference', e.timers.intervals[0].ms);
}

/* ---------- 7. overlay tribunal ---------- */
section('extortion overlay tribunal');
{
  const e = makeEnv();
  const guilty = mkEl('div'); guilty.id = 'paywall-gate';
  guilty.className = 'modal-overlay';
  guilty.__cs = { zIndex: '900', position: 'fixed' };
  const innocent = mkEl('div'); innocent.id = 'article';
  const A = e.api;
  ok(A.__looksLikeExtortionOverlay(guilty) === true, 'high-z fixed modal matches extortion signature');
  ok(A.__looksLikeExtortionOverlay(innocent) === false, 'ordinary content div acquitted');
  ok(A.__looksLikeExtortionOverlay(null) === false, 'null defendant rejected');

  e.api.setConfig({ mode: 'monitor' });
  e.doc._q = [guilty];
  A.scanOverlays();
  ok(!guilty.getAttribute('data-atoll-dismissed'), 'monitor: guilty overlay left standing (toll only)');

  e.api.setConfig({ mode: 'strict', overlayDismiss: true });
  e.ctx.location.hostname = 'overlaycourt.test';
  A.scanOverlays();
  ok(guilty.getAttribute('data-atoll-dismissed') === '1', 'strict+dismiss: conviction recorded');
  ok(guilty._styles.some(s => s[0] === 'display' && s[1] === 'none'), 'strict+dismiss: display:none applied');
}

/* ---------- 8. hotkey + HUD cycle ---------- */
section('hotkey cycling');
{
  const e = makeEnv();
  const startMode = e.api.getConfig().mode;
  let prevented = 0;
  const ev = { ctrlKey: true, altKey: true, shiftKey: false, metaKey: false, key: 't', preventDefault() { prevented++; } };
  (e.doc._h.keydown || []).forEach(fn => fn(ev));
  const after = e.api.getConfig().mode;
  ok(after !== startMode, 'Ctrl+Alt+T advanced mode (' + startMode + ' -> ' + after + ')');
  ok(prevented === 1, 'hotkey prevents browser default');
  const evPlain = { ctrlKey: false, altKey: true, shiftKey: false, metaKey: false, key: 't', preventDefault() { prevented = 99; } };
  (e.doc._h.keydown || []).forEach(fn => fn(evPlain));
  ok(prevented === 1 && e.api.getConfig().mode === after, 'plain Alt+T ignored');
  const cyc = e.api.cycleMode();
  ok(['monitor', 'gentle', 'strict', 'off'].indexOf(cyc) !== -1, 'cycleMode lands on a valid mode');
}

/* ---------- 9. day-ledger pruning ---------- */
section('ledger pruning (15-day retention)');
{
  const e = makeEnv();
  e.ls.setItem('atoll:2026-08-01', JSON.stringify({ credits: 500, usd: 5, events: 9 }));
  e.api.report({ cat: 'manual', units: 1 }); /* any report triggers pruneOld */
  ok(e.ls.getItem('atoll:2026-08-01') === null, 'stale day-ledger evicted on write');
  const t = new Date();
  const tk = t.getFullYear() + '-' + String(t.getMonth() + 1).padStart(2, '0') + '-' + String(t.getDate()).padStart(2, '0');
  ok(e.ls.getItem('atoll:' + tk) !== null, "today's ledger survives");
}

/* ---------- 10. guard registration ---------- */
section('universal guard contract');
{
  const { win } = makeEnv();
  ok(Array.isArray(win.__UNIVERSALIZE_GUARDS) && win.__UNIVERSALIZE_GUARDS.length >= 1, 'registered in __UNIVERSALIZE_GUARDS');
  const g = win.__UNIVERSALIZE_GUARDS[win.__UNIVERSALIZE_GUARDS.length - 1]();
  ok(g && typeof g.run === 'boolean' && g.genericSafe === true, 'guard reports {run,genericSafe}', g);
  ok(g.run === true, 'default mode gentle -> guard allows execution');
}

console.log('\n========================================');
console.log(pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);


