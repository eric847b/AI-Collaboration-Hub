'use strict';
/* Cost Advisor harness — probes Modules/25-Cost-Advisor/001-goal-advice.module.user.js */
const fs = require('fs'), vm = require('vm');
const P = 'C:/Users/Eric/OneDrive/Documents/GitHub/ai-chat-websites/Userscripts/AI Chat Userscript Studio/Userscript Suite/Modules/25-Cost-Advisor/001-goal-advice.module.user.js';
let PASS = 0, FAIL = 0;
function t(name, cond, extra) { if (cond) { PASS++; } else { FAIL++; console.log('FAIL ' + name + (extra !== undefined ? ' :: ' + JSON.stringify(extra) : '')); } }

function makeLS() {
  const m = new Map();
  return { m,
    getItem(k) { return m.has(k) ? m.get(k) : null; },
    setItem(k, v) { m.set(k, String(v)); },
    removeItem(k) { m.delete(k); },
    key(i) { return Array.from(m.keys())[i] ?? null; },
    get length() { return m.size; } };
}
function freshEnv(extras) {
  const LS = makeLS();
  const D = { createElement: () => ({ style: {}, textContent: '', appendChild() {}, remove() {} }), documentElement: { appendChild() {} }, body: { appendChild() {} }, addEventListener() {}, readyState: 'complete' };
  const W = { location: { hostname: 'test.example' }, addEventListener() {}, console, document: D, localStorage: LS };
  Object.assign(W, extras || {});
  const ctx = vm.createContext({ window: W, document: D, localStorage: LS, console, setTimeout, clearTimeout, setInterval, clearInterval });
  vm.runInContext(fs.readFileSync(P, 'utf8'), ctx, { timeout: 2000 });
  return { W, I: W.__advisor_internals, API: W.advice_api };
}

console.log('Running Cost Advisor harness…');
const cases = [
  [{ pctUsed: 5,   budget: 60000, promptTokens: 240, savedTokens: 0 }, 'go'],
  [{ pctUsed: 80,  budget: 60000, promptTokens: 240, savedTokens: 0 }, 'advise'],
  [{ pctUsed: 90,  budget: 60000, promptTokens: 240, savedTokens: 0 }, 'hold'],
  [{ pctUsed: 100, budget: 60000, promptTokens: 240, savedTokens: 0 }, 'stop'],
  [{ pctUsed: 95,  budget: 60000, promptTokens: 6000, savedTokens: 0 }, 'switch'],
  [{ pctUsed: 92,  budget: 60000, promptTokens: 240, savedTokens: 9000 }, 'advise'] // credit keeps you out of hold, not full go
];
for (const [input, expect] of cases) {
  const e = freshEnv();
  const a = e.I.advice(input);
  t('advice -> ' + expect, a.action === expect, a);
}
// live-stats pull with siblings
let e = freshEnv({ tqg_api: { stats: () => ({ pctUsed: 77, budget: 60000 }) }, sc_api: { totals: () => ({ inputSaved: 120, outputSaved: 300 }) } });
let st = e.I.pull();
t('pull reads tqg_api.pctUsed', st.pctUsed === 77, st);
t('pull sums sc savedTokens', st.savedTokens === 420, st);
t('pull keeps defaults', st.budget === 60000 && st.promptTokens === 240, st);
t('advice_api exposes decide+current', typeof e.API.decide === 'function' && typeof e.API.advice.current === 'function');
// absent siblings don't throw
e = freshEnv({});
st = e.I.pull();
t('pull safe when siblings absent', st.pctUsed === null && st.budget === 60000, st);
console.log('\nCost Advisor: ' + PASS + ' pass / ' + FAIL + ' fail');
process.exit(FAIL ? 1 : 0);