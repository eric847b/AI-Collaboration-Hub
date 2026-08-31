#!/usr/bin/env node
/* Regression harness for 904-response-budgeter.module.user.js
   Runs the module in a vm sandbox with mock window/document/localStorage.
   Zero network, zero real DOM. Exits 1 on any failure. */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const FILE = path.resolve(__dirname, '..', '..', 'Modules', '21-Quota-Saving',
  '904-response-budgeter.module.user.js');
const SRC = fs.readFileSync(FILE, 'utf8');

let pass = 0, fail = 0;
function T(name, cond) {
  if (cond) { pass++; console.log('PASS ' + name); }
  else { fail++; console.log('FAIL ' + name); }
}

/* Mock sandbox. Optional `field` is served as the active element / sole textarea. */
function makeEnv(seedStore, field) {
  const store = {};
  if (seedStore) for (const k in seedStore) store[k] = seedStore[k];
  const win = {
    addEventListener() {}, removeEventListener() {},
    getSelection() { throw new Error('no dom'); },
    __UNIVERSALIZE_GUARDS: []
  };
  const doc = {
    addEventListener() {}, removeEventListener() {},
    activeElement: field || null,
    querySelectorAll(sel) { return (sel === 'textarea' && field) ? [field] : []; },
    body: undefined, documentElement: undefined,
    createElement() { throw new Error('no dom'); },
    createRange() { throw new Error('no dom'); }
  };
  const env = {
    window: win,
    document: doc,
    localStorage: {
      getItem(k) { return Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null; },
      setItem(k, v) { store[k] = String(v); },
      removeItem(k) { delete store[k]; },
      key(i) { return Object.keys(store)[i] || null; },
      get length() { return Object.keys(store).length; }
    },
    setTimeout, clearTimeout,
    console: { log() {}, warn() {} }
  };
  vm.createContext(env);
  vm.runInContext(SRC, env, { filename: '904-response-budgeter.user.js' });
  env.__store = store;
  return env;
}

function mkField(value) {
  return {
    tagName: 'TEXTAREA', value: value || '', readOnly: false, disabled: false,
    dispatchEvent() {}, focus() {},
    getBoundingClientRect() { return { width: 600, height: 80 }; }
  };
}

const LONG_DRAFT =
  'Explain how browser event loops schedule macrotasks and microtasks during idle periods, ' +
  'including timer coalescing and requestIdleCallback interactions, for a senior engineer.';
const SUFFIX150 = '(Response style note: reply in under 150 words, no preamble.)';

/* ---------- Group 1: pure decision core ---------- */
{
  const api = makeEnv().window.rlb_api;

  T('api surface exposed', !!api && typeof api.planFor === 'function');
  T('suffixFor exact text', api.suffixFor(150) === SUFFIX150);

  const p = api.planFor(LONG_DRAFT);
  T('armed on ordinary long prompt', p.apply === true && p.reason === 'armed');
  T('newText preserves draft verbatim', p.newText.indexOf(LONG_DRAFT) === 0);
  T('newText ends with joined suffix', p.newText.endsWith('\n\n' + SUFFIX150));
  T('estSaved positive at cap150', p.estSaved > 0);

  const pWs = api.planFor(LONG_DRAFT + '\n\n\t ');
  T('trailing whitespace normalized', pWs.newText === p.newText);

  const pOff = api.planFor(p.newText, { words: 0 });
  T('words<=0 -> off (wins all branches)', pOff.apply === false && pOff.reason === 'off');

  const pAgain = api.planFor(p.newText);
  T('already-armed detected', pAgain.apply === false && pAgain.reason === 'already-armed');

  /* prompts that carry their own limits -> stand down */
  const s1 = 'Summarize distributed consensus for interview prep covering Raft versus Paxos, quorum sizing, and leader election, keeping the entire explanation under 250 words.';
  const s2 = 'Migration guidance for legacy React class components with a hook conversion plan, written as a maximum of 3 sentences per section, targeting a large codebase.';
  const s3 = 'Debug strategy writeup for intermittent WebSocket disconnects behind corporate proxies, structured as bullet points, limited to 5 bullets overall.';
  T('detects "under 250 words"', api.planFor(s1).reason === 'user-limit-present');
  T('detects "maximum of 3 sentences"', api.planFor(s2).reason === 'user-limit-present');
  T('detects "limited to 5 bullets"', api.planFor(s3).reason === 'user-limit-present');
  T('ordinary draft NOT flagged as limited', api.planFor(LONG_DRAFT).reason === 'armed');

  /* short-prompt gate */
  T('short prompt declined', api.planFor('hello world').reason === 'too-short');
  T('at minimum accepted', api.planFor('12345678901', { minPromptChars: 5 }).apply === true);
  T('below minimum declined', api.planFor('1234', { minPromptChars: 5 }).reason === 'too-short');

  /* robustness */
  const pNull = api.planFor(null, { minPromptChars: 0 });
  T('null input safe', pNull.apply === true && pNull.newText.endsWith(SUFFIX150));

  /* estimator behaviour: monotone tighter cap saves more; loose cap floors at 0 */
  const e150 = api.estimateSavedTokens(LONG_DRAFT.length, 150);
  const e75 = api.estimateSavedTokens(LONG_DRAFT.length, 75);
  const e300 = api.estimateSavedTokens(LONG_DRAFT.length, 300);
  T('tighter cap saves more', e75 > e150 && e150 > 0);
  T('loose cap floors at zero', e300 === 0);
}

