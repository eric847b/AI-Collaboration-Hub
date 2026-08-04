/**
 * AutoUpdate Module Unit Tests
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
global.window.UnifiedSuite.CONFIG = { VERSION: '2.1.0', GITHUB_REPO: 'test/repo' };
global.window.UnifiedSuite.state = { lastUpdateCheck: 0 };
global.window.UnifiedSuite.updateState = (key, val) => { global.window.UnifiedSuite.state[key] = val; };
global.window.UnifiedSuite.debugLog = () => {};

describe('AutoUpdate Module', () => {
    let AutoupdateModule;
    let mockStore;

    beforeAll(() => {
        AutoupdateModule = require('../Userscripts/modules/autoupdate.js').AutoUpdateModule;
    });

    beforeEach(() => {
        mockStore = {};
        global.__gm_store = mockStore;
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    describe('checkForUpdates', () => {
        it('should return null when network fails', async () => {
            const result = await AutoupdateModule.checkForUpdates();
            expect(result).toBeNull();
        });
    });

    describe('isUpdateAvailable', () => {
        it('should return false for null input', () => {
            expect(AutoupdateModule.isUpdateAvailable(null)).toBe(false);
        });

        it('should return true when version is newer', () => {
            const updateInfo = { latestVersion: '2.2.0', currentVersion: '2.1.0' };
            expect(AutoupdateModule.isUpdateAvailable(updateInfo)).toBe(true);
        });

        it('should return false when versions are equal', () => {
            const updateInfo = { latestVersion: '2.1.0', currentVersion: '2.1.0' };
            expect(AutoupdateModule.isUpdateAvailable(updateInfo)).toBe(false);
        });
    });

    describe('compareVersions', () => {
        it('should return 1 when v1 > v2', () => {
            expect(AutoupdateModule.compareVersions('2.2.0', '2.1.0')).toBe(1);
        });

        it('should return -1 when v1 < v2', () => {
            expect(AutoupdateModule.compareVersions('2.0.0', '2.1.0')).toBe(-1);
        });

        it('should return 0 when versions are equal', () => {
            expect(AutoupdateModule.compareVersions('2.1.0', '2.1.0')).toBe(0);
        });
    });

    describe('getLastCheckTime', () => {
        it('should return 0 when no check recorded', () => {
            expect(AutoupdateModule.getLastCheckTime()).toBe(0);
        });

        it('should return stored timestamp', () => {
            GM_setValue('update_last_check', '1234567890');
            expect(AutoupdateModule.getLastCheckTime()).toBe(1234567890);
        });
    });

    describe('setLastCheckTime', () => {
        it('should store timestamp', () => {
            AutoupdateModule.setLastCheckTime(1234567890);
            expect(GM_getValue('update_last_check', '0')).toBe('1234567890');
        });
    });

    describe('shouldCheck', () => {
        it('should return true when interval has passed', () => {
            GM_setValue('update_last_check', String(Date.now() - 86400001)); // 24h + 1ms ago
            expect(AutoupdateModule.shouldCheck()).toBe(true);
        });

        it('should return false when within interval', () => {
            GM_setValue('update_last_check', String(Date.now()));
            expect(AutoupdateModule.shouldCheck()).toBe(false);
        });
    });

    describe('stashModifications', () => {
        it('should return empty array when no scripts', () => {
            const result = AutoupdateModule.stashModifications();
            expect(result.scripts).toBeDefined();
            expect(Array.isArray(result.scripts)).toBe(true);
        });
    });

    describe('threeWayMerge', () => {
        it('should keep unchanged lines from new version', () => {
            const original = 'Line 1\nLine 2\nLine 3';
            const user = 'Line 1\nLine 2\nLine 3';
            const newVer = 'Line 1\nLine 2 modified\nLine 3';
            const merged = AutoupdateModule.threeWayMerge(original, user, newVer);
            expect(merged).toContain('Line 2 modified');
        });

        it('should keep user changes when original unchanged', () => {
            const original = 'Line 1\nLine 2';
            const user = 'Line 1\nUser modified';
            const newContent = 'Line 1\nLine 2';
            const merged = AutoupdateModule.threeWayMerge(original, user, newContent);
            expect(merged).toContain('User modified');
        });
    });

    describe('isAvailable', () => {
        it('should return true when GM functions available', () => {
            expect(AutoupdateModule.isAvailable()).toBe(true);
        });
    });
});
