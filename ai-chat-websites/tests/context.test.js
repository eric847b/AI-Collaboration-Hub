/**
 * Context Module Unit Tests
 * @version 2.1.0
 */

const { describe, it, expect, beforeAll, beforeEach, afterEach } = require('@jest/globals');

global.window = global.window || {};
global.window.UnifiedSuite = global.window.UnifiedSuite || {};
global.window.UnifiedSuite.CONFIG = { VERSION: '2.1.0' };
global.window.UnifiedSuite.state = {};
global.window.UnifiedSuite.debugLog = () => {};

describe('Context Module', () => {
    let ContextModule;

    beforeAll(() => {
        ContextModule = require('../Userscripts/modules/context.js').ContextModule;
    });

    beforeEach(() => {
        document.body.innerHTML = '<div id="app">Test content</div>';
        document.title = 'Test Page';
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    describe('analyzePage', () => {
        it('should analyze page context', () => {
            const context = ContextModule.analyzePage();
            expect(typeof context).toBe('object');
            expect(context).toHaveProperty('title');
            expect(context).toHaveProperty('url');
            expect(context).toHaveProperty('domain');
        });

        it('should extract page title', () => {
            document.title = 'My Test Page';
            const context = ContextModule.analyzePage();
            expect(context.title).toBe('My Test Page');
        });

        it('should detect content type', () => {
            document.body.innerHTML = '<article><p>Content</p></article>';
            const context = ContextModule.analyzePage();
            expect(context.contentType).toBe('article');
        });
    });

    describe('getMetaDescription', () => {
        it('should return empty string when no meta description', () => {
            const desc = ContextModule.getMetaDescription();
            expect(desc).toBe('');
        });
    });

    describe('extractHeadings', () => {
        it('should extract headings from page', () => {
            document.body.innerHTML = '<h1>Title</h1><h2>Subtitle</h2>';
            const headings = ContextModule.extractHeadings();
            expect(headings.length).toBeGreaterThan(0);
        });

        it('should return empty array when no headings', () => {
            document.body.innerHTML = '<p>No headings</p>';
            const headings = ContextModule.extractHeadings();
            expect(headings.length).toBe(0);
        });
    });

    describe('extractLinks', () => {
        it('should extract valid links', () => {
            document.body.innerHTML = '<a href="https://example.com">Link</a>';
            const links = ContextModule.extractLinks();
            expect(links.length).toBe(1);
        });

        it('should filter out javascript and hash links', () => {
            document.body.innerHTML = '<a href="javascript:void(0)">JS</a><a href="#section">Hash</a>';
            const links = ContextModule.extractLinks();
            expect(links.length).toBe(0);
        });
    });

    describe('detectContentType', () => {
        it('should detect form pages', () => {
            document.body.innerHTML = '<form><input type="text"></form>';
            const type = ContextModule.detectContentType();
            expect(type).toBe('form');
        });
    });

    describe('enhancePrompt', () => {
        it('should enhance prompt with context', () => {
            const enhanced = ContextModule.enhancePrompt('Generate a script');
            expect(typeof enhanced).toBe('string');
            expect(enhanced.length).toBeGreaterThan(0);
        });
    });

    describe('getDefaultContext', () => {
        it('should return default context object', () => {
            const context = ContextModule.getDefaultContext();
            expect(context).toHaveProperty('title', '');
            expect(context).toHaveProperty('contentType', 'general');
            expect(context).toHaveProperty('forms');
        });
    });

    describe('isAvailable', () => {
        it('should return true when document is available', () => {
            expect(ContextModule.isAvailable()).toBe(true);
        });
    });
});
