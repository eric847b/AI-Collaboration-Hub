// ==UserScript==
// @name         Data Optimizer
// @namespace    http://tampermonkey.net/
// @version      2026.04.05.1
// @description  Optimizes data usage and improves AI response efficiency
// @match        https://chat.openai.com/*
// @match        https://chatgpt.com/*
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @grant        GM_notification
// @run-at       document-end
// ==/UserScript==

(function() {
  'use strict';

  const MODULE_VERSION = '2026.04.05.1';
  const STORAGE_KEY = 'ai_data_optimizer_settings';
  const MAX_HISTORY_ITEMS = 200;
  const MODULE_NAME = 'AI Data Optimizer';

  class AIDataOptimizerModule {
    constructor() {
      this.name = MODULE_NAME;
      this.version = MODULE_VERSION;
      this.dependencies = [];
      this.critical = false;
      this.config = {
        enabled: true,
        autoOptimize: true,
        compressionLevel: 3,
        cacheResponses: true,
        showOptimizationStats: true,
        maxCacheSize: 100
      };
      this._observer = null;
      this._menusRegistered = false;
      this._cache = {};
      this._stats = {
        optimizedRequests: 0,
        cachedResponses: 0,
        dataSaved: 0,
        compressionRatio: 0,
        lastOptimization: null
      };
      this.api = {
        optimizeData: (data) => this.optimizeData(data),
        getCache: () => this.getCache(),
        clearCache: () => this.clearCache(),
        getStats: () => this.getStats(),
        toggleOptimization: () => this.toggleOptimization(),
        setConfig: (settings) => this.setConfig(settings),
        getConfig: () => this.getConfig()
      };
    }

    init() {
      try {
        this.config = ModuleBootstrapHelper.loadConfig(this.config, '011-data-optimizer');

        window.AIDataOptimizerAPI = this.api;
        this.registerMenuCommands();
        this.ensureStyles();
        this.attachOptimizerUI();
        this.startOptimizationMonitoring();
        console.log(`[${MODULE_NAME}] Initialized`);
      } catch (err) {
        console.error(`[${MODULE_NAME}] Init error:`, err);
      }
    }

    onConfigUpdate(settings) {
      Object.assign(this.config, settings);

      if (this.config.enabled) {
        this.ensureStyles();
        this.startOptimizationMonitoring();
      } else {
        this.stopOptimizationMonitoring();
      }

      console.log(`[${MODULE_NAME}] Config updated:`, this.config);
    }

    ensureStyles() {
      if (!document.head || document.getElementById('ai-data-optimizer-styles')) {
        return;
      }

      const style = document.createElement('style');
      style.id = 'ai-data-optimizer-styles';
      style.textContent = `
        .data-optimizer-container {
          position: fixed;
          top: 300px;
          right: 20px;
          width: 280px;
          background: rgba(15, 23, 42, 0.95);
          border: 1px solid rgba(34, 197, 94, 0.3);
          border-radius: 12px;
          padding: 15px;
          color: white;
          font-family: system-ui, -apple-system, sans-serif;
          box-shadow: 0 10px 25px rgba(0,0,0,0.3);
          z-index: 99998;
          backdrop-filter: blur(10px);
          display: none;
        }

        .data-optimizer-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 15px;
          border-bottom: 1px solid rgba(34, 197, 94, 0.3);
          padding-bottom: 10px;
        }

        .data-optimizer-title {
          font-size: 14px;
          font-weight: 600;
          color: white;
        }

        .data-optimizer-toggle {
          background: none;
          border: none;
          color: #94a3b8;
          cursor: pointer;
          font-size: 16px;
          padding: 0;
          width: 20px;
          height: 20px;
        }

        .optimization-stats {
          display: flex;
          flex-direction: column;
          gap: 10px;
          margin-bottom: 15px;
        }

        .stat-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 8px;
          background: rgba(255, 255, 255, 0.05);
          border-radius: 6px;
          border: 1px solid rgba(255, 255, 255, 0.1);
        }

        .stat-label {
          font-size: 12px;
          color: #94a3b8;
        }

        .stat-value {
          font-size: 14px;
          font-weight: 600;
          color: white;
        }

        .stat-success {
          color: #22c55e;
        }

        .stat-warning {
          color: #f59e0b;
        }

        .optimization-actions {
          display: flex;
          gap: 10px;
          justify-content: center;
        }

        .optimization-btn {
          padding: 6px 12px;
          border: 1px solid rgba(34, 197, 94, 0.3);
          border-radius: 6px;
          background: rgba(34, 197, 94, 0.1);
          color: white;
          font-size: 11px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }

        .optimization-btn:hover {
          background: rgba(34, 197, 94, 0.2);
          border-color: rgba(34, 197, 94, 0.5);
        }

        .optimization-btn.active {
          background: #16a34a;
          border-color: #16a34a;
        }

        .cache-status {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 8px;
          background: rgba(255, 255, 255, 0.05);
          border-radius: 6px;
          border: 1px solid rgba(255, 255, 255, 0.1);
          margin-bottom: 10px;
        }

        .cache-label {
          font-size: 12px;
          color: #94a3b8;
        }

        .cache-value {
          font-size: 14px;
          font-weight: 600;
          color: white;
        }

        .cache-warning {
          color: #f59e0b;
        }
      `;

      document.head.appendChild(style);
    }

    createTextSpan(className, text, id = '') {
      const span = document.createElement('span');
      span.className = className;
      span.textContent = text;
      if (id) {
        span.id = id;
      }
      return span;
    }

    createStatItem(label, valueId, valueText, valueClass = '') {
      const statItem = document.createElement('div');
      statItem.className = 'stat-item';

      const labelSpan = this.createTextSpan('stat-label', label);
      const valueClasses = ['stat-value', valueClass].filter(Boolean).join(' ');
      const valueSpan = this.createTextSpan(valueClasses, valueText, valueId);

      statItem.appendChild(labelSpan);
      statItem.appendChild(valueSpan);
      return statItem;
    }

    attachOptimizerUI() {
      if (!document.body || document.getElementById('data-optimizer-container')) {
        return;
      }

      const container = document.createElement('div');
      container.id = 'data-optimizer-container';
      container.className = 'data-optimizer-container';

      const header = document.createElement('div');
      header.className = 'data-optimizer-header';
      const title = this.createTextSpan('data-optimizer-title', 'AI Data Optimizer');
      const closeButton = document.createElement('button');
      closeButton.type = 'button';
      closeButton.className = 'data-optimizer-toggle';
      closeButton.textContent = 'x';
      closeButton.setAttribute('aria-label', 'Toggle optimization panel');
      closeButton.addEventListener('click', () => {
        this.toggleOptimization();
      });
      header.appendChild(title);
      header.appendChild(closeButton);

      const stats = document.createElement('div');
      stats.className = 'optimization-stats';
      stats.appendChild(this.createStatItem('Optimized Requests', 'optimized-requests', '0', 'stat-success'));
      stats.appendChild(this.createStatItem('Cached Responses', 'cached-responses', '0', 'stat-success'));
      stats.appendChild(this.createStatItem('Data Saved', 'data-saved', '0MB'));
      stats.appendChild(this.createStatItem('Compression Ratio', 'compression-ratio', '0%'));

      const cacheStatus = document.createElement('div');
      cacheStatus.className = 'cache-status';
      cacheStatus.appendChild(this.createTextSpan('cache-label', 'Cache Size'));
      cacheStatus.appendChild(this.createTextSpan('cache-value', '0MB', 'cache-size'));

      const actions = document.createElement('div');
      actions.className = 'optimization-actions';
      const clearCacheButton = document.createElement('button');
      clearCacheButton.type = 'button';
      clearCacheButton.className = 'optimization-btn';
      clearCacheButton.id = 'clear-cache-btn';
      clearCacheButton.textContent = 'Clear Cache';
      const toggleOptimizationButton = document.createElement('button');
      toggleOptimizationButton.type = 'button';
      toggleOptimizationButton.className = 'optimization-btn active';
      toggleOptimizationButton.id = 'toggle-optimization-btn';
      toggleOptimizationButton.textContent = 'Optimization On';
      actions.appendChild(clearCacheButton);
      actions.appendChild(toggleOptimizationButton);

      container.appendChild(header);
      container.appendChild(stats);
      container.appendChild(cacheStatus);
      container.appendChild(actions);

      document.body.appendChild(container);

      clearCacheButton.addEventListener('click', () => {
        this.clearCache();
      });

      toggleOptimizationButton.addEventListener('click', () => {
        this.config.autoOptimize = !this.config.autoOptimize;
        const btn = document.getElementById('toggle-optimization-btn');
        if (this.config.autoOptimize) {
          btn.textContent = 'Optimization On';
          btn.classList.add('active');
          this.startOptimizationMonitoring();
        } else {
          btn.textContent = 'Optimization Off';
          btn.classList.remove('active');
          this.stopOptimizationMonitoring();
        }
      });
    }

    startOptimizationMonitoring() {
      if (!this.config.autoOptimize || this._monitoringInterval) {
        return;
      }

      this._monitoringInterval = setInterval(() => {
        this.updateOptimizationStats();
      }, 5000);
    }

    stopOptimizationMonitoring() {
      if (this._monitoringInterval) {
        clearInterval(this._monitoringInterval);
        this._monitoringInterval = null;
      }
    }

    updateOptimizationStats() {
      const cacheSize = this.calculateCacheSize();
      const dataSaved = this.calculateDataSaved();

      document.getElementById('optimized-requests').textContent = this._stats.optimizedRequests;
      document.getElementById('cached-responses').textContent = this._stats.cachedResponses;
      document.getElementById('data-saved').textContent = `${(dataSaved / 1024 / 1024).toFixed(2)}MB`;
      document.getElementById('compression-ratio').textContent = `${this._stats.compressionRatio.toFixed(1)}%`;
      document.getElementById('cache-size').textContent = `${(cacheSize / 1024 / 1024).toFixed(2)}MB`;

      if (cacheSize > this.config.maxCacheSize * 1024 * 1024) {
        document.getElementById('cache-size').classList.add('cache-warning');
      } else {
        document.getElementById('cache-size').classList.remove('cache-warning');
      }
    }

    optimizeData(data) {
      if (!this.config.autoOptimize) {
        return data;
      }

      const originalSize = this.estimateSize(data);
      const compressedData = this.compressData(data);
      const compressedSize = this.estimateSize(compressedData);

      const compressionRatio = originalSize > 0 ? ((originalSize - compressedSize) / originalSize) * 100 : 0;
      const dataSaved = originalSize - compressedSize;

      this._stats.optimizedRequests++;
      this._stats.compressionRatio = (this._stats.compressionRatio + compressionRatio) / 2;
      this._stats.dataSaved += dataSaved;

      return compressedData;
    }

    compressData(data) {
      try {
        const jsonString = JSON.stringify(data);
        const compressed = jsonString.replace(/\s+/g, ' ').replace(/[\n\r\t]/g, '');
        return JSON.parse(compressed);
      } catch (e) {
        return data;
      }
    }

    cacheResponse(request, response) {
      if (!this.config.cacheResponses) {
        return;
      }

      const cacheKey = this.generateCacheKey(request);
      this._cache[cacheKey] = {
        response,
        timestamp: Date.now(),
        size: this.estimateSize(response)
      };

      this._stats.cachedResponses++;
      this.pruneCache();
    }

    getCachedResponse(request) {
      if (!this.config.cacheResponses) {
        return null;
      }

      const cacheKey = this.generateCacheKey(request);
      const cached = this._cache[cacheKey];

      if (cached && (Date.now() - cached.timestamp) < 300000) {
        return cached.response;
      }

      return null;
    }

    generateCacheKey(request) {
      return btoa(JSON.stringify(request)).substring(0, 32);
    }

    pruneCache() {
      const cacheEntries = Object.entries(this._cache);
      if (cacheEntries.length > 100) {
        const sortedEntries = cacheEntries.sort((a, b) => b[1].timestamp - a[1].timestamp);
        const entriesToRemove = sortedEntries.slice(100);
        entriesToRemove.forEach(([key]) => delete this._cache[key]);
      }
    }

    calculateCacheSize() {
      return Object.values(this._cache).reduce((sum, item) => sum + item.size, 0);
    }

    calculateDataSaved() {
      return this._stats.dataSaved;
    }

    estimateSize(obj) {
      return new TextEncoder().encode(JSON.stringify(obj)).length;
    }

    clearCache() {
      this._cache = {};
      this._stats.cachedResponses = 0;
      this.updateOptimizationStats();
      GM_notification({
        text: 'Cache cleared',
        title: 'AI Data Optimizer',
        timeout: 2000
      });
    }

    getCache() {
      return { ...this._cache };
    }

    getStats() {
      const cacheSize = this.calculateCacheSize();
      return {
        optimizedRequests: this._stats.optimizedRequests,
        cachedResponses: this._stats.cachedResponses,
        dataSaved: this._stats.dataSaved,
        compressionRatio: this._stats.compressionRatio,
        cacheSize,
        lastOptimization: this._stats.lastOptimization
      };
    }

    toggleOptimization() {
      const container = document.getElementById('data-optimizer-container');
      if (container) {
        container.style.display = container.style.display === 'none' ? 'block' : 'none';
      }
    }

    setConfig(settings) {
      Object.assign(this.config, settings);
      this.onConfigUpdate(settings);
    }

    getConfig() {
      return { ...this.config };
    }

    registerMenuCommands() {
      if (this._menusRegistered || typeof GM_registerMenuCommand !== 'function') {
        return;
      }

      GM_registerMenuCommand('AI Data Optimizer: Toggle', () => {
        this.toggleOptimization();
      });

      GM_registerMenuCommand('AI Data Optimizer: Clear Cache', () => {
        this.clearCache();
      });

      GM_registerMenuCommand('AI Data Optimizer: Settings', () => {
        alert(`AI Data Optimizer\n\nEnabled: ${this.config.enabled}\nAuto-optimize: ${this.config.autoOptimize}\nCompression level: ${this.config.compressionLevel}\nCache responses: ${this.config.cacheResponses}\nMax cache size: ${this.config.maxCacheSize}MB`);
      });

      this._menusRegistered = true;
    }

    removeOptimizerUI() {
      const container = document.getElementById('data-optimizer-container');
      if (container) {
        container.remove();
      }
    }

    execute() {
      if (this.config.enabled) {
        this.attachOptimizerUI();
        this.startOptimizationMonitoring();
      }
      console.log(`[${MODULE_NAME}] Execute called`);
    }

    destroy() {
      try {
        this.stopOptimizationMonitoring();
        this.removeOptimizerUI();
        console.log(`[${MODULE_NAME}] Cleanup complete`);
      } catch (err) {
        console.error(`[${MODULE_NAME}] Cleanup error:`, err);
      }
    }
  }

  const instance = new AIDataOptimizerModule();
  window.AIDataOptimizerModule = instance;
  if (window.ChatGPTModules && typeof window.ChatGPTModules.register === 'function') {
    window.ChatGPTModules.register(instance);
  } else if (window.ModuleRegistry && typeof window.ModuleRegistry.register === 'function') {
    window.ModuleRegistry.register(instance);
  } else {
    window.AIDataOptimizerAPI = instance.api;
    try {
      instance.init();
      instance.execute();
    } catch (err) {
      console.error(`[${MODULE_NAME}] fallback error`, err);
    }
  }
})();
