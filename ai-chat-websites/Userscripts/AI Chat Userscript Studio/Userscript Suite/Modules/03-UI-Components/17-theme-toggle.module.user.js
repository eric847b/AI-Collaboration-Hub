// ==UserScript==
// @name         Theme Toggle Module
// @namespace    AI-Chat-Userscript-Studio
// @version      2026.08.27.1
// @description  Dark/light theme toggle with CSS variables and persistence
// @match        *://*/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==


/* UniversalSite runtime guard (injected by universalize-modules.cjs) */
(function(){
  if (!window.UniversalSite) {
    // Adapter not loaded on this page - nothing safe to do; bail out quietly.
    return;
  }
  try {
    if (!window.__UNIVERSALIZE_GUARDS) window.__UNIVERSALIZE_GUARDS = [];
    window.__UNIVERSALIZE_GUARDS.push(function(){
      const kind = window.UniversalSite.kind;
      const ok = kind === "chat" || kind === "chat-like" || kind === "chat-domain";
      return { run: ok, kind: kind, genericSafe: true };
    });
  } catch (e) { /* never break the page */ }
})();

/**
 * AI Chat Userscript Studio - Theme Toggle Module
 *
 * Provides theme management with:
 * - Dark/light theme toggle
 * - CSS variables for styling
 * - Persistence across sessions
 * - Style injection
 */

(function() {
    'use strict';

    const MODULE_ID = '17-theme-toggle';
    const MODULE_NAME = 'Theme Toggle';
    const MODULE_VERSION = '1.2.0';

    const DARK_THEME = {
        '--suite-bg': 'rgba(15, 23, 42, 0.95)',
        '--suite-border': '#334155',
        '--suite-text': 'white',
        '--suite-text-secondary': '#94a3b8',
        '--suite-input-bg': '#1e293b',
        '--suite-input-border': '#475569'
    };

    const LIGHT_THEME = {
        '--suite-bg': 'rgba(255, 255, 255, 0.95)',
        '--suite-border': '#e2e8f0',
        '--suite-text': '#1e293b',
        '--suite-text-secondary': '#64748b',
        '--suite-input-bg': '#f8fafc',
        '--suite-input-border': '#cbd5e1'
    };

    class ThemeToggle {
        constructor() {
            this.dependencies = [];
            this.critical = false;
            this.config = {
                enabled: true,
                defaultTheme: 'dark',
                persist: true
            };
            this.state = {
                initialized: false,
                currentTheme: this.config.defaultTheme
            };
        }

        async init() {
            try {
                console.log(`[${MODULE_ID}] Initializing ${MODULE_NAME} v${MODULE_VERSION}`);
                this.loadTheme();
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

        checkDependencies() { return true; }

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

        loadTheme() {
            try {
                const stored = localStorage.getItem(`${MODULE_ID}-theme`);
                this.state.currentTheme = stored || this.config.defaultTheme;
            } catch {
                this.state.currentTheme = this.config.defaultTheme;
            }
        }

        saveTheme() {
            if (this.config.persist) {
                localStorage.setItem(`${MODULE_ID}-theme`, this.state.currentTheme);
            }
        }

        toggleTheme() {
            this.state.currentTheme = this.state.currentTheme === 'dark' ? 'light' : 'dark';
            this.applyTheme();
            this.saveTheme();
            return this.state.currentTheme;
        }

        applyTheme() {
            const styles = document.getElementById(`${MODULE_ID}-styles`);
            if (!styles) return;
            const themeVars = this.state.currentTheme === 'dark' ? DARK_THEME : LIGHT_THEME;
            const cssVars = Object.entries(themeVars).map(([k, v]) => `${k}: ${v};`).join(' ');
            styles.textContent = `:root { ${cssVars} }`;
        }

        getCurrentTheme() {
            return this.state.currentTheme;
        }

        injectStyles() {
            if (!document.getElementById(`${MODULE_ID}-styles`)) {
                const styles = document.createElement('style');
                styles.id = `${MODULE_ID}-styles`;
                document.head.appendChild(styles);
            }
        }

        exposeAPI() {
            window[`${MODULE_ID}_api`] = {
                getConfig: () => this.getConfig(),
                setConfig: (cfg) => this.setConfig(cfg),
                init: () => this.init(),
                destroy: () => this.destroy(),
                toggle: () => this.toggleTheme(),
                current: () => this.getCurrentTheme(),
                apply: () => this.applyTheme()
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

    const instance = new ThemeToggle();
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => instance.init());
    } else {
        instance.init();
    }
    window.addEventListener('beforeunload', () => instance.destroy());
})();