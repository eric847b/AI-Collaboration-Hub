// ==UserScript==
// @name         Voice Assistant
// @namespace    http://tampermonkey.net/
// @version      2026.03.28.2
// @description  Voice-controlled AI assistant with speech recognition and synthesis
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
  const STORAGE_KEY = 'ai_voice_assistant_settings';
  const MAX_HISTORY_ITEMS = 50;
  const MODULE_NAME = 'AI Voice Assistant';

  class AIVoiceAssistantModule {
    constructor() {
      this.name = MODULE_NAME;
      this.version = MODULE_VERSION;
      this.dependencies = [];
      this.critical = false;
      this.config = {
        enabled: true,
        autoListen: false,
        wakeWord: 'hey ai',
        voice: 'default',
        speechRate: 1.0,
        pitch: 1.0,
        volume: 1.0,
        showVoiceUI: true,
        continuousListening: false
      };
      this._observer = null;
      this._menusRegistered = false;
      this._recognition = null;
      this._synthesis = null;
      this._isListening = false;
      this._voiceHistory = [];
      this._currentConversation = [];
      this.api = {
        startListening: () => this.startListening(),
        stopListening: () => this.stopListening(),
        speak: (text) => this.speak(text),
        getVoiceHistory: () => this.getVoiceHistory(),
        toggleListening: () => this.toggleListening(),
        setConfig: (settings) => this.setConfig(settings),
        getConfig: () => this.getConfig()
      };
    }

    init() {
      try {
        if (window.ConfigManager && typeof window.ConfigManager.getConfig === 'function') {
          this.config = { ...this.config, ...window.ConfigManager.getConfig(MODULE_NAME) };
        }

        window.AIVoiceAssistantAPI = this.api;
        this.registerMenuCommands();
        this.ensureStyles();
        this.attachVoiceUI();
        this.initializeSpeech();
        console.log(`[${MODULE_NAME}] Initialized`);
      } catch (err) {
        console.error(`[${MODULE_NAME}] Init error:`, err);
      }
    }

    onConfigUpdate(settings) {
      Object.assign(this.config, settings);

      if (this.config.enabled) {
        this.ensureStyles();
        this.initializeSpeech();
      } else {
        this.cleanupSpeech();
      }

      console.log(`[${MODULE_NAME}] Config updated:`, this.config);
    }

    ensureStyles() {
      if (!document.head || document.getElementById('ai-voice-assistant-styles')) {
        return;
      }

      const style = document.createElement('style');
      style.id = 'ai-voice-assistant-styles';
      style.textContent = `
        .voice-assistant-container {
          position: fixed;
          bottom: 20px;
          right: 20px;
          width: 350px;
          background: rgba(15, 23, 42, 0.95);
          border: 1px solid rgba(59, 130, 246, 0.3);
          border-radius: 12px;
          padding: 15px;
          color: white;
          font-family: system-ui, -apple-system, sans-serif;
          box-shadow: 0 10px 25px rgba(0,0,0,0.3);
          z-index: 99998;
          backdrop-filter: blur(10px);
          display: none;
        }

        .voice-assistant-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 15px;
          border-bottom: 1px solid rgba(59, 130, 246, 0.3);
          padding-bottom: 10px;
        }

        .voice-assistant-title {
          font-size: 14px;
          font-weight: 600;
          color: white;
        }

        .voice-assistant-toggle {
          background: none;
          border: none;
          color: #94a3b8;
          cursor: pointer;
          font-size: 16px;
          padding: 0;
          width: 20px;
          height: 20px;
        }

        .voice-status {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 15px;
          padding: 10px;
          background: rgba(255, 255, 255, 0.05);
          border-radius: 6px;
          border: 1px solid rgba(255, 255, 255, 0.1);
        }

        .status-indicator {
          width: 12px;
          height: 12px;
          border-radius: 50%;
          background: #ef4444;
          animation: pulse 2s infinite;
        }

        .status-indicator.active {
          background: #22c55e;
          animation: none;
        }

        @keyframes pulse {
          0% { opacity: 1; }
          50% { opacity: 0.5; }
          100% { opacity: 1; }
        }

        .status-text {
          font-size: 12px;
          color: #94a3b8;
        }

        .voice-actions {
          display: flex;
          gap: 10px;
          margin-bottom: 15px;
        }

        .voice-btn {
          padding: 8px 16px;
          border: 1px solid rgba(59, 130, 246, 0.3);
          border-radius: 6px;
          background: rgba(59, 130, 246, 0.1);
          color: white;
          font-size: 11px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }

        .voice-btn:hover {
          background: rgba(59, 130, 246, 0.2);
          border-color: rgba(59, 130, 246, 0.5);
        }

        .voice-btn.active {
          background: #3b82f6;
          border-color: #3b82f6;
        }

        .voice-btn.danger {
          background: rgba(239, 68, 68, 0.1);
          border-color: rgba(239, 68, 68, 0.3);
        }

        .voice-btn.danger:hover {
          background: rgba(239, 68, 68, 0.2);
        }

        .voice-history {
          max-height: 200px;
          overflow-y: auto;
          margin-bottom: 15px;
        }

        .history-item {
          display: flex;
          align-items: flex-start;
          gap: 10px;
          padding: 8px;
          background: rgba(255, 255, 255, 0.05);
          border-radius: 6px;
          margin-bottom: 8px;
          border: 1px solid rgba(255, 255, 255, 0.1);
        }

        .history-icon {
          width: 24px;
          height: 24px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 12px;
          font-weight: 600;
        }

        .history-icon.user {
          background: #3b82f6;
          color: white;
        }

        .history-icon.ai {
          background: #22c55e;
          color: white;
        }

        .history-content {
          flex: 1;
          font-size: 12px;
          line-height: 1.4;
        }

        .history-timestamp {
          font-size: 10px;
          color: #94a3b8;
          margin-top: 4px;
        }

        .voice-settings {
          display: flex;
          flex-direction: column;
          gap: 10px;
          margin-bottom: 15px;
        }

        .setting-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 8px;
          background: rgba(255, 255, 255, 0.05);
          border-radius: 6px;
          border: 1px solid rgba(255, 255, 255, 0.1);
        }

        .setting-label {
          font-size: 11px;
          color: #94a3b8;
        }

        .setting-control {
          font-size: 11px;
          padding: 4px 8px;
          border: 1px solid rgba(59, 130, 246, 0.3);
          border-radius: 4px;
          background: rgba(59, 130, 246, 0.1);
          color: white;
          width: 80px;
        }

        .setting-control:hover {
          background: rgba(59, 130, 246, 0.2);
        }

        .setting-range {
          width: 100%;
          margin-top: 4px;
        }

        .setting-range input {
          width: 100%;
          height: 4px;
          background: rgba(255, 255, 255, 0.2);
          border: none;
          outline: none;
          margin: 0;
        }

        .setting-range input::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 12px;
          height: 12px;
          background: #3b82f6;
          cursor: pointer;
          border-radius: 50%;
        }

        .setting-range input::-moz-range-thumb {
          width: 12px;
          height: 12px;
          background: #3b82f6;
          cursor: pointer;
          border-radius: 50%;
          border: none;
        }
      `;

      document.head.appendChild(style);
    }

    attachVoiceUI() {
      if (!document.body || document.getElementById('voice-assistant-container')) {
        return;
      }

      const container = document.createElement('div');
      container.id = 'voice-assistant-container';
      container.innerHTML = `
        <div class="voice-assistant-container">
          <div class="voice-assistant-header">
            <span class="voice-assistant-title">AI Voice Assistant</span>
            <button class="voice-assistant-toggle" onclick="window.AIVoiceAssistantAPI.toggleListening()">✕</button>
          </div>

          <div class="voice-status">
            <div class="status-indicator ${this.config.autoListen ? 'active' : ''}"></div>
            <span class="status-text">${this.config.autoListen ? 'Listening for wake word' : 'Voice assistant ready'}</span>
          </div>

          <div class="voice-actions">
            <button class="voice-btn" id="start-listening-btn">Start Listening</button>
            <button class="voice-btn danger" id="stop-listening-btn">Stop Listening</button>
            <button class="voice-btn" id="speak-btn">Speak Response</button>
          </div>

          <div class="voice-history" id="voice-history">
            <div class="history-item">
              <div class="history-icon user">U</div>
              <div class="history-content">
                <div>Voice assistant ready</div>
                <div class="history-timestamp">Just now</div>
              </div>
            </div>
          </div>

          <div class="voice-settings">
            <div class="setting-item">
              <span class="setting-label">Wake Word</span>
              <input type="text" class="setting-control" id="wake-word-input" value="${this.config.wakeWord}" placeholder="hey ai">
            </div>

            <div class="setting-item">
              <span class="setting-label">Speech Rate</span>
              <input type="range" class="setting-range" id="speech-rate-input" min="0.5" max="2.0" step="0.1" value="${this.config.speechRate}">
            </div>

            <div class="setting-item">
              <span class="setting-label">Pitch</span>
              <input type="range" class="setting-range" id="pitch-input" min="0.5" max="2.0" step="0.1" value="${this.config.pitch}">
            </div>

            <div class="setting-item">
              <span class="setting-label">Volume</span>
              <input type="range" class="setting-range" id="volume-input" min="0" max="1" step="0.1" value="${this.config.volume}">
            </div>
          </div>
        </div>
      `;

      document.body.appendChild(container);

      document.getElementById('start-listening-btn').addEventListener('click', () => {
        this.startListening();
      });

      document.getElementById('stop-listening-btn').addEventListener('click', () => {
        this.stopListening();
      });

      document.getElementById('speak-btn').addEventListener('click', () => {
        this.speak('Hello, how can I assist you today?');
      });

      document.getElementById('wake-word-input').addEventListener('change', (e) => {
        this.config.wakeWord = e.target.value;
        this.saveConfig();
      });

      document.getElementById('speech-rate-input').addEventListener('input', (e) => {
        this.config.speechRate = parseFloat(e.target.value);
        this.saveConfig();
      });

      document.getElementById('pitch-input').addEventListener('input', (e) => {
        this.config.pitch = parseFloat(e.target.value);
        this.saveConfig();
      });

      document.getElementById('volume-input').addEventListener('input', (e) => {
        this.config.volume = parseFloat(e.target.value);
        this.saveConfig();
      });
    }

    initializeSpeech() {
      try {
        this._recognition = new webkitSpeechRecognition() || new SpeechRecognition();
        this._recognition.continuous = this.config.continuousListening;
        this._recognition.interimResults = true;
        this._recognition.lang = 'en-US';

        this._recognition.onstart = () => {
          this._isListening = true;
          this.updateStatus('Listening...');
        };

        this._recognition.onerror = (event) => {
          console.error('Speech recognition error:', event.error);
          this._isListening = false;
          this.updateStatus('Error: ' + event.error);
        };

        this._recognition.onend = () => {
          this._isListening = false;
          this.updateStatus('Voice assistant ready');
          if (this.config.autoListen) {
            setTimeout(() => this.startListening(), 1000);
          }
        };

        this._recognition.onresult = (event) => {
          const transcript = event.results[event.results.length - 1][0].transcript;
          this.handleVoiceInput(transcript);
        };

        this._synthesis = window.speechSynthesis;
      } catch (err) {
        console.error('Speech API initialization error:', err);
        this.showError('Speech API not supported');
      }
    }

    startListening() {
      if (!this._recognition) {
        this.initializeSpeech();
      }

      if (this._isListening) {
        return;
      }

      try {
        this._recognition.start();
        this._isListening = true;
        this.updateStatus('Listening...');
      } catch (err) {
        console.error('Failed to start listening:', err);
        this.showError('Failed to start listening');
      }
    }

    stopListening() {
      if (this._recognition && this._isListening) {
        this._recognition.stop();
        this._isListening = false;
        this.updateStatus('Voice assistant ready');
      }
    }

    handleVoiceInput(transcript) {
      const normalized = transcript.toLowerCase().trim();
      this._voiceHistory.push({
        type: 'user',
        content: transcript,
        timestamp: Date.now()
      });

      this.addHistoryItem('user', transcript);

      if (this.config.autoListen && normalized.includes(this.config.wakeWord.toLowerCase())) {
        this.processVoiceCommand(transcript.replace(this.config.wakeWord, '').trim());
      } else if (!this.config.autoListen) {
        this.processVoiceCommand(transcript);
      }
    }

    processVoiceCommand(command) {
      if (!command) {
        return;
      }

      this._currentConversation.push({
        type: 'user',
        content: command,
        timestamp: Date.now()
      });

      this.addHistoryItem('user', command);

      if (command.includes('stop') || command.includes('cancel')) {
        this.stopListening();
        this.speak('Stopping voice assistant');
        return;
      }

      if (command.includes('help') || command.includes('what can you do')) {
        this.speak('I can help you with various tasks like searching the web, setting reminders, sending messages, and more. Just ask!');
        return;
      }

      if (command.includes('search') || command.includes('find')) {
        const query = command.replace(/search|find/i, '').trim();
        this.speak(`Searching for ${query}`);
        window.open(`https://www.google.com/search?q=${encodeURIComponent(query)}`, '_blank');
        return;
      }

      if (command.includes('open') || command.includes('go to')) {
        const site = command.replace(/open|go to/i, '').trim();
        this.speak(`Opening ${site}`);
        window.open(`https://${site}`, '_blank');
        return;
      }

      if (command.includes('repeat') || command.includes('say')) {
        const text = command.replace(/repeat|say/i, '').trim();
        this.speak(text);
        return;
      }

      this.speak('I heard you say: ' + command);
    }

    speak(text) {
      if (!this._synthesis) {
        this.initializeSpeech();
      }

      if (this._synthesis.speaking) {
        this._synthesis.cancel();
      }

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = this.config.speechRate;
      utterance.pitch = this.config.pitch;
      utterance.volume = this.config.volume;
      utterance.lang = 'en-US';

      utterance.onstart = () => {
        this._isSpeaking = true;
        this.updateStatus('Speaking...');
      };

      utterance.onend = () => {
        this._isSpeaking = false;
        this.updateStatus('Voice assistant ready');
        this._voiceHistory.push({
          type: 'ai',
          content: text,
          timestamp: Date.now()
        });
        this.addHistoryItem('ai', text);
      };

      utterance.onerror = (event) => {
        console.error('Speech synthesis error:', event.error);
        this.showError('Speech synthesis error');
      };

      this._synthesis.speak(utterance);
    }

    addHistoryItem(type, content) {
      const historyContainer = document.getElementById('voice-history');
      if (!historyContainer) {
        return;
      }

      const item = document.createElement('div');
      item.className = 'history-item';
      item.innerHTML = `
        <div class="history-icon ${type}">${type === 'user' ? 'U' : 'AI'}</div>
        <div class="history-content">
          <div>${content}</div>
          <div class="history-timestamp">${this.formatTime(Date.now())}</div>
        </div>
      `;

      historyContainer.insertBefore(item, historyContainer.firstChild);
      if (historyContainer.children.length > 20) {
        historyContainer.removeChild(historyContainer.lastChild);
      }
    }

    updateStatus(text) {
      const statusText = document.querySelector('.status-text');
      if (statusText) {
        statusText.textContent = text;
      }
    }

    showError(message) {
      GM_notification({
        text: message,
        title: 'AI Voice Assistant',
        timeout: 5000
      });
    }

    formatTime(timestamp) {
      const now = new Date(timestamp);
      const hours = now.getHours() % 12 || 12;
      const minutes = now.getMinutes().toString().padStart(2, '0');
      const ampm = now.getHours() >= 12 ? 'PM' : 'AM';
      return `${hours}:${minutes} ${ampm}`;
    }

    getVoiceHistory() {
      return [...this._voiceHistory];
    }

    toggleListening() {
      if (this._isListening) {
        this.stopListening();
      } else {
        this.startListening();
      }
    }

    cleanupSpeech() {
      if (this._recognition) {
        this._recognition.abort();
        this._recognition = null;
      }
      if (this._synthesis) {
        this._synthesis.cancel();
        this._synthesis = null;
      }
    }

    saveConfig() {
      if (window.ConfigManager && typeof window.ConfigManager.setConfig === 'function') {
        window.ConfigManager.setConfig(MODULE_NAME, this.config);
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

      GM_registerMenuCommand('AI Voice Assistant: Toggle', () => {
        this.toggleListening();
      });

      GM_registerMenuCommand('AI Voice Assistant: Start Listening', () => {
        this.startListening();
      });

      GM_registerMenuCommand('AI Voice Assistant: Stop Listening', () => {
        this.stopListening();
      });

      GM_registerMenuCommand('AI Voice Assistant: Speak', () => {
        this.speak('Hello, how can I assist you today?');
      });

      GM_registerMenuCommand('AI Voice Assistant: Settings', () => {
        alert(`AI Voice Assistant\n\nEnabled: ${this.config.enabled}\nAuto-listen: ${this.config.autoListen}\nWake word: ${this.config.wakeWord}\nSpeech rate: ${this.config.speechRate}\nPitch: ${this.config.pitch}\nVolume: ${this.config.volume}`);
      });

      this._menusRegistered = true;
    }

    removeVoiceUI() {
      const container = document.getElementById('voice-assistant-container');
      if (container) {
        container.remove();
      }
    }

    execute() {
      if (this.config.enabled) {
        this.attachVoiceUI();
        if (this.config.autoListen) {
          this.startListening();
        }
      }
      console.log(`[${MODULE_NAME}] Execute called`);
    }

    destroy() {
      try {
        this.stopListening();
        this.cleanupSpeech();
        this.removeVoiceUI();
        console.log(`[${MODULE_NAME}] Cleanup complete`);
      } catch (err) {
        console.error(`[${MODULE_NAME}] Cleanup error:`, err);
      }
    }
  }

  const instance = new AIVoiceAssistantModule();
  window.AIVoiceAssistantModule = instance;
  if (window.ChatGPTModules && typeof window.ChatGPTModules.register === 'function') {
    window.ChatGPTModules.register(instance);
  } else if (window.ModuleRegistry && typeof window.ModuleRegistry.register === 'function') {
    window.ModuleRegistry.register(instance);
  } else {
    window.AIVoiceAssistantAPI = instance.api;
    try {
      instance.init();
      instance.execute();
    } catch (err) {
      console.error(`[${MODULE_NAME}] fallback error`, err);
    }
  }
})();
