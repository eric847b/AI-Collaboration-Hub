// ==UserScript==
// @name         Dev Smoke Test
// @version      2026.03.19.0
// @description  Dev smoke-test module - logs lifecycle events (init, execute, onConfigUpdate)
// @match        https://chat.openai.com/*
// @match        https://chatgpt.com/*
// @grant        GM_getValue
// @grant        GM_setValue
// ==/UserScript==
(function() {
  'use strict';

  const Utils = {
    throttle(fn, limit) {
      let inThrottle;
      return function(...args) {
        if (!inThrottle) {
          fn.apply(this, args);
          inThrottle = true;
          setTimeout(() => {
            inThrottle = false;
          }, limit);
        }
      };
    },

    debounce(fn, delay) {
      let timeoutId;
      return function(...args) {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => fn.apply(this, args), delay);
      };
    },

    measurePerformance(label, fn) {
      if (!window.performance) {
        return fn();
      }

      const start = performance.now();
      const result = fn();
      const end = performance.now();
      console.debug(`[Performance] ${label}: ${end - start}ms`);
      return result;
    },

    safeLog(level, message, data) {
      if (!console || !console[level]) {
        return;
      }

      try {
        if (typeof data !== 'undefined') {
          console[level](`[DevSmokeTest] ${message}`, data);
        } else {
          console[level](`[DevSmokeTest] ${message}`);
        }
      } catch (err) {
        console.log(`[DevSmokeTest] ${message}`, typeof data === 'undefined' ? '' : data);
      }
    }
  };

  class DevSmokeTestModule {
    constructor() {
      this.name = 'DevSmokeTest';
      this.version = '2026.03.19.0';
      this.dependencies = [];
      this.critical = false;
      this.loaded = false;
      this.config = { enabled: true, heartbeatInterval: 60000 };
      this._observer = null;
      this._heartbeatInterval = null;
    }

    init() {
      try {
        Utils.measurePerformance('DevSmokeTest init', () => {
          Utils.safeLog('log', 'init called');

          const baseConfig = { ...this.config };
          const loaded = ModuleBootstrapHelper.loadConfig(this.config, 'devsmoketest');
          this.config = loaded && typeof loaded === 'object' ? { ...baseConfig, ...loaded } : baseConfig;

          this.loaded = true;

          if (typeof chatgpt === 'object' && typeof chatgpt.onNewResponse === 'function') {
            chatgpt.onNewResponse((response) => {
              if (this.config.enabled) {
                Utils.safeLog('log', 'chatgpt.onNewResponse', response && response.text?.slice?.(0, 120));
              }
            });
          } else {
            const throttledLog = Utils.throttle((count) => {
              if (this.config.enabled) {
                Utils.safeLog('log', 'MutationObserver detected nodes', count);
              }
            }, 1000);

            this._observer = new MutationObserver((mutations) => {
              let totalNodes = 0;
              for (const mutation of mutations) {
                if (mutation.addedNodes && mutation.addedNodes.length) {
                  totalNodes += mutation.addedNodes.length;
                }
              }

              if (totalNodes > 0) {
                throttledLog(totalNodes);
              }
            });

            this._observer.observe(document.body, { childList: true, subtree: true });
          }
        });
      } catch (err) {
        Utils.safeLog('error', 'Init error:', err);
        this._handleInitError(err);
      }
    }

    _handleInitError(err) {
      Utils.safeLog('warn', 'Attempting recovery from initialization error...');
      if (err.message.includes('ConfigManager')) {
        this.config.enabled = false;
        Utils.safeLog('warn', 'ConfigManager not available, module disabled');
      }
    }

    execute() {
      try {
        Utils.measurePerformance('DevSmokeTest execute', () => {
          Utils.safeLog('log', 'execute called');

          if (this._heartbeatInterval) {
            clearInterval(this._heartbeatInterval);
          }

          this._heartbeatInterval = setInterval(() => {
            if (this.config.enabled) {
              Utils.safeLog('log', 'heartbeat - module loaded:', this.loaded);
            }
          }, this.config.heartbeatInterval || 60000);
        });
      } catch (err) {
        Utils.safeLog('error', 'Execute error:', err);
      }
    }

    onConfigUpdate(settings) {
      Utils.safeLog('log', 'onConfigUpdate', settings);
      Object.assign(this.config, settings);

      if (settings.heartbeatInterval && this._heartbeatInterval) {
        clearInterval(this._heartbeatInterval);
        this._heartbeatInterval = setInterval(() => {
          if (this.config.enabled) {
            Utils.safeLog('log', 'heartbeat - module loaded:', this.loaded);
          }
        }, this.config.heartbeatInterval);
      }
    }

    destroy() {
      try {
        Utils.measurePerformance('DevSmokeTest cleanup', () => {
          if (this._observer) {
            this._observer.disconnect();
            this._observer = null;
            Utils.safeLog('log', 'Observer disconnected');
          }

          if (this._heartbeatInterval) {
            clearInterval(this._heartbeatInterval);
            this._heartbeatInterval = null;
            Utils.safeLog('log', 'Heartbeat interval cleared');
          }

          this.loaded = false;
          Utils.safeLog('log', 'Cleanup complete');
        });
      } catch (err) {
        Utils.safeLog('error', 'Cleanup error:', err);
      }
    }
  }

  const instance = new DevSmokeTestModule();
  if (window.ModuleRegistry && typeof window.ModuleRegistry.register === 'function') {
    window.ModuleRegistry.register(instance);
  } else if (window.ChatGPTModules && typeof window.ChatGPTModules.register === 'function') {
    window.ChatGPTModules.register(instance);
  } else {
    window.DevSmokeTest = instance;
    try {
      instance.init();
      instance.execute();
    } catch (err) {
      Utils.safeLog('error', 'fallback init/execute error', err);
    }
  }
})();
