/**
 * Versioning Module Unit Tests
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
global.window.UnifiedSuite.CONFIG = { 
    VERSION: '2.1.0',
    STORAGE_KEYS: { versions: 'script_versions' },
    MAX_VERSIONS_PER_SCRIPT: 50,
    MAX_SCRIPT_LENGTH: 100000
};
global.window.UnifiedSuite.state = {};
global.window.UnifiedSuite.debugLog = () => {};
global.window.UnifiedSuite.sanitizeText = (text) => String(text ?? '').trim();
global.window.UnifiedSuite.safeJsonParse = (v, fb) => { try { return JSON.parse(v); } catch { return fb; } };

describe('Versioning Module', () => {
    let VersioningModule;
    let mockStore;

    beforeAll(() => {
        VersioningModule = require('../Userscripts/modules/versioning.js').VersioningModule;
    });

    beforeEach(() => {
        mockStore = {};
        global.__gm_store = mockStore;
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    describe('saveVersion', () => {
        it('should save a new version', () => {
            const scriptId = 'test-script-1';
            VersioningModule.saveVersion(scriptId, 'Test script content', 'Test Name');
            const versions = VersioningModule.loadVersions(scriptId);
            expect(versions.length).toBe(1);
            expect(versions[0].content).toBe('Test script content');
            expect(versions[0].changeMessage).toBe('Test Name');
        });

        it('should assign timestamp to version', () => {
            const before = Date.now();
            VersioningModule.saveVersion('sid', 'Content', 'Name');
            const after = Date.now();
            const versions = VersioningModule.loadVersions('sid');
            expect(versions[0].timestamp).toBeGreaterThanOrEqual(before);
            expect(versions[0].timestamp).toBeLessThanOrEqual(after);
        });

        it('should persist multiple versions for same script', () => {
            VersioningModule.saveVersion('sid', 'Content 1', 'V1');
            VersioningModule.saveVersion('sid', 'Content 2', 'V2');
            const versions = VersioningModule.loadVersions('sid');
            expect(versions.length).toBe(2);
        });
    });

    describe('loadVersions', () => {
        it('should return empty array when no versions', () => {
            const versions = VersioningModule.loadVersions('nonexistent');
            expect(Array.isArray(versions)).toBe(true);
            expect(versions.length).toBe(0);
        });
    });

    describe('createDiff', () => {
        it('should return diff between two strings', () => {
            const diff = VersioningModule.createDiff('Line 1\nLine 2', 'Line 1\nLine 3');
            expect(diff).toContain('- Line 2');
            expect(diff).toContain('+ Line 3');
        });

        it('should return empty string for identical content', () => {
            const diff = VersioningModule.createDiff('Same', 'Same');
            expect(diff).toBe('');
        });
    });

    describe('validateScript', () => {
        it('should validate a correct userscript', () => {
            const script = `// ==UserScript==
// @name Test
// @match *://example.com/*
// ==/UserScript==
console.log('test');`;
            const result = VersioningModule.validateScript(script);
            expect(result.isValid).toBe(true);
        });

        it('should reject script without metadata', () => {
            const result = VersioningModule.validateScript('console.log("test")');
            expect(result.isValid).toBe(false);
            expect(result.issues.length).toBeGreaterThan(0);
        });

        it('should return score', () => {
            const result = VersioningModule.validateScript('console.log("test")');
            expect(result.score).toBeGreaterThanOrEqual(0);
            expect(result.score).toBeLessThanOrEqual(100);
        });
    });

    describe('exportAll', () => {
        it('should export as JSON string', () => {
            const exported = VersioningModule.exportAll();
            const data = JSON.parse(exported);
            expect(data).toHaveProperty('version');
            expect(data).toHaveProperty('exportedAt');
        });
    });

    describe('importAll', () => {
        it('should return import result', () => {
            const result = VersioningModule.importAll('{"version":"2.1.0","scripts":[]}');
            expect(result).toHaveProperty('imported');
        });
    });

    describe('isAvailable', () => {
        it('should return true', () => {
            expect(VersioningModule.isAvailable()).toBe(true);
        });
    });
});