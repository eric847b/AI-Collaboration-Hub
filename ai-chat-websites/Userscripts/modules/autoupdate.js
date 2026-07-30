/**
 * Unified AI Assistant Suite - Auto-Update Module
 * @version 1.5.0
 * 
 * Checks for updates, downloads new versions, and handles
 * 3-way merge for user modifications.
 */

const CONFIG = (typeof window !== 'undefined' && window.UnifiedSuite?.CONFIG) || {};
const state = (typeof window !== 'undefined' && window.UnifiedSuite?.state) || {};
const debugLog = (typeof window !== 'undefined' && window.UnifiedSuite?.debugLog) || (() => {});

/**
 * @typedef {Object} UpdateInfo
 * @property {string} latestVersion - Latest available version
 * @property {string} currentVersion - Current installed version
 * @property {string} downloadUrl - URL to download update
 * @property {string} changelog - Release notes
 * @property {Date} releaseDate - Release date
 * @property {boolean} hasBreakingChanges - Whether update requires migration
 */

const AutoUpdateModule = {
    GITHUB_API: 'https://api.github.com/repos/eric847b/ai-chat-websites/releases/latest',
    UPDATE_CHECK_INTERVAL: 24 * 60 * 60 * 1000, // 24 hours
    
    /**
     * Check for updates
     * @returns {Promise<UpdateInfo|null>} Update info or null
     */
    async checkForUpdates() {
        try {
            const response = await fetch(this.GITHUB_API, {
                headers: { 'Accept': 'application/vnd.github.v3+json' }
            });
            
            if (!response.ok) throw new Error(`GitHub API error: ${response.status}`);
            
            const data = await response.json();
            
            const updateInfo = {
                latestVersion: data.tag_name?.replace('v', '') || data.name || 'unknown',
                currentVersion: CONFIG.VERSION || '0.0.0',
                downloadUrl: data.zipball_url || '',
                changelog: data.body || 'No changelog available',
                releaseDate: data.published_at ? new Date(data.published_at) : new Date(),
                hasBreakingChanges: (data.body || '').toLowerCase().includes('breaking change')
            };
            
            return updateInfo;
        } catch (error) {
            debugLog('Update check failed:', error);
            return null;
        }
    },

    /**
     * Check if update is available
     * @param {UpdateInfo} updateInfo - Update information
     * @returns {boolean} Whether update is available
     */
    isUpdateAvailable(updateInfo) {
        if (!updateInfo) return false;
        return this.compareVersions(updateInfo.latestVersion, updateInfo.currentVersion) > 0;
    },

    /**
     * Compare two semantic versions
     * @param {string} v1 - First version
     * @param {string} v2 - Second version
     * @returns {number} 1 if v1 > v2, -1 if v1 < v2, 0 if equal
     */
    compareVersions(v1, v2) {
        const parts1 = v1.split('.').map(Number);
        const parts2 = v2.split('.').map(Number);
        
        for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
            const p1 = parts1[i] || 0;
            const p2 = parts2[i] || 0;
            if (p1 > p2) return 1;
            if (p1 < p2) return -1;
        }
        return 0;
    },

    /**
     * Get last update check time
     * @returns {number} Last check timestamp
     */
    getLastCheckTime() {
        try {
            const stored = GM_getValue('update_last_check', '0');
            return parseInt(stored, 10) || 0;
        } catch {
            return 0;
        }
    },

    /**
     * Set last update check time
     * @param {number} timestamp - Check timestamp
     */
    setLastCheckTime(timestamp = Date.now()) {
        try {
            GM_setValue('update_last_check', String(timestamp));
        } catch {}
    },

    /**
     * Should check for updates now
     * @returns {boolean} Whether check is needed
     */
    shouldCheck() {
        const lastCheck = this.getLastCheckTime();
        return (Date.now() - lastCheck) > this.UPDATE_CHECK_INTERVAL;
    },

    /**
     * Auto-check for updates if interval has passed
     * @returns {Promise<UpdateInfo|null>} Update info
     */
    async autoCheck() {
        if (!this.shouldCheck()) return null;
        
        const updateInfo = await this.checkForUpdates();
        this.setLastCheckTime();
        
        if (updateInfo && this.isUpdateAvailable(updateInfo)) {
            this.notifyUpdate(updateInfo);
        }
        
        return updateInfo;
    },

    /**
     * Show update notification badge
     * @param {UpdateInfo} updateInfo - Update information
     */
    notifyUpdate(updateInfo) {
        const badge = document.createElement('div');
        badge.id = 'update-badge';
        badge.style.cssText = 'position:fixed;bottom:20px;right:20px;background:#3b82f6;color:white;padding:12px 20px;border-radius:8px;box-shadow:0 4px 12px rgba(0,0,0,0.3);z-index:99999;cursor:pointer;font-family:system-ui,sans-serif;font-size:14px;display:flex;align-items:center;gap:10px;animation:slideIn 0.3s ease';
        badge.innerHTML = `
            <span>⬆️</span>
            <div>
                <strong>Update Available</strong><br>
                <small style="opacity:0.8">v${updateInfo.currentVersion} → v${updateInfo.latestVersion}</small>
            </div>
            <button style="background:rgba(255,255,255,0.2);border:none;color:white;border-radius:4px;padding:4px 8px;cursor:pointer;margin-left:8px;font-size:12px">Update</button>
            <button id="dismiss-update" style="background:none;border:none;color:white;cursor:pointer;margin-left:4px;font-size:16px;opacity:0.6">×</button>
        `;
        
        document.body.appendChild(badge);
        
        // Dismiss handler
        badge.querySelector('#dismiss-update').addEventListener('click', () => badge.remove());
        
        // Update button handler
        badge.querySelector('button:not(#dismiss-update)').addEventListener('click', () => {
            window.open(updateInfo.downloadUrl, '_blank');
            badge.remove();
        });
    },

    /**
     * Stash user modifications before update
     * @returns {Object} Stashed modifications
     */
    stashModifications() {
        const scripts = [];
        try {
            const stored = GM_getValue(CONFIG.STORAGE_KEYS.history, '[]');
            const parsed = JSON.parse(stored);
            if (Array.isArray(parsed)) {
                parsed.forEach(script => {
                    if (script.content) {
                        scripts.push({
                            id: script.id,
                            content: script.content,
                            name: script.name || 'Unknown',
                            timestamp: script.timestamp || Date.now()
                        });
                    }
                });
            }
        } catch {}
        return { scripts, stashedAt: Date.now() };
    },

    /**
     * Perform 3-way merge for a user-modified script
     * @param {string} originalContent - Original script content
     * @param {string} userContent - User-modified content
     * @param {string} newContent - New version content
     * @returns {string} Merged content
     */
    threeWayMerge(originalContent, userContent, newContent) {
        // Simple line-based 3-way merge
        const originalLines = originalContent.split('\n');
        const userLines = userContent.split('\n');
        const newLines = newContent.split('\n');
        
        const merged = [];
        const maxLen = Math.max(originalLines.length, userLines.length, newLines.length);
        
        for (let i = 0; i < maxLen; i++) {
            const orig = originalLines[i] ?? '';
            const user = userLines[i] ?? '';
            const next = newLines[i] ?? '';
            
            // If user didn't change this line, use new version
            if (orig === user) {
                merged.push(next);
            // If original is same as new, user added this line
            } else if (orig === next) {
                merged.push(user);
            // User modified, new didn't change
            } else if (orig !== user && orig === next) {
                merged.push(user);
            // Both changed - use user's version with comment
            } else {
                merged.push(user);
                merged.push(`// MERGE CONFLICT: Line ${i + 1} was changed in both versions`);
                merged.push(`// Original: ${orig}`);
                merged.push(`// New: ${next}`);
            }
        }
        
        return merged.join('\n');
    },

    /**
     * Check if UI module is loaded
     * @returns {boolean}
     */
    isAvailable() {
        return typeof GM_getValue !== 'undefined' && typeof GM_setValue !== 'undefined';
    }
};

// Export for module system
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { AutoUpdateModule };
}

// Export for userscript context
if (typeof window !== 'undefined') {
    window.UnifiedSuite.autoupdate = AutoUpdateModule;
}