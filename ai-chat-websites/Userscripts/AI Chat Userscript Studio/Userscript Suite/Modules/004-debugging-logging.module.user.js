// ==UserScript==
// @name         Debugging Logging
// @namespace    http://tampermonkey.net/
// @version      2026.04.28.0
// @description  Debugging and logging module for AI chat with console capture and error tracking
// @author       AI RMD
// @license      MIT
// @match        https://chat.openai.com/*
// @match        https://chatgpt.com/*
// @match        https://claude.ai/*
// @match        https://perplexity.ai/*
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_log
// ==/UserScript==

(function() {
  'use strict';

  class AIRMDDebuggingModule {
    constructor() {
      this.name = 'AIRMDDebugging';
      this.version = '2026.03.28.1';
      this.dependencies = [];
      this.critical = false;
      this.config = {
        endpoint: '',
        autoInstall: false,
        captureConsole: true,
        captureAlerts: false,
        captureGlobalErrors: true
      };
      this.state = {
        consoleInstalled: false,
        alertInstalled: false,
        errorInstalled: false,
        originalLog: null,
        originalError: null,
        originalAlert: null,
        originalOnError: null
      };
      this.api = {
        installConsoleCapture: () => this.installConsoleCapture(),
        uninstallConsoleCapture: () => this.uninstallConsoleCapture(),
        installAlertCapture: () => this.installAlertCapture(),
        uninstallAlertCapture: () => this.uninstallAlertCapture(),
        installGlobalErrorCapture: () => this.installGlobalErrorCapture(),
        uninstallGlobalErrorCapture: () => this.uninstallGlobalErrorCapture(),
        runDiagnostics: () => this.runDiagnostics(),
        init: () => this.initApi()
      };
    }

    init() {
      if (window.ConfigManager && typeof window.ConfigManager.getConfig === 'function') {
        this.config = {
          ...this.config,
          ...window.ConfigManager.getConfig('airmddebugging')
        };
      }

      if (window.AIRMD_CONFIG && window.AIRMD_CONFIG.debugging) {
        this.config = {
          ...this.config,
          ...window.AIRMD_CONFIG.debugging
        };
      }

      window.AIRMDDebugging = this.api;
      window.AIRMDDebuggingAndLogging = this.api;
      return this.api;
    }

    execute() {
      this.applyConfig();
    }

    onConfigUpdate(settings) {
      Object.assign(this.config, settings);
      this.applyConfig();
    }

    initApi() {
      this.applyConfig();
      return {
        autoInstall: this.config.autoInstall,
        captures: {
          console: this.state.consoleInstalled,
          alerts: this.state.alertInstalled,
          globalErrors: this.state.errorInstalled
        }
      };
    }

    sendToAI(kind, payload) {
      if (!this.config.endpoint || !window.apiModule || typeof window.apiModule.sendToAPI !== 'function') {
        return Promise.resolve(false);
      }

      try {
        return Promise.resolve(window.apiModule.sendToAPI(this.config.endpoint, { kind, ...payload }))
          .then(() => true)
          .catch(() => false);
      } catch (error) {
        return Promise.resolve(false);
      }
    }

    applyConfig() {
      if (!this.config.autoInstall) {
        this.uninstallConsoleCapture();
        this.uninstallAlertCapture();
        this.uninstallGlobalErrorCapture();
        return;
      }

      if (this.config.captureConsole) {
        this.installConsoleCapture();
      } else {
        this.uninstallConsoleCapture();
      }

      if (this.config.captureAlerts) {
        this.installAlertCapture();
      } else {
        this.uninstallAlertCapture();
      }

      if (this.config.captureGlobalErrors) {
        this.installGlobalErrorCapture();
      } else {
        this.uninstallGlobalErrorCapture();
      }
    }

    installConsoleCapture() {
      if (this.state.consoleInstalled || !console) {
        return false;
      }

      this.state.originalLog = console.log.bind(console);
      this.state.originalError = console.error.bind(console);

      console.log = (...args) => {
        this.state.originalLog(...args);
        void this.sendToAI('log', { message: args });
      };

      console.error = (...args) => {
        this.state.originalError(...args);
        void this.sendToAI('error', { message: args });
      };

      this.state.consoleInstalled = true;
      return true;
    }

    uninstallConsoleCapture() {
      if (!this.state.consoleInstalled) {
        return false;
      }

      if (this.state.originalLog) {
        console.log = this.state.originalLog;
      }

      if (this.state.originalError) {
        console.error = this.state.originalError;
      }

      this.state.consoleInstalled = false;
      return true;
    }

    installAlertCapture() {
      if (this.state.alertInstalled || typeof window.alert !== 'function') {
        return false;
      }

      this.state.originalAlert = window.alert.bind(window);
      window.alert = (message) => {
        this.state.originalAlert(message);
        void this.sendToAI('alert', { message });
      };

      this.state.alertInstalled = true;
      return true;
    }

    uninstallAlertCapture() {
      if (!this.state.alertInstalled) {
        return false;
      }

      if (this.state.originalAlert) {
        window.alert = this.state.originalAlert;
      }

      this.state.alertInstalled = false;
      return true;
    }

    installGlobalErrorCapture() {
      if (this.state.errorInstalled) {
        return false;
      }

      this.state.originalOnError = window.onerror;
      window.onerror = (message, source, lineno, colno, error) => {
        if (typeof this.state.originalOnError === 'function') {
          this.state.originalOnError.call(window, message, source, lineno, colno, error);
        }

        void this.sendToAI('window-error', {
          message,
          source,
          lineno,
          colno,
          stack: error && error.stack ? error.stack : null
        });

        return false;
      };

      this.state.errorInstalled = true;
      return true;
    }

    uninstallGlobalErrorCapture() {
      if (!this.state.errorInstalled) {
        return false;
      }

      window.onerror = this.state.originalOnError;
      this.state.errorInstalled = false;
      return true;
    }

    runDiagnostics() {
      const snapshot = {
        userAgent: navigator.userAgent,
        url: window.location.href,
        timestamp: new Date().toISOString(),
        captures: {
          console: this.state.consoleInstalled,
          alerts: this.state.alertInstalled,
          globalErrors: this.state.errorInstalled
        }
      };

      void this.sendToAI('diagnostics', snapshot);
      return snapshot;
    }

    destroy() {
      this.uninstallConsoleCapture();
      this.uninstallAlertCapture();
      this.uninstallGlobalErrorCapture();
    }
  }

  const instance = new AIRMDDebuggingModule();
  window.AIRMDDebuggingModule = instance;
  window.AIRMDDebuggingAndLoggingModule = instance;
  
  // ✅ Legacy RMD Compatibility - Integrated
  const LEGACY_METHOD_ALIASES = {
    airmdInitDebugging: "init",
    airmdInstallConsoleCapture: "installConsoleCapture",
    airmdUninstallConsoleCapture: "uninstallConsoleCapture",
    airmdInstallAlertCapture: "installAlertCapture",
    airmdUninstallAlertCapture: "uninstallAlertCapture",
    airmdInstallGlobalErrorCapture: "installGlobalErrorCapture",
    airmdUninstallGlobalErrorCapture: "uninstallGlobalErrorCapture",
    airmdRunDiagnostics: "runDiagnostics"
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
          this.name = "17-rmd-debugging-logging";
          this.version = "2026.04.10.1";
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
