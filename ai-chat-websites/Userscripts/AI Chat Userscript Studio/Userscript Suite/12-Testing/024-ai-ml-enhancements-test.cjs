'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const MODULE_PATH = path.resolve(__dirname, '..', 'Modules', '00-Core', '035-ai-ml-enhancements.module.user.js');
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
  Date, JSON, Math, Object, Array, String, Number, Set, Boolean, RegExp,
  console,
};
sandbox.window.__NEXUS_HUB__ = { register: () => {} };
const ctx = vm.createContext(sandbox);
vm.runInContext(source, ctx, { filename: '035-ai-ml-enhancements.module.user.js' });
const m = sandbox.window.__NEXUS_AI_ML__;
assert(m, 'module should export __NEXUS_AI_ML__');

console.log('\n=== Module 035: AI/ML Enhancements (301-320) ===\n');

// --- 301: NLU ---
test('301 understand structure', () => {
  const u = m.AI.understand('What is the price of X? Visit https://example.com');
  assert.strictEqual(u.wordCount, 10);
  assert.strictEqual(u.sentenceCount, 2);
  assert.strictEqual(u.features.hasQuestion, true);
  assert.strictEqual(u.features.hasUrl, true);
  assert.strictEqual(u.features.hasNumber, false);
});
test('301 understand normalized + allCaps', () => {
  const u = m.AI.understand('  THIS   IS  IMPORTANT!  ');
  assert.strictEqual(u.normalized, 'this is important!');
  assert.strictEqual(u.features.allCaps, true);
  assert.strictEqual(u.features.hasExclamation, true);
});

// --- 302: Intent classification ---
test('302 trainIntent + classifyIntent hit', () => {
  m.AI.trainIntent('greeting', ['hello there', 'hi how are you', 'good morning']);
  m.AI.trainIntent('order', ['i want to order a pizza', 'can i place an order']);
  const c = m.AI.classifyIntent('hello there friend');
  assert.strictEqual(c.name, 'greeting');
  assert.ok(c.confidence > 0);
});
test('302 classifyIntent unknown', () => {
  const c = m.AI.classifyIntent('zzzx qqqw random');
  assert.strictEqual(c.name, null);
});

// --- 303: Entity extraction ---
test('303 extractEntities finds types', () => {
  const e = m.AI.extractEntities('Email me at john@test.com or visit https://site.io #tag @mike');
  const types = e.map(x => x.type);
  assert.ok(types.includes('email'));
  assert.ok(types.includes('url'));
  assert.ok(types.includes('hashtag'));
  assert.ok(types.includes('mention'));
  assert.ok(e.every(x => x.start >= 0));
});
test('303 extractEntities sorted by start', () => {
  const e = m.AI.extractEntities('2024-01-01 then $50 then 1.2.3.4');
  assert.ok(e.length >= 2, 'expected at least 2 entities');
  for (let i = 1; i < e.length; i++) {
    assert.ok(e[i - 1].start <= e[i].start, 'entities should be sorted by start offset');
  }
});

// --- 304: Sentiment ---
test('304 sentiment positive', () => {
  const s = m.AI.sentimentScore('This is great and amazing, I love it!');
  assert.strictEqual(s.label, 'positive');
  assert.ok(s.score > 0.15);
});
test('304 sentiment negative', () => {
  const s = m.AI.sentimentScore('This is terrible and awful, I hate it.');
  assert.strictEqual(s.label, 'negative');
  assert.ok(s.score < -0.15);
});
test('304 sentiment neutral', () => {
  const s = m.AI.sentimentScore('The train leaves at 9am tomorrow.');
  assert.strictEqual(s.label, 'neutral');
});
test('304 sentiment negation', () => {
  const s = m.AI.sentimentScore('not bad at all');
  assert.ok(s.score >= -0.15);
});
// --- 305: Topic modeling ---
test('305 detectTopics tech', () => {
  const t = m.AI.detectTopics('I built a software API with cloud storage and a database', 2);
  assert.ok(t.some(x => x.topic === 'tech'));
  assert.ok(t.every(x => x.keywords.length > 0));
});
test('305 detectTopics empty text', () => {
  const t = m.AI.detectTopics('abc def ghi');
  assert.strictEqual(t.length, 0);
});

// --- 306: Summarization ---
test('306 summarize extracts best sentences', () => {
  const text = 'The weather is sunny. Sun is bright and warm. I will go running. Running is healthy.';
  const res = m.AI.summarize(text, 2);
  assert.ok(res.sentences.length >= 1);
  assert.ok(res.summary.length > 0);
  assert.ok(res.compression <= 1);
});
test('306 summarize single sentence', () => {
  const res = m.AI.summarize('Only one sentence here.', 3);
  assert.strictEqual(res.sentences.length, 1);
  assert.strictEqual(res.compression, 1);
});

