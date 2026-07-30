// ==UserScript==
// @name         Security Enhancer Compatibility
// @namespace    http://tampermonkey.net/
// @version      2026.03.28.3
// @description  Legacy compatibility layer that routes the older security enhancer API to the modern AI Security Assistant module
// @match        https://chat.openai.com/*
// @match        https://chatgpt.com/*
// @grant        none
// @run-at       document-end
// ==/UserScript==

(function() {
  'use strict';

  const PRIMARY_API_NAME = 'AISecurityAssistantAPI';
  const PRIMARY_MODULE_NAME = 'AISecurityAssistantModule';
  const LEGACY_API_NAME = 'AISecurityEnhancerAPI';
  const LEGACY_MODULE_NAME = 'AISecurityEnhancerModule';
  const POLL_INTERVAL_MS = 500;

  function getTargetApi() {
    if (window[PRIMARY_API_NAME] && typeof window[PRIMARY_API_NAME] === 'object') {
      return window[PRIMARY_API_NAME];
    }

    const moduleInstance = window[PRIMARY_MODULE_NAME];
    if (!moduleInstance) {
      return null;
    }

    if (typeof moduleInstance.init === 'function') {
      const initialized = moduleInstance.init();
      if (initialized && typeof initialized === 'object') {
        return initialized;
      }
    }

    if (moduleInstance.api && typeof moduleInstance.api === 'object') {
      return moduleInstance.api;
    }

    return null;
  }

  function registerCompatibility() {
    const targetApi = getTargetApi();
    if (!targetApi) {
      return false;
    }

    window[LEGACY_API_NAME] = targetApi;

    if (!window[LEGACY_MODULE_NAME] && window[PRIMARY_MODULE_NAME]) {
      window[LEGACY_MODULE_NAME] = window[PRIMARY_MODULE_NAME];
    }

    return true;
  }

  if (!registerCompatibility()) {
    const timer = setInterval(() => {
      if (registerCompatibility()) {
        clearInterval(timer);
      }
    }, POLL_INTERVAL_MS);
  }
})();


// LEGACY MODULE REGISTRATION WRAPPER ADDED BY AUTOMATED FIX
(function(){
  'use strict';
  class LegacyModule_12_ai_security_enhancer {
    constructor(){
      this.name="12-ai-security-enhancer";
      this.version="2026.04.02.1";
      this.dependencies=[];
      this.critical=false;
    }
    init(){
      if (typeof console !== "undefined") console.debug("12-ai-security-enhancer init run");
      return true;
    }
  }
  const instance = new LegacyModule_12_ai_security_enhancer();
  if (typeof window !== "undefined" && window.ModuleRegistry && typeof window.ModuleRegistry.register === "function") {
    try { window.ModuleRegistry.register(instance); } catch(e){ console.warn("Legacy module registration failed", e); }
  } else if (typeof ModuleRegistry !== "undefined" && typeof ModuleRegistry.register === "function") {
    try { ModuleRegistry.register(instance); } catch(e){ console.warn("Legacy module registration failed", e); }
  } else if (typeof window !== "undefined" && window.ChatGPTModules && typeof window.ChatGPTModules.register === "function") {
    try { window.ChatGPTModules.register(instance); } catch(e){ console.warn("Legacy module registration failed", e); }
  }
})();
