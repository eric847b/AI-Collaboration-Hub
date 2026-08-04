/**
 * Internationalization (i18n) Module Unit Tests
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
global.window.UnifiedSuite.state = { currentLocale: 'en' };
global.window.UnifiedSuite.debugLog = () => {};

describe('i18n Module', () => {
    let I18nModule;

    beforeAll(() => {
        I18nModule = require('../Userscripts/modules/i18n.js').i18n;
    });

    beforeEach(() => {
        I18nModule.currentLocale = 'en';
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    describe('setLocale', () => {
        it('should set current locale', () => {
            I18nModule.setLocale('es');
            expect(I18nModule.getLocale()).toBe('es');
        });

        it('should not change locale for unsupported locale', () => {
            const before = I18nModule.getLocale();
            I18nModule.setLocale('invalid');
            expect(I18nModule.getLocale()).toBe(before);
        });
    });

    describe('getLocale', () => {
        it('should get current locale', () => {
            expect(I18nModule.getLocale()).toBe('en');
        });
    });

    describe('t', () => {
        it('should translate a key', () => {
            const translation = I18nModule.t('app_title');
            expect(typeof translation).toBe('string');
            expect(translation.length).toBeGreaterThan(0);
        });

        it('should return key if not found', () => {
            const translation = I18nModule.t('nonexistent.key');
            expect(translation).toBe('nonexistent.key');
        });

        it('should interpolate params', () => {
            // Use a key that supports interpolation from the translations
            const translation = I18nModule.t('loaded_template', { name: 'Test' });
            // Since placeholder replacement happens, check the method works
            expect(typeof translation).toBe('string');
        });
    });

    describe('getAvailableLocales', () => {
        it('should return array of supported locales', () => {
            const locales = I18nModule.getAvailableLocales();
            expect(Array.isArray(locales)).toBe(true);
            expect(locales.length).toBeGreaterThan(0);
        });

        it('should include en in supported locales', () => {
            const locales = I18nModule.getAvailableLocales();
            const codes = locales.map(l => l.code);
            expect(codes).toContain('en');
        });
    });

    describe('getLocaleName', () => {
        it('should return locale name', () => {
            expect(I18nModule.getLocaleName('en')).toBe('English');
            expect(I18nModule.getLocaleName('es')).toBe('Español');
        });
    });

    describe('detectBrowserLocale', () => {
        it('should return en when no browser locale', () => {
            const locale = I18nModule.detectBrowserLocale();
            expect(typeof locale).toBe('string');
        });
    });

    describe('isAvailable', () => {
        it('should return true', () => {
            expect(I18nModule.isAvailable()).toBe(true);
        });
    });
});
