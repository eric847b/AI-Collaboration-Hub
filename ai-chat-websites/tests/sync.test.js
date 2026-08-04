/**
 * Sync Module Unit Tests
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

describe('Sync Module', () => {
    let SyncModule;

    beforeAll(() => {
        SyncModule = require('../Userscripts/modules/sync.js').SyncModule;
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    describe('exportToGist', () => {
        it('should throw when network fails (fetch rejects)', async () => {
            await expect(SyncModule.exportToGist([], 'token')).rejects.toThrow();
        });
    });

    describe('importFromGist', () => {
        it('should throw when gist not found', async () => {
            await expect(SyncModule.importFromGist('nonexistent', 'token')).rejects.toThrow();
        });
    });

    describe('updateGist', () => {
        it('should throw when network fails', async () => {
            await expect(SyncModule.updateGist('id', [], 'token')).rejects.toThrow();
        });
    });

    describe('exportToJSON', () => {
        it('should export templates as JSON string', () => {
            const templates = [{ id: '1', name: 'Test' }];
            const json = SyncModule.exportToJSON(templates);
            const data = JSON.parse(json);
            expect(data).toHaveProperty('version');
            expect(data).toHaveProperty('templates');
            expect(data.templates.length).toBe(1);
        });
    });

    describe('importFromJSON', () => {
        it('should import templates from JSON', () => {
            const json = JSON.stringify({ version: '1.0', templates: [{ id: '1' }] });
            const result = SyncModule.importFromJSON(json);
            expect(Array.isArray(result)).toBe(true);
            expect(result.length).toBe(1);
        });

        it('should throw for invalid JSON', () => {
            expect(() => SyncModule.importFromJSON('invalid')).toThrow();
        });
    });

    describe('getCachedGists', () => {
        it('should return empty array when no cache', () => {
            const cached = SyncModule.getCachedGists();
            expect(Array.isArray(cached)).toBe(true);
            expect(cached.length).toBe(0);
        });
    });

    describe('clearCache', () => {
        it('should clear gist cache', () => {
            SyncModule.gistCache.set('test', { id: 'test' });
            SyncModule.clearCache();
            expect(SyncModule.getCachedGists().length).toBe(0);
        });
    });

    describe('isAvailable', () => {
        it('should return true when fetch is available', () => {
            expect(SyncModule.isAvailable()).toBe(true);
        });
    });
});
