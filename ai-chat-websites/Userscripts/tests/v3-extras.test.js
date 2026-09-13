/**
 * Regression tests for the v3 extras: plugin API v3 stable, fine-tuning,
 * template exchange. Mirrors the harness in tests/regression.mjs.
 * Usage: node tests/v3-extras.test.js
 */

'use strict';

const assert = require('assert');
const { PluginAPIv3 } = require('../v3/plugin-api-stable.js');
const { FineTuningManager } = require('../v3/fine-tuning.js');
const { TemplateExchange } = require('../v3/template-exchange.js');

let failures = 0;
const ok = (name, fn) => {
  try { fn(); console.log('  ok ' + name); }
  catch (err) { failures += 1; console.error('  FAIL ' + name + ' — ' + (err && err.message)); }
};

// ---- plugin API v3 ----
ok('plugin-api: rejects invalid manifest', () => {
  const api = new PluginAPIv3();
  const v = api.validate({ id: 'Bad ID!', version: 'x' });
  assert.strictEqual(v.ok, false);
  assert(v.errors.length >= 2);
});

ok('plugin-api: accepts valid manifest', () => {
  const api = new PluginAPIv3();
  const v = api.validate({ id: 'hello', version: '1.0.0', name: 'Hi', description: 'd', author: 'a', permissions: [] });
  assert.strictEqual(v.ok, true, JSON.stringify(v.errors));
});

ok('plugin-api: register + activate + sandboxed invoke', () => {
  const api = new PluginAPIv3();
  api.register({ id: 'dep', version: '2.0.0', name: 'Dep', description: 'd', author: 'a', permissions: [] }, {});
  api.register({
    id: 'main', version: '1.0.0', name: 'Main', description: 'm', author: 'a',
    permissions: ['storage:local'], dependencies: [{ id: 'dep', version: '^2.0.0' }]
  }, {
    onInstall(ctx) { ctx.storage.set('installed', true); },
    main(ctx, n) { return ctx.storage.get('installed') ? 'ready:' + n : 'no'; }
  });
  api.activate('main');
  assert.strictEqual(api.invoke('main', 'main', [7]), 'ready:7');
});

ok('plugin-api: missing dependency rejected', () => {
  const api = new PluginAPIv3();
  let threw = false;
  try {
    api.register({ id: 'orphan', version: '1.0.0', name: 'O', description: 'o', author: 'a', permissions: [], dependencies: [{ id: 'ghost', version: '1.0.0' }] }, {});
  } catch { threw = true; }
  assert.strictEqual(threw, true);
});

ok('plugin-api: version constraint enforced (exact)', () => {
  const api = new PluginAPIv3();
  api.register({ id: 'lib', version: '1.2.3', name: 'Lib', description: 'l', author: 'a', permissions: [] }, {});
  let threw = false;
  try {
    api.register({ id: 'usr', version: '1.0.0', name: 'U', description: 'u', author: 'a', permissions: [], dependencies: [{ id: 'lib', version: '1.9.0' }] }, {});
  } catch { threw = true; }
  assert.strictEqual(threw, true);
});

ok('plugin-api: lifecycle hooks fire on install/activate/deactivate', () => {
  const api = new PluginAPIv3();
  const events = [];
  api.register({ id: 'life', version: '1.0.0', name: 'L', description: 'l', author: 'a', permissions: [] }, {
    onInstall() { events.push('install'); },
    onActivate() { events.push('activate'); },
    onDeactivate() { events.push('deactivate'); }
  });
  api.activate('life');
  api.deactivate('life');
  assert.deepStrictEqual(events, ['install', 'activate', 'deactivate']);
});

ok('plugin-api: snapshot + unregister', () => {
  const api = new PluginAPIv3();
  api.register({ id: 'one', version: '1.0.0', name: 'One', description: '1', author: 'a', permissions: [] }, {});
  assert.strictEqual(api.snapshot().plugins.length, 1);
  api.unregister('one');
  assert.strictEqual(api.listInstalled().length, 0);
});

