// ==UserScript==
// @name         Code Assistant
// @namespace    http://tampermonkey.net/
// @version      2026.03.28.2
// @description  Intelligent code assistance and development tools
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

  const MODULE_VERSION = '2026.03.28.2';
  const STORAGE_KEY = 'ai_code_assistant_settings';
  const MAX_SUGGESTIONS = 50;
  const MAX_HISTORY_ITEMS = 100;
  const MODULE_NAME = 'AI Code Assistant';

  class AICodeAssistantModule {
    constructor() {
      this.name = MODULE_NAME;
      this.version = MODULE_VERSION;
      this.dependencies = [];
      this.critical = false;
      this.config = {
        enabled: true,
        autoSuggest: true,
        showCodeUI: true,
        darkMode: true,
        autoComplete: true,
        linting: true,
        formatting: true
      };
      this._observer = null;
      this._menusRegistered = false;
      this._suggestions = [];
      this._codeHistory = [];
      this._currentFile = null;
      this.api = {
        getSuggestions: (code, language) => this.getSuggestions(code, language),
        applySuggestion: (id) => this.applySuggestion(id),
        deleteSuggestion: (id) => this.deleteSuggestion(id),
        formatCode: (code, language) => this.formatCode(code, language),
        lintCode: (code, language) => this.lintCode(code, language),
        getHistory: () => this.getHistory(),
        setConfig: (settings) => this.setConfig(settings),
        getConfig: () => this.getConfig(),
        toggleCodeUI: () => this.toggleCodeUI()
      };
    }

    init() {
      try {
        if (window.ConfigManager && typeof window.ConfigManager.getConfig === 'function') {
          this.config = { ...this.config, ...window.ConfigManager.getConfig(MODULE_NAME) };
        }

        window.AICodeAssistantAPI = this.api;
        this.registerMenuCommands();
        this.ensureStyles();
        this.attachCodeUI();
        this.startCodeMonitoring();
        console.log(`[${MODULE_NAME}] Initialized`);
      } catch (err) {
        console.error(`[${MODULE_NAME}] Init error:`, err);
      }
    }

    onConfigUpdate(settings) {
      Object.assign(this.config, settings);

      if (this.config.enabled) {
        this.ensureStyles();
        this.attachCodeUI();
      } else {
        this.removeCodeUI();
      }

      console.log(`[${MODULE_NAME}] Config updated:`, this.config);
    }

    ensureStyles() {
      if (!document.head || document.getElementById('ai-code-assistant-styles')) {
        return;
      }

      const style = document.createElement('style');
      style.id = 'ai-code-assistant-styles';
      style.textContent = `
        .code-assistant-container {
          position: fixed;
          top: 1200px;
          right: 20px;
          width: 500px;
          background: rgba(15, 23, 42, 0.95);
          border: 1px solid rgba(59, 130, 246, 0.3);
          border-radius: 12px;
          padding: 20px;
          color: white;
          font-family: system-ui, -apple-system, sans-serif;
          box-shadow: 0 10px 25px rgba(0,0,0,0.3);
          z-index: 99998;
          backdrop-filter: blur(10px);
          display: none;
        }

        .code-assistant-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
          border-bottom: 1px solid rgba(59, 130, 246, 0.3);
          padding-bottom: 10px;
        }

        .code-assistant-title {
          font-size: 16px;
          font-weight: 600;
          color: white;
        }

        .code-assistant-toggle {
          background: none;
          border: none;
          color: #94a3b8;
          cursor: pointer;
          font-size: 18px;
          padding: 0;
          width: 24px;
          height: 24px;
        }

        .code-search {
          margin-bottom: 15px;
        }

        .search-input {
          width: 100%;
          padding: 8px 12px;
          border: 1px solid rgba(59, 130, 246, 0.3);
          border-radius: 6px;
          background: rgba(255, 255, 255, 0.05);
          color: white;
          font-size: 13px;
          transition: all 0.2s;
        }

        .search-input:focus {
          outline: none;
          border-color: rgba(59, 130, 246, 0.5);
          background: rgba(255, 255, 255, 0.08);
        }

        .code-tabs {
          display: flex;
          gap: 10px;
          margin-bottom: 15px;
          border-bottom: 1px solid rgba(59, 130, 246, 0.3);
        }

        .code-tab {
          padding: 8px 16px;
          background: rgba(59, 130, 246, 0.1);
          border: 1px solid rgba(59, 130, 246, 0.3);
          border-bottom: none;
          border-radius: 6px 6px 0 0;
          color: #94a3b8;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }

        .code-tab.active {
          background: rgba(59, 130, 246, 0.2);
          color: white;
          border-color: rgba(59, 130, 246, 0.5);
        }

        .code-content {
          display: none;
        }

        .code-content.active {
          display: block;
        }

        .suggestions-list {
          max-height: 200px;
          overflow-y: auto;
          margin-bottom: 15px;
        }

        .suggestion-item {
          display: flex;
          align-items: flex-start;
          gap: 10px;
          padding: 12px;
          background: rgba(255, 255, 255, 0.05);
          border-radius: 6px;
          margin-bottom: 8px;
          border: 1px solid rgba(255, 255, 255, 0.1);
          transition: all 0.2s;
        }

        .suggestion-item:hover {
          background: rgba(255, 255, 255, 0.08);
          border-color: rgba(59, 130, 246, 0.5);
        }

        .suggestion-item.selected {
          background: rgba(59, 130, 246, 0.2);
          border-color: rgba(59, 130, 246, 0.5);
        }

        .suggestion-icon {
          width: 20px;
          height: 20px;
          border-radius: 4px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 12px;
          font-weight: 600;
          color: white;
        }

        .suggestion-icon.suggestion {
          background: #3b82f6;
        }

        .suggestion-icon.error {
          background: #ef4444;
        }

        .suggestion-icon.warning {
          background: #f59e0b;
        }

        .suggestion-info {
          flex: 1;
        }

        .suggestion-title {
          font-size: 13px;
          color: white;
          font-weight: 500;
        }

        .suggestion-description {
          font-size: 11px;
          color: #94a3b8;
          margin-top: 4px;
        }

        .suggestion-actions {
          display: flex;
          gap: 5px;
          opacity: 0;
          transition: opacity 0.2s;
        }

        .suggestion-item:hover .suggestion-actions {
          opacity: 1;
        }

        .suggestion-btn {
          width: 20px;
          height: 20px;
          border: none;
          border-radius: 4px;
          background: rgba(255, 255, 255, 0.1);
          color: #94a3b8;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 10px;
          transition: all 0.2s;
        }

        .suggestion-btn:hover {
          background: rgba(255, 255, 255, 0.2);
          color: white;
        }

        .suggestion-btn.danger:hover {
          background: rgba(239, 68, 68, 0.2);
        }

        .code-editor {
          height: 200px;
          background: rgba(255, 255, 255, 0.05);
          border-radius: 6px;
          border: 1px solid rgba(255, 255, 255, 0.1);
          margin-bottom: 15px;
          padding: 10px;
          overflow: auto;
          font-family: 'Courier New', monospace;
          font-size: 12px;
          color: white;
          white-space: pre;
          line-height: 1.4;
        }

        .code-preview {
          display: none;
          max-height: 200px;
          overflow: auto;
          margin-bottom: 15px;
          padding: 10px;
          background: rgba(255, 255, 255, 0.05);
          border-radius: 6px;
          border: 1px solid rgba(255, 255, 255, 0.1);
        }

        .code-preview.active {
          display: block;
        }

        .preview-content {
          font-size: 11px;
          color: #94a3b8;
          white-space: pre-wrap;
          word-wrap: break-word;
        }

        .code-actions-bottom {
          display: flex;
          gap: 10px;
          justify-content: center;
        }

        .code-btn-large {
          padding: 8px 16px;
          border: 1px solid rgba(59, 130, 246, 0.3);
          border-radius: 6px;
          background: rgba(59, 130, 246, 0.1);
          color: white;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }

        .code-btn-large:hover {
          background: rgba(59, 130, 246, 0.2);
          border-color: rgba(59, 130, 246, 0.5);
        }

        .code-btn-large.active {
          background: #3b82f6;
          border-color: #3b82f6;
        }

        .code-btn-large.danger {
          background: rgba(239, 68, 68, 0.1);
          border-color: rgba(239, 68, 68, 0.3);
        }

        .code-btn-large.danger:hover {
          background: rgba(239, 68, 68, 0.2);
        }

        .code-btn-large.success {
          background: rgba(34, 197, 94, 0.1);
          border-color: rgba(34, 197, 94, 0.3);
        }

        .code-btn-large.success:hover {
          background: rgba(34, 197, 94, 0.2);
        }
      `;

      document.head.appendChild(style);
    }

    createButton({ id = '', className = '', text = '', title = '', onClick = null }) {
      const button = document.createElement('button');
      button.type = 'button';

      if (id) {
        button.id = id;
      }

      if (className) {
        button.className = className;
      }

      if (title) {
        button.title = title;
      }

      button.textContent = text;

      if (typeof onClick === 'function') {
        button.addEventListener('click', onClick);
      }

      return button;
    }

    createTabButton(tabName, label, active = false) {
      const button = this.createButton({
        className: active ? 'code-tab active' : 'code-tab',
        text: label
      });
      button.dataset.tab = tabName;
      return button;
    }

    attachCodeUI() {
      if (!document.body || document.getElementById('code-assistant-container')) {
        return;
      }

      const container = document.createElement('div');
      container.id = 'code-assistant-container';
      container.className = 'code-assistant-container';

      const header = document.createElement('div');
      header.className = 'code-assistant-header';

      const title = document.createElement('span');
      title.className = 'code-assistant-title';
      title.textContent = 'AI Code Assistant';

      const toggleButton = this.createButton({
        className: 'code-assistant-toggle',
        text: 'x',
        title: 'Toggle code assistant',
        onClick: () => {
          this.toggleCodeUI();
        }
      });

      header.appendChild(title);
      header.appendChild(toggleButton);

      const searchSection = document.createElement('div');
      searchSection.className = 'code-search';
      const searchInput = document.createElement('input');
      searchInput.type = 'text';
      searchInput.className = 'search-input';
      searchInput.id = 'code-search-input';
      searchInput.placeholder = 'Search code...';
      searchSection.appendChild(searchInput);

      const tabsContainer = document.createElement('div');
      tabsContainer.className = 'code-tabs';
      tabsContainer.appendChild(this.createTabButton('suggestions', 'Suggestions', true));
      tabsContainer.appendChild(this.createTabButton('editor', 'Editor'));
      tabsContainer.appendChild(this.createTabButton('preview', 'Preview'));

      const suggestionsContent = document.createElement('div');
      suggestionsContent.className = 'code-content active';
      suggestionsContent.id = 'suggestions-content';
      const suggestionsList = document.createElement('div');
      suggestionsList.className = 'suggestions-list';
      suggestionsList.id = 'suggestions-list';
      suggestionsContent.appendChild(suggestionsList);

      const editorContent = document.createElement('div');
      editorContent.className = 'code-content';
      editorContent.id = 'editor-content';
      const codeEditor = document.createElement('div');
      codeEditor.className = 'code-editor';
      codeEditor.id = 'code-editor';
      codeEditor.contentEditable = 'true';
      codeEditor.textContent = '// Start typing code here to get suggestions';
      editorContent.appendChild(codeEditor);

      const previewContent = document.createElement('div');
      previewContent.className = 'code-content';
      previewContent.id = 'preview-content';
      const codePreview = document.createElement('div');
      codePreview.className = 'code-preview';
      codePreview.id = 'code-preview';
      const previewBody = document.createElement('div');
      previewBody.className = 'preview-content';
      previewBody.textContent = 'Code preview will appear here';
      codePreview.appendChild(previewBody);
      previewContent.appendChild(codePreview);

      const actionsBottom = document.createElement('div');
      actionsBottom.className = 'code-actions-bottom';
      const formatButton = this.createButton({
        id: 'format-code-btn',
        className: 'code-btn-large',
        text: 'Format Code',
        title: 'Format current code',
        onClick: () => {
          this.formatCode();
        }
      });
      const lintButton = this.createButton({
        id: 'lint-code-btn',
        className: 'code-btn-large success',
        text: 'Lint Code',
        title: 'Lint current code',
        onClick: () => {
          this.lintCode();
        }
      });
      const clearButton = this.createButton({
        id: 'clear-code-btn',
        className: 'code-btn-large danger',
        text: 'Clear All',
        title: 'Clear suggestions and editor',
        onClick: () => {
          this.clearCode();
        }
      });
      actionsBottom.appendChild(formatButton);
      actionsBottom.appendChild(lintButton);
      actionsBottom.appendChild(clearButton);

      container.appendChild(header);
      container.appendChild(searchSection);
      container.appendChild(tabsContainer);
      container.appendChild(suggestionsContent);
      container.appendChild(editorContent);
      container.appendChild(previewContent);
      container.appendChild(actionsBottom);

      document.body.appendChild(container);

      searchInput.addEventListener('input', (event) => {
        this.searchCode(event.target.value);
      });

      codeEditor.addEventListener('input', (event) => {
        const nextCode = event.target.textContent || '';
        this.handleCodeInput(nextCode);
        this.updatePreview(nextCode);
      });

      container.querySelectorAll('.code-tab').forEach((tab) => {
        tab.addEventListener('click', (event) => {
          const targetTab = event.target.dataset.tab;
          this.switchTab(targetTab);
        });
      });

      container.style.display = this.config.showCodeUI ? 'block' : 'none';
      this.renderSuggestions();
      this.updatePreview(this.getEditorCode());
    }
    startCodeMonitoring() {
      if (this._monitoringInterval) {
        clearInterval(this._monitoringInterval);
      }

      this._monitoringInterval = setInterval(() => {
        this.checkForCodeIssues();
      }, 10000);
    }

    handleCodeInput(code) {
      if (this.config.autoSuggest) {
        this.getSuggestions(code);
      }

      if (this.config.autoComplete) {
        this.autoComplete(code);
      }
    }

    getSuggestions(code, language = 'javascript') {
      const suggestions = [];

      if (code.includes('console.log')) {
        suggestions.push({
          id: Date.now().toString(),
          title: 'Use proper logging',
          description: 'Consider using a logging library instead of console.log for production code',
          type: 'suggestion',
          severity: 'warning'
        });
      }

      if (code.includes('var ')) {
        suggestions.push({
          id: Date.now().toString(),
          title: 'Use const/let instead of var',
          description: 'var is function-scoped and can cause issues, use const or let instead',
          type: 'suggestion',
          severity: 'info'
        });
      }

      if (code.includes('TODO') || code.includes('FIXME')) {
        suggestions.push({
          id: Date.now().toString(),
          title: 'Unresolved TODO/FIXME',
          description: 'There are TODO or FIXME comments in your code that need to be addressed',
          type: 'warning',
          severity: 'warning'
        });
      }

      this._suggestions = suggestions.slice(0, MAX_SUGGESTIONS);
      this.renderSuggestions();
      return this._suggestions;
    }

    applySuggestion(id) {
      const suggestion = this._suggestions.find((item) => item.id === id);
      if (!suggestion) {
        return false;
      }

      const currentCode = this.getEditorCode();
      const suggestionComment = `// ${suggestion.title}: ${suggestion.description}`;
      const nextCode = currentCode.trim()
        ? `${currentCode}\n${suggestionComment}`
        : suggestionComment;

      this.setEditorCode(nextCode);
      this._codeHistory.push({
        action: 'applySuggestion',
        suggestionId: suggestion.id,
        code: nextCode,
        timestamp: Date.now()
      });

      if (this._codeHistory.length > MAX_HISTORY_ITEMS) {
        this._codeHistory.shift();
      }

      this.deleteSuggestion(id);
      return true;
    }

    deleteSuggestion(id) {
      const initialLength = this._suggestions.length;
      this._suggestions = this._suggestions.filter((suggestion) => suggestion.id !== id);

      if (this._suggestions.length === initialLength) {
        return false;
      }

      this.renderSuggestions();
      return true;
    }

    getHistory() {
      return this._codeHistory.map((entry) => ({
        ...entry,
        issues: Array.isArray(entry.issues)
          ? entry.issues.map((issue) => ({ ...issue }))
          : entry.issues
      }));
    }

    getEditorElement() {
      return document.getElementById('code-editor');
    }

    getPreviewElement() {
      return document.querySelector('#code-preview .preview-content');
    }

    getEditorCode() {
      const editor = this.getEditorElement();
      return editor ? (editor.textContent || '') : '';
    }

    setEditorCode(code) {
      const editor = this.getEditorElement();
      if (editor) {
        editor.textContent = code;
      }
      this.updatePreview(code);
    }

    updatePreview(code) {
      const preview = this.getPreviewElement();
      if (!preview) {
        return;
      }

      preview.textContent = code && code.trim()
        ? code
        : 'Code preview will appear here';
    }

    checkForCodeIssues() {
      const code = this.getEditorCode();
      if (!code.trim()) {
        this._suggestions = [];
        this.renderSuggestions();
        return [];
      }

      return this.getSuggestions(code);
    }

    stopCodeMonitoring() {
      if (this._monitoringInterval) {
        clearInterval(this._monitoringInterval);
        this._monitoringInterval = null;
      }
    }
    formatCode(code, language = 'javascript') {
      const sourceCode = typeof code === 'string' ? code : this.getEditorCode();

      try {
        const formatted = sourceCode
          .replace(/; /g, ';\n')
          .replace(/ {2}/g, '    ')
          .replace(/}\n/g, '}\n\n');

        this._codeHistory.push({
          action: 'format',
          code: formatted,
          timestamp: Date.now()
        });

        if (this._codeHistory.length > MAX_HISTORY_ITEMS) {
          this._codeHistory.shift();
        }

        if (typeof code !== 'string') {
          this.setEditorCode(formatted);
        }

        return formatted;
      } catch (err) {
        console.error('Code formatting error:', err);
        return sourceCode;
      }
    }
    lintCode(code, language = 'javascript') {
      const sourceCode = typeof code === 'string' ? code : this.getEditorCode();
      const issues = [];

      if (sourceCode.includes('==')) {
        issues.push({
          type: 'error',
          message: 'Use === instead of == for strict equality comparison',
          line: sourceCode.split('\n').findIndex((line) => line.includes('==')) + 1
        });
      }

      if (sourceCode.includes('alert(')) {
        issues.push({
          type: 'warning',
          message: 'Avoid using alert() for debugging, use console.log instead',
          line: sourceCode.split('\n').findIndex((line) => line.includes('alert(')) + 1
        });
      }

      this._codeHistory.push({
        action: 'lint',
        code: sourceCode,
        issues,
        timestamp: Date.now()
      });

      if (this._codeHistory.length > MAX_HISTORY_ITEMS) {
        this._codeHistory.shift();
      }

      if (typeof code !== 'string') {
        const summary = issues.length === 0
          ? 'No lint issues found'
          : issues.map((issue) => `${issue.type.toUpperCase()} line ${issue.line}: ${issue.message}`).join('\n');
        this.updatePreview(summary);
      }

      return issues;
    }
    autoComplete(code) {
      // Simple auto-complete logic
      const completions = [];

      if (code.endsWith('con')) {
        completions.push('console');
      }

      if (code.endsWith('fun')) {
        completions.push('function');
      }

      return completions;
    }

    createWelcomeSuggestionElement(titleText = 'Welcome to AI Code Assistant', descriptionText = 'Start typing code to get intelligent suggestions') {
      const item = document.createElement('div');
      item.className = 'suggestion-item';

      const icon = document.createElement('div');
      icon.className = 'suggestion-icon suggestion';
      icon.textContent = this.getSuggestionIcon('suggestion');

      const info = document.createElement('div');
      info.className = 'suggestion-info';

      const title = document.createElement('div');
      title.className = 'suggestion-title';
      title.textContent = titleText;

      const description = document.createElement('div');
      description.className = 'suggestion-description';
      description.textContent = descriptionText;

      info.appendChild(title);
      info.appendChild(description);
      item.appendChild(icon);
      item.appendChild(info);
      return item;
    }

    createSuggestionItemElement(suggestion) {
      const item = document.createElement('div');
      item.className = 'suggestion-item';

      if (suggestion.severity === 'warning') {
        item.classList.add('warning');
      }

      if (suggestion.severity === 'error') {
        item.classList.add('error');
      }

      const icon = document.createElement('div');
      icon.className = `suggestion-icon ${suggestion.type}`;
      icon.textContent = this.getSuggestionIcon(suggestion.type);

      const info = document.createElement('div');
      info.className = 'suggestion-info';

      const title = document.createElement('div');
      title.className = 'suggestion-title';
      title.textContent = suggestion.title;

      const description = document.createElement('div');
      description.className = 'suggestion-description';
      description.textContent = suggestion.description;

      info.appendChild(title);
      info.appendChild(description);

      const actions = document.createElement('div');
      actions.className = 'suggestion-actions';

      const applyButton = this.createButton({
        className: 'suggestion-btn',
        text: 'Apply',
        title: 'Apply suggestion',
        onClick: () => {
          this.applySuggestion(suggestion.id);
        }
      });

      const deleteButton = this.createButton({
        className: 'suggestion-btn danger',
        text: 'Delete',
        title: 'Delete suggestion',
        onClick: () => {
          this.deleteSuggestion(suggestion.id);
        }
      });

      actions.appendChild(applyButton);
      actions.appendChild(deleteButton);
      item.appendChild(icon);
      item.appendChild(info);
      item.appendChild(actions);
      return item;
    }

    renderSuggestions(suggestionsToShow = null) {
      const suggestionsList = document.getElementById('suggestions-list');
      if (!suggestionsList) {
        return;
      }

      const suggestions = suggestionsToShow || this._suggestions;
      suggestionsList.replaceChildren();

      if (suggestions.length === 0) {
        suggestionsList.appendChild(this.createWelcomeSuggestionElement());
        return;
      }

      suggestions.forEach((suggestion) => {
        suggestionsList.appendChild(this.createSuggestionItemElement(suggestion));
      });
    }
    getSuggestionIcon(type) {
      const icons = {
        suggestion: 'S',
        error: 'X',
        warning: '!'
      };
      return icons[type] || 'S';
    }
    searchCode(query) {
      const normalizedQuery = String(query || '').trim().toLowerCase();
      if (!normalizedQuery) {
        this.renderSuggestions();
        return;
      }

      const results = this._codeHistory.filter((item) =>
        item.code && item.code.toLowerCase().includes(normalizedQuery)
      );

      this.renderSearchResults(results);
    }

    renderSearchResults(results) {
      const suggestionsList = document.getElementById('suggestions-list');
      if (!suggestionsList) {
        return;
      }

      suggestionsList.replaceChildren();

      if (results.length === 0) {
        suggestionsList.appendChild(
          this.createWelcomeSuggestionElement(
            'No matching history entries',
            'Try a broader search or keep typing to generate suggestions'
          )
        );
        return;
      }

      results.slice(0, MAX_SUGGESTIONS).forEach((result, index) => {
        const item = document.createElement('div');
        item.className = 'suggestion-item';

        const icon = document.createElement('div');
        icon.className = 'suggestion-icon suggestion';
        icon.textContent = 'H';

        const info = document.createElement('div');
        info.className = 'suggestion-info';

        const title = document.createElement('div');
        title.className = 'suggestion-title';
        title.textContent = `History ${index + 1}: ${result.action || 'entry'}`;

        const description = document.createElement('div');
        description.className = 'suggestion-description';
        const codePreview = String(result.code || '').replace(/\s+/g, ' ').trim();
        description.textContent = codePreview.length > 120
          ? `${codePreview.slice(0, 117)}...`
          : codePreview || 'No code snapshot available';

        info.appendChild(title);
        info.appendChild(description);
        item.appendChild(icon);
        item.appendChild(info);
        suggestionsList.appendChild(item);
      });
    }
    switchTab(tabName) {
      const container = document.getElementById('code-assistant-container');
      if (!container) {
        return;
      }

      container.querySelectorAll('.code-tab').forEach((tab) => tab.classList.remove('active'));
      container.querySelectorAll('.code-content').forEach((contentItem) => contentItem.classList.remove('active'));

      const tab = container.querySelector(`[data-tab="${tabName}"]`);
      const contentItem = container.querySelector(`#${tabName}-content`);

      if (tab) {
        tab.classList.add('active');
      }

      if (contentItem) {
        contentItem.classList.add('active');
      }
    }
    clearCode() {
      this._suggestions = [];
      this._codeHistory = [];
      this.renderSuggestions();
      this.setEditorCode('');
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

      GM_registerMenuCommand('AI Code Assistant: Toggle', () => {
        this.toggleCodeUI();
      });

      GM_registerMenuCommand('AI Code Assistant: Format Code', () => {
        this.formatCode();
      });

      GM_registerMenuCommand('AI Code Assistant: Lint Code', () => {
        this.lintCode();
      });

      GM_registerMenuCommand('AI Code Assistant: Settings', () => {
        alert(`AI Code Assistant\n\nEnabled: ${this.config.enabled}\nAuto-suggest: ${this.config.autoSuggest}\nShow UI: ${this.config.showCodeUI}\nDark mode: ${this.config.darkMode}\nAuto-complete: ${this.config.autoComplete}\nLinting: ${this.config.linting}\nFormatting: ${this.config.formatting}`);
      });

      this._menusRegistered = true;
    }

    removeCodeUI() {
      const container = document.getElementById('code-assistant-container');
      if (container) {
        container.remove();
      }
    }

    toggleCodeUI() {
      const container = document.getElementById('code-assistant-container');
      if (container) {
        const isHidden = window.getComputedStyle(container).display === 'none';
        container.style.display = isHidden ? 'block' : 'none';
      }
    }
    execute() {
      if (this.config.enabled) {
        this.attachCodeUI();
        this.startCodeMonitoring();
      }
      console.log(`[${MODULE_NAME}] Execute called`);
    }

    destroy() {
      try {
        this.stopCodeMonitoring();
        this.removeCodeUI();
        console.log(`[${MODULE_NAME}] Cleanup complete`);
      } catch (err) {
        console.error(`[${MODULE_NAME}] Cleanup error:`, err);
      }
    }
  }

  const instance = new AICodeAssistantModule();
  window.AICodeAssistantModule = instance;
  if (window.ChatGPTModules && typeof window.ChatGPTModules.register === 'function') {
    window.ChatGPTModules.register(instance);
  } else if (window.ModuleRegistry && typeof window.ModuleRegistry.register === 'function') {
    window.ModuleRegistry.register(instance);
  } else {
    window.AICodeAssistantAPI = instance.api;
    try {
      instance.init();
      instance.execute();
    } catch (err) {
      console.error(`[${MODULE_NAME}] fallback error`, err);
    }
  }
})();
