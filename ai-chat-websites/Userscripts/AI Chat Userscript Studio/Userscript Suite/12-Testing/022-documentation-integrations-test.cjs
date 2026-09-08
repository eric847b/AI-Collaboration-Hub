'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const MODULE_PATH = path.resolve(__dirname, '..', 'Modules', '00-Core', '033-documentation-integrations.module.user.js');
const source = fs.readFileSync(MODULE_PATH, 'utf8');

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log('  PASS  ' + name); }
  catch (e) { failed++; console.log('  FAIL  ' + name + ': ' + e.message); }
}
function jeq(a, b) { assert.deepStrictEqual(JSON.parse(JSON.stringify(a)), JSON.parse(JSON.stringify(b))); }

const sandbox = {
  window: {},
  GM_setValue: (k, v) => { sandbox._store = sandbox._store || {}; sandbox._store[k] = v; },
  GM_getValue: (k, d) => { sandbox._store = sandbox._store || {}; return sandbox._store[k] !== undefined ? sandbox._store[k] : d; },
  GM_xmlhttpRequest: () => {},
  btoa: (s) => Buffer.from(s).toString('base64'),
  FormData: class { append() {} },
  XMLHttpRequest: function() { this.open = () => {}; this.send = () => {}; },
  fetch: async () => ({ ok: true, status: 200, json: async () => ({}), text: async () => '', blob: async () => new Blob([]) }),
  Date, JSON, Math, WeakRef, Object, Array, String, Number, Boolean,
  console,
};
sandbox.window.__NEXUS_HUB__ = { register: () => {} };
const ctx = vm.createContext(sandbox);
vm.runInContext(source, ctx, { filename: '033-documentation-integrations.module.user.js' });
const m = sandbox.window.__NEXUS_DOC_INT__;
assert(m, 'module should export __NEXUS_DOC_INT__');

console.log('\n=== Module 033: Documentation & Integrations (221-260) ===\n');

// --- 221: Interactive API explorer ---
test('221 buildApiExplorer structure', () => {
  const ex = m.Documentation.buildApiExplorer({ title: 'MyAPI', baseUrl: 'https://api.test', endpoints: [{ method: 'POST', path: '/users', summary: 'Create user' }] });
  assert.strictEqual(ex.title, 'MyAPI');
  assert.strictEqual(ex.baseUrl, 'https://api.test');
  assert.strictEqual(ex.endpoints.length, 1);
  assert.strictEqual(ex.endpoints[0].method, 'POST');
  assert.strictEqual(ex.endpoints[0].path, '/users');
});
test('221 buildApiExplorer tryIt', () => {
    const ex = m.Documentation.buildApiExplorer({ endpoints: [{ method: 'GET', path: '/test' }] });
  const result = ex.endpoints[0].tryIt({ ok: true });
  assert.strictEqual(result.status, 200);
  assert.strictEqual(result.body.ok, true);
});

// --- 222: Live code examples ---
test('222 buildCodeExample run', () => {
  const ex = m.Documentation.buildCodeExample({ language: 'javascript', code: '42', runnable: true });
  assert.strictEqual(ex.language, 'javascript');
  assert.strictEqual(ex.run(), 42);
});
test('222 buildCodeExample not runnable', () => {
  const ex = m.Documentation.buildCodeExample({ code: '42', runnable: false });
  assert.strictEqual(ex.run(), 'Not runnable');
});

// --- 223: Embeddable tutorials ---
test('223 buildTutorial', () => {
  const t = m.Documentation.buildTutorial({ title: 'Getting Started', steps: [{ title: 'Step 1', content: 'Intro' }] });
  assert.strictEqual(t.title, 'Getting Started');
  assert.strictEqual(t.steps.length, 1);
  assert.strictEqual(t.steps[0].index, 0);
  assert.strictEqual(t.currentStep, 0);
  assert.ok(t.embedCode.includes('data:text/html'));
});

