// ==UserScript==
// @name         Nexus AI/ML Enhancements
// @namespace     nexus-suite
// @version       2026.09.27.1
// @description  NLU, intent classification, entity extraction, sentiment, topic modeling, summarization, language detection, NER, POS tagging, dependency parsing, coreference, question answering, dialogue management, context tracking, memory networks, knowledge graphs, reasoning engines, decision support (ROADMAP 301-320)
// @match         *://*/*
// @grant         GM_getValue
// @grant         GM_setValue
// ==/UserScript==

(() => {
  'use strict';
  const MODULE_NAME = 'ai-ml-enhancements';
  const STORE_KEY = 'nexus_ai_ml';
  const state = {
    learned: { intents: {}, entities: {}, topics: {} },
    dialogue: { sessions: {} },
    context: {},
    memory: { entries: {}, salience: {} },
    knowledge: { triples: [], indexes: {} },
    facts: [],
    rules: {},
  };
  const PERSISTED_KEYS = Object.keys(state);
  function load() {
    try {
      const raw = GM_getValue(STORE_KEY, '{}');
      const parsed = JSON.parse(raw);
      for (const key of PERSISTED_KEYS) if (parsed[key] !== undefined) state[key] = parsed[key];
    } catch (e) { /* corrupt storage */ }
  }
  function persist() {
    try {
      const out = {};
      for (const key of PERSISTED_KEYS) out[key] = state[key];
      GM_setValue(STORE_KEY, JSON.stringify(out));
    } catch (e) { /* storage unavailable */ }
  }
  function uid() { return 'id_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8); }
  load();

  // ---- Shared text utilities ----
  function words(text) { return String(text || '').split(/[^a-z0-9']+/i).filter(Boolean); }
  function tokenize(text) { return String(text || '').toLowerCase().split(/[^a-z0-9']+/).filter(Boolean); }
  function sentences(text) { return String(text || '').split(/(?<=[.!?])\s+/).map(s => s.trim()).filter(Boolean); }
  function stopwords() {
    return new Set(['the','a','an','and','or','but','of','to','in','on','for','with','is','are','was','were','be','been','it','this','that','these','those','i','you','he','she','we','they','have','has','had','as','at','by','from','not','do','does','did','can','will','would','should','could','there','their','then','than','so','if','no','yes']);
  }

  // 301. Natural language understanding
  function understand(text) {
    const s = String(text || '').trim();
    return {
      text: s,
      sentenceCount: sentences(s).length,
      wordCount: words(s).length,
      charCount: s.length,
      normalized: s.toLowerCase().replace(/\s+/g, ' ').trim(),
      features: {
        hasQuestion: /[?]/.test(s),
        hasNumber: /\d/.test(s),
        hasUrl: /https?:\/\/|www\./i.test(s),
        hasEmail: /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i.test(s),
        hasExclamation: /[!]/.test(s),
        allCaps: /[A-Z]{3,}/.test(s.replace(/[^A-Z]/g, '')),
      },
    };
  }

  // 302. Intent classification
  function trainIntent(name, examples) {
    const ex = (examples || []).map(e => ({ tokens: tokenize(e) }));
    state.learned.intents[name] = { name, examples: ex, count: ex.length };
    persist();
    return state.learned.intents[name];
  }
  function classifyIntent(text) {
    const toks = new Set(tokenize(text));
    let best = null;
    for (const intent of Object.values(state.learned.intents)) {
      let hits = 0;
      for (const ex of intent.examples) {
        const overlap = ex.tokens.filter(t => toks.has(t)).length;
        hits += overlap / Math.max(1, ex.tokens.length);
      }
      const score = intent.examples.length ? hits / intent.examples.length : 0;
      if (!best || score > best.score) best = { name: intent.name, score, confidence: Math.min(1, score * 2) };
    }
    return best && best.score > 0 ? { name: best.name, score: best.score, confidence: Math.min(1, best.score * 2) } : { name: null, score: 0, confidence: 0 };
  }
// 303. Entity extraction
  const ENTITY_PATTERNS = {
    email: /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi,
    url: /https?:\/\/[^\s]+|www\.[^\s]+/gi,
    phone: /(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g,
    date: /\b\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4}\b|\b(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)[a-z]*\s+\d{1,2}(?:st|nd|rd|th)?(?:,?\s+\d{4})?\b/gi,
    currency: /\$\s?\d[\d,]*(?:\.\d{2})?\b/g,
    hashtag: /#\w+/g,
    mention: /@\w+/g,
    ip: /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g,
  };
  function extractEntities(text) {
    const s = String(text || '');
    const out = [];
    for (const [type, re] of Object.entries(ENTITY_PATTERNS)) {
      re.lastIndex = 0;
      let m;
      while ((m = re.exec(s)) !== null) out.push({ type, value: m[0], start: m.index, end: m.index + m[0].length });
    }
    return out.sort((a, b) => a.start - b.start);
  }

  // 304. Sentiment analysis
  const POSITIVE_WORDS = new Set(['good','great','excellent','amazing','awesome','love','loved','happy','glad','best','nice','well','like','perfect','wonderful','enjoy','cheer','yes','thanks','thank','cool','brilliant','fantastic','superb']);
  const NEGATIVE_WORDS = new Set(['bad','terrible','awful','hate','hated','sad','worst','poor','worse','dislike','angry','fail','failed','broken','wrong','issue','problem','bug','annoy','ugly','no','never','horrible','horrendous']);
  const INTENSIFIERS = new Set(['very','really','extremely','so','absolutely','totally','utterly']);
  function sentimentScore(text) {
    const toks = tokenize(text);
    let score = 0, count = 0, negate = false;
    for (const t of toks) {
      if (INTENSIFIERS.has(t)) { score += score >= 0 ? 0.5 : -0.5; continue; }
      if (t === 'not') { negate = !negate; continue; }
      let delta = 0;
      if (POSITIVE_WORDS.has(t)) delta = 1;
      else if (NEGATIVE_WORDS.has(t)) delta = -1;
      if (delta !== 0) { count++; score += negate ? -delta : delta; negate = false; }
    }
    const normalized = count ? Math.max(-1, Math.min(1, score / count)) : 0;
    return { score: normalized, label: normalized > 0.15 ? 'positive' : normalized < -0.15 ? 'negative' : 'neutral', hits: count };
  }
// 305. Topic modeling
  const TOPICS = {
    tech: ['computer','software','code','api','cloud','data','app','device','internet','program','server','database','algorithm','bug'],
    business: ['company','market','revenue','customer','product','sales','brand','invest','growth','strategy','finance','startup'],
    health: ['health','medical','doctor','patient','disease','treatment','fitness','nutrition','wellness','hospital','symptom','therapy'],
    sports: ['game','team','player','score','match','win','league','champion','tournament','coach','ball','season'],
    news: ['report','update','announce','statement','official','source','viewer','news','breaking','election'],
    education: ['learn','study','course','lesson','student','teacher','school','university','degree','research','training','exam'],
  };
  function detectTopics(text, k) {
    const toks = new Set(tokenize(text));
    return Object.entries(TOPICS).map(([topic, kws]) => {
      const keywords = kws.filter(w => toks.has(w));
      const score = keywords.length + (keywords.length / Math.max(1, kws.length));
      return { topic, score, keywords };
    }).filter(t => t.keywords.length > 0).sort((a, b) => b.score - a.score).slice(0, k || 3);
  }

  // 306. Text summarization
  function summarize(text, maxSentences) {
    const sents = sentences(text);
    if (!sents.length) return { summary: '', sentences: [], compression: 0 };
    if (sents.length === 1) return { summary: sents[0], sentences: [sents[0]], compression: 1 };
    const sw = stopwords();
    const freq = {};
    for (const t of tokenize(text)) if (!sw.has(t)) freq[t] = (freq[t] || 0) + 1;
    const maxF = Math.max(...Object.values(freq));
    const scored = sents.map((sn, idx) => {
      const toks = tokenize(sn).filter(t => !sw.has(t));
      const h = toks.length
        ? toks.reduce((a, t) => a + (freq[t] || 0), 0) / toks.length / maxF
        : 0;
      return { index: idx, text: sn, score: h };
    });
    const n = Math.min(maxSentences || 2, sents.length);
    const picked = scored.sort((a, b) => b.score - a.score).slice(0, n).sort((a, b) => a.index - b.index);
    const summary = picked.map(p => p.text).join(' ');
    return { summary, sentences: picked.map(p => p.text), compression: summary.length / text.length };
  }

  // 308. Language detection
  const LANGUAGE_PROFILES = {
    en: { script: 'latin', own: /^(the|and|is|are|you|this|that|with|from|have|has|not|well|what)$/i },
    es: { script: 'latin', own: /^(el|la|los|las|que|de|y|en|por|para|una|un|está|son)$/i },
    fr: { script: 'latin', own: /^(le|la|les|des|que|et|est|pour|une|dans|je|vous|avec)$/i },
    de: { script: 'latin', own: /^(der|die|das|und|ist|nicht|mit|ein|eine|für|auch|bei)$/i },
    it: { script: 'latin', own: /^(il|lo|la|gli|che|di|e|per|un|una|non|sono|come)$/i },
    pt: { script: 'latin', own: /^(o|os|as|de|que|e|para|por|uma|está|não|com)$/i },
    ru: { script: 'cyrillic', own: /^(и|не|на|что|в|с|это|как|по|от|для|мы)$/i },
    hi: { script: 'devanagari', own: /^(और|है|में|का|हैं|से|यह|नहीं|की|पर)$/i },
    zh: { script: 'han', own: /^(的|是|在|和|有|不|我|这|他|们|一|就)$/i },
    ja: { script: 'kana', own: /^(の|は|に|を|た|て|で|と|が|も|する|です)$/i },
    ar: { script: 'arabic', own: /^(في|و|من|على|لا|ما|أن|هذا|مع|هل|كل)$/i },
    ko: { script: 'hangul', own: /^(의|에|는|이|가|을|를|다|고|과)$/i },
  };
  const SCRIPT_TESTS = [
    ['cyrillic', /[\u0400-\u04FF]/], ['devanagari', /[\u0900-\u097F]/], ['han', /[\u4E00-\u9FFF]/],
    ['arabic', /[\u0600-\u06FF]/], ['kana', /[\u3040-\u30FF]/], ['hangul', /[\uAC00-\uD7AF]/],
    ['hebrew', /[\u0590-\u05FF]/], ['greek', /[\u0370-\u03FF]/],
  ];
  function detectLanguage(text, candidates) {
    const s = String(text || '');
    const toks = words(s);
    let script = 'latin';
    for (const [name, re] of SCRIPT_TESTS) if (re.test(s)) { script = name; break; }
    if (!toks.length) return { lang: null, script, confidence: 0 };
    const pool = candidates && candidates.length
      ? candidates.filter(l => LANGUAGE_PROFILES[l] && LANGUAGE_PROFILES[l].script === script)
      : Object.keys(LANGUAGE_PROFILES).filter(l => LANGUAGE_PROFILES[l].script === script);
    let best = null;
    for (const lang of pool) {
      const prof = LANGUAGE_PROFILES[lang];
      let hits = 0;
      for (const t of toks) if (prof.own.test(t)) hits++;
      const score = hits / Math.max(1, toks.length);
      if (!best || score > best.score) best = { lang, score, confidence: Math.min(1, score * 3 + 0.1) };
    }
    return { lang: best ? best.lang : null, script, confidence: best ? best.confidence : 0 };
  }

  // 309. Named entity recognition
  const ORG_SUFFIX = /^(Inc|Corp|Ltd|LLC|University|Institute|Association|Group|School|Academy|Agency|Foundation|Bank|Company)$/i;
  function extractNamedEntities(text) {
    const s = String(text || '');
    const out = [];
    const reDate = /\b(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)[a-z]*\s+\d{1,2}(?:st|nd|rd|th)?(?:,?\s+\d{4})?\b/gi;
    let m;
    while ((m = reDate.exec(s))) out.push({ type: 'DATE', value: m[0] });
    const reMoney = /\$\s?\d[\d,]*(?:\.\d{2})?(?:k|m|b|K|M|B)?\b/g;
    while ((m = reMoney.exec(s))) out.push({ type: 'MONEY', value: m[0] });
    const rePercent = /\b\d+(?:\.\d+)?\s?%/g;
    while ((m = rePercent.exec(s))) out.push({ type: 'PERCENT', value: m[0] });
    const toks = s.split(/\s+/);
    for (let i = 0; i < toks.length - 1; i++) {
      const a = toks[i], b = toks[i + 1].replace(/[^A-Za-z'-]/g, '');
      if (/^[A-Z][a-z]+$/.test(a) && /^[A-Z][a-z]+$/.test(b) && !/^(The|I|A|An)$/.test(a)) {
        out.push({ type: 'PERSON', value: a + ' ' + b });
      }
      if (i > 0 && /^[A-Z]/.test(a) && ORG_SUFFIX.test(b)) out.push({ type: 'ORGANIZATION', value: a + ' ' + b });
    }
    return out;
  }
// 310. Part-of-speech tagging
  const DETERMINERS = new Set(['the','a','an','this','that','these','those','my','your','his','her','its','our','their']);
  const PREPOSITIONS = new Set(['in','on','at','by','for','with','from','to','of','under','over','between','through','during','after','before','about','into','upon','within','across']);
  const CONJUNCTIONS = new Set(['and','or','but','nor','so','yet','while','because','although','if','unless','since']);
  const PRONOUNS = new Set(['i','you','he','she','it','we','they','me','him','her','us','them','who','what','which','whom','my','your','his','its','our','their']);
  const AUXILIARIES = new Set(['is','am','are','was','were','be','been','being','have','has','had','do','does','did','will','would','should','could','can','may','might','must']);
  function tagPartsOfSpeech(text) {
    return words(text).map(t => {
      const lower = t.toLowerCase();
      if (DETERMINERS.has(lower)) return { word: t, pos: 'DT' };
      if (PREPOSITIONS.has(lower)) return { word: t, pos: 'IN' };
      if (CONJUNCTIONS.has(lower)) return { word: t, pos: 'CC' };
      if (AUXILIARIES.has(lower)) return { word: t, pos: 'AUX' };
      if (PRONOUNS.has(lower)) return { word: t, pos: 'PRON' };
      if (/^[A-Z]/.test(t)) return { word: t, pos: 'NNP' };
      if (/ing$/.test(lower)) return { word: t, pos: 'VBG' };
      if (/(ed|en)$/.test(lower)) return { word: t, pos: 'VBN' };
      if (/^(ran|went|came|saw|built|said|told|made|took|gave|got|was|were|had|did)$/.test(lower)) return { word: t, pos: 'VBD' };
      if (/ly$/.test(lower)) return { word: t, pos: 'RB' };
      if (/^\d+([.,]\d+)?$/.test(lower)) return { word: t, pos: 'CD' };
      if (/(s|es)$/.test(lower)) return { word: t, pos: 'NNS' };
      return { word: t, pos: 'NN' };
    });
  }

  // 311. Dependency parsing (heuristic)
  function parseDependencies(text) {
    const tagged = tagPartsOfSpeech(text);
    const deps = [];
    tagged.forEach((t, i) => {
      if (t.pos === 'DT') deps.push({ head: Math.min(i + 1, tagged.length - 1), dep: t.word, rel: 'det' });
      else if (t.pos === 'IN') deps.push({ head: Math.min(i + 1, tagged.length - 1), dep: t.word, rel: 'prep' });
      else if (t.pos === 'NNP') deps.push({ head: Math.min(i + 1, tagged.length - 1), dep: t.word, rel: 'nsubj' });
      else if (t.pos === 'VBG' || t.pos === 'VBN') deps.push({ head: Math.max(0, i - 1), dep: t.word, rel: 'amod' });
      else if (t.pos === 'NN' || t.pos === 'NNS') deps.push({ head: Math.max(0, i - 1), dep: t.word, rel: 'pobj' });
      else if (t.pos === 'RB') deps.push({ head: Math.min(i + 1, tagged.length - 1), dep: t.word, rel: 'advmod' });
    });
    return { tokens: tagged, dependencies: deps };
  }

  // 312. Coreference resolution
  const FEMALE_NAMES = /^(mary|susan|jane|sarah|emma|olivia|ava|isabella|lisa|anna|maria|carla|lucy|amy|julia|grace|sophia)$/i;
  function isNameToken(t, prev) {
    return /^[A-Z][a-z]+$/.test(t) && !/^(The|A|An|This|He|She|It|They|We|You|I|My|Your|His|Her|Our|Their)$/i.test(t) && !/^[A-Z][a-z]+$/.test(prev || '');
  }
  function resolveCoreferences(text) {
    const toks = words(text);
    const males = [], females = [], neutrals = [];
    const resolutions = [];
    toks.forEach((t, i) => {
      const lower = t.toLowerCase();
      const prev = toks[i - 1] || '';
      if (i + 1 < toks.length && /^[A-Z][a-z]+$/.test(t) && /^[A-Z][a-z]+$/.test(toks[i + 1]) && isNameToken(t, prev)) {
        const name = t + ' ' + toks[i + 1];
        (FEMALE_NAMES.test(t) ? females : males).push(name);
      } else if (isNameToken(t, prev)) {
        (FEMALE_NAMES.test(t) ? females : males).push(t);
      }
      if (['he','him','his','himself'].includes(lower) && males.length) {
        resolutions.push({ pronoun: t, index: i, antecedent: males[males.length - 1] });
      } else if (['she','her','hers','herself'].includes(lower) && females.length) {
        resolutions.push({ pronoun: t, index: i, antecedent: females[females.length - 1] });
      } else if (['they','them','their','theirs','themselves'].includes(lower)) {
        const all = males.concat(females).concat(neutrals);
        if (all.length >= 2) resolutions.push({ pronoun: t, index: i, antecedent: all[all.length - 2] + ' and ' + all[all.length - 1] });
        else if (all.length === 1) resolutions.push({ pronoun: t, index: i, antecedent: all[0] });
      }
    });
    return { resolutions, candidates: { males, females } };
  }

  // 313. Question answering (extractive)
  function answerQuestion(context, question) {
    const sents = sentences(context);
    const q = new Set(tokenize(question).filter(t => !stopwords().has(t)));
    const scored = sents.map((sn, i) => {
      const st = new Set(tokenize(sn));
      let hits = 0;
      for (const t of q) if (st.has(t)) hits++;
      return { index: i, text: sn, hits, score: hits / Math.max(1, q.size) };
    }).sort((a, b) => b.score - a.score);
    const top = scored[0];
    if (!top || top.hits === 0) return { answer: null, confidence: 0, source: null, index: -1 };
    return { answer: top.text, confidence: Math.min(1, top.score), source: top.text, index: top.index };
  }
// 314. Dialogue management
  function createSession(id) {
    const s = { id, slots: {}, intents: [], turn: 0, open: true, lastUtterance: '', responses: [], _queue: null };
    state.dialogue.sessions[id] = s;
    persist();
    return s;
  }
  function getSession(id) { return state.dialogue.sessions[id]; }
  function processTurn(sessionId, utterance, handler) {
    const s = getSession(sessionId);
    if (!s || !s.open) return null;
    s.turn++;
    s.lastUtterance = utterance;
    const intent = classifyIntent(utterance);
    const entities = extractEntities(utterance);
    s.intents.push(intent.name);
    s._queue = null;
    if (handler) handler(s, { intent, entities, utterance });
    const response = s._queue || '[intent:' + (intent.name || 'unknown') + '] acknowledged';
    s.responses.push(response);
    persist();
    return { turn: s.turn, intent, entities, response };
  }
  function fillSlot(sessionId, key, value) {
    const s = getSession(sessionId);
    if (!s) return null;
    s.slots[key] = value;
    persist();
    return s.slots;
  }
  function closeSession(id) {
    const s = getSession(id);
    if (!s) return null;
    s.open = false;
    persist();
    return s;
  }

  // 315. Context tracking
  function trackContext(id, turn) {
    state.context[id] = state.context[id] || { turns: [], window: [], entities: {} };
    const c = state.context[id];
    c.turns.push(turn);
    if (c.turns.length > 50) c.turns.shift();
    c.window = c.turns.slice(-5);
    for (const e of extractEntities(turn)) c.entities[e.value] = e.type;
    persist();
    return c;
  }
  function getContext(id) { return state.context[id] || { turns: [], window: [], entities: {} }; }
  function clearContext(id) {
    delete state.context[id];
    persist();
    return true;
  }

  // 316. Memory networks
  function writeMemory(key, value, meta) {
    const entry = { key: String(key), value, meta: meta || {}, createdAt: Date.now(), accesses: 0 };
    state.memory.entries[entry.key] = entry;
    state.memory.salience[entry.key] = 1;
    persist();
    return entry;
  }
  function readMemory(key) {
    const e = state.memory.entries[key];
    if (!e) return null;
    e.accesses++;
    state.memory.salience[key] = (state.memory.salience[key] || 0) + 1;
    persist();
    return e;
  }
  function recallMemory(query) {
    const toks = new Set(tokenize(query));
    return Object.values(state.memory.entries).map(e => {
      let hits = 0;
      for (const t of toks) {
        const hay = typeof e.value === 'string' ? e.value.toLowerCase() : JSON.stringify(e.value).toLowerCase();
        if (hay.includes(t)) hits++;
      }
      return { key: e.key, value: e.value, score: hits + (state.memory.salience[e.key] || 0) * 0.25 };
    }).filter(r => r.score > 0).sort((a, b) => b.score - a.score);
  }
  function forgetMemory(key) {
    delete state.memory.entries[key];
    delete state.memory.salience[key];
    persist();
    return key;
  }

  // 317. Knowledge graphs
  function addTriple(subject, predicate, object) {
    const t = { subject: String(subject), predicate: String(predicate), object: String(object) };
    state.knowledge.triples.push(t);
    for (const k of ['subject', 'predicate', 'object']) {
      state.knowledge.indexes[k] = state.knowledge.indexes[k] || {};
      const map = state.knowledge.indexes[k];
      const key = t[k];
      (map[key] = map[key] || []).push(t);
    }
    persist();
    return t;
  }
  function queryTriples(q) {
    let out = state.knowledge.triples;
    for (const k of ['subject', 'predicate', 'object']) if (q[k] !== undefined) out = out.filter(t => t[k] === q[k]);
    return out;
  }
  function findPaths(subject, object, maxDepth) {
    const adj = {};
    for (const t of state.knowledge.triples) (adj[t.subject] = adj[t.subject] || []).push({ to: t.object, via: t.predicate });
    const queue = [{ node: subject, path: [] }];
    const visited = new Set([subject]);
    const depth = maxDepth || 3;
    while (queue.length) {
      const cur = queue.shift();
      if (cur.path.length >= depth) continue;
      for (const e of adj[cur.node] || []) {
        const nextPath = cur.path.concat({ via: e.via, to: e.to });
        if (e.to === object) return nextPath;
        if (!visited.has(e.to)) { visited.add(e.to); queue.push({ node: e.to, path: nextPath }); }
      }
    }
    return [];
  }
// 318. Reasoning engines (forward chaining)
  function addRule(name, antecedent, consequent) {
    state.rules[name] = { antecedent: antecedent || [], consequent };
    persist();
    return state.rules[name];
  }
  function addFact(fact) {
    if (!state.facts.includes(fact)) state.facts.push(fact);
    persist();
    return fact;
  }
  function infer(maxIterations) {
    const derived = [];
    for (let iter = 0; iter < (maxIterations || 10); iter++) {
      let added = false;
      for (const rule of Object.values(state.rules)) {
        const satisfied = rule.antecedent.every(a => state.facts.includes(a));
        if (satisfied && !state.facts.includes(rule.consequent)) {
          state.facts.push(rule.consequent);
          derived.push(rule.consequent);
          added = true;
        }
      }
      if (!added) break;
    }
    persist();
    return derived;
  }
  function queryFacts(predicate) { return state.facts.filter(f => f.startsWith(predicate)); }

  // 320. Decision support
  function evaluateOptions(options, criteria) {
    const totalWeight = criteria.reduce((a, c) => a + (c.weight || 1), 0);
    return options.map(opt => {
      let weighted = 0;
      for (const c of criteria) weighted += ((opt.scores || {})[c.name] || 0) * (c.weight || 1);
      return { name: opt.name, score: weighted, normalized: totalWeight ? Math.round(weighted / totalWeight * 100) / 10 : 0 };
    }).sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
  }
  function decisionTree(node, input) {
    let cur = node;
    let guard = 0;
    while (cur && typeof cur.test === 'function' && guard < 64) {
      cur = cur.test(input) ? cur.yes : cur.no;
      guard++;
    }
    return cur ? cur.decision : null;
  }

  const AI = {
    // 301-306
    understand, trainIntent, classifyIntent, extractEntities, sentimentScore, detectTopics, summarize,
    // 308-313
    detectLanguage, extractNamedEntities, tagPartsOfSpeech, parseDependencies, resolveCoreferences, answerQuestion,
    // 314-317
    createSession, getSession, processTurn, fillSlot, closeSession,
    trackContext, getContext, clearContext,
    writeMemory, readMemory, recallMemory, forgetMemory,
    addTriple, queryTriples, findPaths,
    // 318, 320
    addRule, addFact, infer, queryFacts, evaluateOptions, decisionTree,
  };

  const NEXUS = {
    AI,
    version: '2.2.0',
    metadata: { name: MODULE_NAME, version: '2.2.0', dependencies: [] },
    init() { load(); persist(); return this; },
    get state() { return state; },
  };

  if (typeof window !== 'undefined') {
    window.__NEXUS_AI_ML__ = NEXUS;
    if (window.__NEXUS_HUB__ && typeof window.__NEXUS_HUB__.register === 'function') {
      window.__NEXUS_HUB__.register('ai-ml', NEXUS);
    }
  }
  if (typeof module !== 'undefined') module.exports = NEXUS;
  return NEXUS;
})();