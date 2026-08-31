// ==UserScript==
// @name         0. Hub
// @namespace    http://tampermonkey.net/
// @version      2026.07.04.1
// @description  Universal Hub - Central hub for managing userscript modules on ANY webpage with enterprise-grade error handling, DI, performance monitoring, and modular architecture
// @author       AI RMD
// @license      MIT
// @match        *://*/*
// @include      *
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_deleteValue
// @grant        GM_registerMenuCommand
// @grant        GM_unregisterMenuCommand
// @grant        GM_xmlhttpRequest
// @grant        GM_addStyle
// @grant        GM_notification
// @grant        GM_download
// @grant        GM_info
// @grant        GM_openInTab
// @grant        GM_setClipboard
// @connect      *
// ==/UserScript==

// ==================== ABORTCONTROLLER POLYFILL ====================
if (typeof AbortController === 'undefined') {
  class AbortController {
    constructor() {
      this.signal = { aborted: false, addEventListener: () => {}, removeEventListener: () => {} };
    }
    abort() { this.signal.aborted = true; }
  }
  if (typeof globalThis !== 'undefined') globalThis.AbortController = AbortController;
  if (typeof global !== 'undefined') global.AbortController = AbortController;
  if (typeof window !== 'undefined') window.AbortController = AbortController;
}

// ==================== MODULE REGISTRY ====================
const ModuleRegistry = {
  modules: new Map(),
  loadOrder: [],
  initializationPromise: null,
  isReady: false,

  register(instance) {
    if (!instance || !instance.name) {
      console.warn('[Hub] Invalid module registration:', instance);
      return false;
    }

    const name = instance.name;
    if (this.modules.has(name)) {
      console.warn(`[Hub] Module "${name}" already registered, skipping duplicate`);
      return false;
    }

    this.modules.set(name, {
      instance,
      version: instance.version || '0.0.0',
      dependencies: Array.isArray(instance.dependencies) ? instance.dependencies : [],
      critical: Boolean(instance.critical),
      loaded: false,
      error: null
    });

    console.log(`[Hub] Registered module: ${name} v${instance.version}`);
    return true;
  },

  list() {
    return Array.from(this.modules.keys());
  },

  get(name) {
    return this.modules.get(name)?.instance || null;
  },

  async initializeAll() {
    if (this.initializationPromise) return this.initializationPromise;

    this.initializationPromise = (async () => {
      try {
        const sorted = this.resolveDependencies();
        console.log(`[Hub] Initializing ${sorted.length} modules in dependency order`);

        for (const name of sorted) {
          const mod = this.modules.get(name);
          if (!mod) continue;

          try {
            if (typeof mod.instance.init === 'function') {
              const result = mod.instance.init();
              if (result && typeof result.then === 'function') {
                await result;
              }
            }
            mod.loaded = true;
            console.log(`[Hub] Initialized: ${name}`);
          } catch (err) {
            mod.error = err;
            console.error(`[Hub] Failed to initialize ${name}:`, err);
            if (mod.critical) throw err;
          }
        }

        this.isReady = true;
        console.log('[Hub] All modules initialized');
        return true;
      } catch (err) {
        console.error('[Hub] Initialization aborted:', err);
        throw err;
      }
    })();

    return this.initializationPromise;
  },

  resolveDependencies() {
    const sorted = [];
    const visited = new Set();
    const visiting = new Set();

    const visit = (name) => {
      if (visited.has(name)) return;
      if (visiting.has(name)) {
        throw new Error(`[Hub] Circular dependency detected: ${name}`);
      }

      const mod = this.modules.get(name);
      if (!mod) {
        console.warn(`[Hub] Missing dependency: ${name}`);
        return;
      }

      visiting.add(name);

      for (const dep of mod.dependencies) {
        if (!this.modules.has(dep)) {
          console.warn(`[Hub] Unresolved dependency: ${dep} (required by ${name})`);
          continue;
        }
        visit(dep);
      }

      visiting.delete(name);
      visited.add(name);
      sorted.push(name);
    };

    for (const name of this.modules.keys()) {
      visit(name);
    }

    return sorted;
  },

  async executeAll() {
    if (!this.isReady) await this.initializeAll();

    const results = [];
    for (const name of this.list()) {
      const mod = this.modules.get(name);
      if (!mod?.loaded) continue;

      try {
        if (typeof mod.instance.execute === 'function') {
          const result = mod.instance.execute();
          if (result && typeof result.then === 'function') {
            await result;
          }
          results.push({ name, success: true });
        }
      } catch (err) {
        results.push({ name, success: false, error: err });
      }
    }
    return results;
  },

  destroyAll() {
    for (const name of this.list()) {
      const mod = this.modules.get(name);
      if (!mod?.loaded) continue;

      try {
        if (typeof mod.instance.destroy === 'function') {
          mod.instance.destroy();
        }
      } catch (err) {
        console.error(`[Hub] Error destroying ${name}:`, err);
      }
    }
    this.isReady = false;
    this.initializationPromise = null;
  }
};

