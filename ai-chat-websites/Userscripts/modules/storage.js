/**
 * Unified AI Assistant Suite - Storage Module
 * @version 1.3.0
 */

/**
 * @typedef {Object} StoredScript
 * @property {string} id - Script ID
 * @property {number} timestamp - Creation timestamp
 * @property {string} filename - Script filename
 * @property {string} name - Script name
 * @property {string} sourcePreview - Source prompt preview
 * @property {Object} validation - Validation results
 * @property {string} content - Script content
 */

/**
 * @typedef {Object} ScriptVersion
 * @property {number} version - Version number
 * @property {string} content - Script content
 * @property {string} changeMessage - Change message
 * @property {number} timestamp - Version timestamp
 */

/**
 * @typedef {Object} ModuleHealth
 * @property {string} status - Module status (ok/error/warning)
 * @property {number} lastCheck - Last health check timestamp
 * @property {string} error - Error message if failed
 */

// Get dependencies from global UnifiedSuite object
const CONFIG = (typeof window !== 'undefined' && window.UnifiedSuite?.CONFIG) || {};
const state = (typeof window !== 'undefined' && window.UnifiedSuite?.state) || {};
const updateState = (typeof window !== 'undefined' && window.UnifiedSuite?.updateState) || (() => {});
const debugLog = (typeof window !== 'undefined' && window.UnifiedSuite?.debugLog) || (() => {});
const sanitizeText = (typeof window !== 'undefined' && window.UnifiedSuite?.sanitizeText) || ((text) => String(text ?? '').trim());
const safeJsonParse = (typeof window !== 'undefined' && window.UnifiedSuite?.safeJsonParse) || ((v, fb) => { try { return JSON.parse(v); } catch { return fb; } });
const generateId = (typeof window !== 'undefined' && window.UnifiedSuite?.generateId) || (() => `script_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`);
const deriveScriptName = (typeof window !== 'undefined' && window.UnifiedSuite?.deriveScriptName) || ((script) => { const m = String(script ?? '').match(/@name\s+(.+)/); return m ? m[1].trim() : ''; });
const generateFilename = (typeof window !== 'undefined' && window.UnifiedSuite?.generateFilename) || ((script, fallback = `generated-${Date.now()}`) => { const name = deriveScriptName(script).replace(/[^\w.-]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase(); return `${name || fallback}.user.js`; });
const deriveDescription = (typeof window !== 'undefined' && window.UnifiedSuite?.deriveDescription) || ((text) => { const clean = String(text ?? '').replace(/```[\s\S]*?```/g, ' ').replace(/\s+/g, ' ').trim(); return clean || 'Auto-generated from AI'; });

/**
 * Storage Module - Handles all GM storage operations
 */
const StorageModule = {
    /**
     * Load generated scripts from storage
     * @returns {StoredScript[]} Array of stored scripts
     */
    loadGeneratedScripts() {
        try {
            const stored = safeJsonParse(GM_getValue(CONFIG.STORAGE_KEYS.history, '[]'), []);
            return Array.isArray(stored) ? stored.filter(Boolean) : [];
        } catch (error) {
            debugLog('Failed to load generated scripts', error);
            return [];
        }
    },

    /**
     * Save a generated script
     * @param {string|Object} script - Script content or object
     * @param {Object} validation - Validation results
     * @param {string} sourceText - Source prompt text
     * @returns {StoredScript} Saved script record
     */
    saveGeneratedScript(script, validation, sourceText) {
        try {
            const content = typeof script === 'string' ? script : sanitizeText(script?.content);
            const scriptId = script?.id || generateId();
            const scriptValidation = validation || script?.validation || this.validateScript(content);
            const history = this.loadGeneratedScripts().filter(item => item && item.id !== scriptId);
            const filename = script?.filename || generateFilename(content);
            const name = script?.name || deriveScriptName(content) || filename.replace(/\.user\.js$/, '');
            
            const record = {
                id: scriptId,
                timestamp: Date.now(),
                filename,
                name,
                sourcePreview: deriveDescription(sourceText).slice(0, 160),
                validation: scriptValidation,
                content
            };
            
            history.unshift(record);
            const limitedHistory = history.slice(0, CONFIG.MAX_HISTORY_ITEMS);
            GM_setValue(CONFIG.STORAGE_KEYS.history, JSON.stringify(limitedHistory));
            updateState('generatedScripts', limitedHistory);
            
            return record;
        } catch (error) {
            debugLog('Failed to save generated script', error);
            throw new Error('Failed to save script');
        }
    },

    /**
     * Export all scripts as JSON
     * @returns {string} JSON export
     */
    exportAllScripts() {
        const scripts = this.loadGeneratedScripts();
        return JSON.stringify({
            version: CONFIG.VERSION,
            exportedAt: Date.now(),
            scripts: scripts.map(s => ({
                id: s.id,
                filename: s.filename,
                name: s.name,
                content: s.content,
                validation: s.validation,
                timestamp: s.timestamp
            }))
        }, null, 2);
    },

    /**
     * Import scripts from JSON
     * @param {string} jsonData - JSON data to import
     * @returns {{imported: number, scripts: StoredScript[]}} Import result
     */
    importScripts(jsonData) {
        try {
            const data = safeJsonParse(jsonData, null);
            if (!data || !Array.isArray(data.scripts)) {
                throw new Error('Invalid import data format');
            }
            
            const imported = [];
            for (const s of data.scripts) {
                if (s.content) {
                    imported.push(this.saveGeneratedScript(s.content, s.validation, s.prompt || ''));
                }
            }
            
            return { imported: imported.length, scripts: imported };
        } catch (error) {
            debugLog('Failed to import scripts', error);
            throw new Error('Failed to import scripts');
        }
    },

    /**
     * Save a script version
     * @param {string} scriptId - Script ID
     * @param {string} content - Script content
     * @param {string} changeMessage - Change message
     */
    saveScriptVersion(scriptId, content, changeMessage = 'Auto-save') {
        try {
            const versions = safeJsonParse(GM_getValue(CONFIG.STORAGE_KEYS.versions, '{}'), {});
            const sv = versions[scriptId] || [];
            sv.unshift({
                version: sv.length + 1,
                content,
                changeMessage,
                timestamp: Date.now()
            });
            GM_setValue(CONFIG.STORAGE_KEYS.versions, JSON.stringify({
                ...versions,
                [scriptId]: sv.slice(0, CONFIG.MAX_VERSIONS_PER_SCRIPT)
            }));
        } catch (error) {
            debugLog('Failed to save script version', error);
        }
    },

    /**
     * Load versions for a script
     * @param {string} scriptId - Script ID
     * @returns {ScriptVersion[]} Array of versions
     */
    loadVersions(scriptId) {
        try {
            const versions = safeJsonParse(GM_getValue(CONFIG.STORAGE_KEYS.versions, '{}'), {});
            return versions[scriptId] || [];
        } catch (error) {
            debugLog('Failed to load script versions', error);
            return [];
        }
    },

    /**
     * Validate script
     * @param {string} script - Script content
     * @returns {{isValid: boolean, issues: string[], warnings: string[], score: number}} Validation result
     */
    validateScript(script) {
        const issues = [];
        const warnings = [];
        const normalizedScript = sanitizeText(script);
        
        if (!normalizedScript.includes('// ==UserScript==')) {
            issues.push('Missing userscript metadata block');
        }
        if (!/@match\s+|@include\s+/m.test(normalizedScript)) {
            warnings.push('No @match or @include rule detected');
        }
        if (!/\(function\s*\(\)\s*\{/.test(normalizedScript)) {
            warnings.push('Script is missing the standard IIFE wrapper');
        }
        if (/\beval\s*\(/.test(normalizedScript)) {
            warnings.push('Use of eval() detected; consider safer alternatives');
        }
        if (/\bdocument\.write\s*\(/.test(normalizedScript)) {
            warnings.push('document.write() usage may cause issues on modern pages');
        }
        if (/\.innerHTML\s*=/.test(normalizedScript)) {
            warnings.push('Direct innerHTML assignment detected; sanitize dynamic content carefully');
        }
        
        try {
            new Function(normalizedScript);
        } catch (error) {
            issues.push(`Syntax error: ${error.message}`);
        }
        
        if (normalizedScript.length > CONFIG.MAX_SCRIPT_LENGTH) {
            warnings.push('Script may be too large; consider splitting features into modules');
        }
        
        const score = Math.max(0, 100 - (issues.length * 20) - (warnings.length * 5) - (normalizedScript.length > 5000 ? 10 : 0));
        
        return {
            isValid: issues.length === 0,
            issues,
            warnings,
            score
        };
    },

    /**
     * Update module health status
     * @param {string} moduleName - Module name
     * @param {string} status - Status (ok/error/warning)
     * @param {string} error - Error message if failed
     */
    updateModuleHealth(moduleName, status, error = '') {
        try {
            const health = safeJsonParse(GM_getValue(CONFIG.STORAGE_KEYS.moduleHealth, '{}'), {});
            health[moduleName] = {
                status,
                lastCheck: Date.now(),
                error: error || null
            };
            GM_setValue(CONFIG.STORAGE_KEYS.moduleHealth, JSON.stringify(health));
            
            if (state.moduleHealth[moduleName]) {
                state.moduleHealth[moduleName] = { status, lastCheck: Date.now(), error: error || null };
            }
        } catch (err) {
            debugLog('Failed to update module health', err);
        }
    },

    /**
     * Get module health status
     * @param {string} moduleName - Module name
     * @returns {ModuleHealth|Object} Module health status
     */
    getModuleHealth(moduleName) {
        try {
            const health = safeJsonParse(GM_getValue(CONFIG.STORAGE_KEYS.moduleHealth, '{}'), {});
            return health[moduleName] || null;
        } catch (error) {
            debugLog('Failed to get module health', error);
            return null;
        }
    }
};

// Re-export utility functions for convenience
const { generateId, deriveScriptName, generateFilename, deriveDescription } = window.UnifiedSuite;

// Export for module system
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { StorageModule };
}

// Export for userscript context
if (typeof window !== 'undefined') {
    window.UnifiedSuite.storage = StorageModule;
}