// --- 308: Language detection ---
test('308 detectLanguage english', () => {
  const d = m.AI.detectLanguage('The quick brown fox jumps over the lazy dog');
  assert.strictEqual(d.lang, 'en');
  assert.strictEqual(d.script, 'latin');
});
test('308 detectLanguage spanish', () => {
  const d = m.AI.detectLanguage('El perro corre por el parque y está contento');
  assert.strictEqual(d.lang, 'es');
});
test('308 detectLanguage cyrillic script', () => {
  const d = m.AI.detectLanguage('Это хорошо для нашей команды');
  assert.strictEqual(d.script, 'cyrillic');
});

// --- 309: NER ---
test('309 extractNamedEntities person + date', () => {
  const ne = m.AI.extractNamedEntities('John Smith met on January 5th 2024');
  assert.ok(ne.some(n => n.type === 'PERSON' && n.value === 'John Smith'));
  assert.ok(ne.some(n => n.type === 'DATE'));
});
test('309 extractNamedEntities money/percent', () => {
  const ne = m.AI.extractNamedEntities('Raised $5M at 12% growth');
  assert.ok(ne.some(n => n.type === 'MONEY'));
  assert.ok(ne.some(n => n.type === 'PERCENT'));
});

// --- 310: POS tagging ---
test('310 tagPartsOfSpeech tags known classes', () => {
  const toks = m.AI.tagPartsOfSpeech('The quick fox ran to New York');
  const get = w => toks.find(t => t.word === w).pos;
  assert.strictEqual(get('The'), 'DT');
  assert.strictEqual(get('to'), 'IN');
  assert.strictEqual(get('New'), 'NNP');
  assert.strictEqual(get('ran'), 'VBD');
});
test('310 tagPartsOfSpeech number', () => {
  const toks = m.AI.tagPartsOfSpeech('I have 42 apples');
  assert.strictEqual(toks.find(t => t.word === '42').pos, 'CD');
});

// --- 311: Dependency parsing ---
test('311 parseDependencies produces relations', () => {
  const dp = m.AI.parseDependencies('The cat sat on the mat');
  assert.ok(dp.tokens.length >= 4);
  assert.ok(dp.dependencies.some(d => d.rel === 'det'));
  assert.ok(dp.dependencies.some(d => d.rel === 'prep'));
  assert.ok(dp.dependencies.every(d => typeof d.head === 'number'));
});
// --- 312: Coreference ---
test('312 resolveCoreferences he/she', () => {
  const r = m.AI.resolveCoreferences('Sarah went to the park. She enjoyed the sun. John stayed home. He was tired.');
  assert.ok(r.resolutions.some(x => x.pronoun === 'She' && x.antecedent.includes('Sarah')));
  assert.ok(r.resolutions.some(x => x.pronoun === 'He' && x.antecedent.includes('John')));
});
test('312 resolveCoreferences they', () => {
  const r = m.AI.resolveCoreferences('John and Mary left. They will be back soon.');
  const t = r.resolutions.find(x => x.pronoun === 'They');
  assert.ok(t && t.antecedent.includes('John'));
});

// --- 313: Question answering ---
test('313 answerQuestion finds sentence', () => {
  const ctxText = 'The capital of France is Paris. It has many museums. The weather is cold in winter.';
  const a = m.AI.answerQuestion(ctxText, 'What is the capital of France?');
  assert.ok(a.answer.includes('capital'));
  assert.strictEqual(a.index, 0);
  assert.ok(a.confidence > 0);
});
test('313 answerQuestion no match', () => {
  const a = m.AI.answerQuestion('Mostly about sports and games.', 'How are dinosaurs?');
  assert.strictEqual(a.answer, null);
  assert.strictEqual(a.confidence, 0);
});

// --- 314: Dialogue management ---
test('314 createSession / processTurn / fillSlot', () => {
  m.AI.trainIntent('weather', ['what is the weather', 'weather today', 'is it rainy']);
  const s = m.AI.createSession('s1');
  assert.strictEqual(s.turn, 0);
  const t = m.AI.processTurn('s1', 'what is the weather today', (sess, info) => { sess._queue = 'checking...'; });
  assert.strictEqual(t.turn, 1);
  assert.strictEqual(t.response, 'checking...');
  assert.strictEqual(t.intent.name, 'weather');
  m.AI.fillSlot('s1', 'city', 'London');
  assert.strictEqual(m.AI.getSession('s1').slots.city, 'London');
});
test('314 closeSession blocks turns', () => {
  m.AI.closeSession('s1');
  assert.strictEqual(m.AI.processTurn('s1', 'hello'), null);
});

