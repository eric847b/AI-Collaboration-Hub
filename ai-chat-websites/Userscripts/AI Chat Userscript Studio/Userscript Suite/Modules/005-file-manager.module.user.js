// ==UserScript==
// @name         File Manager
// @namespace    http://tampermonkey.net/
// @version      2026.03.28.2
// @description  Intelligent file management and organization system
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
  const STORAGE_KEY = 'ai_file_manager_settings';
  const MAX_FILES = 500;
  const MAX_HISTORY_ITEMS = 200;
  const MODULE_NAME = 'AI File Manager';

  class AIFileManagerModule {
    constructor() {
      this.name = MODULE_NAME;
      this.version = MODULE_VERSION;
      this.dependencies = [];
      this.critical = false;
      this.config = {
        enabled: true,
        autoOrganize: true,
        showFileManagerUI: true,
        darkMode: true,
        autoBackup: true,
        filePreview: true,
        searchEnabled: true
      };
      this._observer = null;
      this._menusRegistered = false;
      this._files = [];
      this._fileHistory = [];
      this._currentDirectory = '/';
      this._favorites = [];
      this.api = {
        addFile: (file) => this.addFile(file),
        updateFile: (id, updates) => this.updateFile(id, updates),
        deleteFile: (id) => this.deleteFile(id),
        getFile: (id) => this.getFile(id),
        getFiles: () => this.getFiles(),
        searchFiles: (query) => this.searchFiles(query),
        createDirectory: (path) => this.createDirectory(path),
        deleteDirectory: (path) => this.deleteDirectory(path),
        moveFile: (id, newPath) => this.moveFile(id, newPath),
        renameFile: (id, newName) => this.renameFile(id, newName),
        setConfig: (settings) => this.setConfig(settings),
        getConfig: () => this.getConfig()
      };
    }

    init() {
      try {
        if (window.ConfigManager && typeof window.ConfigManager.getConfig === 'function') {
          this.config = { ...this.config, ...window.ConfigManager.getConfig(MODULE_NAME) };
        }

        window.AIFileManagerAPI = this.api;
        this.registerMenuCommands();
        this.ensureStyles();
        this.attachFileManagerUI();
        this.loadFiles();
        this.startFileMonitoring();
        console.log(`[${MODULE_NAME}] Initialized`);
      } catch (err) {
        console.error(`[${MODULE_NAME}] Init error:`, err);
      }
    }

    onConfigUpdate(settings) {
      Object.assign(this.config, settings);

      if (this.config.enabled) {
        this.ensureStyles();
        this.attachFileManagerUI();
      } else {
        this.removeFileManagerUI();
      }

      console.log(`[${MODULE_NAME}] Config updated:`, this.config);
    }

    ensureStyles() {
      if (!document.head || document.getElementById('ai-file-manager-styles')) {
        return;
      }

      const style = document.createElement('style');
      style.id = 'ai-file-manager-styles';
      style.textContent = `
        .file-manager-container {
          position: fixed;
          top: 1000px;
          right: 20px;
          width: 450px;
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

        .file-manager-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
          border-bottom: 1px solid rgba(59, 130, 246, 0.3);
          padding-bottom: 10px;
        }

        .file-manager-title {
          font-size: 16px;
          font-weight: 600;
          color: white;
        }

        .file-manager-toggle {
          background: none;
          border: none;
          color: #94a3b8;
          cursor: pointer;
          font-size: 18px;
          padding: 0;
          width: 24px;
          height: 24px;
        }

        .file-search {
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

        .directory-path {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 15px;
          padding: 10px;
          background: rgba(255, 255, 255, 0.05);
          border-radius: 6px;
          border: 1px solid rgba(255, 255, 255, 0.1);
        }

        .path-item {
          display: flex;
          align-items: center;
          gap: 5px;
          padding: 4px 8px;
          background: rgba(59, 130, 246, 0.2);
          border-radius: 4px;
          font-size: 11px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .path-item:hover {
          background: rgba(59, 130, 246, 0.3);
          color: white;
        }

        .path-separator {
          color: #94a3b8;
          font-size: 12px;
        }

        .files-list {
          max-height: 300px;
          overflow-y: auto;
          margin-bottom: 15px;
        }

        .file-item {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 12px;
          background: rgba(255, 255, 255, 0.05);
          border-radius: 6px;
          margin-bottom: 8px;
          border: 1px solid rgba(255, 255, 255, 0.1);
          transition: all 0.2s;
        }

        .file-item:hover {
          background: rgba(255, 255, 255, 0.08);
          border-color: rgba(59, 130, 246, 0.5);
        }

        .file-item.selected {
          background: rgba(59, 130, 246, 0.2);
          border-color: rgba(59, 130, 246, 0.5);
        }

        .file-icon {
          width: 24px;
          height: 24px;
          border-radius: 4px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 12px;
          font-weight: 600;
          color: white;
        }

        .file-icon.folder {
          background: #3b82f6;
        }

        .file-icon.file {
          background: #22c55e;
        }

        .file-icon.image {
          background: #f59e0b;
        }

        .file-icon.video {
          background: #ef4444;
        }

        .file-icon.audio {
          background: #8b5cf6;
        }

        .file-info {
          flex: 1;
        }

        .file-name {
          font-size: 13px;
          color: white;
          font-weight: 500;
        }

        .file-size {
          font-size: 11px;
          color: #94a3b8;
          margin-top: 2px;
        }

        .file-actions {
          display: flex;
          gap: 5px;
          opacity: 0;
          transition: opacity 0.2s;
        }

        .file-item:hover .file-actions {
          opacity: 1;
        }

        .file-btn {
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

        .file-btn:hover {
          background: rgba(255, 255, 255, 0.2);
          color: white;
        }

        .file-btn.danger:hover {
          background: rgba(239, 68, 68, 0.2);
        }

        .file-stats {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 10px;
          background: rgba(255, 255, 255, 0.05);
          border-radius: 6px;
          border: 1px solid rgba(255, 255, 255, 0.1);
          margin-bottom: 15px;
        }

        .stat-item {
          display: flex;
          flex-direction: column;
          align-items: center;
        }

        .stat-value {
          font-size: 16px;
          font-weight: 600;
          color: white;
        }

        .stat-label {
          font-size: 11px;
          color: #94a3b8;
          margin-top: 4px;
        }

        .file-actions-bottom {
          display: flex;
          gap: 10px;
          justify-content: center;
        }

        .file-btn-large {
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

        .file-btn-large:hover {
          background: rgba(59, 130, 246, 0.2);
          border-color: rgba(59, 130, 246, 0.5);
        }

        .file-btn-large.active {
          background: #3b82f6;
          border-color: #3b82f6;
        }

        .file-btn-large.danger {
          background: rgba(239, 68, 68, 0.1);
          border-color: rgba(239, 68, 68, 0.3);
        }

        .file-btn-large.danger:hover {
          background: rgba(239, 68, 68, 0.2);
        }

        .file-preview {
          display: none;
          max-height: 200px;
          overflow: auto;
          margin-bottom: 15px;
          padding: 10px;
          background: rgba(255, 255, 255, 0.05);
          border-radius: 6px;
          border: 1px solid rgba(255, 255, 255, 0.1);
        }

        .file-preview.active {
          display: block;
        }

        .preview-content {
          font-size: 11px;
          color: #94a3b8;
          white-space: pre-wrap;
          word-wrap: break-word;
        }

        .favorite-btn {
          width: 20px;
          height: 20px;
          border: none;
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.1);
          color: #94a3b8;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 10px;
          transition: all 0.2s;
        }

        .favorite-btn:hover {
          background: rgba(255, 255, 255, 0.2);
          color: white;
        }

        .favorite-btn.active {
          background: #fbbf24;
          color: white;
        }
      `;

      document.head.appendChild(style);
    }

    attachFileManagerUI() {
      if (!document.body || document.getElementById('file-manager-container')) {
        return;
      }

      const container = document.createElement('div');
      container.id = 'file-manager-container';
      container.innerHTML = `
        <div class="file-manager-container">
          <div class="file-manager-header">
            <span class="file-manager-title">AI File Manager</span>
            <button class="file-manager-toggle" onclick="window.AIFileManagerAPI.toggleFileManagerUI()">✕</button>
          </div>

          <div class="file-search">
            <input type="text" class="search-input" id="file-search-input" placeholder="Search files...">
          </div>

          <div class="directory-path">
            <div class="path-item" onclick="window.AIFileManagerAPI.changeDirectory('/')">Home</div>
            <div class="path-separator">/</div>
            <div class="path-item" onclick="window.AIFileManagerAPI.changeDirectory('/documents')">Documents</div>
            <div class="path-separator">/</div>
            <div class="path-item" onclick="window.AIFileManagerAPI.changeDirectory('/downloads')">Downloads</div>
          </div>

          <div class="files-list" id="files-list">
            <div class="file-item">
              <div class="file-icon folder">📁</div>
              <div class="file-info">
                <div class="file-name">Documents</div>
                <div class="file-size">Folder</div>
              </div>
              <div class="file-actions">
                <button class="file-btn" title="Open">🔍</button>
                <button class="file-btn" title="Rename">✏️</button>
                <button class="file-btn danger" title="Delete">🗑️</button>
              </div>
            </div>
          </div>

          <div class="file-stats">
            <div class="stat-item">
              <span class="stat-value" id="total-files">0</span>
              <span class="stat-label">Total</span>
            </div>
            <div class="stat-item">
              <span class="stat-value" id="used-space">0MB</span>
              <span class="stat-label">Used</span>
            </div>
            <div class="stat-item">
              <span class="stat-value" id="free-space">0MB</span>
              <span class="stat-label">Free</span>
            </div>
          </div>

          <div class="file-actions-bottom">
            <button class="file-btn-large" id="upload-file-btn">Upload</button>
            <button class="file-btn-large active" id="new-folder-btn">New Folder</button>
            <button class="file-btn-large danger" id="clear-files-btn">Clear All</button>
          </div>

          <div class="file-preview" id="file-preview">
            <div class="preview-content">No file selected</div>
          </div>
        </div>
      `;

      document.body.appendChild(container);

      document.getElementById('file-search-input').addEventListener('input', (e) => {
        this.searchFiles(e.target.value);
      });

      document.getElementById('upload-file-btn').addEventListener('click', () => {
        this.promptUploadFile();
      });

      document.getElementById('new-folder-btn').addEventListener('click', () => {
        this.promptNewFolder();
      });

      document.getElementById('clear-files-btn').addEventListener('click', () => {
        this.clearAllFiles();
      });
    }

    loadFiles() {
      const savedFiles = window.localStorage.getItem('ai_file_manager_files');
      if (savedFiles) {
        this._files = JSON.parse(savedFiles);
        this.renderFiles();
      }
    }

    saveFiles() {
      if (this.config.autoBackup) {
        window.localStorage.setItem('ai_file_manager_files', JSON.stringify(this._files));
      }
    }

    addFile(file) {
      const newFile = {
        id: Date.now().toString(),
        name: file.name || 'Untitled',
        type: file.type || 'file',
        size: file.size || 0,
        path: file.path || this._currentDirectory,
        content: file.content || '',
        createdAt: Date.now(),
        tags: file.tags || [],
        favorite: false
      };

      this._files.push(newFile);
      this._fileHistory.push({
        action: 'add',
        file: newFile,
        timestamp: Date.now()
      });

      this.saveFiles();
      this.renderFiles();
      this.updateStats();

      return newFile;
    }

    updateFile(id, updates) {
      const fileIndex = this._files.findIndex(f => f.id === id);
      if (fileIndex === -1) {
        return null;
      }

      const originalFile = { ...this._files[fileIndex] };
      this._files[fileIndex] = { ...this._files[fileIndex], ...updates };

      this._fileHistory.push({
        action: 'update',
        fileId: id,
        changes: updates,
        timestamp: Date.now()
      });

      this.saveFiles();
      this.renderFiles();
      this.updateStats();

      return this._files[fileIndex];
    }

    deleteFile(id) {
      const fileIndex = this._files.findIndex(f => f.id === id);
      if (fileIndex === -1) {
        return false;
      }

      const deletedFile = this._files.splice(fileIndex, 1)[0];
      this._fileHistory.push({
        action: 'delete',
        file: deletedFile,
        timestamp: Date.now()
      });

      this.saveFiles();
      this.renderFiles();
      this.updateStats();

      return true;
    }

    getFile(id) {
      return this._files.find(f => f.id === id);
    }

    getFiles() {
      return [...this._files];
    }

    searchFiles(query) {
      const filteredFiles = this._files.filter(file =>
        file.name.toLowerCase().includes(query.toLowerCase()) ||
        file.content.toLowerCase().includes(query.toLowerCase()) ||
        file.tags.some(tag => tag.toLowerCase().includes(query.toLowerCase()))
      );

      this.renderFiles(filteredFiles);
    }

    createDirectory(path) {
      const newDirectory = {
        id: Date.now().toString(),
        name: this.extractNameFromPath(path),
        type: 'folder',
        path: path,
        createdAt: Date.now(),
        tags: [],
        favorite: false
      };

      this._files.push(newDirectory);
      this.saveFiles();
      this.renderFiles();

      return newDirectory;
    }

    deleteDirectory(path) {
      const filesInDirectory = this._files.filter(f => f.path.startsWith(path));
      filesInDirectory.forEach(file => this.deleteFile(file.id));
      return true;
    }

    moveFile(id, newPath) {
      const file = this.getFile(id);
      if (!file) {
        return false;
      }

      return this.updateFile(id, { path: newPath });
    }

    renameFile(id, newName) {
      return this.updateFile(id, { name: newName });
    }

    changeDirectory(path) {
      this._currentDirectory = path;
      this.renderFiles();
    }

    extractNameFromPath(path) {
      return path.split('/').pop() || '';
    }

    renderFiles(filesToShow = null) {
      const filesList = document.getElementById('files-list');
      if (!filesList) {
        return;
      }

      const files = filesToShow || this._files.filter(f => f.path === this._currentDirectory);
      filesList.innerHTML = files.map(file => `
        <div class="file-item ${file.favorite ? 'selected' : ''}">
          <div class="file-icon ${file.type}">${this.getFileIcon(file.type)}</div>
          <div class="file-info">
            <div class="file-name">${file.name}</div>
            <div class="file-size">${this.formatFileSize(file.size)}</div>
          </div>
          <div class="file-actions">
            <button class="file-btn" title="Open" onclick="window.AIFileManagerAPI.openFile('${file.id}')">🔍</button>
            <button class="file-btn" title="Rename" onclick="window.AIFileManagerAPI.renameFile('${file.id}')">✏️</button>
            <button class="file-btn danger" title="Delete" onclick="window.AIFileManagerAPI.deleteFile('${file.id}')">🗑️</button>
            <button class="favorite-btn ${file.favorite ? 'active' : ''}" title="Favorite" onclick="window.AIFileManagerAPI.toggleFavorite('${file.id}')">⭐</button>
          </div>
        </div>
      `).join('');
    }

    updateStats() {
      const totalFiles = this._files.length;
      const usedSpace = this._files.reduce((sum, f) => sum + f.size, 0);
      const freeSpace = 1024 * 1024 * 100 - usedSpace; // 100MB total

      document.getElementById('total-files').textContent = totalFiles;
      document.getElementById('used-space').textContent = `${(usedSpace / 1024 / 1024).toFixed(2)}MB`;
      document.getElementById('free-space').textContent = `${(freeSpace / 1024 / 1024).toFixed(2)}MB`;
    }

    startFileMonitoring() {
      if (this._monitoringInterval) {
        clearInterval(this._monitoringInterval);
      }

      this._monitoringInterval = setInterval(() => {
        this.checkForDuplicates();
      }, 30000);
    }

    checkForDuplicates() {
      const fileNames = {};
      this._files.forEach(file => {
        const key = `${file.name}-${file.path}`;
        if (fileNames[key]) {
          this.renameFile(file.id, `${file.name} (copy)`);
        } else {
          fileNames[key] = true;
        }
      });
    }

    formatFileSize(bytes) {
      if (bytes === 0) return '0 Bytes';
      const k = 1024;
      const sizes = ['Bytes', 'KB', 'MB', 'GB'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    getFileIcon(type) {
      const icons = {
        folder: '📁',
        file: '📄',
        image: '🖼️',
        video: '🎬',
        audio: '🎵',
        document: '📃',
        spreadsheet: '📊',
        presentation: '📊'
      };
      return icons[type] || '📄';
    }

    openFile(id) {
      const file = this.getFile(id);
      if (!file) {
        return;
      }

      if (this.config.filePreview) {
        this.showFilePreview(file);
      }

      if (file.type === 'folder') {
        this.changeDirectory(file.path);
      }
    }

    showFilePreview(file) {
      const preview = document.getElementById('file-preview');
      if (!preview) {
        return;
      }

      preview.innerHTML = `
        <div class="preview-content">
          ${file.type === 'folder' ? 'Folder' : file.content.substring(0, 500)}
          ${file.content.length > 500 ? '...' : ''}
        </div>
      `;
      preview.classList.add('active');
    }

    toggleFavorite(id) {
      const file = this.getFile(id);
      if (!file) {
        return;
      }

      this.updateFile(id, { favorite: !file.favorite });
    }

    promptUploadFile() {
      const fileInput = document.createElement('input');
      fileInput.type = 'file';
      fileInput.onchange = (e) => {
        if (e.target.files[0]) {
          this.addFile({
            name: e.target.files[0].name,
            type: 'file',
            size: e.target.files[0].size,
            content: 'File content'
          });
        }
      };
      fileInput.click();
    }

    promptNewFolder() {
      const folderName = prompt('Enter folder name:');
      if (folderName) {
        this.createDirectory(`${this._currentDirectory}/${folderName}`);
      }
    }

    clearAllFiles() {
      if (confirm('Are you sure you want to clear all files?')) {
        this._files = [];
        this.saveFiles();
        this.renderFiles();
        this.updateStats();
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

      GM_registerMenuCommand('AI File Manager: Toggle', () => {
        this.toggleFileManagerUI();
      });

      GM_registerMenuCommand('AI File Manager: Upload File', () => {
        this.promptUploadFile();
      });

      GM_registerMenuCommand('AI File Manager: New Folder', () => {
        this.promptNewFolder();
      });

      GM_registerMenuCommand('AI File Manager: Settings', () => {
        alert(`AI File Manager\n\nEnabled: ${this.config.enabled}\nAuto-organize: ${this.config.autoOrganize}\nShow UI: ${this.config.showFileManagerUI}\nAuto-backup: ${this.config.autoBackup}\nFile preview: ${this.config.filePreview}\nSearch enabled: ${this.config.searchEnabled}`);
      });

      this._menusRegistered = true;
    }

    removeFileManagerUI() {
      const container = document.getElementById('file-manager-container');
      if (container) {
        container.remove();
      }
    }

    toggleFileManagerUI() {
      const container = document.getElementById('file-manager-container');
      if (container) {
        container.style.display = container.style.display === 'none' ? 'block' : 'none';
      }
    }

    execute() {
      if (this.config.enabled) {
        this.attachFileManagerUI();
        this.startFileMonitoring();
      }
      console.log(`[${MODULE_NAME}] Execute called`);
    }

    destroy() {
      try {
        this.stopFileMonitoring();
        this.removeFileManagerUI();
        console.log(`[${MODULE_NAME}] Cleanup complete`);
      } catch (err) {
        console.error(`[${MODULE_NAME}] Cleanup error:`, err);
      }
    }
  }

  const instance = new AIFileManagerModule();
  window.AIFileManagerModule = instance;
  if (window.ChatGPTModules && typeof window.ChatGPTModules.register === 'function') {
    window.ChatGPTModules.register(instance);
  } else if (window.ModuleRegistry && typeof window.ModuleRegistry.register === 'function') {
    window.ModuleRegistry.register(instance);
  } else {
    window.AIFileManagerAPI = instance.api;
    try {
      instance.init();
      instance.execute();
    } catch (err) {
      console.error(`[${MODULE_NAME}] fallback error`, err);
    }
  }
})();
