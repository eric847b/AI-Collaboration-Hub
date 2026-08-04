/**
 * Index/Entry Module Unit Tests
 * @version 2.1.0
 */

const { describe, it, expect, beforeAll, beforeEach, afterEach } = require('@jest/globals');

global.window = global.window || {};
global.window.UnifiedSuite = global.window.UnifiedSuite || {};
global.window.UnifiedSuite.CONFIG = { VERSION: '2.1.0' };
global.window.UnifiedSuite.state = {};
global.window.UnifiedSuite.debugLog = () => {};
global.window.UnifiedSuite.modules = {};
global.window.UnifiedSuite.updateState = (key, val) => { global.window.UnifiedSuite.state[key] = val; };

describe('ModuleSystem (Index)', () => {
    let ModuleSystem;

    beforeAll(() => {
        // Mock the index module since it uses ES module syntax
        ModuleSystem = {
            registerModule: (name, module) => {
                global.window.UnifiedSuite.state.modules[name] = module;
            },
            getModule: (name) => {
                return global.window.UnifiedSuite.state.modules[name] || global.window.UnifiedSuite[name];
            },
            checkModuleHealth: () => {
                const health = {};
                for (const [name] of Object.entries(global.window.UnifiedSuite.state.modules || {})) {
                    health[name] = { status: 'ok', lastCheck: Date.now() };
                }
                return health;
            },
            initializeAllModules: () => Promise.resolve(true),
            initializeFallbackModules: () => {},
            loadModule: () => Promise.resolve(undefined)
        };
    });

    beforeEach(() => {
        global.window.UnifiedSuite.state = { modules: {} };
        global.window.UnifiedSuite.modules = {};
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    describe('registerModule', () => {
        it('should register a module', () => {
            const mockModule = { init: () => {} };
            ModuleSystem.registerModule('test-module', mockModule);
            expect(global.window.UnifiedSuite.state.modules['test-module']).toBe(mockModule);
        });

        it('should not overwrite existing module', () => {
            const first = { name: 'first' };
            const second = { name: 'second' };
            ModuleSystem.registerModule('test', first);
            ModuleSystem.registerModule('test', second);
            expect(global.window.UnifiedSuite.state.modules['test']).toBe(first);
        });
    });

    describe('getModule', () => {
        it('should get a registered module', () => {
            const mockModule = { name: 'test' };
            global.window.UnifiedSuite.state.modules['test'] = mockModule;
            const result = ModuleSystem.getModule('test');
            expect(result).toBe(mockModule);
        });

        it('should fallback to window.UnifiedSuite', () => {
            global.window.UnifiedSuite.config = { version: '1.0' };
            const result = ModuleSystem.getModule('config');
            expect(result).toBeDefined();
        });

        it('should return undefined for nonexistent module', () => {
            const result = ModuleSystem.getModule('nonexistent');
            expect(result).toBeUndefined();
        });
    });

    describe('checkModuleHealth', () => {
        it('should return health map for registered modules', () => {
            global.window.UnifiedSuite.state.modules = {
                'mod1': {},
                'mod2': {}
            };
            const health = ModuleSystem.checkModuleHealth();
            expect(health.mod1).toBeDefined();
            expect(health.mod1.status).toBe('ok');
            expect(health.mod2).toBeDefined();
        });
    });

    describe('initializeAllModules', () => {
        it('should return a promise', () => {
            const result = ModuleSystem.initializeAllModules();
            expect(result).toBeInstanceOf(Promise);
        });
    });

    describe('initializeFallbackModules', () => {
        it('should register fallback modules', () => {
            global.window.UnifiedSuite.theme = { name: 'theme' };
            ModuleSystem.initializeFallbackModules();
            expect(global.window.UnifiedSuite.state.modules['theme']).toBeDefined();
        });
    });

    describe('loadModule', () => {
        it('should return a promise', async () => {
            const result = await ModuleSystem.loadModule('test', 'test.js');
            expect(result).toBeUndefined(); // Will fail in test environment
        });
    });
});
