// ==UserScript==
// @name         Parallel Processing
// @namespace    http://tampermonkey.net/
// @version      2026.04.28.0
// @description  Parallel processing tools for AI chat with Web Workers and task queues
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

  class AIRMDParallelProcessingModule {
    constructor() {
      this.name = 'AIRMDParallelProcessing';
      this.version = '2026.03.28.1';
      this.dependencies = [];
      this.critical = false;
      this.config = {
        defaultConcurrency: 2
      };
      this._activeWorkers = new Set();
      this.api = {
        useWebWorker: (input, workerSource) => this.useWebWorker(input, workerSource),
        createTaskQueue: (options) => this.createTaskQueue(options),
        runTaskBatch: (tasks, options) => this.runTaskBatch(tasks, options),
        init: () => this.initApi()
      };
    }

    init() {
      if (window.ConfigManager && typeof window.ConfigManager.getConfig === 'function') {
        this.config = {
          ...this.config,
          ...window.ConfigManager.getConfig('airmdparallelprocessing')
        };
      }

      window.AIRMDParallelProcessing = this.api;
      return this.api;
    }

    execute() {}

    onConfigUpdate(settings) {
      Object.assign(this.config, settings);
    }

    useWebWorker(input, workerSource) {
      if (typeof Worker !== 'function' || !window.URL || typeof window.URL.createObjectURL !== 'function') {
        return Promise.resolve(null);
      }

      const source = workerSource || [
        'onmessage = function(event) {',
        '  postMessage(event.data * event.data);',
        '};'
      ].join('\n');

      const objectUrl = window.URL.createObjectURL(new Blob([source], { type: 'application/javascript' }));
      const worker = new Worker(objectUrl);
      this._activeWorkers.add(worker);

      return new Promise((resolve, reject) => {
        const cleanup = () => {
          worker.terminate();
          this._activeWorkers.delete(worker);
          if (typeof window.URL.revokeObjectURL === 'function') {
            window.URL.revokeObjectURL(objectUrl);
          }
        };

        worker.onmessage = (event) => {
          cleanup();
          resolve(event.data);
        };

        worker.onerror = (error) => {
          cleanup();
          reject(error);
        };

        worker.postMessage(input);
      });
    }

    createTaskQueue(options = {}) {
      const queue = [];
      const concurrency = Math.max(1, options.concurrency || this.config.defaultConcurrency || 1);
      let running = 0;
      let idleResolver = null;

      const flushIdle = () => {
        if (running === 0 && queue.length === 0 && idleResolver) {
          idleResolver();
          idleResolver = null;
        }
      };

      const runNext = () => {
        while (running < concurrency && queue.length > 0) {
          const task = queue.shift();
          running += 1;

          Promise.resolve()
            .then(task)
            .catch(() => null)
            .finally(() => {
              running -= 1;
              runNext();
              flushIdle();
            });
        }

        flushIdle();
      };

      return {
        add(task) {
          queue.push(task);
          runNext();
          return queue.length + running;
        },
        size() {
          return queue.length + running;
        },
        onIdle() {
          if (running === 0 && queue.length === 0) {
            return Promise.resolve();
          }

          return new Promise((resolve) => {
            idleResolver = resolve;
          });
        }
      };
    }

    runTaskBatch(tasks = [], options = {}) {
      const concurrency = Math.max(1, options.concurrency || this.config.defaultConcurrency || 1);
      const results = new Array(tasks.length);
      let cursor = 0;

      const runWorker = async() => {
        while (cursor < tasks.length) {
          const currentIndex = cursor;
          cursor += 1;
          results[currentIndex] = await Promise.resolve(tasks[currentIndex]());
        }
      };

      const workers = Array.from({ length: Math.min(concurrency, tasks.length) }, () => runWorker());
      return Promise.all(workers).then(() => results);
    }

    initApi() {
      return {
        workerSupport: typeof Worker === 'function',
        defaultConcurrency: this.config.defaultConcurrency
      };
    }

    destroy() {
      this._activeWorkers.forEach((worker) => worker.terminate());
      this._activeWorkers.clear();
    }
  }

  const instance = new AIRMDParallelProcessingModule();
  window.AIRMDParallelProcessingModule = instance;
  
  // ✅ Legacy RMD Compatibility - Integrated
  const LEGACY_METHOD_ALIASES = {
    airmdInitParallelProcessing: "init",
    airmdUseWebWorker: "useWebWorker",
    airmdCreateTaskQueue: "createTaskQueue",
    airmdRunTaskBatch: "runTaskBatch"
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
          this.name = "20-rmd-parallel-processing";
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
