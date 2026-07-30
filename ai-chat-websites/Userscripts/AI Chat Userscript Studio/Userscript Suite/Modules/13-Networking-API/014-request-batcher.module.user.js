// ==UserScript==
// @name         Request Batcher
// @version      2026.06.26.1
// @description  AI Chat Userscript Suite - Module 102: Request Batcher
// @author       AI Chat Userscript Studio
// @match        https://chat.openai.com/*
// @match        https://chatgpt.com/*
// @match        https://claude.ai/*
// @match        https://poe.com/*
// @match        https://perplexity.ai/*
// @match        https://www.perplexity.ai/*
// @match        https://pi.ai/*
// @match        https://you.com/*
// @match        https://gemini.google.com/*
// @match        https://aistudio.google.com/*
// @match        https://copilot.microsoft.com/*
// @match        https://chat.mistral.ai/*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_log
// @run-at       document-idle
// ==/UserScript==

(function() {
    'use strict';

    var MODULE_ID = 'module-' + 102;
    var MODULE_NAME = 'Request Batcher';

    window[MODULE_ID] = window[MODULE_ID] || {};

    var module = window[MODULE_ID];
    module.id = MODULE_ID;
    module.name = MODULE_NAME;
    module.version = '2026.06.26.1';

    var batcher = {
        queue: [],
        running: false,
        maxBatchSize: 4,

        enqueue: function(fn, options) {
            var task = {
                fn: fn,
                options: options || {},
                createdAt: Date.now()
            };
            this.queue.push(task);
            if (!this.running) this.drain();
        },

        drain: function() {
            if (this.running) return;
            this.running = true;

            var next = this.queue.shift();
            if (!next) {
                this.running = false;
                return;
            }

            this.run(next).then(function() {
                batcher.running = false;
                batcher.drain();
            }).catch(function() {
                batcher.running = false;
                batcher.drain();
            });
        },

        run: function(task) {
            var self = this;
            return new Promise(function(resolve, reject) {
                task.resolve = resolve;
                task.reject = reject;
                self.process(task);
            });
        },

        process: function(task) {
            var helper = window.promptSplitterRetry;
            if (helper && typeof helper.execute === 'function') {
                helper.execute(task.fn, {
                    maxRetries: task.options.maxRetries,
                    baseDelay: task.options.baseDelay,
                    ui: task.options.ui
                }).then(function(outcome) {
                    task.resolve(outcome);
                }).catch(function(err) {
                    task.reject(err);
                });
            } else if (typeof task.fn === 'function') {
                task.fn().then(function(result) {
                    task.resolve(result);
                }).catch(function(err) {
                    task.reject(err);
                });
            } else {
                task.resolve(task.fn);
            }
        }
    };

    module.init = function() {
        module.batcher = batcher;
        if (typeof GM_setValue !== 'undefined') {
            GM_setValue(MODULE_ID + '_loaded', 'true');
        }
    };

    if (typeof module.init === 'function') {
        module.init();
    }

    console.log('[' + MODULE_ID + '] ' + MODULE_NAME + ' loaded');
})();