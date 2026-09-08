// ==UserScript==
// @name         Nexus Extensibility
// @namespace     nexus-suite
// @version       2026.09.27.1
// @description  Plugin marketplace, extension registry, themes, snippets, templates, workflows, integration directory, community modules, third-party extensions, partners, API versioning, deprecation, notices, migration, upgrade plans, compatibility layers, polyfills, adapter/facade/strategy (ROADMAP 281-300)
// @match         *://*/*
// @grant         GM_getValue
// @grant         GM_setValue
// ==/UserScript==

(() => {
  'use strict';
  const MODULE_NAME = 'extensibility';
  const STORE_KEY = 'nexus_extensibility';
  const state = {
    marketplace: { plugins: {}, categories: {}, reviews: {} },
    registry: { extensions: {}, themes: {}, templates: {} },
    sharing: { snippets: {}, workflows: {} },
    directory: { integrations: {}, partners: {} },
    lifecycle: { versions: {}, notices: {}, migrations: {} },
    policies: { deprecations: {}, polyfills: {} },
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

  // ---- 281-290: Marketplaces & directories ----
  // 281. Plugin marketplace
  function publishPlugin(plugin) {
    const p = { id: uid(), name: plugin.name, version: plugin.version || '1.0.0', author: plugin.author || 'unknown', description: plugin.description || '', tags: plugin.tags || [], downloads: 0, rating: 0, ratingCount: 0, compatibility: plugin.compatibility || [], installs: plugin.installs !== false };
    state.marketplace.plugins[p.id] = p;
    persist();
    return p;
  }
  function getPlugin(id) { return state.marketplace.plugins[id]; }
  function listPlugins(filter) {
    let all = Object.values(state.marketplace.plugins);
    if (filter) {
      if (filter.tag) all = all.filter(p => p.tags.includes(filter.tag));
      if (filter.author) all = all.filter(p => p.author === filter.author);
      if (filter.query) { const q = filter.query.toLowerCase(); all = all.filter(p => p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q)); }
    }
    return all.sort((a, b) => b.downloads - a.downloads);
  }
  function ratePlugin(id, rating) {
    const p = getPlugin(id);
    if (!p) return null;
    const r = Math.max(1, Math.min(5, rating));
    p.rating = ((p.rating * p.ratingCount) + r) / (p.ratingCount + 1);
    p.ratingCount++;
    persist();
    return p;
  }
  // 282. Extension registry
  function registerExtension(ext) {
    const e = { id: uid(), name: ext.name, version: ext.version || '1.0.0', type: ext.type || 'extension', entry: ext.entry || '', deps: ext.deps || [], enabled: ext.enabled !== false, thirdParty: ext.thirdParty === true, registeredAt: Date.now() };
    state.registry.extensions[e.id] = e;
    persist();
    return e;
  }
  function getExtension(id) { return state.registry.extensions[id]; }
  function listExtensions() { return Object.values(state.registry.extensions); }
  function enableExtension(id, on) {
    const e = getExtension(id);
    if (!e) return null;
    e.enabled = on !== false;
    persist();
    return e;
  }
  // 283. Theme gallery
  function addTheme(theme) {
    const t = { id: uid(), name: theme.name, version: theme.version || '1.0.0', author: theme.author || 'unknown', css: theme.css || '', variables: theme.variables || {}, dark: theme.dark || false, active: false, downloads: 0 };
    state.registry.themes[t.id] = t;
    persist();
    return t;
  }
  function getTheme(id) { return state.registry.themes[id]; }
  function listThemes() { return Object.values(state.registry.themes); }
  function activateTheme(id) {
    const t = getTheme(id);
    if (!t) return null;
    for (const other of Object.values(state.registry.themes)) other.active = false;
    t.active = true;
    persist();
    return t;
  }
// 284. Snippet sharing
  function shareSnippet(snippet) {
    const s = { id: uid(), title: snippet.title, language: snippet.language || 'javascript', code: snippet.code, description: snippet.description || '', tags: snippet.tags || [], author: snippet.author || 'unknown', forks: 0, stars: 0, createdAt: Date.now() };
    state.sharing.snippets[s.id] = s;
    persist();
    return s;
  }
  function getSnippet(id) { return state.sharing.snippets[id]; }
  function listSnippets(filter) {
    let all = Object.values(state.sharing.snippets);
    if (filter) {
      if (filter.language) all = all.filter(s => s.language === filter.language);
      if (filter.tag) all = all.filter(s => s.tags.includes(filter.tag));
    }
    return all.sort((a, b) => b.stars - a.stars);
  }
  function forkSnippet(id) {
    const s = getSnippet(id);
    if (!s) return null;
    s.forks++;
    const copy = { id: uid(), title: s.title + ' (fork)', language: s.language, code: s.code, description: s.description, tags: [...s.tags], author: s.author, forks: 0, stars: 0, createdAt: Date.now() };
    state.sharing.snippets[copy.id] = copy;
    persist();
    return copy;
  }
  // 285. Template library
  function addTemplate(tmpl) {
    const t = { id: uid(), name: tmpl.name, version: tmpl.version || '1.0.0', type: tmpl.type || 'generic', content: tmpl.content || '', variables: tmpl.variables || [], tags: tmpl.tags || [], uses: 0 };
    state.registry.templates[t.id] = t;
    persist();
    return t;
  }
  function getTemplate(id) { return state.registry.templates[id]; }
  function listTemplates(type) {
    let all = Object.values(state.registry.templates);
    if (type) all = all.filter(t => t.type === type);
    return all.sort((a, b) => b.uses - a.uses);
  }
  function instantiateTemplate(id, values) {
    const t = getTemplate(id);
    if (!t) return null;
    t.uses++;
    let out = t.content;
    for (const key of Object.keys(values || {})) out = out.replace(new RegExp('\\{\\{' + key + '\\}\\}', 'g'), String(values[key]));
    persist();
    return { template: t.id, content: out };
  }
  // 286. Workflow marketplace
  function publishWorkflow(wf) {
    const w = { id: uid(), name: wf.name, version: wf.version || '1.0.0', author: wf.author || 'unknown', steps: wf.steps || [], trigger: wf.trigger || 'manual', tags: wf.tags || [], installs: 0, rating: 0, ratingCount: 0 };
    state.sharing.workflows[w.id] = w;
    persist();
    return w;
  }
  function getWorkflow(id) { return state.sharing.workflows[id]; }
  function listWorkflows() { return Object.values(state.sharing.workflows); }
  function installWorkflow(id) {
    const w = getWorkflow(id);
    if (!w) return null;
    w.installs++;
    persist();
    return w;
  }
  // 287. Integration directory
  function registerDirectoryEntry(entry) {
    const e = { id: uid(), name: entry.name, type: entry.type || 'integration', url: entry.url || '', endpoints: entry.endpoints || [], auth: entry.auth || 'none', verified: entry.verified || false, addedAt: Date.now() };
    state.directory.integrations[e.id] = e;
    persist();
    return e;
  }
  function listDirectory(type) {
    let all = Object.values(state.directory.integrations);
    if (type) all = all.filter(e => e.type === type);
    return all;
  }
  // 288. Community modules
  function submitCommunityModule(mod) {
    const m = { id: uid(), name: mod.name, version: mod.version || '1.0.0', author: mod.author || 'community', code: mod.code || '', status: 'pending', votes: 0, installed: false, submittedAt: Date.now() };
    state.registry.extensions[m.id] = Object.assign({ type: 'community' }, m);
    persist();
    return m;
  }
  function approveCommunityModule(id) {
    const m = state.registry.extensions[id];
    if (!m) return null;
    m.status = 'approved';
    persist();
    return m;
  }
  function voteCommunityModule(id) {
    const m = state.registry.extensions[id];
    if (!m) return null;
    m.votes++;
    persist();
    return m;
  }
  // 289. Third-party extensions
  function installThirdParty(ext) {
    return registerExtension(Object.assign({}, ext, { type: 'third-party', thirdParty: true }));
  }
  function listThirdParty() { return Object.values(state.registry.extensions).filter(e => e.thirdParty); }
  // 290. Partner integrations
  function addPartner(partner) {
    const p = { id: uid(), name: partner.name, level: partner.level || 'standard', contact: partner.contact || '', apis: partner.apis || [], status: partner.status || 'active', since: Date.now() };
    state.directory.partners[p.id] = p;
    persist();
    return p;
  }
  function listPartners(level) {
    let all = Object.values(state.directory.partners);
    if (level) all = all.filter(p => p.level === level);
    return all;
  }
// ---- 291-300: Lifecycle, compatibility & design patterns ----
  // 291. API versioning
  function registerApiVersion(spec) {
    const v = { id: uid(), name: spec.name, version: spec.version, status: spec.status || 'active', endpoint: spec.endpoint || '', deprecated: spec.deprecated || false, changelog: spec.changelog || [], addedAt: Date.now() };
    if (!state.lifecycle.versions[v.name]) state.lifecycle.versions[v.name] = [];
    state.lifecycle.versions[v.name].push(v);
    persist();
    return v;
  }
  function getApiVersions(name) { return state.lifecycle.versions[name] || []; }
  function getLatestVersion(name) {
    const vs = getApiVersions(name);
    return vs.length ? vs[vs.length - 1] : null;
  }
  // 292. Deprecation policy
  function deprecateApi(name, version, opts) {
    const vs = getApiVersions(name);
    const v = vs.find(x => x.version === version);
    if (!v) return null;
    v.deprecated = true;
    v.deprecationNotice = opts?.reason || 'Deprecated';
    v.deprecatedAt = Date.now();
    v.removalAt = opts?.removalAt || null;
    v.replacement = opts?.replacement || null;
    if (opts?.notice) addNotice({ type: 'deprecation', name, version, message: opts.notice });
    persist();
    return v;
  }
  function getDeprecatedApis() {
    const out = [];
    for (const vs of Object.values(state.lifecycle.versions)) for (const v of vs) if (v.deprecated) out.push(v);
    return out;
  }
  // 293. Breaking change notices
  function addNotice(notice) {
    const n = { id: uid(), type: notice.type || 'info', name: notice.name, version: notice.version || '', message: notice.message, publishedAt: Date.now(), acknowledged: false };
    state.lifecycle.notices[n.id] = n;
    persist();
    return n;
  }
  function listNotices(filter) {
    let all = Object.values(state.lifecycle.notices);
    if (filter?.type) all = all.filter(n => n.type === filter.type);
    if (filter?.unacknowledged) all = all.filter(n => !n.acknowledged);
    return all.sort((a, b) => b.publishedAt - a.publishedAt);
  }
  function acknowledgeNotice(id) {
    const n = state.lifecycle.notices[id];
    if (!n) return null;
    n.acknowledged = true;
    persist();
    return n;
  }
  // 294. Migration guides
  function addMigrationGuide(guide) {
    const g = { id: uid(), from: guide.from, to: guide.to, steps: guide.steps || [], breaking: guide.breaking || [], automated: guide.automated !== false, applied: false, createdAt: Date.now() };
    state.lifecycle.migrations[g.id] = g;
    persist();
    return g;
  }
  function getMigrationGuides(from, to) {
    return Object.values(state.lifecycle.migrations).filter(g => (!from || g.from === from) && (!to || g.to === to));
  }
  function applyMigration(id) {
    const g = state.lifecycle.migrations[id];
    if (!g) return null;
    if (!g.automated) return { guided: true, applied: false };
    g.applied = true;
    g.appliedAt = Date.now();
    persist();
    return g;
  }
  // 295. Upgrade assistants
  function buildUpgradePlan(current, target, guides) {
    const plan = { from: current, to: target, steps: [], guides: [] };
    for (const g of (guides || getMigrationGuides())) plan.guides.push(g);
    plan.steps = plan.guides.flatMap(g => g.steps.map(step => ({ guide: g.id, step, applies: true })));
    return plan;
  }
  // 296. Compatibility layers
  function registerCompatLayer(layer) {
    const l = { id: uid(), name: layer.name, from: layer.from, to: layer.to, shims: layer.shims || {}, active: layer.active !== false, createdAt: Date.now() };
    state.policies.compat = state.policies.compat || {};
    state.policies.compat[l.id] = l;
    persist();
    return l;
  }
  function getCompatLayer(name) { return Object.values(state.policies.compat || {}).find(l => l.name === name); }
  function resolveCompat(layerId, api, args) {
    const l = state.policies.compat?.[layerId];
    if (!l || !l.active) return null;
    const shim = l.shims[api];
    if (!shim) return null;
    return typeof shim === 'function' ? shim(args) : shim;
  }
// 297. Polyfill management
  function registerPolyfill(poly) {
    const p = { id: uid(), name: poly.name, feature: poly.feature, check: poly.check || '', implementation: poly.implementation || '', priority: poly.priority || 100, active: poly.active !== false, addedAt: Date.now() };
    state.policies.polyfills[p.id] = p;
    persist();
    return p;
  }
  function getPolyfills(feature) {
    let all = Object.values(state.policies.polyfills);
    if (feature) all = all.filter(p => p.feature === feature);
    return all.sort((a, b) => a.priority - b.priority);
  }
  function needsPolyfill(feature) {
    return getPolyfills(feature).length > 0;
  }
  // 298. Adapter pattern
  function createAdapter(opts) {
    return {
      id: uid(), name: opts.name || 'adapter', source: opts.source || 'unknown', target: opts.target || 'unknown',
      adapt(input) { return opts.transform ? opts.transform(input) : input; },
      convert(data) { return opts.convert ? opts.convert(data) : data; },
    };
  }
  // 299. Facade pattern
  function createFacade(opts) {
    const facade = { id: uid(), name: opts.name || 'facade', components: {}, expose: {} };
    for (const [key, component] of Object.entries(opts.components || {})) facade.components[key] = component;
    for (const [key, method] of Object.entries(opts.expose || {})) facade.expose[key] = (typeof method === 'function') ? method.bind(facade) : method;
    return facade;
  }
  // 300. Strategy pattern
  function createStrategy(opts) {
    const strat = {
      id: uid(), name: opts.name || 'strategy', strategies: opts.strategies || {}, selected: opts.selected || null,
      add(name, fn) { strat.strategies[name] = fn; return strat; },
      select(name) { if (strat.strategies[name]) strat.selected = name; return strat; },
      execute(...args) { if (!strat.selected || !strat.strategies[strat.selected]) return null; return strat.strategies[strat.selected](...args); },
    };
    return strat;
  }

  const Extensibility = {
    // 281-290
    publishPlugin, getPlugin, listPlugins, ratePlugin,
    registerExtension, getExtension, listExtensions, enableExtension,
    addTheme, getTheme, listThemes, activateTheme,
    shareSnippet, getSnippet, listSnippets, forkSnippet,
    addTemplate, getTemplate, listTemplates, instantiateTemplate,
    publishWorkflow, getWorkflow, listWorkflows, installWorkflow,
    registerDirectoryEntry, listDirectory,
    submitCommunityModule, approveCommunityModule, voteCommunityModule,
    installThirdParty, listThirdParty,
    addPartner, listPartners,
    // 291-300
    registerApiVersion, getApiVersions, getLatestVersion,
    deprecateApi, getDeprecatedApis,
    addNotice, listNotices, acknowledgeNotice,
    addMigrationGuide, getMigrationGuides, applyMigration, buildUpgradePlan,
    registerCompatLayer, getCompatLayer, resolveCompat,
    registerPolyfill, getPolyfills, needsPolyfill,
    createAdapter, createFacade, createStrategy,
  };

  const NEXUS = {
    Extensibility,
    version: '2.0.0',
    metadata: { name: MODULE_NAME, version: '2.0.0', dependencies: [] },
    init() { load(); persist(); return this; },
    get state() { return state; },
  };

  if (typeof window !== 'undefined') {
    window.__NEXUS_EXTENSIBILITY__ = NEXUS;
    if (window.__NEXUS_HUB__ && typeof window.__NEXUS_HUB__.register === 'function') {
      window.__NEXUS_HUB__.register('extensibility', NEXUS);
    }
  }
  if (typeof module !== 'undefined') module.exports = NEXUS;
  return NEXUS;
})();