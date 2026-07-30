// ==UserScript==
// @name         Input Simulation
// @namespace    http://tampermonkey.net/
// @version      2026.04.28.0
// @description  Input simulation module for AI chat automation
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

  class AIRMDInputSimulationModule {
    constructor() {
      this.name = 'AIRMDInputSimulation';
      this.version = '2026.03.28.1';
      this.dependencies = [];
      this.critical = false;
      this.config = {
        highlightClicks: true,
        highlightDurationMs: 800,
        defaultInputSelector: 'textarea'
      };
      this.api = {
        simulateInput: (action, data) => this.simulateInput(action, data),
        clickAt: (x, y, options) => this.clickAt(x, y, options),
        typeText: (target, text, options) => this.typeText(target, text, options),
        pressKey: (target, key, options) => this.pressKey(target, key, options),
        focusElement: (target) => this.focusElement(target),
        init: () => this.initApi()
      };
    }

    init() {
      if (window.ConfigManager && typeof window.ConfigManager.getConfig === 'function') {
        this.config = {
          ...this.config,
          ...window.ConfigManager.getConfig('airmdinputsimulation')
        };
      }

      window.AIRMDInputSimulation = this.api;
      window.simulateInput = (action, data) => this.simulateInput(action, data);
      return this.api;
    }

    execute() {}

    onConfigUpdate(settings) {
      Object.assign(this.config, settings);
    }

    createEvent(name, init = {}) {
      if (typeof Event === 'function') {
        return new Event(name, { bubbles: true, cancelable: true, ...init });
      }

      return { type: name, ...init };
    }

    resolveElement(target) {
      if (!target) {
        return document.querySelector(this.config.defaultInputSelector);
      }

      if (typeof target === 'string') {
        return document.querySelector(target);
      }

      return target;
    }

    highlightElement(element) {
      if (!element || !this.config.highlightClicks || !element.style) {
        return;
      }

      const previousOutline = element.style.outline;
      element.style.outline = '2px solid #ef4444';
      setTimeout(() => {
        if (element.style) {
          element.style.outline = previousOutline;
        }
      }, this.config.highlightDurationMs);
    }

    clickAt(x, y, options = {}) {
      if (typeof document.elementFromPoint !== 'function') {
        return { ok: false, reason: 'elementFromPoint unavailable' };
      }

      const element = document.elementFromPoint(x, y);
      if (!element) {
        return { ok: false, reason: 'No element found', x, y };
      }

      if (options.highlight !== false) {
        this.highlightElement(element);
      }

      if (typeof element.click === 'function') {
        element.click();
      } else if (typeof element.dispatchEvent === 'function') {
        element.dispatchEvent(this.createEvent('click'));
      }

      return { ok: true, element };
    }

    typeText(target, text, options = {}) {
      const element = this.resolveElement(target);
      if (!element) {
        return { ok: false, reason: 'Input element not found' };
      }

      const value = String(text || '');
      if ('value' in element) {
        element.value = value;
      } else {
        element.textContent = value;
      }

      if (typeof element.focus === 'function') {
        element.focus();
      }

      if (typeof element.dispatchEvent === 'function') {
        element.dispatchEvent(this.createEvent('input'));
        if (options.change !== false) {
          element.dispatchEvent(this.createEvent('change'));
        }
      }

      return { ok: true, element, value };
    }

    pressKey(target, key, options = {}) {
      const element = this.resolveElement(target) || document.activeElement;
      if (!element || typeof element.dispatchEvent !== 'function') {
        return { ok: false, reason: 'Target element not available' };
      }

      const eventInit = {
        bubbles: true,
        cancelable: true,
        key,
        code: options.code || key,
        ctrlKey: !!options.ctrlKey,
        altKey: !!options.altKey,
        shiftKey: !!options.shiftKey,
        metaKey: !!options.metaKey
      };

      if (typeof KeyboardEvent === 'function') {
        element.dispatchEvent(new KeyboardEvent('keydown', eventInit));
        element.dispatchEvent(new KeyboardEvent('keyup', eventInit));
      } else {
        element.dispatchEvent({ type: 'keydown', ...eventInit });
        element.dispatchEvent({ type: 'keyup', ...eventInit });
      }

      return { ok: true, key };
    }

    focusElement(target) {
      const element = this.resolveElement(target);
      if (!element || typeof element.focus !== 'function') {
        return false;
      }

      element.focus();
      return true;
    }

    simulateInput(action, data = {}) {
      try {
        switch (action) {
          case 'click':
            return this.clickAt(data.x, data.y, data);
          case 'type':
            return this.typeText(data.selector || data.element, data.text, data);
          case 'keypress':
            return this.pressKey(data.selector || data.element, data.key || 'Enter', data);
          case 'focus':
            return { ok: this.focusElement(data.selector || data.element) };
          default:
            return { ok: false, reason: `Action not recognized: ${action}` };
        }
      } catch (error) {
        console.error('[AIRMDInputSimulation] Error simulating input:', error);
        return { ok: false, reason: error.message };
      }
    }

    initApi() {
      return {
        defaultInputSelector: this.config.defaultInputSelector,
        highlightClicks: this.config.highlightClicks
      };
    }

    destroy() {
      delete window.simulateInput;
    }
  }

  const instance = new AIRMDInputSimulationModule();
  window.AIRMDInputSimulationModule = instance;
  
  // ✅ Legacy RMD Compatibility - Integrated
  const LEGACY_METHOD_ALIASES = {
    simulateInput: "simulateInput",
    airmdInitInputSimulation: "init",
    airmdClickAt: "clickAt",
    airmdTypeText: "typeText",
    airmdPressKey: "pressKey",
    airmdFocusElement: "focusElement"
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
          this.name = "14-rmd-input-simulation";
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
