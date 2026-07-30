/**
 * Template Gallery Unit Tests
 * @version 2.1.0
 */

// Mock module context for testing
const mockUnifiedSuite = {
    debugLog: () => {},
    CONFIG: { VERSION: '1.4.0', STORAGE_KEYS: { templates: 'test_templates' } },
    state: { modules: {} },
    sanitizeText: (text) => String(text ?? '').trim(),
    safeJsonParse: (str, fallback) => {
        try { return JSON.parse(str); } catch { return fallback; }
    },
    generateId: () => 'test-id-' + Math.random().toString(36).slice(2, 9)
};

global.window = global.window || { UnifiedSuite: mockUnifiedSuite };
global.GM_getValue = global.GM_getValue || ((key, def) => {
    const store = global.__gm_store || {};
    return store[key] !== undefined ? store[key] : def;
});
global.GM_setValue = global.GM_setValue || ((key, val) => {
    if (!global.__gm_store) global.__gm_store = {};
    global.__gm_store[key] = val;
});

// Mock global utility functions used by templates module
global.safeJsonParse = (str, fallback) => {
    try { return JSON.parse(str); } catch { return fallback; }
};
global.generateId = () => 'test-id-' + Math.random().toString(36).slice(2, 9);
global.sanitizeText = (text) => String(text ?? '').trim();

describe('TemplateGallery Module', () => {
    let TemplatesModule;

    beforeAll(() => {
        TemplatesModule = require('../Userscripts/modules/templates.js').TemplatesModule;
    });

    beforeEach(() => {
        global.__gm_store = {};
    });

    it('should have built-in templates', () => {
        const builtIn = TemplatesModule.BUILT_IN_TEMPLATES;
        expect(builtIn.length).toBeGreaterThanOrEqual(10);
    });

    it('should have categorized templates', () => {
        const templates = TemplatesModule.BUILT_IN_TEMPLATES;
        const categories = new Set(templates.map(t => t.category));
        expect(categories.size).toBeGreaterThanOrEqual(4);
    });

    it('should load templates (built-in + custom)', () => {
        const all = TemplatesModule.loadTemplates();
        expect(all.length).toBeGreaterThanOrEqual(10);
    });

    it('should save a custom template', () => {
        const template = {
            name: 'Test Template',
            description: 'A test',
            category: 'productivity',
            prompt: 'Test prompt',
            tags: ['test']
        };
        const saved = TemplatesModule.saveTemplate(template);
        expect(saved.id).toBeDefined();
        expect(saved.name).toBe('Test Template');
        expect(saved.isBuiltIn).toBe(false);
    });

    it('should search templates', () => {
        const results = TemplatesModule.searchTemplates('cookie');
        expect(results.length).toBeGreaterThan(0);
        results.forEach(t => {
            const matches = t.name.toLowerCase().includes('cookie') ||
                t.description.toLowerCase().includes('cookie') ||
                t.tags.some(tag => tag.toLowerCase().includes('cookie'));
            expect(matches).toBe(true);
        });
    });

    it('should get templates by category', () => {
        const securityTemplates = TemplatesModule.getTemplatesByCategory('Security');
        securityTemplates.forEach(t => {
            expect(t.category).toBe('Security');
        });
    });

    it('should delete a custom template', () => {
        const saved = TemplatesModule.saveTemplate({
            name: 'Delete Me', description: '', category: 'devtools', prompt: '', tags: []
        });
        const before = TemplatesModule.loadTemplates().length;
        TemplatesModule.deleteTemplate(saved.id);
        const after = TemplatesModule.loadTemplates().length;
        expect(after).toBeLessThan(before);
    });

    it('should export templates as JSON', () => {
        TemplatesModule.saveTemplate({
            name: 'Export Test', description: '', category: 'productivity', prompt: '', tags: []
        });
        const json = TemplatesModule.exportTemplates();
        const data = JSON.parse(json);
        expect(data.templates.length).toBeGreaterThanOrEqual(1);
        expect(data.version).toBeDefined();
    });

    it('should import templates from JSON', () => {
        const json = JSON.stringify({
            version: '1.4.0',
            templates: [
                { name: 'Imported', description: 'Imported test', category: 'UI Enhancement', prompt: 'Test', tags: ['imported'] }
            ]
        });
        const result = TemplatesModule.importTemplates(json);
        expect(result.imported).toBe(1);
    });

    it('should get template by ID', () => {
        const builtIn = TemplatesModule.BUILT_IN_TEMPLATES[0];
        const found = TemplatesModule.getTemplate(builtIn.id);
        expect(found).toBeDefined();
        expect(found.id).toBe(builtIn.id);
    });

    it('should increment usage count', () => {
        const builtIn = TemplatesModule.BUILT_IN_TEMPLATES[0];
        const beforeCount = builtIn.usageCount;
        TemplatesModule.incrementUsage(builtIn.id);
        expect(builtIn.usageCount).toBe(beforeCount + 1);
    });
});