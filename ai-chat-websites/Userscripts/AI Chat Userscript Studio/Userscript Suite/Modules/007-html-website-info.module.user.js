// ==UserScript==
// @name         HTML & Website Info
// @namespace    http://tampermonkey.net/
// @version      2026.04.28.0
// @description  Fetch page HTML, summarize website info, and optionally insert it into a prompt field
// @author       AI RMD
// @license      MIT
// @match        https://chat.openai.com/*
// @match        https://chatgpt.com/*
// @match        https://claude.ai/*
// @match        https://perplexity.ai/*
// @match        https://www.google.com/search*
// @match        https://www.bing.com/search*
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @grant        GM_xmlhttpRequest
// ==/UserScript==

(function() {
  'use strict';

  class AIRMDHtmlAndWebsiteInfoModule {
    constructor() {
      this.name = 'AIRMDHtmlAndWebsiteInfo';
      this.version = '2026.03.28.1';
      this.dependencies = [];
      this.critical = false;
      this.config = {
        autoListen: false,
        triggerPhrases: ['AI request', 'mentioned data'],
        maxHtmlLength: 12000,
        inputSelector: 'textarea'
      };
      this._listener = null;
      this.api = {
        fetchHTML: (url, options) => this.fetchHTML(url, options),
        collectPageInfo: () => this.collectPageInfo(),
        buildPromptPayload: (options) => this.buildPromptPayload(options),
        insertTextToChatGPTInput: (text, selector) => this.insertTextToChatGPTInput(text, selector),
        startTriggerListener: () => this.startTriggerListener(),
        stopTriggerListener: () => this.stopTriggerListener(),
        init: () => this.initApi()
      };
    }

    init() {
      if (window.ConfigManager && typeof window.ConfigManager.getConfig === 'function') {
        this.config = {
          ...this.config,
          ...window.ConfigManager.getConfig('airmdhtmlandwebsiteinfo')
        };
      }

      window.AIRMDHtmlAndWebsiteInfo = this.api;
      window.fetchHTML = (url, options) => this.fetchHTML(url, options);
      return this.api;
    }

    execute() {
      if (this.config.autoListen) {
        this.startTriggerListener();
      }
    }

    onConfigUpdate(settings) {
      Object.assign(this.config, settings);
      if (this.config.autoListen) {
        this.startTriggerListener();
      } else {
        this.stopTriggerListener();
      }
    }

    truncateText(text, maxLength = this.config.maxHtmlLength) {
      const value = String(text || '');
      if (value.length <= maxLength) {
        return value;
      }

      return `${value.slice(0, maxLength)}\n...[truncated ${value.length - maxLength} chars]`;
    }

    async fetchHTML(url = window.location.href, options = {}) {
      try {
        const response = await fetch(url, {
          credentials: options.credentials || 'include',
          headers: options.headers || {}
        });

        if (!response.ok) {
          throw new Error(`HTTP error ${response.status}`);
        }

        const html = await response.text();
        return this.truncateText(html, options.maxHtmlLength || this.config.maxHtmlLength);
      } catch (error) {
        console.error('[AIRMDHtmlAndWebsiteInfo] Error fetching HTML:', error);
        return null;
      }
    }

    collectPageInfo() {
      const descriptionElement = document.querySelector('meta[name="description"]');
      const headings = Array.from(document.querySelectorAll('h1, h2, h3'))
        .map((heading) => (heading.textContent || '').trim())
        .filter(Boolean)
        .slice(0, 10);

      return {
        url: window.location.href,
        title: document.title || '',
        description: descriptionElement ? descriptionElement.getAttribute('content') || '' : '',
        headings
      };
    }

    buildPromptPayload(options = {}) {
      const pageInfo = this.collectPageInfo();
      const html = options.html || '';
      return [
        `URL: ${pageInfo.url}`,
        `Title: ${pageInfo.title}`,
        pageInfo.description ? `Description: ${pageInfo.description}` : '',
        pageInfo.headings.length ? `Headings: ${pageInfo.headings.join(' | ')}` : '',
        html ? `HTML:\n${html}` : ''
      ].filter(Boolean).join('\n\n');
    }

    insertTextToChatGPTInput(text, selector = this.config.inputSelector) {
      const inputField = document.querySelector(selector) || document.querySelector('[contenteditable="true"]');
      if (!inputField) {
        return false;
      }

      if ('value' in inputField) {
        inputField.value = text;
      } else {
        inputField.textContent = text;
      }

      if (typeof inputField.dispatchEvent === 'function') {
        const event = typeof Event === 'function'
          ? new Event('input', { bubbles: true, cancelable: true })
          : { type: 'input', bubbles: true };
        inputField.dispatchEvent(event);
      }

      return true;
    }

    matchesTrigger(inputText) {
      return this.config.triggerPhrases.some((trigger) => String(inputText || '').includes(trigger));
    }

    async handleTrigger() {
      const html = await this.fetchHTML(window.location.href);
      if (!html) {
        return false;
      }

      const message = this.buildPromptPayload({ html });
      return this.insertTextToChatGPTInput(message);
    }

    startTriggerListener() {
      if (this._listener) {
        return;
      }

      this._listener = (event) => {
        const value = event && event.target && 'value' in event.target ? event.target.value : '';
        if (this.matchesTrigger(value)) {
          void this.handleTrigger();
        }
      };

      document.addEventListener('input', this._listener);
    }

    stopTriggerListener() {
      if (!this._listener) {
        return;
      }

      document.removeEventListener('input', this._listener);
      this._listener = null;
    }

    initApi() {
      return {
        autoListen: this.config.autoListen,
        triggerCount: this.config.triggerPhrases.length
      };
    }

    destroy() {
      this.stopTriggerListener();
      delete window.fetchHTML;
    }
  }

  const instance = new AIRMDHtmlAndWebsiteInfoModule();
  window.AIRMDHtmlAndWebsiteInfoModule = instance;

  // ✅ Legacy RMD Compatibility - Integrated
  const LEGACY_METHOD_ALIASES = {
    fetchHTML: "fetchHTML",
    airmdInitHtmlAndWebsiteInfo: "init",
    airmdCollectPageInfo: "collectPageInfo",
    airmdBuildPromptPayload: "buildPromptPayload",
    airmdInsertTextToChatGPTInput: "insertTextToChatGPTInput",
    airmdStartWebsiteInfoListener: "startTriggerListener",
    airmdStopWebsiteInfoListener: "stopTriggerListener"
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
          this.name = "16-rmd-html-website-info";
          this.version = "2026.04.11.1";
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
