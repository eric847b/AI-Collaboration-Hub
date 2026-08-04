/**
 * Performance Module Unit Tests
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
global.window.UnifiedSuite.state = {};
global.window.UnifiedSuite.debugLog = () => {};

describe('Performance Module', () => {
    let PerformanceModule;

    beforeAll(() => {
        PerformanceModule = require('../Userscripts/modules/performance.js').PerformanceModule;
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    describe('init', () => {
        it('should initialize performance module', () => {
            expect(() => PerformanceModule.init()).not.toThrow();
        });
    });

    describe('isAvailable', () => {
        it('should return true when performance API is available', () => {
            expect(PerformanceModule.isAvailable()).toBe(true);
        });
    });

    describe('getReport', () => {
        it('should return performance report', () => {
            const report = PerformanceModule.getReport();
            expect(typeof report).toBe('object');
            expect(report).toHaveProperty('loadTime');
            expect(report).toHaveProperty('memoryUsage');
            expect(report).toHaveProperty('moduleLoadTimes');
            expect(report).toHaveProperty('renderCount');
            expect(report).toHaveProperty('timestamp');
        });
    });

    describe('debounce', () => {
        it('should return a debounced function', () => {
            const fn = jest.fn();
            const debounced = PerformanceModule.debounce(fn, 100);
            expect(typeof debounced).toBe('function');
        });
    });

    describe('throttle', () => {
        it('should return a throttled function', () => {
            const fn = jest.fn();
            const throttled = PerformanceModule.throttle(fn, 100);
            expect(typeof throttled).toBe('function');
        });
    });

    describe('lazyLoad', () => {
        it('should return a promise', async () => {
            const result = PerformanceModule.lazyLoad('nonexistent');
            expect(result).toBeInstanceOf(Promise);
        });
    });
});
