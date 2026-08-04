/**
 * UI Module Unit Tests
 * @version 2.1.0
 */

const { describe, it, expect, beforeAll, beforeEach, afterEach } = require('@jest/globals');

// Mock document if not in jsdom environment
const safeDoc = typeof global.document !== 'undefined' ? global.document : {
    body: { innerHTML: '', appendChild: () => {} },
    getElementById: () => null,
    createElement: () => ({ style: {}, appendChild: () => {} }),
    querySelector: () => null,
    querySelectorAll: () => []
};

global.window = global.window || {};
global.window.UnifiedSuite = global.window.UnifiedSuite || {};
global.window.UnifiedSuite.CONFIG = { VERSION: '2.1.0' };
global.window.UnifiedSuite.state = { currentTab: 'generator', tabs: {} };
global.window.UnifiedSuite.updateState = (key, val) => { global.window.UnifiedSuite.state[key] = val; };
global.window.UnifiedSuite.debugLog = () => {};

describe('UI Module', () => {
    let UIModule;

    beforeAll(() => {
        UIModule = require('../Userscripts/modules/ui.js').UIModule;
    });

    beforeEach(() => {
        safeDoc.body.innerHTML = '<div id="app"></div>';
        if (!window.UnifiedSuite?.storage) {
            window.UnifiedSuite.storage = {
                loadGeneratedScripts: () => [],
                validateScript: (s) => ({ isValid: true, issues: [], warnings: [], score: 100 }),
                saveGeneratedScript: () => ({}),
                exportAllScripts: () => '{}',
                importScripts: () => ({ imported: 0 })
            };
        }
        if (!window.UnifiedSuite?.providers) {
            window.UnifiedSuite.providers = { generateWithProvider: async () => ({ content: 'test' }) };
        }
    });

    afterEach(() => {
        jest.restoreAllMocks();
        safeDoc.body.innerHTML = '';
    });

    describe('createUnifiedUI', () => {
        it('should create UI element', () => {
            UIModule.createUnifiedUI();
            const ui = safeDoc.getElementById('suite-ui');
            expect(ui).not.toBeNull();
        });

        it('should not create duplicate UI', () => {
            UIModule.createUnifiedUI();
            UIModule.createUnifiedUI();
            const ui = safeDoc.querySelectorAll('#suite-ui');
            expect(ui.length).toBe(1);
        });
    });

    describe('getUITemplate', () => {
        it('should return HTML template string', () => {
            const template = UIModule.getUITemplate();
            expect(typeof template).toBe('string');
            expect(template.length).toBeGreaterThan(0);
            expect(template).toContain('AI Assistant Suite');
        });
    });

    describe('getStyles', () => {
        it('should return CSS string', () => {
            const styles = UIModule.getStyles();
            expect(typeof styles).toBe('string');
            expect(styles.length).toBeGreaterThan(0);
        });
    });

    describe('getScriptsCount', () => {
        it('should return scripts count', () => {
            const count = UIModule.getScriptsCount();
            expect(typeof count).toBe('number');
            expect(count).toBeGreaterThanOrEqual(0);
        });
    });

    describe('renderGeneratedScript', () => {
        it('should render script without error', () => {
            const elements = {
                validationResults: safeDoc.createElement('div'),
                scriptOutput: safeDoc.createElement('div'),
                copyButton: safeDoc.createElement('button'),
                downloadButton: safeDoc.createElement('button'),
                scriptActions: safeDoc.createElement('div')
            };
            safeDoc.body.appendChild(elements.validationResults);
            safeDoc.body.appendChild(elements.scriptOutput);
            safeDoc.body.appendChild(elements.copyButton);
            safeDoc.body.appendChild(elements.downloadButton);
            safeDoc.body.appendChild(elements.scriptActions);

            const script = {
                content: '// ==UserScript==\n// @name Test\n// ==/UserScript==',
                validation: { isValid: true, issues: [], warnings: [], score: 100 },
                filename: 'test.user.js'
            };

            expect(() => UIModule.renderGeneratedScript(script, elements)).not.toThrow();
        });
    });

    describe('renderStatus', () => {
        it('should render status message', () => {
            const elements = {
                validationResults: safeDoc.createElement('div'),
                scriptOutput: safeDoc.createElement('div')
            };
            safeDoc.body.appendChild(elements.validationResults);
            safeDoc.body.appendChild(elements.scriptOutput);

            UIModule.renderStatus(elements, 'Test status');
            expect(elements.validationResults.textContent).toBe('Test status');
        });
    });

    describe('showError', () => {
        it('should show error message', () => {
            const elements = {
                validationResults: safeDoc.createElement('div'),
                scriptOutput: safeDoc.createElement('div')
            };
            safeDoc.body.appendChild(elements.validationResults);
            safeDoc.body.appendChild(elements.scriptOutput);

            UIModule.showError(elements, 'Test error');
            expect(elements.validationResults.textContent).toContain('Error: Test error');
            expect(elements.validationResults.style.color).toBe('#ef4444');
        });
    });

    describe('setButtonBusy', () => {
        it('should set button busy state', () => {
            const btn = safeDoc.createElement('button');
            safeDoc.body.appendChild(btn);

            UIModule.setButtonBusy(btn, true, 'Loading...');
            expect(btn.disabled).toBe(true);
            expect(btn.textContent).toBe('Loading...');
        });
    });

    describe('updateStreamingStatus', () => {
        it('should update streaming status', () => {
            const statusEl = safeDoc.createElement('span');
            safeDoc.body.appendChild(statusEl);

            UIModule.updateStreamingStatus(statusEl, true);
            expect(statusEl.textContent).toBe('Streaming...');

            UIModule.updateStreamingStatus(statusEl, false);
            expect(statusEl.textContent).toBe('Idle');
        });
    });

    describe('getTemplateStyles', () => {
        it('should return template CSS', () => {
            const styles = UIModule.getTemplateStyles();
            expect(typeof styles).toBe('string');
            expect(styles.length).toBeGreaterThan(0);
        });
    });

    describe('exportTemplatesJSON', () => {
        it('should export templates', () => {
            const json = UIModule.exportTemplatesJSON();
            expect(typeof json).toBe('string');
        });
    });

    describe('importTemplatesJSON', () => {
        it('should import templates', () => {
            const result = UIModule.importTemplatesJSON('{"templates":[]}');
            expect(result).toHaveProperty('imported');
        });
    });
});