window.ModuleRegistry = ModuleRegistry;
window.ChatGPTModules = window.ChatGPTModules || ModuleRegistry;

// ==================== CONFIG MANAGER ====================
const ConfigManager = {
  _config: null,
  _listeners: new Map(),
  _legacyModules: new Map(),

  _ensureLoaded() {
    if (!this._config) {
      this._config = this._loadFromStorage();
    }
    return this._config;
  },

  _loadFromStorage() {
    try {
      const saved = GM_getValue('hubConfig', null);
      return saved ? { ...DEFAULT_CONFIG, ...(typeof saved === 'string' ? JSON.parse(saved) : saved) } : { ...DEFAULT_CONFIG };
    } catch {
      return { ...DEFAULT_CONFIG };
    }
  },

  _persist() {
    try {
      GM_setValue('hubConfig', JSON.stringify(this._config));
    } catch (e) {
      console.error('[Hub] Config persistence failed:', e);
    }
  },

  get(key, property) {
    const config = this._ensureLoaded();
    if (!key) return { ...config };
    const defaults = DEFAULT_CONFIG[key] || {};
    const section = { ...defaults, ...(config[key] || {}) };
    if (typeof property === 'undefined') return section;
    return section[property];
  },

  set(section, propertyOrValue, maybeValue) {
    const config = this._ensureLoaded();
    if (typeof section === 'object' && section !== null) {
      for (const key of Object.keys(section)) {
        const defaults = DEFAULT_CONFIG[key] || {};
        config[key] = { ...defaults, ...(config[key] || {}), ...section[key] };
      }
      this._persist();
      this._notify(section, propertyOrValue);
    } else if (typeof propertyOrValue === 'object' && propertyOrValue !== null && maybeValue === undefined) {
      const defaults = DEFAULT_CONFIG[section] || {};
      config[section] = { ...defaults, ...(config[section] || {}), ...propertyOrValue };
      this._persist();
      this._notify(section, propertyOrValue);
    } else if (typeof maybeValue !== 'undefined') {
      if (!config[section]) config[section] = {};
      config[section][propertyOrValue] = maybeValue;
      this._persist();
      this._notify(section, { [propertyOrValue]: maybeValue });
    } else {
      config[section] = propertyOrValue;
      this._persist();
      this._notify(section, propertyOrValue);
    }
  },

  registerLegacyModule(name, callback) {
    const lower = String(name).toLowerCase();
    this._legacyModules.set(lower, callback);
    return this;
  },

  _notify(key, value) {
    const listeners = this._listeners.get(key);
    if (listeners) {
      listeners.forEach(cb => {
        try { cb(value); } catch (e) { console.error('[Hub] Config listener error:', e); }
      });
    }

    const legacy = this._legacyModules.get(String(key).toLowerCase());
    if (legacy && typeof legacy.onConfigUpdate === 'function') {
      try { legacy.onConfigUpdate(value); } catch (e) { console.error('[Hub] Legacy module notify error:', e); }
    }
  },

  updateConfig(moduleName, settings) {
    if (!this._config.moduleOverrides) {
      this._config.moduleOverrides = {};
    }
    this._config.moduleOverrides[moduleName] = {
      ...(this._config.moduleOverrides[moduleName] || {}),
      ...settings
    };
    this._persist();
    this._notify(moduleName, settings);
  },

  getConfig(moduleName) {
    const defaults = DEFAULT_CONFIG[moduleName] || {};
    const stored = this._ensureLoaded()[moduleName] || {};
    return { ...defaults, ...stored };
  },

  getDefaultConfig() {
    return { ...DEFAULT_CONFIG };
  },

  onChange(key, callback) {
    if (!this._listeners.has(key)) {
      this._listeners.set(key, new Set());
    }
    this._listeners.get(key).add(callback);
  },

  reset() {
    this._config = { ...DEFAULT_CONFIG };
    this._persist();
  },

  export() {
    return JSON.stringify(this._ensureLoaded(), null, 2);
  },

  import(json) {
    try {
      const parsed = JSON.parse(json);
      this._config = { ...DEFAULT_CONFIG, ...parsed };
      this._persist();
      return true;
    } catch {
      return false;
    }
  }
};