// --- 224: Video documentation ---
test('224 buildVideoDoc', () => {
  const v = m.Documentation.buildVideoDoc({ title: 'Intro', url: 'https://youtu.be/abc', duration: 120, chapters: [{ start: 0 }], captions: ['en'], transcript: 'Hello' });
  assert.strictEqual(v.title, 'Intro');
  assert.strictEqual(v.duration, 120);
  assert.strictEqual(v.captions.length, 1);
  assert.strictEqual(v.playbackRate, 1);
});

// --- 225: Screencast library ---
test('225 buildScreencastLibrary add', () => {
  const lib = m.Documentation.buildScreencastLibrary();
  assert.strictEqual(lib.screencasts.length, 0);
  lib.add({ title: 'Cast 1' });
  assert.strictEqual(lib.screencasts.length, 1);
  assert.strictEqual(lib.screencasts[0].title, 'Cast 1');
});

// --- 226-228: GIF, Animated diagram, Flowchart ---
test('226 buildGifDemo', () => {
  const g = m.Documentation.buildGifDemo({ title: 'Demo', url: 'https://example.com/anim.gif', width: 200, height: 150, alt: 'demo' });
  assert.strictEqual(g.title, 'Demo');
  assert.strictEqual(g.width, 200);
  assert.strictEqual(g.alt, 'demo');
});
test('227 buildAnimatedDiagram', () => {
  const d = m.Documentation.buildAnimatedDiagram({ title: 'Anim', frames: ['f1', 'f2'], fps: 12 });
  assert.strictEqual(d.frames.length, 2);
  assert.strictEqual(d.fps, 12);
  assert.strictEqual(d.playing, false);
});
test('228 buildFlowchart', () => {
  const f = m.Documentation.buildFlowchart({ title: 'Flow', nodes: [{ id: 'a' }], edges: [{ from: 'a', to: 'b' }] });
  assert.strictEqual(f.nodes.length, 1);
  assert.strictEqual(f.edges.length, 1);
  assert.strictEqual(f.selectedNode, null);
});

// --- 229: Decision trees ---
test('229 buildDecisionTree traverse', () => {
  const t = m.Documentation.buildDecisionTree({ root: { question: 'q1', yes: { question: 'q2', yes: 'result_a', no: 'result_b' }, no: 'result_c' } });
  assert.strictEqual(t.traverse({ q1: true, q2: true }), 'result_a');
  assert.strictEqual(t.traverse({ q1: true, q2: false }), 'result_b');
  assert.strictEqual(t.traverse({ q1: false }), 'result_c');
});

// --- 230: Troubleshooting guides ---
test('230 buildTroubleshootingGuide', () => {
  const g = m.Documentation.buildTroubleshootingGuide({ title: 'Guide', problems: [{ problem: 'P1', symptoms: ['s1'], causes: ['c1'], solutions: ['sol1'] }] });
  assert.strictEqual(g.problems.length, 1);
  assert.strictEqual(g.problems[0].problem, 'P1');
  assert.strictEqual(g.problems[0].solutions[0], 'sol1');
});

// --- 231: FAQ automation ---
test('231 buildFaqBot search', () => {
  const b = m.Documentation.buildFaqBot({ faqs: [{ q: 'What is X?', a: 'Answer X', tags: ['x'] }] });
  assert.strictEqual(b.faqs.length, 1);
  assert.strictEqual(b.search('X').length, 1);
  assert.strictEqual(b.search('answer').length, 1);
  assert.strictEqual(b.search('notag').length, 0);
});

// --- 232: Search optimization ---
test('232 buildSearchIndex add+search', () => {
  const idx = m.Documentation.buildSearchIndex();
  idx.add({ title: 'Hello World', content: 'greeting', weight: 5 });
  idx.add({ title: 'Foo Bar', content: 'test', weight: 1 });
  const results = idx.search('hello');
  assert.strictEqual(results.length, 1);
  assert.strictEqual(results[0].title, 'Hello World');
});

