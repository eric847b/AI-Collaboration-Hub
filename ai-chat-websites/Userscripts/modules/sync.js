/**
 * Unified AI Assistant Suite - Sync & Collaboration Module
 * @version 1.7.0
 * 
 * GitHub Gist sync for templates, export/import, and team collaboration features.
 */

const CONFIG = (typeof window !== 'undefined' && window.UnifiedSuite?.CONFIG) || {};
const state = (typeof window !== 'undefined' && window.UnifiedSuite?.state) || {};
const debugLog = (typeof window !== 'undefined' && window.UnifiedSuite?.debugLog) || (() => {});

const SyncModule = {
    GIST_API: 'https://api.github.com/gists',
    gistCache: new Map(),

    /**
     * Export templates to GitHub Gist
     * @param {Array} templates - Templates to sync
     * @param {string} token - GitHub personal access token
     * @returns {Promise<Object>} Gist result
     */
    async exportToGist(templates, token) {
        try {
            const content = JSON.stringify(templates, null, 2);
            const response = await fetch(this.GIST_API, {
                method: 'POST',
                headers: {
                    'Authorization': `token ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    description: 'AI Assistant Suite - Templates Export',
                    public: false,
                    files: {
                        'ai-assistant-templates.json': { content }
                    }
                })
            });
            
            if (!response.ok) throw new Error(`Gist API error: ${response.status}`);
            const gist = await response.json();
            
            this.gistCache.set(gist.id, { id: gist.id, url: gist.html_url, templates });
            debugLog(`Templates exported to Gist: ${gist.html_url}`);
            return { id: gist.id, url: gist.html_url };
        } catch (error) {
            debugLog('Gist export failed:', error);
            throw error;
        }
    },

    /**
     * Import templates from GitHub Gist
     * @param {string} gistId - Gist ID or URL
     * @param {string} token - GitHub personal access token
     * @returns {Promise<Array>} Imported templates
     */
    async importFromGist(gistId, token) {
        try {
            // Extract ID from URL if needed
            const id = gistId.includes('gist.github.com') 
                ? gistId.split('/').pop() 
                : gistId;
            
            const headers = { 'Accept': 'application/vnd.github.v3+json' };
            if (token) headers['Authorization'] = `token ${token}`;
            
            const response = await fetch(`${this.GIST_API}/${id}`, { headers });
            if (!response.ok) throw new Error(`Gist API error: ${response.status}`);
            
            const gist = await response.json();
            const file = Object.values(gist.files)[0];
            if (!file) throw new Error('No files found in gist');
            
            const templates = JSON.parse(file.content);
            this.gistCache.set(id, { id, url: gist.html_url, templates });
            
            debugLog(`Templates imported from Gist: ${gist.html_url}`);
            return Array.isArray(templates) ? templates : [];
        } catch (error) {
            debugLog('Gist import failed:', error);
            throw error;
        }
    },

    /**
     * Update an existing Gist
     * @param {string} gistId - Gist ID
     * @param {Array} templates - Updated templates
     * @param {string} token - GitHub token
     * @returns {Promise<Object>} Updated gist
     */
    async updateGist(gistId, templates, token) {
        try {
            const response = await fetch(`${this.GIST_API}/${gistId}`, {
                method: 'PATCH',
                headers: {
                    'Authorization': `token ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    files: {
                        'ai-assistant-templates.json': { 
                            content: JSON.stringify(templates, null, 2) 
                        }
                    }
                })
            });
            
            if (!response.ok) throw new Error(`Gist API error: ${response.status}`);
            const gist = await response.json();
            this.gistCache.set(gistId, { id: gistId, url: gist.html_url, templates });
            return { id: gist.id, url: gist.html_url };
        } catch (error) {
            debugLog('Gist update failed:', error);
            throw error;
        }
    },

    /**
     * Export templates as downloadable JSON
     * @param {Array} templates - Templates to export
     * @returns {string} JSON string
     */
    exportToJSON(templates) {
        const data = {
            version: '1.0',
            exportedAt: new Date().toISOString(),
            appVersion: CONFIG.VERSION || 'unknown',
            templates
        };
        return JSON.stringify(data, null, 2);
    },

    /**
     * Import templates from JSON string
     * @param {string} json - JSON string
     * @returns {Array} Imported templates
     */
    importFromJSON(json) {
        try {
            const data = JSON.parse(json);
            if (data.version && Array.isArray(data.templates)) {
                debugLog(`Imported ${data.templates.length} templates from JSON`);
                return data.templates;
            }
            if (Array.isArray(data)) {
                debugLog(`Imported ${data.length} templates from JSON`);
                return data;
            }
            throw new Error('Invalid template format');
        } catch (error) {
            debugLog('JSON import failed:', error);
            throw error;
        }
    },

    /**
     * Get cached gists
     * @returns {Array} Cached gist list
     */
    getCachedGists() {
        return Array.from(this.gistCache.values());
    },

    /**
     * Clear gist cache
     */
    clearCache() {
        this.gistCache.clear();
    },

    /**
     * Check if module is available
     * @returns {boolean}
     */
    isAvailable() {
        return typeof fetch !== 'undefined';
    }
};

// Export for module system
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { SyncModule };
}

// Export for userscript context
if (typeof window !== 'undefined') {
    window.UnifiedSuite.sync = SyncModule;
}