window.ConfigManager = ConfigManager;
window.ChatGPTConfig = ConfigManager;

// Bridge ModuleRegistry legacy module notifications to ConfigManager.
// Accepts every registration convention so a module only has to call
// register() once and BOTH ends (registry + ConfigManager) update
// automatically:
//   register(instance)
//   register(name, version, moduleOrPayload [, dependencies])   (legacy/helper)
function normalizeRegisterArgs(args) {
  const first = args[0];
  if (typeof first !== 'string') return first;
  const payload = (args[2] && typeof args[2] === 'object') ? args[2] : {};
  return Object.assign({}, payload, {
    name: first,
    version: args[1] || payload.version || '0.0.0',
    dependencies: Array.isArray(args[3])
      ? args[3]
      : Array.isArray(payload.dependencies) ? payload.dependencies : []
  });
}
const _originalRegister = ModuleRegistry.register.bind(ModuleRegistry);
ModuleRegistry.register = function() {
  const instance = normalizeRegisterArgs(arguments);
  const result = _originalRegister(instance);
  if (result && instance && typeof instance.onConfigUpdate === 'function') {
    ConfigManager.registerLegacyModule(instance.name, instance);
  }
  return result;
};
const DEFAULT_CONFIG = {
  hub: { theme: 'system', debugMode: false },
  automation: { infinityMode: false, delayAfterApply: 2000, delayAfterSkip: 500, maxRetries: 3 },
  errorHandling: { maxRetries: 3, retryDelay: 1000 },
  ui: { theme: 'light' },
  debugMode: false,
  theme: 'system',
  language: 'en',
  enableCache: true,
  cacheExpiration: 3600,
  maxRetries: 3,
  retryDelay: 1000,
  enablePerformanceMetrics: true,
  enableErrorReporting: true,
  moduleOverrides: {}
};

const ServiceContainer = {
  services: new Map(),
  singletons: new Map(),
  factories: new Map(),

  register(name, factory, options = {}) {
    if (this.services.has(name)) {
      throw new Error(`[Hub] Service "${name}" already registered`);
    }

    this.services.set(name, { factory, singleton: options.singleton !== false });
    if (options.singleton !== false) {
      this.singletons.set(name, null);
    }
    return this;
  },

  resolve(name) {
    if (!this.services.has(name)) {
      throw new Error(`[Hub] Unknown service: ${name}`);
    }

    const service = this.services.get(name);
    if (service.singleton) {
      if (this.singletons.get(name) === null) {
        this.singletons.set(name, service.factory(this));
      }
      return this.singletons.get(name);
    }

    return service.factory(this);
  },

  reset() {
    this.singletons.clear();
  }
};

window.ServiceContainer = ServiceContainer;

// ==================== ERROR HANDLER ====================
const ErrorHandler = {
  retry(fn, options = {}) {
    const maxRetries = options.maxRetries ?? ConfigManager.get('maxRetries');
    const baseDelay = options.baseDelay ?? ConfigManager.get('retryDelay');
    const backoffFactor = options.backoffFactor ?? 2;

    let lastError;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const result = fn();
        if (result && typeof result.then === 'function') {
          return result.then(r => { if (attempt > 1) console.log(`[Hub] Retry succeeded on attempt ${attempt}`); return r; });
        }
        if (attempt > 1) console.log(`[Hub] Retry succeeded on attempt ${attempt}`);
        return result;
      } catch (error) {
        lastError = error;
        console.warn(`[Hub] Attempt ${attempt} failed:`, error);
        if (attempt < maxRetries) {
          const delay = baseDelay * Math.pow(backoffFactor, attempt - 1);
          ErrorHandler.delay(delay);
        }
      }
    }

    throw lastError;
  },

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  },

  circuitBreaker(fn, options = {}) {
    const threshold = options.threshold || 5;
    const timeout = options.timeout || 60000;
    let failures = 0;
    let lastFailure = null;
    let open = false;

    return async (...args) => {
      if (open) {
        if (Date.now() - lastFailure > timeout) {
          open = false;
          failures = 0;
        } else {
          throw new Error('[Hub] Circuit breaker is open');
        }
      }

      try {
        const result = fn(...args);
        if (result && typeof result.then === 'function') {
          return result.then(r => { failures = 0; return r; });
        }
        failures = 0;
        return result;
      } catch (err) {
        failures++;
        lastFailure = Date.now();
        if (failures >= threshold) open = true;
        throw err;
      }
    };
  },

  wrap(fn, onError) {
    return async (...args) => {
      try {
        const result = fn(...args);
        if (result && typeof result.then === 'function') {
          return result.catch(err => { onError(err, ...args); throw err; });
        }
        return result;
      } catch (err) {
        onError(err, ...args);
        throw err;
      }
    };
  }
};