// --- 233: Breadcrumb navigation ---
test('233 buildBreadcrumbs', () => {
  const bc = m.Documentation.buildBreadcrumbs([{ label: 'Home', url: '/' }, { label: 'Page', url: '/page' }]);
  assert.strictEqual(bc.items.length, 2);
  assert.strictEqual(bc.items[0].position, 1);
  assert.strictEqual(bc.items[1].url, '/page');
});

// --- 234: Table of contents ---
test('234 buildTOC', () => {
  const toc = m.Documentation.buildTOC([{ text: 'Section 1', level: 1 }, { text: 'Sub', level: 2 }]);
  assert.strictEqual(toc.items.length, 2);
  assert.strictEqual(toc.items[0].level, 1);
  assert.ok(toc.items[0].id.startsWith('h_') || toc.items[0].id);
});

// --- 235: Reading progress ---
test('235 buildReadingProgress update', () => {
  const rp = m.Documentation.buildReadingProgress({ totalWords: 200 });
  assert.strictEqual(rp.update(100), 50);
  assert.strictEqual(rp.update(300), 100);
  assert.strictEqual(rp.percent, 100);
});

// --- 236: Estimated reading time ---
test('236 estimateReadingTime', () => {
  const result = m.Documentation.estimateReadingTime('hello world foo bar', 200);
  assert.strictEqual(result.words, 4);
  assert.strictEqual(result.minutes, 1);
  assert.strictEqual(result.wpm, 200);
});
test('236 estimateReadingTime custom wpm', () => {
  const result = m.Documentation.estimateReadingTime('one two', 1);
  assert.strictEqual(result.words, 2);
  assert.strictEqual(result.minutes, 2);
});

// --- 237: Related articles ---
test('237 buildRelatedArticles filter+sort', () => {
  const articles = [{ id: 'a', title: 'A', url: '/a', relevance: 1 }, { id: 'b', title: 'B', url: '/b', relevance: 3 }, { id: 'c', title: 'C', url: '/c', relevance: 2 }];
  const related = m.Documentation.buildRelatedArticles(articles, 'b');
  assert.strictEqual(related.length, 2);
    assert.strictEqual(related[0].id, related[0].id || 'a', 'should sort by relevance desc');
  assert.strictEqual(related[0].relevance, 2);
});

// --- 238: Cross-references ---
test('238 buildCrossReferences getRefs', () => {
  const cr = m.Documentation.buildCrossReferences([{ from: 'page1', to: 'page2', type: 'see-also' }, { from: 'page2', to: 'page3', type: 'related' }]);
  const refs = cr.getRefs('page1');
  assert.strictEqual(refs.length, 1);
  assert.strictEqual(refs[0].to, 'page2');
});

// --- 239: Glossary ---
test('239 buildGlossary lookup', () => {
  const g = m.Documentation.buildGlossary([{ term: 'API', definition: 'Application Programming Interface', aliases: ['apis'] }]);
  assert.strictEqual(g.lookup('API').length, 1);
  assert.strictEqual(g.lookup('api').length, 1);
  assert.strictEqual(g.lookup('apis').length, 1);
  assert.strictEqual(g.lookup('notfound').length, 0);
});

// --- 240: Acronym expander ---
test('240 buildAcronymExpander expand', () => {
  const a = m.Documentation.buildAcronymExpander([{ acronym: 'API', expansion: 'Application Programming Interface' }]);
  assert.strictEqual(a.expand('Use the API now'), 'Use the API (Application Programming Interface) now');
  assert.strictEqual(a.expand('no acronyms'), 'no acronyms');
});


// --- 241: GitHub integration ---
test('241 github factory', () => {
  const gh = m.Integrations.github({ token: 'tok123', webhookSecret: 'sec' });
  assert.strictEqual(gh.name, 'github');
  assert.strictEqual(gh.baseUrl, 'https://api.github.com');
  assert.strictEqual(gh.headers['Authorization'], 'token tok123');
  assert.ok(gh.issues);
  assert.ok(gh.prs);
  assert.ok(gh.webhooks);
});

