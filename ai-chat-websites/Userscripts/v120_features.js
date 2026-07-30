    // ========== V1.2.0 FEATURES ==========

    /**
     * Execute function with exponential backoff retry logic
     * @param {Function} fn - Async function to execute
     * @param {number} maxRetries - Maximum retry attempts
     * @param {number} baseDelay - Base delay in ms
     * @returns {Promise<any>} Function result
     */
    async function withRetry(fn, maxRetries = CONFIG.RETRY.maxRetries, baseDelay = CONFIG.RETRY.baseDelay) {
        let lastError;
        let totalTime = 0;
        const startTime = Date.now();

        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            try {
                return await fn();
            } catch (error) {
                lastError = error;
                totalTime = Date.now() - startTime;

                if (attempt < maxRetries && totalTime < CONFIG.RETRY.maxTotalTime) {
                    const delay = baseDelay * Math.pow(CONFIG.RETRY.backoffFactor, attempt);
                    debugLog(`Retry attempt ${attempt + 1}/${maxRetries} after ${delay}ms, error:`, error.message);
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
            }
        }

        throw lastError;
    }

    /**
     * Save script version to version history
     * @param {string} scriptId - Script ID
     * @param {string} content - Script content
     * @param {string} changeMessage - Change description
     */
    function saveScriptVersion(scriptId, content, changeMessage = 'Auto-save') {
        const versions = safeJsonParse(GM_getValue(CONFIG.STORAGE_KEYS.versions, '{}'), {});
        const scriptVersions = versions[scriptId] || [];

        scriptVersions.unshift({
            version: scriptVersions.length + 1,
            content,
            changeMessage,
            timestamp: Date.now()
        });

        // Limit to MAX_VERSIONS_PER_SCRIPT
        const limited = scriptVersions.slice(0, CONFIG.MAX_VERSIONS_PER_SCRIPT);
        versions[scriptId] = limited;
        GM_setValue(CONFIG.STORAGE_KEYS.versions, JSON.stringify(versions));
    }

    /**
     * Export all generated scripts as JSON
     * @returns {string} JSON export string
     */
    function exportAllScripts() {
        const scripts = loadGeneratedScripts();
        const exportData = {
            version: CONFIG.VERSION,
            exportedAt: Date.now(),
            scripts: scripts.map(script => ({
                ...script,
                exportedAt: Date.now()
            }))
        };

        return JSON.stringify(exportData, null, 2);
    }

    /**
     * Import scripts from JSON data
     * @param {string} jsonData - JSON export string
     * @returns {object} Import result with count
     */
    function importScripts(jsonData) {
        const data = safeJsonParse(jsonData, null);
        if (!data || !Array.isArray(data.scripts)) {
            throw new Error('Invalid import data format');
        }

        const imported = [];
        for (const script of data.scripts) {
            if (script.content) {
                const record = saveGeneratedScript(script.content, script.validation, script.prompt || '');
                imported.push(record);
            }
        }

        return { imported: imported.length, scripts: imported };
    }

    /**
     * Theme management with CSS variables
     */
    const ThemeManager = {
        currentTheme: 'dark',

        /**
         * Toggle between dark and light theme
         */
        toggleTheme() {
            this.currentTheme = this.currentTheme === 'dark' ? 'light' : 'dark';
            this.applyTheme();
            this.saveTheme();
            return this.currentTheme;
        },

        /**
         * Apply current theme to UI
         */
        applyTheme() {
            const root = document.documentElement;
            const styles = document.getElementById(CONFIG.STYLE_ID);

            const darkVars = `
                --suite-bg: rgba(15, 23, 42, 0.95);
                --suite-border: #334155;
                --suite-text: white;
                --suite-text-secondary: #94a3b8;
                --suite-input-bg: #1e293b;
                --suite-input-border: #475569;
            `;
            const lightVars = `
                --suite-bg: rgba(255, 255, 255, 0.95);
                --suite-border: #e2e8f0;
                --suite-text: #1e293b;
                --suite-text-secondary: #64748b;
                --suite-input-bg: #f8fafc;
                --suite-input-border: #cbd5e1;
            `;

            if (styles) {
                styles.textContent = styles.textContent.replace(/--suite-\w+:.[^;]+;/g, '');
                styles.textContent = `:root { ${this.currentTheme === 'dark' ? darkVars : lightVars} }\n` + styles.textContent;
            }
        },

        /**
         * Save theme preference to settings
         */
        saveTheme() {
            state.config.theme = this.currentTheme;
            saveSettings();
        },

        /**
         * Load theme from settings
         */
        loadTheme() {
            this.currentTheme = state.config.theme || 'dark';
            this.applyTheme();
        }
    };

    /**
     * Create diff view for script versions
     * @param {string} oldContent - Old script content
     * @param {string} newContent - New script content
     * @returns {string} Diff output
     */
    function createDiffView(oldContent, newContent) {
        const oldLines = oldContent.split('\n');
        const newLines = newContent.split('\n');
        const diff = [];

        for (let i = 0; i < Math.max(oldLines.length, newLines.length); i++) {
            if (oldLines[i] !== newLines[i]) {
                if (oldLines[i]) diff.push(`- ${oldLines[i]}`);
                if (newLines[i]) diff.push(`+ ${newLines[i]}`);
            }
        }

        return diff.join('\n');
    }

    // ========== V1.2.0 MODULE INTEGRATION ==========

    /**
     * Initialize v1.2.0 modules
     */
    function initializeV120Modules() {
        // Versioning Module
        const versioning = {
            saveVersion: saveScriptVersion,
            loadVersions: (scriptId) => {
                const versions = safeJsonParse(GM_getValue(CONFIG.STORAGE_KEYS.versions, '{}'), {});
                return versions[scriptId] || [];
            },
            createDiff: createDiffView,
            exportAll: exportAllScripts,
            importAll: importScripts
        };

        registerModule('versioning', versioning);

        // Theme Module
        const themeModule = {
            toggle: () => ThemeManager.toggleTheme(),
            current: () => ThemeManager.currentTheme,
            apply: () => ThemeManager.applyTheme()
        };

        registerModule('theme', themeModule);
    }

    // Inject v1.2.0 module initialization
    initializeV120Modules();