window.ErrorHandler = ErrorHandler;

// ==================== PERFORMANCE METRICS ====================
const PerformanceMetrics = {
  marks: new Map(),
  measures: new Map(),
  counters: new Map(),

  mark(name) {
    this.marks.set(name, Date.now());
  },

  measure(name, startMark) {
    const start = this.marks.get(startMark) || Date.now();
    const duration = Date.now() - start;
    if (!this.measures.has(name)) {
      this.measures.set(name, []);
    }
    this.measures.get(name).push(duration);
    return duration;
  },

  increment(key, amount = 1) {
    const current = this.counters.get(key) || 0;
    this.counters.set(key, current + amount);
  },

  getMetrics() {
    const result = {};
    for (const [key, values] of this.measures) {
      const sorted = [...values].sort((a, b) => a - b);
      result[key] = {
        count: sorted.length,
        total: sorted.reduce((a, b) => a + b, 0),
        avg: sorted.reduce((a, b) => a + b, 0) / sorted.length,
        min: sorted[0],
        max: sorted[sorted.length - 1],
        p50: sorted[Math.floor(sorted.length * 0.5)],
        p95: sorted[Math.floor(sorted.length * 0.95)]
      };
    }
    return result;
  },

  snapshot() {
    return {
      timestamp: new Date().toISOString(),
      counters: Object.fromEntries(this.counters),
      metrics: this.getMetrics()
    };
  },

  reset() {
    this.marks.clear();
    this.measures.clear();
    this.counters.clear();
  }
};

window.PerformanceMetrics = PerformanceMetrics;

// ==================== RESILIENCE METRICS ====================
const ResilienceMetrics = {
  events: [],
  summaries: new Map(),

  record(event) {
    const entry = {
      timestamp: event.timestamp || Date.now(),
      moduleName: event.moduleName || 'unknown',
      attempt: event.detail?.attempt || 0,
      maxRetries: event.detail?.maxRetries || 0,
      delayMs: event.detail?.delayMs || 0,
      degraded: Boolean(event.detail?.degraded)
    };
    this.events.push(entry);

    if (!this.summaries.has(entry.moduleName)) {
      this.summaries.set(entry.moduleName, { retries: 0, successes: 0, failures: 0, degraded: 0, totalDelayMs: 0 });
    }
    const summary = this.summaries.get(entry.moduleName);
    summary.retries += 1;
    summary.totalDelayMs += entry.delayMs;
    if (entry.degraded) summary.degraded += 1;
  },

  getSummary() {
    const result = {};
    for (const [name, data] of this.summaries) {
      result[name] = { ...data, avgDelayMs: data.retries ? data.totalDelayMs / data.retries : 0 };
    }
    return result;
  },

  getEvents(moduleName) {
    if (!moduleName) return this.events.slice(-200);
    return this.events.filter(e => e.moduleName === moduleName).slice(-200);
  },

  reset() {
    this.events = [];
    this.summaries.clear();
  }
};

window.ResilienceMetrics = ResilienceMetrics;

// Defer EventBus subscription until after EventBus is defined
const _subscribeResilienceMetric = (bus) => {
  if (bus && typeof bus.on === 'function') {
    bus.on('resilience:metric', payload => {
      try { ResilienceMetrics.record(payload); } catch {}
    });
  }
};

