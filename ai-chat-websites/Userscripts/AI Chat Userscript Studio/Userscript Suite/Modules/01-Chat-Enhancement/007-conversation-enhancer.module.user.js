// ==UserScript==
// @name         Conversation Enhancer
// @namespace    http://tampermonkey.net/
// @version      2026.04.28.0
// @description  Enhances AI conversations with real-time suggestions, sentiment analysis, and context awareness
// @author       AI RMD
// @license      MIT
// @match        https://chat.openai.com/*
// @match        https://chatgpt.com/*
// @match        https://claude.ai/*
// @match        https://gemini.google.com/*
// @match        https://perplexity.ai/*
// @match        https://poe.com/*
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// ==/UserScript==

(function() {
  'use strict';

  // Define default configuration for this module
  const defaultConfig = {
    enabled: true,
    minTextLengthForAnalysis: 10,
    maxSuggestions: 3,
    customSuggestions: [
      'Consider adding more context to your question.',
      'Try rephrasing for clarity.',
      'This might benefit from examples.',
      'Consider breaking this into smaller questions.'
    ],
    contextualSuggestions: {
      code: 'Consider specifying the programming language or environment.',
      error: 'Include the full error message and what you have already tried.',
      summarize: 'Specify if you want a bulleted list or a paragraph summary.',
      debug: 'Include what troubleshooting steps you have already taken.',
      write: 'Specify tone, audience, and desired length for better results.'
    },
    sentimentPositiveWords: ['good', 'great', 'excellent', 'amazing', 'love', 'perfect', 'awesome', 'thank', 'thanks'],
    sentimentNegativeWords: ['bad', 'terrible', 'hate', 'worst', 'awful', 'wrong', 'incorrect', 'broken', 'not working'],
    uiPosition: { top: '20px', right: '20px' },
    selectors: {
      inputs: ['textarea[data-testid="prompt-textarea"]', 'textarea[placeholder*="Ask"]', 'textarea[placeholder*="Message"]', 'input[type="text"]'],
      responses: ['[data-message-id]', '.markdown', '.message-content', '.prose', '.response-content']
    },
    debounceMs: 350,
    hotkeysEnabled: true,
    autoSaveDrafts: true,
    showCharacterCount: true,
    enableDraggableUI: true,
    quickTemplates: true
  };

  class AIConversationEnhancer {
    constructor() {
      this.name = 'ai-conversation-enhancer';
      this.version = '1.1.0';
      this.dependencies = ['error-handling', 'user-interface'];
      this.critical = false;
      this.suggestions = [];
      this.sentimentHistory = [];
      this.config = {}; // Will be loaded via ConfigManager
      this.inputObservers = []; // To store MutationObservers for input fields
      this.debounceTimer = null;
      this.activeInput = null;
      this.keyHandler = null;
      this.draftStorageKey = 'ai-enhancer-drafts';
      this.isDragging = false;
      this.dragOffset = { x: 0, y: 0 };
    }

    init() {
      try {
        // Load configuration from ConfigManager
        this.config = window.ConfigManager?.getConfig(this.name) || defaultConfig;
        if (!this.config.enabled) {
          console.log(`[${this.name}] Module is disabled.`);
          return false;
        }

        this.applyStyles();
        this.injectSuggestionUI(); // Inject UI structure
        this.setupInputObservers(); // Use observers for dynamic inputs
        this.setupKeyboardShortcuts();
        this.observeResponses();
        
        // Restore draft if available
        setTimeout(() => {
          const savedDraft = this.loadDraft();
          if (savedDraft && document.activeElement?.tagName !== 'TEXTAREA') {
            const inputs = document.querySelectorAll(this.config.selectors.inputs.join(','));
            if (inputs.length > 0 && !inputs[0].value) {
              inputs[0].value = savedDraft;
              inputs[0].dispatchEvent(new Event('input', { bubbles: true }));
            }
          }
        }, 1500);

        console.log(`[${this.name}] Initialized v1.1.0 with config:`, this.config);
        return true;
      } catch (error) {
        console.error(`[${this.name}] Initialization failed:`, error);
        // Potentially use the 'error-handling' module here
        window.ModuleRegistry?.getModuleInstance('error-handling')?.handleError(error, `${this.name}.init`);
        return false;
      }
    }

    onConfigUpdate(newConfig) {
      // Called by ConfigManager when settings for this module are updated
      Object.assign(this.config, newConfig);
      console.log(`[${this.name}] Configuration updated:`, this.config);
      // Re-apply styles if UI position changes
      this.applyStyles();
      // Potentially re-setup observers if input selectors change, though not in current config
    }

    applyStyles() {
      const styleId = 'ai-enhancer-styles';
      let styleElement = document.getElementById(styleId);
      if (!styleElement) {
        styleElement = document.createElement('style');
        styleElement.id = styleId;
        document.head.appendChild(styleElement);
      }

      styleElement.textContent = `
        #ai-enhancer-suggestions {
          position: fixed;
          top: ${this.config.uiPosition.top};
          right: ${this.config.uiPosition.right};
          width: 320px;
          background: rgba(255, 255, 255, 0.95);
          border: 1px solid #ccc;
          border-radius: 10px;
          padding: 0;
          z-index: 10000;
          font-family: system-ui, -apple-system, sans-serif;
          font-size: 13px;
          display: none;
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
          transition: all 0.2s ease;
          backdrop-filter: blur(10px);
          user-select: none;
        }
        #ai-enhancer-suggestions.draggable {
          cursor: move;
        }
        #ai-enhancer-header {
          padding: 10px 12px;
          border-bottom: 1px solid rgba(0,0,0,0.08);
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-weight: 600;
        }
        #ai-enhancer-content {
          padding: 8px 12px;
        }
        #ai-enhancer-char-count {
          font-size: 11px;
          opacity: 0.7;
          text-align: right;
          padding: 4px 12px;
          border-top: 1px solid rgba(0,0,0,0.05);
        }
        .suggestion-item {
          padding: 6px 8px;
          margin: 4px 0;
          border-radius: 6px;
          cursor: pointer;
          transition: background 0.15s ease;
        }
        .suggestion-item:hover {
          background: rgba(0,0,0,0.05);
        }
        @media (prefers-color-scheme: dark) {
          #ai-enhancer-suggestions {
            background: rgba(22, 22, 26, 0.95);
            color: #e8e8ed;
            border-color: #3f3f46;
          }
          #ai-enhancer-header {
            border-bottom-color: rgba(255,255,255,0.08);
          }
          #ai-enhancer-char-count {
            border-top-color: rgba(255,255,255,0.05);
          }
          .suggestion-item:hover {
            background: rgba(255,255,255,0.05);
          }
        }
      `;
    }

    setupKeyboardShortcuts() {
      if (!this.config.hotkeysEnabled) return;
      
      this.keyHandler = (event) => {
        if (event.altKey && !isNaN(event.key)) {
          const index = parseInt(event.key) - 1;
          if (this.suggestions[index]) {
            event.preventDefault();
            this.applySuggestionToIndex(index);
          }
        }
      };

      window.addEventListener('keydown', this.keyHandler);
      console.log(`[${this.name}] Keyboard shortcuts enabled (Alt + 1-9)`);
    }

    setupInputObservers() {
      const inputSelectors = this.config.selectors.inputs;

      // Initial setup for existing inputs
      inputSelectors.forEach((selector) => {
        document.querySelectorAll(selector).forEach((input) => {
          this.addInputListener(input);
        });
      });

      // Observe for dynamically added input fields
      const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
            inputSelectors.forEach((selector) => {
              mutation.addedNodes.forEach((node) => {
                if (node.nodeType === Node.ELEMENT_NODE) {
                  // Check if the added node itself matches the selector
                  if (node.matches(selector)) {
                    this.addInputListener(node);
                  }
                  // Check for matching elements within the added node's subtree
                  node.querySelectorAll(selector).forEach((input) => {
                    this.addInputListener(input);
                  });
                }
              });
            });
          }
        });
      });

      observer.observe(document.body, { childList: true, subtree: true });
      this.inputObservers.push(observer); // Keep track of observers for potential cleanup
    }

    addInputListener(inputElement) {
      // Prevent adding duplicate listeners
      if (!inputElement.__aiEnhancerListenerAdded) {
        inputElement.addEventListener('input', (event) => {
          this.activeInput = event.target;
          this.onInputChange(event.target.value);
        });
        inputElement.__aiEnhancerListenerAdded = true; // Mark as handled
      }
    }

    onInputChange(text) {
      clearTimeout(this.debounceTimer);
      
      // Update character counter immediately
      const charCounter = document.getElementById('ai-enhancer-char-count');
      if (charCounter) {
        charCounter.textContent = `${text.length} characters • ~${Math.round(text.length / 4)} tokens`;
      }

      this.debounceTimer = setTimeout(() => {
        if (text.length > this.config.minTextLengthForAnalysis) {
          this.generateSuggestions(text);
          this.analyzeSentiment(text);
          
          // Auto-save draft
          if (this.config.autoSaveDrafts && text.length > 20) {
            this.saveDraft(text);
          }
        } else {
          this.suggestions = []; 
          this.updateSuggestionUI();
        }
      }, this.config.debounceMs);
    }

    generateSuggestions(text) {
      const results = [...this.config.customSuggestions];
      const lowerText = text.toLowerCase();

      // Contextual Logic
      Object.keys(this.config.contextualSuggestions).forEach(key => {
        if (lowerText.includes(key)) {
          results.unshift(this.config.contextualSuggestions[key]);
        }
      });

      this.suggestions = results.slice(0, this.config.maxSuggestions);
      this.updateSuggestionUI();
    }

    analyzeSentiment(text) {
      const words = text.toLowerCase().split(/\s+/);
      const positiveCount = words.filter((word) => this.config.sentimentPositiveWords.includes(word)).length;
      const negativeCount = words.filter((word) => this.config.sentimentNegativeWords.includes(word)).length;

      const sentiment =
        positiveCount > negativeCount
          ? 'positive'
          : negativeCount > positiveCount
            ? 'negative'
            : 'neutral';
      this.sentimentHistory.push({
        text: text.substring(0, 50),
        sentiment,
        timestamp: Date.now()
      });
      if (this.sentimentHistory.length > 10) {
        this.sentimentHistory.shift();
      }

      // Dispatch for other modules
      window.dispatchEvent(new CustomEvent('ai-enhancer:sentiment', { 
        detail: { sentiment, text: text.substring(0, 50) } 
      }));
      
      this.updateSentimentVisuals(sentiment);
    }

    injectSuggestionUI() {
      if (document.getElementById('ai-enhancer-suggestions')) {
        return;
      }

      const ui = document.createElement('div');
      ui.id = 'ai-enhancer-suggestions';

      const header = document.createElement('div');
      header.id = 'ai-enhancer-header';
      header.textContent = 'AI Assistant';

      const closeBtn = document.createElement('button');
      closeBtn.type = 'button';
      closeBtn.textContent = 'x';
      closeBtn.style.opacity = '0.5';
      closeBtn.style.cursor = 'pointer';
      closeBtn.style.border = 'none';
      closeBtn.style.background = 'transparent';
      closeBtn.style.color = 'inherit';
      closeBtn.setAttribute('aria-label', 'Close AI assistant');
      closeBtn.addEventListener('mousedown', (event) => {
        event.stopPropagation();
      });
      closeBtn.addEventListener('click', (event) => {
        event.stopPropagation();
        ui.style.display = 'none';
      });
      header.appendChild(closeBtn);

      const content = document.createElement('div');
      content.id = 'ai-enhancer-content';

      const list = document.createElement('div');
      list.id = 'suggestions-list';
      list.setAttribute('aria-live', 'polite');

      const sentimentBar = document.createElement('div');
      sentimentBar.id = 'ai-sentiment-indicator';
      sentimentBar.style.height = '4px';
      sentimentBar.style.margin = '8px 0 4px 0';
      sentimentBar.style.borderRadius = '2px';
      sentimentBar.style.background = '#ccc';

      const charCount = document.createElement('div');
      charCount.id = 'ai-enhancer-char-count';
      charCount.textContent = '0 characters';

      content.appendChild(list);
      content.appendChild(sentimentBar);
      ui.appendChild(header);
      ui.appendChild(content);
      ui.appendChild(charCount);

      // Setup draggable functionality
      if (this.config.enableDraggableUI) {
        header.style.cursor = 'grab';
        header.addEventListener('mousedown', (e) => {
          this.isDragging = true;
          this.dragOffset.x = e.clientX - ui.offsetLeft;
          this.dragOffset.y = e.clientY - ui.offsetTop;
          header.style.cursor = 'grabbing';
          e.preventDefault();
        });

        document.addEventListener('mousemove', (e) => {
          if (!this.isDragging) return;
          ui.style.right = 'auto';
          ui.style.left = `${e.clientX - this.dragOffset.x}px`;
          ui.style.top = `${e.clientY - this.dragOffset.y}px`;
        });

        document.addEventListener('mouseup', () => {
          this.isDragging = false;
          header.style.cursor = 'grab';
        });
      }

      document.body.appendChild(ui);
    }

    updateSentimentVisuals(sentiment) {
      const bar = document.getElementById('ai-sentiment-indicator');
      if (!bar) return;
      
      const colors = {
        positive: '#2ecc71',
        negative: '#e74c3c',
        neutral: '#3498db'
      };
      bar.style.background = colors[sentiment] || '#ccc';
    }

    saveDraft(text) {
      try {
        const drafts = JSON.parse(localStorage.getItem(this.draftStorageKey) || '{}');
        const pageKey = window.location.hostname + window.location.pathname;
        drafts[pageKey] = {
          text: text,
          timestamp: Date.now()
        };
        // Keep only last 7 days of drafts
        Object.keys(drafts).forEach(key => {
          if (Date.now() - drafts[key].timestamp > 7 * 24 * 60 * 60 * 1000) {
            delete drafts[key];
          }
        });
        localStorage.setItem(this.draftStorageKey, JSON.stringify(drafts));
      } catch (e) {
        // Silently fail if localStorage is unavailable
      }
    }

    loadDraft() {
      try {
        const drafts = JSON.parse(localStorage.getItem(this.draftStorageKey) || '{}');
        const pageKey = window.location.hostname + window.location.pathname;
        return drafts[pageKey]?.text || null;
      } catch (e) {
        return null;
      }
    }

    updateSuggestionUI() {
      const ui = document.getElementById('ai-enhancer-suggestions');
      const list = document.getElementById('suggestions-list');
      if (!ui || !list) {
        return;
      }

      list.replaceChildren();
      if (this.suggestions.length === 0) {
        ui.style.display = 'none';
        return;
      }

      this.suggestions.forEach((suggestion, index) => {
        const item = document.createElement('div');
        item.className = 'suggestion-item';
        item.title = 'Click to add to prompt';
        item.setAttribute('role', 'button');
        item.tabIndex = 0;

        const shortcutSpan = document.createElement('span');
        shortcutSpan.style.opacity = '0.6';
        shortcutSpan.style.marginRight = '8px';
        shortcutSpan.style.fontSize = '11px';
        shortcutSpan.textContent = `Alt+${index + 1}`;

        const textSpan = document.createElement('span');
        textSpan.textContent = suggestion;

        item.appendChild(shortcutSpan);
        item.appendChild(textSpan);
        item.addEventListener('click', () => {
          this.applySuggestionToIndex(index);
        });
        item.addEventListener('keydown', (event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            this.applySuggestionToIndex(index);
          }
        });
        list.appendChild(item);
      });

      ui.style.display = 'block';
    }

    observeResponses() {
      const responseSelectors = this.config.selectors.responses;
      const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          if (mutation.type === 'childList') {
            mutation.addedNodes.forEach((node) => {
              if (node.nodeType === Node.ELEMENT_NODE && responseSelectors.some(s => node.matches(s))) {
                this.onNewResponse(node);
              }
            });
          }
        });
      });

      observer.observe(document.body, { childList: true, subtree: true });
    }

    applySuggestionToIndex(index) {
      const suggestion = this.suggestions[index];
      if (suggestion && this.activeInput) {
        const spacing = this.activeInput.value.length > 0 && !this.activeInput.value.endsWith(' ') ? ' ' : '';
        this.activeInput.value += spacing + suggestion;
        this.activeInput.dispatchEvent(new Event('input', { bubbles: true }));
        this.activeInput.focus();
      }
    }

    onNewResponse(responseElement) {
      const text = responseElement.textContent || '';
      if (text.length > 50) {
        this.analyzeResponseQuality(text);
      }
    }

    analyzeResponseQuality(text) {
      const wordCount = text.split(/\s+/).length;
      const sentenceCount = text.split(/[.!?]+/).length;
      const avgWordsPerSentence = wordCount / sentenceCount;

      const hasCode = text.includes('```');

      // Trigger proactive follow-up suggestions if quality is low
      if (wordCount < 30) {
        this.suggestions = ['Could you expand on that with more detail?', 'Can you provide an example of this?'];
        this.updateSuggestionUI();
      } else if (!hasCode && (this.activeInput?.value.toLowerCase().includes('code') || this.activeInput?.value.toLowerCase().includes('script'))) {
        this.suggestions = ['Could you provide a code snippet for this?', 'What are the implementation steps?'];
        this.updateSuggestionUI();
      }

      console.log(
        `[${this.name}] Quality: ${wordCount}w, ${avgWordsPerSentence.toFixed(1)}w/s, Code: ${hasCode}`
      );
    }

    destroy() {
      clearTimeout(this.debounceTimer);
      if (this.keyHandler) window.removeEventListener('keydown', this.keyHandler);
      this.inputObservers.forEach(obs => obs.disconnect());
      this.inputObservers = [];
      const ui = document.getElementById('ai-enhancer-suggestions');
      const styles = document.getElementById('ai-enhancer-styles');
      if (ui) ui.remove();
      if (styles) styles.remove();
      console.log(`[${this.name}] Cleanup complete`);
    }
  }

  // Register the module with the new ModuleRegistry
  if (typeof window !== 'undefined' && window.ModuleRegistry && typeof window.ModuleRegistry.register === 'function') {
    try {
      window.ModuleRegistry.register(new AIConversationEnhancer());
      // Also register default config with ConfigManager if it exists
      if (window.ConfigManager && typeof window.ConfigManager.setDefaultConfig === 'function') {
        window.ConfigManager.setDefaultConfig('ai-conversation-enhancer', defaultConfig);
      }
    } catch (error) {
      console.warn('AI Conversation Enhancer module registration failed', error);
    }
  } else {
    console.warn('AI Conversation Enhancer: ModuleRegistry not found. Module will not be registered.');
    // Fallback for environments without ModuleRegistry, though the prompt implies it exists.
    // For a userscript, this might mean directly instantiating and calling init().
    // const instance = new AIConversationEnhancer();
    // instance.init();
  }
})();
