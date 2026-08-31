// ==UserScript==
// @name         Multi-language Support
// @namespace   AI-Chat-Userscript-Studio
// @version     2026.08.27.1
// @description Internationalization framework with dynamic language switching
// @match       *://*/*
// @grant       none
// @run-at      document-idle
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

    const MODULE_ID = '41-multi-language-support';
    const MODULE_NAME = 'Multi-Language Support';
    const MODULE_VERSION = '1.0.0';

    class MultiLanguageSupport {
        constructor() {
            this.currentLanguage = 'en';
            this.supportedLanguages = ['en', 'es', 'fr', 'de', 'ja', 'zh', 'ko', 'pt', 'ru', 'ar'];
            this.translations = {};
            this.fallbackLanguage = 'en';
            this.config = {
                autoDetect: true,
                persistSelection: true,
                rtlSupport: true,
                pluralization: true
            };
        }

        async init() {
            console.log(`[${MODULE_ID}] Initializing ${MODULE_NAME} v${MODULE_VERSION}`);
            this.loadConfig();
            this.loadTranslations();
            if (this.config.autoDetect) {
                this.detectLanguage();
            }
            this.applyTranslations();
            this.exposeAPI();
            return true;
        }

        loadConfig() {
            try {
                const stored = localStorage.getItem(`${MODULE_ID}-config`);
                if (stored) {
                    this.config = { ...this.config, ...JSON.parse(stored) };
                    this.currentLanguage = this.config.language || this.currentLanguage;
                }
            } catch (e) {
                console.warn(`[${MODULE_ID}] Failed to load config:`, e);
            }
        }

        saveConfig() {
            try {
                this.config.language = this.currentLanguage;
                localStorage.setItem(`${MODULE_ID}-config`, JSON.stringify(this.config));
            } catch (e) {
                console.warn(`[${MODULE_ID}] Failed to save config:`, e);
            }
        }

        loadTranslations() {
            // Load translation bundles for each supported language
            this.translations = {
                'en': {
                    'app.title': 'AI Chat Studio',
                    'menu.file': 'File',
                    'menu.edit': 'Edit',
                    'menu.view': 'View',
                    'menu.help': 'Help',
                    'button.save': 'Save',
                    'button.cancel': 'Cancel',
                    'button.ok': 'OK',
                    'label.search': 'Search',
                    'message.loading': 'Loading...',
                    'message.error': 'An error occurred',
                    'message.success': 'Success'
                },
                'es': {
                    'app.title': 'Estudio de Chat IA',
                    'menu.file': 'Archivo',
                    'menu.edit': 'Editar',
                    'menu.view': 'Ver',
                    'menu.help': 'Ayuda',
                    'button.save': 'Guardar',
                    'button.cancel': 'Cancelar',
                    'button.ok': 'Aceptar',
                    'label.search': 'Buscar',
                    'message.loading': 'Cargando...',
                    'message.error': 'Ocurrió un error',
                    'message.success': 'Éxito'
                },
                'fr': {
                    'app.title': 'Studio de Chat IA',
                    'menu.file': 'Fichier',
                    'menu.edit': 'Modifier',
                    'menu.view': 'Voir',
                    'menu.help': 'Aide',
                    'button.save': 'Enregistrer',
                    'button.cancel': 'Annuler',
                    'button.ok': 'OK',
                    'label.search': 'Rechercher',
                    'message.loading': 'Chargement...',
                    'message.error': 'Une erreur est survenue',
                    'message.success': 'Succès'
                }
            };
        }

        detectLanguage() {
            const browserLang = navigator.language || navigator.userLanguage;
            const langCode = browserLang.split('-')[0].toLowerCase();

            if (this.supportedLanguages.includes(langCode)) {
                this.currentLanguage = langCode;
            }
        }

        setLanguage(lang) {
            if (!this.supportedLanguages.includes(lang)) {
                console.warn(`[${MODULE_ID}] Unsupported language: ${lang}`);
                return false;
            }

            this.currentLanguage = lang;
            this.saveConfig();
            this.applyTranslations();
            this.dispatchLanguageChange();

            return true;
        }

        getLanguage() {
            return this.currentLanguage;
        }

        translate(key, params = {}) {
            const lang = this.currentLanguage;
            let text = this.translations[lang]?.[key] ||
                       this.translations[this.fallbackLanguage]?.[key] ||
                       key;

            // Simple parameter substitution
            Object.keys(params).forEach(param => {
                text = text.replace(`{${param}}`, params[param]);
            });

            return text;
        }

        applyTranslations() {
            document.querySelectorAll('[data-i18n]').forEach(el => {
                const key = el.getAttribute('data-i18n');
                const translation = this.translate(key);

                if (el.tagName === 'INPUT' && el.hasAttribute('placeholder')) {
                    el.setAttribute('placeholder', translation);
                } else if (el.tagName === 'INPUT' && el.type === 'submit') {
                    el.value = translation;
                } else {
                    el.textContent = translation;
                }
            });

            // Set document direction for RTL languages
            const rtlLanguages = ['ar', 'he', 'fa', 'ur'];
            if (rtlLanguages.includes(this.currentLanguage)) {
                document.documentElement.setAttribute('dir', 'rtl');
            } else {
                document.documentElement.setAttribute('dir', 'ltr');
            }
        }

        addTranslation(lang, key, text) {
            if (!this.translations[lang]) {
                this.translations[lang] = {};
            }
            this.translations[lang][key] = text;
        }

        addTranslations(lang, translations) {
            if (!this.translations[lang]) {
                this.translations[lang] = {};
            }
            Object.assign(this.translations[lang], translations);
        }

        getSupportedLanguages() {
            return [...this.supportedLanguages];
        }

        dispatchLanguageChange() {
            const event = new CustomEvent('languagechange', {
                detail: { language: this.currentLanguage }
            });
            document.dispatchEvent(event);
        }

        pluralize(key, count) {
            if (!this.config.pluralization) {
                return this.translate(key);
            }

            const lang = this.currentLanguage;
            const pluralKey = count === 1 ? key : `${key}_plural`;

            return this.translations[lang]?.[pluralKey] ||
                   this.translations[this.fallbackLanguage]?.[pluralKey] ||
                   this.translate(key);
        }

        formatDate(date, format = 'short') {
            try {
                return new Intl.DateTimeFormat(this.currentLanguage, {
                    short: { day: 'numeric', month: 'short', year: 'numeric' },
                    long: { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }
                }[format] || { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(date));
            } catch (e) {
                return date.toString();
            }
        }

        formatNumber(num) {
            try {
                return new Intl.NumberFormat(this.currentLanguage).format(num);
            } catch (e) {
                return num.toString();
            }
        }

        formatCurrency(amount, currency = 'USD') {
            try {
                return new Intl.NumberFormat(this.currentLanguage, {
                    style: 'currency',
                    currency: currency
                }).format(amount);
            } catch (e) {
                return `${currency} ${amount}`;
            }
        }

        exposeAPI() {
            window[`${MODULE_ID}_api`] = {
                setLanguage: (lang) => this.setLanguage(lang),
                getLanguage: () => this.getLanguage(),
                translate: (key, params) => this.translate(key, params),
                addTranslation: (lang, key, text) => this.addTranslation(lang, key, text),
                addTranslations: (lang, translations) => this.addTranslations(lang, translations),
                getSupportedLanguages: () => this.getSupportedLanguages(),
                pluralize: (key, count) => this.pluralize(key, count),
                formatDate: (date, format) => this.formatDate(date, format),
                formatNumber: (num) => this.formatNumber(num),
                formatCurrency: (amount, currency) => this.formatCurrency(amount, currency),
                getConfig: () => this.getConfig(),
                setConfig: (cfg) => this.setConfig(cfg)
            };

            window[`${MODULE_ID}_instance`] = this;
        }

        destroy() {
            delete window[`${MODULE_ID}_api`];
            delete window[`${MODULE_ID}_instance`];
            console.log(`[${MODULE_ID}] Destroyed`);
        }
    }

    const instance = new MultiLanguageSupport();
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => instance.init());
    } else {
        instance.init();
    }
})();