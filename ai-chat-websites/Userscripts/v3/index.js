/**
 * v3 Accelerator — aggregator + self-test.
 * Loads every v3 module and runs a lightweight smoke test in Node so CI can
 * gate on `node v3/index.js --selftest`.
 */

const modules = {
  conversations: require('./conversations.js'),
  nlEditor: require('./nl-editor.js'),
  voice: require('./voice.js'),
  webhooks: require('./webhooks.js'),
  rbac: require('./rbac.js'),
  auditLog: require('./audit-log.js'),
  cspValidator: require('./csp-validator.js'),
  sandboxPreview: require('./sandbox-preview.js'),
  permissionMinimizer: require('./permission-minimizer.js'),
  optimizer: require('./optimizer.js'),
  pluginSubmission: require('./plugin-submission.js'),
  monitor: require('./monitor.js'),
  localeBundles: require('./locale-bundles.js'),
  translationFramework: require('./translation-framework.js'),
  apiServer: require('./api-server.js'),
  pluginApiV3: require('./plugin-api-stable.js'),
  fineTuning: require('./fine-tuning.js'),
  templateExchange: require('./template-exchange.js')
};

function selfTest() {
  const assert = require('assert');
  const failures = [];

  const record = (name, fn) => {
    try { fn(); console.log('  ok ' + name); }
    catch (err) { failures.push(name + ': ' + err.message); console.error('  FAIL ' + name + ' — ' + err.message); }
  };

  // conversations
  record('conversations', () => {
    const C = modules.conversations.ConversationStore;
    const c = new C({ maxSessions: 5 });
    const id = 's1';
    c.addTurn(id, 'user', 'hello');
    c.addTurn(id, 'assistant', 'hi!');
    assert.strictEqual(c.transcript(id).length, 2, 'transcript length');
    assert(Array.isArray(c.toMessages(id)), 'toMessages array');
  });

  // nl-editor
  record('nl-editor', () => {
    const E = modules.nlEditor.NLEditor;
    const e = new E();
    const out = e.apply('function foo(){ return 1; }\nfoo();', 'rename function foo to bar');
    assert(out.applied && out.source.includes('bar()'), 'rename applied');
  });

  // rbac
  record('rbac', () => {
    const R = modules.rbac.RBAC;
    const r = new R();
    r.addMember('u1', 'editor');
    assert(r.can('u1', 'generation', 'run'), 'editor can run generation');
    assert(!r.can('u1', 'config', 'write'), 'editor cannot write config');
  });

  // audit log
  record('audit-log', () => {
    const A = modules.auditLog.AuditLog;
    const a = new A();
    a.record('test', 'run', { n: 1 }, 'u1');
    a.record('test', 'run', { n: 2 }, 'u1');
    assert.strictEqual(a.verify().length, 0, 'chain intact');
    assert.strictEqual(a.query({ category: 'test' }).length, 2, 'query works');
  });

  // csp validator
  record('csp-validator', () => {
    const V = modules.cspValidator.CSPValidator;
    const v = new V();
    const good = v.validate("default-src 'self'; script-src 'self'; object-src 'none'; base-uri 'self'");
    assert(good.ok, 'good policy passes');
    const bad = v.validate("default-src *; script-src 'self' 'unsafe-eval'");
    assert(!bad.ok, 'bad policy fails');
  });

  // sandbox analyze
  record('sandbox-preview', () => {
    const S = modules.sandboxPreview.SandboxPreview;
    const s = new S();
    const r = s.analyze('console.log(document.cookie)');
    assert(r.dangerous, 'cookie access flagged');
  });

  // permission minimizer
  record('permission-minimizer', () => {
    const P = modules.permissionMinimizer.PermissionMinimizer;
    const p = new P();
    const r = p.analyze('// ==UserScript==\n// @match https://a.example/*\nGM_setValue("k","v");');
    assert(r.grants.includes('GM_setValue'), 'grant detected');
  });

  // optimizer
  record('optimizer', () => {
    const O = modules.optimizer.ScriptOptimizer;
    const o = new O();
    const r = o.analyze('function a(){ return 1; }\nconst unusedVar = 5;\n');
    assert(r.suggestions.length >= 1, 'at least one suggestion');
  });

  // plugin submission
  record('plugin-submission', () => {
    const P = modules.pluginSubmission.PluginSubmission;
    const p = new P();
    const bad = p.validate({ id: 'x' });
    assert(!bad.ok, 'missing fields rejected');
    const good = p.validate({ id: 'x', name: 'X', version: '1.0.0', description: 'd', author: 'a', downloadUrl: 'u', permissions: [] });
    assert(good.ok, 'complete manifest accepted');
  });

  // monitor
  record('monitor', () => {
    const M = modules.monitor.Monitor;
    const m = new M();
    m.sample('fps', 60);
    m.sample('fps', 55);
    assert(m.summary().length >= 1, 'summary has metrics');
    m.captureError(new Error('boom'), 'unit');
    assert(m.getErrors().length >= 1, 'error captured');
  });

  // locale bundles + translation framework
  record('locale-bundles', () => {
    const L = modules.localeBundles.LocaleTemplateBundles;
    const l = new L();
    assert(l.forLocale('es').length === 2, 'es bundle has 2 templates');
  });
  record('translation-framework', () => {
    const T = modules.translationFramework.TranslationFramework;
    const t = new T();
    const pack = t.submitPack({ locale: 'fr', strings: { generate: 'Générer' } });
    assert.strictEqual(pack.generate, 'Générer', 'fr pack merged');
  });

  // api server validator
  record('api-server validate', () => {
    const v = modules.apiServer.validateScript('// ==UserScript==\n// @grant none\n(function(){})();');
    assert(v.score > 0, 'score computed');
  });

  // plugin API v3 — stable
  record('plugin-api-v3', () => {
    const P = modules.pluginApiV3.PluginAPIv3;
    const api = new P();
    assert(!api.validate({ id: 'Bad ID!' }).ok, 'invalid manifest rejected');
    api.register({ id: 'dep', version: '2.0.0', name: 'Dep', description: 'dep', author: 'a', permissions: [] }, {});
    api.register({
      id: 'main', version: '1.0.0', name: 'Main', description: 'main', author: 'a',
      permissions: ['storage:local'], dependencies: [{ id: 'dep', version: '^2.0.0' }]
    }, {
      onInstall(ctx) { ctx.storage.set('installed', true); },
      main(ctx, n) { return ctx.storage.get('installed') ? 'ready:' + n : 'no'; }
    });
    assert.strictEqual(api.listInstalled().length, 2, 'two plugins installed');
    api.activate('main');
    assert.strictEqual(api.invoke('main', 'main', [7]), 'ready:7', 'sandboxed invoke works');
    assert.strictEqual(api.resolveDependencies('main').join(','), 'dep', 'dependency order');
    assert.strictEqual(P.VERSION, '3.0.0', 'reports v3 version');
  });

  // fine-tuning
  record('fine-tuning', () => {
    const F = modules.fineTuning.FineTuningManager;
    const ft = new F();
    ft.createDataset({ id: 'd1', entries: [{ text: 'Hi', completion: 'Hello!' }] });
    const j = ft.createJob({ id: 'j1', dataset: 'd1', baseModel: 'gpt-4o-mini' });
    assert.strictEqual(j.status, 'queued', 'job queued');
    ft.startJob('j1');
    ft.completeJob('j1', { loss: 0.1 });
    assert.strictEqual(ft.getJob('j1').status, 'completed', 'job completed');
    const cost = ft.estimateCost('j1');
    assert(cost.totalTokens >= 1, 'cost estimated');
    assert.strictEqual(JSON.parse(ft.exportDataset('d1', 'jsonl').trim().split('\n')[0]).completion, 'Hello!', 'jsonl export');
  });

  // template-exchange
  record('template-exchange', () => {
    const T = modules.templateExchange.TemplateExchange;
    const te = new T();
    assert(te.catalogStats().total >= 50, '50+ templates seeded');
    te.rate('prod-01', 5, 'u1');
    te.rate('prod-01', 3, 'u2');
    const found = te.search('meeting', { category: 'productivity' }).find(t => t.id === 'prod-01');
    assert(found.stars === 4 && found.ratingCount === 2, 'rating averaged + counted');
    const round = new T();
    round.importJson(te.exportJson());
    assert.strictEqual(round.catalogStats().total, te.catalogStats().total, 'JSON round-trip');
  });

  if (failures.length) {
    console.error('\nSELF-TEST FAILED (' + failures.length + '):');
    failures.forEach(f => console.error('  - ' + f));
    process.exit(1);
  }
  console.log('\nALL v3 SELF-TESTS PASS');
}

if (process.argv.includes('--selftest')) selfTest();

module.exports = modules;