/* ---------- Group 2: config validation + persistence ---------- */
{
  const env = makeEnv();
  const api = env.window.rlb_api;

  T('default budget 150', api.getConfig().words === 150);
  api.setConfig({ words: 75 });
  T('valid step accepted', api.getConfig().words === 75);
  api.setConfig({ words: 999 });
  T('invalid step rejected', api.getConfig().words === 75);
  api.setConfig({ minPromptChars: 50 });
  T('valid minChars accepted', api.getConfig().minPromptChars === 50);
  api.setConfig({ minPromptChars: -3 });
  T('negative minChars rejected', api.getConfig().minPromptChars === 50);

  const persisted = JSON.parse(env.__store['rlb:cfg']);
  T('config persisted to storage',
    persisted.words === 75 && persisted.minPromptChars === 50);

  const st = api.stats();
  T('stats shape exact',
    ['words', 'appendsToday', 'estSavedToday', 'queuedUndos'].every(k => k in st));
  T('stats reflect live cfg', st.words === 75);

  /* fresh sandbox must LOAD persisted cfg (persistence roundtrip) */
  const env2 = makeEnv({ 'rlb:cfg': JSON.stringify({ words: 300 }) });
  T('persisted cfg loaded at boot', env2.window.rlb_api.getConfig().words === 300);
}

/* ---------- Group 3: pruning + guard registration ---------- */
{
  const env = makeEnv({ 'rlb:2020-01-01': '{"appends":9,"estSaved":9}' });
  const today = new Date();
  const tk = today.getFullYear() + '-' +
    String(today.getMonth() + 1).padStart(2, '0') + '-' +
    String(today.getDate()).padStart(2, '0');
  /* seed a *today* day-key too; boot prune must keep it */
  env.__store['rlb:' + tk] = '{"appends":1,"estSaved":40}';

  T('stale ledger pruned at boot', !('rlb:2020-01-01' in env.__store));
  T('today ledger survives prune', ('rlb:' + tk) in env.__store);

  const guards = env.window.__UNIVERSALIZE_GUARDS;
  T('guard registered', Array.isArray(guards) && guards.length === 1);
  const g = guards[0]();
  T('guard reports genericSafe run=true', g.run === true && g.genericSafe === true);
}

/* ---------- Group 4: undo stack semantics ---------- */
{
  const api = makeEnv().window.rlb_api;
  const ta = mkField('');
  const ce = { tagName: 'DIV' }; /* contenteditable stand-in differs by tag */

  api.__pushUndo(ta, 'draft-A');
  const popped = api.__popUndoFor(ta);
  T('undo roundtrip returns previous text', popped && popped.prev === 'draft-A');

  api.__pushUndo(ce, 'div-draft');
  api.__pushUndo(ta, 'draft-B');
  T('undo pops most recent matching tag first', api.__popUndoFor(ta).prev === 'draft-B');
  T('null target pops any entry', api.__popUndoFor(null) !== null);
  T('stack empty afterwards', api.__popUndoFor(ta) === null && api.__popUndoFor(ce) === null);

  /* cap: stack holds at most 20 */
  for (let i = 0; i < 25; i++) api.__pushUndo(ta, 'x' + i);
  T('stack capped at 20', api.stats().queuedUndos === 20);
}

/* ---------- Group 5: end-to-end with wired field ---------- */
{
  const field = mkField(LONG_DRAFT);
  const env = makeEnv(null, field);
  const api = env.window.rlb_api;

  api.applyNow(); /* activeElement === field */
  T('applyNow armed suffix onto field',
    field.value === LONG_DRAFT.trimEnd() + '\n\n' + SUFFIX150);

  let st = api.stats();
  T('applyNow banked exactly one append', st.appendsToday === 1);
  T('est savings banked positive', st.estSavedToday > 0);
  T('ledger day-key present in storage',
    Object.keys(env.__store).some(k => /^rlb:\d{4}-\d{2}-\d{2}$/.test(k)));
  T('undo queued after arm', st.queuedUndos === 1);

  const before = field.value;
  api.applyNow(); /* second attempt refused: marker present */
  T('re-arm refused, value untouched', field.value === before);
  T('refusals do not bank', api.stats().appendsToday === 1);

  api.undoLast();
  T('undoLast restored pristine draft', field.value === LONG_DRAFT);
  T('undo consumed queue entry', api.stats().queuedUndos === 0);

  /* no-field environment -> applyNow degrades to a toast, does not throw or bank */
  const envNF = makeEnv();
  const apiNF = envNF.window.rlb_api;
  let threw = false;
  try { apiNF.applyNow(); } catch (e) { threw = true; }
  T('applyNow without any field is safe', !threw && apiNF.stats().appendsToday === 0);
}

console.log('\nSUMMARY pass=' + pass + ' fail=' + fail);
process.exit(fail ? 1 : 0);

