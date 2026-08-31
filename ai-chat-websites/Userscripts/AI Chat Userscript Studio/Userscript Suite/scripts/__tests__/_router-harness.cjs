'use strict';
/* Tool Router harness — probes Modules/26-Tool-Router/001-tool-router.module.user.js */
const fs = require('fs'), vm = require('vm');
const P = 'C:/Users/Eric/OneDrive/Documents/GitHub/ai-chat-websites/Userscripts/AI Chat Userscript Studio/Userscript Suite/Modules/26-Tool-Router/001-tool-router.module.user.js';
let PASS = 0, FAIL = 0;
function t(name, cond, extra) { if (cond) { PASS++; } else { FAIL++; console.log('FAIL ' + name + (extra !== undefined ? ' :: ' + JSON.stringify(extra) : '')); } }
function makeLS() {
  const m = new Map();
  return { m, getItem(k) { return m.has(k) ? m.get(k) : null; }, setItem(k, v) { m.set(k, String(v)); }, removeItem(k) { m.delete(k); }, key(i) { return Array.from(m.keys())[i] ?? null; }, get length() { return m.size; } };
}
function freshEnv(extras) {
  const LS = makeLS();
  const D = { createElement: () => ({ style: {}, textContent: '', appendChild() {}, remove() {} }), documentElement: { appendChild() {} }, body: { appendChild() {} }, addEventListener() {}, readyState: 'complete' };
  const W = { location: { hostname: 'test.example' }, addEventListener() {}, console, document: D, localStorage: LS };
  Object.assign(W, extras || {});
  const ctx = vm.createContext({ window: W, document: D, localStorage: LS, console, setTimeout, clearTimeout, setInterval, clearInterval });
  vm.runInContext(fs.readFileSync(P, 'utf8'), ctx, { timeout: 2000 });
  return { LS, W, API: W.router_api, I: W.__router_internals };
}

console.log('Running Tool Router harness…');
const e = freshEnv();

/* pure core: cheapest fit with none used → Gemini (96000 > 90000? pick min-capacity proc holding headroom; CATALOG min is ChatGPT 60000) */
let r = e.I.route({ promptTokens: 100, used: {}, minFree: 0 });
t('route picks cheapest provider with headroom', r.ok && r.to && r.to.id === 'chatgpt' && r.to.left === 60000, r);

/* exclude chatgpt (used up) → claude */
r = e.I.route({ promptTokens: 100, used: { chatgpt: 60000 }, minFree: 0 });
t('route excludes tapped-out chatgpt → claude', r.ok && r.to.id === 'claude', r);

/* all tapped → not ok */
r = e.I.route({ promptTokens: 100, used: { chatgpt: 60000, claude: 60000, gemini: 90000, copilot: 70000, mistral: 80000 }, minFree: 0 });
t('route fails when all tapped', r.ok === false, r);

/* budget gate: provider with less leftover than budget is excluded */
r = e.I.route({ promptTokens: 100, used: {}, minFree: 0, budget: 65000 });
t('route budget gate excludes sub-budget providers', r.ok && r.to.id === 'copilot' /* cheapest ≥65000: copilot 70000 < mistral 80000 < gemini 90000 */, r);

/* ledger roundtrip + charge */
e.API.charge('chatgpt', 500);
t('charge records into ledger', e.I.loadDay('chatgpt').used === 500, e.I.loadDay('chatgpt'));
e.API.charge('chatgpt', 500);
t('charge accumulates', e.I.loadDay('chatgpt').used === 1000);
e.API.reset('chatgpt');
t('reset zeroes ledger', e.I.loadDay('chatgpt').used === 0);

/* catalog exposes providers */
const cat = e.API.catalog();
t('catalog exposes 5 providers', Array.isArray(cat) && cat.length === 5 && cat[0].id === 'chatgpt', cat);

console.log('\nTool Router: ' + PASS + ' pass / ' + FAIL + ' fail');
process.exit(FAIL ? 1 : 0);