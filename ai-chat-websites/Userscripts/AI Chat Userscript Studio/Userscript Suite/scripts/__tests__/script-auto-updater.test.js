const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { extractCode } = require('../bundler-utils');

 
const modulePath = (function() {
  const modulesDir = path.join(__dirname, '../../Modules');
  const matches = [];
  const walk = (dir) => {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(fullPath);
      else if (entry.isFile() && (entry.name === '07-script-auto-updater.module.user.js')) matches.push(fullPath);
    }
  };
  walk(modulesDir);
  return matches[0] || path.join(modulesDir, '07-script-auto-updater.module.user.js');
})();

function loadAutoUpdater(overrides = {}) {
  const source = fs.readFileSync(modulePath, 'utf8');
  const code = extractCode(source);
  const notifications = [];
  const errors = [];
  const consoleErrors = [];
  const registered = [];

  const sandbox = {
    console: {
      log: () => {},
      warn: () => {},
      error: (...args) => {
        consoleErrors.push(args);
      }
    },
    setInterval: () => 1,
    clearInterval: () => {},
    setTimeout,
    clearTimeout,
    Promise,
    Error,
    AggregateError,
    performance: { now: () => 100 },
    globalThis: null
  };

  sandbox.window = sandbox;
  sandbox.ChatGPTModules = {
    register(instance) {
      registered.push(instance);
      return true;
    }
  };
  sandbox.showNotification = (message, type) => {
    notifications.push({ message, type });
  };
  sandbox.logError = (error, category, details) => {
    errors.push({ error, category, details });
  };

  Object.assign(sandbox, overrides);
  sandbox.globalThis = sandbox;

  const context = vm.createContext(sandbox);
  vm.runInContext(code, context, { filename: path.basename(modulePath) });

  return {
    autoUpdater: sandbox.AIScriptAutoUpdater,
    notifications,
    errors,
    consoleErrors,
    registered,
    sandbox
  };
}

test('registers the auto updater bridge on load', () => {
  const { autoUpdater, registered } = loadAutoUpdater();

  expect(registered.length).toBeGreaterThanOrEqual(1);
  expect(registered[0].name).toBe('ScriptAutoUpdater');
  expect(autoUpdater).toEqual(expect.objectContaining({
    handleAIResponse: expect.any(Function),
    checkHealth: expect.any(Function)
  }));
});

test('empty response returns null without side effects', () => {
  const { autoUpdater, notifications, errors } = loadAutoUpdater();

  const result = autoUpdater.handleAIResponse('');
  expect(result).toBeNull();
  expect(notifications).toHaveLength(0);
  expect(errors).toHaveLength(0);
});

test('null response returns null', () => {
  const { autoUpdater } = loadAutoUpdater();
  expect(autoUpdater.handleAIResponse(null)).toBeNull();
});

test('non-string response returns null', () => {
  const { autoUpdater } = loadAutoUpdater();
  expect(autoUpdater.handleAIResponse(123)).toBeNull();
});

test('valid install action returns parsed result', () => {
  const { autoUpdater } = loadAutoUpdater();
  const result = autoUpdater.handleAIResponse('/* install:console.log("x") */');
  expect(result).toEqual({
    action: 'install',
    installPath: 'console.log("x")',
    hasRequiredHelpers: false
  });
});

test('checkHealth returns status object', () => {
  const { autoUpdater } = loadAutoUpdater();
  const health = autoUpdater.checkHealth();
  expect(health).toEqual({
    healthy: true,
    timestamp: expect.any(Number),
    version: '1.0.0'
  });
});