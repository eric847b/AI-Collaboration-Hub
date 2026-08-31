// Functional regression harness for Modules/22-Idle-Compute/001-idle-dev-miner
// Runs the userscript inside a minimal DOM/browser mock and asserts mining behavior.
'use strict';
const fs = require('fs');
const path = require('path');

const FILE = path.resolve(__dirname, '..', '..', 'Modules', '22-Idle-Compute', '001-idle-dev-miner.module.user.js');
const SRC = fs.readFileSync(FILE, 'utf8');

let pass = 0, fail = 0;
function T(name, cond) { if (cond) { pass++; console.log('  PASS  ' + name); } else { fail++; console.log('  FAIL  ' + name); } }

/* ---- browser mock ---- */
const store = new Map();
const localStorageMock = {
  getItem: k => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => { store.set(k, String(v)); },
  removeItem: k => { store.delete(k); },
  get length() { return store.size; },
  key(i) { return Array.from(store.keys())[i] || null; }
};
const els = [];
const documentMock = {
  readyState: 'complete',
  visibilityState: 'visible',
  body: { appendChild: el => els.push(el) },
  documentElement: { appendChild: () => {} },
  addEventListener: () => {},
  createElement: tag => ({ tagName: tag, style: {}, title: '', id: '', onclick: null,
    set textContent(v) { this._tc = v; }, get textContent() { return this._tc || ''; } })
};
const windowMock = { _listeners: {} };
windowMock.addEventListener = (t, fn) => { (windowMock._listeners[t] = windowMock._listeners[t] || []).push(fn); };
// No BroadcastChannel / requestIdleCallback / crypto / performance here on purpose:
// the module must take its guarded fallback paths (setTimeout scheduling, FNV-1a hash, Date.now).

// Force `crypto` to undefined inside the sandbox so the module must take its
// deterministic synchronous FNV-1a fallback (real browsers on http:// do this too).
const run = new Function('window', 'document', 'localStorage', 'crypto',
  '"use strict";\n' + SRC + '\n;');
run(windowMock, documentMock, localStorageMock, undefined);

const api = windowMock.dcp_api;
T('API exposed as window.dcp_api', !!api && typeof api.enqueue === 'function' && typeof api.registerTask === 'function');

/* ---- built-in tasks produce correct results through the real pipeline ---- */
const j1 = api.enqueue('json-validate', { text: '{"b":1,"a":[2]}' });
api.__testPump();
let r = api.result(j1);
T('json-validate parses+prettyprints', !!r && r.ok === true && r.result.valid === true &&
  JSON.parse(r.result.pretty).b === 1 && r.result.pretty.indexOf('\n  ') !== -1);

const j2 = api.enqueue('lint-brackets', { code: 'function f(){\n  return [1,2);\n}' });
api.__testPump();
r = api.result(j2);
T('lint-brackets flags mismatch', !!r && r.ok === true && r.result.ok === false &&
  r.result.errors.some(e => e.kind === 'mismatch' && e.line === 2));

const j3a = api.enqueue('sha256', { text: 'abc' });
api.__testPump();
const r3a = api.result(j3a);
const j3b = api.enqueue('sha256', { text: 'abc' });
api.__testPump();
const r3b = api.result(j3b);
T('sha256 falls back to deterministic fnv1a (no crypto.subtle)', !!r3a && r3a.result.algo === 'fnv1a' &&
  /^[0-9a-f]{8}$/.test(r3a.result.hash) && r3a.result.hash === r3b.result.hash);

const j4 = api.enqueue('regex-bench', { pattern: '\\d+', flags: 'g', samples: ['a1 bb22 ccc333'] });
api.__testPump();
r = api.result(j4);
T('regex-bench extracts matches', !!r && r.ok === true && r.result.matches[0].join(',') === '1,22,333');

const j5 = api.enqueue('diff-lines', { a: 'x\ny\nz', b: 'x\nY\nz' });
api.__testPump();
r = api.result(j5);
T('diff-lines produces LCS edit ops', !!r && r.ok === true &&
  r.result.ops.some(o => o[0] === '-') && r.result.ops.some(o => o[0] === '+') &&
  r.result.ops.filter(o => o[0] === '=').length === 2);

/* ---- error containment ---- */
const j6 = api.enqueue('json-validate', { text: '{oops' });
api.__testPump();
r = api.result(j6);
T('bad JSON rejected without killing worker', !!r && r.ok === false && typeof r.error === 'string' && r.error.length > 0);
T('unknown task type refused at enqueue', api.enqueue('no-such-task', {}) === null);

/* ---- ledger ("hashrate") banks work ---- */
const st = api.stats();
T('stats counts tasks mined today', st.tasks >= 5 && st.cyclesMs > 0);
T('ledger persisted under daily key', Array.from(store.keys()).some(k => /^001-idle-dev-miner:\d{4}-\d{2}-\d{2}$/.test(k)));

/* ---- queue/backpressure & registry integrity ---- */
T('queue drains toward zero', api.stats().queued <= 5);
let threw = false;
try { api.registerTask('sha256', function () {}); } catch (e) { threw = true; }
T('duplicate task registration throws', threw);

/* ---- async (promise-returning) tasks settle later without loss ---- */
let threwAsyncReg = false;
try { api.registerTask('async-probe', p => new Promise(res => setTimeout(() => res({ done: true }), 20))); } catch (e) { threwAsyncReg = true; }
if (threwAsyncReg) { fail++; console.log('  FAIL  async-probe registration'); }
else {
  const ja = api.enqueue('async-probe', {});
  api.__testPump();
  const immediate = api.result(ja); // must NOT be settled synchronously
  setTimeout(() => {
    r = api.result(ja);
    T('promise tasks settle asynchronously', immediate === undefined && !!r && r.ok === true && r.result.done === true);

    /* ---- attention detector is wired & idle-gating honored when disabled ---- */
api.setConfig({ enabled: false });
const j7 = api.enqueue('lint-brackets', { code: '(' });
setTimeout(() => {
  // unforced pump must refuse to run while disabled even with queued work
  setTimeout(() => {
    const leftBlocked = api.stats().queued;
    api.setConfig({ enabled: true });
    api.__testPump();
    T('disabled gate blocks idle pumping (user always wins)', leftBlocked >= 1 && api.result(j7) !== undefined && api.stats().queued < leftBlocked + 1);
    console.log('\n' + pass + ' passed, ' + fail + ' failed');
    process.exit(fail ? 1 : 0);
      }, 900); // > module's internal setTimeout(400) reschedule delay
    }, 0);
  }, 40); // close async-probe settle timer
} // end async-probe else-branch
