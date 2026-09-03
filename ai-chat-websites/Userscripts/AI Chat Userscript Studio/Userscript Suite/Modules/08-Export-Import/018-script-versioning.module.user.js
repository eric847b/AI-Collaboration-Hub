// ==UserScript==
// @name         Script Versioning System
// @namespace    AI-Chat-Userscript-Studio
// @version      1.2.0
// @description  Version control system for generated scripts with diff view support
// @match        *://*/*
// @grant        GM_getValue
// @grant        GM_setValue
// @run-at       document-idle
// ==/UserScript==

/**
 * AI Chat Userscript Studio - Script Versioning Module
 *
 * Provides version control for generated scripts with:
 * - Automatic versioning on save
 * - Version history storage
 * - Diff view between versions
 * - Export/import all versions
 */

(function() {
    'use strict';

    const MODULE_ID = '16-script-versioning';
    const MODULE_NAME = 'Script Versioning';
    const MODULE_VERSION = '1.2.0';
    const STORAGE_KEY = 'unified_ai_suite_versions';
    const MAX_VERSIONS_PER_SCRIPT = 10;

    class ScriptVersioning {
        constructor() {
            this.dependencies = [];
            this.critical = false;
            this.config = {
                enabled: true,
                maxVersionsPerScript: MAX_VERSIONS_PER_SCRIPT,
                autoSaveOnUpdate: true
            };
            this.state = {
                initialized: false,
                totalVersions: 0
            };
        }

        async init() {
            try {
                console.log(`[${MODULE_ID}] Initializing ${MODULE_NAME} v${MODULE_VERSION}`);
                this.loadConfig();
                this.exposeAPI();
                this.state.initialized = true;
                console.log(`[${MODULE_ID}] Initialization complete`);
                return true;
            } catch (error) {
                console.error(`[${MODULE_ID}] Initialization failed:`, error);
                return false;
            }
        }

        checkDependencies() { return typeof GM_getValue !== 'undefined'; }

        loadConfig() {
            try {
                const stored = localStorage.getItem(`${MODULE_ID}-config`);
                if (stored) this.config = { ...this.config, ...JSON.parse(stored) };
            } catch (error) {
                console.warn(`[${MODULE_ID}] Failed to load config:`, error);
            }
        }

        saveConfig() {
            try { localStorage.setItem(`${MODULE_ID}-config`, JSON.stringify(this.config)); }
            catch (error) { console.warn(`[${MODULE_ID}] Failed to save config:`, error); }
        }

        saveScriptVersion(scriptId, content, changeMessage = 'Auto-save') {
            try {
                const versions = this.safeJsonParse(GM_getValue(STORAGE_KEY, '{}'), {});
                const sv = versions[scriptId] || [];
                sv.unshift({
                    version: sv.length + 1,
                    content,
                    changeMessage,
                    timestamp: Date.now()
                });
                GM_setValue(STORAGE_KEY, JSON.stringify({
                    ...versions,
                    [scriptId]: sv.slice(0, this.config.maxVersionsPerScript)
                }));
                this.state.totalVersions++;
                return sv[0].version;
            } catch (error) {
                console.error(`[${MODULE_ID}] Failed to save version:`, error);
                return null;
            }
        }

        loadVersions(scriptId) {
            try {
                const versions = this.safeJsonParse(GM_getValue(STORAGE_KEY, '{}'), {});
                return versions[scriptId] || [];
            } catch (error) {
                console.error(`[${MODULE_ID}] Failed to load versions:`, error);
                return [];
            }
        }

        createDiffView(oldContent, newContent) {
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
        }

        exportAll(data = {}) {
            try {
                const versions = this.safeJsonParse(GM_getValue(STORAGE_KEY, '{}'), {});
                return JSON.stringify({
                    version: MODULE_VERSION,
                    exportedAt: Date.now(),
                    scripts: data.scripts || [],
                    versionHistory: versions
                }, null, 2);
            } catch (error) {
                console.error(`[${MODULE_ID}] Export failed:`, error);
                return null;
            }
        }

        importAll(jsonData) {
            try {
                const data = this.safeJsonParse(jsonData, null);
                if (!data || !Array.isArray(data.scripts)) {
                    throw new Error('Invalid import data format');
                }
                const imported = [];
                for (const s of data.scripts) {
                    if (s.content && s.id) {
                        imported.push(s);
                    }
                }
                return { imported: imported.length, scripts: imported };
            } catch (error) {
                console.error(`[${MODULE_ID}] Import failed:`, error);
                throw error;
            }
        }

        safeJsonParse(value, fallback) {
            if (!value) return fallback;
            try { return JSON.parse(value); }
            catch { return fallback; }
        }

        exposeAPI() {
            window[`${MODULE_ID}_api`] = {
                getConfig: () => this.getConfig(),
                setConfig: (cfg) => this.setConfig(cfg),
                init: () => this.init(),
                destroy: () => this.destroy(),
                saveVersion: (id, content, msg) => this.saveScriptVersion(id, content, msg),
                loadVersions: (id) => this.loadVersions(id),
                createDiff: (old, ne) => this.createDiffView(old, ne),
                exportAll: (data) => this.exportAll(data),
                importAll: (json) => this.importAll(json)
            };
            window[`${MODULE_ID}_instance`] = this;
        }

        getConfig() { return { ...this.config }; }
        setConfig(newConfig) { this.config = { ...this.config, ...newConfig }; this.saveConfig(); }
        destroy() {
            delete window[`${MODULE_ID}_api`];
            delete window[`${MODULE_ID}_instance`];
            this.state.initialized = false;
        }
    }

    const instance = new ScriptVersioning();
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => instance.init());
    } else {
        instance.init();
    }
    window.addEventListener('beforeunload', () => instance.destroy());
})();