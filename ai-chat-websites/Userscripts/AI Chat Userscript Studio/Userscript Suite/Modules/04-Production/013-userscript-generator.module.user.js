// ==UserScript==
// @name         UserScript Generator
// @version      2026.03.28.12
// @description  Generate userscripts from ChatGPT prompts
// @match        https://chat.openai.com/*
// @match        https://chatgpt.com/*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_registerMenuCommand
// ==/UserScript==
(function() {
  'use strict';

  const RESPONSE_SELECTORS = [
    '[data-testid="conversation-turn-end"]',
    'article[data-testid*="conversation-turn"]'
  ];
  const BUTTON_SELECTOR = '.generator-btn';
  const DIRECT_BUTTON_SELECTOR = '.generator-btn[data-generator-role="direct"]';
  const AI_BUTTON_SELECTOR = '.generator-btn[data-generator-role="ai"]';
  const STYLE_ID = 'userscript-generator-styles';
  const HISTORY_STORAGE_KEY = 'userscript_generator_history';
  const COMPATIBLE_HISTORY_KEYS = ['ai_script_generator_history'];
  const MAX_HISTORY_ITEMS = 25;
  const MODULE_VERSION = '2026.03.28.12';

  function debounce(fn, delay) {
    let timeoutId;
    return function(...args) {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => fn.apply(this, args), delay);
    };
  }

  function mergeApiSurface(existingApi, additions, preferExisting = false) {
    const merged = existingApi && typeof existingApi === 'object'
      ? { ...existingApi }
      : {};

    Object.entries(additions).forEach(([key, value]) => {
      if (!preferExisting || typeof merged[key] === 'undefined') {
        merged[key] = value;
      }
    });

    return merged;
  }

  class UserScriptGenerator {
    constructor() {
      this.name = 'UserScriptGenerator';
      this.version = MODULE_VERSION;
      this.dependencies = [];
      this.critical = false;
      this.config = { enabled: true, autoGenerate: false };
      this._observer = null;
      this._menusRegistered = false;
      this._lastGeneratedRecordId = '';
      this.api = {
        generate: (text, options = {}) => this.generateScriptArtifact(text, options),
        generateFromText: (text, options = {}) => this.generateScriptArtifact(text, options),
        generateFromPrompt: (prompt, options = {}) => this.generateScriptArtifact(prompt, options),
        generateScriptArtifact: (text, options = {}) => this.generateScriptArtifact(text, options),
        openWithPrompt: (prompt, options = {}) => this.generateScriptArtifact(prompt, options),
        preview: (contentOrOptions = '') => this.previewScript(contentOrOptions),
        previewCurrent: () => this.previewCurrentGenerated(),
        validateScript: (script) => this.validateScript(script),
        optimizeScript: (script) => this.optimizeScript(script),
        getGeneratedHistory: () => this.loadGeneratedScripts(),
        getHistory: () => this.loadGeneratedScripts(),
        clearGeneratedHistory: () => this.clearGeneratedScripts(),
        clearHistory: () => this.clearGeneratedScripts(),
        showGeneratedHistory: () => this.showGeneratedHistory(),
        showHistory: () => this.showGeneratedHistory(),
        downloadLatestGenerated: () => this.downloadLatestGenerated(),
        downloadLatest: () => this.downloadLatestGenerated(),
        downloadGeneratedById: (id) => this.downloadGeneratedById(id),
        downloadById: (id) => this.downloadGeneratedById(id),
        downloadScript: (content, filename = '') => this.downloadScript(content, filename),
        save: (content, filename = '') => this.downloadScript(content, filename),
        saveCurrent: () => this.saveCurrentGenerated()
      };
    }

    init() {
      try {
        if (window.ConfigManager && typeof window.ConfigManager.getConfig === 'function') {
          this.config = { ...this.config, ...window.ConfigManager.getConfig('userscriptgenerator') };
        }

        window.UserScriptGeneratorAPI = mergeApiSurface(window.UserScriptGeneratorAPI, this.api, true);
        this.publishCompatibilityApis();
        this.registerMenuCommands();
        this.ensureStyles();
        this.attachGeneratorUI();
        console.log('[UserScriptGenerator] Initialized');
      } catch (err) {
        console.error('[UserScriptGenerator] Init error:', err);
      }
    }

    onConfigUpdate(settings) {
      Object.assign(this.config, settings);

      if (this.config.enabled) {
        this.ensureStyles();
        this.scanForResponses();
      } else {
        this.removeGeneratorButtons();
      }

      console.log('[UserScriptGenerator] Config updated:', this.config);
    }

    publishCompatibilityApis() {
      const compatibilityApi = {
        generate: (text, options = {}) => this.generateScriptArtifact(text, options),
        generateFromText: (text, options = {}) => this.generateScriptArtifact(text, options),
        generateFromPrompt: (prompt, templateName = '') => this.generateScriptArtifact(prompt, { templateName }),
        generateScriptArtifact: (text, options = {}) => this.generateScriptArtifact(text, options),
        openWithPrompt: (prompt, options = {}) => this.generateScriptArtifact(prompt, options),
        preview: (contentOrOptions = '') => this.previewScript(contentOrOptions),
        previewCurrent: () => this.previewCurrentGenerated(),
        validateScript: (script) => this.validateScript(script),
        optimizeScript: (script) => this.optimizeScript(script),
        getHistory: () => this.loadGeneratedScripts(),
        getGeneratedHistory: () => this.loadGeneratedScripts(),
        clearHistory: () => this.clearGeneratedScripts(),
        clearGeneratedHistory: () => this.clearGeneratedScripts(),
        showHistory: () => this.showGeneratedHistory(),
        showGeneratedHistory: () => this.showGeneratedHistory(),
        downloadLatest: () => this.downloadLatestGenerated(),
        downloadLatestGenerated: () => this.downloadLatestGenerated(),
        downloadById: (id) => this.downloadGeneratedById(id),
        downloadGeneratedById: (id) => this.downloadGeneratedById(id),
        downloadScript: (content, filename = '') => this.downloadScript(content, filename),
        save: (content, filename = '') => this.downloadScript(content, filename),
        saveCurrent: () => this.saveCurrentGenerated()
      };
      window.AI_Generator = mergeApiSurface(window.AI_Generator, compatibilityApi, true);
    }

    ensureStyles() {
      if (!document.head || document.getElementById(STYLE_ID)) {
        return;
      }

      const style = document.createElement('style');
      style.id = STYLE_ID;
      style.textContent = `
        .generator-btn {
          margin-left: 8px;
          padding: 6px 10px;
          border: 1px solid rgba(15, 23, 42, 0.12);
          border-radius: 999px;
          background: linear-gradient(135deg, #f8fafc, #e2e8f0);
          color: #0f172a;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          transition: transform 120ms ease, box-shadow 120ms ease;
        }

        .generator-btn:hover {
          transform: translateY(-1px);
          box-shadow: 0 6px 16px rgba(15, 23, 42, 0.12);
        }

        .generator-btn.generator-btn-ai {
          background: linear-gradient(135deg, #dbeafe, #bfdbfe);
          color: #1d4ed8;
        }
      `;

      document.head.appendChild(style);
    }

    attachGeneratorUI() {
      try {
        if (this._observer) {
          this._observer.disconnect();
        }

        const debouncedScan = debounce(() => {
          if (this.config.enabled) {
            this.scanForResponses();
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
        this.scanForResponses();
      } catch (err) {
        console.error('[UserScriptGenerator] UI attachment error:', err);
      }
    }

    getResponseElements() {
      const seen = new Set();
      const responses = [];

      RESPONSE_SELECTORS.forEach(selector => {
        document.querySelectorAll(selector).forEach(element => {
          if (!seen.has(element)) {
            seen.add(element);
            responses.push(element);
          }
        });
      });

      return responses;
    }

    scanForResponses() {
      try {
        this.getResponseElements().forEach(response => {
          this.syncGeneratorButtons(response);
        });
      } catch (err) {
        console.error('[UserScriptGenerator] Scan error:', err);
      }
    }

    hasGeneratorButton(responseElement, role = '') {
      if (role === 'direct') {
        return Boolean(responseElement.querySelector(DIRECT_BUTTON_SELECTOR));
      }

      if (role === 'ai') {
        return Boolean(responseElement.querySelector(AI_BUTTON_SELECTOR));
      }

      return Boolean(responseElement.querySelector(BUTTON_SELECTOR));
    }

    canUseAiPromptGenerator() {
      const generatorApi = window.AI_Generator;
      return Boolean(
        generatorApi
        && typeof generatorApi.openWithPrompt === 'function'
        && (typeof generatorApi.setPrompt === 'function' || typeof generatorApi.showUI === 'function')
      );
    }

    findActionContainer(responseElement) {
      return responseElement.querySelector('[role="toolbar"]')
        || responseElement.querySelector('[data-testid="conversation-turn-actions"]')
        || responseElement;
    }

    createGeneratorButton({ text, role, title, onClick, extraClass = '' }) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = text;
      btn.dataset.generatorAttached = 'true';
      btn.dataset.generatorRole = role;
      btn.className = `generator-btn ${extraClass}`.trim();
      btn.title = title;
      btn.addEventListener('click', onClick);
      return btn;
    }

    syncGeneratorButtons(responseElement) {
      try {
        const actionContainer = this.findActionContainer(responseElement);
        if (!actionContainer) {
          return;
        }

        if (!this.hasGeneratorButton(responseElement, 'direct')) {
          const directButton = this.createGeneratorButton({
            text: 'Generate Script',
            role: 'direct',
            title: 'Generate a userscript directly from this response.',
            onClick: (event) => {
              event.preventDefault();
              event.stopPropagation();

              if (event.shiftKey && this.openPromptFromResponse(responseElement)) {
                return;
              }

              this.generateFromResponse(responseElement);
            }
          });
          directButton.setAttribute('aria-label', 'Generate userscript from this response');
          actionContainer.appendChild(directButton);
        }

        if (this.canUseAiPromptGenerator() && !this.hasGeneratorButton(responseElement, 'ai')) {
          const aiButton = this.createGeneratorButton({
            text: 'AI Assist',
            role: 'ai',
            extraClass: 'generator-btn-ai',
            title: 'Open the merged AI generator with this response as the starting prompt.',
            onClick: (event) => {
              event.preventDefault();
              event.stopPropagation();
              this.openPromptFromResponse(responseElement);
            }
          });
          aiButton.setAttribute('aria-label', 'Open AI-assisted userscript generation for this response');
          actionContainer.appendChild(aiButton);
        }
      } catch (err) {
        console.error('[UserScriptGenerator] Button addition error:', err);
      }
    }

    getResponseText(element) {
      const clone = element.cloneNode(true);

      clone.querySelectorAll(`${BUTTON_SELECTOR}, [role="toolbar"], button, script, style, svg`).forEach(node => {
        node.remove();
      });

      return (clone.textContent || '')
        .replace(/\r/g, '')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
    }

    openPromptFromResponse(element) {
      const text = this.getResponseText(element);
      if (!text) {
        console.warn('[UserScriptGenerator] No response content found for AI prompt');
        return false;
      }

      if (!this.canUseAiPromptGenerator()) {
        return false;
      }

      const generatorApi = window.AI_Generator;
      if (!generatorApi || typeof generatorApi.openWithPrompt !== 'function') {
        return false;
      }

      try {
        const result = generatorApi.openWithPrompt(text, {
          focus: true,
          clearResults: true
        });

        if (result && typeof result.then === 'function') {
          void result.catch((err) => {
            console.error('[UserScriptGenerator] AI prompt handoff failed:', err);
          });
        }

        return true;
      } catch (err) {
        console.error('[UserScriptGenerator] AI prompt handoff failed:', err);
        return false;
      }
    }

    sanitizeText(text) {
      return String(text ?? '').replace(/\u0000/g, '').trim();
    }

    escapeHtml(text) {
      return String(text ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    }

    extractCodeBlock(text) {
      const rawText = this.sanitizeText(text);
      const codeBlockMatch = rawText.match(/```(?:javascript|js)?\s*([\s\S]*?)```/i);
      return this.sanitizeText(codeBlockMatch ? codeBlockMatch[1] : rawText);
    }

    deriveDescription(sourceText) {
      const withoutCodeBlocks = this.sanitizeText(sourceText).replace(/```[\s\S]*?```/g, ' ');
      return withoutCodeBlocks.replace(/\s+/g, ' ').trim() || 'Auto-generated from ChatGPT';
    }

    generateHistoryId() {
      if (window.crypto && typeof window.crypto.randomUUID === 'function') {
        return window.crypto.randomUUID();
      }

      return `generated_${Math.random().toString(36).slice(2, 11)}`;
    }

    buildTemplate(code, sourceText = '') {
      try {
        const description = this.deriveDescription(sourceText).slice(0, 140);
        const name = (description.split(' ').slice(0, 6).join(' ') || 'Generated Script').slice(0, 80);
        const timestamp = new Date().toISOString().slice(0, 10);
        const body = this.sanitizeText(code) || "console.log('Generated script is ready for customization.');";
        const indentedCode = body
          .split('\n')
          .map(line => (line ? `  ${line}` : ''))
          .join('\n');

        return [
          '// ==UserScript==',
          `// @name         ${name}`,
          '// @namespace    http://tampermonkey.net/',
          `// @version      ${MODULE_VERSION}`,
          `// @description  ${description}`,
          '// @author       ChatGPT',
          '// @match        https://example.com/*',
          '// @grant        GM_getValue',
          '// @grant        GM_setValue',
          `// @created      ${timestamp}`,
          '// ==/UserScript==',
          '',
          '(function() {',
          "  'use strict';",
          '',
          indentedCode,
          '})();'
        ].join('\n');
      } catch (err) {
        console.error('[UserScriptGenerator] Template build error:', err);
        return `// ==UserScript==\n// @name         Generated Script\n// @version      ${MODULE_VERSION}\n// @description  Error generating script\n// ==/UserScript==\n\n(function() { 'use strict'; })();`;
      }
    }

    ensureUserscriptFormat(text) {
      const extractedCode = this.extractCodeBlock(text);
      if (extractedCode.includes('// ==UserScript==')) {
        return extractedCode;
      }

      return this.buildTemplate(extractedCode, text);
    }

    validateScript(script) {
      const issues = [];
      const warnings = [];
      const normalizedScript = this.sanitizeText(script);

      if (!normalizedScript.includes('// ==UserScript==')) {
        issues.push('Missing userscript metadata block');
      }

      if (!/@match\s+|@include\s+/m.test(normalizedScript)) {
        warnings.push('No @match or @include rule detected');
      }

      if (!/\(function\s*\(\)\s*\{/.test(normalizedScript)) {
        warnings.push('Script is missing the standard IIFE wrapper');
      }

      if (/\beval\s*\(/.test(normalizedScript)) {
        warnings.push('Use of eval() detected; consider safer alternatives');
      }

      if (/\bdocument\.write\s*\(/.test(normalizedScript)) {
        warnings.push('document.write() usage may cause issues on modern pages');
      }

      if (/\.innerHTML\s*=/.test(normalizedScript)) {
        warnings.push('Direct innerHTML assignment detected; sanitize dynamic content carefully');
      }

      try {
        new Function(normalizedScript);
      } catch (err) {
        issues.push(`Syntax error: ${err.message}`);
      }

      return {
        isValid: issues.length === 0,
        issues,
        warnings,
        score: Math.max(0, 100 - (issues.length * 20) - (warnings.length * 5) - (normalizedScript.length > 5000 ? 10 : 0))
      };
    }

    optimizeScript(script) {
      return script
        .split('\n')
        .map(line => line.replace(/[ \t]+$/g, ''))
        .join('\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
    }

    deriveScriptName(script) {
      const nameMatch = this.sanitizeText(script).match(/@name\s+(.+)/);
      return this.sanitizeText(nameMatch?.[1] || '').trim();
    }

    generateFilename(script, fallbackBaseName = `generated-${Date.now()}`) {
      const baseName = this.deriveScriptName(script)
        .replace(/[^\w.-]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .toLowerCase();
      return `${baseName || fallbackBaseName}.user.js`;
    }

    normalizeStoredFilename(value, fallbackBaseName = `generated-${Date.now()}`) {
      const baseName = this.sanitizeText(value)
        .replace(/\.user\.js$/i, '')
        .replace(/[^\w.-]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .toLowerCase();
      return `${baseName || fallbackBaseName}.user.js`;
    }

    normalizeGeneratedScriptRecord(record, index) {
      if (!record || typeof record !== 'object') {
        return null;
      }

      const content = this.sanitizeText(record.content || record.script || '');
      const timestamp = Number(record.timestamp) || Date.now();
      const fallbackBaseName = `generated-${timestamp}`;
      const filename = this.sanitizeText(record.filename)
        ? this.normalizeStoredFilename(record.filename, fallbackBaseName)
        : (content ? this.generateFilename(content, fallbackBaseName) : this.normalizeStoredFilename(record.name, fallbackBaseName));
      const name = this.sanitizeText(record.name) || this.deriveScriptName(content) || filename.replace(/\.user\.js$/i, '') || 'Generated Script';
      const sourcePreview = this.sanitizeText(record.sourcePreview)
        || this.deriveDescription(record.sourceText || record.prompt || name).slice(0, 160);
      const validation = record.validation && typeof record.validation === 'object'
        ? {
            isValid: Boolean(record.validation.isValid),
            issues: Array.isArray(record.validation.issues) ? record.validation.issues.filter(Boolean).map((item) => this.sanitizeText(item)) : [],
            warnings: Array.isArray(record.validation.warnings) ? record.validation.warnings.filter(Boolean).map((item) => this.sanitizeText(item)) : [],
            score: Number(record.validation.score) || 0
          }
        : null;

      return {
        ...record,
        id: this.sanitizeText(record.id) || `generated_${timestamp}_${index + 1}`,
        timestamp,
        filename,
        name,
        sourcePreview,
        validation,
        content
      };
    }

    loadStoredHistoryRecords(storageKey) {
      const stored = GM_getValue(storageKey, '[]');

      try {
        const parsed = JSON.parse(stored);
        return Array.isArray(parsed)
          ? parsed.filter((item) => item && typeof item === 'object')
          : [];
      } catch (err) {
        console.warn('[UserScriptGenerator] History parse error:', err);
        return [];
      }
    }

    getHistoryRecordSignature(record) {
      return [
        Number(record?.timestamp) || 0,
        this.sanitizeText(record?.filename),
        this.sanitizeText(record?.content || record?.script || '')
      ].join('::');
    }

    mergeGeneratedHistory(records) {
      const seen = new Set();

      return records
        .slice()
        .sort((left, right) => (Number(right?.timestamp) || 0) - (Number(left?.timestamp) || 0))
        .filter((record) => {
          const signature = this.getHistoryRecordSignature(record);
          if (seen.has(signature)) {
            return false;
          }

          seen.add(signature);
          return true;
        })
        .slice(0, MAX_HISTORY_ITEMS);
    }

    getLinkedHistoryStorageKeys() {
      return [...new Set([HISTORY_STORAGE_KEY, ...COMPATIBLE_HISTORY_KEYS])];
    }

    persistGeneratedScripts(records) {
      const normalizedRecords = this.mergeGeneratedHistory(records
        .map((item, index) => this.normalizeGeneratedScriptRecord(item, index))
        .filter(Boolean));
      const serialized = JSON.stringify(normalizedRecords);

      this.getLinkedHistoryStorageKeys().forEach((storageKey) => {
        GM_setValue(storageKey, serialized);
      });

      return normalizedRecords;
    }

    loadGeneratedScripts() {
      const primaryRawHistory = this.loadStoredHistoryRecords(HISTORY_STORAGE_KEY);
      const mergedRawHistory = primaryRawHistory.slice();

      COMPATIBLE_HISTORY_KEYS.forEach((storageKey) => {
        mergedRawHistory.push(...this.loadStoredHistoryRecords(storageKey));
      });

      const normalizedHistory = this.mergeGeneratedHistory(mergedRawHistory
          .map((item, index) => this.normalizeGeneratedScriptRecord(item, index))
          .filter(Boolean));

      if (JSON.stringify(primaryRawHistory) !== JSON.stringify(normalizedHistory)) {
        this.persistGeneratedScripts(normalizedHistory);
      }

      return normalizedHistory;
    }

    saveGeneratedScript(script, validation, sourceText) {
      const history = this.loadGeneratedScripts();
      const filename = this.generateFilename(script);
      const name = this.deriveScriptName(script) || filename.replace(/\.user\.js$/, '');
      const record = {
        id: this.generateHistoryId(),
        timestamp: Date.now(),
        filename,
        name,
        sourcePreview: this.deriveDescription(sourceText).slice(0, 160),
        validation,
        content: script
      };

      history.unshift(record);
      this.persistGeneratedScripts(history.slice(0, MAX_HISTORY_ITEMS));
      this._lastGeneratedRecordId = record.id;
      return record;
    }

    clearGeneratedScripts() {
      this._lastGeneratedRecordId = '';
      return this.persistGeneratedScripts([]);
    }

    showGeneratedHistory() {
      const history = this.loadGeneratedScripts();
      if (!history.length) {
        alert('No generated scripts found.');
        return history;
      }

      const message = history
        .map((entry, index) => {
          const created = new Date(entry.timestamp).toLocaleString();
          const status = entry.validation?.isValid ? 'Valid' : 'Needs review';
          return `${index + 1}. ${entry.name}\n${created}\n${status}\nID: ${entry.id}\n${entry.sourcePreview}`;
        })
        .join('\n\n');

      alert(`Generated Scripts\n\n${message}`);
      return history;
    }

    downloadGeneratedById(id) {
      const entry = this.loadGeneratedScripts().find((item) => item && item.id === id);
      if (!entry) {
        console.warn('[UserScriptGenerator] No generated script found for id:', id);
        return false;
      }

      if (!entry.content) {
        console.warn('[UserScriptGenerator] Generated script entry is missing content for id:', id);
        return false;
      }

      this.downloadScript(entry.content, entry.filename);
      return true;
    }

    downloadLatestGenerated() {
      const history = this.loadGeneratedScripts();
      const latest = history[0];
      if (!latest || !latest.content) {
        alert('No generated script content is available to download.');
        return false;
      }

      this.downloadScript(latest.content, latest.filename);
      return true;
    }

    getCurrentGeneratedRecord() {
      const history = this.loadGeneratedScripts();
      if (!history.length) {
        return null;
      }

      if (this._lastGeneratedRecordId) {
        const current = history.find((item) => item && item.id === this._lastGeneratedRecordId);
        if (current) {
          return current;
        }
      }

      return history[0] || null;
    }

    saveCurrentGenerated() {
      const record = this.getCurrentGeneratedRecord();
      if (!record || !record.content) {
        alert('No generated script content is available to save.');
        return false;
      }

      this.downloadScript(record.content, record.filename);
      return true;
    }

    openPreviewWindow(content) {
      const previewContent = this.sanitizeText(content);
      if (!previewContent) {
        alert('No generated script content is available to preview.');
        return false;
      }

      const preview = window.open('', '_blank', 'width=800,height=600');
      if (!preview) {
        alert('Unable to open preview window.');
        return false;
      }

      preview.document.write(`
        <html>
        <head>
          <title>Script Preview</title>
          <style>
            body { font-family: Consolas, "Courier New", monospace; padding: 20px; background: #1e293b; color: white; }
            .header { margin-bottom: 20px; border-bottom: 1px solid #475569; padding-bottom: 10px; }
            pre { white-space: pre-wrap; word-break: break-word; }
          </style>
        </head>
        <body>
          <div class="header">
            <h2>Userscript Preview</h2>
            <p>This is a preview of the generated script. It will not execute.</p>
          </div>
          <pre>${this.escapeHtml(previewContent)}</pre>
        </body>
        </html>
      `);
      preview.document.close();
      return true;
    }

    previewCurrentGenerated() {
      const record = this.getCurrentGeneratedRecord();
      if (!record || !record.content) {
        alert('No generated script content is available to preview.');
        return false;
      }

      return this.openPreviewWindow(record.content);
    }

    previewScript(contentOrOptions = '') {
      if (typeof contentOrOptions === 'string') {
        const content = this.sanitizeText(contentOrOptions);
        if (content) {
          return this.openPreviewWindow(content);
        }
      }

      if (contentOrOptions && typeof contentOrOptions === 'object') {
        const content = this.sanitizeText(contentOrOptions.content || contentOrOptions.script || '');
        if (content) {
          return this.openPreviewWindow(content);
        }
      }

      return this.previewCurrentGenerated();
    }

    registerMenuCommands() {
      if (this._menusRegistered || typeof GM_registerMenuCommand !== 'function') {
        return;
      }

      GM_registerMenuCommand('UserScript Generator: View History', () => {
        this.showGeneratedHistory();
      });

      GM_registerMenuCommand('UserScript Generator: Download Latest', () => {
        this.downloadLatestGenerated();
      });

      GM_registerMenuCommand('UserScript Generator: Clear History', () => {
        const shouldClear = typeof window.confirm === 'function'
          ? window.confirm('Clear generated script history?')
          : true;

        if (!shouldClear) {
          return;
        }

        this.clearGeneratedScripts();
        alert('Generated script history cleared.');
      });

      this._menusRegistered = true;
    }

    generateScriptArtifact(text, options = {}) {
      const sourceText = this.sanitizeText(text);
      if (!sourceText) {
        return {
          ok: false,
          error: 'No source content provided'
        };
      }

      const script = this.ensureUserscriptFormat(sourceText);
      const validation = this.validateScript(script);
      const content = validation.isValid ? this.optimizeScript(script) : script;
      const record = this.saveGeneratedScript(content, validation, sourceText);

      if (options.download !== false) {
        this.downloadScript(content, record.filename);
      }

      return {
        ok: validation.isValid,
        content,
        validation,
        record
      };
    }

    generateFromResponse(element) {
      try {
        const text = this.getResponseText(element);
        if (!text) {
          console.warn('[UserScriptGenerator] No response content found');
          return;
        }

        const result = this.generateScriptArtifact(text);

        if (!result.ok || result.validation.warnings.length > 0) {
          console.warn('[UserScriptGenerator] Generated script validation summary:', result.validation);
        }

        console.log('[UserScriptGenerator] Script generated successfully');
      } catch (err) {
        console.error('[UserScriptGenerator] Generation error:', err);
      }
    }

    downloadScript(content, filename = '') {
      try {
        const blob = new Blob([content], { type: 'text/javascript' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');

        link.href = url;
        link.download = filename || this.generateFilename(content);
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();

        setTimeout(() => {
          if (link.parentNode) {
            link.parentNode.removeChild(link);
          }
          URL.revokeObjectURL(url);
        }, 100);
      } catch (err) {
        console.error('[UserScriptGenerator] Download error:', err);
      }
    }

    removeGeneratorButtons() {
      document.querySelectorAll(BUTTON_SELECTOR).forEach(button => button.remove());
    }

    execute() {
      if (this.config.enabled) {
        this.scanForResponses();
      }
      console.log('[UserScriptGenerator] Execute called');
    }

    destroy() {
      try {
        if (this._observer) {
          this._observer.disconnect();
          this._observer = null;
          console.log('[UserScriptGenerator] Observer disconnected');
        }

        this.removeGeneratorButtons();
        console.log('[UserScriptGenerator] Cleanup complete');
      } catch (err) {
        console.error('[UserScriptGenerator] Cleanup error:', err);
      }
    }
  }

  const instance = new UserScriptGenerator();
  if (window.ChatGPTModules && typeof window.ChatGPTModules.register === 'function') {
    window.ChatGPTModules.register(instance);
  } else if (window.ModuleRegistry && typeof window.ModuleRegistry.register === 'function') {
    window.ModuleRegistry.register(instance);
  } else {
    window.UserScriptGenerator = instance;
    try {
      instance.init();
      instance.execute();
    } catch (err) {
      console.error('[UserScriptGenerator] fallback error', err);
    }
  }
})();
