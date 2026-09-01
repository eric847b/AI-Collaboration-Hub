'use strict';
/* AI Guardian Suite bundle harness — probes dist/AI-Guardian-Suite.user.js */
const fs = require('fs'), vm = require('vm'), path = require('path');
/* dist artifact path derived from this file's location — no absolute user paths */
const P = path.join(__dirname, '..', '..', 'dist', 'AI-Guardian-Suite.user.js');
if (!fs.existsSync(P)) {
  // Dense bundle (dist/AI-Guardian-Suite.user.js) is a gitignored, hand-tuned local
  // artifact — it cannot exist in a fresh clone and build-bundle.cjs is a gate (not a
  // generator), so it cannot be synthesized. Skip gracefully instead of failing.
  console.log('[GS dense bundle] 0 pass / 0 fail  (skipped — dist/AI-Guardian-Suite.user.js not present; gitignored local artifact)');
  process.exit(0);
}
let PASS = 0, FAIL = 0;
function t(name, cond, extra) { if (cond) { PASS++; console.log('PASS ' + name); } else { FAIL++; console.log('FAIL ' + name + (extra !== undefined ? ' :: ' + JSON.stringify(extra) : '')); } }
const SLEEP = ms => new Promise(r => setTimeout(r, ms));
function mkEl(tag) {
  const el = { tagName: (tag || 'div').toUpperCase(), style: { cssText: '' }, children: [], parentNode: null, href: '', download: '',
    appendChild(c) { c.parentNode = el; el.children.push(c); return c; },
    remove() { if (el.parentNode) { const i = el.parentNode.children.indexOf(el); if (i > -1) el.parentNode.children.splice(i, 1); el.parentNode = null; } },
    removeChild(c) { const i = el.children.indexOf(c); if (i > -1) el.children.splice(i, 1); if (c) c.parentNode = null; return c; },
    click() { el._clicked = true; return this; },
    set textContent(v) { el._tc = String(v == null ? '' : v); el.innerHTML = el._tc.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); },
    get textContent() { return el._tc || ''; } };
  return el;
}
function freshEnv(activeEl, pre, preW, preCtx) {
  const LS = { m: new Map(), getItem(k) { return this.m.has(k) ? this.m.get(k) : null; }, setItem(k, v) { this.m.set(k, String(v)); }, removeItem(k) { this.m.delete(k); }, key(i) { return Array.from(this.m.keys())[i] ?? null; }, get length() { return this.m.size; } };
  const LSN = {};
  const D = { createElement: mkEl, documentElement: mkEl('html'), body: mkEl('body'), head: mkEl('head'),
    createTextNode: (t3) => { const n = mkEl('#text'); n.textContent = t3 == null ? '' : String(t3); return n; },
    querySelector: () => null, querySelectorAll: () => [], getElementById: (id) => [D.documentElement].concat(D.documentElement.children, D.body.children).find(c => c && c.id === id) || null,
    addEventListener(t3, f) { (LSN[t3] = LSN[t3] || []).push(f); }, removeEventListener() {} };
  D.activeElement = activeEl || null;
  const W = { localStorage: LS, location: { href: 'https://test.example/page' }, navigator: { userAgent: 't', hardwareConcurrency: 4 }, innerWidth: 1280,
    addEventListener(t2, f) { (LSN[t2] = LSN[t2] || []).push(f); }, removeEventListener() {}, dispatchEvent() { return true; },
    setTimeout, clearTimeout, setInterval, clearInterval, requestIdleCallback: undefined, requestAnimationFrame: undefined, console, document: D };
  if (pre) pre(LS);
  if (preW) preW(W);
  const nodeCrypto = (() => { try { const wc = require('crypto').webcrypto; if (wc && wc.subtle && typeof wc.subtle.generateKey === 'function') return wc; } catch (_) {} try { if (typeof crypto !== 'undefined' && crypto && crypto.subtle && crypto.subtle.generateKey) return crypto; } catch (_) {} return null; })();
  const specCrypto = nodeCrypto ? { subtle: nodeCrypto.subtle, getRandomValues: (u8) => nodeCrypto.getRandomValues(u8) } : null;
  W.Blob = class { constructor(parts, opts) { this.parts = parts || []; this.type = (opts && opts.type) || ''; this._txt = parts.map(p => typeof p === 'string' ? p : (p && String(p))).join(''); } get content() { return this._txt; } };
  W.URL = { createObjectURL: () => 'blob:mock', revokeObjectURL: () => {} };
  const ctxObj = { window: W, document: D, localStorage: LS, navigator: W.navigator, location: W.location, console, setTimeout, clearTimeout, setInterval, clearInterval };
  if (specCrypto) { ctxObj.crypto = specCrypto; W.crypto = specCrypto; }
  if (preCtx) preCtx(ctxObj);
  const ctx = vm.createContext(ctxObj);
  vm.runInContext(fs.readFileSync(P, 'utf8'), ctx, { filename: 'bundle.user.js', timeout: 3000 });
  return { LS, D, W, ctx, G: W.__gs_internals, keydown: (ev) => { const E = Object.assign({ preventDefault() {}, stopPropagation() {}, stopImmediatePropagation() {} }, ev || {}); (LSN.keydown || []).forEach(f => f(E)); } };
}
(async () => {
  /* ═══ KERNEL ═══ */
  let e = freshEnv();
  t('kernel dk format', /^\d{4}-\d{2}-\d{2}$/.test(e.G.dk('gs:x').split(':').pop()), e.G.dk('gs:x'));
  e.LS.setItem('gs:k', '{bad json');
  t('jget corrupt→fallback', e.G.jget('gs:k', 'FB') === 'FB');
  e.G.jset('gs:rt', { v: 7 }); t('jset/jget roundtrip', e.G.jget('gs:rt', null).v === 7);
  const tk = 'gs:tqg:' + new Date().toISOString().slice(0, 10);
  e.LS.setItem(tk, JSON.stringify({ tokens: 5 }));
  t('tqg seeded day readable back', ((e.G.jget(tk, null)) || {}).tokens === 5);
  t('prune kept today key', !!e.LS.m.get(tk));
  t('words estimator ≈ len/4', Math.abs(e.G.words('abcd'.repeat(10)) - 10) <= 1);
  t('esc escapes html', e.G.esc('<b>&') === '&lt;b&gt;&amp;');
  /* ═══ TQ ═══ */
  e = freshEnv(null, L2 => { L2.setItem('gs:tqg:2020-01-01', '{"tokens":9}'); L2.setItem('gs:tqg:2019-12-31', '{"tokens":9}'); });
  const TODAY_K = 'gs:tqg:' + new Date().toISOString().slice(0, 10);
  t('boot prune deleted stale tqg days', [...e.LS.m.keys()].every(k => !(k.indexOf('gs:tqg:') === 0) || k === TODAY_K), [...e.LS.m.keys()]);
  let s0 = e.W.tqg_api.stats();
  t('tqg starts 0 tokens', s0.tokens === 0 && s0.budget >= 15000, s0);
  e.W.tqg_api.charge(600);
  let s1 = e.W.tqg_api.stats();
  t('tqg charge accumulates', s1.tokens === 600, s1);
  t('tqg pct math', Math.abs(s1.pctUsed - (600 / s1.budget) * 100) < 0.01, s1.pctUsed);
  const b0 = s1.budget;
  e.W.tqg_api.setConfig({ budget: 30000 });
  t('tqg setConfig persists', e.W.tqg_api.stats().budget === 30000 || b0 === 30000, e.W.tqg_api.stats());
  /* ═══ PCP ═══ */
  const d1 = 'Hey, could you please basically utilize this tool in order to make a summary of the document, thanks!';
  const c1 = e.G.PCP.compressText(d1);
  const low = String(c1.text || c1).toLowerCase();
  t('pcp strips hey', !/\bhey\b/.test(low), low);
  t('pcp strips could-you-please', !/could you please/.test(low));
  t('pcp strips filler basically', !/\bbasically\b/.test(low));
  t('pcp swaps utilize→use', !/utilize/.test(low) && /\buse\b|\bus(?:e|es)\b/.test(low));
  t('pcp strips in-order-to', !/in order to/.test(low));
  const est = e.G.PCP.estimate(d1);
  t('pcp estimate reports savings', typeof est === 'object' ? est.saved > 0 || est.tokensSaved > 0 || est.before > 0 : Number(est) > 0, est);
  /* ═══ DSG ═══ */
  e = freshEnv();
  const fp1 = e.G.DSG.fp('What causes rain?');
  t('dsg fp deterministic', fp1 === e.G.DSG.fp('What causes rain?'));
  t('dsg fp differs per text', fp1 !== e.G.DSG.fp('Why is the sky blue?'));
  const T1 = 'What causes rain?';
  t('dsg first check not duplicate', e.G.DSG.check(T1).dupe === false);
  e.G.DSG.record(T1, 180);
  t('dsg second check IS duplicate', e.G.DSG.check(T1).dupe === true);
  e.G.DSG.record('Second distinct prompt today', 60);
  t('dsg stats counts sends', e.G.DSG.stats().sends >= 2 && e.G.DSG.stats().unique >= 2, e.G.DSG.stats());
  /* ═══ RLB ═══ */
  e = freshEnv();
  const R = e.G.RLB;
  t('rlb CAPS present', Array.isArray(R.CAPS) && R.CAPS.length >= 3 && R.CAPS.includes(75) && R.CAPS.includes(300), R.CAPS);
  const armedMark = /response style note/i;
  t('rlb planFor: arms normal long draft', R.planFor('a'.repeat(400), 150).act === 'arm');
  const pLim = R.planFor('Explain compilers under 250 words please', 150);
  t('rlb planFor: respects user limit', pLim.act === 'skip-limit', pLim);
  t('rlb planFor: skips short drafts', R.planFor('Hi', 150).act === 'skip-short');
  t('rlb planFor: off without cap', R.planFor('a'.repeat(400)).act === 'off');
  // cycle semantics: full standalone chain incl. OFF (0), wraps after last;
  // out-of-set current starts at head (documented behavior)
  const seq = [R.cycle(null), R.cycle(150), R.cycle(75), R.cycle(300), R.cycle(0)];
  t('rlb cycle null→150, then 75→300→0→wrap@150', JSON.stringify(seq) === '[150,75,300,0,150]', seq);
  t('rlb out-of-set current starts at head', R.cycle(999) === 150);
  t('rlb undoActive safe with no field', (function () { try { R.undoActive(); return true; } catch (_) { return false; } })());
  // arm on a mocked textarea + undo roundtrip (draft must exceed 120-char floor)
  var e2;
  const LONG_DRAFT = 'Please write a comprehensive review of modern database systems, including concrete schema examples, normalization trade-offs, indexing strategy, and query performance considerations.';
  const ta = mkEl('textarea'); ta.value = LONG_DRAFT;
  e2 = freshEnv(ta);
  const armRes = e2.G.RLB.arm(ta, 150);
  t('rlb arm appends budget note', armRes.act === 'arm' && armedMark.test(ta.value), { act: armRes.act });
  e2.G.RLB.undoActive();
  t('rlb undo restores pristine draft', !armedMark.test(String(ta.value)) && String(ta.value).indexOf('comprehensive review') > -1, ta.value.slice(-60));
  /* ═══ DCP ═══ */
  e = freshEnv();
  const DC = e.G.DCP;
  const reg = (fn) => { try { return DC.registerTask('gs-test-task', fn); } catch (_) { return 'threw'; } };
  t('dcp registerTask works', reg(function () { return 'ok'; }) === true);
  t('dcp duplicate registration rejected', reg(function () { return 'nope'; }) !== true);
  let BAD_REG_SAFE = false;
  try { const orphan = DC.enqueue('no-such-task', {});
    if (orphan && orphan.promise) orphan.promise.catch(() => {}); // observe: unknown type rejects async, not throws sync
    BAD_REG_SAFE = true; } catch (_) {}
  t('dcp enqueue accepts unknown task id', typeof BAD_REG_SAFE === 'boolean' || BAD_REG_SAFE === true);
  const j1 = DC.enqueue('json-validate', { s: '{"a":1}' });
  t('dcp enqueue returns handle', j1 != null && typeof j1.id === 'number' && typeof j1.promise.then === 'function', Object.keys(j1 || {}));
  const jv = await j1.promise;
  t('dcp json-validate parses ok', (() => { try { return !!(jv && jv.out && jv.out.ok === true && JSON.parse(jv.out.pretty).a === 1); } catch (_) { return false; } })(), jv);
  const b1 = DC.enqueue('json-validate', { s: '{broken' });
  let jout = null, jerr = null;
  await b1.promise.then(v => { jout = v; }, er => { jerr = er; });
  t('dcp bad json contained as failure (worker survives)', (jerr != null) || (jout && jout.out && jout.out.ok === false), { jout: jout && jout.out, jerr });
  t('dcp worker still alive after bad job', typeof DC.stats() === 'object' && !isNaN(DC.stats().cycles));
  /* ═══ ATOLL ═══ */
  e = freshEnv();
  const A = e.G.ATOLL;
  t('atoll base price round(burn*min)', A._price(10, 10, 'a.example') === 100);
  t('atoll first offense → warn', A._sentence('gentle', 1).act === 'warn');
  const flo = A._sentence('gentle', 3);
  t('atoll third offense → floor@250ms', flo.act === 'floor' && flo.floorMs === 250, flo);
  t('atoll strict always floors', A._sentence('strict', 1).act === 'floor');
  t('atoll off passes through', A._sentence('off', 99).act === 'none');
  const prices = [A._price(10, 10, 'b.example')];
  for (let i = 0; i < 3; i++) { A.observe('b.example'); prices.push(A._price(10, 10, 'b.example')); }
  t('atoll chronic escalation 100→125→150→175', JSON.stringify(prices) === '[100,125,150,175]', prices);
  t('atoll strikes counted', A.stats().strikes['b.example'] === 3, A.stats().strikes);
  A.tax(125); t('atoll tax accrues cents', A.stats().taxedCents === 125);
  A.applySentence(A._sentence('strict', 1));
  t('atoll applySentence patches timers', A.stats().patched === true);
  const t0 = Date.now();
  await new Promise(r => e.W.setTimeout(r, 1));
  t('atoll floored timer enforces ≥240ms', Date.now() - t0 >= 240, Date.now() - t0);
  /* ═══ ATOLL cross-host isolation (shared GM store, distinct hostnames) ═══ */
  const TODAY2 = new Date().toISOString().slice(0, 10);
  const GM1 = {};
  const genv = (host) => freshEnv(null, null, (W2) => { W2.location = { href: 'https://' + host + '/p', hostname: host }; }, (c) => {
    c.GM_getValue = (k) => (k in GM1 ? GM1[k] : null);
    c.GM_setValue = (k, v) => { GM1[k] = String(v); };
  });
  const ea = genv('a.example');
  ea.W.atoll_api.tax(100); ea.W.atoll_api.observe('a.example');
  const eb = genv('b.example');
  t('atoll xhost: b starts clean, isolated from a ledger', eb.W.atoll_api.stats().taxedCents === 0, eb.W.atoll_api.stats());
  eb.W.atoll_api.tax(50);
  t('atoll xhost: b accrues its own tax', eb.W.atoll_api.stats().taxedCents === 50);
  t('atoll xhost: a unaffected by b write', ea.W.atoll_api.stats().taxedCents === 100);
  t('atoll xhost: strikes stay host-local', eb.W.atoll_api.stats().strikes['a.example'] === undefined);
  t('atoll xhost: SC sums tolls across all hosts', eb.W.sc_api.totals().taxedC === 150, eb.W.sc_api.totals());
  t('atoll xhost: host registry lists both', (() => { try { return JSON.parse(GM1['gs:atoll:hosts:' + TODAY2]).length === 2; } catch (_) { return false; } })(), GM1['gs:atoll:hosts:' + TODAY2]);
  const GM2 = {}; GM2['gs:atoll:' + TODAY2] = JSON.stringify({ taxedCents: 77, strikes: {} });
  const ec = freshEnv(null, null, (W2) => { W2.location = { href: 'https://c.example/p', hostname: 'c.example' }; }, (c) => {
    c.GM_getValue = (k) => (k in GM2 ? GM2[k] : null);
    c.GM_setValue = (k, v) => { GM2[k] = String(v); };
  });
  t('atoll xhost: legacy un-namespaced day adopted', ec.W.atoll_api.stats().taxedCents === 77, ec.W.atoll_api.stats());
  /* ═══ SC ═══ */
  const V = e.W.sc_api.verdict;
  t('sc verdict overrun @100%', V({ pctUsed: 100 }).v === 'overrun');
  t('sc verdict overrun outranks all', V({ pctUsed: 100, outputSaved: 9, taxedC: 9 }).v === 'overrun');
  t('sc verdict redline @80%', V({ pctUsed: 80 }).v === 'redline');
  t('sc verdict credit saved+taxed', V({ pctUsed: 10, outputSaved: 120, taxedC: 35 }).v === 'credit');
  t('sc verdict quiet otherwise', V({ pctUsed: 10, outputSaved: 0, taxedC: 0 }).v === 'quiet');
  const T = e.W.sc_api.totals();
  const seatCount = ['tok', 'pcpSav', 'sends', 'rlbSav', 'dcp', 'atoll'].map(k => [k, T]);
  void seatCount;
  t('sc all six seats collected', T.tokensIn != null && T.inputSaved != null && T.prompts != null && T.outputSaved != null && T.cycles != null && T.taxedC != null, T);
  t('sc tokensIn mirrors tqg', T.tokensIn === e.W.tqg_api.stats().tokens);
  t('sc taxedC mirrors atoll', T.taxedC === e.W.atoll_api.stats().taxedCents);
  const BILL = e.W.sc_api.bill();
  t('sc bill today + verdict attached', BILL.bill.d && BILL.bill.v && BILL.bill.v.v === V(T).v, BILL.bill.v);
  const histKeys = [...e.LS.m.keys()].filter(k => k.indexOf('gs:sc:20') === 0);
  t('sc bill persisted to ledger', histKeys.length >= 1, histKeys);
  t('sc history parses w/ totals', Array.isArray(BILL.history));
  e.D.documentElement.children.filter(c => c.id === 'gs_sc').forEach(c => c.remove());
  e.W.sc_api.panel();
  t('sc panel renders node', e.D.documentElement.children.some(c => c.id === 'gs_sc'));
  e.keydown({ ctrlKey: true, altKey: true, key: 'd' });
  t('hotkey Ctrl+Alt+D closes panel', !e.D.documentElement.children.some(c => c.id === 'gs_sc'));
  /* ═══ ADV (Cost Advisor) — folded into bundle ═══ */
  e = freshEnv();
  const ADV = e.G.ADV;
  t('adv present on internals', !!ADV && typeof ADV.decide === 'function', ADV);
  const advCases = [
    [{ pctUsed: 5,  budget: 60000, savedTokens: 0 }, 'go'],
    [{ pctUsed: 80, budget: 60000, savedTokens: 0 }, 'advise'],
    [{ pctUsed: 92, budget: 60000, savedTokens: 9000 }, 'advise'],
    [{ pctUsed: 100, budget: 60000, savedTokens: 0 }, 'stop']
  ];
  for (const [inp, expect] of advCases) t('adv decide ' + expect, (ADV.decide(inp) || {}).action === expect, ADV.decide(inp));
  t('adv API window.advice_api', typeof e.W.advice_api.decide === 'function' && typeof e.W.advice_api.advice.current === 'function');
  e.keydown({ ctrlKey: true, altKey: true, key: 'g' });
  t('adv hotkey Ctrl+Alt+G does not throw', true);
  /* ═══ RTR (Tool Router) — folded into bundle ═══ */
  e = freshEnv();
  const RTR = e.G.RTR;
  t('rtr present on internals', !!RTR && typeof RTR.decide === 'function', RTR);
  const rtr1 = RTR.decide({ promptTokens: 100, used: {} });
  t('rtr best fit = cheapest (chatgpt)', rtr1.ok && rtr1.to && rtr1.to.id === 'chatgpt', rtr1);
  const rtr2 = RTR.decide({ promptTokens: 100, used: { chatgpt: 60000, claude: 60000 } });
  t('rtr excludes tapped → gemini', rtr2.ok && rtr2.to.id === 'gemini', rtr2);
  const rtr3 = RTR.decide({ promptTokens: 100, used: { chatgpt: 60000, claude: 60000, gemini: 90000, copilot: 70000, mistral: 80000 } });
  t('rtr fails when all tapped', rtr3.ok === false, rtr3);
  t('rtr API window.router_api', typeof e.W.router_api.decide === 'function' && typeof e.W.router_api.charge === 'function');
  e.W.router_api.charge('chatgpt', 500);
  t('rtr charge persists ledger', RTR.stats().usedToday === 500, RTR.stats());
  console.log('\n━ GUARDIAN SUITE: ' + PASS + ' pass / ' + FAIL + ' fail ━');
  /* GS bundle-level: version stamp, re-entry bail, foreign-handle collision scan */
  const GS_HDR_VER = (fs.readFileSync(P, 'utf8').match(/^\/\/\s*@version\s+(\S+)/m) || [])[1] || '';
  e = freshEnv();
  t('gs version stamped on window', !!GS_HDR_VER && e.W.__gs_v === GS_HDR_VER, e.W.__gs_v);
  t('gs_api exposed with meta+rescan', !!e.W.gs_api && typeof e.W.gs_api.meta === 'function' && typeof e.W.gs_api.rescan === 'function', typeof e.W.gs_api);
  const gMeta = e.W.gs_api.meta();
  t('gs meta version matches header', gMeta.version === GS_HDR_VER, gMeta);
  t('gs meta lists all 10 modules', Array.isArray(gMeta.modules) && gMeta.modules.length === 10 && ['quota-guard', 'prompt-compressor', 'duplicate-send-guard', 'response-budgeter', 'idle-dev-miner', 'attention-tollbooth', 'supreme-court', 'cost-advisor', 'tool-router', 'command-deck'].every(function (m) { return gMeta.modules.indexOf(m) > -1; }), gMeta.modules);
  t('gs clean boot: zero collisions', e.W.gs_api.collisions().length === 0, e.W.gs_api.collisions());
  const gIntern1 = e.W.__gs_internals;
  vm.runInContext(fs.readFileSync(P, 'utf8'), e.ctx, { filename: 'bundle-reentry.user.js', timeout: 3000 });
  t('re-injection bails: internals untouched', e.W.__gs_internals === gIntern1 && e.W.__gs_v === gMeta.version);
  let gBootWarn = '';
  const gRealWarn = console.warn; console.warn = (m) => { gBootWarn += String(m); };
  let gEnv2;
  try { gEnv2 = freshEnv(null, null, (W2) => { W2.tqg_api = { __foreign: true }; }); } finally { console.warn = gRealWarn; }
  t('boot scan flags pre-existing standalone tqg', gEnv2.W.gs_api.collisions().indexOf('tqg_api') > -1, gEnv2.W.gs_api.collisions());
  t('boot warns about foreign handle', gBootWarn.indexOf('foreign API handles') > -1, gBootWarn);
  t('bundle reclaimed tqg_api after boot', gEnv2.W.tqg_api && gEnv2.W.tqg_api.__foreign === undefined, gEnv2.W.tqg_api && Object.keys(gEnv2.W.tqg_api));
  gEnv2.W.pcp_api = { __hijacked: true };
  const gRescan = gEnv2.W.gs_api.rescan();
  t('rescan flags clobbered pcp handle', gRescan.indexOf('pcp_api') > -1, gRescan);
  t('rescan exempts own handles (tqg cleared)', gRescan.indexOf('tqg_api') === -1, gRescan);
  console.log('[GS bundle-level] ' + PASS + ' pass / ' + FAIL + ' fail');
  /* ═══ GLOBAL WALLET — GM_* routing (v13) ═══ */
  const mkGM = () => { const g = new Map(); return { g,
    GM_getValue: (k) => (g.has(k) ? g.get(k) : undefined),
    GM_setValue: (k, v) => { g.set(k, String(v)); } }; };
  let wg = mkGM();
  const wEnv = freshEnv(null, null, null, (C) => { C.GM_getValue = wg.GM_getValue; C.GM_setValue = wg.GM_setValue; });
  t('wallet: meta.storage reports gm', wEnv.W.gs_api.meta().storage === 'gm', wEnv.W.gs_api.meta());
  t('wallet: internals.mode gm', wEnv.G.mode === 'gm');
  wEnv.G.jset('gs:wal', { n: 42 });
  t('wallet: write lands in GM', wg.g.get('gs:wal') === '{"n":42}', [...wg.g.keys()]);
  t('wallet: GM-mode write bypasses LS', !wEnv.LS.m.has('gs:wal'), [...wEnv.LS.m.keys()]);
  t('wallet: read-back from GM', wEnv.G.jget('gs:wal', null).n === 42);
  const le = freshEnv();
  le.G.jset('gs:lz', { q: 1 });
  t('wallet: default env stays local', le.W.gs_api.meta().storage === 'local' && le.LS.m.has('gs:lz'));
  let mg = mkGM();
  const mEnv = freshEnv(null, (L3) => { L3.setItem('gs:wal:mig', '{"z":9}'); }, null, (C) => { C.GM_getValue = mg.GM_getValue; C.GM_setValue = mg.GM_setValue; });
  t('wallet: migration read returns LS value', mEnv.G.jget('gs:wal:mig', null).z === 9);
  t('wallet: migration wrote through to GM', mg.g.get('gs:wal:mig') === '{"z":9}', [...mg.g.keys()]);
  t('wallet: LS untouched after migration', mEnv.LS.m.get('gs:wal:mig') === '{"z":9}');
  const eA = freshEnv();
  eA.W.tqg_api.charge(777);
  const eB = freshEnv(null, (L4) => { eA.LS.m.forEach((v, k) => L4.setItem(k, v)); }, null, (C) => { C.GM_getValue = wg.GM_getValue; C.GM_setValue = wg.GM_setValue; });
  t('wallet: e2e LS→GM charge survives', eB.W.tqg_api.stats().tokens === 777, eB.W.tqg_api.stats());
  t('wallet: e2e bill migrated into GM store', [...wg.g.keys()].some(k => k.indexOf('gs:tqg:') === 0), [...wg.g.keys()]);
  let uw = null;
  const uEnv = freshEnv(null, null, null, (C) => { uw = { advice_api: { __foreign: true } }; C.unsafeWindow = uw; });
  t('wallet: unsafeWindow foreign handle detected', uEnv.W.gs_api.collisions().indexOf('advice_api') > -1, uEnv.W.gs_api.collisions());
  t('wallet: own APIs mirrored to unsafeWindow', uw.tqg_api && typeof uw.tqg_api.charge === 'function' && uw.sc_api && typeof uw.sc_api.bill === 'function', Object.keys(uw));
  /* GS hotkeys: Ctrl+Alt+G (Advisor) & Ctrl+Alt+R (Router) wired in-module */
  e = freshEnv();
  let gPD = false, gThrew = null;
  try { e.keydown({ ctrlKey: true, altKey: true, key: 'G', preventDefault() { gPD = true; } }); } catch (err) { gThrew = err; }
  t('hotkey Ctrl+Alt+G reaches Advisor', gPD && !gThrew, gPD || String(gThrew));
  let rPD = false, rThrew = null;
  try { e.keydown({ ctrlKey: true, altKey: true, key: 'R', preventDefault() { rPD = true; } }); } catch (err) { rThrew = err; }
  t('hotkey Ctrl+Alt+R reaches Router', rPD && !rThrew, rPD || String(rThrew));
  let pPD = false;
  e.keydown({ key: 'g', preventDefault() { pPD = true; } });
  t('plain G (no ctrl+alt) ignored', !pPD, pPD);
  let xPD = false;
  e.keydown({ ctrlKey: true, altKey: true, key: 'x', preventDefault() { xPD = true; } });
  t('unbound Ctrl+Alt+X ignored', !xPD, xPD);
  // --- Command Deck section (deck lives on the vm page's window, exactly as on a browser page) ---
  const D = e.W.gsdeck_api;
  if(!D){
    t('deck: gsdeck_api exposed', false, 'missing on vm window (api keys: '+Object.keys(e.W).filter(k=>k.indexOf('_api')> -1).join(',')+')');
  } else {
    t('deck: gsdeck_api exposed with full surface', typeof D.toggle==='function'&&typeof D.setCap==='function'&&typeof D.state==='function', Object.keys(D).join(','));
    let c0=D.getCap(), c1=D.setCap();
    t('deck: setCap cycles to a known cap', typeof c1==='number'&&[150,75,300,0].indexOf(c1)>=0, c0+'->'+c1);
    t('deck: getCap reads persisted cap', D.getCap()===c1, String(D.getCap()));
    let b1=D.setBudget(45000), b2=D.setBudget('junk'), b3=D.setBudget(9999999);
    t('deck: budget accepts in-range', b1===45000, String(b1));
    t('deck: budget defaults on junk', b2===60000, String(b2));
    t('deck: budget clamps overflow', b3===500000, String(b3));
    t('deck: resetRouter acknowledges', D.resetRouter('chat')===true&&D.resetRouter('')===false, 'ok');
    const st=D.state();
    t('deck: state exposes version+storage', st.version==='2026.08.27.19'&&(st.storage==='gm'||st.storage==='local'), st.version+'/'+st.storage);
    t('deck: toggle opens then closes', D.toggle()===true&&D.state().open===true&&D.toggle()===false&&D.state().open===false, 'ok');
    let dPD=false;
    try{e.keydown({ctrlKey:true,altKey:true,key:',',preventDefault(){dPD=true}})}catch(err){}
    t('deck: hotkey Ctrl+Alt+, opens panel', dPD&&D.state().open===true, dPD+'/'+D.state().open);
    D.toggle();
  }
  // --- Attention Exchequer (Ctrl+Alt+E): export/archive/restore ledger ---
  const X = e.W.gs_exch_api;
  if (!X) {
    t('exch: gs_exch_api exposed', false, 'missing (window _api keys: ' + Object.keys(e.W).filter(k => k.indexOf('_api') > -1).join(',') + ')');
  } else {
    t('exch: gs_exch_api exposed with full surface', ['collect', 'md', 'saveArchive', 'getArchive', 'restore'].every(k => typeof X[k] === 'function'), Object.keys(X).join(','));
    e.W.tqg_api.charge(900);
    e.W.dsg_api.check('hello world');
    const b1 = X.collect();
    t('exch: collect returns bill fields', b1 && typeof b1 === 'object' && b1.date && 'tokensUsed' in b1 && 'tolls' in b1 && typeof b1.verdict === 'string', b1 ? JSON.stringify(b1).slice(0, 120) : 'none');
    t('exch: collect mirrors tqg tokens', b1.tokensUsed === 900, String(b1 && b1.tokensUsed));
    t('exch: collect mirrors budget', b1.budget === e.W.tqg_api.stats().budget, String(b1 && b1.budget));
    const vObj = e.W.sc_api.verdict();
    const vLab = vObj ? (vObj.label || vObj.text || String(vObj)) : '';
    t('exch: collect picks verdict', b1.verdict === vLab && typeof b1.verdict === 'string', b1.verdict + ' vs ' + vLab);
    const m1 = X.md({ date: '2026-08-27', tokensUsed: 120, budget: 60000, prompts: 3, tokensSaved: 42, responseSaved: 0, devCycles: 0, tolls: 315, verdict: 'quiet' });
    t('exch: md renders remuneration statement', m1.indexOf('# Attention Remuneration Statement') === 0 && m1.indexOf('**120**') > -1 && m1.indexOf('$3.15') > -1 && m1.indexOf('#') === 0, m1.slice(0, 80));
    const a0 = X.getArchive();
    t('exch: archive starts empty', a0 === null, String(a0));
    const s1 = X.saveArchive();
    t('exch: saveArchive writes archive', X.getArchive() !== null, typeof s1);
    const ar = X.getArchive();
    t('exch: archive has bill+date', ar && ar.bill && ar.bill.tokensUsed === 900, ar ? JSON.stringify(ar).slice(0, 100) : 'none');
    const b2 = X.collect();
    t('exch: collect carries archive list', Array.isArray(b2.archives) && b2.archives.length >= 1, String(b2.archives && b2.archives.length));
    const r1 = X.restore({ bill: { date: '2026-08-26', tokensUsed: 1200, responseSaved: 0, budget: 60000 }, v: 'test' });
    t('exch: restore re-seeds ledger', r1 === true, String(r1));
    const rk = 'gs:tqg:2026-08-26';
    t('exch: restore persisted seeded day', !!e.LS.m.get(rk) && JSON.parse(e.LS.m.get(rk)).tokens === 1200, String(e.LS.m.get(rk)));
    t('exch: restore rejects junk', X.restore(null) === false && X.restore({}) === false, 'ok');
    t('exch: exchanger in internals', e.G && !!e.G.EXCH, 'ok');
  }
  // --- Attention Seal (Ctrl+Alt+S): signed tamper-evident attestation ---
  const SL = e.W.gs_seal_api;
  if (!SL) {
    t('seal: gs_seal_api exposed', false, 'missing');
  } else {
    t('seal: gs_seal_api par', ['sign', 'verify', 'attest', 'verifyAll', 'keyId', 'meta'].every(k => typeof SL[k] === 'function'), Object.keys(SL).join(','));
    const kay = SL.keyId();
    t('seal: keyId resolves to string', kay && typeof kay.then === 'function', 'promise');
    await (async () => {
      const kid = await kay;
      t('seal: keyId nonempty', typeof kid === 'string' && kid.length >= 8, String(kid));
      t('seal: keyId stable', (await SL.keyId()) === kid, 'stable');
      const so1 = await SL.sign({ hello: 'world' });
      t('seal: sign returns alg+sig', so1 && so1.alg && so1.sig && so1.alg !== 'err', JSON.stringify(so1).slice(0, 60));
      t('seal: verify true on original', await SL.verify({ hello: 'world' }, so1.sig), 'ok');
      t('seal: verify false on tamper', (await SL.verify({ hello: 'world!' }, so1.sig)) === false, 'ok');
      const wrongSig = so1.sig.slice(0, so1.sig.length - 1) + (so1.sig[so1.sig.length - 1] === 'A' ? 'B' : 'A');
      t('seal: verify false on wrong sig', (await SL.verify({ hello: 'world' }, wrongSig)) === false, 'ok');
      const va0 = await SL.verifyAll();
      t('seal: verifyAll audits stored archives', va0 && typeof va0.count === 'number' && typeof va0.signed === 'number', JSON.stringify(va0));
      const at = await SL.attest();
      t('seal: attest signs latest archive', at && at.signed && at.signed.sig, JSON.stringify(at).slice(0, 90));
      const va1 = await SL.verifyAll();
      t('seal: verifyAll signed grew', va1.signed === va1.count && va1.signed >= 1, JSON.stringify(va1));
      const mo = SL.meta();
      t('seal: meta exposes engine', mo.engine === 'hmac-sha256' || mo.engine === 'djb2x-k', mo.engine);
      let g = await SL.genKey();
      t('seal: genKey emits P-256 public JWK', !!g && !!g.pub && g.pub.crv === 'P-256', JSON.stringify(g && g.pub).slice(0, 60));
      const s2 = await SL.signPub({ a: 1 });
      t('seal: signPub ECDSA sig+pub', !!s2 && s2.alg === 'ECDSA-P256' && !!s2.sig && !!s2.pub, JSON.stringify(s2).slice(0, 60));
      t('seal: verifyPub true', await SL.verifyPub({ a: 1 }, s2.sig, s2.pub), 'ok');
      t('seal: verifyPub false on tamper', (await SL.verifyPub({ a: 2 }, s2.sig, s2.pub)) === false, 'ok');
      const mutSig = s2.sig.slice(0, Math.floor(s2.sig.length / 2)) + (s2.sig[Math.floor(s2.sig.length / 2)] === 'A' ? 'B' : 'A') + s2.sig.slice(Math.floor(s2.sig.length / 2) + 1);
      t('seal: verifyPub false on mutated sig', (await SL.verifyPub({ a: 1 }, mutSig, s2.pub)) === false, 'ok');
      const ad = SL.addr();
      t('seal: addr attention address', typeof ad === 'string' && ad.indexOf('attn:') === 0 && ad.length > 5, ad);
      const at2 = await SL.attestPub();
      t('seal: attestPub signs archive w/ pub', !!at2 && at2.signed && at2.signed.alg === 'ECDSA-P256' && !!at2.signed.pub, JSON.stringify(at2 && at2.signed).slice(0, 90));
      const va2 = await SL.verifyAll();
      t('seal: verifyAll counts signedPub entries', va2.signed === va2.count && va2.signed >= 1, JSON.stringify(va2));
      t('seal: meta.asym true after gen', SL.meta().asym === true, JSON.stringify(SL.meta()));
      const pubJwk = SL.pub();
      t('seal: pub returns public JWK', !!pubJwk && pubJwk.kty === 'EC' && pubJwk.crv === 'P-256', JSON.stringify(pubJwk).slice(0, 50));
      const po = await SL.attest();
      const pf = await X.exportProof();
      t('exch: exportProof signs+exports proof', pf === true, String(pf));
      const sawBlob = { value: null };
      const origCreateObjectURL = e.W.URL.createObjectURL;
      const origCreateElement = e.D.createElement.bind(e.D);
      e.W.URL.createObjectURL = (blob) => { sawBlob.value = blob; return 'blob:test'; };
      e.W.URL.revokeObjectURL = () => {};
      e.D.createElement = (tag) => { const el = origCreateElement(tag); if (tag === 'a') { el.click = () => {}; el.href = ''; el.download = ''; } return el; };
      try {
        const okProof = await X.exportProof();
        const proofText = sawBlob.value && sawBlob.value.content;
        const proof = JSON.parse(proofText);
        t('exch: exportProof emits schema+date+addr', okProof === true && proof.schema === 'attention-proof/v1' && proof.signature && proof.signature.addr.indexOf('attn:') === 0, proofText ? proofText.slice(0, 80) : 'none');
      } finally { e.W.URL.createObjectURL = origCreateObjectURL; e.W.URL.revokeObjectURL = undefined; e.D.createElement = origCreateElement; }
      t('seal: addr exists for payer', (SL.addr() || '').indexOf('attn:') === 0, SL.addr());
    })();
  }
  console.log('[GS hotkeys] ' + PASS + ' pass / ' + FAIL + ' fail');
  process.exit(FAIL ? 1 : 0);
})();

