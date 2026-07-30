/**
 * Template Gallery Unit Tests
 * @version 1.4.0
 */

const assert = typeof require !== 'undefined' ? require('assert') : null;

// Mock module context for testing
const mockUnifiedSuite = {
    debugLog: () => {},
    CONFIG: { VERSION: '1.4.0', STORAGE_KEYS: { templates: 'test_templates' } },
    state: { modules: {} }
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

describe('TemplateGallery Module', () => {
    let TemplatesModule;

    before(async () => {
        // Load the module
        TemplatesModule = (await import('../Userscripts/modules/templates.js')).TemplatesModule;
    });

    beforeEach(() => {
        global.__gm_store = {};
        TemplatesModule.customTemplates = [];
    });

    it('should have built-in templates', () => {
        const builtIn = TemplatesModule.getBuiltInTemplates();
        assert.ok(builtIn.length >= 10, `Expected >= 10 templates, got ${builtIn.length}`);
    });

    it('should have categorized templates', () => {
        const templates = TemplatesModule.getBuiltInTemplates();
        const categories = new Set(templates.map(t => t.category));
        assert.ok(categories.size >= 4, `Expected >= 4 categories, got ${categories.size}`);
    });

    it('should save a custom template', () => {
        const template = {
            name: 'Test Template',
            description: 'A test',
            category: 'productivity',
            prompt: 'Test prompt',
            fields: []
        };
        TemplatesModule.saveCustomTemplate(template);
        assert.equal(TemplatesModule.customTemplates.length, 1);
        assert.equal(TemplatesModule.customTemplates[0].name, 'Test Template');
    });

    it('should get templates with search', () => {
        const all = TemplatesModule.getAllTemplates();
        const searchResults = TemplatesModule.getTemplates({ search: 'click' });
        assert.ok(searchResults.length <= all.length);
    });

    it('should get templates by category', () => {
        const securityTemplates = TemplatesModule.getTemplates({ category: 'security' });
        securityTemplates.forEach(t => {
            assert.equal(t.category, 'security');
        });
    });

    it('should delete a custom template', () => {
        const template = { name: 'Delete Me', description: '', category: 'devtools', prompt: '', fields: [] };
        TemplatesModule.saveCustomTemplate(template);
        assert.equal(TemplatesModule.customTemplates.length, 1);
        TemplatesModule.deleteTemplate('Delete Me');
        assert.equal(TemplatesModule.customTemplates.length, 0);
    });

    it('should export templates as JSON', () => {
        TemplatesModule.saveCustomTemplate({ name: 'Export Test', description: '', category: 'productivity', prompt: '', fields: [] });
        const json = TemplatesModule.exportTemplates();
        const data = JSON.parse(json);
        assert.ok(data.templates.length >= 1);
    });

    it('should import templates from JSON', () => {
        const json = JSON.stringify({
            templates: [
                { name: 'Imported', description: 'Imported test', category: 'ui', prompt: 'Test', fields: [] }
            ]
        });
        TemplatesModule.importTemplates(json);
        assert.ok(TemplatesModule.customTemplates.some(t => t.name === 'Imported'));
    });

    it('should not exceed max templates', () => {
        for (let i = 0; i < 60; i++) {
            TemplatesModule.saveCustomTemplate({ name: `Template ${i}`, description: '', category: 'productivity', prompt: '', fields: [] });
        }
        assert.ok(TemplatesModule.customTemplates.length <= 50);
    });
});