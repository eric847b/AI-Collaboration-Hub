// ==UserScript==
// @name         NEXUS Feature Enhancements 030
// @namespace    http://nexus.local/
// @version      1.6.0
// @description  PWA, offline, storage, caching, content scripts, hot reload, editor tools, snippets, macros, refactor (ROADMAP 61-100)
// @author       NEXUS
// @match        *://*/*
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_deleteValue
// @grant        GM_listValues
// @grant        GM_xmlhttpRequest
// @grant        GM_registerMenuCommand
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';

  const MODULE_ID = 'feature-enhancements';
  const VERSION = '1.6.0';
  const LOG_PREFIX = `[NEXUS:${MODULE_ID}]`;

  const GM = {
    get: (k, d) => { try { return GM_getValue(k, d); } catch (e) { return d; } },
    set: (k, v) => { try { GM_setValue(k, v); } catch (e) {} },
    del: (k) => { try { GM_deleteValue(k); } catch (e) {} },
    list: () => { try { return GM_listValues(); } catch (e) { return []; } },
  };

  const log = (...a) => console.log(LOG_PREFIX, ...a);
  const warn = (...a) => console.warn(LOG_PREFIX, ...a);
  const err = (...a) => console.error(LOG_PREFIX, ...a);

  const api = {};
  if (typeof window !== 'undefined') window.__NEXUS_FEATURES__ = api;

  // ===================================================================
  // 61. Progressive Web App (PWA) support
  // ===================================================================
  api.pwa = {
    generateManifest(opts = {}) {
      const m = {
        name: opts.name || document.title || 'NEXUS App',
        short_name: opts.shortName || opts.name || 'NEXUS',
        start_url: opts.startUrl || '/',
        display: opts.display || 'standalone',
        background_color: opts.bgColor || '#1a1a2e',
        theme_color: opts.themeColor || '#16213e',
        orientation: opts.orientation || 'any',
        icons: opts.icons || [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
        ],
      };
      if (opts.scope) m.scope = opts.scope;
      if (opts.lang) m.lang = opts.lang;
      if (opts.description) m.description = opts.description;
      return m;
    },

    injectManifest(manifest) {
      const m = manifest || this.generateManifest();
      const blob = new Blob([JSON.stringify(m)], { type: 'application/manifest+json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('link');
      link.rel = 'manifest';
      link.href = url;
      document.head.appendChild(link);
      return { url, manifest: m };
    },

    isInstallable() { return 'BeforeInstallPromptEvent' in window; },

    listenInstallPrompt(cb) {
      if (!('BeforeInstallPromptEvent' in window)) return null;
      let deferred;
      const handler = (e) => {
        e.preventDefault();
        deferred = e;
        cb?.({ prompt: () => deferred.prompt(), userChoice: deferred.userChoice });
      };
      window.addEventListener('beforeinstallprompt', handler);
      return () => window.removeEventListener('beforeinstallprompt', handler);
    },
  };

  // ===================================================================
  // 62. Offline mode with service workers
  // ===================================================================
  api.offline = {
    async register(swPath, opts = {}) {
      if (!('serviceWorker' in navigator)) return { ok: false, reason: 'no-sw-support' };
      try {
        const reg = await navigator.serviceWorker.register(swPath, opts);
        return { ok: true, reg, scope: reg.scope };
      } catch (e) { return { ok: false, reason: e.message }; }
    },

    async unregister() {
      if (!('serviceWorker' in navigator)) return false;
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg) { await reg.unregister(); return true; }
      return false;
    },

    isOnline() { return navigator.onLine; },

    listenStatus(cb) {
      const on = () => cb?.({ online: true });
      const off = () => cb?.({ online: false });
      window.addEventListener('online', on);
      window.addEventListener('offline', off);
      return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
    },

    strategies: {
      cacheFirst: (cn, req) => ({ strategy: 'cache-first', cacheName: cn, request: req }),
      networkFirst: (cn, req, t = 3000) => ({ strategy: 'network-first', cacheName: cn, request: req, timeout: t }),
      staleWhileRevalidate: (cn, req) => ({ strategy: 'stale-while-revalidate', cacheName: cn, request: req }),
      cacheOnly: (cn, req) => ({ strategy: 'cache-only', cacheName: cn, request: req }),
      networkOnly: (req) => ({ strategy: 'network-only', request: req }),
    },
  };

  // 63. Background sync
  api.backgroundSync = {
    async register(tag) {
      if (!('serviceWorker' in navigator) || !('sync' in SW_REG)) return { ok: false, reason: 'no-sync' };
      try { await SW_REG.sync.register(tag); return { ok: true, tag }; }
      catch (e) { return { ok: false, reason: e.message }; }
    },
    onSync(cb) {
      if (!('serviceWorker' in navigator)) return null;
      navigator.serviceWorker.addEventListener('message', (e) => {
        if (e.data?.type === 'sync' || e.data?.tag) cb?.(e.data);
      });
    },
  };
  let SW_REG = {};
  Object.defineProperty(api.backgroundSync, 'SW_REG', { get() { return SW_REG; }, set(v) { SW_REG = v; } });

  // 64. Push notifications
  api.push = {
    async subscribe(key) {
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) return { ok: false, reason: 'no-push' };
      try {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
        return { ok: true, subscription: sub.toJSON ? sub.toJSON() : sub };
      } catch (e) { return { ok: false, reason: e.message }; }
    },
    async unsubscribe() {
      if (!('serviceWorker' in navigator)) return { ok: false };
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) { await sub.unsubscribe(); return { ok: true }; }
      return { ok: false, reason: 'no-sub' };
    },
    permission() { return Notification?.permission || 'denied'; },
    requestPermission() {
      if (!('Notification' in window)) return Promise.resolve('denied');
      return Notification.requestPermission();
    },
    isSupported() { return 'serviceWorker' in navigator && 'PushManager' in window; },
  };

  // 65. WebExtensions native API
  api.webExtensions = {
    isExtensionContext() {
      return (typeof chrome !== 'undefined' && !!chrome.runtime?.id) ||
             (typeof browser !== 'undefined' && !!browser.runtime?.id);
    },
    runtime() {
      if (typeof chrome !== 'undefined' && chrome.runtime) return { type: 'chrome', api: chrome.runtime };
      if (typeof browser !== 'undefined' && browser.runtime) return { type: 'gecko', api: browser.runtime };
      return null;
    },
    sendMessage(msg) {
      const rt = this.runtime();
      if (!rt) return Promise.reject(new Error('no-runtime'));
      return rt.type === 'chrome'
        ? new Promise((res, rej) => { rt.api.sendMessage(msg, (r) => chrome.runtime?.lastError ? rej(new Error(chrome.runtime.lastError.message)) : res(r)); })
        : rt.api.sendMessage(msg);
    },
    onMessage(cb) {
      const rt = this.runtime();
      if (!rt) return null;
      rt.api.onMessage.addListener(cb);
      return () => rt.api.onMessage.removeListener(cb);
    },
  };

  // 66. Cross-browser extension support
  api.crossBrowser = {
    detect() {
      if (typeof browser !== 'undefined' && browser.runtime) return 'gecko';
      if (typeof chrome !== 'undefined' && chrome.runtime) return 'chromium';
      return 'unknown';
    },
    storage: {
      get(keys) {
        const c = typeof chrome !== 'undefined' ? chrome.storage : (typeof browser !== 'undefined' ? browser.storage : null);
        if (!c) return Promise.reject(new Error('no-storage'));
        const s = c.local || c.sync;
        return typeof browser !== 'undefined' ? s.get(keys) : new Promise((res) => s.get(keys, res));
      },
      set(obj) {
        const c = typeof chrome !== 'undefined' ? chrome.storage : (typeof browser !== 'undefined' ? browser.storage : null);
        if (!c) return Promise.reject(new Error('no-storage'));
        const s = c.local || c.sync;
        return typeof browser !== 'undefined' ? s.set(obj) : new Promise((res) => s.set(obj, res));
      },
    },
  };

  // 67. Browser-native storage APIs
  api.storageAPIs = {
    local: {
      get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } },
      set(k, v) { localStorage.setItem(k, JSON.stringify(v)); },
      del(k) { localStorage.removeItem(k); },
      list() { return Object.keys(localStorage); },
    },
    session: {
      get(k) { try { return JSON.parse(sessionStorage.getItem(k)); } catch (e) { return null; } },
      set(k, v) { sessionStorage.setItem(k, JSON.stringify(v)); },
      del(k) { sessionStorage.removeItem(k); },
    },
    cookie: {
      get(name) {
        const m = document.cookie.split(';').map(c => c.trim()).find(c => c.startsWith(name + '='));
        return m ? decodeURIComponent(m.slice(name.length + 1)) : null;
      },
      set(name, val, opts = {}) {
        let s = `${name}=${encodeURIComponent(val)}`;
        if (opts.maxAge) s += `; max-age=${opts.maxAge}`;
        if (opts.path) s += `; path=${opts.path}`;
        if (opts.secure) s += '; secure';
        document.cookie = s;
        return s;
      },
      del(name) { this.set(name, '', { maxAge: 0 }); },
    },
    preferred() {
      if (typeof GM_getValue !== 'undefined') return 'gm';
      if (typeof localStorage !== 'undefined') return 'local';
      return 'memory';
    },
  };
  // 62. Unified storage manager with byte tracking
  api.storage = {
    _data: new Map(),
    set(k, v) { this._data.set(k, v); GM.set(k, v); },
    get(k, d) { return this._data.has(k) ? this._data.get(k) : GM.get(k, d); },
    del(k) { this._data.delete(k); GM.del(k); },
    getBytes() {
      let bytes = 0;
      for (const [k, v] of this._data) bytes += k.length + JSON.stringify(v).length;
      const keys = GM.list();
      for (const k of keys) bytes += k.length + JSON.stringify(GM.get(k)).length;
      return bytes;
    },
  };



  // 68. IndexedDB
  api.indexedDB = {
    _db: null,
    async open(name = 'nexus-db', version = 1, stores = ['data']) {
      if (this._db) return this._db;
      return new Promise((resolve, reject) => {
        const req = indexedDB.open(name, version);
        req.onupgradeneeded = () => {
          const db = req.result;
          stores.forEach(s => { if (!db.objectStoreNames.contains(s)) db.createObjectStore(s, { keyPath: 'key' }); });
        };
        req.onsuccess = () => { this._db = req.result; resolve(this._db); };
        req.onerror = () => reject(req.error);
      });
    },
    async _tx(db, store, mode, fn) {
      return new Promise((resolve, reject) => {
        const tx = db.transaction(store, mode);
        const os = tx.objectStore(store);
        const r = fn(os);
        tx.oncomplete = () => resolve(r?.result);
        tx.onerror = () => reject(tx.error);
      });
    },
    async put(store, key, value, db) {
      const d = db || await this.open();
      return this._tx(d, store, 'readwrite', (os) => os.put({ key, value, ts: Date.now() }));
    },
    async get(store, key, db) {
      const d = db || await this.open();
      const r = await this._tx(d, store, 'readonly', (os) => os.get(key));
      return r?.value;
    },
    async del(store, key, db) {
      const d = db || await this.open();
      return this._tx(d, store, 'readwrite', (os) => os.delete(key));
    },
    async list(store, db) {
      const d = db || await this.open();
      const r = await this._tx(d, store, 'readonly', (os) => os.getAll());
      return r?.map(x => x.key) || [];
    },
    async close() { if (this._db) { this._db.close(); this._db = null; } },
  };

  // 69. WebSQL legacy
  api.websql = {
    isSupported() { return typeof openDatabase !== 'undefined'; },
    open(name = 'nexus-websql', size = 5 * 1024 * 1024) {
      if (!this.isSupported()) return null;
      return openDatabase(name, '1.0', 'NEXUS WebSQL', size);
    },
    exec(db, sql, params = []) {
      return new Promise((resolve, reject) => {
        db.transaction((tx) => tx.executeSql(sql, params, (_, rs) => resolve(rs), (_, err) => reject(err)));
      });
    },
  };

  // 70. Cache API
  api.cacheAPI = {
    async openCache(name = 'nexus-cache-v1') {
      if (!('caches' in self)) return null;
      return caches.open(name);
    },
    async add(name, req) {
      const c = await this.openCache(name);
      if (!c) return { ok: false };
      try { await c.add(req); return { ok: true }; }
      catch (e) { return { ok: false, reason: e.message }; }
    },
    async put(name, req, resp) {
      const c = await this.openCache(name);
      if (!c) return { ok: false };
      await c.put(req, resp);
      return { ok: true };
    },
    async match(name, req) {
      const c = await this.openCache(name);
      return c ? c.match(req) : null;
    },
    async del(name, req) {
      const c = await this.openCache(name);
      return c ? c.delete(req) : false;
    },
    async keys(name) {
      const c = await this.openCache(name);
      return c ? c.keys() : [];
    },
    async clear(name) {
      const c = await this.openCache(name);
      if (!c) return false;
      const ks = await c.keys();
      await Promise.all(ks.map(k => c.delete(k)));
      return true;
    },
  };

  // 62b. In-memory cache facade
  api.cache = {
    _keys: new Set(),
    _data: new Map(),
    set(k, v) { this._keys.add(k); this._data.set(k, v); },
    get(k) { return this._data.get(k); },
    has(k) { return this._keys.has(k); },
    keys() { return [...this._keys]; },
    delete(k) { this._keys.delete(k); this._data.delete(k); },
  };

  // 71. Background script workers
  api.backgroundWorkers = {
    create(fn, opts = {}) {
      const src = `self.onmessage=${fn.toString()};`;
      const blob = new Blob([src], { type: 'application/javascript' });
      const url = URL.createObjectURL(blob);
      const worker = new Worker(url);
      if (opts.timeout) {
        const t = setTimeout(() => { worker.terminate(); URL.revokeObjectURL(url); }, opts.timeout);
        worker.addEventListener('message', () => clearTimeout(t));
      }
      return { worker, url };
    },
    async run(fn, msg, timeout = 5000) {
      const { worker, url } = this.create(fn, { timeout });
      return new Promise((resolve, reject) => {
        const t = setTimeout(() => { worker.terminate(); URL.revokeObjectURL(url); reject(new Error('timeout')); }, timeout);
        worker.onmessage = (e) => { clearTimeout(t); worker.terminate(); URL.revokeObjectURL(url); resolve(e.data); };
        worker.onerror = (e) => { clearTimeout(t); worker.terminate(); URL.revokeObjectURL(url); reject(new Error(e.message)); };
        worker.postMessage(msg);
      });
    },
    createShared(url) { return new SharedWorker(url); },
  };

  // 72. Content script injection
  api.contentScripts = {
    injectCode(code) {
      const s = document.createElement('script');
      s.textContent = code;
      (document.head || document.documentElement).appendChild(s);
      s.remove();
      return { ok: true };
    },
    injectFile(path) {
      const s = document.createElement('script');
      s.src = path;
      s.onload = () => s.remove();
      (document.head || document.documentElement).appendChild(s);
      return { ok: true };
    },
    injectCSS(css) {
      const s = document.createElement('style');
      s.textContent = css;
      document.head.appendChild(s);
      return { el: s, ok: true };
    },
    injectLink(href) {
      const l = document.createElement('link');
      l.rel = 'stylesheet';
      l.href = href;
      document.head.appendChild(l);
      return { el: l, ok: true };
    },
  };

  // 73. Declarative content rules
  api.declarativeRules = {
    compile(rules) {
      return rules.map((r, i) => ({
        id: r.id || i + 1,
        priority: r.priority || 1,
        conditions: r.conditions || [],
        actions: r.actions || [],
        match(ctx) {
          return this.conditions.every(c => {
            if (c.url) return new RegExp(c.url).test(ctx.url || '');
            if (c.host) return (ctx.host || '').includes(c.host);
            if (c.path) return (ctx.path || '').includes(c.path);
            if (c.css) return !!(ctx.el && ctx.el.matches?.(c.css));
            return true;
          });
        },
      }));
    },
    findMatching(rules, ctx) {
      const compiled = Array.isArray(rules?.[0]?.conditions) ? rules : this.compile(rules);
      return compiled.filter(r => r.match(ctx)).sort((a, b) => b.priority - a.priority);
    },
    async apply(rules, ctx, handler) {
      const matching = this.findMatching(rules, ctx);
      for (const r of matching) await handler?.(r, ctx);
      return matching;
    },
  };

  // 74. Dynamic content scripts
  api.dynamicScripts = {
    _registry: new Map(),
    register(id, opts = {}) {
      this._registry.set(id, { id, ...opts, registeredAt: Date.now() });
      if (opts.autoRun && opts.fn) this.run(id);
      return { ok: true, id };
    },
    unregister(id) { return this._registry.delete(id); },
    async run(id, ctx = {}) {
      const def = this._registry.get(id);
      if (!def?.fn) return { ok: false, reason: 'not-found' };
      const matches = !def.matches || api.declarativeRules.findMatching(
        def.matches.map((m, i) => ({ id: i + 1, conditions: [m], actions: [] })),
        ctx
      ).length > 0;
      if (!matches) return { ok: false, reason: 'no-match' };
      const r = await def.fn(ctx);
      return { ok: true, result: r };
    },
    list() { return Array.from(this._registry.values()).map(r => ({ id: r.id })); },
  };

  // 75. Hot reloading
  api.hotReload = {
    _watches: new Map(),
    watchFile(path, cb, interval = 1000) {
      let lastHash = null;
      const tick = setInterval(async () => {
        try {
          const resp = await fetch(path, { headers: { 'Cache-Control': 'no-cache' } });
          const txt = await resp.text();
          const hash = txt.split('').reduce((h, c) => ((h << 5) - h + c.charCodeAt(0)) | 0, 0);
          if (lastHash !== null && lastHash !== hash) cb?.({ path, hash });
          lastHash = hash;
        } catch (e) {}
      }, interval);
      this._watches.set(path, tick);
      return () => { clearInterval(tick); this._watches.delete(path); };
    },
    unwatch(path) {
      const t = this._watches.get(path);
      if (t) { clearInterval(t); this._watches.delete(path); return true; }
      return false;
    },
    unwatchAll() { this._watches.forEach(t => clearInterval(t)); this._watches.clear(); },
  };

  // 76. Live module reloading
  api.liveReload = {
    _modules: new Map(),
    register(id, module) {
      this._modules.set(id, { id, module, loadedAt: Date.now() });
      return { ok: true, id };
    },
    async reload(id, loader) {
      const def = this._modules.get(id);
      if (!def || !loader) return { ok: false, reason: 'not-found' };
      const fresh = await loader(id);
      def.module = fresh;
      def.loadedAt = Date.now();
      def.reloadCount = (def.reloadCount || 0) + 1;
      return { ok: true, module: fresh, count: def.reloadCount };
    },
    swap(id, newModule) {
      const def = this._modules.get(id);
      if (!def) return { ok: false };
      def.module = newModule;
      def.loadedAt = Date.now();
      return { ok: true };
    },
    get(id) { return this._modules.get(id)?.module; },
    list() { return Array.from(this._modules.keys()); },
  };

  // 77. Hot module replacement (HMR)
  api.hmr = {
    _acceptCallbacks: new Map(),
    accept(id, cb) { this._acceptCallbacks.set(id, cb); },
    applyUpdate(id, newModule) {
      const cb = this._acceptCallbacks.get(id);
      if (cb) { cb(newModule); return { ok: true, type: 'accept-callback' }; }
      if (api.liveReload._modules.has(id)) {
        api.liveReload.swap(id, newModule);
        return { ok: true, type: 'live-swap' };
      }
      return { ok: false, reason: 'no-handler' };
    },
    status(id) { return { hasAccept: this._acceptCallbacks.has(id), hasModule: api.liveReload._modules.has(id) }; },
  };

  // 78. DevTools integration
  api.devtools = {
    isAvailable() { return typeof chrome !== 'undefined' && !!(chrome.devtools || chrome.inspectedWindow); },
    inspectedWindow() { return typeof chrome !== 'undefined' ? chrome.inspectedWindow : null; },
    evalInPage(expression) {
      const iw = this.inspectedWindow();
      if (!iw) return Promise.reject(new Error('no-inspected-window'));
      return new Promise((resolve, reject) => {
        iw.eval(expression, (result, err) => err ? reject(err) : resolve(result));
      });
    },
    createPanel(title, icon, page) {
      if (typeof chrome === 'undefined' || !chrome.devtools?.panels) return null;
      return chrome.devtools.panels.create(title, icon, page, (panel) => panel);
    },
  };

  // 79. Console enhancement
  api.console = {
    _originals: {},
    _timers: {},
    enhance(opts = {}) {
      if (opts.count) {
        ['log', 'info', 'warn', 'error'].forEach(m => {
          const orig = console[m].bind(console);
          const counts = {};
          this._originals[m] = orig;
          console[m] = (...a) => { counts.label = (counts.label || 0) + 1; orig(`[${counts.label}]`, ...a); };
        });
      }
      if (opts.time) {
        console.time = (label) => { this._timers[label] = performance.now(); };
        console.timeEnd = (label) => { const t = this._timers[label]; if (t) console.log(`${label}: ${(performance.now() - t).toFixed(2)}ms`); };
      }
      return { ok: true };
    },
    diff(a, b) {
      const changes = {};
      Object.keys({ ...a, ...b }).forEach(k => { if (a?.[k] !== b?.[k]) changes[k] = { from: a?.[k], to: b?.[k] }; });
      return changes;
    },
    restore() { Object.keys(this._originals).forEach(m => { console[m] = this._originals[m]; }); this._originals = {}; },
  };

  // 80. Network tab augmentation
  api.network = {
    _entries: [],
    _maxEntries: 500,
    capture() {
      const origFetch = window.fetch;
      window.fetch = async (...args) => {
        const start = performance.now();
        const resp = await origFetch(...args);
        this._add({ url: typeof args[0] === 'string' ? args[0] : args[0]?.url, method: args[1]?.method || 'GET', status: resp.status, duration: performance.now() - start, ts: Date.now() });
        return resp;
      };
      const origXhr = XMLHttpRequest.prototype.open;
      XMLHttpRequest.prototype.open = function(m, u) {
        const start = performance.now();
        this.addEventListener('load', () => {
          api.network._add({ url: u, method: m, status: this.status, duration: performance.now() - start, ts: Date.now() });
        });
        return origXhr.apply(this, arguments);
      };
      return { ok: true };
    },
    _add(entry) {
      this._entries.push(entry);
      if (this._entries.length > this._maxEntries) this._entries.shift();
    },
    entries(filter = {}) {
      return this._entries.filter(e => {
        if (filter.method && e.method !== filter.method) return false;
        if (filter.status && e.status !== filter.status) return false;
        if (filter.url && !e.url?.includes(filter.url)) return false;
        return true;
      });
    },
    clear() { this._entries = []; },
    summary() {
      const total = this._entries.length;
      const errors = this._entries.filter(e => e.status >= 400).length;
      const avgDur = total ? this._entries.reduce((s, e) => s + e.duration, 0) / total : 0;
      return { total, errors, avgDuration: avgDur };
    },
  };

  // 81. Source map support
  api.sourceMaps = {
    _maps: new Map(),
    async load(url) {
      try {
        const resp = await fetch(url);
        const map = await resp.json();
        this._maps.set(url, map);
        return map;
      } catch (e) { return null; }
    },
    originalPosition(map, line, column) {
      const m = map?.mappings ? map : this._maps.get(map);
      if (!m?.mappings) return null;
      return { source: m.sources?.[null], line, column, name: null };
    },
    sources(map) {
      const m = map?.mappings ? map : this._maps.get(map);
      return m?.sources || [];
    },
    has(url) { return this._maps.has(url); },
    remove(url) { return this._maps.delete(url); },
  };

  // 82. Time-travel debugging
  api.timeTravel = {
    _states: [],
    _index: -1,
    _maxSize: 50,
    record(state) {
      this._states.push({ state: JSON.parse(JSON.stringify(state)), ts: Date.now() });
      if (this._states.length > this._maxSize) this._states.shift();
      this._index = this._states.length - 1;
    },
    back() { if (this._index > 0) { this._index--; return this.current(); } return null; },
    forward() { if (this._index < this._states.length - 1) { this._index++; return this.current(); } return null; },
    jumpTo(index) { if (index >= 0 && index < this._states.length) { this._index = index; return this.current(); } return null; },
    current() { return this._states[this._index]?.state || null; },
    history() { return this._states.map((s, i) => ({ index: i, ts: s.ts })); },
    clear() { this._states = []; this._index = -1; },
  };

  // 83. State snapshots
  api.snapshots = {
    _snapshots: new Map(),
    take(label, state) {
      this._snapshots.set(label, { state: JSON.parse(JSON.stringify(state)), ts: Date.now() });
      return { ok: true, label };
    },
    get(label) { return this._snapshots.get(label)?.state || null; },
    restore(label) {
      const s = this._snapshots.get(label);
      return s ? JSON.parse(JSON.stringify(s.state)) : null;
    },
    diff(a, b) {
      const sa = this._snapshots.get(a)?.state;
      const sb = this._snapshots.get(b)?.state;
      if (!sa || !sb) return null;
      const changes = {};
      Object.keys({ ...sa, ...sb }).forEach(k => { if (sa[k] !== sb[k]) changes[k] = { from: sa[k], to: sb[k] }; });
      return changes;
    },
    del(label) { return this._snapshots.delete(label); },
    list() { return Array.from(this._snapshots.keys()); },
  };

  // 84. Action replay
  api.replay = {
    _actions: [],
    _isReplaying: false,
    record(action) {
      if (!this._isReplaying) this._actions.push({ ...action, ts: Date.now() });
    },
    async replay(actions, delay = 0) {
      const list = actions || this._actions;
      this._isReplaying = true;
      const results = [];
      for (const a of list) {
        const r = await a.fn?.();
        results.push(r);
        if (delay) await new Promise(r => setTimeout(r, delay));
      }
      this._isReplaying = false;
      return results;
    },
    clear() { this._actions = []; },
    list() { return this._actions.map((a, i) => ({ index: i, type: a.type, ts: a.ts })); },
    isReplaying() { return this._isReplaying; },
  };

  // 85. Undo/redo stack
  api.undoRedo = {
    _undoStack: [],
    _redoStack: [],
    _maxSize: 100,
    push(state) {
      this._undoStack.push(JSON.parse(JSON.stringify(state)));
      if (this._undoStack.length > this._maxSize) this._undoStack.shift();
      this._redoStack = [];
    },
    undo() {
      if (this._undoStack.length === 0) return null;
      const s = this._undoStack.pop();
      this._redoStack.push(s);
      return this._undoStack.length > 0 ? JSON.parse(JSON.stringify(this._undoStack[this._undoStack.length - 1])) : null;
  // 86. Command palette → see 19-Hotkeys-Shortcuts/006-command-palette
  // 87. Quick switcher → see 18-Organization/020-quick-switcher


    },
    redo() {
      if (this._redoStack.length === 0) return null;
      const s = this._redoStack.pop();
      this._undoStack.push(s);
      return JSON.parse(JSON.stringify(s));
    },
    canUndo() { return this._undoStack.length > 0; },
    canRedo() { return this._redoStack.length > 0; },
    clear() { this._undoStack = []; this._redoStack = []; },
    size() { return { undo: this._undoStack.length, redo: this._redoStack.length }; },
  };

  // 88. Fuzzy finder
  api.fuzzyFinder = {
    score(query, target) {
      if (!query) return 1;
      let qi = 0, ti = 0, score = 0, streak = 0;
      const t = target.toLowerCase(), q = query.toLowerCase();
      while (qi < q.length && ti < t.length) {
        if (q[qi] === t[ti]) { score += 1 + streak * 0.5; streak++; qi++; } else { streak = 0; }
        ti++;
      }
      return qi === q.length ? score / q.length : 0;
    },
    search(query, items, key = x => x) {
      return items.map(item => ({ item, score: this.score(query, key(item)) })).filter(x => x.score > 0).sort((a, b) => b.score - a.score).map(x => x.item);
    },
  };

  // 89. Multi-cursor support
  api.multiCursor = {
    _cursors: [],
    add(line, col = 0) { this._cursors.push({ line, col }); },
    remove(index) { this._cursors.splice(index, 1); },
    clear() { this._cursors = []; },
    list() { return [...this._cursors]; },
    sort() { this._cursors.sort((a, b) => a.line - b.line || a.col - b.col); },
    insertAtAll(text, lines) {
      this.sort();
      const result = [...lines];
      for (const c of this._cursors) {
        if (c.line < result.length) result[c.line] = result[c.line].slice(0, c.col) + text + result[c.line].slice(c.col);
      }
      return result;
    },
  };

  // 90. Column selection
  api.columnSelect = {
    select(lines, startLine, startCol, endLine, endCol) {
      const sl = Math.min(startLine, endLine), el = Math.max(startLine, endLine);
      const sc = Math.min(startCol, endCol), ec = Math.max(startCol, endCol);
      const result = [];
      for (let i = sl; i <= el && i < lines.length; i++) result.push(lines[i].slice(sc, Math.min(ec, lines[i].length)));
      return result;
    },
    insert(lines, startLine, col, text) {
      const t = text.split('\n');
      for (let i = 0; i < t.length && startLine + i < lines.length; i++) {
        const line = lines[startLine + i];
        lines[startLine + i] = line.slice(0, col) + t[i] + line.slice(col);
      }
      return lines;
    },
  };

  // 91. Block editing
  api.blockEdit = {
    selectBlock(lines, start, end) { return lines.slice(start, end + 1); },
    indent(lines, start, end, tab = '  ') {
      for (let i = start; i <= end && i < lines.length; i++) lines[i] = tab + lines[i];
      return lines;
    },
    dedent(lines, start, end, tab = '  ') {
      for (let i = start; i <= end && i < lines.length; i++) {
        if (lines[i].startsWith(tab)) lines[i] = lines[i].slice(tab.length);
        else if (lines[i].startsWith('\t')) lines[i] = lines[i].slice(1);
      }
      return lines;
    },
    comment(lines, start, end, prefix = '// ') {
      for (let i = start; i <= end && i < lines.length; i++) lines[i] = prefix + lines[i];
      return lines;
    },
    uncomment(lines, start, end, prefix = '// ') {
      for (let i = start; i <= end && i < lines.length; i++) {
        if (lines[i].startsWith(prefix)) lines[i] = lines[i].slice(prefix.length);
      }
      return lines;
    },
    duplicate(lines, start, end) {
      const block = lines.slice(start, end + 1);
      lines.splice(end + 1, 0, ...block);
      return lines;
    },
    move(lines, start, end, target) {
      const block = lines.splice(start, end - start + 1);
      const t = target > start ? target - block.length : target;
      lines.splice(t, 0, ...block);
      return lines;
    },
  };

  // 92. Refactoring tools
  api.refactor = {
    renameSymbol(lines, line, oldName, newName) {
      const re = new RegExp('\\b' + oldName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'g');
      lines[line] = lines[line].replace(re, newName);
      return lines;
    },
    extractFunction(lines, start, end, name) {
      const body = lines.slice(start, end + 1).join('\n');
      const params = [...new Set(body.match(/\b(\w+)\b/g) || [])].slice(0, 3);
      const fn = `function ${name}(${params.join(', ')}) {\n${body.split('\n').map(l => '  ' + l).join('\n')}\n}`;
      lines.splice(start, end - start + 1, fn);
      return lines;
    },
    extractVariable(lines, line, startCol, endCol, varName) {
      const l = lines[line];
      const expr = l.slice(startCol, endCol);
      lines.splice(line, 0, `const ${varName} = ${expr};`);
      lines[line + 1] = l.slice(0, startCol) + varName + l.slice(endCol);
      return lines;
    },
    inlineVariable(lines, line, varName) {
      const decl = lines[line].match(new RegExp(`const\\s+${varName}\\s*=\\s*(.+?);?\\s*$`));
      if (!decl) return lines;
      const val = decl[1];
      lines.splice(line, 1);
      for (let i = 0; i < lines.length; i++) {
        lines[i] = lines[i].replace(new RegExp('\\b' + varName + '\\b', 'g'), `(${val})`);
      }
      return lines;
    },
  };
  // 93. Code generation
  api.codegen = {
    interface(name, props) {
      return `interface ${name} {\n${props.map(p => `  ${p.name}: ${p.type};`).join('\n')}\n}`;
    },
    class(name, opts = {}) {
      let s = `class ${name}`;
      if (opts.extends) s += ` extends ${opts.extends}`;
      if (opts.implements) s += ` implements ${opts.implements.join(', ')}`;
      s += ' {\n';
      if (opts.constructor) s += `  constructor(${opts.constructor.params.join(', ')}) {\n${opts.constructor.body.map(l => '    ' + l).join('\n')}\n  }\n`;
      if (opts.methods) opts.methods.forEach(m => { s += `  ${m.name}(${m.params.join(', ')}) {\n${(m.body || []).map(l => '    ' + l).join('\n')}\n  }\n`; });
      s += '}';
      return s;
    },
    asyncFn(name, params) { return `async ${name}(${params.join(', ')}) {\n  // TODO: implement\n}`; },
    test(name, body) { return `test('${name}', async () => {\n${body.map(l => '  ' + l).join('\n')}\n});`; },
    importStmt(module, names) { return `import { ${names.join(', ')} } from '${module}';`; },
    exportStmt(name, isDefault = false) { return isDefault ? `export default ${name};` : `export { ${name} };`; },
  };

  // 94. Template expansion
  api.templates = {
    _store: GM.get('templates', {}),
    save(name, body) { this._store = GM.get('templates', {}); this._store[name] = body; GM.set('templates', this._store); },
    get(name) { return this._store[name] || ''; },
    list() { return Object.keys(this._store); },
    expand(name, vars = {}) {
      let t = this.get(name);
      for (const k in vars) t = t.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), vars[k]);
      return t;
    },
  };

  // 95. Boilerplate insertion
  api.boilerplate = {
    reactComponent(name) { return `import React from 'react';\n\nexport default function ${name}() {\n  return (\n    <div>\n      {/* ${name} */}\n    </div>\n  );\n}`; },
    vueComponent(name) { return `<template>\n  <div class="${name.toLowerCase()}">\n    <!-- ${name} -->\n  </div>\n</template>\n\n<script setup>\n// ${name}\n</script>`; },
    expressRoute(name) { return `// GET /${name}\napp.get('/${name}', async (req, res) => {\n  try {\n    res.json({ success: true });\n  } catch (err) {\n    res.status(500).json({ error: err.message });\n  }\n});`; },
    readme(title) { return `# ${title}\n\n## Installation\n\n\`\`\`bash\nnpm install\n\`\`\`\n\n## Usage\n\n\`\`\`javascript\n// TODO\n\`\`\`\n\n## License\n\nMIT`; },
  };

  // 96. Snippet library
  api.snippets = {
    _store: GM.get('snippets', {}),
    add(name, prefix, body, lang = 'javascript') {
      this._store = GM.get('snippets', {});
      this._store[name] = { prefix, body, lang, created: Date.now() };
      GM.set('snippets', this._store);
    },
    get(name) { return this._store[name] || null; },
    remove(name) { this._store = GM.get('snippets', {}); delete this._store[name]; GM.set('snippets', this._store); },
    list() { return Object.keys(this._store); },
    byPrefix(p) { return Object.values(this._store).filter(s => s.prefix === p); },
    search(q) {
      const ql = q.toLowerCase();
      return Object.entries(this._store).filter(([n, s]) => n.toLowerCase().includes(ql) || s.prefix.toLowerCase().includes(ql)).map(([n, s]) => ({ name: n, ...s }));
    },
    expand(name, vars = {}) {
      const s = this._store[name];
      if (!s) return '';
      let body = Array.isArray(s.body) ? s.body.join('\n') : s.body;
      for (const k in vars) body = body.replace(new RegExp(`\\$\\{${k}\\}`, 'g'), vars[k]);
      return body;
    },
  };
  // 97. Code blocks
  api.codeBlocks = {
    wrap(code, lang = '') { return `\`\`\`${lang}\n${code}\n\`\`\``; },
    parse(text) {
      const blocks = [];
      const re = /```(\w*)\n([\s\S]*?)```/g;
      let m;
      while ((m = re.exec(text)) !== null) blocks.push({ lang: m[1] || '', code: m[2].trim() });
      return blocks;
    },
    minify(code) { return code.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\s+/g, ' ').trim(); },
    format(code, indent = 2) {
      let depth = 0;
      return code.split('\n').map(line => {
        const l = line.trim();
        if (l.endsWith('}')) depth = Math.max(0, depth - 1);
        const padded = ' '.repeat(depth * indent) + l;
        if (l.endsWith('{')) depth++;
        return padded;
      }).join('\n');
    },
    lineNumbers(code) { return code.split('\n').map((l, i) => `${String(i + 1).padStart(4, ' ')} | ${l}`).join('\n'); },
    diff(a, b) {
      const al = a.split('\n'), bl = b.split('\n');
      const max = Math.max(al.length, bl.length);
      const out = [];
      for (let i = 0; i < max; i++) {
        if (al[i] === undefined) out.push('+ ' + bl[i]);
        else if (bl[i] === undefined) out.push('- ' + al[i]);
        else if (al[i] !== bl[i]) { out.push('- ' + al[i]); out.push('+ ' + bl[i]); }
        else out.push('  ' + al[i]);
      }
      return out.join('\n');
    },
  };

  // 98. Live templates
  api.liveTemplates = {
    _active: new Map(),
    register(name, body, triggers) { this._active.set(name, { body, triggers: triggers || [] }); },
    unregister(name) { this._active.delete(name); },
    list() { return [...this._active.keys()]; },
    get(name) { return this._active.get(name); },
    match(text) {
      for (const [name, t] of this._active) {
        for (const trig of t.triggers) {
          if (text.endsWith(trig) || (trig instanceof RegExp && trig.test(text))) return { name, trigger: trig };
        }

      }
      return null;
    },
    expand(name, vars = {}) {
      const t = this._active.get(name);
      if (!t) return '';
      let body = Array.isArray(t.body) ? t.body.join('\n') : t.body;
      for (const k in vars) body = body.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), vars[k]);
      return body;
    },
  };

  // 99. Macro recording
  api.macroRecord = {
    _recording: false,
    _actions: [],
    _name: '',
    start(name) { this._recording = true; this._actions = []; this._name = name; },
    record(action) { if (this._recording) this._actions.push({ ...action, t: Date.now() }); },
    stop() { this._recording = false; return { name: this._name, actions: this._actions }; },
    isRecording() { return this._recording; },
    saveToStore() {
      const data = this.stop();
      const store = GM.get('macros', {});
      store[data.name] = data;
      GM.set('macros', store);
      return data;
    },
  };

  // 100. Macro playback
  api.macroPlayback = {
    _macros: GM.get('macros', {}),
    load() { this._macros = GM.get('macros', {}); },
    list() { return Object.keys(this._macros); },
    get(name) { return this._macros[name] || null; },
    remove(name) { this._macros = GM.get('macros', {}); delete this._macros[name]; GM.set('macros', this._macros); },
    play(name, context = {}) {
      const macro = this._macros[name];
      if (!macro) return null;
      const results = [];
      let lastTime = macro.actions[0]?.t || 0;
      for (const action of macro.actions) {
        const delay = action.t - lastTime;
        results.push({ action, delay, executed: false });
        lastTime = action.t;
      }
      return { name, steps: results, totalSteps: results.length };
    },
    execute(name, handlers = {}) {
      const plan = this.play(name);
      if (!plan) return 0;
      let count = 0;
      for (const step of plan.steps) {
        const h = handlers[step.action.type];
        if (h) { h(step.action); count++; }
      }
      return count;
    },
  };

  // self-register with hub
  GM.set('module_030_init', { version: VERSION, ts: Date.now() });
  if (typeof window !== 'undefined' && window.__NEXUS_HUB__) {
    window.__NEXUS_HUB__.register({ id: MODULE_ID, version: VERSION, api });
  }
  log(`v${VERSION} loaded`);
})();