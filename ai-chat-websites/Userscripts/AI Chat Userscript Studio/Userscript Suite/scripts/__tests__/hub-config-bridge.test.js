const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { extractCode } = require('../bundler-utils');

const hubPath = path.join(__dirname, '../../00-hub.user.js');

function loadHub(overrides = {}) {
  const source = fs.readFileSync(hubPath, 'utf8');
  const code = extractCode(source);
  const gmStore = new Map();

  const sandbox = {
    console: {
      log: () => {},
      warn: () => {},
      error: () => {},
      info: () => {}
    },
    setTimeout: fn => {
      if (typeof fn === 'function') fn();
      return 1;
    },
    clearTimeout: () => {},
    setInterval: fn => {
      if (typeof fn === 'function') fn();
      return 1;
    },
    clearInterval: () => {},
    performance: {
      memory: {
        usedJSHeapSize: 0,
        totalJSHeapSize: 0,
        jsHeapSizeLimit: 0
      },
      now: () => Date.now()
    },
    document: {
      readyState: 'complete',
      addEventListener: () => {},
      createElement: () => ({
        set src(value) {
          this._src = value;
        },
        set async(value) {
          this._async = value;
        }
      }),
      head: { appendChild: () => {} }
    },
    localStorage: {
      getItem: key => (gmStore.has(key) ? gmStore.get(key) : null),
      setItem: (key, value) => {
        gmStore.set(key, value);
      }
    },
    GM_getValue: key => gmStore.get(key),
    GM_setValue: (key, value) => {
      gmStore.set(key, value);
    },
    GM_registerMenuCommand: () => {},
    GM_info: {
      script: {
        name: 'AI Chat Userscript Suite',
        version: '1.1.0'
      }
    },
    addEventListener: () => {},
    removeEventListener: () => {},
    window: null
  };

  Object.assign(sandbox, overrides);
  sandbox.window = sandbox;

  const context = vm.createContext(sandbox);
  vm.runInContext(code, context, { filename: path.basename(hubPath) });
  return { sandbox, gmStore };
}

describe('hub config bridge', () => {
  test('ChatGPTConfig.get proxies ConfigManager defaults and stored values', () => {
    const { sandbox } = loadHub();

    sandbox.ConfigManager.set('automation', { maxRetries: 9 });

    expect(sandbox.ChatGPTConfig.get('automation', 'maxRetries')).toBe(9);
    expect(sandbox.ChatGPTConfig.get('automation').delayAfterApply).toBe(2000);
  });

  test('ChatGPTConfig.set supports key/value updates', () => {
    const { sandbox } = loadHub();

    sandbox.ChatGPTConfig.set('ui', 'theme', 'dark');

    expect(sandbox.ConfigManager.getConfig('ui').theme).toBe('dark');
  });

  test('ChatGPTConfig.set supports object updates', () => {
    const { sandbox } = loadHub();

    sandbox.ChatGPTConfig.set('automation', {
      maxRetries: 7,
      delayAfterSkip: 750
    });

    const config = sandbox.ConfigManager.getConfig('automation');
    expect(config.maxRetries).toBe(7);
    expect(config.delayAfterSkip).toBe(750);
    expect(config.delayAfterApply).toBe(2000);
  });

  test('ConfigManager notifies legacy module names case-insensitively', () => {
    const { sandbox } = loadHub();
    const updates = [];
    const moduleInstance = {
      name: 'Automation',
      version: '1.0.0',
      onConfigUpdate(settings) {
        updates.push(settings);
      }
    };

    sandbox.ChatGPTModules.register(moduleInstance);
    sandbox.ChatGPTConfig.set('automation', 'maxRetries', 5);

    expect(updates).toEqual([{ maxRetries: 5 }]);
  });
});