/**
 * Unified AI Assistant Suite - Versioning Module
 * @version 1.3.0
 */

// Get dependencies from global UnifiedSuite object
const CONFIG = (typeof window !== 'undefined' && window.UnifiedSuite?.CONFIG) || {};
const state = (typeof window !== 'undefined' && window.UnifiedSuite?.state) || {};
const updateState = (typeof window !== 'undefined' && window.UnifiedSuite?.updateState) || (() => {});
const debugLog = (typeof window !== 'undefined' && window.UnifiedSuite?.debugLog) || (() => {});
const sanitizeText = (typeof window !== 'undefined' && window.UnifiedSuite?.sanitizeText) || ((text) => String(text ?? '').trim());
const safeJsonParse = (typeof window !== 'undefined' && window.UnifiedSuite?.safeJsonParse) || ((v, fb) => { try { return JSON.parse(v); } catch { return fb; } });

/**
 * Versioning Module - Handles script versioning and diff view
 */
const VersioningModule = {
    /**
     * Save a script version
     * @param {string} scriptId - Script ID
     * @param {string} content - Script content
     * @param {string} changeMessage - Change message
     */
    saveVersion(scriptId, content, changeMessage = 'Auto-save') {
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
     * @returns {Array} Array of versions
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
     * Create diff view between two versions
     * @param {string} oldContent - Old content
     * @param {string} newContent - New content
     * @returns {string} Diff view
     */
    createDiff(oldContent, newContent) {
        const oldLines = oldContent.split('\n');
        const newLines = newContent.split('\n');
        const diff = [];
        
        for (let i = 0; i < Math.max(oldLines.length, newLines.length); i++) {
            if (oldLines[i] !== newLines[i]) {
                if (oldLines[i]) diff.push('- ' + oldLines[i]);
                if (newLines[i]) diff.push('+ ' + newLines[i]);
            }
        }
        
        return diff.join('\n');
    },

    /**
     * Render versions tab
     * @param {string} scriptId - Script ID
     */
    renderVersionsTab(scriptId) {
        const container = document.getElementById('versions-list');
        if (!container) return;
        
        const versions = this.loadVersions(scriptId || state.currentScriptId);
        if (!versions.length) {
            container.innerHTML = '<p class="no-versions">No versions saved yet.</p>';
            return;
        }
        
        container.innerHTML = versions.map(v => `
            <div class="version-item" data-version="${v.version}">
                <span class="version-number">v${v.version}</span>
                <span class="version-date">${new Date(v.timestamp).toLocaleString()}</span>
                <button class="btn-secondary view-diff-btn" data-version="${v.version}">View</button>
                <button class="btn-secondary rollback-btn" data-version="${v.version}">Rollback</button>
            </div>
        `).join('');
        
        // View diff button
        container.querySelectorAll('.view-diff-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const ver = versions.find(v => v.version === parseInt(btn.dataset.version));
                if (!ver) return;
                
                const diff = state.currentScript?.content 
                    ? this.createDiff(ver.content, state.currentScript.content) 
                    : '';
                
                const diffArea = document.getElementById('diff-output');
                if (diffArea) {
                    diffArea.textContent = diff || 'No differences';
                    diffArea.style.display = 'block';
                }
            });
        });
        
        // Rollback button
        container.querySelectorAll('.rollback-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const ver = versions.find(v => v.version === parseInt(btn.dataset.version));
                if (!ver || !state.currentScript) return;
                
                state.currentScript.content = ver.content;
                state.currentScript.validation = this.validateScript(ver.content);
                
                const ui = document.getElementById(CONFIG.UI_ID);
                if (ui) {
                    const scriptOutput = ui.querySelector('#script-output');
                    if (scriptOutput) scriptOutput.textContent = ver.content;
                    
                    const validationResults = ui.querySelector('#validation-results');
                    if (validationResults) {
                        validationResults.textContent = `Rolled back to v${ver.version}`;
                    }
                }
            });
        });
    },

    /**
     * Validate script
     * @param {string} script - Script content
     * @returns {Object} Validation result
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
     * Export all scripts as JSON
     * @returns {string} JSON export
     */
    exportAll() {
        const storage = window.UnifiedSuite?.storage;
        if (storage) {
            return storage.exportAllScripts();
        }
        return JSON.stringify({ version: CONFIG.VERSION, exportedAt: Date.now(), scripts: [] }, null, 2);
    },

    /**
     * Import scripts from JSON
     * @param {string} jsonData - JSON data
     * @returns {Object} Import result
     */
    importAll(jsonData) {
        const storage = window.UnifiedSuite?.storage;
        if (storage) {
            return storage.importScripts(jsonData);
        }
        return { imported: 0, scripts: [] };
    }
};

// Export for module system
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { VersioningModule };
}

// Export for userscript context
if (typeof window !== 'undefined') {
    window.UnifiedSuite.versioning = VersioningModule;
}