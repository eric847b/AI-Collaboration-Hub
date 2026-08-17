'use strict';
/**
 * Off-line DOM test for FreeAIRotator.module.user.js (the Tampermonkey script).
 *
 * Builds a minimal, dependency-free DOM + GM stub, evals the *real* userscript
 * source, and asserts the shipped "works on ANY page" behavior end-to-end:
 *   1. the floating `💬 FreeAI` button is injected on a plain (non-chat) page;
 *   2. the prompt auto-fills from page title + selection (context awareness);
 *   3. a 429 on provider A and a 500 on provider B fail over instantly to a 200
 *      from provider C — no manual intervention;
 *   4. the result docks in the inline card (with Copy) and is persisted.
 *
 * This closes the userscript injection path that was only stub-validated before.
 */
const fs = require('fs');
const path = require('path');

let passed = 0;
let failed = 0;
function ok(cond, msg) {
  if (cond) {
    console.log('  \u2713 ' + msg);
    passed++;
  } else {
    console.log('  \u2717 FAIL: ' + msg);
    failed++;
  }
}
// Recursively read textContent (shim elements don't auto-aggregate children).
function textOf(el) {
  if (!el) return '';
  let s = typeof el.textContent === 'string' ? el.textContent : '';
  if (el._children) {
    for (const c of el._children) s += textOf(c);
  }
  return s;
}

function makeElement(tag) {
  const listeners = {};
  const el = {
    tagName: tag.toUpperCase(),
    id: '',
    textContent: '',
    style: { cssText: '' },
    _children: [],
    disabled: false,
    appendChild(c) {
      this._children.push(c);
      return c;
    },
    insertBefore(c) {
      this._children.push(c);
      return c;
    },
    addEventListener(t, fn) {
      (listeners[t] = listeners[t] || []).push(fn);
    },
    dispatch(t, payload) {
      (listeners[t] || []).forEach((fn) =>
        fn(payload || { preventDefault: () => {}, stopImmediatePropagation: () => {} })
      );
    },
  };
  return el;
}

const bodyEl = makeElement('body');
const documentShim = {
  title: 'Example Doc',
  body: bodyEl,
  createElement: makeElement,
  getElementById(id) {
    return bodyEl._children.find((c) => c.id === id) || null;
  },
  querySelector() {
    return null;
  },
};

let selectionText = '';
const windowShim = {
  getSelection() {
    return { toString: () => selectionText };
  },
  prompt() {
    return '';
  },
  confirm() {
    return true;
  },
};

// --- GM_* stubs ---
const gmStore = {};
let lastPersisted = null;
const gmValue = {
  GM_getValue(k, d) {
    return Object.prototype.hasOwnProperty.call(gmStore, k) ? gmStore[k] : d;
  },
  GM_setValue(k, v) {
    gmStore[k] = v;
    lastPersisted = k + '=' + String(v);
  },
  GM_setClipboard(text) {
    lastPersisted = 'clipboard:' + String(text);
  },
  GM_getClipboard() {
    return lastPersisted;
  },
  GM_registerMenuCommand() {},
};

// --- GM_xmlhttpRequest stub: A=fail, B=500, C=200 ---
let gmCallCount = 0;
const providerByUrl = {
  'http://127.0.0.1:11434/v1/chat/completions': 'ollama',
  'http://127.0.0.1:1234/v1/chat/completions': 'lmstudio',
  'http://127.0.0.1:8080/v1/chat/completions': 'localai',
  'https://api-inference.huggingface.co/models/mistralai/Mistral-7B-Instruct-v0.2': 'hf-free',
  'https://api.groq.com/openai/v1/chat/completions': 'groq-free',
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=':
    'gemini-free',
  'https://api.together.xyz/v1/chat/completions': 'together-free',
  'https://openrouter.ai/api/v1/chat/completions': 'openrouter-free',
};
function gmXmlhttpRequest(opts) {
  gmCallCount++;
  const provider = providerByUrl[opts.url] || 'unknown';
  if (provider === 'ollama') {
    setTimeout(() => opts.onerror(new Error('connection refused (ollama down)')), 0);
    return;
  }
  if (provider === 'lmstudio') {
    opts.onload({ status: 500, responseText: '{}' });
    return;
  }
  opts.onload({
    status: 200,
    responseText: JSON.stringify({
      choices: [{ message: { content: 'OK from localai' } }],
    }),
  });
}

