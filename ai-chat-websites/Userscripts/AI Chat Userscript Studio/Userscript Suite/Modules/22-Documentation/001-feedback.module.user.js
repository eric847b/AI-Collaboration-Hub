// ==UserScript==
// @name         Feedback
// @version      2026.03.19.0
// @description  ChatGPT - Feedback module for adjustments based on content analysis
// @match        https://chat.openai.com/*
// @match        https://chatgpt.com/*
// @grant        GM_setValue
// @grant        GM_getValue
// @require      https://cdn.jsdelivr.net/npm/@kudoai/chatgpt.js@latest/dist/chatgpt.min.js
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
      if (!window.performance) return fn();
      const start = performance.now();
      const result = fn();
      const end = performance.now();
      console.debug(`[Performance] ${label}: ${end - start}ms`);
      return result;
    }
  };

  class FeedbackModule {
    constructor() {
      this.name = 'Feedback';
      this.version = '2026.03.19.0';
      this.dependencies = [];
      this.critical = false;
      this.config = { enabled: true, sensitivity: 'medium' };
      this._observer = null;
      this._pollingTimer = null;
      this._throttledAnalyze = null;
      this._debouncedAnalyze = null;
      this._analysisMinInterval = 1000;
      this._isAnalyzing = false;
      this._lastAnalyzedText = '';
    }

    init() {
      try {
        if (window.ConfigManager && typeof window.ConfigManager.getConfig === 'function') {
          this.config = { ...this.config, ...window.ConfigManager.getConfig('feedback') };
        }

        this._throttledAnalyze = Utils.throttle((text) => {
          this.analyzeResponse(text);
        }, this._analysisMinInterval);
        this._debouncedAnalyze = Utils.debounce((text) => {
          this._throttledAnalyze(text);
        }, 200);

        Utils.measurePerformance('Feedback init', () => {
          this.setupResponseObserver();
          console.log('[Feedback] Initialized');
        });
      } catch (err) {
        console.error('[Feedback] Init error:', err);
        this._handleInitError(err);
      }
    }

    _handleInitError(err) {
      console.warn('[Feedback] Attempting recovery from initialization error...');
      if (err.message.includes('ConfigManager')) {
        this.config.enabled = false;
        console.warn('[Feedback] ConfigManager not available, module disabled');
      }
    }

    onConfigUpdate(settings) {
      Object.assign(this.config, settings);
      console.log('[Feedback] Config updated:', this.config);
    }

    setupResponseObserver() {
      try {
        Utils.measurePerformance('Observer setup', () => {
          if (typeof chatgpt === 'object' && typeof chatgpt.onNewResponse === 'function') {
            chatgpt.onNewResponse((response) => {
              if (this.config.enabled && response && response.text) {
                this._throttledAnalyze(response.text);
              }
            });
            return;
          }

          this._observer = new MutationObserver((mutations) => {
            if (!this.config.enabled) {
              return;
            }

            let combinedText = '';
            for (const mutation of mutations) {
              if (!mutation.addedNodes.length) {
                continue;
              }

              mutation.addedNodes.forEach(node => {
                if (node.nodeType === Node.ELEMENT_NODE && node.textContent && node.textContent.length > 10) {
                  combinedText += `${node.textContent}\n`;
                }
              });
            }

            if (combinedText.trim()) {
              this._debouncedAnalyze(combinedText.trim());
            }
          });

          this._observer.observe(document.body, { childList: true, subtree: true });
        });
      } catch (err) {
        console.error('[Feedback] Observer setup error:', err);
        this._handleObserverError(err);
      }
    }

    _handleObserverError() {
      console.warn('[Feedback] Observer setup failed, attempting alternative approach...');
      this._setupPollingObserver();
    }

    _setupPollingObserver() {
      console.log('[Feedback] Using polling observer as fallback');
      if (this._pollingTimer) {
        clearInterval(this._pollingTimer);
      }

      this._pollingTimer = setInterval(() => {
        if (!this.config.enabled) {
          return;
        }

        const responses = document.querySelectorAll('[data-testid="conversation-turn-end"]');
        const lastResponse = responses[responses.length - 1];
        if (lastResponse && lastResponse.textContent && lastResponse.textContent.length > 10) {
          this._debouncedAnalyze(lastResponse.textContent);
        }
      }, 2000);
    }

    analyzeResponse(text) {
      if (this._isAnalyzing) {
        return;
      }

      this._isAnalyzing = true;

      try {
        const normalizedText = (text || '').trim();
        if (!normalizedText || normalizedText.length < 10) {
          return;
        }

        if (normalizedText === this._lastAnalyzedText) {
          return;
        }

        this._lastAnalyzedText = normalizedText;

        Utils.measurePerformance('Response analysis', () => {
          const analysis = {
            length: normalizedText.length,
            complexity: this.analyzeComplexity(normalizedText),
            wordCount: normalizedText.split(/\s+/).length,
            sentenceCount: normalizedText.split(/[.!?]+/).length
          };

          if (analysis.complexity > 0.7 && this.config.sensitivity === 'high') {
            console.log('[Feedback] High complexity detected:', analysis);
          }
        });
      } catch (err) {
        console.error('[Feedback] Analysis error:', err);
      } finally {
        this._isAnalyzing = false;
      }
    }

    analyzeComplexity(text) {
      try {
        const words = text.split(/\s+/);
        if (words.length === 0) return 0;

        const avgWordLength = words.reduce((sum, word) => sum + word.length, 0) / words.length;
        const complexWords = words.filter(word => word.length > 10).length;

        return Math.min((avgWordLength / 10) * (complexWords / words.length), 1);
      } catch (err) {
        console.error('[Feedback] Complexity analysis error:', err);
        return 0;
      }
    }

    execute() {
      console.log('[Feedback] Execute called');
    }

    destroy() {
      try {
        if (this._observer) {
          this._observer.disconnect();
          this._observer = null;
          console.log('[Feedback] Observer disconnected');
        }

        if (this._pollingTimer) {
          clearInterval(this._pollingTimer);
          this._pollingTimer = null;
          console.log('[Feedback] Polling observer cleared');
        }

        this._throttledAnalyze = null;
        this._debouncedAnalyze = null;
        this._lastAnalyzedText = '';
        console.log('[Feedback] Cleanup complete');
      } catch (err) {
        console.error('[Feedback] Cleanup error:', err);
      }
    }
  }

  if (window.ModuleRegistry && typeof window.ModuleRegistry.register === 'function') {
    window.ModuleRegistry.register(new FeedbackModule());
  }
})();