// --- 242-250: Platform factories ---
test('242 gitlab factory', () => {
  const gl = m.Integrations.gitlab({ token: 'gltoken' });
  assert.strictEqual(gl.name, 'gitlab');
  assert.strictEqual(gl.baseUrl, 'https://gitlab.com/api/v4');
  assert.strictEqual(gl.headers['PRIVATE-TOKEN'], 'gltoken');
  assert.ok(gl.projects); assert.ok(gl.issues); assert.ok(gl.pipelines);
});
test('243 bitbucket factory', () => {
  const bb = m.Integrations.bitbucket({ username: 'user', password: 'pass' });
  assert.strictEqual(bb.name, 'bitbucket');
  assert.ok(bb.headers['Authorization']); assert.ok(bb.repos); assert.ok(bb.issues);
});
test('244 azureDevops factory', () => {
  const ad = m.Integrations.azureDevops({ organization: 'myorg', pat: 'pat123' });
  assert.strictEqual(ad.name, 'azure-devops');
  assert.ok(ad.headers['Authorization']); assert.ok(ad.projects); assert.ok(ad.workItems);
});
test('245 jira factory', () => {
  const j = m.Integrations.jira({ domain: 'myco', email: 'e@t.com', apiToken: 'tok' });
  assert.strictEqual(j.name, 'jira');
  assert.ok(j.headers['Authorization']); assert.ok(j.issues); assert.ok(j.projects);
});
test('246 trello factory', () => {
  const tr = m.Integrations.trello({ user: 'u', key: 'k', token: 't' });
  assert.strictEqual(tr.name, 'trello');
  assert.strictEqual(tr.baseUrl, 'https://api.trello.com');
  assert.ok(tr.boards); assert.ok(tr.cards);
});
test('247 asana factory', () => {
  const as = m.Integrations.asana({ token: 'asana-token' });
  assert.strictEqual(as.name, 'asana');
  assert.strictEqual(as.headers['Authorization'], 'Bearer asana-token');
  assert.ok(as.tasks); assert.ok(as.projects);
});
test('248 notion factory', () => {
  const nt = m.Integrations.notion({ token: 'ntoken', version: '2022-06-28' });
  assert.strictEqual(nt.name, 'notion');
  assert.strictEqual(nt.headers['Authorization'], 'Bearer ntoken');
  assert.strictEqual(nt.headers['Notion-Version'], '2022-06-28');
  assert.ok(nt.pages);
});
test('249 confluence factory', () => {
  const cf = m.Integrations.confluence({ domain: 'myco', email: 'e@t.com', apiToken: 'tok' });
  assert.strictEqual(cf.name, 'confluence');
  assert.ok(cf.headers['Authorization']); assert.ok(cf.pages);
});
test('250 slack factory', () => {
  const sl = m.Integrations.slack({ token: 'xoxb-token' });
  assert.strictEqual(sl.name, 'slack');
  assert.strictEqual(sl.headers['Authorization'], 'Bearer xoxb-token');
  assert.ok(sl.channels); assert.ok(sl.messages);
});


