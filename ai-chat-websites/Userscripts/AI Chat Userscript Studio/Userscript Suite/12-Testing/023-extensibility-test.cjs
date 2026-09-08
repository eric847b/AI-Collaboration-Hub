'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const MODULE_PATH = path.resolve(__dirname, '..', 'Modules', '00-Core', '034-extensibility.module.user.js');
const source = fs.readFileSync(MODULE_PATH, 'utf8');

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log('  PASS  ' + name); }
  catch (e) { failed++; console.log('  FAIL  ' + name + ': ' + e.message); }
}

const sandbox = {
  window: {},
  GM_setValue: (k, v) => { sandbox._store = sandbox._store || {}; sandbox._store[k] = v; },
  GM_getValue: (k, d) => { sandbox._store = sandbox._store || {}; return sandbox._store[k] !== undefined ? sandbox._store[k] : d; },
  Date, JSON, Math, Object, Array, String, Number, Boolean,
  console,
};
sandbox.window.__NEXUS_HUB__ = { register: () => {} };
const ctx = vm.createContext(sandbox);
vm.runInContext(source, ctx, { filename: '034-extensibility.module.user.js' });
const m = sandbox.window.__NEXUS_EXTENSIBILITY__;
assert(m, 'module should export __NEXUS_EXTENSIBILITY__');

console.log('\n=== Module 034: Extensibility (281-300) ===\n');

// --- 281: Plugin marketplace ---
test('281 publishPlugin / getPlugin', () => {
  const p = m.Extensibility.publishPlugin({ name: 'Dark Mode', version: '2.1.0', author: 'alice', tags: ['ui', 'theme'] });
  const got = m.Extensibility.getPlugin(p.id);
  assert.strictEqual(got.name, 'Dark Mode');
  assert.strictEqual(got.version, '2.1.0');
  assert.strictEqual(got.downloads, 0);
  assert.strictEqual(got.rating, 0);
});
test('281 listPlugins filter + sort', () => {
  m.Extensibility.publishPlugin({ name: 'Beta', author: 'bob', tags: ['extra'] });
  const byTag = m.Extensibility.listPlugins({ tag: 'ui' });
  assert.ok(byTag.length >= 1);
  assert.ok(byTag.every(p => p.tags.includes('ui')));
  const byQuery = m.Extensibility.listPlugins({ query: 'dark' });
  assert.strictEqual(byQuery[0].name, 'Dark Mode');
});
test('281 ratePlugin average', () => {
  const p = m.Extensibility.publishPlugin({ name: 'Rated', author: 'alice' });
  m.Extensibility.ratePlugin(p.id, 5);
  m.Extensibility.ratePlugin(p.id, 3);
  const got = m.Extensibility.getPlugin(p.id);
  assert.strictEqual(got.ratingCount, 2);
  assert.ok(Math.abs(got.rating - 4) < 1e-9);
});

// --- 282: Extension registry ---
test('282 registerExtension / get / list / enable', () => {
  const e = m.Extensibility.registerExtension({ name: 'collab', version: '0.9.0', deps: ['hub'] });
  assert.strictEqual(e.enabled, true);
  assert.strictEqual(m.Extensibility.getExtension(e.id).name, 'collab');
  assert.ok(m.Extensibility.listExtensions().some(x => x.name === 'collab'));
  const off = m.Extensibility.enableExtension(e.id, false);
  assert.strictEqual(off.enabled, false);
});

// --- 283: Theme gallery ---
test('283 addTheme / activateTheme exclusive', () => {
  const a = m.Extensibility.addTheme({ name: 'midnight', dark: true, variables: { bg: '#111' } });
  const b = m.Extensibility.addTheme({ name: 'solar', variables: { bg: '#fff' } });
  assert.strictEqual(a.dark, true);
  m.Extensibility.activateTheme(a.id);
  assert.strictEqual(m.Extensibility.getTheme(a.id).active, true);
  m.Extensibility.activateTheme(b.id);
  assert.strictEqual(m.Extensibility.getTheme(a.id).active, false);
  assert.strictEqual(m.Extensibility.getTheme(b.id).active, true);
});
test('283 listThemes', () => {
  assert.ok(m.Extensibility.listThemes().length >= 2);
});
// --- 284: Snippet sharing ---
test('284 shareSnippet / forkSnippet', () => {
  const s = m.Extensibility.shareSnippet({ title: 'fetch-json', language: 'javascript', code: 'fetch(url).then(r=>r.json())', tags: ['net'] });
  const f = m.Extensibility.forkSnippet(s.id);
  assert.strictEqual(f.title, 'fetch-json (fork)');
  assert.strictEqual(m.Extensibility.getSnippet(s.id).forks, 1);
  assert.notStrictEqual(f.id, s.id);
});
test('284 listSnippets filter', () => {
  const js = m.Extensibility.listSnippets({ language: 'javascript' });
  assert.ok(js.length >= 1);
});

