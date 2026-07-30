// ==UserScript==
// @name         Authentication Security
// @namespace    http://tampermonkey.net/
// @version      2026.04.28.0
// @description  Authentication and security helpers for AI-powered remote desktop control
// @author       AI RMD
// @license      MIT
// @match        https://chat.openai.com/*
// @match        https://chatgpt.com/*
// @match        https://claude.ai/*
// @match        https://perplexity.ai/*
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// ==/UserScript==

(function() {
  'use strict';

  class AIRMDAuthenticationAndSecurityModule {
    constructor() {
      this.name = 'AIRMDAuthenticationAndSecurity';
      this.version = '2026.03.28.1';
      this.dependencies = [];
      this.critical = false;
      this.config = {
        autoStart: false,
        authUrl: '',
        refreshUrl: '',
        sessionDurationMs: 15 * 60 * 1000,
        refreshWindowMs: 5 * 60 * 1000,
        locale: 'auto'
      };
      this._styleId = 'airmd-auth-security-styles';
      this._sessionKey = 'AIRMDAuthSession';
      this._modal = null;
      this._elements = null;
      this._startupHandled = false;
      this.translations = {
        en: {
          authTitle: 'Authentication Required',
          usernamePlaceholder: 'Username',
          passwordPlaceholder: 'Password',
          submitButton: 'Submit',
          errorMessage: 'Please enter both username and password.',
          authFailed: 'Authentication failed. Please try again.',
          authSuccess: 'Authentication successful.',
          loadingMessage: 'Authenticating...',
          endpointMissing: 'Configure authUrl before using this module.'
        },
        es: {
          authTitle: 'Autenticacion requerida',
          usernamePlaceholder: 'Nombre de usuario',
          passwordPlaceholder: 'Contrasena',
          submitButton: 'Enviar',
          errorMessage: 'Ingresa usuario y contrasena.',
          authFailed: 'La autenticacion fallo. Intentalo de nuevo.',
          authSuccess: 'Autenticacion correcta.',
          loadingMessage: 'Autenticando...',
          endpointMissing: 'Configura authUrl antes de usar este modulo.'
        }
      };
      this.api = {
        init: (forcePrompt) => this.initApi(forcePrompt),
        showAuthModal: () => this.showAuthModal(),
        hideAuthModal: () => this.hideAuthModal(),
        authenticateUser: (username, password) => this.authenticateUser(username, password),
        isSessionValid: () => this.isSessionValid(),
        refreshSessionToken: () => this.refreshSessionToken(),
        clearSession: () => this.clearSession(),
        decodeJWT: (token) => this.decodeJWT(token)
      };
    }

    init() {
      if (window.ConfigManager && typeof window.ConfigManager.getConfig === 'function') {
        this.config = {
          ...this.config,
          ...window.ConfigManager.getConfig('airmdauthenticationandsecurity')
        };
      }

      if (window.AIRMD_CONFIG && window.AIRMD_CONFIG.auth) {
        this.config = {
          ...this.config,
          ...window.AIRMD_CONFIG.auth
        };
      }

      window.AIRMDAuthSecurity = this.api;
      return this.api;
    }

    execute() {
      if (!this._startupHandled) {
        this._startupHandled = true;
        if (this.config.autoStart) {
          void this.initApi(false);
        }
      }
    }

    onConfigUpdate(settings) {
      Object.assign(this.config, settings);
    }

    getStrings() {
      const requested = String(this.config.locale || 'auto').toLowerCase();
      if (requested !== 'auto' && this.translations[requested]) {
        return this.translations[requested];
      }

      const language = (navigator.language || 'en').toLowerCase();
      return language.startsWith('es') ? this.translations.es : this.translations.en;
    }

    ensureStyles() {
      if (document.getElementById(this._styleId)) {
        return;
      }

      const styleSheet = document.createElement('style');
      styleSheet.id = this._styleId;
      styleSheet.textContent = [
        '.airmd-auth-modal {',
        '  position: fixed;',
        '  left: 50%;',
        '  top: 50%;',
        '  transform: translate(-50%, -50%);',
        '  background: #fff;',
        '  border: 1px solid #cbd5e1;',
        '  border-radius: 12px;',
        '  padding: 20px;',
        '  width: min(92vw, 420px);',
        '  box-shadow: 0 18px 60px rgba(15, 23, 42, 0.25);',
        '  z-index: 10000;',
        '}',
        '.airmd-auth-modal input {',
        '  display: block;',
        '  width: 100%;',
        '  padding: 10px;',
        '  margin: 0 0 12px;',
        '  border: 1px solid #cbd5e1;',
        '  border-radius: 8px;',
        '  box-sizing: border-box;',
        '}',
        '.airmd-auth-modal button {',
        '  padding: 10px 16px;',
        '  border: 0;',
        '  border-radius: 8px;',
        '  background: #0f172a;',
        '  color: #fff;',
        '  cursor: pointer;',
        '}',
        '.airmd-auth-modal button:disabled {',
        '  opacity: 0.65;',
        '  cursor: wait;',
        '}',
        '.airmd-auth-error {',
        '  min-height: 20px;',
        '  color: #b91c1c;',
        '  margin-bottom: 12px;',
        '}',
        '.airmd-auth-loading {',
        '  display: none;',
        '  margin-top: 12px;',
        '  color: #475569;',
        '}'
      ].join('\n');

      document.head.appendChild(styleSheet);
    }

    createInput(type, placeholder, ariaLabel) {
      const input = document.createElement('input');
      input.type = type;
      input.placeholder = placeholder;
      input.setAttribute('aria-label', ariaLabel);
      return input;
    }

    createModal() {
      if (this._modal) {
        return this._modal;
      }

      const strings = this.getStrings();
      const modal = document.createElement('div');
      modal.className = 'airmd-auth-modal';
      modal.setAttribute('role', 'dialog');
      modal.setAttribute('aria-modal', 'true');

      const title = document.createElement('h2');
      title.textContent = strings.authTitle;

      const usernameInput = this.createInput('text', strings.usernamePlaceholder, 'Username');
      const passwordInput = this.createInput('password', strings.passwordPlaceholder, 'Password');

      const errorMessage = document.createElement('div');
      errorMessage.className = 'airmd-auth-error';

      const submitButton = document.createElement('button');
      submitButton.textContent = strings.submitButton;

      const loadingMessage = document.createElement('div');
      loadingMessage.className = 'airmd-auth-loading';
      loadingMessage.textContent = strings.loadingMessage;

      submitButton.addEventListener('click', () => {
        void this.handleAuthSubmit();
      });

      modal.appendChild(title);
      modal.appendChild(usernameInput);
      modal.appendChild(passwordInput);
      modal.appendChild(errorMessage);
      modal.appendChild(submitButton);
      modal.appendChild(loadingMessage);

      this._elements = {
        usernameInput,
        passwordInput,
        errorMessage,
        submitButton,
        loadingMessage
      };
      this._modal = modal;
      return modal;
    }

    showAuthModal() {
      this.ensureStyles();
      if (!document.body) {
        return null;
      }

      const modal = this.createModal();
      if (!document.body.contains(modal)) {
        document.body.appendChild(modal);
      }

      modal.style.display = 'block';
      return modal;
    }

    hideAuthModal() {
      if (this._modal) {
        this._modal.style.display = 'none';
      }
    }

    validateInputs(username, password) {
      const usernameRegex = /^[a-zA-Z0-9._-]{3,}$/;
      const passwordRegex = /^.{6,}$/;
      return usernameRegex.test(username) && passwordRegex.test(password);
    }

    parseSession() {
      try {
        const raw = sessionStorage.getItem(this._sessionKey);
        return raw ? JSON.parse(raw) : null;
      } catch (error) {
        return null;
      }
    }

    saveSession(token) {
      const sessionData = {
        token,
        expiration: Date.now() + this.config.sessionDurationMs
      };

      sessionStorage.setItem(this._sessionKey, JSON.stringify(sessionData));
      return sessionData;
    }

    clearSession() {
      sessionStorage.removeItem(this._sessionKey);
    }

    isSessionValid() {
      const sessionData = this.parseSession();
      return !!(sessionData && sessionData.token && sessionData.expiration > Date.now());
    }

    async encryptData(data) {
      if (window.crypto && window.crypto.subtle && typeof window.crypto.subtle.digest === 'function') {
        const hashBuffer = await window.crypto.subtle.digest('SHA-256', new TextEncoder().encode(data));
        return Array.from(new Uint8Array(hashBuffer)).map((value) => value.toString(16).padStart(2, '0')).join('');
      }

      return String(data);
    }

    async fetchJson(url, method, body) {
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      });

      if (!response.ok) {
        throw new Error(`HTTP error ${response.status}`);
      }

      return response.json();
    }

    async authenticateUser(username, password) {
      const strings = this.getStrings();
      if (!this.config.authUrl) {
        return { ok: false, error: strings.endpointMissing };
      }

      if (!this.validateInputs(username, password)) {
        return { ok: false, error: strings.errorMessage };
      }

      try {
        const encryptedPassword = await this.encryptData(password);
        const payload = await this.fetchJson(this.config.authUrl, 'POST', {
          username,
          password: encryptedPassword
        });
        const token = payload.token || payload.accessToken;

        if (!token) {
          return { ok: false, error: strings.authFailed };
        }

        this.saveSession(token);
        return { ok: true, token };
      } catch (error) {
        return { ok: false, error: error.message || strings.authFailed };
      }
    }

    async refreshSessionToken() {
      const sessionData = this.parseSession();
      if (!sessionData || !this.config.refreshUrl) {
        return false;
      }

      if (sessionData.expiration - Date.now() >= this.config.refreshWindowMs) {
        return false;
      }

      try {
        const payload = await this.fetchJson(this.config.refreshUrl, 'POST', { token: sessionData.token });
        const token = payload.newToken || payload.token;
        if (!token) {
          return false;
        }

        this.saveSession(token);
        return true;
      } catch (error) {
        return false;
      }
    }

    decodeJWT(token) {
      try {
        const payload = token.split('.')[1];
        return JSON.parse(atob(payload));
      } catch (error) {
        return null;
      }
    }

    async handleAuthSubmit() {
      const strings = this.getStrings();
      const {
        usernameInput,
        passwordInput,
        errorMessage,
        submitButton,
        loadingMessage
      } = this._elements;

      errorMessage.textContent = '';
      submitButton.disabled = true;
      loadingMessage.style.display = 'block';

      try {
        const result = await this.authenticateUser(usernameInput.value, passwordInput.value);
        if (result.ok) {
          this.hideAuthModal();
          return result;
        }

        errorMessage.textContent = result.error || strings.authFailed;
        return result;
      } finally {
        submitButton.disabled = false;
        loadingMessage.style.display = 'none';
      }
    }

    async initApi(forcePrompt = false) {
      if (this.isSessionValid()) {
        await this.refreshSessionToken();
        return { authenticated: true, prompted: false };
      }

      if (forcePrompt || this.config.autoStart) {
        this.showAuthModal();
        return { authenticated: false, prompted: true };
      }

      return { authenticated: false, prompted: false };
    }

    destroy() {
      this.hideAuthModal();
      if (this._modal && this._modal.remove) {
        this._modal.remove();
      }

      this._modal = null;
      this._elements = null;
      this._startupHandled = false;
    }
  }

  const instance = new AIRMDAuthenticationAndSecurityModule();
  window.AIRMDAuthenticationAndSecurityModule = instance;
  window.AIRMDAuthenticationSecurityModule = instance;

  // ✅ Legacy RMD Compatibility - Integrated
  const LEGACY_METHOD_ALIASES = {
    airmdInitAuthSecurity: "init",
    airmdShowAuthModal: "showAuthModal",
    airmdHideAuthModal: "hideAuthModal",
    airmdAuthenticateUser: "authenticateUser",
    airmdIsSessionValid: "isSessionValid",
    airmdRefreshSessionToken: "refreshSessionToken",
    airmdClearSession: "clearSession",
    airmdDecodeJWT: "decodeJWT"
  };

  // Register legacy method aliases for backwards compatibility
  Object.entries(LEGACY_METHOD_ALIASES).forEach(([alias, methodName]) => {
    if (!window[alias] && typeof instance.api[methodName] === "function") {
      window[alias] = (...args) => instance.api[methodName](...args);
    }
  });

  if (window.ModuleRegistry && typeof window.ModuleRegistry.register === 'function') {
    window.ModuleRegistry.register(instance);

    // Also register legacy module name for compatibility
    try {
      const LegacyModule = class {
        constructor() {
          this.name = "22-rmd-authentication-security";
          this.version = "2026.04.11.1";
          this.dependencies = [];
          this.critical = false;
        }
        init() {
          instance.init();
          return true;
        }
      };
      window.ModuleRegistry.register(new LegacyModule());
    } catch(e) {}
  } else if (window.ChatGPTModules && typeof window.ChatGPTModules.register === 'function') {
    window.ChatGPTModules.register(instance);
  } else {
    instance.init();
    instance.execute();
  }
})();
