/* Functional harness for the 21-Quota-Saving modules (keep as regression test; run: node scripts/__tests__/_quota-harness.cjs). */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const DIR = path.join(__dirname, '..', '..', 'Modules', '21-Quota-Saving');

function makeEnv() {
  const listeners = {};
  const store = new Map();
  const mkEl = () => {
    const children = [];
    const el = {
      style: {}, setAttribute() {}, remove() {}, contains() { return false; },
      textContent: '', isConnected: true,
      onclick: null,
      get firstChild() { return children[0] || null; },
      get childNodes() { return children; },
      appendChild(c) { children.push(c); return c; },
      getBoundingClientRect: () => ({ left: 8, top: 8, width: 100, height: 30 })
    };
    return el;
  };
  const sandbox = {
    console,
    setTimeout, clearTimeout, setInterval, clearInterval,
    localStorage: {
      getItem: k => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => store.set(k, String(v)),
      removeItem: k => store.delete(k),
      get length() { return store.size; },
      key: i => Array.from(store.keys())[i]
    },
    Event: class { constructor(t) { this.type = t; } },
    InputEvent: class { constructor(t) { this.type = t; } },
    addEventListener(type, fn) { (listeners['win:' + type] = listeners['win:' + type] || []).push(fn); },
    removeEventListener() {},
    confirm: () => true,
    prompt: () => null
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  sandbox.document = {
    readyState: 'complete',
    body: mkEl(),
    documentElement: mkEl(),
    addEventListener: (type, fn) => { (listeners[type] = listeners[type] || []).push(fn); },
    createElement: () => mkEl(),
    createTextNode: t => ({ textContent: t }),
    querySelectorAll: () => [],
    execCommand: () => true
  };
  return { sandbox, listeners, window: sandbox.window, document: sandbox.document, localStorage: sandbox.localStorage, Event: sandbox.Event, InputEvent: sandbox.InputEvent };
}

function load(file, env) {
  const code = fs.readFileSync(path.join(DIR, file), 'utf8');
  const ctx = vm.createContext(Object.assign({
    window: env.window, document: env.document, localStorage: env.localStorage,
    console, setTimeout, clearTimeout, setInterval, clearInterval,
    Event: env.Event, InputEvent: env.InputEvent
  }, env));
  vm.runInContext(code, ctx, { filename: file });
}

let failures = 0;
const check = (name, cond) => { console.log((cond ? 'PASS' : 'FAIL') + ' - ' + name); if (!cond) failures++; };
/* ---------- 902 Prompt Compressor ---------- */
{
  const env = makeEnv();
  load('902-prompt-compressor.module.user.js', env);
  const api = env.window.pcp_api;
  check('902 exposes pcp_api', !!api && typeof api.compressText === 'function');

  const bloated = 'Hey! Could you please basically summarize the following article? In order to understand it, I want you to focus on climate change.\n\n\nThanks!';
  const out = api.compressText(bloated);
  console.log('   compressed -> ' + JSON.stringify(out));
  check('902 shrinks bloated prompt', out.length < bloated.length);
  check('902 removes opener/filler/politeness', !/(^hey)|basically|thanks!/i.test(out));
  check('902 keeps core meaning words', /summarize/i.test(out) && /climate change/i.test(out));

  const dupes = 'Explain quantum computing simply. Explain quantum computing simply.';
  const outD = api.compressText(dupes);
  check('902 drops consecutive duplicate sentence', (outD.match(/quantum/gi) || []).length === 1);

  const tight = 'Return only valid JSON.';
  check('902 leaves tight text intact', api.compressText(tight) === tight);
  check('902 estimates tokens sanely', api.estimate('abcd') === 2 && api.estimate('') === 0);
}

/* ---------- 903 Duplicate Send Guard ---------- */
{
  const env = makeEnv();
  const fakeDoc = {
    readyState: 'complete', body: {}, _handlers: {},
    addEventListener(type, fn) { (this._handlers[type] = this._handlers[type] || []).push(fn); },
    createElement: () => ({ style: {}, appendChild() {} }),
    querySelectorAll: () => []
  };
  env.document = fakeDoc;
  let confirmResult = true;
  env.window.confirm = () => confirmResult;

  load('903-duplicate-send-guard.module.user.js', env);
  const api = env.window.dsg_api;
  check('903 exposes dsg_api', !!api && typeof api.isDuplicate === 'function');
  check('903 starts clean', api.sentCountToday() === 0 && !api.isDuplicate('some long unique prompt text here'));

  const longPrompt = 'Write a comprehensive explanation of photosynthesis covering light reactions, the Calvin cycle, and environmental factors. '.repeat(2);
  const field = { matches: s => s.includes('textarea'), tagName: 'TEXTAREA', value: longPrompt, offsetWidth: 200, offsetHeight: 40 };
  const handler = fakeDoc._handlers.keydown[0];
  const mkEvt = () => ({ key: 'Enter', shiftKey: false, ctrlKey: false, metaKey: false, isComposing: false, target: field, preventDefault() { this.prevented = true; }, stopImmediatePropagation() { this.stopped = true; } });

  handler(mkEvt());
  check('903 remembers first send', api.isDuplicate(longPrompt) && api.sentCountToday() === 1);

  confirmResult = false;
  const evt2 = mkEvt();
  handler(evt2);
  check('903 blocks cancelled duplicate', evt2.prevented === true && evt2.stopped === true);
  check('903 keeps count on cancel', api.sentCountToday() === 1);

  confirmResult = true;
  const evt3 = mkEvt();
  handler(evt3);
  check('903 allows confirmed resend without blocking', !evt3.prevented);

  const evt4 = Object.assign(mkEvt(), { shiftKey: true });
  handler(evt4);
  check('903 ignores Shift+Enter', !evt4.prevented);

  const shortP = 'hi';
  const sf = { matches: s => s.includes('textarea'), tagName: 'TEXTAREA', value: shortP, offsetWidth: 200, offsetHeight: 40 };
  const evt5 = Object.assign(mkEvt(), { target: sf });
  handler(evt5);
  const evt6 = Object.assign(mkEvt(), { target: sf });
  handler(evt6);
  check('903 ignores short prompts', !evt5.prevented && !evt6.prevented && !api.isDuplicate(shortP));

  check('903 forgetToday resets ledger', (api.forgetToday(), api.sentCountToday() === 0));
}

/* ---------- 901 Token Quota Guard ---------- */
{
  const env = makeEnv();
  load('901-token-quota-guard.module.user.js', env);
  const api = env.window.tqg_api;
  check('901 exposes tqg_api', !!api && typeof api.stats === 'function');
  const est = api.estimate('word '.repeat(100));
  check('901 estimate blends char+word models', Math.abs(est - Math.max(Math.ceil(500 / 4), Math.ceil(100 * 1.33))) < 2);
  api.charge(5000); api.charge(5000);
  const s = api.stats();
  check('901 accumulates charges', s.tokens === 10000 && s.sends === 2);
  check('901 pct math sane', s.pctUsed === Math.round(10000 / s.budget * 100));
  api.setConfig({ dailyBudget: 12000 });
  check('901 config persisted', JSON.parse(env.localStorage.getItem('901-token-quota-guard:cfg')).dailyBudget === 12000);
  api.charge(3000);
  check('901 budget-crossing charge counted', api.stats().tokens === 13000);
}

console.log(failures === 0 ? '\nALL CHECKS PASSED' : '\n' + failures + ' CHECK(S) FAILED');
process.exit(failures ? 1 : 0);

