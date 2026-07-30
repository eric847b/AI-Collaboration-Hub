/**
 * Unified AI Assistant Suite - Context Analysis Module
 * @version 1.5.0
 * 
 * Analyzes webpage content to provide context-aware prompt enhancement.
 * Extracts page metadata, DOM structure, and user interactions.
 */

// Get dependencies from global UnifiedSuite object
const CONFIG = (typeof window !== 'undefined' && window.UnifiedSuite?.CONFIG) || {};
const state = (typeof window !== 'undefined' && window.UnifiedSuite?.state) || {};
const debugLog = (typeof window !== 'undefined' && window.UnifiedSuite?.debugLog) || (() => {});
const sanitizeText = (typeof window !== 'undefined' && window.UnifiedSuite?.sanitizeText) || ((text) => String(text ?? '').trim());

/**
 * @typedef {Object} PageContext
 * @property {string} title - Page title
 * @property {string} url - Page URL
 * @property {string} domain - Page domain
 * @property {string} description - Meta description
 * @property {string} mainContent - Main text content
 * @property {string[]} headings - Page headings
 * @property {string[]} links - Page links
 * @property {string} contentType - Content type (article, form, video, etc.)
 * @property {Object} forms - Form field information
 * @property {number} textLength - Total text length
 */

/**
 * Context Analysis Module
 */
const ContextModule = {
    /**
     * Analyze current page context
     * @returns {PageContext} Page context object
     */
    analyzePage() {
        try {
            const context = {
                title: document.title || '',
                url: window.location.href || '',
                domain: window.location.hostname || '',
                description: this.getMetaDescription(),
                mainContent: this.extractMainContent(),
                headings: this.extractHeadings(),
                links: this.extractLinks(),
                contentType: this.detectContentType(),
                forms: this.analyzeForms(),
                textLength: 0
            };
            
            context.textLength = context.mainContent.length;
            
            debugLog('Page context analyzed:', context);
            return context;
        } catch (error) {
            debugLog('Failed to analyze page context:', error);
            return this.getDefaultContext();
        }
    },

    /**
     * Get meta description from page
     * @returns {string} Meta description
     */
    getMetaDescription() {
        const meta = document.querySelector('meta[name="description"]') || 
                     document.querySelector('meta[property="og:description"]');
        return meta ? sanitizeText(meta.getAttribute('content') || '') : '';
    },

    /**
     * Extract main content from page
     * @returns {string} Main text content
     */
    extractMainContent() {
        // Try common content containers
        const selectors = [
            'article',
            '[role="main"]',
            'main',
            '.post-content',
            '.entry-content',
            '.content',
            '#content',
            '.article-body'
        ];
        
        for (const selector of selectors) {
            const element = document.querySelector(selector);
            if (element) {
                return sanitizeText(element.textContent || '').slice(0, 2000);
            }
        }
        
        // Fallback: get body text
        return sanitizeText(document.body?.textContent || '').slice(0, 1000);
    },

    /**
     * Extract headings from page
     * @returns {string[]} Array of heading texts
     */
    extractHeadings() {
        const headings = [];
        document.querySelectorAll('h1, h2, h3').forEach(h => {
            const text = sanitizeText(h.textContent || '');
            if (text) headings.push(text);
        });
        return headings.slice(0, 10);
    },

    /**
     * Extract links from page
     * @returns {string[]} Array of link URLs
     */
    extractLinks() {
        const links = [];
        document.querySelectorAll('a[href]').forEach(a => {
            const href = a.getAttribute('href');
            if (href && !href.startsWith('javascript:') && !href.startsWith('#')) {
                links.push(href);
            }
        });
        return links.slice(0, 20);
    },

    /**
     * Detect content type of the page
     * @returns {string} Content type
     */
    detectContentType() {
        const url = window.location.href;
        const body = document.body?.textContent || '';
        
        if (document.querySelector('article') || document.querySelector('.post')) {
            return 'article';
        }
        if (document.querySelector('form') && document.querySelector('input[type="text"]')) {
            return 'form';
        }
        if (document.querySelector('video') || document.querySelector('iframe[src*="youtube"]')) {
            return 'video';
        }
        if (document.querySelector('table') || document.querySelector('.table')) {
            return 'data';
        }
        if (body.length > 5000) {
            return 'long-form';
        }
        return 'general';
    },

    /**
     * Analyze forms on the page
     * @returns {Object} Form information
     */
    analyzeForms() {
        const forms = document.querySelectorAll('form');
        const formInfo = {
            count: forms.length,
            fields: []
        };
        
        forms.forEach((form, i) => {
            const inputs = form.querySelectorAll('input, textarea, select');
            inputs.forEach(input => {
                if (input.type !== 'hidden' && input.type !== 'submit') {
                    formInfo.fields.push({
                        name: input.name || input.id || `field_${i}`,
                        type: input.type || 'text',
                        placeholder: input.placeholder || ''
                    });
                }
            });
        });
        
        return formInfo;
    },

    /**
     * Generate enhanced prompt based on page context
     * @param {string} userPrompt - Original user prompt
     * @returns {string} Enhanced prompt with context
     */
    enhancePrompt(userPrompt) {
        const context = this.analyzePage();
        
        // Build context string
        const contextParts = [];
        
        if (context.title) {
            contextParts.push(`Page Title: "${context.title}"`);
        }
        
        if (context.description) {
            contextParts.push(`Description: "${context.description}"`);
        }
        
        if (context.headings.length > 0) {
            contextParts.push(`Page Structure: ${context.headings.join(' > ')}`);
        }
        
        if (context.contentType !== 'general') {
            contextParts.push(`Content Type: ${context.contentType}`);
        }
        
        if (context.forms.count > 0) {
            contextParts.push(`Forms Found: ${context.forms.count} form(s) with ${context.forms.fields.length} field(s)`);
        }
        
        // Build enhanced prompt
        let enhanced = userPrompt;
        
        if (contextParts.length > 0) {
            enhanced = `Context: This script will run on ${context.domain}.\n`;
            enhanced += contextParts.join('\n');
            enhanced += `\n\nUser Request: ${userPrompt}`;
        }
        
        return enhanced;
    },

    /**
     * Get default context (fallback)
     * @returns {PageContext} Default context
     */
    getDefaultContext() {
        return {
            title: '',
            url: '',
            domain: '',
            description: '',
            mainContent: '',
            headings: [],
            links: [],
            contentType: 'general',
            forms: { count: 0, fields: [] },
            textLength: 0
        };
    },

    /**
     * Check if context analysis is available
     * @returns {boolean} Whether context analysis is available
     */
    isAvailable() {
        return typeof document !== 'undefined' && document.body !== null;
    }
};

// Export for module system
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { ContextModule };
}

// Export for userscript context
if (typeof window !== 'undefined') {
    window.UnifiedSuite.context = ContextModule;
}