// --- 315: Context tracking ---
test('315 trackContext window', () => {
  for (let i = 0; i < 8; i++) m.AI.trackContext('c1', 'turn ' + i);
  const c = m.AI.getContext('c1');
  assert.strictEqual(c.turns.length, 8);
  assert.strictEqual(c.window.length, 5);
});
test('315 trackContext entities + clear', () => {
  m.AI.trackContext('c2', 'contact bob@x.com');
  const c = m.AI.getContext('c2');
  assert.ok(c.entities['bob@x.com']);
  m.AI.clearContext('c2');
  assert.strictEqual(m.AI.getContext('c2').turns.length, 0);
});

// --- 316: Memory networks ---
test('316 writeMemory / readMemory / recall', () => {
  m.AI.writeMemory('pref', { theme: 'dark' });
  m.AI.writeMemory('name', 'Ada');
  const e = m.AI.readMemory('pref');
  assert.strictEqual(e.accesses, 1);
  const hits = m.AI.recallMemory('dark theme pref');
  assert.ok(hits.some(h => h.key === 'pref'));
});
test('316 forgetMemory', () => {
  m.AI.forgetMemory('name');
  assert.strictEqual(m.AI.readMemory('name'), null);
});
// --- 317: Knowledge graphs ---
test('317 addTriple + queryTriples', () => {
  m.AI.addTriple('Paris', 'capitalOf', 'France');
  m.AI.addTriple('Paris', 'hasRiver', 'Seine');
  const q = m.AI.queryTriples({ predicate: 'capitalOf' });
  assert.strictEqual(q.length, 1);
  assert.strictEqual(q[0].object, 'France');
  const all = m.AI.queryTriples({ subject: 'Paris' });
  assert.strictEqual(all.length, 2);
});
test('317 findPaths', () => {
  m.AI.addTriple('A', 'knows', 'B');
  m.AI.addTriple('B', 'knows', 'C');
  const path = m.AI.findPaths('A', 'C', 3);
  assert.strictEqual(path.length, 2);
  assert.strictEqual(path[0].via, 'knows');
  assert.strictEqual(path[1].to, 'C');
});

// --- 318: Reasoning engines ---
test('318 addFact/addRule/infer', () => {
  m.AI.addRule('mortal', ['human'], 'mortal');
  m.AI.addFact('human');
  const derived = m.AI.infer(5);
  assert.ok(derived.includes('mortal'));
  assert.ok(m.AI.queryFacts('mortal').length >= 1);
});
test('318 no false derivation', () => {
  m.AI.addRule('wings', ['bird'], 'canFly');
  const derived = m.AI.infer(3);
  assert.strictEqual(derived.includes('canFly'), false);
});

// --- 320: Decision support ---
test('320 evaluateOptions ranks by weight', () => {
  const options = [
    { name: 'A', scores: { cost: 5, speed: 3 } },
    { name: 'B', scores: { cost: 3, speed: 5 } },
  ];
  const ranked = m.AI.evaluateOptions(options, [{ name: 'cost', weight: 2 }, { name: 'speed', weight: 1 }]);
  assert.strictEqual(ranked[0].name, 'A');
  assert.strictEqual(ranked[0].score, 13);
});
test('320 decisionTree traversal', () => {
  const tree = {
    test: (i) => i.urgent,
    yes: { decision: 'handle now' },
    no: { test: (i) => i.big, yes: { decision: 'schedule' }, no: { decision: 'skip' } },
  };
  assert.strictEqual(m.AI.decisionTree(tree, { urgent: true }), 'handle now');
  assert.strictEqual(m.AI.decisionTree(tree, { urgent: false, big: true }), 'schedule');
  assert.strictEqual(m.AI.decisionTree(tree, { urgent: false, big: false }), 'skip');
});

// --- Persistence ---
test('state persisted to GM storage', () => {
  assert.ok(sandbox._store['nexus_ai_ml'], 'GM_setValue should store state');
  const parsed = JSON.parse(sandbox._store['nexus_ai_ml']);
  assert.ok(parsed.learned && parsed.learned.intents, 'stored state should have intents');
  assert.ok(parsed.knowledge && parsed.knowledge.triples, 'stored state should have triples');
});

// --- Summary ---
console.log('\n--- Summary ---');
console.log('Passed: ' + passed + ' / ' + (passed + failed));
console.log('Failed: ' + failed);
if (failed > 0) { console.log('\nFAILED TESTS:\n  (see above)'); }
process.exitCode = failed > 0 ? 1 : 0;