// --- 285: Template library ---
test('285 addTemplate / instantiateTemplate', () => {
  const t = m.Extensibility.addTemplate({ name: 'api-client', type: 'code', content: 'const {{service}} = new Client("{{host}}");', variables: ['service', 'host'] });
  const out = m.Extensibility.instantiateTemplate(t.id, { service: 'github', host: 'api.github.com' });
  assert.strictEqual(out.content, 'const github = new Client("api.github.com");');
  assert.strictEqual(m.Extensibility.getTemplate(t.id).uses, 1);
});
test('285 listTemplates by type', () => {
  assert.ok(m.Extensibility.listTemplates('code').length >= 1);
});

// --- 286: Workflow marketplace ---
test('286 publishWorkflow / installWorkflow', () => {
  const w = m.Extensibility.publishWorkflow({ name: 'daily-digest', author: 'carol', steps: [{ id: 'collect' }, { id: 'send' }], trigger: 'cron' });
  assert.strictEqual(w.trigger, 'cron');
  assert.strictEqual(w.steps.length, 2);
  m.Extensibility.installWorkflow(w.id);
  assert.strictEqual(m.Extensibility.getWorkflow(w.id).installs, 1);
});

// --- 287: Integration directory ---
test('287 registerDirectoryEntry / listDirectory', () => {
  m.Extensibility.registerDirectoryEntry({ name: 'slack', type: 'messaging', url: 'https://slack.com/api' });
  const msg = m.Extensibility.listDirectory('messaging');
  assert.ok(msg.some(e => e.name === 'slack'));
});

// --- 288: Community modules ---
test('288 submit / approve / vote community module', () => {
  const cm = m.Extensibility.submitCommunityModule({ name: 'emoji-ext', author: 'dev-42', code: 'export {}' });
  assert.strictEqual(cm.status, 'pending');
  assert.strictEqual(cm.votes, 0);
  m.Extensibility.voteCommunityModule(cm.id);
  m.Extensibility.approveCommunityModule(cm.id);
  const got = m.state.registry.extensions[cm.id];
  assert.strictEqual(got.status, 'approved');
  assert.strictEqual(got.votes, 1);
});

// --- 289: Third-party extensions ---
test('289 installThirdParty / listThirdParty', () => {
  m.Extensibility.installThirdParty({ name: 'analytics-pro', version: '3.0.0' });
  const tps = m.Extensibility.listThirdParty();
  assert.ok(tps.some(t => t.name === 'analytics-pro' && t.thirdParty === true));
});

// --- 290: Partner integrations ---
test('290 addPartner / listPartners', () => {
  m.Extensibility.addPartner({ name: 'acme-corp', level: 'platinum', apis: ['billing'] });
  const plats = m.Extensibility.listPartners('platinum');
  assert.ok(plats.some(p => p.name === 'acme-corp'));
  m.Extensibility.addPartner({ name: 'startup-inc', level: 'standard' });
  assert.strictEqual(m.Extensibility.listPartners('standard').length, 1);
});
// --- 291: API versioning ---
test('291 registerApiVersion / getApiVersions / getLatestVersion', () => {
  m.Extensibility.registerApiVersion({ name: 'users-api', version: 'v1', endpoint: '/users' });
  m.Extensibility.registerApiVersion({ name: 'users-api', version: 'v2', endpoint: '/v2/users' });
  const vs = m.Extensibility.getApiVersions('users-api');
  assert.strictEqual(vs.length, 2);
  assert.strictEqual(m.Extensibility.getLatestVersion('users-api').version, 'v2');
});

// --- 292: Deprecation policy ---
test('292 deprecateApi + notice', () => {
  m.Extensibility.deprecateApi('users-api', 'v1', { reason: 'superseded by v2', notice: 'v1 removed next quarter' });
  const deps = m.Extensibility.getDeprecatedApis();
  assert.ok(deps.some(d => d.name === 'users-api' && d.version === 'v1'));
  assert.ok(m.Extensibility.getApiVersions('users-api')[0].deprecated);
  const notices = m.Extensibility.listNotices({ type: 'deprecation' });
  assert.ok(notices.some(n => n.message === 'v1 removed next quarter'));
});

// --- 293: Breaking change notices ---
test('293 addNotice / listNotices / acknowledgeNotice', () => {
  m.Extensibility.addNotice({ type: 'breaking', name: 'users-api', version: 'v2', message: 'drop password field' });
  const un = m.Extensibility.listNotices({ unacknowledged: true });
  assert.ok(un.some(n => n.message === 'drop password field'));
  const n = un.find(x => x.message === 'drop password field');
  m.Extensibility.acknowledgeNotice(n.id);
  assert.strictEqual(m.Extensibility.listNotices({ unacknowledged: true }).some(x => x.id === n.id), false);
});

