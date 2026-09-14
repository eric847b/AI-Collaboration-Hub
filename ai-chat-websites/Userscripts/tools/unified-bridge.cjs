// ai-chat-websites -> unified-core bridge (CommonJS). Node >= 18, zero deps.
// Dynamic import() so CJS consumers reach the ESM single source of truth.
// Source of truth: <repo-root>/unified-core/ — do NOT fork rotation logic here.
'use strict';
const { pathToFileURL } = require('node:url');
const path = require('node:path');

// tools/ -> Userscripts/ -> ai-chat-websites/ -> repo root
const CORE = path.join(__dirname, '..', '..', '..', 'unified-core', 'orchestrator.mjs');

let _core = null;
let _loadPromise = null;

function loadCore() {
  if (_core) return Promise.resolve(_core);
  if (!_loadPromise) {
    _loadPromise = import(pathToFileURL(CORE).href).then((m) => {
      _core = m;
      return m;
    });
  }
  return _loadPromise;
}

function offlineFallback(reason) {
  return { response: '[offline-fallback] ' + reason, provider: '', model: '',
           latency_s: 0, error: reason, ok: false };
}

module.exports = {
  loadCore,
  get VERSION() { return _core ? _core.VERSION : 'unlinked'; },
  selectProvider: (opts) => loadCore().then((m) => m.selectProvider(opts))
    .catch((e) => { throw new Error('[unified-bridge] ' + e.message); }),
  callAI: (prompt, opts) => loadCore().then((m) => m.callAI(prompt, opts))
    .catch((e) => offlineFallback('unified-core unreachable: ' + e.message)),
  swarm: (prompts, opts) => loadCore().then((m) => m.swarm(prompts, opts))
    .catch((e) => ({ node_0: offlineFallback('unified-core unreachable: ' + e.message) })),
  UsageLedger: (...a) => loadCore().then((m) => new m.UsageLedger(...a)),
};
