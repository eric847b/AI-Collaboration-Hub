// ==UserScript==
// @name         Decision Making
// @namespace    http://tampermonkey.net/
// @version      2026.04.28.0
// @description  Heuristic decision making helpers for AI chat
// @author       AI RMD
// @license      MIT
// @match        https://chat.openai.com/*
// @match        https://chatgpt.com/*
// @match        https://claude.ai/*
// @match        https://perplexity.ai/*
// @grant        GM_getValue
// @grant        GM_setValue
// ==/UserScript==

(function() {
  'use strict';

  class AIRMDDecisionMakingModule {
    constructor() {
      this.name = 'AIRMDDecisionMaking';
      this.version = '2026.03.28.1';
      this.dependencies = [];
      this.critical = false;
      this.config = {
        confidenceThreshold: 0.5
      };
      this.rules = [
        { id: 'auth', pattern: /(sign in|log in|password|two-factor|verification code)/i, action: 'focus', target: 'input[type="password"], input[name*="pass"], input[type="email"]', score: 0.8, reason: 'authentication_form_detected' },
        { id: 'confirm', pattern: /(allow|accept|continue|next|approve|confirm)/i, action: 'click', target: 'button, [role="button"]', score: 0.65, reason: 'confirmation_language_detected' },
        { id: 'error', pattern: /(error|failed|warning|denied|unavailable)/i, action: 'inspect', target: null, score: 0.75, reason: 'error_state_detected' }
      ];
      this.api = {
        aiDecide: (screenData, options) => this.aiDecide(screenData, options),
        registerRule: (rule) => this.registerRule(rule),
        clearRules: () => this.clearRules(),
        listRules: () => this.listRules(),
        init: () => this.initApi()
      };
    }

    init() {
      if (window.ConfigManager && typeof window.ConfigManager.getConfig === 'function') {
        this.config = {
          ...this.config,
          ...window.ConfigManager.getConfig('airmddecisionmaking')
        };
      }

      window.AIRMDDecisionMaking = this.api;
      window.aiDecide = (screenData, options) => this.aiDecide(screenData, options);
      return this.api;
    }

    execute() {}

    onConfigUpdate(settings) {
      Object.assign(this.config, settings);
    }

    normalizeScreenData(screenData) {
      if (typeof screenData === 'string') {
        return screenData;
      }

      if (screenData == null) {
        return '';
      }

      try {
        return JSON.stringify(screenData);
      } catch (error) {
        return String(screenData);
      }
    }

    registerRule(rule) {
      if (!rule || !rule.id || !(rule.pattern instanceof RegExp)) {
        return false;
      }

      this.rules = this.rules.filter((entry) => entry.id !== rule.id);
      this.rules.push(rule);
      return true;
    }

    clearRules() {
      this.rules = [];
    }

    listRules() {
      return this.rules.map((rule) => ({
        id: rule.id,
        action: rule.action,
        score: rule.score,
        reason: rule.reason
      }));
    }

    aiDecide(screenData, options = {}) {
      try {
        const text = this.normalizeScreenData(screenData);
        const threshold = options.confidenceThreshold || this.config.confidenceThreshold;
        let bestMatch = null;

        this.rules.forEach((rule) => {
          if (!rule.pattern.test(text)) {
            return;
          }

          if (!bestMatch || rule.score > bestMatch.score) {
            bestMatch = {
              action: rule.action,
              target: rule.target || null,
              score: rule.score,
              reason: rule.reason || rule.id
            };
          }
        });

        if (!bestMatch || bestMatch.score < threshold) {
          return {
            action: 'none',
            score: 0,
            reason: 'no_confident_match'
          };
        }

        return bestMatch;
      } catch (error) {
        console.error('[AIRMDDecisionMaking] Error in decision making:', error);
        return { action: 'error', message: error.message };
      }
    }

    initApi() {
      return {
        ruleCount: this.rules.length,
        confidenceThreshold: this.config.confidenceThreshold
      };
    }

    destroy() {
      delete window.aiDecide;
    }
  }

  const instance = new AIRMDDecisionMakingModule();
  window.AIRMDDecisionMakingModule = instance;
  
  // ✅ Legacy RMD Compatibility - Integrated
  const LEGACY_METHOD_ALIASES = {
    aiDecide: "aiDecide",
    airmdInitDecisionMaking: "init",
    airmdRegisterDecisionRule: "registerRule",
    airmdClearDecisionRules: "clearRules",
    airmdListDecisionRules: "listRules"
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
          this.name = "15-rmd-decision-making";
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
