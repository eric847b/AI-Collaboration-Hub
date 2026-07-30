/**
 * Unified AI Assistant Suite - Theme Module
 * @version 1.3.0
 */

// Get dependencies from global UnifiedSuite object
const CONFIG = (typeof window !== 'undefined' && window.UnifiedSuite?.CONFIG) || {};
const state = (typeof window !== 'undefined' && window.UnifiedSuite?.state) || {};
const updateState = (typeof window !== 'undefined' && window.UnifiedSuite?.updateState) || (() => {});

/**
 * Theme Module - Handles theme management
 */
const ThemeModule = {
    currentTheme: 'dark',

    /**
     * Toggle between dark and light themes
     * @returns {string} New theme
     */
    toggle() {
        this.currentTheme = this.currentTheme === 'dark' ? 'light' : 'dark';
        this.applyTheme();
        this.saveTheme();
        return this.currentTheme;
    },

    /**
     * Apply current theme to UI
     */
    applyTheme() {
        const styles = document.getElementById(CONFIG.STYLE_ID);
        if (!styles) return;
        
        const themeVars = this.currentTheme === 'dark'
            ? '--suite-bg: rgba(15, 23, 42, 0.95); --suite-border: #334155; --suite-text: white; --suite-text-secondary: #94a3b8; --suite-input-bg: #1e293b; --suite-input-border: #475569;'
            : '--suite-bg: rgba(255, 255, 255, 0.95); --suite-border: #e2e8f0; --suite-text: #1e293b; --suite-text-secondary: #64748b; --suite-input-bg: #f8fafc; --suite-input-border: #cbd5e1;';
        
        // Update CSS custom properties in the style element
        const root = document.documentElement;
        if (this.currentTheme === 'dark') {
            root.style.setProperty('--suite-bg', 'rgba(15, 23, 42, 0.95)');
            root.style.setProperty('--suite-border', '#334155');
            root.style.setProperty('--suite-text', 'white');
            root.style.setProperty('--suite-text-secondary', '#94a3b8');
            root.style.setProperty('--suite-input-bg', '#1e293b');
            root.style.setProperty('--suite-input-border', '#475569');
        } else {
            root.style.setProperty('--suite-bg', 'rgba(255, 255, 255, 0.95)');
            root.style.setProperty('--suite-border', '#e2e8f0');
            root.style.setProperty('--suite-text', '#1e293b');
            root.style.setProperty('--suite-text-secondary', '#64748b');
            root.style.setProperty('--suite-input-bg', '#f8fafc');
            root.style.setProperty('--suite-input-border', '#cbd5e1');
        }
    },

    /**
     * Save theme preference
     */
    saveTheme() {
        updateState('config', { ...state.config, theme: this.currentTheme });
        const storage = window.UnifiedSuite?.storage;
        if (storage) {
            try {
                const settings = JSON.parse(GM_getValue(CONFIG.STORAGE_KEYS.settings, '{}'));
                settings.theme = this.currentTheme;
                GM_setValue(CONFIG.STORAGE_KEYS.settings, JSON.stringify(settings));
            } catch (error) {
                console.warn('[Theme] Failed to save theme:', error);
            }
        }
    },

    /**
     * Load theme preference
     */
    loadTheme() {
        this.currentTheme = state.config.theme || 'dark';
        this.applyTheme();
    },

    /**
     * Get current theme
     * @returns {string} Current theme
     */
    getCurrentTheme() {
        return this.currentTheme;
    }
};

// Export for module system
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { ThemeModule };
}

// Export for userscript context
if (typeof window !== 'undefined') {
    window.UnifiedSuite.theme = ThemeModule;
}