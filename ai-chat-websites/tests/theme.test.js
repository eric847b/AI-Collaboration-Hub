/**
 * Theme Module Unit Tests
 * @version 2.1.0
 */

const { describe, it, expect, beforeAll, beforeEach, afterEach } = require('@jest/globals');

global.window = global.window || {};
global.window.UnifiedSuite = global.window.UnifiedSuite || {};
global.window.UnifiedSuite.CONFIG = { VERSION: '2.1.0' };
global.window.UnifiedSuite.state = { theme: 'light' };
global.window.UnifiedSuite.updateState = (key, val) => { global.window.UnifiedSuite.state[key] = val; };
global.window.UnifiedSuite.debugLog = () => {};

beforeAll(() => {
    // Ensure document exists before any tests run
    if (typeof document === 'undefined') {
        global.document = {
            getElementById: () => null,
            createElement: () => ({ style: {} }),
            head: { appendChild: () => {} }
        };
    }
});

describe('Theme Module', () => {
    let ThemeModule;

    beforeAll(() => {
        ThemeModule = require('../Userscripts/modules/theme.js').ThemeModule;
    });

    beforeEach(() => {
        ThemeModule.currentTheme = 'dark';
        global.window.UnifiedSuite.state.config = { theme: 'dark' };
        // Mock CONFIG.STYLE_ID
        if (!global.window.UnifiedSuite.CONFIG.STYLE_ID) {
            global.window.UnifiedSuite.CONFIG.STYLE_ID = 'suite-styles';
        }
        // Create style element to prevent document errors
        if (!document.getElementById('suite-styles')) {
            const styleEl = document.createElement('style');
            styleEl.id = 'suite-styles';
            document.head.appendChild(styleEl);
        }
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    describe('toggle', () => {
        it('should toggle from dark to light', () => {
            ThemeModule.currentTheme = 'dark';
            const result = ThemeModule.toggle();
            expect(result).toBe('light');
        });

        it('should toggle from light to dark', () => {
            ThemeModule.currentTheme = 'light';
            const result = ThemeModule.toggle();
            expect(result).toBe('dark');
        });
    });

    describe('getCurrentTheme', () => {
        it('should return current theme', () => {
            ThemeModule.currentTheme = 'light';
            expect(ThemeModule.getCurrentTheme()).toBe('light');
        });

        it('should default to dark', () => {
            expect(ThemeModule.currentTheme).toBe('dark');
        });
    });

    describe('applyTheme', () => {
        it('should apply theme without error', () => {
            expect(() => ThemeModule.applyTheme()).not.toThrow();
        });
    });

    describe('saveTheme', () => {
        it('should save theme preference', () => {
            ThemeModule.currentTheme = 'light';
            ThemeModule.saveTheme();
            expect(global.window.UnifiedSuite.state.config.theme).toBe('light');
        });
    });

    describe('loadTheme', () => {
        it('should load theme preference without error', () => {
            global.window.UnifiedSuite.state.config.theme = 'light';
            // Mock the style element to prevent document errors
            const styleEl = document.createElement('style');
            styleEl.id = 'suite-styles';
            document.head.appendChild(styleEl);
            
            expect(() => ThemeModule.loadTheme()).not.toThrow();
        });
    });
});
