// ==UserScript==
// @name         Chat Enhancement
// @namespace    http://tampermonkey.net/
// @version      2026.04.05.1
// @description  Advanced chat interface improvements and enhancements
// @match        https://chat.openai.com/*
// @match        https://chatgpt.com/*
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @grant        GM_notification
// @grant        GM_xmlhttpRequest
// @connect      *
// @run-at       document-end
// ==/UserScript==

(function() {
  'use strict';

  const MODULE_VERSION = '2026.04.05.1';
  const STORAGE_KEY = 'chat_enhancement_settings';
  const MAX_HISTORY_ITEMS = 25;
  const MODULE_NAME = 'Chat Enhancement';

  // FREE PUBLIC RESOURCES NO API KEY REQUIRED
  const PUBLIC_RESOURCES = {
    wikipedia: 'https://en.wikipedia.org/w/api.php',
    wikidata: 'https://www.wikidata.org/w/api.php',
    openlibrary: 'https://openlibrary.org/api',
    restcountries: 'https://restcountries.com/v3.1',
    publicapis: 'https://api.publicapis.org/entries',
    numbersapi: 'http://numbersapi.com',
    dogapi: 'https://dog.ceo/api',
    catapi: 'https://api.thecatapi.com/v1',
    jokeapi: 'https://v2.jokeapi.dev/joke',
    genderize: 'https://api.genderize.io',
    agify: 'https://api.agify.io',
    nationalize: 'https://api.nationalize.io',
    ipapi: 'https://ipapi.co/json',
    sunrise: 'https://api.sunrise-sunset.org/json',
    geonames: 'http://api.geonames.org/searchJSON',
    currency: 'https://cdn.jsdelivr.net/gh/fawazahmed0/currency-api@1/latest/currencies',
    exchange: 'https://api.exchangerate-api.com/v4/latest',
    timezones: 'https://worldtimeapi.org/api/timezone',
    weather: 'https://api.open-meteo.com/v1/forecast',
    coordinates: 'https://nominatim.openstreetmap.org/search',
    reversegeo: 'https://nominatim.openstreetmap.org/reverse',
    postcodes: 'https://api.postcodes.io/postcodes',
    github: 'https://api.github.com',
    npm: 'https://registry.npmjs.org',
    urlscan: 'https://urlscan.io/api/v1/search',
    crtsh: 'https://crt.sh/?output=json',
    securityheaders: 'https://securityheaders.com/?q=',
    dns: 'https://dns.google/resolve',
    whois: 'https://api.whoisfreaks.com/v1.0/whois'
  };

  function debounce(callback, waitMs = 250) {
    let timeoutId = null;

    return (...args) => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      timeoutId = setTimeout(() => {
        timeoutId = null;
        callback(...args);
      }, waitMs);
    };
  }

  class ChatEnhancementModule {
    constructor() {
      this.name = MODULE_NAME;
      this.version = MODULE_VERSION;
      this.dependencies = [];
      this.critical = false;
      this.config = { enabled: true, autoEnhance: true, showEnhancements: true };
      this._observer = null;
      this._menusRegistered = false;
      this.api = {
        enhanceChat: (text) => this.enhanceChat(text),
        getEnhancements: () => this.getEnhancements(),
        toggleEnhancements: () => this.toggleEnhancements(),
        setConfig: (settings) => this.setConfig(settings),
        getConfig: () => this.getConfig(),
        fetchResource: (resource, params) => this.fetchResource(resource, params),
        getResources: () => PUBLIC_RESOURCES,
        httpRequest: (url, options) => this.httpRequest(url, options),
        searchWikipedia: (query) => this.searchWikipedia(query),
        getWeather: (lat, lon) => this.getWeather(lat, lon),
        searchOpenStreetMap: (query) => this.searchOpenStreetMap(query),
        getCurrencyRates: (base) => this.getCurrencyRates(base),
        getPublicApis: (category) => this.getPublicApis(category),
        getIpInfo: () => this.getIpInfo(),
        getTimezone: (area) => this.getTimezone(area),
        getDomainInfo: (domain) => this.getDomainInfo(domain)
      };
    }

    init() {
      try {
        if (window.ConfigManager && typeof window.ConfigManager.getConfig === 'function') {
          this.config = { ...this.config, ...window.ConfigManager.getConfig(MODULE_NAME) };
        }

        window.ChatEnhancementAPI = this.api;
        this.registerMenuCommands();
        this.ensureStyles();
        this.attachEnhancementUI();
        console.log(`[${MODULE_NAME}] Initialized`);
      } catch (err) {
        console.error(`[${MODULE_NAME}] Init error:`, err);
      }
    }

    onConfigUpdate(settings) {
      Object.assign(this.config, settings);

      if (this.config.enabled) {
        this.ensureStyles();
        this.attachEnhancementUI();
      } else {
        if (this._observer) {
          this._observer.disconnect();
          this._observer = null;
        }
        this.removeEnhancementElements();
      }

      console.log(`[${MODULE_NAME}] Config updated:`, this.config);
    }

    ensureStyles() {
      if (!document.head || document.getElementById('chat-enhancement-styles')) {
        return;
      }

      const style = document.createElement('style');
      style.id = 'chat-enhancement-styles';
      style.textContent = `
        .chat-enhancement-container {
          position: relative;
          margin: 10px 0;
          padding: 15px;
          background: rgba(59, 130, 246, 0.1);
          border: 1px solid rgba(59, 130, 246, 0.3);
          border-radius: 8px;
          transition: all 0.3s ease;
        }

        .chat-enhancement-container:hover {
          background: rgba(59, 130, 246, 0.15);
          border-color: rgba(59, 130, 246, 0.5);
        }

        .enhancement-badge {
          display: inline-block;
          padding: 2px 6px;
          background: #3b82f6;
          color: white;
          border-radius: 4px;
          font-size: 11px;
          font-weight: 600;
          margin-right: 8px;
        }

        .enhancement-content {
          margin-top: 8px;
          padding: 10px;
          background: rgba(255, 255, 255, 0.05);
          border-radius: 6px;
          border: 1px solid rgba(255, 255, 255, 0.1);
        }

        .enhancement-tip {
          display: inline-block;
          padding: 2px 6px;
          background: #10b981;
          color: white;
          border-radius: 4px;
          font-size: 10px;
          font-weight: 600;
          margin: 0 4px;
        }

        .enhancement-warning {
          display: inline-block;
          padding: 2px 6px;
          background: #ef4444;
          color: white;
          border-radius: 4px;
          font-size: 10px;
          font-weight: 600;
          margin: 0 4px;
        }

        .enhancement-action {
          display: inline-block;
          padding: 4px 8px;
          background: rgba(59, 130, 246, 0.2);
          color: #3b82f6;
          border: none;
          border-radius: 6px;
          font-size: 11px;
          font-weight: 600;
          cursor: pointer;
          font-family: inherit;
          transition: all 0.2s;
        }

        .enhancement-action:hover {
          background: rgba(59, 130, 246, 0.3);
          color: white;
        }
      `;

      document.head.appendChild(style);
    }

    attachEnhancementUI() {
      try {
        if (this._observer) {
          this._observer.disconnect();
        }

        const debouncedScan = debounce(() => {
          if (this.config.enabled) {
            this.scanForChatElements();
          }
        }, 250);

        this._observer = new MutationObserver((mutations) => {
          if (!this.config.enabled) {
            return;
          }

          const hasRelevantChanges = mutations.some(mutation =>
            Array.from(mutation.addedNodes || []).some(node => node.nodeType === Node.ELEMENT_NODE)
          );

          if (hasRelevantChanges) {
            debouncedScan();
          }
        });

        this._observer.observe(document.body, { childList: true, subtree: true });
        this.scanForChatElements();
      } catch (err) {
        console.error(`[${MODULE_NAME}] UI attachment error:`, err);
      }
    }

    getChatElements() {
      const seen = new Set();
      const elements = [];

      const chatSelectors = [
        '[data-testid="conversation-turn-end"]',
        'article[data-testid*="conversation-turn"]',
        '[class*="chat"][class*="message"]',
        '[class*="assistant"][class*="message"]'
      ];

      chatSelectors.forEach(selector => {
        document.querySelectorAll(selector).forEach(element => {
          if (!seen.has(element)) {
            seen.add(element);
            elements.push(element);
          }
        });
      });

      return elements;
    }

    scanForChatElements() {
      try {
        this.getChatElements().forEach(element => {
          if (!this.hasEnhancementContainer(element)) {
            this.addEnhancementContainer(element);
          }
        });
      } catch (err) {
        console.error(`[${MODULE_NAME}] Scan error:`, err);
      }
    }

    hasEnhancementContainer(element) {
      return Boolean(element.querySelector('.chat-enhancement-container'));
    }

    createEnhancementTag(text, className) {
      const tag = document.createElement('span');
      tag.className = className;
      tag.textContent = text;
      return tag;
    }

    appendEnhancementTags(container, values, className) {
      values.forEach(value => {
        container.appendChild(this.createEnhancementTag(value, className));
      });
    }

    clearElement(element) {
      while (element.firstChild) {
        element.removeChild(element.firstChild);
      }
    }

    renderEnhancementContent(contentDiv, enhancements) {
      this.clearElement(contentDiv);

      const wrapper = document.createElement('div');
      const tipsDiv = document.createElement('div');
      tipsDiv.className = 'enhancement-tips';
      this.appendEnhancementTags(tipsDiv, enhancements.tips, 'enhancement-tip');

      const warningsDiv = document.createElement('div');
      warningsDiv.className = 'enhancement-warnings';
      this.appendEnhancementTags(warningsDiv, enhancements.warnings, 'enhancement-warning');

      const summaryDiv = document.createElement('div');
      summaryDiv.className = 'enhancement-summary';
      const summaryLabel = document.createElement('strong');
      summaryLabel.textContent = 'Summary:';
      summaryDiv.appendChild(summaryLabel);
      summaryDiv.appendChild(document.createTextNode(` ${enhancements.summary}`));

      wrapper.appendChild(tipsDiv);
      wrapper.appendChild(warningsDiv);
      wrapper.appendChild(summaryDiv);
      contentDiv.appendChild(wrapper);
    }

    addEnhancementContainer(element) {
      try {
        if (this.hasEnhancementContainer(element)) {
          return;
        }

        const container = document.createElement('div');
        container.className = 'chat-enhancement-container';

        const header = document.createElement('div');
        header.className = 'enhancement-header';

        const badge = document.createElement('span');
        badge.className = 'enhancement-badge';
        badge.textContent = 'Enhanced';

        const actions = document.createElement('span');
        actions.className = 'enhancement-actions';

        const toggleButton = document.createElement('button');
        toggleButton.type = 'button';
        toggleButton.className = 'enhancement-action';
        toggleButton.textContent = 'Toggle';
        toggleButton.addEventListener('click', () => {
          this.toggleEnhancements();
        });

        const contentDiv = document.createElement('div');
        contentDiv.className = 'enhancement-content';

        const loadingMessage = document.createElement('p');
        loadingMessage.textContent = 'Loading enhancements...';
        contentDiv.appendChild(loadingMessage);

        actions.appendChild(toggleButton);
        header.appendChild(badge);
        header.appendChild(actions);
        container.appendChild(header);
        container.appendChild(contentDiv);

        element.appendChild(container);
        this.enhanceChatElement(element);
      } catch (err) {
        console.error(`[${MODULE_NAME}] Container addition error:`, err);
      }
    }

    enhanceChatElement(element) {
      try {
        const content = this.extractChatContent(element);
        const enhancements = this.analyzeChatContent(content);

        const contentDiv = element.querySelector('.enhancement-content');
        if (contentDiv) {
          this.renderEnhancementContent(contentDiv, enhancements);
        }
      } catch (err) {
        console.error(`[${MODULE_NAME}] Enhancement error:`, err);
      }
    }

    extractChatContent(element) {
      const clone = element.cloneNode(true);

      clone.querySelectorAll('button, .enhancement-badge, .enhancement-actions, script, style, svg').forEach(node => {
        node.remove();
      });

      return (clone.textContent || '')
        .replace(/\r/g, '')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
    }

    analyzeChatContent(text) {
      const content = this.sanitizeText(text);
      const tips = [];
      const warnings = [];
      const classifications = [];
      const metrics = {};
      let summary = 'No specific enhancements detected';

      // Content metrics
      metrics.length = content.length;
      metrics.lines = (content.match(/\n/g) || []).length + 1;
      metrics.wordCount = content.split(/\s+/).filter(w => w.length > 0).length;
      metrics.avgWordLength = content.length / metrics.wordCount;

      // Sentiment indicators
      const positiveTerms = /\b(good|great|excellent|perfect|best|working|fixed|success|✅|✓|👍)/gi;
      const negativeTerms = /\b(bad|poor|broken|failed|error|bug|issue|problem|wrong|❌|⚠️|👎)/gi;
      metrics.positiveCount = (content.match(positiveTerms) || []).length;
      metrics.negativeCount = (content.match(negativeTerms) || []).length;

      // Content classification
      if (/```[\s\S]*```/g.test(content) || /`{1,3}[^`]+`{1,3}/g.test(content)) {
        classifications.push('contains-code');
        tips.push('Code blocks detected');
      }
      if (/https?:\/\/[^\s]+/g.test(content)) {
        classifications.push('contains-links');
        tips.push('External links present');
        metrics.linkCount = (content.match(/https?:\/\/[^\s]+/g) || []).length;
      }
      if (/\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/.test(content)) {
        classifications.push('contains-ip');
        warnings.push('IP addresses detected');
      }
      if (/(error|exception|stacktrace|traceback)/gi.test(content)) {
        classifications.push('contains-errors');
        warnings.push('Error content detected');
      }
      if (/(password|secret|key|token|api_key)/gi.test(content)) {
        classifications.push('sensitive-data');
        warnings.push('⚠️ Possible sensitive information detected');
      }
      if (/(\d+(\.\d+)?\s*(ms|sec|min|hour|day))/gi.test(content)) {
        classifications.push('timing-data');
        tips.push('Timing metrics present');
      }

      // Quality assessment
      if (content.length > 2000) {
        tips.push('Long form detailed response');
      }
      if (content.length < 80 && metrics.wordCount < 15) {
        warnings.push('Very brief response may lack detail');
      }
      if (metrics.lines > 25) {
        tips.push('Structured multi-line content');
      }
      if (metrics.positiveCount > metrics.negativeCount) {
        tips.push('Positive sentiment detected');
      } else if (metrics.negativeCount > metrics.positiveCount) {
        warnings.push('Negative/problem context');
      }

      summary = `${classifications.length} classifications | ${tips.length} tips | ${warnings.length} warnings`;

      return {
        tips,
        warnings,
        classifications,
        metrics,
        summary,
        sentiment: metrics.positiveCount - metrics.negativeCount
      };
    }

    enhanceChat(text) {
      return this.analyzeChatContent(text);
    }

    getEnhancements() {
      return this.getChatElements().map((element, index) => {
        const content = this.extractChatContent(element);
        const analysis = this.analyzeChatContent(content);

        return {
          index,
          contentLength: content.length,
          ...analysis
        };
      });
    }

    sanitizeText(text) {
      return String(text ?? '').replace(/\u0000/g, '').trim();
    }

    toggleEnhancements() {
      const containers = document.querySelectorAll('.chat-enhancement-container');
      containers.forEach(container => {
        container.style.display = container.style.display === 'none' ? 'block' : 'none';
      });
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

      GM_registerMenuCommand('Chat Enhancement: Toggle', () => {
        this.toggleEnhancements();
      });

      GM_registerMenuCommand('Chat Enhancement: Settings', () => {
        alert(`Chat Enhancement\n\nEnabled: ${this.config.enabled}\nAuto-enhance: ${this.config.autoEnhance}\nShow enhancements: ${this.config.showEnhancements}`);
      });

      this._menusRegistered = true;
    }

    removeEnhancementElements() {
      document.querySelectorAll('.chat-enhancement-container').forEach(container => container.remove());
    }

    execute() {
      if (this.config.enabled) {
        this.scanForChatElements();
      }
      console.log(`[${MODULE_NAME}] Execute called`);
    }

    // NETWORK & RESOURCE ACCESS METHODS
    httpRequest(url, options = {}) {
      return new Promise((resolve, reject) => {
        GM_xmlhttpRequest({
          method: options.method || 'GET',
          url: url,
          headers: options.headers || {},
          data: options.data || null,
          timeout: options.timeout || 15000,
          onload: (response) => {
            try {
              resolve({
                success: true,
                status: response.status,
                data: JSON.parse(response.responseText),
                raw: response.responseText
              });
            } catch (e) {
              resolve({
                success: true,
                status: response.status,
                data: response.responseText,
                raw: response.responseText
              });
            }
          },
          onerror: (err) => reject({ success: false, error: err }),
          ontimeout: () => reject({ success: false, error: 'Request timeout' })
        });
      });
    }

    fetchResource(resource, params = {}) {
      if (!PUBLIC_RESOURCES[resource]) {
        return Promise.reject(`Unknown resource: ${resource}`);
      }
      const url = new URL(PUBLIC_RESOURCES[resource]);
      Object.keys(params).forEach(key => url.searchParams.append(key, params[key]));
      return this.httpRequest(url.toString());
    }

    searchWikipedia(query) {
      return this.fetchResource('wikipedia', {
        action: 'query',
        list: 'search',
        srsearch: query,
        format: 'json',
        origin: '*',
        srlimit: 10
      });
    }

    getWeather(lat, lon) {
      return this.fetchResource('weather', {
        latitude: lat,
        longitude: lon,
        current_weather: true,
        hourly: 'temperature_2m,relativehumidity_2m,windspeed_10m',
        timezone: 'auto'
      });
    }

    searchOpenStreetMap(query) {
      return this.fetchResource('coordinates', {
        q: query,
        format: 'json',
        limit: 5,
        addressdetails: 1
      });
    }

    getCurrencyRates(base = 'USD') {
      return this.httpRequest(`${PUBLIC_RESOURCES.exchange}/${base}`);
    }

    getPublicApis(category = null) {
      const params = category ? { category } : {};
      return this.fetchResource('publicapis', params);
    }

    getIpInfo() {
      return this.httpRequest(PUBLIC_RESOURCES.ipapi);
    }

    getTimezone(area = null) {
      const url = area ? `${PUBLIC_RESOURCES.timezones}/${area}` : PUBLIC_RESOURCES.timezones;
      return this.httpRequest(url);
    }

    getDomainInfo(domain) {
      return this.httpRequest(`${PUBLIC_RESOURCES.crtsh}&q=${domain}`);
    }

    destroy() {
      try {
        if (this._observer) {
          this._observer.disconnect();
          this._observer = null;
          console.log(`[${MODULE_NAME}] Observer disconnected`);
        }

        this.removeEnhancementElements();
        console.log(`[${MODULE_NAME}] Cleanup complete`);
      } catch (err) {
        console.error(`[${MODULE_NAME}] Cleanup error:`, err);
      }
    }
  }

  const instance = new ChatEnhancementModule();
  window.ChatEnhancementModule = instance;
  if (window.ChatGPTModules && typeof window.ChatGPTModules.register === 'function') {
    window.ChatGPTModules.register(instance);
  } else if (window.ModuleRegistry && typeof window.ModuleRegistry.register === 'function') {
    window.ModuleRegistry.register(instance);
  } else {
    window.ChatEnhancementAPI = instance.api;
    try {
      instance.init();
      instance.execute();
    } catch (err) {
      console.error(`[${MODULE_NAME}] fallback error`, err);
    }
  }
})();