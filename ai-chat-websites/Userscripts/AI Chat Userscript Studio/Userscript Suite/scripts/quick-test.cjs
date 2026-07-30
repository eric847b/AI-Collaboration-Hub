/**
 * Quick test script to validate module registration patterns
 * Simulates a minimal runtime to catch registration issues early.
 * Usage: node scripts/quick-test.cjs
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const utils = require('./bundler-utils.cjs');

const MODULES_DIR = path.join(__dirname, '../Modules');

// console.debug('[QuickTest] Simulating module registration...\n');

const hostConsole = console;
const noop = () => {};
let timerIdCounter = 0;
const gmStore = new Map();

function normalizeRegistrationArgs(argsLike) {
  const args = Array.from(argsLike || []);

  if (args.length === 1 && args[0] && typeof args[0] === 'object') {
    return args[0];
  }

  if (args.length >= 3 && typeof args[0] === 'string' && typeof args[1] === 'string' && args[2] && typeof args[2] === 'object') {
    const [name, version, instance] = args;
    if (!instance.name) {
      instance.name = name;
    }
    if (!instance.version) {
      instance.version = version;
    }
    return instance;
  }

  return args[0];
}

class MockElement {
  constructor(tag = 'div') {
    this.tagName = String(tag).toUpperCase();
    this.children = [];
    this.style = {};
    this.dataset = {};
    this.className = '';
    this.textContent = '';
    this.value = '';
    this.type = 'text';
    this.id = '';
    this.isContentEditable = false;
    this.offsetWidth = 0;
    this.offsetHeight = 0;
    this.scrollWidth = 0;
    this.scrollHeight = 0;
    this.clientWidth = 0;
    this.clientHeight = 0;
    this.parentElement = null;
    this.classList = {
      add: noop,
      remove: noop,
      contains: () => false,
      toggle: noop
    };
    this._context = null;

    if (this.tagName === 'CANVAS') {
      this.width = 0;
      this.height = 0;
    }
  }

  addEventListener() {}

  appendChild(child) {
    this.children.push(child);
    child.parentElement = this;
    return child;
  }

  click() {}

  remove() {}

  removeAttribute() {}

  setAttribute(name, value) {
    this[name] = value;
  }

  getAttribute(name) {
    return this[name] ?? null;
  }

  querySelector() {
    return null;
  }

  querySelectorAll() {
    return [];
  }

  getClientRects() {
    return [];
  }

  focus() {}

  blur() {}

  dispatchEvent() {}

  getBoundingClientRect() {
    return { top: 0, left: 0, width: this.offsetWidth, height: this.offsetHeight };
  }

  getContext() {
    if (!this._context) {
      this._context = {
        canvas: this,
        fillRect: noop,
        strokeRect: noop,
        clearRect: noop,
        beginPath: noop,
        closePath: noop,
        moveTo: noop,
        lineTo: noop,
        arc: noop,
        rect: noop,
        fill: noop,
        stroke: noop,
        fillText: noop,
        strokeText: noop,
        measureText: () => ({ width: 0 }),
        createLinearGradient: () => ({ addColorStop: noop }),
        createRadialGradient: () => ({ addColorStop: noop }),
        createPattern: () => null,
        save: noop,
        restore: noop,
        translate: noop,
        rotate: noop,
        scale: noop,
        setTransform: noop,
        drawImage: noop,
        putImageData: noop,
        getImageData: () => ({ data: [] }),
        setLineDash: noop,
        getLineDash: () => [],
        transform: noop,
        resetTransform: noop,
        getContext: () => this._context
      };
    }

    return this._context;
  }

  toDataURL() {
    return 'data:image/png;base64,';
  }
}

const performance = {
  startTime: Date.now(),
  now: () => Date.now() - performance.startTime
};
const locationObject = { href: 'https://chatgpt.com/', hostname: 'chatgpt.com' };
const navigatorObject = { userAgent: 'quick-test', language: 'en-US' };
const historyObject = {
  pushState: noop,
  replaceState: noop
};
const storageObject = {
  getItem: () => null,
  setItem: noop,
  removeItem: noop
};
const sandboxConsole = {
  log: (...args) => hostConsole.log(...args),
  warn: (...args) => hostConsole.warn(...args),
  error: (...args) => hostConsole.error(...args),
  info: (...args) => hostConsole.info(...args),
  debug: (...args) => hostConsole.debug(...args)
};
const stableThenable = {
  then() {
    return this;
  },
  catch() {
  }
};
const lzString = {
  compress: value => String(value),
  decompress: value => String(value)
};
const documentBody = {
  appendChild: child => child,
  contains: () => false,
  removeChild: noop,
  querySelector: () => null,
  querySelectorAll: () => []
};
const documentObject = {
  addEventListener: noop,
  getElementById: id => {
    const element = id && String(id).toLowerCase().includes('chart') ? new MockElement('canvas') : new MockElement('div');
    element.id = String(id || '');
    return element;
  },
  readyState: 'loading',
  createElement: tag => new MockElement(tag),
  querySelector: () => null,
  querySelectorAll: () => [],
  head: { appendChild: noop },
  body: documentBody
};
const urlApi = {
  createObjectURL: () => 'blob:mock',
  revokeObjectURL: noop
};
const nodeApi = { ELEMENT_NODE: 1 };

function createNoopProxy() {
  const handler = {
    get: () => createNoopProxy(),
    apply: () => createNoopProxy(),
    construct: () => createNoopProxy()
  };
  return new Proxy(() => {}, handler);
}

const tf = createNoopProxy();

class Chart {
  destroy() {}
  update() {}
}

const html2canvas = () => Promise.resolve(new MockElement('canvas'));

const SovereignEngine = {
  register: noop,
  apply: () => ({})
};

const sandbox = {
  window: {
    ModuleRegistry: {
      modules: new Map(),
      register(...args) {
        const instance = normalizeRegistrationArgs(args);
        if (!instance || !instance.name || !instance.version) {
          throw new Error('Invalid module: missing name or version');
        }

        this.modules.set(instance.name, instance);
        // console.log(`  [OK] Registered: ${instance.name} v${instance.version}`);
        return true;
      },
      get(name) {
        return this.modules.get(name);
      },
      list() {
        return Array.from(this.modules.values());
      },
      getModuleCount() {
        return this.modules.size;
      },
      unregister(name) {
        return this.modules.delete(name);
      }
    },
    ConfigManager: {
      config: {},
      getConfig(moduleName) {
        const key = String(moduleName || '').toLowerCase();
        return this.config[key] ? { ...this.config[key] } : {};
      },
      getDefaultConfig: () => ({}),
      updateConfig(moduleName, settings) {
        const key = String(moduleName || '').toLowerCase();
        this.config[key] = { ...(this.config[key] || {}), ...(settings || {}) };
      },
      save: noop,
      load: () => Promise.resolve()
    },
    ChatGPTConfig: {
      get(moduleName, key) {
        const config = sandbox.window.ConfigManager.getConfig(moduleName);
        return typeof key === 'undefined' ? config : config[key];
      },
      set(moduleName, keyOrSettings, value) {
        if (keyOrSettings && typeof keyOrSettings === 'object' && !Array.isArray(keyOrSettings)) {
          sandbox.window.ConfigManager.updateConfig(moduleName, keyOrSettings);
          return;
        }

        sandbox.window.ConfigManager.updateConfig(moduleName, { [keyOrSettings]: value });
      },
      update(moduleName, settings) {
        sandbox.window.ConfigManager.updateConfig(moduleName, settings);
      }
    },
    EventEmitter: {
      _events: new Map(),
      on(event, callback) {
        if (!this._events.has(event)) {
          this._events.set(event, new Set());
        }

        this._events.get(event).add(callback);
        return () => this.off(event, callback);
      },
      off(event, callback) {
        if (this._events.has(event)) {
          this._events.get(event).delete(callback);
        }
      },
      emit(event, ...args) {
        if (this._events.has(event)) {
          this._events.get(event).forEach(callback => callback(...args));
        }
      },
      once(event, callback) {
        const wrapped = (...args) => {
          this.off(event, wrapped);
          callback(...args);
        };
        return this.on(event, wrapped);
      },
      listenerCount(event) {
        return this._events.has(event) ? this._events.get(event).size : 0;
      },
      removeAllListeners(event) {
        if (event) {
          this._events.delete(event);
        } else {
          this._events.clear();
        }
      }
    },
    ModuleHealth: {
      _metrics: new Map(),
      record(name) {
        if (!this._metrics.has(name)) {
          this._metrics.set(name, { status: 'unknown' });
        }
      },
      get(name) {
        return this._metrics.get(name);
      },
      getAll() {
        return this._metrics;
      },
      getAverage() {
        return 0;
      },
      clear(name) {
        this._metrics.delete(name);
      }
    },
    LazyLoader: {
      _loadedModules: new Map(),
      _loadingPromises: new Map(),
      loadModule() {
        return Promise.resolve(true);
      },
      isLoaded(name) {
        return this._loadedModules.has(name);
      }
    },
    ChatGPTModules: {
      register(instance, ...args) {
        return sandbox.window.ModuleRegistry.register(instance, ...args);
      },
      list() {
        return sandbox.window.ModuleRegistry.list();
      },
      get(name) {
        return sandbox.window.ModuleRegistry.get(name);
      },
      initialized: false,
      init() {
        return Promise.resolve();
      },
      executeAll() {
        return Promise.resolve();
      }
    },
    location: locationObject,
    navigator: navigatorObject,
    history: historyObject,
    addEventListener: noop,
    removeEventListener: noop,
    alert: noop,
    apiModule: {
      sendToAPI: () => stableThenable
    },
    LZString: lzString,
    expensiveOperation: () => 'mock expensive result'
  },
  console: sandboxConsole,
  performance,
  document: documentObject,
  URL: urlApi,
  Node: nodeApi,
  Element: MockElement,
  HTMLElement: MockElement,
  HTMLImageElement: MockElement,
  HTMLAnchorElement: MockElement,
  location: locationObject,
  navigator: navigatorObject,
  history: historyObject,
  MutationObserver: class MutationObserver {
    constructor(callback) {
      this.callback = callback;
    }

    observe() {}

    disconnect() {}

    takeRecords() {
      return [];
    }
  },
  IntersectionObserver: class IntersectionObserver {
    constructor(callback) {
      this.callback = callback;
    }

    observe() {}

    unobserve() {}

    disconnect() {}
  },
  Blob: class Blob {
    constructor(parts, options = {}) {
      this.parts = parts;
      this.type = options.type || '';
    }
  },
  fetch: () => Promise.resolve({
    ok: true,
    json: () => Promise.resolve({})
  }),
  alert: noop,
  LZString: lzString,
  expensiveOperation: () => 'mock expensive result',
  apiModule: {
    sendToAPI: () => stableThenable
  },
  GM: {
    getValue: (key, defaultValue = null) => gmStore.has(key) ? gmStore.get(key) : defaultValue,
    setValue: (key, value) => gmStore.set(key, value)
  },
  GM_getValue: (key, defaultValue = null) => gmStore.has(key) ? gmStore.get(key) : defaultValue,
  GM_setValue: (key, value) => gmStore.set(key, value),
  GM_deleteValue: key => gmStore.delete(key),
  GM_log: noop,
  GM_addStyle: noop,
  GM_notification: noop,
  GM_openInTab: noop,
  GM_registerMenuCommand: noop,
  GM_setClipboard: noop,
  GM_listValues: () => Array.from(gmStore.keys()),
  GM_info: {},
  GM_xmlhttpRequest: noop,
  importScripts: noop,
  setTimeout: callback => {
    if (typeof callback === 'function') {
      callback();
    }
    timerIdCounter += 1;
    return timerIdCounter;
  },
  clearTimeout: noop,
  setInterval: callback => {
    if (typeof callback === 'function') {
      callback();
    }
    timerIdCounter += 1;
    return timerIdCounter;
  },
  clearInterval: noop,
  localStorage: storageObject,
  sessionStorage: storageObject
};

sandbox.window.console = sandboxConsole;
sandbox.window.performance = performance;
sandbox.window.document = documentObject;
sandbox.window.URL = urlApi;
sandbox.window.Node = nodeApi;
sandbox.window.Element = MockElement;
sandbox.window.HTMLElement = MockElement;
sandbox.window.HTMLImageElement = MockElement;
sandbox.window.HTMLAnchorElement = MockElement;
sandbox.window.Blob = sandbox.Blob;
sandbox.window.location = locationObject;
sandbox.window.navigator = navigatorObject;
sandbox.window.history = historyObject;
sandbox.window.fetch = sandbox.fetch;
sandbox.window.alert = sandbox.alert;
sandbox.window.apiModule = sandbox.apiModule;
sandbox.window.LZString = lzString;
sandbox.window.expensiveOperation = sandbox.expensiveOperation;
sandbox.window.GM = sandbox.GM;
sandbox.window.localStorage = sandbox.localStorage;
sandbox.window.sessionStorage = sandbox.sessionStorage;
sandbox.window.setTimeout = sandbox.setTimeout;
sandbox.window.clearTimeout = sandbox.clearTimeout;
sandbox.window.setInterval = sandbox.setInterval;
sandbox.window.clearInterval = sandbox.clearInterval;
sandbox.window.importScripts = sandbox.importScripts;
sandbox.window.IntersectionObserver = sandbox.IntersectionObserver;
sandbox.window.SovereignEngine = SovereignEngine;
sandbox.window.Chart = Chart;
sandbox.window.tf = tf;
sandbox.window.html2canvas = html2canvas;
sandbox.window.globalThis = sandbox.window;
sandbox.window.self = sandbox.window;
sandbox.globalThis = sandbox.window;
sandbox.self = sandbox.window;

sandbox.SovereignEngine = SovereignEngine;
sandbox.Chart = Chart;
sandbox.tf = tf;
sandbox.html2canvas = html2canvas;

function resetSandboxState() {
  sandbox.window.ModuleRegistry.modules = new Map();
  sandbox.window.EventEmitter._events = new Map();
  sandbox.window.ModuleHealth._metrics = new Map();
  sandbox.window.LazyLoader._loadedModules = new Map();
  sandbox.window.LazyLoader._loadingPromises = new Map();
  sandbox.window.ConfigManager.config = {};
  sandbox.window.ChatGPTModules.initialized = false;
  timerIdCounter = 0;
  gmStore.clear();
}

function runQuickTest(options = {}) {
  const fsImpl = options.fs || fs;
  const logger = options.logger || console;
  const modulesDir = options.modulesDir || MODULES_DIR;
  const moduleFiles = options.moduleFiles || utils.getModuleFilesRecursive(modulesDir);
  const pathImpl = options.path || path;
  const performanceImpl = options.performance || performance;
  const utilsImpl = options.utils || utils;
  const vmImpl = options.vm || vm;

  if (moduleFiles.length === 0) {
    logger.warn('[QuickTest] No modules found');
    return {
      exitCode: 0,
      failed: 0,
      failures: [],
      passed: 0,
      performanceMetrics: []
    };
  }

  let passed = 0;
  let failed = 0;
  const failures = [];
  const performanceMetrics = [];

  moduleFiles.forEach(filePath => {
    resetSandboxState();
    const fileName = pathImpl.basename(filePath);
    const startTime = performanceImpl.now();

    try {
      const content = fsImpl.readFileSync(filePath, 'utf-8');
      const code = utilsImpl.extractCode(content);
      const context = vmImpl.createContext(sandbox);

      vmImpl.runInContext(code, context, { filename: fileName, timeout: 5000 });
      const loadTime = performanceImpl.now() - startTime;
      performanceMetrics.push({ fileName, loadTime, status: 'passed' });
      passed += 1;
    } catch (err) {
      const loadTime = performanceImpl.now() - startTime;
      failures.push({ fileName, message: err && err.message ? err.message : String(err), loadTime });
      performanceMetrics.push({ fileName, loadTime, status: 'failed' });
      failed += 1;
    }
  });

  logger.info(`[QuickTest] Results: ${passed} passed, ${failed} failed`);

  if (performanceMetrics.length > 0) {
    const avgLoadTime = performanceMetrics.reduce((sum, metric) => sum + metric.loadTime, 0) / performanceMetrics.length;
    const maxLoadTime = Math.max(...performanceMetrics.map(metric => metric.loadTime));
    const minLoadTime = Math.min(...performanceMetrics.map(metric => metric.loadTime));
    logger.info(`[QuickTest] Performance: Avg ${avgLoadTime.toFixed(2)}ms, Min ${minLoadTime.toFixed(2)}ms, Max ${maxLoadTime.toFixed(2)}ms`);
  }

  if (failed > 0) {
    failures.forEach(failure => {
      logger.error(`  [ERROR] ${failure.fileName} (${failure.loadTime.toFixed(2)}ms)`);
      logger.error(`          ${failure.message}`);
    });
    logger.error('[QuickTest] FAILED');
    return {
      exitCode: 1,
      failed,
      failures,
      passed,
      performanceMetrics
    };
  }

  logger.info('[QuickTest] PASSED');
  return {
    exitCode: 0,
    failed,
    failures,
    passed,
    performanceMetrics
  };
}

module.exports = {
  MockElement,
  normalizeRegistrationArgs,
  resetSandboxState,
  runQuickTest
};

if (require.main === module) {
  const result = runQuickTest();

  if (result.exitCode !== 0) {
    process.exit(result.exitCode);
  }
}
