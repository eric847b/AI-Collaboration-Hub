// ==UserScript==
// @name         Response Streamer
// @version      2026.06.26.1
// @description  SSE streaming support for OpenAI/Anthropic API responses
// @author       AI Chat Userscript Studio
// @match        https://chat.openai.com/*
// @match        https://chatgpt.com/*
// @match        https://claude.ai/*
// @match        https://poe.com/*
// @match        https://www.perplexity.ai/*
// @match        https://perplexity.ai/*
// @match        https://pi.ai/*
// @match        https://you.com/*
// @match        https://gemini.google.com/*
// @match        https://aistudio.google.com/*
// @match        https://copilot.microsoft.com/*
// @match        https://chat.mistral.ai/*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_log
// @run-at       document-idle
// ==/UserScript==

(function() {
    'use strict';

    const MODULE_ID = 'module-103';
    const MODULE_NAME = 'Response Streamer';
    const MODULE_VERSION = '2026.06.26.1';

    class ResponseStreamer {
        constructor() {
            this.dependencies = [];
            this.critical = false;
            this.name = MODULE_NAME;
            this.version = MODULE_VERSION;
            this.config = {
                enabled: true,
                endpoint: null,
                stream: true
            };
            this.state = {
                initialized: false
            };
        }

        init() {
            this.loadConfig();
            this.exposeAPI();
            this.state.initialized = true;
            console.log(`[${MODULE_ID}] ${MODULE_NAME} v${MODULE_VERSION} initialized`);
            return true;
        }

        async streamOpenAIResponse(messages, options = {}) {
            const opts = { ...this.config, ...options };
            const url = opts.endpoint || 'https://api.openai.com/v1/chat/completions';

            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${opts.apiKey || ''}`
                },
                body: JSON.stringify({
                    model: opts.model || 'gpt-4',
                    messages,
                    stream: true
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            return this.parseSSEStream(response);
        }

        async streamAnthropicResponse(messages, options = {}) {
            const opts = { ...this.config, ...options };
            const url = opts.endpoint || 'https://api.anthropic.com/v1/messages';

            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': opts.apiKey || '',
                    'anthropic-version': '2023-06-01'
                },
                body: JSON.stringify({
                    model: opts.model || 'claude-3-opus-20240229',
                    messages,
                    stream: true
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            return this.parseSSEStream(response);
        }

        async *parseSSEStream(response) {
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const data = line.slice(6);
                        if (data === '[DONE]') return;

                        try {
                            const json = JSON.parse(data);
                            const content = json.choices?.[0]?.delta?.content || json.delta?.text;
                            if (content) yield content;
                        } catch (e) {
                            // Skip non-JSON lines
                        }
                    }
                }
            }
        }

        async collectStream(generator) {
            let fullResponse = '';
            for await (const chunk of generator) {
                fullResponse += chunk;
            }
            return fullResponse;
        }

        loadConfig() {
            try {
                if (typeof GM_getValue === 'function') {
                    const stored = GM_getValue(MODULE_ID + '_config', null);
                    if (stored) {
                        this.config = { ...this.config, ...stored };
                    }
                }
            } catch (e) {
                console.warn(`[${MODULE_ID}] Failed to load config:`, e);
            }
        }

        saveConfig() {
            try {
                if (typeof GM_setValue === 'function') {
                    GM_setValue(MODULE_ID + '_config', this.config);
                }
            } catch (e) {
                console.warn(`[${MODULE_ID}] Failed to save config:`, e);
            }
        }

        setConfig(newConfig) {
            this.config = { ...this.config, ...newConfig };
            this.saveConfig();
        }

        getConfig() {
            return { ...this.config };
        }

        exposeAPI() {
            window.ResponseStreamer = {
                streamOpenAIResponse: (m, o) => this.streamOpenAIResponse(m, o),
                streamAnthropicResponse: (m, o) => this.streamAnthropicResponse(m, o),
                collectStream: (g) => this.collectStream(g),
                setConfig: (c) => this.setConfig(c),
                getConfig: () => this.getConfig(),
                init: () => this.init(),
                destroy: () => this.destroy()
            };
        }

        destroy() {
            if (window.ResponseStreamer) {
                delete window.ResponseStreamer;
            }
            this.state.initialized = false;
        }
    }

    // Register with ModuleRegistry
    const instance = new ResponseStreamer();
    window.ModuleRegistry && window.ModuleRegistry.register(instance);

    // Initialize
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => instance.init());
    } else {
        instance.init();
    }

    window.addEventListener('beforeunload', () => instance.destroy());
})();