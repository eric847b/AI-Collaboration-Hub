/**
 * Plugin API Module Unit Tests
 * @version 2.1.0
 */

const { describe, it, expect, beforeAll, beforeEach, afterEach } = require('@jest/globals');

// Mock GM_* functions
global.GM_getValue = global.GM_getValue || ((key, def) => {
    const store = global.__gm_store || {};
    return store[key] !== undefined ? store[key] : def;
});
global.GM_setValue = global.GM_setValue || ((key, val) => {
    if (!global.__gm_store) global.__gm_store = {};
    global.__gm_store[key] = val;
});

global.window = global.window || {};
global.window.UnifiedSuite = global.window.UnifiedSuite || {};
global.window.UnifiedSuite.CONFIG = { VERSION: '2.1.0' };
global.window.UnifiedSuite.state = { plugins: {} };
global.window.UnifiedSuite.updateState = (key, val) => { global.window.UnifiedSuite.state[key] = val; };
global.window.UnifiedSuite.debugLog = () => {};

describe('Plugin API Module', () => {
    let PluginApiModule;

    beforeAll(() => {
        PluginApiModule = require('../Userscripts/modules/plugin-api.js').PluginAPI;
    });

    beforeEach(() => {
        global.window.UnifiedSuite.state.plugins = {};
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    describe('register', () => {
        it('should register a plugin', () => {
            const manifest = {
                id: 'test-plugin',
                name: 'Test Plugin',
                version: '1.0.0',
                description: 'A test plugin',
                author: 'Test Author'
            };
            const implementation = { hooks: {} };

            const result = PluginApiModule.register(manifest, implementation);
            expect(result).toBe(true);
            expect(PluginApiModule.getPlugin('test-plugin')).not.toBeNull();
        });

        it('should reject duplicate plugin IDs', () => {
            PluginApiModule.register({ id: 'duplicate', name: 'Plugin 1', version: '1.0.0' }, {});
            const result = PluginApiModule.register({ id: 'duplicate', name: 'Plugin 2', version: '1.0.0' }, {});
            expect(result).toBe(false);
        });

        it('should validate required fields', () => {
            const result = PluginApiModule.register({ id: 'invalid', name: 'Missing Version' }, {});
            expect(result).toBe(false);
        });
    });

    describe('unregister', () => {
        it('should unregister a plugin', () => {
            PluginApiModule.register({ id: 'removable', name: 'Removable', version: '1.0.0' }, {});
            PluginApiModule.unregister('removable');
            expect(PluginApiModule.getPlugin('removable')).toBeNull();
        });
    });

    describe('getPlugin', () => {
        it('should return plugin by ID', () => {
            PluginApiModule.register({ id: 'findable', name: 'Findable Plugin', version: '1.0.0' }, {});
            const plugin = PluginApiModule.getPlugin('findable');
            expect(plugin).not.toBeNull();
            expect(plugin.manifest.id).toBe('findable');
        });

        it('should return null for nonexistent plugin', () => {
            const plugin = PluginApiModule.getPlugin('nonexistent');
            expect(plugin).toBeNull();
        });
    });

    describe('listPlugins', () => {
        it('should return all registered plugins', () => {
            PluginApiModule.register({ id: 'p1', name: 'P1', version: '1.0.0' }, {});
            PluginApiModule.register({ id: 'p2', name: 'P2', version: '1.0.0' }, {});

            const plugins = PluginApiModule.listPlugins();
            expect(plugins.length).toBe(2);
        });

        it('should return empty array when no plugins', () => {
            const plugins = PluginApiModule.listPlugins();
            expect(Array.isArray(plugins)).toBe(true);
            expect(plugins.length).toBe(0);
        });
    });

    describe('executeHook', () => {
        it('should execute plugin hook', async () => {
            const implementation = {
                'test.hook': () => 'hook_result'
            };
            PluginApiModule.register({ id: 'hook-test', name: 'Hook Test', version: '1.0.0', hooks: {} }, implementation);
            const results = await PluginApiModule.executeHook('test.hook', {});
            expect(results.length).toBeGreaterThan(0);
        });
    });

    describe('getCount', () => {
        it('should return plugin count', () => {
            PluginApiModule.register({ id: 'c1', name: 'C1', version: '1.0.0' }, {});
            PluginApiModule.register({ id: 'c2', name: 'C2', version: '1.0.0' }, {});
            expect(PluginApiModule.getCount()).toBe(2);
        });
    });

    describe('isAvailable', () => {
        it('should return true', () => {
            expect(PluginApiModule.isAvailable()).toBe(true);
        });
    });
});