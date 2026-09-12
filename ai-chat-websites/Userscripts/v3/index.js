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
  apiServer: require('./api-server.js')
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

  if (failures.length) {
    console.error('\nSELF-TEST FAILED (' + failures.length + '):');
    failures.forEach(f => console.error('  - ' + f));
    process.exit(1);
  }
  console.log('\nALL v3 SELF-TESTS PASS');
}

if (process.argv.includes('--selftest')) selfTest();

module.exports = modules;