// ---- fine-tuning ----
ok('fine-tuning: dataset validation + jsonl export', () => {
  const ft = new FineTuningManager();
  ft.createDataset({ id: 'd1', entries: [{ text: 'Hi', completion: 'Hello!' }] });
  const out = ft.exportDataset('d1', 'jsonl');
  const first = JSON.parse(out.trim().split('\n')[0]);
  assert.strictEqual(first.prompt, 'Hi');
  assert.strictEqual(first.completion, 'Hello!');
});

ok('fine-tuning: rejects empty or bad entries', () => {
  const ft = new FineTuningManager();
  let threw = false;
  try { ft.createDataset({ id: 'bad', entries: [{ text: 'x' }] }); } catch { threw = true; }
  assert.strictEqual(threw, true);
});

ok('fine-tuning: job lifecycle + cost estimate', () => {
  const ft = new FineTuningManager();
  ft.createDataset({ id: 'd2', entries: [{ text: 'a', completion: 'b' }, { text: 'cc', completion: 'dd' }] });
  const j = ft.createJob({ id: 'j1', dataset: 'd2', baseModel: 'gpt-4o-mini', hyperparams: { epochs: 2 } });
  assert.strictEqual(j.status, 'queued');
  ft.startJob('j1');
  ft.completeJob('j1', { loss: 0.12 });
  assert.strictEqual(ft.getJob('j1').status, 'completed');
  const cost = ft.estimateCost('j1');
  assert(cost.tokens >= 1 && cost.epochs === 2);
  assert.strictEqual(ft.cancelJob('j1'), false, 'completed jobs cannot be cancelled');
});

ok('fine-tuning: chat + messages formats export', () => {
  const ft = new FineTuningManager();
  ft.createDataset({ id: 'd3', entries: [{ text: 'Hi', completion: 'Hello!' }] });
  const chat = JSON.parse(ft.exportDataset('d3', 'chat'));
  assert.strictEqual(chat[0].messages[0].role, 'user');
  assert.strictEqual(JSON.parse(ft.exportDataset('d3', 'messages'))[0].text, 'Hi');
});

// ---- template-exchange ----
ok('template-exchange: seeds 50+ templates', () => {
  const te = new TemplateExchange();
  assert(te.catalogStats().total >= 50);
});

ok('template-exchange: rating average + count', () => {
  const te = new TemplateExchange();
  te.rate('prod-01', 5, 'u1');
  te.rate('prod-01', 3, 'u2');
  te.rate('prod-01', 5, 'u1'); // overwrite, not double count
  const t = te.get('prod-01');
  assert.strictEqual(t.ratingCount, 2);
  assert(t.stars >= 4 && t.stars <= 4.01, 'avg of 5+3 = 4, got ' + t.stars);
});

ok('template-exchange: search filters by category + keyword', () => {
  const te = new TemplateExchange();
  assert(te.search('login', { category: 'security' }).length >= 1);
  assert.strictEqual(te.search('zzzz-nope').length, 0);
});

ok('template-exchange: JSON import/export round-trip', () => {
  const a = new TemplateExchange();
  const json = a.exportJson();
  const b = new TemplateExchange();
  const imported = b.importJson(json);
  assert(imported.length >= 50);
  assert.strictEqual(b.catalogStats().total, a.catalogStats().total);
});

ok('template-exchange: share payload for marketplace feed', () => {
  const te = new TemplateExchange();
  const payload = JSON.parse(te.share('sec-01'));
  assert.strictEqual(payload.id, 'sec-01');
  assert('text' in payload && 'stars' in payload);
});

if (failures) {
  console.error('\nv3-EXTRAS FAILED (' + failures + ')');
  process.exit(1);
}
console.log('\nALL v3 EXTRAS TESTS PASS');