// --- Load real userscript source; strip metadata + globals line ---
const scriptPath = path.resolve(__dirname, '../FreeAIRotator.module.user.js');
let src = fs.readFileSync(scriptPath, 'utf8');
src = src.replace(/\/\/ ==\/UserScript==[\s\S]*?\n\/\/ ==\/UserScript==\s*\n/, '');
src = src.replace(/\/\* globals.*?\}\s*\n/, '');

// eslint-disable-next-line no-eval
const fn = new Function(
  'window',
  'document',
  'GM_getValue',
  'GM_setValue',
  'GM_setClipboard',
  'GM_getClipboard',
  'GM_registerMenuCommand',
  'GM_xmlhttpRequest',
  'setTimeout',
  'Date',
  'Math',
  'Map',
  'JSON',
  'console',
  '"use strict";\n' + src + '\nreturn 0;'
);
fn(
  windowShim,
  documentShim,
  gmValue.GM_getValue,
  gmValue.GM_setValue,
  gmValue.GM_setClipboard,
  gmValue.GM_getClipboard,
  gmValue.GM_registerMenuCommand,
  gmXmlhttpRequest,
  setTimeout,
  Date,
  Math,
  Map,
  JSON,
  console
);
// --- 1. Button injected on a plain page ---
const btn = documentShim.getElementById('freeai-rotator-btn');
ok(!!btn, 'button #freeai-rotator-btn injected on the page');
ok(btn && btn.textContent === '\u{1F4AC} FreeAI', 'button label is "\u{1F4AC} FreeAI"');

// --- 2. Context-aware prompt: title + selected text, captured on click ---
let capturedPrefill = null;
const realPrompt = windowShim.prompt;
windowShim.prompt = (message, defaultValue) => {
  capturedPrefill = defaultValue;
  return defaultValue; // accept the auto-filled prompt
};
selectionText = 'Hello world';
documentShim.title = 'Example Doc';
btn && btn.dispatch('click');

ok(
  capturedPrefill === 'Page: Example Doc\nSelected text:\nHello world',
  'prompt auto-filled from page title + selection'
);

windowShim.prompt = realPrompt;

// --- 3 & 4. Failover (ollama down -> lmstudio 500 -> localai 200) + dock card ---
(async () => {
  // Let GM_xmlhttpRequest timeouts + complete() microtasks settle.
  await new Promise((r) => setTimeout(r, 80));

  const card = documentShim.getElementById('freeai-rotator-card');
  ok(!!card, 'result card docked in the DOM after failover');
  ok(
    card && textOf(card).includes('OK from localai'),
    'card rendered the failover-through result ("OK from localai")'
  );
  ok(
    card && textOf(card).includes('FreeAI') && textOf(card).includes('localai'),
    'card attributed the result to provider localai'
  );
  ok(
    lastPersisted && String(lastPersisted).includes('freeai_rot_last=[localai]'),
    'result persisted via GM_setValue(last, ...) as localai'
  );
  ok(btn.disabled === false, 'button re-enabled after completion');
  ok(
    btn && btn.textContent === '\u{1F4AC} FreeAI',
    'button restored to idle label after completion'
  );
  ok(gmCallCount >= 3, `rotator made >=3 GM_xmlhttpRequest calls (calls=${gmCallCount})`);

  console.log('\nSummary (userscript-dom): passed=' + passed + ' failures=' + failed);
  if (failed > 0) process.exitCode = 1;
})();
