/**
 * Storage Module Unit Tests
 * @version 2.1.0
 */

const { describe, it, expect, beforeAll, beforeEach } = require('@jest/globals');

// Mock dependencies
const mockConfig = {
  VERSION: '1.3.0',
  MAX_HISTORY_ITEMS: 25,
  MAX_VERSIONS_PER_SCRIPT: 10,
  MAX_SCRIPT_LENGTH: 8000,
  STORAGE_KEYS: {
    history: 'test_history',
    settings: 'test_settings',
    sessionApiKey: 'test_api_key',
    versions: 'test_versions',
    templates: 'test_templates',
    moduleHealth: 'test_module_health'
  }
};

const mockState = { moduleHealth: {}, generatedScripts: [] };

global.window = global.window || {
  UnifiedSuite: {
    CONFIG: mockConfig,
    state: mockState,
    updateState: (key, val) => { mockState[key] = val; },
    debugLog: () => {},
    sanitizeText: (text) => String(text ?? '').replace(/\u0000/g, '').trim(),
    safeJsonParse: (v, fb) => { try { return JSON.parse(v); } catch { return fb; } },
    generateId: () => 'test-id-' + Math.random().toString(36).slice(2, 9),
    deriveScriptName: (script) => { const m = String(script ?? '').match(/@name\s+(.+)/); return m ? m[1].trim() : ''; },
    generateFilename: (script, fb = 'generated') => { const name = String(script ?? '').match(/@name\s+(.+)/); const base = name ? name[1].replace(/[^\w.-]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase() : fb; return `${base}.user.js`; },
    deriveDescription: (text) => { const clean = String(text ?? '').replace(/```[\s\S]*?```/g, ' ').replace(/\s+/g, ' ').trim(); return clean || 'Auto-generated from AI'; }
  }
};

global.GM_getValue = (key, def) => {
  const store = global.__gm_store || {};
  return store[key] !== undefined ? store[key] : def;
};
global.GM_setValue = (key, val) => {
  if (!global.__gm_store) global.__gm_store = {};
  global.__gm_store[key] = val;
};

describe('Storage Module', () => {
  let StorageModule;

  beforeAll(() => {
    StorageModule = require('../Userscripts/modules/storage.js').StorageModule;
  });

  beforeEach(() => {
    global.__gm_store = {};
    mockState.generatedScripts = [];
    mockState.moduleHealth = {};
  });

  describe('loadGeneratedScripts', () => {
    it('should return empty array when no scripts stored', () => {
      expect(StorageModule.loadGeneratedScripts()).toEqual([]);
    });

    it('should load stored scripts', () => {
      const scripts = [{ id: '1', name: 'Test', content: 'code' }];
      global.__gm_store[mockConfig.STORAGE_KEYS.history] = JSON.stringify(scripts);
      const loaded = StorageModule.loadGeneratedScripts();
      expect(loaded.length).toBe(1);
      expect(loaded[0].name).toBe('Test');
    });

    it('should filter out falsy entries', () => {
      global.__gm_store[mockConfig.STORAGE_KEYS.history] = JSON.stringify([{ id: '1' }, null, { id: '2' }]);
      const loaded = StorageModule.loadGeneratedScripts();
      expect(loaded.length).toBe(2);
    });
  });

  describe('saveGeneratedScript', () => {
    it('should save a script and return a record', () => {
      const script = '// ==UserScript==\n// @name Test Script\n// @match *://*/*\n// ==/UserScript==\n(function(){})();';
      const record = StorageModule.saveGeneratedScript(script, null, 'test prompt');
      expect(record.id).toBeDefined();
      expect(record.name).toBe('Test Script');
      expect(record.content).toBe(script);
      expect(record.timestamp).toBeDefined();
    });

    it('should limit history to MAX_HISTORY_ITEMS', () => {
      for (let i = 0; i < 30; i++) {
        StorageModule.saveGeneratedScript(`// @name Script ${i}\n(function(){})()`, null, '');
      }
      const loaded = StorageModule.loadGeneratedScripts();
      expect(loaded.length).toBeLessThanOrEqual(mockConfig.MAX_HISTORY_ITEMS);
    });
  });

  describe('exportAllScripts', () => {
    it('should export scripts as JSON', () => {
      StorageModule.saveGeneratedScript('// @name Export Test\n(function(){})()', null, 'test');
      const json = StorageModule.exportAllScripts();
      const data = JSON.parse(json);
      expect(data.scripts.length).toBeGreaterThanOrEqual(1);
      expect(data.version).toBeDefined();
      expect(data.exportedAt).toBeDefined();
    });
  });

  describe('importScripts', () => {
    it('should import scripts from JSON', () => {
      const json = JSON.stringify({
        version: '1.3.0',
        scripts: [
          { content: '// @name Imported\n(function(){})()', validation: null, prompt: 'test' }
        ]
      });
      const result = StorageModule.importScripts(json);
      expect(result.imported).toBe(1);
    });

    it('should throw on invalid format', () => {
      expect(() => StorageModule.importScripts('{"bad": "data"}')).toThrow();
    });
  });

  describe('Script Versioning', () => {
    it('should save and load versions', () => {
      const scriptId = 'test-script-1';
      StorageModule.saveScriptVersion(scriptId, 'content v1', 'Initial');
      StorageModule.saveScriptVersion(scriptId, 'content v2', 'Updated');
      const versions = StorageModule.loadVersions(scriptId);
      expect(versions.length).toBe(2);
      expect(versions[0].content).toBe('content v2');
      expect(versions[1].content).toBe('content v1');
    });

    it('should limit versions to MAX_VERSIONS_PER_SCRIPT', () => {
      const scriptId = 'test-script-2';
      for (let i = 0; i < 15; i++) {
        StorageModule.saveScriptVersion(scriptId, `content ${i}`, `v${i}`);
      }
      const versions = StorageModule.loadVersions(scriptId);
      expect(versions.length).toBeLessThanOrEqual(mockConfig.MAX_VERSIONS_PER_SCRIPT);
    });
  });

  describe('validateScript', () => {
    it('should flag missing userscript metadata block', () => {
      const result = StorageModule.validateScript('plain code');
      expect(result.isValid).toBe(false);
      expect(result.issues).toContain('Missing userscript metadata block');
    });

    it('should warn about missing @match or @include', () => {
      const script = '// ==UserScript==\n// @name Test\n// ==/UserScript==\n(function(){})()';
      const result = StorageModule.validateScript(script);
      expect(result.warnings).toContain('No @match or @include rule detected');
    });

    it('should warn about eval usage', () => {
      const script = '// ==UserScript==\n// @match *://*/*\n// ==/UserScript==\n(function(){ eval("test"); })()';
      const result = StorageModule.validateScript(script);
      expect(result.warnings.some(w => w.includes('eval'))).toBe(true);
    });

    it('should warn about innerHTML assignment', () => {
      const script = '// ==UserScript==\n// @match *://*/*\n// ==/UserScript==\n(function(){ el.innerHTML = "test"; })()';
      const result = StorageModule.validateScript(script);
      expect(result.warnings.some(w => w.includes('innerHTML'))).toBe(true);
    });

    it('should return a score between 0 and 100', () => {
      const script = '// ==UserScript==\n// @name Test\n// @match *://*/*\n// ==/UserScript==\n(function(){})()';
      const result = StorageModule.validateScript(script);
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(100);
    });

    it('should pass valid script with no issues', () => {
      const script = '// ==UserScript==\n// @name Test\n// @match *://*/*\n// ==/UserScript==\n(function(){\n  console.log("hello");\n})();';
      const result = StorageModule.validateScript(script);
      expect(result.isValid).toBe(true);
      expect(result.issues.length).toBe(0);
    });
  });

  describe('Module Health', () => {
    it('should update and get module health', () => {
      StorageModule.updateModuleHealth('test-module', 'ok');
      const health = StorageModule.getModuleHealth('test-module');
      expect(health).toBeDefined();
      expect(health.status).toBe('ok');
      expect(health.lastCheck).toBeDefined();
    });

    it('should return null for unknown module', () => {
      expect(StorageModule.getModuleHealth('unknown')).toBeNull();
    });

    it('should store error messages', () => {
      StorageModule.updateModuleHealth('failed-module', 'error', 'Something broke');
      const health = StorageModule.getModuleHealth('failed-module');
      expect(health.status).toBe('error');
      expect(health.error).toBe('Something broke');
    });
  });
});