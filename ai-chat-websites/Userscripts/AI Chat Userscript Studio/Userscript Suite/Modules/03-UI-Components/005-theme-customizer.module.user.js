// ==UserScript==
// @name         Theme Customizer
// @namespace   AI-Chat-Userscript-Studio
// @version     2026.08.27.1
// @description Dark/light theme toggle with CSS variables and persistence
// @match       *://*/*
// @grant       GM_getValue
// @grant       GM_setValue
// @grant       GM_notification
// @run-at      document-start
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

(function() {
    'use strict';

    const MODULE_ID = '48-theme-customizer';
    const MODULE_NAME = 'Theme Customizer';
    const MODULE_VERSION = '1.0.0';

    class ThemeCustomizer {
        constructor() {
            this.dependencies = [];
            this.critical = false;
            this.name = MODULE_NAME;
            this.version = MODULE_VERSION;
            this.config = {
                enabled: true,
                theme: 'dark', // 'dark' | 'light'
                autoDetect: true
            };
            this.state = {
                initialized: false,
                currentTheme: 'dark'
            };
        }

        async init() {
            console.log(`[${MODULE_ID}] Initializing ${MODULE_NAME} v${MODULE_VERSION}`);

            this.loadConfig();
            this.applyTheme(this.config.theme);
            this.createToggleUI();
            this.exposeAPI();

            this.state.initialized = true;
            console.log(`[${MODULE_ID}] Initialization complete`);
            return true;
        }

        toggleTheme() {
            const newTheme = this.state.currentTheme === 'dark' ? 'light' : 'dark';
            this.setTheme(newTheme);
        }

        setTheme(theme) {
            if (theme !== 'dark' && theme !== 'light') return;

            this.config.theme = theme;
            this.state.currentTheme = theme;
            this.saveConfig();
            this.applyTheme(theme);

            // Notify via EventBus
            if (window.HubEvents && typeof window.HubEvents.emit === 'function') {
                window.HubEvents.emit('theme.changed', { theme });
            }

            GM_notification({
                text: `Theme: ${theme}`,
                title: MODULE_NAME,
                timeout: 1500
            });
        }

        applyTheme(theme) {
            const root = document.documentElement;
            const vars = theme === 'dark' ? this.getDarkVars() : this.getLightVars();

            Object.entries(vars).forEach(([key, value]) => {
                root.style.setProperty(`--${key}`, value);
            });

            this.state.currentTheme = theme;
        }

        getDarkVars() {
            return {
                'theme-bg': '#0f172a',
                'theme-surface': '#1e293b',
                'theme-text': '#e2e8f0',
                'theme-text-secondary': '#94a3b8',
                'theme-primary': '#3b82f6',
                'theme-border': '#334155'
            };
        }

        getLightVars() {
            return {
                'theme-bg': '#ffffff',
                'theme-surface': '#f1f5f9',
                'theme-text': '#1e293b',
                'theme-text-secondary': '#64748b',
                'theme-primary': '#2563eb',
                'theme-border': '#e2e8f0'
            };
        }

        createToggleUI() {
            if (!document.head) return;

            const style = document.createElement('style');
            style.textContent = `
                .theme-toggle-btn {
                    position: fixed;
                    bottom: 20px;
                    right: 20px;
                    z-index: 10000;
                    background: var(--theme-primary, #3b82f6);
                    color: white;
                    border: none;
                    border-radius: 50%;
                    width: 48px;
                    height: 48px;
                    cursor: pointer;
                    font-size: 20px;
                    box-shadow: 0 4px 12px rgba(0,0,0,0.2);
                    transition: transform 0.2s;
                }
                .theme-toggle-btn:hover {
                    transform: scale(1.1);
                }
            `;
            document.head.appendChild(style);

            const btn = document.createElement('button');
            btn.className = 'theme-toggle-btn';
            btn.title = 'Toggle Theme';
            btn.innerHTML = '🌓';
            btn.addEventListener('click', () => this.toggleTheme());
            document.body.appendChild(btn);
        }

        loadConfig() {
            try {
                if (typeof GM_getValue === 'function') {
                    const stored = GM_getValue(MODULE_ID + '_config', null);
                    if (stored) {
                        this.config = { ...this.config, ...stored };
                    }
                }
            } catch (e) {
                console.warn(`[${MODULE_ID}] Failed to load config:`, e);
            }
        }

        saveConfig() {
            try {
                if (typeof GM_setValue === 'function') {
                    GM_setValue(MODULE_ID + '_config', this.config);
                }
            } catch (e) {
                console.warn(`[${MODULE_ID}] Failed to save config:`, e);
            }
        }

        setConfig(newConfig) {
            this.config = { ...this.config, ...newConfig };
            this.saveConfig();
            this.onConfigUpdate();
        }

        getConfig() {
            return { ...this.config };
        }

        onConfigUpdate() {
            this.applyTheme(this.config.theme);
        }

        exposeAPI() {
            window.ThemeCustomizer = {
                toggleTheme: () => this.toggleTheme(),
                setTheme: (t) => this.setTheme(t),
                getTheme: () => this.state.currentTheme,
                getConfig: () => this.getConfig(),
                setConfig: (c) => this.setConfig(c),
                init: () => this.init(),
                destroy: () => this.destroy()
            };
        }

        destroy() {
            if (window.ThemeCustomizer) {
                delete window.ThemeCustomizer;
            }
            this.state.initialized = false;
            console.log(`[${MODULE_ID}] Destroyed`);
        }
    }

    // Register with ModuleRegistry
    const instance = new ThemeCustomizer();
    window.ModuleRegistry && window.ModuleRegistry.register(instance);

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => instance.init());
    } else {
        instance.init();
    }

    window.addEventListener('beforeunload', () => instance.destroy());

})();