// --- 294: Migration guides ---
test('294 addMigrationGuide / applyMigration', () => {
  const g = m.Extensibility.addMigrationGuide({ from: 'v1', to: 'v2', steps: ['rename field', 'update endpoint'] });
  const applied = m.Extensibility.applyMigration(g.id);
  assert.strictEqual(applied.applied, true);
  const guides = m.Extensibility.getMigrationGuides('v1', 'v2');
  assert.ok(guides.length >= 1);
});
test('294 guided-only migration', () => {
  const g = m.Extensibility.addMigrationGuide({ from: 'v2', to: 'v3', steps: ['manual step'], automated: false });
  const res = m.Extensibility.applyMigration(g.id);
  assert.strictEqual(res.guided, true);
  assert.strictEqual(res.applied, false);
});

// --- 295: Upgrade assistants ---
test('295 buildUpgradePlan flattens steps', () => {
  const guides = [m.Extensibility.getMigrationGuides('v1', 'v2')[0]];
  const plan = m.Extensibility.buildUpgradePlan('v1', 'v2', guides);
  assert.strictEqual(plan.from, 'v1');
  assert.strictEqual(plan.to, 'v2');
  assert.ok(plan.steps.some(s => s.step === 'rename field'));
});
// --- 296: Compatibility layers ---
test('296 registerCompatLayer / resolveCompat', () => {
  const l = m.Extensibility.registerCompatLayer({ name: 'legacy-bridge', from: 'old', to: 'new', shims: { getUsers: (args) => ({ shimmed: true, q: args }) } });
  const found = m.Extensibility.getCompatLayer('legacy-bridge');
  assert.strictEqual(found.id, l.id);
  const res = m.Extensibility.resolveCompat(l.id, 'getUsers', 'a=1');
  assert.strictEqual(res.shimmed, true);
  assert.strictEqual(res.q, 'a=1');
  assert.strictEqual(m.Extensibility.resolveCompat(l.id, 'missing'), null);
});

// --- 297: Polyfill management ---
test('297 registerPolyfill / getPolyfills / needsPolyfill', () => {
  m.Extensibility.registerPolyfill({ name: 'array-at', feature: 'array.at', priority: 10 });
  m.Extensibility.registerPolyfill({ name: 'array-find-last', feature: 'array.at', priority: 50 });
  const pfs = m.Extensibility.getPolyfills('array.at');
  assert.strictEqual(pfs.length, 2);
  assert.strictEqual(pfs[0].priority, 10);
  assert.strictEqual(m.Extensibility.needsPolyfill('array.at'), true);
  assert.strictEqual(m.Extensibility.needsPolyfill('nope'), false);
});

// --- 298: Adapter pattern ---
test('298 createAdapter adapt/convert', () => {
  const ad = m.Extensibility.createAdapter({ name: 'lower', source: 'SNAKE', target: 'camel', transform: (s) => String(s).toLowerCase() });
  assert.strictEqual(ad.name, 'lower');
  assert.strictEqual(ad.adapt('HELLO'), 'hello');
  const conv = m.Extensibility.createAdapter({ name: 'db', convert: (d) => ({ rows: d }) });
  assert.strictEqual(conv.convert([1, 2]).rows.length, 2);
});

// --- 299: Facade pattern ---
test('299 createFacade binds components', () => {
  const f = m.Extensibility.createFacade({
    name: 'orders',
    components: { repo: { save(x) { return 'saved:' + x; } } },
    expose: { save: (x) => f.components.repo.save(x) },
  });
  assert.strictEqual(f.components.repo.save('a'), 'saved:a');
  assert.strictEqual(f.expose.save('a'), 'saved:a');
});

// --- 300: Strategy pattern ---
test('300 createStrategy add/select/execute', () => {
  const s = m.Extensibility.createStrategy({ name: 'sort', strategies: { asc: (a) => a, desc: (a) => -a } });
  assert.strictEqual(s.execute(5), null); // nothing selected
  s.select('desc');
  assert.strictEqual(s.execute(5), -5);
  s.add('double', (a) => a * 2).select('double');
  assert.strictEqual(s.execute(3), 6);
});

// --- Persistence ---
test('state persisted to GM storage', () => {
  assert.ok(sandbox._store['nexus_extensibility'], 'GM_setValue should store state');
  const parsed = JSON.parse(sandbox._store['nexus_extensibility']);
  assert.ok(parsed.marketplace, 'stored state should have marketplace');
  assert.ok(parsed.lifecycle, 'stored state should have lifecycle');
});

// --- Summary ---
console.log('\n--- Summary ---');
console.log('Passed: ' + passed + ' / ' + (passed + failed));
console.log('Failed: ' + failed);
if (failed > 0) { console.log('\nFAILED TESTS:\n  (see above)'); }
process.exitCode = failed > 0 ? 1 : 0;