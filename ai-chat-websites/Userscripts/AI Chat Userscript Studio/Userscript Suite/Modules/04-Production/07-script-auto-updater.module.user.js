// ==UserScript==
// @name         Script Auto Updater
// @namespace    http://tampermonkey.net/
// @version      2026.08.30.0
// @description  Detects install directives in AI responses and checks tracked scripts for newer versions
// @author       AI RMD
// @license      MIT
// @match        https://chat.openai.com/*
// @match        https://chatgpt.com/*
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_xmlhttpRequest
// ==/UserScript==

(function () {
  'use strict';

  const MODULE_NAME = 'ScriptAutoUpdater';
  const MODULE_VERSION = '2026.08.30.0';
  const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6 hours
  const LAST_CHECK_KEY = 'ScriptAutoUpdater.lastCheck';
  const RAW_BASE = 'https://raw.githubusercontent.com/eric847b/ai-chat-websites/main/';

  class AIScriptAutoUpdater {
    constructor() {
      this.name = MODULE_NAME;
      this.version = MODULE_VERSION;
      this.dependencies = [];
      this.critical = false;
      this.helpers = {};
      this._tracked = [];
      this._timer = null;
    }

    init() {
      this._scheduleChecks();
      return true;
    }

    execute() {
      return this._runChecks();
    }

    onConfigUpdate(settings) {
      if (settings && typeof settings.checkIntervalMs === 'number' && settings.checkIntervalMs > 0) {
        this._intervalMs = settings.checkIntervalMs;
        this._scheduleChecks();
      }
    }

    destroy() {
      if (this._timer) {
        clearInterval(this._timer);
        this._timer = null;
      }
      this._tracked = [];
    }

    checkHealth() {
      return {
        healthy: true,
        timestamp: Date.now(),
        version: MODULE_VERSION,
        trackedScripts: this._tracked.length
      };
    }

    track(scriptPath, localVersion) {
      if (!scriptPath || typeof scriptPath !== 'string') {
        return false;
      }
      const name = scriptPath.split('/').pop() || scriptPath;
      if (!this._tracked.some((t) => t.path === scriptPath)) {
        this._tracked.push({ name, path: scriptPath, localVersion: localVersion || '0.0.0' });
      }
      return true;
    }

    handleAIResponse(response) {
      if (!response || typeof response !== 'string') {
        return null;
      }
      const trimmed = response.trim();
      if (!trimmed) {
        return null;
      }

      const match = trimmed.match(/\/\*\s*install:(.*?)\s*\*\//);
      if (!match) {
        return null;
      }

      const installPath = match[1].trim();
      if (!installPath) {
        return null;
      }

      return {
        action: 'install',
        installPath,
        hasRequiredHelpers: !!this.helpers.checkRateLimit && !!this.helpers.installCode && !!this.helpers.wrapWithErrorBoundary
      };
    }

    compareVersions(a, b) {
      const pa = String(a).split('.').map((n) => parseInt(n, 10) || 0);
      const pb = String(b).split('.').map((n) => parseInt(n, 10) || 0);
      const len = Math.max(pa.length, pb.length);
      for (let i = 0; i < len; i++) {
        const diff = (pa[i] || 0) - (pb[i] || 0);
        if (diff !== 0) {
          return diff;
        }
      }
      return 0;
    }

    checkForUpdate(entry) {
      const url = RAW_BASE + entry.path.replace(/^\/+/, '');
      return new Promise((resolve) => {
        const done = (remoteVersion) => {
          if (!remoteVersion) {
            resolve({ entry, status: 'unavailable' });
            return;
          }
          const cmp = this.compareVersions(remoteVersion, entry.localVersion);
          resolve({ entry, status: cmp > 0 ? 'update-available' : 'current', remoteVersion });
        };

        if (typeof GM_xmlhttpRequest === 'function') {
          GM_xmlhttpRequest({
            method: 'GET',
            url,
            timeout: 15000,
            onload: (res) => done(this._parseVersionHeader(res.responseText)),
            onerror: () => done(null),
            ontimeout: () => done(null)
          });
        } else if (typeof fetch === 'function') {
          fetch(url)
            .then((r) => (r.ok ? r.text() : null))
            .then((text) => done(this._parseVersionHeader(text)))
            .catch(() => done(null));
        } else {
          done(null);
        }
      });
    }

    _parseVersionHeader(text) {
      if (!text || typeof text !== 'string') {
        return null;
      }
      const m = text.match(/@version\s+(\S+)/);
      return m ? m[1] : null;
    }

    _scheduleChecks() {
      if (this._timer) {
        clearInterval(this._timer);
      }
      const interval = this._intervalMs || CHECK_INTERVAL_MS;
      this._timer = setInterval(() => this._runChecks().catch(() => {}), interval);
    }

    async _runChecks() {
      const now = Date.now();
      if (typeof GM_getValue === 'function' && typeof GM_setValue === 'function') {
        const last = GM_getValue(LAST_CHECK_KEY, 0);
        if (now - last < (this._intervalMs || CHECK_INTERVAL_MS)) {
          return { skipped: true };
        }
        GM_setValue(LAST_CHECK_KEY, now);
      }
      const results = await Promise.all(this._tracked.map((entry) => this.checkForUpdate(entry)));
      results
        .filter((r) => r.status === 'update-available')
        .forEach((r) => console.warn('[ScriptAutoUpdater] update available:', r.entry.name, r.entry.localVersion, '->', r.remoteVersion));
      return { checked: results.length, updates: results.filter((r) => r.status === 'update-available').length };
    }
  }

  const instance = new AIScriptAutoUpdater();

  if (typeof window !== 'undefined') {
    if (window.ModuleRegistry && typeof window.ModuleRegistry.register === 'function') {
      window.ModuleRegistry.register(instance);
    } else if (window.ChatGPTModules && typeof window.ChatGPTModules.register === 'function') {
      window.ChatGPTModules.register(instance);
    }
    window.AIScriptAutoUpdater = instance;
  }

  console.log('Script Auto Updater module loaded');
})();
