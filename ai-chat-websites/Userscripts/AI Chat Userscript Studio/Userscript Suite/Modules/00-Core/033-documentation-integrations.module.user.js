// ==UserScript==
// @name         Nexus Documentation & Integrations
// @namespace     nexus-suite
// @version       2026.09.27.1
// @description  Interactive API explorer, docs, tutorials, and 20 platform integrations (ROADMAP 221-260)
// @match         *://*/*
// @grant         GM_getValue
// @grant         GM_setValue
// @grant         GM_xmlhttpRequest
// ==/UserScript==

(() => {
  'use strict';
  const MODULE_NAME = 'documentation-integrations';
  const STORE_KEY = 'nexus_doc_integrations';
  const state = { integrations: {}, webhooks: {}, docs: {} };
  const PERSISTED_KEYS = ['integrations', 'webhooks', 'docs'];
  function load() {
    try {
      const raw = GM_getValue(STORE_KEY, '{}');
      const parsed = JSON.parse(raw);
      for (const key of PERSISTED_KEYS) { if (parsed[key] !== undefined) state[key] = parsed[key]; }
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
  function safeFetch(url, opts) {
    if (typeof GM_xmlhttpRequest !== 'undefined') {
      return new Promise((resolve, reject) => {
        GM_xmlhttpRequest({ ...(opts || {}), url,
          onload: r => resolve({ ok: r.status >= 200 && r.status < 300, status: r.status, json: JSON.parse(r.responseText), text: r.responseText }),
          onerror: reject
        });
      });
    }
    return fetch(url, opts);
  }
  load();

  // ---- 221-240: Documentation ----
  // 221. Interactive API explorer
  function buildApiExplorer(spec) {
    const endpoints = (spec.endpoints || []).map(ep => ({
      id: uid(), method: ep.method || 'GET', path: ep.path || '/', summary: ep.summary || '',
      params: ep.params || [], requestBody: ep.requestBody || null, responses: ep.responses || {},
      tryIt: function(body) { return { status: 200, body: body || { message: 'OK' }, headers: { 'content-type': 'application/json' } }; }
    }));
    return { id: uid(), title: spec.title || 'API', baseUrl: spec.baseUrl || '', endpoints };
  }
  // 222. Live code examples
  function buildCodeExample(opts) {
    return { id: uid(), language: opts.language || 'javascript', code: opts.code || '',
      runnable: opts.runnable !== false, output: null,
      run: function() {
        if (!this.runnable) return 'Not runnable';
        try { const r = new Function('return (' + this.code + ')')(); this.output = String(r); return r; }
        catch (e) { this.output = e.message; return null; }
      }
    };
  }
  // 223. Embeddable tutorials
  function buildTutorial(opts) {
    const enc = encodeURIComponent(opts.title || 'Tutorial');
    return { id: uid(), title: opts.title || 'Tutorial',
      steps: (opts.steps || []).map((s, i) => ({ index: i, title: s.title || '', content: s.content || '', code: s.code || '', completed: false })),
      currentStep: 0,
      embedCode: '<iframe src="data:text/html,' + enc + '"></iframe>'
    };
  }
  // 224. Video documentation
  function buildVideoDoc(opts) {
    return { id: uid(), title: opts.title || 'Video', url: opts.url || '',
      duration: opts.duration || 0, chapters: opts.chapters || [], captions: opts.captions || [],
      transcript: opts.transcript || '', playbackRate: 1
    };
  }
  // 225. Screencast library
  function buildScreencastLibrary() {
    return { id: uid(), screencasts: [], add: function(s) { this.screencasts.push({ id: uid(), ...s }); return this; } };
  }
  // 226. GIF demonstrations
  function buildGifDemo(opts) {
    return { id: uid(), title: opts.title || '', url: opts.url || '', width: opts.width || 0, height: opts.height || 0, alt: opts.alt || '' };
  }
  // 227. Animated diagrams
  function buildAnimatedDiagram(opts) {
    return { id: uid(), title: opts.title || '', frames: opts.frames || [], fps: opts.fps || 10, currentFrame: 0, playing: false };
  }
  // 228. Interactive flowcharts
  function buildFlowchart(opts) {
    return { id: uid(), title: opts.title || 'Flowchart', nodes: opts.nodes || [], edges: opts.edges || [], selectedNode: null };
  }
  // 229. Decision trees
  function buildDecisionTree(opts) {
    return { id: uid(), title: opts.title || 'Decision Tree', root: opts.root || { question: '', yes: null, no: null },
      traverse: function(answers) {
        let n = this.root;
        while (n && n.question) { n = answers[n.question] ? n.yes : n.no; }
        return n;
      }
    };
  }
  // 230. Troubleshooting guides
  function buildTroubleshootingGuide(opts) {
    return { id: uid(), title: opts.title || '',
      problems: (opts.problems || []).map(p => ({ problem: p.problem || '', symptoms: p.symptoms || [], causes: p.causes || [], solutions: p.solutions || [] }))
    };
  }
  // 231. FAQ automation
  function buildFaqBot(opts) {
    return { id: uid(),
      faqs: (opts.faqs || []).map(f => ({ q: f.q || '', a: f.a || '', tags: f.tags || [] })),
      search: function(query) {
        const q = query.toLowerCase();
        return this.faqs.filter(f => f.q.toLowerCase().includes(q) || f.a.toLowerCase().includes(q) || f.tags.some(t => t.toLowerCase().includes(q)));
      }
    };
  }
  // 232. Search optimization
  function buildSearchIndex() {
    return { id: uid(), documents: [],
      add: function(doc) { this.documents.push({ id: uid(), ...doc }); return this; },
      search: function(query) {
        const q = query.toLowerCase();
        return this.documents.filter(d => (d.title || '').toLowerCase().includes(q) || (d.content || '').toLowerCase().includes(q)).sort((a, b) => (b.weight || 0) - (a.weight || 0));
      }
    };
  }
  // 233. Breadcrumb navigation
  function buildBreadcrumbs(items) {
    return { id: uid(), items: (items || []).map((item, i) => ({ label: item.label || '', url: item.url || '#', position: i + 1 })) };
  }
  // 234. Table of contents
  function buildTOC(headings) {
    return { id: uid(), items: (headings || []).map(h => ({ text: h.text || '', level: h.level || 1, id: h.id || 'h_' + Math.random().toString(36).slice(2, 8), children: [] })) };
  }
  // 235. Reading progress
  function buildReadingProgress(opts) {
    return { id: uid(), totalWords: opts.totalWords || 0, wordsRead: 0, percent: 0,
      update: function(words) { this.wordsRead = Math.min(words, this.totalWords); this.percent = this.totalWords > 0 ? Math.round((this.wordsRead / this.totalWords) * 100) : 0; return this.percent; }
    };
  }
  // 236. Estimated reading time
  function estimateReadingTime(text, wpm) {
    const words = (text || '').split(/\s+/).filter(Boolean).length;
    return { words, minutes: Math.ceil(words / (wpm || 200)), wpm: wpm || 200 };
  }
  // 237. Related articles
  function buildRelatedArticles(articles, currentId) {
    return (articles || []).filter(a => a.id !== currentId).map(a => ({ id: a.id || uid(), title: a.title || '', url: a.url || '#', relevance: a.relevance || 0 })).sort((a, b) => b.relevance - a.relevance);
  }
  // 238. Cross-references
  function buildCrossReferences(pages) {
    return { id: uid(),
      references: (pages || []).map(p => ({ from: p.from || '', to: p.to || '', type: p.type || 'related' })),
      getRefs: function(pageId) { return this.references.filter(r => r.from === pageId); }
    };
  }
  // 239. Glossary
  function buildGlossary(terms) {
    return { id: uid(),
      terms: (terms || []).map(t => ({ term: t.term || '', definition: t.definition || '', aliases: t.aliases || [] })),
      lookup: function(q) { const lower = q.toLowerCase(); return this.terms.filter(t => t.term.toLowerCase() === lower || t.aliases.some(a => a.toLowerCase() === lower)); }
    };
  }
  // 240. Acronym expander
  function buildAcronymExpander(acronyms) {
    const map = {};
    (acronyms || []).forEach(a => { map[a.acronym.toLowerCase()] = a.expansion || ''; });
    return { id: uid(), map,
      expand: function(text) { return (text || '').replace(/\b([A-Z]{2,6})\b/g, (m) => map[m.toLowerCase()] ? m + ' (' + map[m.toLowerCase()] + ')' : m); }
    };
  }

  const Documentation = {
    buildApiExplorer, buildCodeExample, buildTutorial, buildVideoDoc,
    buildScreencastLibrary, buildGifDemo, buildAnimatedDiagram,
    buildFlowchart, buildDecisionTree, buildTroubleshootingGuide,
    buildFaqBot, buildSearchIndex, buildBreadcrumbs, buildTOC,
    buildReadingProgress, estimateReadingTime, buildRelatedArticles,
    buildCrossReferences, buildGlossary, buildAcronymExpander,
  };


  // ---- 241-260: Integrations ----
  function connectIntegration(name, cfg) {
    const conn = { name, url: cfg.url, headers: cfg.headers || {}, status: 'connected', connectedAt: Date.now() };
    state.integrations[name] = conn;
    persist();
    return conn;
  }
  function disconnectIntegration(name) {
    const conn = state.integrations[name];
    delete state.integrations[name];
    persist();
    return conn;
  }
  function integrateFetch(name, path, opts) {
    const conn = state.integrations[name];
    if (!conn) throw new Error('Integration ' + name + ' not connected');
    const url = conn.url + (path || '');
    return safeFetch(url, { ...opts, headers: { ...(conn.headers || {}), ...(opts && opts.headers || {}) } });
  }
  function oauth2Authorize(name, scope, redirectUri) {
    const conn = state.integrations[name];
    if (!conn) throw new Error('Integration ' + name + ' not connected');
    const params = new URLSearchParams({ client_id: conn.clientId, scope: (scope || []).join(' '), redirect_uri: redirectUri });
    return { authUrl: conn.url + '/oauth/authorize?' + params.toString(), state: Math.random().toString(36).slice(2) };
  }
  async function oauth2Exchange(name, code, redirectUri) {
    const res = await integrateFetch(name, '/oauth/token', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ grant_type: 'authorization_code', code, redirect_uri: redirectUri }) });
    return res.json;
  }
  function rest(name, method, path, body) {
    return integrateFetch(name, path, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  }
  function graphql(name, query, variables) {
    return integrateFetch(name, '/graphql', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query, variables }) });
  }
  function batch(name, requests) {
    return integrateFetch(name, '/batch', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ requests }) });
  }
  async function upload(name, path, file, onProgress) {
    const conn = state.integrations[name];
    if (!conn) throw new Error('Integration ' + name + ' not connected');
    const fd = new FormData(); fd.append('file', file);
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', conn.url + (path || '/upload'));
      if (onProgress) xhr.upload.onprogress = e => onProgress(e.loaded / e.total);
      xhr.onload = () => resolve(xhr.response);
      xhr.onerror = () => reject(xhr.statusText);
      xhr.send(fd);
    });
  }
  function getIntegration(name) {
    return state.integrations[name] || null;
  }
  function listIntegrations() {
    return Object.values(state.integrations);
  }
  function getHealth(name) {
    const conn = state.integrations[name];
    if (!conn) return { healthy: false, status: 'disconnected' };
    return { healthy: conn.status === 'connected', status: conn.status, name: conn.name, connectedAt: conn.connectedAt };
  }

  // 241-250: Platform integration factories
  function github(cfg) { return { name: 'github', type: 'rest', baseUrl: cfg.baseUrl || 'https://api.github.com', headers: { 'Authorization': 'token ' + (cfg.token || ''), 'Accept': 'application/vnd.github.v3+json', ...(cfg.headers || {}) }, issues: { list: (owner, repo) => rest('github', 'GET', '/repos/' + owner + '/' + repo + '/issues'), create: (owner, repo, title, body) => rest('github', 'POST', '/repos/' + owner + '/' + repo + '/issues', { title, body }) }, prs: { list: (owner, repo) => rest('github', 'GET', '/repos/' + owner + '/' + repo + '/pulls') }, webhooks: { url: cfg.webhookUrl || '', verify: (sig, payload) => sig === 'sha256=' + require('crypto').createHmac('sha256', cfg.webhookSecret || '').update(payload).digest('hex') } }; }

  function gitlab(cfg) { return { name: 'gitlab', type: 'rest', baseUrl: cfg.baseUrl || 'https://gitlab.com/api/v4', headers: { 'PRIVATE-TOKEN': cfg.token || '', 'Accept': 'application/json', ...(cfg.headers || {}) }, projects: { list: (owner) => rest('gitlab', 'GET', '/projects?namespace=' + owner + '&&per_page=50') }, issues: { list: (projectId) => rest('gitlab', 'GET', '/projects/' + projectId + '/issues'), create: (projectId, title, body) => rest('gitlab', 'POST', '/projects/' + projectId + '/issues', { title, description: body }) }, pipelines: { list: (projectId) => rest('gitlab', 'GET', '/projects/' + projectId + '/pipelines') } }; }
  function bitbucket(cfg) { return { name: 'bitbucket', type: 'rest', baseUrl: cfg.baseUrl || 'https://api.bitbucket.org/2.0', headers: { 'Authorization': 'Basic ' + btoa(cfg.username + ':' + cfg.password), ...(cfg.headers || {}) }, repos: { list: (workspace) => rest('bitbucket', 'GET', '/repositories/' + workspace) }, issues: { list: (workspace, repo) => rest('bitbucket', 'GET', '/repositories/' + workspace + '/' + repo + '/issues'), create: (workspace, repo, title, body) => rest('bitbucket', 'POST', '/repositories/' + workspace + '/' + repo + '/issues', { title, content: { raw: body } }) } }; }
  function azureDevops(cfg) { return { name: 'azure-devops', type: 'rest', baseUrl: cfg.baseUrl || ('https://dev.azure.com/' + cfg.organization), headers: { 'Authorization': 'Basic ' + btoa(':' + cfg.pat), ...(cfg.headers || {}) }, projects: { list: () => rest('azure-devops', 'GET', '/_apis/projects') }, workItems: { list: (projectId) => rest('azure-devops', 'GET', '/' + projectId + '/_apis/wit/workitems'), create: (projectId, type, fields) => rest('azure-devops', 'POST', '/' + projectId + '/_apis/wit/workitems?api-version=6.0', { method: 'PATCH', body: JSON.stringify(fields) }) } }; }
  function jira(cfg) { return { name: 'jira', type: 'rest', baseUrl: cfg.baseUrl || ('https://' + cfg.domain + '.atlassian.net'), headers: { 'Authorization': 'Basic ' + btoa(cfg.email + ':' + cfg.apiToken), ...(cfg.headers || {}) }, issues: { search: (jql) => rest('jira', 'POST', '/rest/api/3/search', { jql }), create: (project, summary, description, issueType) => rest('jira', 'POST', '/rest/api/3/issue', { fields: { project: { key: project }, summary, description, issuetype: { name: issueType || 'Task' } } }) }, projects: { list: () => rest('jira', 'GET', '/rest/api/3/project/search'), get: (projectId) => rest('jira', 'GET', '/rest/api/3/project/' + projectId) } }; }
  function trello(cfg) { return { name: 'trello', type: 'rest', baseUrl: cfg.baseUrl || 'https://api.trello.com', headers: { ...(cfg.headers || {}) }, boards: { list: () => rest('trello', 'GET', '/1/members/' + cfg.user + '/boards?key=' + cfg.key + '&token=' + cfg.token) }, cards: { list: (boardId) => rest('trello', 'GET', '/1/boards/' + boardId + '/cards?key=' + cfg.key + '&token=' + cfg.token), create: (boardId, name, desc) => rest('trello', 'POST', '/1/cards?key=' + cfg.key + '&token=' + cfg.token, { idList: boardId, name, desc }) } }; }

  function asana(cfg) { return { name: 'asana', type: 'rest', baseUrl: cfg.baseUrl || 'https://app.asana.com', headers: { 'Authorization': 'Bearer ' + cfg.token, ...(cfg.headers || {}) }, tasks: { list: (projectId) => rest('asana', 'GET', '/api/1.0/projects/' + projectId + '/tasks'), create: (projectId, name, notes) => rest('asana', 'POST', '/api/1.0/tasks', { projects: [projectId], name, notes }) }, projects: { list: () => rest('asana', 'GET', '/api/1.0/projects'), get: (projectId) => rest('asana', 'GET', '/api/1.0/projects/' + projectId), create: (name) => rest('asana', 'POST', '/api/1.0/projects', { name }) } }; }
  function notion(cfg) { return { name: 'notion', type: 'rest', baseUrl: cfg.baseUrl || 'https://api.notion.com', headers: { 'Authorization': 'Bearer ' + cfg.token, 'Notion-Version': cfg.version || '2022-06-28', ...(cfg.headers || {}) }, pages: { create: (parentId, title, content) => rest('notion', 'POST', '/v1/pages', { parent: { page_id: parentId }, properties: { title: { title: [{ text: { content: title } }] } } }) } }; }
  function confluence(cfg) { return { name: 'confluence', type: 'rest', baseUrl: cfg.baseUrl || ('https://' + cfg.domain + '.atlassian.net/wiki'), headers: { 'Authorization': 'Basic ' + btoa(cfg.email + ':' + cfg.apiToken), ...(cfg.headers || {}) }, pages: { list: (spaceKey) => rest('confluence', 'GET', '/rest/api/content?spaceKey=' + spaceKey + '&limit=100'), create: (spaceKey, title, body) => rest('confluence', 'POST', '/rest/api/content', { type: 'page', title, space: { key: spaceKey }, body: { storage: { value: body, representation: 'storage' } } }) } }; }
  function slack(cfg) { return { name: 'slack', type: 'rest', baseUrl: cfg.baseUrl || 'https://slack.com/api', headers: { 'Authorization': 'Bearer ' + cfg.token, ...(cfg.headers || {}) }, channels: { list: () => rest('slack', 'GET', '/conversations.list') }, messages: { post: (channelId, text) => rest('slack', 'POST', '/chat.postMessage', { channel: channelId, text }) } }; }
  function discord(cfg) { return { name: 'discord', type: 'webhook', baseUrl: cfg.baseUrl || 'https://discord.com/api/v10', headers: { ...(cfg.headers || {}) }, webhooks: { send: (channelId, content) => fetch((cfg.webhookUrl || '') + channelId, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content }) }) } }; }

  function teams(cfg) { return { name: 'teams', type: 'webhook', baseUrl: cfg.baseUrl || 'https://outlook.office.com/webhook', headers: { ...(cfg.headers || {}) }, webhooks: { send: (title, text) => fetch(cfg.webhookUrl || '', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title, text }) }) } }; }
  function telegram(cfg) { return { name: 'telegram', type: 'rest', baseUrl: cfg.baseUrl || 'https://api.telegram.org/bot', headers: { ...(cfg.headers || {}) }, bot: { token: cfg.token, getMe: () => rest('telegram', 'GET', '/getMe'), sendMessage: (chatId, text) => rest('telegram', 'POST', '/sendMessage', { chat_id: chatId, text }) } }; }
  function whatsapp(cfg) { return { name: 'whatsapp', type: 'rest', baseUrl: cfg.baseUrl || 'https://graph.facebook.com', headers: { 'Authorization': 'Bearer ' + cfg.token, ...(cfg.headers || {}) }, messages: { send: (to, body) => rest('whatsapp', 'POST', '/v15.0/' + cfg.phoneId + '/messages', { messaging_product: 'whatsapp', to, text: { body } }) } }; }
  function email(cfg) { return { name: 'email', type: 'rest', baseUrl: cfg.baseUrl || 'https://api.mailgun.net', headers: { 'Authorization': 'Basic ' + btoa('api:' + cfg.apiKey), ...(cfg.headers || {}) }, messages: { send: (from, to, subject, body) => rest('email', 'POST', '/v3/' + cfg.domain + '/messages', { from, to, subject, text: body }) } }; }
  function calendar(cfg) { return { name: 'calendar', type: 'rest', baseUrl: cfg.baseUrl || 'https://www.googleapis.com/calendar', headers: { 'Authorization': 'Bearer ' + cfg.token, ...(cfg.headers || {}) }, events: { list: (calendarId) => rest('calendar', 'GET', '/v3/calendars/' + calendarId + '/events'), create: (calendarId, event) => rest('calendar', 'POST', '/v3/calendars/' + calendarId + '/events', event) } }; }
  function drive(cfg) { return { name: 'drive', type: 'rest', baseUrl: cfg.baseUrl || 'https://www.googleapis.com/drive', headers: { 'Authorization': 'Bearer ' + cfg.token, ...(cfg.headers || {}) }, files: { list: (q) => rest('drive', 'GET', '/v3/files?q=' + encodeURIComponent(q || '')), create: (name, content) => rest('drive', 'POST', '/v3/files', { name, content }) } }; }
  function dropbox(cfg) { return { name: 'dropbox', type: 'rest', baseUrl: cfg.baseUrl || 'https://api.dropboxapi.com', headers: { 'Authorization': 'Bearer ' + cfg.token, ...(cfg.headers || {}) }, files: { list: (path) => rest('dropbox', 'POST', '/2/files/list_folder', { path: path || '' }), download: (path) => rest('dropbox', 'POST', '/2/files/download', { path }) } }; }
  function oneDrive(cfg) { return { name: 'onedrive', type: 'rest', baseUrl: cfg.baseUrl || 'https://graph.microsoft.com', headers: { 'Authorization': 'Bearer ' + cfg.token, ...(cfg.headers || {}) }, items: { list: (path) => rest('onedrive', 'GET', '/v1.0/me/drive/root:/' + (path || '') + ':/children'), download: (itemId) => rest('onedrive', 'GET', '/v1.0/me/drive/items/' + itemId + '/content') } }; }
  function googleDrive(cfg) { return { name: 'googledrive', type: 'rest', baseUrl: cfg.baseUrl || 'https://www.googleapis.com/drive', headers: { 'Authorization': 'Bearer ' + cfg.token, ...(cfg.headers || {}) }, files: { list: () => rest('googledrive', 'GET', '/v3/files'), get: (fileId) => rest('googledrive', 'GET', '/v3/files/' + fileId), create: (name, mimeType) => rest('googledrive', 'POST', '/v3/files', { name, mimeType }), delete: (fileId) => rest('googledrive', 'DELETE', '/v3/files/' + fileId) } }; }


  const Integrations = {
    connect: connectIntegration, disconnect: disconnectIntegration, fetch: integrateFetch,
    oauth2Authorize, oauth2Exchange, rest, graphql, batch, upload,
    get: getIntegration, list: listIntegrations, health: getHealth,
    // 241-260: Platform factories
    github, gitlab, bitbucket, azureDevops, jira, trello, asana, notion,
    confluence, slack, discord, teams, telegram, whatsapp, email, calendar,
    drive, dropbox, oneDrive, googleDrive,
  };

  const NEXUS = {
    Documentation, Integrations,
    version: '1.7.0',
    metadata: { name: MODULE_NAME, version: '1.7.0', dependencies: [] },
    init() { load(); persist(); return this; },
    get state() { return { integrations: state.integrations, docs: state.docs }; },
  };

  if (typeof window !== 'undefined') {
    window.__NEXUS_DOC_INT__ = NEXUS;
    if (window.__NEXUS_HUB__ && typeof window.__NEXUS_HUB__.register === 'function') {
      window.__NEXUS_HUB__.register('doc-int', NEXUS);
    }
  }
  if (typeof module !== 'undefined') module.exports = NEXUS;
  return NEXUS;
})();