window.addEventListener('HubResponse', evt => {
  try {
    if (evt.detail && evt.detail.type === 'resilienceMetric') {
      ResilienceMetrics.record(evt.detail);
    }
  } catch {}
});

// ==================== PLATFORM ADAPTERS ====================
const PlatformAdapters = {
  chatgpt: {
    async sendMessage(text) {
      if (window.chatgpt && typeof window.chatgpt.sendMessage === 'function') {
        return window.chatgpt.sendMessage(text);
      }
      throw new Error('ChatGPT adapter not available');
    },
    async getLastReply() {
      if (window.chatgpt && typeof window.chatgpt.getLastReply === 'function') {
        return window.chatgpt.getLastReply();
      }
      return '';
    }
  },

  claude: {
    async sendMessage(text) {
      const adapter = window.ChatGPTUtils?.chatAdapter;
      if (adapter && typeof adapter.sendMessage === 'function') {
        return adapter.sendMessage(text);
      }
      throw new Error('Claude adapter not available');
    },
    async getLastReply() {
      const adapter = window.ChatGPTUtils?.chatAdapter;
      if (adapter && typeof adapter.getLastReply === 'function') {
        return adapter.getLastReply();
      }
      return '';
    }
  },

  getCurrent() {
    const site = window.ChatGPTUtils?.site;
    if (!site) return null;
    const map = {
      chatgpt: this.chatgpt,
      claude: this.claude,
      poe: this.chatgpt,
      perplexity: this.chatgpt,
      gemini: this.chatgpt,
      copilot: this.chatgpt,
      mistral: this.chatgpt
    };
    return map[site.id] || null;
  }
};

window.PlatformAdapters = PlatformAdapters;

// ==================== EVENT BUS ====================
const EventBus = {
  _listeners: new Map(),

  on(event, callback) {
    if (!this._listeners.has(event)) {
      this._listeners.set(event, new Set());
    }
    this._listeners.get(event).add(callback);
    return () => this.off(event, callback);
  },

  off(event, callback) {
    const listeners = this._listeners.get(event);
    if (listeners) {
      listeners.delete(callback);
    }
  },

  emit(event, payload) {
    const listeners = this._listeners.get(event);
    if (listeners) {
      listeners.forEach(cb => {
        try { cb(payload); } catch (e) { console.error(`[Hub] Event error (${event}):`, e); }
      });
    }
  },

  once(event, callback) {
    const wrapped = (payload) => {
      callback(payload);
      this.off(event, wrapped);
    };
    this.on(event, wrapped);
  }
};

window.EventBus = EventBus;

// Subscribe to resilience metrics now that EventBus is defined
_subscribeResilienceMetric(EventBus);

