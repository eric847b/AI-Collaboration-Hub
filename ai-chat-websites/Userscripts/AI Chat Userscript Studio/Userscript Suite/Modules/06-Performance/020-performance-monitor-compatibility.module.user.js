// ==UserScript==
// @name         Performance Monitor Compatibility
// @namespace    http://tampermonkey.net/
// @version      2026.03.29.1
// @description  Legacy compatibility layer routing performance monitor calls to the classic analytics dashboard
// @match        https://chat.openai.com/*
// @match        https://chatgpt.com/*
// @grant        none
// @run-at       document-end
// ==/UserScript==

(function() {
  'use strict';

  const PRIMARY_API_NAME = 'AIAnalyticsDashboardClassicAPI';
  const PRIMARY_MODULE_NAME = 'AIAnalyticsDashboardClassicModule';
  const SHARED_API_NAME = 'AIAnalyticsDashboardAPI';
  const LEGACY_API_NAME = 'AIPerformanceMonitorAPI';
  const LEGACY_MODULE_NAME = 'AIPerformanceMonitorModule';
  const POLL_INTERVAL_MS = 500;

  function isPerformanceApi(targetApi) {
    return Boolean(targetApi)
      && typeof targetApi.getMetrics === 'function'
      && typeof targetApi.resetMetrics === 'function'
      && typeof targetApi.toggleMetrics === 'function';
  }

  function getTargetApi() {
    if (isPerformanceApi(window[PRIMARY_API_NAME])) {
      return window[PRIMARY_API_NAME];
    }

    if (isPerformanceApi(window[SHARED_API_NAME])) {
      return window[SHARED_API_NAME];
    }

    const moduleInstance = window[PRIMARY_MODULE_NAME];
    if (moduleInstance && typeof moduleInstance.init === 'function') {
      if (!window[PRIMARY_API_NAME]) {
        moduleInstance.init();
      }

      if (isPerformanceApi(window[PRIMARY_API_NAME])) {
        return window[PRIMARY_API_NAME];
      }
    }

    return null;
  }

  function registerCompatibility() {
    const targetApi = getTargetApi();
    if (!targetApi) {
      return false;
    }

    window[LEGACY_API_NAME] = targetApi;

    if (window[PRIMARY_MODULE_NAME]) {
      window[LEGACY_MODULE_NAME] = window[PRIMARY_MODULE_NAME];
    }

    return true;
  }

  if (!registerCompatibility()) {
    const intervalId = window.setInterval(() => {
      if (registerCompatibility()) {
        window.clearInterval(intervalId);
      }
    }, POLL_INTERVAL_MS);
  }
})();


// LEGACY MODULE REGISTRATION WRAPPER ADDED BY AUTOMATED FIX
(function(){
  'use strict';
  class LegacyModule_11_ai_performance_monitor {
    constructor(){
      this.name="11-ai-performance-monitor";
      this.version="2026.04.02.1";
      this.dependencies=[];
      this.critical=false;
    }
    init(){
      if (typeof console !== "undefined") console.debug("11-ai-performance-monitor init run");
      return true;
    }
  }
  const instance = new LegacyModule_11_ai_performance_monitor();
  if (typeof window !== "undefined" && window.ModuleRegistry && typeof window.ModuleRegistry.register === "function") {
    try { window.ModuleRegistry.register(instance); } catch(e){ console.warn("Legacy module registration failed", e); }
  } else if (typeof ModuleRegistry !== "undefined" && typeof ModuleRegistry.register === "function") {
    try { ModuleRegistry.register(instance); } catch(e){ console.warn("Legacy module registration failed", e); }
  } else if (typeof window !== "undefined" && window.ChatGPTModules && typeof window.ChatGPTModules.register === "function") {
    try { window.ChatGPTModules.register(instance); } catch(e){ console.warn("Legacy module registration failed", e); }
  }
})();
