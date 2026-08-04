/**
 * Debugger Module Unit Tests
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

// Mock console methods
global.console = {
    ...console,
    log: jest.fn(),
    error: jest.fn(),
    warn: jest.fn()
};

global.window = global.window || {};
global.window.UnifiedSuite = global.window.UnifiedSuite || {};
global.window.UnifiedSuite.CONFIG = { VERSION: '2.1.0' };
global.window.UnifiedSuite.state = {};
global.window.UnifiedSuite.debugLog = (...args) => {};

describe('Debugger Module', () => {
    let DebuggerModule;
    let mockStore;

    beforeAll(() => {
        DebuggerModule = require('../Userscripts/modules/debugger.js').DebuggerModule;
    });

    beforeEach(() => {
        mockStore = {};
        global.__gm_store = mockStore;
        DebuggerModule.clearLogs();
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    describe('log', () => {
        it('should log messages', () => {
            DebuggerModule.log('Test message', { data: 123 });
            const logs = DebuggerModule.getLogs();
            expect(logs.length).toBe(1);
            expect(logs[0].message).toBe('Test message');
        });

        it('should include level in logs', () => {
            DebuggerModule.log('Info message', null, 'info');
            const logs = DebuggerModule.getLogs();
            expect(logs[0].level).toBe('info');
        });

        it('should include timestamp in logs', () => {
            DebuggerModule.log('Test');
            const logs = DebuggerModule.getLogs();
            expect(logs[0].timestamp).toBeDefined();
            expect(new Date(logs[0].timestamp)).toBeInstanceOf(Date);
        });
    });

    describe('error', () => {
        it('should log errors', () => {
            DebuggerModule.error('Error message', new Error('test'));
            const logs = DebuggerModule.getLogs();
            expect(logs.length).toBe(1);
            expect(logs[0].level).toBe('error');
        });
    });

    describe('warn', () => {
        it('should log warnings', () => {
            DebuggerModule.warn('Warning message');
            const logs = DebuggerModule.getLogs();
            expect(logs[0].level).toBe('warn');
        });
    });

    describe('getLogs', () => {
        it('should return logs array', () => {
            DebuggerModule.log('Test 1');
            DebuggerModule.log('Test 2');
            const logs = DebuggerModule.getLogs();
            expect(Array.isArray(logs)).toBe(true);
            expect(logs.length).toBe(2);
        });

        it('should return logs sorted by timestamp', () => {
            DebuggerModule.log('First');
            DebuggerModule.log('Second');
            const logs = DebuggerModule.getLogs();
            expect(logs[0].message).toBe('First');
            expect(logs[1].message).toBe('Second');
        });
    });

    describe('clearLogs', () => {
        it('should clear all logs', () => {
            DebuggerModule.log('Test 1');
            DebuggerModule.log('Test 2');
            DebuggerModule.clearLogs();
            const logs = DebuggerModule.getLogs();
            expect(logs.length).toBe(0);
        });

        it('should clear GM storage', () => {
            DebuggerModule.log('Test');
            DebuggerModule.clearLogs();
            const stored = GM_getValue('debugger_logs', '[]');
            expect(JSON.parse(stored).length).toBe(0);
        });
    });

    describe('exportLogs', () => {
        it('should export logs as JSON', () => {
            DebuggerModule.log('Test message');
            const exported = DebuggerModule.exportLogs();
            const data = JSON.parse(exported);
            expect(data.logs).toBeDefined();
            expect(data.logs.length).toBe(1);
        });
    });

    describe('getErrors', () => {
        it('should return only error logs', () => {
            DebuggerModule.log('Info', null, 'info');
            DebuggerModule.error('Error 1');
            DebuggerModule.error('Error 2');
            DebuggerModule.warn('Warning');

            const errors = DebuggerModule.getErrors();
            expect(errors.length).toBe(2);
        });
    });

    describe('getWarnings', () => {
        it('should return only warning logs', () => {
            DebuggerModule.log('Info', null, 'info');
            DebuggerModule.warn('Warning 1');
            DebuggerModule.warn('Warning 2');
            DebuggerModule.error('Error');

            const warnings = DebuggerModule.getWarnings();
            expect(warnings.length).toBe(2);
        });
    });

    describe('isAvailable', () => {
        it('should return true', () => {
            expect(DebuggerModule.isAvailable()).toBe(true);
        });
    });
});