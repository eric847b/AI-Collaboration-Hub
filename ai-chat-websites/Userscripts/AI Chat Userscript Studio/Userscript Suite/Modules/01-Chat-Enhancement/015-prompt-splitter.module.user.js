// ==UserScript==
// @name         Prompt Splitter
// @version      2026.03.14.1
// @description  ChatGPT - Prompt Splitting
// @author       AI RMD
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
// @grant        GM_addStyle
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_notification
// @grant        GM_xmlhttpRequest
// @grant        GM_registerMenuCommand
// @grant        GM_unregisterMenuCommand
// @grant        GM_info
// @grant        GM_setClipboard
// @grant        GM_openInTab
// @grant        GM_getResourceText
// @grant        GM_getResourceURL
// @grant        GM_addValueChangeListener
// @grant        GM_removeValueChangeListener
// @require      https://cdn.jsdelivr.net/npm/@kudoai/chatgpt.js@latest/dist/chatgpt.min.js
// ==/UserScript==
(function() {
    'use strict';

    const chat = (window.ChatGPTUtils && typeof window.ChatGPTUtils.getChatAdapter === 'function')
        ? window.ChatGPTUtils.getChatAdapter()
        : (window.chatgpt || null);

    const safeChat = {
        sendMessage: (...args) => chat && typeof chat.sendMessage === 'function'
            ? chat.sendMessage(...args)
            : Promise.reject(new Error('sendMessage not supported on this site'))
    };

    // Enhanced Configuration with Smart Defaults
    const config = {
        // Core Settings
        maxCharsPerPart: 15000,
        minCharsPerPart: 1000,
        delayBetweenMessages: 1200,
        baseRetryDelay: 1000,
        maxRetries: 3,
        minRetries: 0,
        degradeMaxRetries: 0,
        degradeBaseRetryDelay: 0,
        _persistKeys: ['maxRetries', 'baseRetryDelay'],
        
        // Advanced Features
        preserveCodeBlocks: true,
        smartSplitting: true,
        useProgressBar: true,
        showStats: true,
        
        // File Handling
        maxFileSizeMB: 50,
        allowedFileTypes: [
            '.txt', '.md', '.json', '.js', '.py', '.html', 
            '.css', '.sql', '.xml', '.yaml', '.sh'
        ],
        
        // UI/UX
        theme: {
            light: {
                background: '#ffffff',
                text: '#2c3e50',
                accent: '#3498db'
            },
            dark: {
                background: '#1a1a1a',
                text: '#ecf0f1',
                accent: '#3498db'
            }
        },
        
        // Performance
        chunkOverlap: 50,
        maxConcurrentRequests: 2,
        timeoutMs: 30000
    };

    // Smart Text Processing Engine
    class TextProcessor {
        static splitText(text) {
            if (!text?.trim()) return [];
            
            // Preserve code blocks
            const codeBlocks = new Map();
            let processedText = text.replace(/```[\s\S]*?```/g, (match, index) => {
                const placeholder = `__CODE_BLOCK_${index}__`;
                codeBlocks.set(placeholder, match);
                return placeholder;
            });

            // Smart splitting considering sentence boundaries
            const chunks = [];
            let currentChunk = '';
            const sentences = processedText.match(/[^.!?]+[.!?]+|\s*[^.!?\s]+(?:[.!?]|\s*$)|[^\n]+/g) || [];

            for (const sentence of sentences) {
                if ((currentChunk + sentence).length <= config.maxCharsPerPart) {
                    currentChunk += sentence;
                } else {
                    if (currentChunk) chunks.push(currentChunk.trim());
                    currentChunk = sentence;
                }
            }
            if (currentChunk) chunks.push(currentChunk.trim());

            // Restore code blocks
            return chunks.map(chunk => {
                let restoredChunk = chunk;
                codeBlocks.forEach((code, placeholder) => {
                    restoredChunk = restoredChunk.replace(placeholder, code);
                });
                return restoredChunk;
            });
        }
    }

    // Enhanced UI Manager
    class UIManager {
        _storageRead(key, fallback) {
            try { return GM_getValue(key, fallback); } catch { return fallback; }
        }
        _storageWrite(key, value) {
            try { GM_setValue(key, value); } catch {}
        }
        constructor() {
            this.container = null;
            this.progressBar = null;
            this.stats = null;
            this.statusLine = null;
            this.pauseBtn = null;
            this.fallbackBtn = null;
            this.paused = false;
            this.settingsRow = null;
            this.retryInput = null;
            this.delayInput = null;
            this.initializeUI();
        }

        initializeUI() {
            this.createContainer();
            this.createFileUploader();
            this.createProgressBar();
            this.createStats();
            this.createControls();
            this.registerCommands();
        }

        createContainer() {
            try {
                const persistedMaxRetries = this._storageRead('ps_maxRetries', null);
                const persistedBaseDelay = this._storageRead('ps_baseRetryDelay', null);
                if (Number.isFinite(persistedMaxRetries)) config.maxRetries = Math.max(0, persistedMaxRetries);
                if (Number.isFinite(persistedBaseDelay) && persistedBaseDelay >= 0) config.baseRetryDelay = persistedBaseDelay;
                if (this.retryInput) {
                    this.retryInput.value = String(config.maxRetries);
                    this.delayInput.value = String(config.baseRetryDelay);
                }
            } catch {}
            const styles = `
                .prompt-splitter-container {
                    position: fixed;
                    bottom: 20px;
                    right: 20px;
                    z-index: 9999;
                    background: ${this.isDarkMode() ? config.theme.dark.background : config.theme.light.background};
                    color: ${this.isDarkMode() ? config.theme.dark.text : config.theme.light.text};
                    padding: 15px;
                    border-radius: 12px;
                    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
                    transition: all 0.3s ease;
                    max-width: 420px;
                }
                .ps-row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
                .ps-btn {
                    background: ${this.isDarkMode() ? '#2c2c2c' : '#f4f4f4'};
                    border: 1px solid ${this.isDarkMode() ? '#3a3a3a' : '#d0d0d0'};
                    color: inherit;
                    padding: 6px 10px;
                    border-radius: 8px;
                    cursor: pointer;
                    font-size: 12px;
                }
                .ps-btn:hover { filter: brightness(0.95); }
                .ps-status { font-size: 12px; opacity: 0.85; }
                .ps-progress { height: 6px; border-radius: 3px; background: rgba(128,128,128,0.25); overflow: hidden; margin-top: 8px; }
                .ps-progress > div { height: 100%; width: 0%; background: ${config.theme.dark.accent}; transition: width 0.2s ease; }
            `;
            GM_addStyle(styles);
            
            this.container = document.createElement('div');
            this.container.className = 'prompt-splitter-container';
            document.body.appendChild(this.container);
        }

        isDarkMode() {
            return window.matchMedia('(prefers-color-scheme: dark)').matches;
        }

        createControls() {
            if (!this.container) return;

            const statusRow = document.createElement('div');
            statusRow.className = 'ps-row';
            statusRow.style.marginTop = '8px';

            this.statusLine = document.createElement('div');
            this.statusLine.className = 'ps-status';
            this.statusLine.textContent = 'Ready';

            this.pauseBtn = document.createElement('button');
            this.pauseBtn.className = 'ps-btn';
            this.pauseBtn.textContent = '⏸ Pause';
            this.pauseBtn.type = 'button';
            this.pauseBtn.setAttribute('aria-label', 'Pause sending');
            this.pauseBtn.addEventListener('click', () => {
                this.paused = !this.paused;
                this.pauseBtn.textContent = this.paused ? '▶ Resume' : '⏸ Pause';
                this.statusLine.textContent = this.paused ? 'Paused' : 'Sending…';
                EventBus && EventBus.emit('promptSplitter:paused', { paused: this.paused });
            });

            this.fallbackBtn = document.createElement('button');
            this.fallbackBtn.className = 'ps-btn';
            this.fallbackBtn.textContent = '📋 Copy remaining';
            this.fallbackBtn.type = 'button';
            this.fallbackBtn.setAttribute('aria-label', 'Copy remaining prompt to clipboard');
            this.fallbackBtn.style.display = 'none';
            this.fallbackBtn.addEventListener('click', () => {
                const textarea = document.querySelector('textarea[data-testid="prompt-textarea"]') || document.querySelector('textarea');
                const text = textarea ? textarea.value : '';
                if (!text) return;
                GM_setClipboard(text);
                toast && toast('success', 'Remaining prompt copied to clipboard');
                this.statusLine.textContent = 'Copied remaining text';
            });

            statusRow.appendChild(this.statusLine);
            statusRow.appendChild(this.pauseBtn);
            statusRow.appendChild(this.fallbackBtn);
            this.container.appendChild(statusRow);

            this.progressWrap = document.createElement('div');
            this.progressWrap.className = 'ps-progress';
            this.progressWrap.setAttribute('role', 'progressbar');
            this.progressWrap.setAttribute('aria-valuemin', '0');
            this.progressWrap.setAttribute('aria-valuemax', '100');
            this.progressWrap.setAttribute('aria-valuenow', '0');
            this.progressWrap.innerHTML = '<div></div>';
            this.container.appendChild(this.progressWrap);

            this.settingsRow = document.createElement('div');
            this.settingsRow.className = 'ps-row';
            this.settingsRow.style.marginTop = '8px';

            this.retryInput = document.createElement('input');
            this.retryInput.type = 'number';
            this.retryInput.className = 'ps-btn';
            this.retryInput.value = String(config.maxRetries);
            this.retryInput.title = 'Max retries';
            this.retryInput.setAttribute('aria-label', 'Max retries');
            this.retryInput.style.width = '64px';
            this.retryInput.addEventListener('change', () => this.applySettings());

            this.delayInput = document.createElement('input');
            this.delayInput.type = 'number';
            this.delayInput.className = 'ps-btn';
            this.delayInput.value = String(config.baseRetryDelay);
            this.delayInput.title = 'Base retry delay ms';
            this.delayInput.setAttribute('aria-label', 'Base retry delay ms');
            this.delayInput.style.width = '88px';
            this.delayInput.addEventListener('change', () => this.applySettings());

            const applyBtn = document.createElement('button');
            applyBtn.className = 'ps-btn';
            applyBtn.textContent = 'Apply';
            applyBtn.type = 'button';
            applyBtn.setAttribute('aria-label', 'Apply send settings');
            applyBtn.addEventListener('click', () => {
                this.applySettings();
                toast && toast('info', 'Prompt splitter settings applied');
            });

            this.settingsRow.appendChild(this.retryInput);
            this.settingsRow.appendChild(this.delayInput);
            this.settingsRow.appendChild(applyBtn);
            this.container.appendChild(this.settingsRow);
        }

        setProgress(current, total) {
            if (!this.progressWrap) return;
            const pct = total > 0 ? Math.round((current / total) * 100) : 0;
            const bar = this.progressWrap.querySelector('div');
            if (bar) bar.style.width = pct + '%';
            this.progressWrap.setAttribute('aria-valuenow', String(pct));
            this.statusLine.textContent = `Sending ${current}/${total}`;
        }

        setRetryStatus(attempt, maxRetries, delayMs) {
            this.statusLine.textContent = `Retry ${attempt}/${maxRetries} in ${delayMs}ms`;
        }

        showFallback() {
            if (this.fallbackBtn) this.fallbackBtn.style.display = 'inline-block';
        }

        hideFallback() {
            if (this.fallbackBtn) this.fallbackBtn.style.display = 'none';
        }

        resetToReady() {
            if (this.pauseBtn) this.pauseBtn.textContent = '⏸ Pause';
            if (this.statusLine) this.statusLine.textContent = 'Ready';
            if (this.progressWrap) {
                const bar = this.progressWrap.querySelector('div');
                if (bar) bar.style.width = '0%';
                this.progressWrap.setAttribute('aria-valuenow', '0');
            }
            this.paused = false;
            this.hideFallback();
        }

        applySettings() {
            const parsedRetries = parseInt(this.retryInput.value, 10);
            const parsedDelay = parseInt(this.delayInput.value, 10);
            const nextMaxRetries = Number.isFinite(parsedRetries) && parsedRetries >= 0 ? parsedRetries : config.maxRetries;
            const nextBaseDelay = Number.isFinite(parsedDelay) && parsedDelay >= 0 ? parsedDelay : config.baseRetryDelay;
            config.maxRetries = nextMaxRetries;
            config.baseRetryDelay = nextBaseDelay;
            this.retryInput.value = String(config.maxRetries);
            this.delayInput.value = String(config.baseRetryDelay);
            try {
                GM_setValue('ps_maxRetries', config.maxRetries);
                GM_setValue('ps_baseRetryDelay', config.baseRetryDelay);
            } catch {}
        }
    }

    // Message Handler
    class MessageHandler {
        static async sendMessages(chunks, ui) {
            const results = [];
            const total = chunks.length;
            const helper = window.promptSplitterRetry;

            for (let i = 0; i < total; i++) {
                ui.hideFallback();
                ui.setProgress(i + 1, total);

                const outcome = await helper.execute(
                    async (attempt, meta) => {
                        const current = i + 1;
                        const message = chunks[i];
                        return this.sendWithRetry(message, current, total);
                    },
                    {
                        maxRetries: config.maxRetries,
                        minRetries: config.minRetries,
                        baseDelay: config.baseRetryDelay,
                        degradeMaxRetries: config.degradeMaxRetries,
                        degradeBaseDelay: config.degradeBaseRetryDelay,
                        ui
                    }
                );

                if (!outcome.success) {
                    ui.showFallback();
                    throw new Error(`Failed to send part ${i + 1}/${total}: ${outcome.error && outcome.error.message}`);
                }
                results.push(outcome.result);
            }

            return results;
        }

        static async sendWithRetry(message, current, total) {
            const formattedMessage = `[Part ${current}/${total}]\n\n${message}`;
            return safeChat.sendMessage(formattedMessage);
        }
    }

    // Initialize the application
    const initialize = () => {
        const ui = new UIManager();
        
        // Register main command
        GM_registerMenuCommand('Split and Send Prompt', async () => {
            const text = prompt('Enter your prompt to split and send:');
            if (!text) return;
            
            if (ui.paused) ui.paused = false;
            ui.resetToReady();
            ui.applySettings();
            ui.hideFallback();
            if (ui.statusLine) ui.statusLine.textContent = 'Sending…';

            const chunks = TextProcessor.splitText(text);
            try {
                await MessageHandler.sendMessages(chunks, ui);
                ui.statusLine.textContent = 'Done';
                ui.resetToReady();
            } catch (e) {
                console.warn('[PromptSplitter]', e);
                ui.statusLine.textContent = 'Stopped';
                GM_notification && GM_notification('Prompt sending stopped. Use Copy remaining to recover.', 'Prompt Splitter');
            }
        });
    };

    // Start the application
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialize);
    } else {
        initialize();
    }
})();
