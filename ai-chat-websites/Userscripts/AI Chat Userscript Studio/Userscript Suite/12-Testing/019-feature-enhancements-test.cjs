#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const MODULE_PATH = path.join(__dirname, '..', 'Modules', '00-Core', '030-feature-enhancements.module.user.js');

let passed = 0, failed = 0;
function assert(cond, msg) {
  if (cond) { passed++; console.log(`  PASS: ${msg}`); }
  else { failed++; console.log(`  FAIL: ${msg}`); }
}

console.log('=== 030-feature-enhancements test ===\n');

const storage = {};
const blobUrls = [];
const sandbox = {
  console: { log() {}, warn() {}, error() {} },
  GM_setValue: (k, v) => { storage[k] = v; },
  GM_getValue: (k, d) => (k in storage ? storage[k] : d),
  GM_deleteValue: (k) => { delete storage[k]; },
  GM_listValues: () => Object.keys(storage),
  Blob: class { constructor(p) { this.parts = p; } },
  URL: { createObjectURL: () => { const u = 'blob:' + blobUrls.length; blobUrls.push(u); return u; } },
  document: {
    title: 'Test App', head: { appendChild() {} },
    createElement: () => ({ setAttribute() {}, style: {}, classList: { add() {} } }),
    querySelectorAll: () => [], readyState: 'complete',
  },
  navigator: { serviceWorker: { register: async () => ({ scope: '/' }) } },
  indexedDB: { open: () => ({ onsuccess: null, onerror: null }) },
  caches: { open: async () => ({ keys: async () => [], match: async () => null, put: async () => {}, delete: async () => false }), keys: async () => [] },
  setTimeout: () => 0, setInterval: () => 0,
  Map, Set, Date, Array, Object, JSON, Math, Promise, RegExp, Error,
  parseInt, parseFloat, isNaN, isFinite, Uint8Array, ArrayBuffer, TextEncoder, TextDecoder,
};
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(MODULE_PATH, 'utf8'), sandbox, { filename: '030.module.user.js' });
const O = sandbox.window.__NEXUS_FEATURES__;

console.log('Test 1: Module load + ROADMAP refs');
{
  assert(fs.existsSync(MODULE_PATH), 'module file exists');
  assert(!!O, 'self-registered on window.__NEXUS_FEATURES__');
  const src = fs.readFileSync(MODULE_PATH, 'utf8');
  for (let i = 61; i <= 100; i++) assert(src.includes(String(i)), `ROADMAP ${i}`);
}

console.log('\nTest 2: PWA (61)');
{
  const m = O.pwa.generateManifest({ name: 'TestApp' });
  assert(m.name === 'TestApp', 'manifest name');
  assert(m.display === 'standalone', 'display standalone');
  assert(Array.isArray(m.icons), 'icons array');
}

console.log('\nTest 3: Storage + cache (62-70)');
{
  assert(O.storage.getBytes() > 0, 'getBytes positive');
  assert(Array.isArray(O.cache.keys()), 'cache.keys array');
  assert(O.cache.has('nope') === false, 'cache.has false');
}

console.log('\nTest 4: Content scripts + declarative (72-73)');
{
  assert(typeof O.contentScripts.injectCode === 'function', 'inject exists');
  const rule = O.declarativeRules.compile([{ id: 1, url: '*://e.com/*', css: 'body{}' }]);
  assert(rule[0].id === 1 && Array.isArray(rule[0].actions), 'rule created');
}

console.log('\nTest 5: Snapshot + undo/redo (83,85)');
{
  O.snapshots.take('test', { a: 1 });
  const restored = O.snapshots.restore('test');
  assert(restored && restored.a === 1, 'snapshot roundtrip');
  O.undoRedo.push('a'); O.undoRedo.push('b');
  assert(O.undoRedo.undo() === 'a' && O.undoRedo.redo() === 'b', 'undo/redo');
}

console.log('\nTest 6: Fuzzy finder (88)');
{
  const r = O.fuzzyFinder.search('helo', ['hello', 'help', 'world']);
  assert(r.length > 0 && r[0] === 'hello', 'fuzzy match');
  assert(O.fuzzyFinder.score('abc', 'abc') >= 1, 'exact score');
}

console.log('\nTest 7: Cursors + column + block (89-91)');
{
  O.multiCursor.add(0, 0); O.multiCursor.add(5, 3);
  assert(O.multiCursor.list().length === 2, 'two cursors');
  const sel = O.columnSelect.select(['abcdef', 'ghijkl'], 0, 2, 1, 5);
  assert(sel.length === 2, 'column select');
  assert(O.blockEdit.duplicate(['a', 'b', 'c', 'd'], 1, 2).length === 6, 'duplicate');
}

console.log('\nTest 8: Refactoring (92)');
{
  const renamed = O.refactor.renameSymbol(['const y = x + 2;'], 0, 'x', 'z');
  assert(renamed[0].includes('z'), 'rename symbol');
  const ext = O.refactor.extractVariable(['const val = foo + bar;'], 0, 4, 11, 'sum');
  assert(ext.length === 2, 'extract var');
}

console.log('\nTest 9: Codegen (93)');
{
  assert(O.codegen.interface('User', [{name:'id',type:'n'}]).includes('interface User'), 'interface');
  const cls = O.codegen.class('Foo', { constructor: { params: ['a'], body: ['this.a = a;'] } });
  assert(cls.includes('class Foo') && cls.includes('constructor'), 'class gen');
  assert(O.codegen.importStmt('react', ['useState']).includes('import'), 'import stmt');
}

console.log('\nTest 10: Templates + boilerplate (94-95)');
{
  O.templates.save('g', 'Hello {{name}}!');
  assert(O.templates.expand('g', { name: 'World' }) === 'Hello World!', 'template expand');
  assert(O.boilerplate.reactComponent('App').includes('function App'), 'react comp');
  assert(O.boilerplate.readme('T').includes('# T'), 'readme');
}

console.log('\nTest 11: Snippets + code blocks (96-97)');
{
  O.snippets.add('log', 'cl', 'console.log(${msg});');
  assert(O.snippets.expand('log', { msg: 'hi' }) === 'console.log(hi);', 'snippet expand');
  const p = O.codeBlocks.parse('```js\nhi\n```');
  assert(p.length === 1 && p[0].code === 'hi', 'parse code blocks');
  assert(O.codeBlocks.minify('a // c\n/* b */ c') === 'a c', 'minify');
}

console.log('\nTest 12: Live templates + macros (98-100)');
{
  O.liveTemplates.register('fl', 'for (let {{i}} = 0; {{i}} < {{n}}; {{i}}++)', ['for']);
  assert(O.liveTemplates.match('for').name === 'fl', 'match trigger');
  O.macroRecord.start('t');
  O.macroRecord.record({ type: 'insert', text: 'hi' });
  O.macroRecord.saveToStore();
  O.macroPlayback.load();
  assert(O.macroPlayback.list().includes('t'), 'macro saved');
  assert(O.macroPlayback.play('t').totalSteps === 1, 'one step');
}

console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
process.exit(failed > 0 ? 1 : 0);