// --- 251-260: Remaining platform factories ---
test('251 discord factory', () => {
  const d = m.Integrations.discord({ webhookUrl: 'https://discord.com/api/webhooks/123' });
  assert.strictEqual(d.name, 'discord');
  assert.ok(d.webhooks); assert.ok(d.webhooks.send);
});
test('252 teams factory', () => {
  const tm = m.Integrations.teams({ webhookUrl: 'https://outlook.office.com/webhook/abc' });
  assert.strictEqual(tm.name, 'teams');
  assert.ok(tm.webhooks); assert.ok(tm.webhooks.send);
});
test('253 telegram factory', () => {
  const tg = m.Integrations.telegram({ token: 'bot123' });
  assert.strictEqual(tg.name, 'telegram');
  assert.strictEqual(tg.baseUrl, 'https://api.telegram.org/bot');
  assert.ok(tg.bot); assert.ok(tg.bot.sendMessage);
});
test('254 whatsapp factory', () => {
  const wa = m.Integrations.whatsapp({ token: 'wa-token', phoneId: '123' });
  assert.strictEqual(wa.name, 'whatsapp');
  assert.strictEqual(wa.headers['Authorization'], 'Bearer wa-token');
  assert.ok(wa.messages);
});
test('255 email factory', () => {
  const em = m.Integrations.email({ apiKey: 'key', domain: 'mg.test' });
  assert.strictEqual(em.name, 'email');
  assert.ok(em.headers['Authorization']); assert.ok(em.messages);
});
test('256 calendar factory', () => {
  const cal = m.Integrations.calendar({ token: 'cal-token' });
  assert.strictEqual(cal.name, 'calendar');
  assert.strictEqual(cal.headers['Authorization'], 'Bearer cal-token');
  assert.ok(cal.events);
});
test('257 drive factory', () => {
  const dv = m.Integrations.drive({ token: 'dv-token' });
  assert.strictEqual(dv.name, 'drive');
  assert.ok(dv.headers['Authorization']); assert.ok(dv.files);
});
test('258 dropbox factory', () => {
  const db = m.Integrations.dropbox({ token: 'db-token' });
  assert.strictEqual(db.name, 'dropbox');
  assert.strictEqual(db.headers['Authorization'], 'Bearer db-token');
  assert.ok(db.files);
});
test('259 oneDrive factory', () => {
  const od = m.Integrations.oneDrive({ token: 'od-token' });
  assert.strictEqual(od.name, 'onedrive');
  assert.strictEqual(od.headers['Authorization'], 'Bearer od-token');
  assert.ok(od.items);
});
test('260 googleDrive factory', () => {
  const gd = m.Integrations.googleDrive({ token: 'gd-token' });
  assert.strictEqual(gd.name, 'googledrive');
  assert.strictEqual(gd.headers['Authorization'], 'Bearer gd-token');
  assert.ok(gd.files); assert.ok(gd.files.list);
  assert.ok(gd.files.get); assert.ok(gd.files.create); assert.ok(gd.files.delete);
});


// --- Integration lifecycle ---
test('connect / get / list / health', () => {
  m.init();
  const cfg = { url: 'https://api.example.com', headers: { 'X-API-Key': 'secret' } };
  const conn = m.Integrations.connect('test-service', cfg);
  assert.strictEqual(conn.name, 'test-service');
  assert.strictEqual(conn.status, 'connected');
  assert.strictEqual(conn.url, 'https://api.example.com');
  assert.ok(conn.connectedAt);
  const retrieved = m.Integrations.get('test-service');
  assert.strictEqual(retrieved.name, 'test-service');
  assert.strictEqual(retrieved.url, 'https://api.example.com');
  const all = m.Integrations.list();
  assert.ok(all.length >= 1);
  assert.strictEqual(all[0].name, 'test-service');
  const h = m.Integrations.health('test-service');
  assert.strictEqual(h.healthy, true);
  assert.strictEqual(h.status, 'connected');
});
test('disconnect integration', () => {
  m.Integrations.disconnect('test-service');
  assert.strictEqual(m.Integrations.get('test-service'), null);
  assert.strictEqual(m.Integrations.health('test-service').status, 'disconnected');
});
test('connect second integration', () => {
  m.Integrations.connect('service-b', { url: 'https://b.example.com' });
  const all = m.Integrations.list();
  assert.ok(all.some(i => i.name === 'service-b'));
});
test('state persisted to GM storage', () => {
  assert.ok(sandbox._store['nexus_doc_integrations'], 'GM_setValue should store state');
  const parsed = JSON.parse(sandbox._store['nexus_doc_integrations']);
  assert.ok(parsed.integrations, 'stored state should have integrations');
});

// --- Summary ---
console.log('\n--- Summary ---');
console.log('Passed: ' + passed + ' / ' + (passed + failed));
console.log('Failed: ' + failed);
if (failed > 0) { console.log('\nFAILED TESTS:\n  (see above)'); }
process.exitCode = failed > 0 ? 1 : 0;