// ==================== THEME MANAGER ====================
const ThemeManager = {
  _theme: 'system',
  _listeners: new Set(),

  init() {
    try {
      const saved = GM_getValue ? GM_getValue('hubTheme', 'system') : 'system';
      this._theme = saved;
      this.apply();
    } catch {}
  },

  getTheme() {
    return this._theme;
  },

  setTheme(theme) {
    this._theme = theme;
    try { if (GM_setValue) GM_setValue('hubTheme', theme); } catch {}
    this.apply();
    this._notify();
  },

  apply() {
    const root = document.documentElement;
    const isDark = this._theme === 'dark' || (this._theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    root.setAttribute('data-hub-theme', isDark ? 'dark' : 'light');
  },

  onChange(cb) {
    this._listeners.add(cb);
    return () => this._listeners.delete(cb);
  },

  _notify() {
    this._listeners.forEach(cb => { try { cb(this._theme); } catch {} });
  }
};

window.ThemeManager = ThemeManager;

// ==================== MODULE REGISTRATION HELPERS ====================
/**
 * Register a module instance or factory with the Hub ModuleRegistry.
 * Prefer passing a fully constructed instance. If `name`/`version` are omitted,
 * they are read from the instance when available.
 * @param {Object} options
 * @param {string} [options.name]
 * @param {string} [options.version]
 * @param {Object} [options.instance]
 * @param {Function} [options.factory]
 * @param {string[]} [options.dependencies]
 * @param {boolean} [options.critical=false]
 * @returns {boolean}
 */
function registerHubModule(options = {}) {
  const registry = window.ModuleRegistry;
  if (!registry || typeof registry.register !== 'function') {
    return false;
  }

  let instance = options.instance;
  if (!instance && typeof options.factory === 'function') {
    instance = options.factory();
  }
  if (!instance) {
    console.warn('[Hub] registerHubModule: no instance or factory provided');
    return false;
  }

  const name = options.name || (instance && instance.name) || null;
  const version = options.version || (instance && instance.version) || '0.0.0';
  const dependencies = Array.isArray(options.dependencies) ? options.dependencies : (Array.isArray(instance && instance.dependencies) ? instance.dependencies : []);
  const critical = Boolean(options.critical !== undefined ? options.critical : (instance && instance.critical));

  if (!name) {
    console.warn('[Hub] registerHubModule: module name is required');
    return false;
  }

  const payload = {
    ...instance,
    name,
    version,
    dependencies,
    critical
  };

  return registry.register(name, version, payload, dependencies);
}

/**
 * Create a standard module object and register it with the Hub.
 * @param {Object} params
 * @returns {Object}
 */
function createStandardModule(params = {}) {
  const instance = {
    name: params.name || 'UnnamedModule',
    version: params.version || '0.0.0',
    dependencies: Array.isArray(params.dependencies) ? params.dependencies : [],
    critical: Boolean(params.critical),
    state: params.state || { initialized: false },
    init() {
      this.state.initialized = true;
      console.log(`[${this.name}] Initialized`);
      return true;
    },
    destroy() {
      this.state.initialized = false;
      console.log(`[${this.name}] Destroyed`);
    }
  };

  if (typeof params.onInit === 'function') {
    instance.init = function wrappedInit() {
      this.state.initialized = true;
      params.onInit();
      console.log(`[${this.name}] Initialized`);
      return true;
    };
  }

  if (typeof params.onDestroy === 'function') {
    instance.destroy = function wrappedDestroy() {
      this.state.initialized = false;
      params.onDestroy();
      console.log(`[${this.name}] Destroyed`);
    };
  }

  registerHubModule({ instance });
  return instance;
}

window.registerHubModule = registerHubModule;
window.createStandardModule = createStandardModule;

// ==================== MODULE LOADER ====================
const ModuleLoader = {
  async loadFromDOM() {
    PerformanceMetrics.mark('moduleLoadStart');
    const modules = [];

    document.querySelectorAll('script[data-module]').forEach(script => {
      try {
        const code = script.textContent;
        const fn = new Function(code);
        const wrapped = fn();
        if (wrapped && typeof wrapped.then === 'function') {
          modules.push(wrapped.catch(err => console.error('[Hub] Module load error:', err)));
        }
      } catch (e) {
        console.error('[Hub] Failed to load DOM module:', e);
      }
    });

    await Promise.all(modules);
    PerformanceMetrics.measure('moduleLoad', 'moduleLoadStart');
    return ModuleRegistry.list();
  },

  async loadFromURL(url) {
    PerformanceMetrics.mark('moduleFetchStart');
    try {
      const response = await fetch(url);
      const code = await response.text();
      const fn = new Function(code);
      const result = fn();
      if (result && typeof result.then === 'function') {
        await result;
      }
      PerformanceMetrics.measure('moduleFetch', 'moduleFetchStart');
      return true;
    } catch (e) {
      console.error('[Hub] Failed to load module from URL:', e);
      return false;
    }
  }
};

window.ModuleLoader = ModuleLoader;

// ==================== HUB INITIALIZATION ====================
async function initializeHub() {
  PerformanceMetrics.mark('hubInit');

  try {
    await ModuleRegistry.initializeAll();
    PerformanceMetrics.measure('hubInit', 'hubInit');

    if (ConfigManager.get('enablePerformanceMetrics')) {
      console.log('[Hub] Performance snapshot:', PerformanceMetrics.snapshot());
    }

    console.log('[Hub] Initialization complete');
  } catch (err) {
    console.error('[Hub] Critical initialization error:', err);
    if (typeof GM_notification === 'function') {
      GM_notification('Hub initialization failed. Check console.', 'Userscript Suite Error');
    }
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeHub);
} else {
  initializeHub();
}

// ==================== LEGACY ABORTCONTROLLER COMPAT ====================
// Preserved for test compatibility - actual AbortController is now polyfilled at top
window.__abortControllerCompat = {};

console.log('ChatGPT Hub loaded');