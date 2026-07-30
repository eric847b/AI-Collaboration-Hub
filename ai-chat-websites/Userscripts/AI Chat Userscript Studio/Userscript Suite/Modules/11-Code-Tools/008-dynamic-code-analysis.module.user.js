// ==UserScript==
// @name         Dynamic Code Analysis
// @namespace    http://tampermonkey.net/
// @version      2026.04.28.0
// @description  Dynamic code analysis for AI chat platforms
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

  class AIRMDDynamicCodeAnalysisModule {
    constructor() {
      this.name = 'AIRMDDynamicCodeAnalysis';
      this.version = '2026.03.28.1';
      this.dependencies = [];
      this.critical = false;
      this.config = {
        autoInstrument: false,
        key: 'expensiveOperation'
      };
      this._instrumentedTargets = [];
      this.api = {
        ensureOperation: (target, key) => this.ensureOperation(target, key),
        instrument: (target, key) => this.instrument(target, key),
        unwrap: (target, key) => this.unwrap(target, key),
        optimizeHotPaths: (targets) => this.optimizeHotPaths(targets),
        init: (options) => this.initApi(options)
      };
    }

    init() {
      if (window.ConfigManager && typeof window.ConfigManager.getConfig === 'function') {
        this.config = {
          ...this.config,
          ...window.ConfigManager.getConfig('airmddynamiccodeanalysis')
        };
      }

      window.AIRMDDynamicCodeAnalysis = this.api;
      return this.api;
    }

    execute() {
      if (this.config.autoInstrument) {
        this.instrument(window, this.config.key);
      }
    }

    onConfigUpdate(settings) {
      Object.assign(this.config, settings);
      if (this.config.autoInstrument) {
        this.instrument(window, this.config.key);
      }
    }

    safeNow() {
      if (window.performance && typeof window.performance.now === 'function') {
        return window.performance.now();
      }

      return Date.now();
    }

    ensureOperation(target = window, key = 'expensiveOperation') {
      if (!target || typeof key !== 'string') {
        return null;
      }

      if (typeof target[key] !== 'function') {
        target[key] = function() {
          return 'Result of expensive operation';
        };
      }

      return target[key];
    }

    instrument(target = window, key = 'expensiveOperation') {
      const original = this.ensureOperation(target, key);
      if (typeof original !== 'function') {
        return null;
      }

      if (original.__airmdWrapped) {
        return original;
      }

      const module = this;
      function wrapped(...args) {
        const startTime = module.safeNow();
        const result = original.apply(this, args);
        wrapped.lastDurationMs = module.safeNow() - startTime;
        return result;
      }

      wrapped.__airmdWrapped = true;
      wrapped.original = original;
      wrapped.lastDurationMs = 0;
      target[key] = wrapped;
      this._instrumentedTargets.push({ target, key });
      return wrapped;
    }

    unwrap(target = window, key = 'expensiveOperation') {
      const current = target && target[key];
      if (typeof current === 'function' && current.__airmdWrapped && current.original) {
        target[key] = current.original;
        return true;
      }

      return false;
    }

    optimizeHotPaths(targets = [{ target: window, key: this.config.key }]) {
      let instrumented = 0;
      targets.forEach((entry) => {
        const wrapped = this.instrument(entry.target, entry.key);
        if (wrapped) {
          instrumented += 1;
        }
      });
      return instrumented;
    }

    initApi(options = {}) {
      if (options.instrument !== false) {
        this.instrument(options.target || window, options.key || this.config.key);
      }

      return {
        instrumentedTargets: this._instrumentedTargets.length
      };
    }

    destroy() {
      this._instrumentedTargets.forEach(({ target, key }) => {
        this.unwrap(target, key);
      });
      this._instrumentedTargets = [];
    }
  }

  const instance = new AIRMDDynamicCodeAnalysisModule();
  window.AIRMDDynamicCodeAnalysisModule = instance;
  
  // ✅ Legacy RMD Compatibility - Integrated
  const LEGACY_METHOD_ALIASES = {
    airmdInitDynamicCodeAnalysis: "init",
    airmdEnsureOperation: "ensureOperation",
    airmdInstrumentOperation: "instrument",
    airmdUnwrapOperation: "unwrap",
    airmdOptimizeHotPaths: "optimizeHotPaths"
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
          this.name = "18-rmd-dynamic-code-analysis";
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
