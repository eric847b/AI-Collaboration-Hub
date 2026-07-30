/**
 * Unified AI Assistant Suite - Templates Module
 * @version 1.4.0
 */

// Get dependencies from global UnifiedSuite object
const CONFIG = (typeof window !== 'undefined' && window.UnifiedSuite?.CONFIG) || {};
const state = (typeof window !== 'undefined' && window.UnifiedSuite?.state) || {};
const updateState = (typeof window !== 'undefined' && window.UnifiedSuite?.updateState) || (() => {});
const debugLog = (typeof window !== 'undefined' && window.UnifiedSuite?.debugLog) || (() => {});
const sanitizeText = (typeof window !== 'undefined' && window.UnifiedSuite?.sanitizeText) || ((text) => String(text ?? '').trim());

/**
 * @typedef {Object} Template
 * @property {string} id - Template ID
 * @property {string} name - Template name
 * @property {string} description - Template description
 * @property {string} category - Template category
 * @property {string} prompt - Template prompt
 * @property {string[]} tags - Template tags
 * @property {number} usageCount - Times used
 * @property {number} rating - User rating (1-5)
 * @property {boolean} isBuiltIn - Is built-in template
 */

/**
 * Templates Module - Manages prompt templates
 */
const TemplatesModule = {
    BUILT_IN_TEMPLATES: [
        {
            id: 'form-filler',
            name: 'Auto-Form Filler',
            description: 'Automatically fill web forms with predefined data',
            category: 'Productivity',
            prompt: 'Create a userscript that automatically fills web forms. It should identify form fields by their labels or placeholders and fill them with predefined data stored in a configuration object.',
            tags: ['forms', 'automation', 'productivity'],
            usageCount: 0,
            rating: 0,
            isBuiltIn: true
        },
        {
            id: 'batch-link-opener',
            name: 'Batch Link Opener',
            description: 'Open multiple links at once with filtering',
            category: 'Productivity',
            prompt: 'Create a userscript that adds a button to open all links on the current page. Include filtering options for domain patterns and the ability to limit the number of links opened.',
            tags: ['links', 'bulk-actions', 'productivity'],
            usageCount: 0,
            rating: 0,
            isBuiltIn: true
        },
        {
            id: 'page-content-saver',
            name: 'Page Content Saver',
            description: 'Save web page content to local storage or download',
            category: 'Productivity',
            prompt: 'Create a userscript that saves the current page content (title, URL, main text) to localStorage. Add functionality to export saved pages as JSON or Markdown.',
            tags: ['content', 'save', 'export'],
            usageCount: 0,
            rating: 0,
            isBuiltIn: true
        },
        {
            id: 'tab-manager',
            name: 'Tab Manager',
            description: 'Organize and manage browser tabs',
            category: 'Productivity',
            prompt: 'Create a userscript that adds tab management features: group tabs by domain, close duplicate tabs, and save tab sessions for later restoration.',
            tags: ['tabs', 'organization', 'browser'],
            usageCount: 0,
            rating: 0,
            isBuiltIn: true
        },
        {
            id: 'password-checker',
            name: 'Password Strength Checker',
            description: 'Check password strength visually',
            category: 'Security',
            prompt: 'Create a userscript that adds visual password strength indicators to password fields. Show color-coded feedback (red/yellow/green) based on complexity requirements.',
            tags: ['security', 'passwords', 'validation'],
            usageCount: 0,
            rating: 0,
            isBuiltIn: true
        },
        {
            id: 'https-enforcer',
            name: 'HTTPS Enforcer',
            description: 'Automatically redirect HTTP to HTTPS',
            category: 'Security',
            prompt: 'Create a userscript that automatically redirects HTTP URLs to HTTPS when available. Add a visual indicator when a secure version is available and a bypass option for testing.',
            tags: ['security', 'https', 'redirect'],
            usageCount: 0,
            rating: 0,
            isBuiltIn: true
        },
        {
            id: 'cookie-cleaner',
            name: 'Cookie Cleaner',
            description: 'Remove tracking and unnecessary cookies',
            category: 'Security',
            prompt: 'Create a userscript that adds a button to clean cookies. Allow filtering by domain patterns, preserve login cookies for specified sites, and show a summary of removed cookies.',
            tags: ['security', 'privacy', 'cookies'],
            usageCount: 0,
            rating: 0,
            isBuiltIn: true
        },
        {
            id: 'dark-mode-enforcer',
            name: 'Dark Mode Enforcer',
            description: 'Force dark mode on websites',
            category: 'UI Enhancement',
            prompt: 'Create a userscript that forces dark mode on websites that dont support it. Use CSS filters and custom styles to create a comfortable dark theme. Add a toggle button to enable/disable.',
            tags: ['ui', 'dark-mode', 'theme'],
            usageCount: 0,
            rating: 0,
            isBuiltIn: true
        },
        {
            id: 'font-adjuster',
            name: 'Font Size Adjuster',
            description: 'Dynamically adjust font sizes',
            category: 'UI Enhancement',
            prompt: 'Create a userscript that adds font size controls to any webpage. Include increase/decrease buttons and a reset option. Remember user preferences across page loads.',
            tags: ['ui', 'font', 'accessibility'],
            usageCount: 0,
            rating: 0,
            isBuiltIn: true
        },
        {
            id: 'console-logger',
            name: 'Console Logger',
            description: 'Enhanced console logging for debugging',
            category: 'Developer Tools',
            prompt: 'Create a userscript that adds enhanced console logging capabilities. Log DOM changes, network requests, and user interactions with timestamps. Add a collapsible console panel in the page.',
            tags: ['developer', 'debugging', 'console'],
            usageCount: 0,
            rating: 0,
            isBuiltIn: true
        }
    ],

    /**
     * Load all templates
     * @returns {Template[]} Array of templates
     */
    loadTemplates() {
        try {
            const stored = safeJsonParse(GM_getValue(CONFIG.STORAGE_KEYS.templates, '[]'), []);
            const customTemplates = Array.isArray(stored) ? stored : [];
            
            // Merge built-in and custom templates
            return [...this.BUILT_IN_TEMPLATES, ...customTemplates];
        } catch (error) {
            debugLog('Failed to load templates', error);
            return [...this.BUILT_IN_TEMPLATES];
        }
    },

    /**
     * Save a custom template
     * @param {Omit<Template, 'id' | 'usageCount' | 'rating' | 'isBuiltIn'>} template - Template data
     * @returns {Template} Saved template
     */
    saveTemplate(template) {
        try {
            const stored = safeJsonParse(GM_getValue(CONFIG.STORAGE_KEYS.templates, '[]'), []);
            const templates = Array.isArray(stored) ? stored : [];
            
            const newTemplate = {
                ...template,
                id: generateId(),
                usageCount: 0,
                rating: 0,
                isBuiltIn: false
            };
            
            templates.push(newTemplate);
            GM_setValue(CONFIG.STORAGE_KEYS.templates, JSON.stringify(templates));
            
            return newTemplate;
        } catch (error) {
            debugLog('Failed to save template', error);
            throw new Error('Failed to save template');
        }
    },

    /**
     * Delete a template
     * @param {string} templateId - Template ID
     */
    deleteTemplate(templateId) {
        try {
            const stored = safeJsonParse(GM_getValue(CONFIG.STORAGE_KEYS.templates, '[]'), []);
            const templates = Array.isArray(stored) ? stored : [];
            const filtered = templates.filter(t => t.id !== templateId);
            GM_setValue(CONFIG.STORAGE_KEYS.templates, JSON.stringify(filtered));
        } catch (error) {
            debugLog('Failed to delete template', error);
            throw new Error('Failed to delete template');
        }
    },

    /**
     * Get templates by category
     * @param {string} category - Category name
     * @returns {Template[]} Templates in category
     */
    getTemplatesByCategory(category) {
        return this.loadTemplates().filter(t => t.category === category);
    },

    /**
     * Search templates
     * @param {string} query - Search query
     * @returns {Template[]} Matching templates
     */
    searchTemplates(query) {
        const lowerQuery = sanitizeText(query).toLowerCase();
        return this.loadTemplates().filter(t => 
            t.name.toLowerCase().includes(lowerQuery) ||
            t.description.toLowerCase().includes(lowerQuery) ||
            t.tags.some(tag => tag.toLowerCase().includes(lowerQuery))
        );
    },

    /**
     * Increment template usage
     * @param {string} templateId - Template ID
     */
    incrementUsage(templateId) {
        const templates = this.loadTemplates();
        const template = templates.find(t => t.id === templateId);
        if (template) {
            template.usageCount++;
            // Note: We don't persist usage count to avoid excessive writes
        }
    },

    /**
     * Get template by ID
     * @param {string} templateId - Template ID
     * @returns {Template|undefined} Template or undefined
     */
    getTemplate(templateId) {
        return this.loadTemplates().find(t => t.id === templateId);
    },

    /**
     * Export templates as JSON
     * @returns {string} JSON export
     */
    exportTemplates() {
        const templates = this.loadTemplates().filter(t => !t.isBuiltIn);
        return JSON.stringify({
            version: CONFIG.VERSION,
            exportedAt: Date.now(),
            templates
        }, null, 2);
    },

    /**
     * Import templates from JSON
     * @param {string} jsonData - JSON data
     * @returns {{imported: number, templates: Template[]}} Import result
     */
    importTemplates(jsonData) {
        try {
            const data = safeJsonParse(jsonData, null);
            if (!data || !Array.isArray(data.templates)) {
                throw new Error('Invalid import data format');
            }

            const imported = [];
            for (const template of data.templates) {
                if (template.name && template.prompt) {
                    const saveTemplate = {
                        ...template,
                        id: undefined, // Will be generated
                        usageCount: 0,
                        rating: 0,
                        isBuiltIn: false
                    };
                    imported.push(this.saveTemplate(saveTemplate));
                }
            }

            return { imported: imported.length, templates: imported };
        } catch (error) {
            debugLog('Failed to import templates', error);
            throw new Error('Failed to import templates');
        }
    }
};

// Export for module system
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { TemplatesModule };
}

// Export for userscript context
if (typeof window !== 'undefined') {
    window.UnifiedSuite.templates = TemplatesModule;
}