/**
 * Unified AI Assistant Suite - AI Providers Module
 * @version 1.3.0
 */

/**
 * @typedef {Object} ProviderResponse
 * @property {string} content - Generated content
 * @property {string} provider - Provider name
 * @property {number} timestamp - Response timestamp
 */

// Get dependencies from global UnifiedSuite object
const CONFIG = (typeof window !== 'undefined' && window.UnifiedSuite?.CONFIG) || {};
const state = (typeof window !== 'undefined' && window.UnifiedSuite?.state) || {};
const debugLog = (typeof window !== 'undefined' && window.UnifiedSuite?.debugLog) || (() => {});
const sanitizeText = (typeof window !== 'undefined' && window.UnifiedSuite?.sanitizeText) || ((text) => String(text ?? '').trim());

/**
 * Fetch JSON with retry logic
 * @param {string} url - URL to fetch
 * @param {Object} options - Fetch options
 * @returns {Promise<Object>} JSON response
 */
async function fetchJson(url, options) {
    return new Promise((resolve, reject) => {
        GM_xmlhttpRequest({
            url,
            method: options.method || 'GET',
            headers: options.headers || {},
            data: options.body,
            responseType: 'json',
            timeout: CONFIG.NETWORK_TIMEOUT,
            onload: (response) => {
                const data = response.response || (() => { try { return JSON.parse(response.responseText); } catch { return null; } })();
                if (response.status < 200 || response.status >= 300) {
                    const message = data?.error?.message || response.statusText || `HTTP ${response.status}`;
                    reject(new Error(message));
                    return;
                }
                resolve(data);
            },
            onerror: () => reject(new Error('Network request failed')),
            ontimeout: () => reject(new Error('Network request timed out'))
        });
    });
}

/**
 * Fetch with streaming support
 * @param {string} url - URL to fetch
 * @param {Object} options - Fetch options
 * @param {function} onChunk - Chunk callback
 * @param {AbortSignal} signal - Abort signal
 * @returns {Promise<string>} Streamed content
 */
async function fetchJsonStream(url, options, onChunk, signal) {
    return new Promise((resolve, reject) => {
        let fullText = '';
        state.streamController = { signal };
        
        const xhr = GM_xmlhttpRequest({
            url,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            },
            data: JSON.stringify(options.body),
            responseType: 'text',
            timeout: CONFIG.NETWORK_TIMEOUT,
            onload: (response) => {
                state.streamController = null;
                try {
                    const text = response.responseText;
                    if (!text) {
                        reject(new Error('Empty streaming response'));
                        return;
                    }
                    const json = JSON.parse(text);
                    const content = extractStreamContent(json);
                    if (!content) {
                        reject(new Error('No content in streaming response'));
                        return;
                    }
                    resolve(content);
                } catch (error) {
                    reject(error);
                }
            },
            onerror: () => {
                state.streamController = null;
                reject(new Error('Network request failed'));
            },
            ontimeout: () => {
                state.streamController = null;
                reject(new Error('Network request timed out'));
            },
            onprogress: (response) => {
                if (signal?.aborted) {
                    xhr.abort();
                    reject(new Error('Streaming cancelled'));
                    return;
                }
                const chunk = response.responseText;
                if (chunk && onChunk) {
                    const delta = extractStreamDelta(chunk, fullText);
                    if (delta) onChunk(delta);
                    fullText = chunk;
                }
            }
        });
    });
}

/**
 * Extract stream delta from chunk
 * @param {string} chunk - Response chunk
 * @param {string} previousText - Previous text
 * @returns {string|null} Delta text
 */
function extractStreamDelta(chunk, previousText) {
    const deltaMatch = chunk.match(/"delta"\s*:\s*"((?:[^"\\]|\\.)*)"/);
    if (!deltaMatch) return null;
    
    let delta = deltaMatch[1].replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\t/g, '\t');
    
    if (previousText.length >= chunk.length) return null;
    const newChars = chunk.slice(previousText.length);
    const contentMatch = newChars.match(/"content"\s*:\s*"((?:[^"\\]|\\.)*)"/);
    if (contentMatch) {
        delta = contentMatch[1].replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\t/g, '\t');
    }
    
    return delta;
}

/**
 * Extract content from stream response
 * @param {Object} fullResponse - Full response object
 * @returns {string|null} Extracted content
 */
function extractStreamContent(fullResponse) {
    try {
        const choices = fullResponse?.choices;
        if (Array.isArray(choices) && choices[0]?.delta?.content) {
            return choices[0].delta.content;
        }
        const contentArr = fullResponse?.content;
        if (Array.isArray(contentArr)) {
            const textBlock = contentArr.find(item => item?.type === 'text' && item?.text);
            if (textBlock?.text) return textBlock.text;
        }
        if (fullResponse?.completion) return fullResponse.completion;
    } catch (error) {
        debugLog('Failed to extract stream content', error);
    }
    return null;
}

/**
 * Retry with exponential backoff
 * @param {function} fn - Function to retry
 * @param {number} maxRetries - Maximum retries
 * @param {number} baseDelay - Base delay in ms
 * @returns {Promise<*>} Result
 */
async function withRetry(fn, maxRetries = CONFIG.RETRY.maxRetries, baseDelay = CONFIG.RETRY.baseDelay) {
    let lastError;
    let totalTime = 0;
    const startTime = Date.now();
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error;
            totalTime = Date.now() - startTime;
            
            if (attempt < maxRetries && totalTime < CONFIG.RETRY.maxTotalTime) {
                const delay = baseDelay * Math.pow(CONFIG.RETRY.backoffFactor, attempt);
                debugLog(`Retry attempt ${attempt + 1}/${maxRetries} after ${delay}ms, error:`, error.message);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }
    
    throw lastError;
}

/**
 * AI Providers Module
 */
const ProvidersModule = {
    /**
     * Generate script with specified provider
     * @param {string} provider - Provider name
     * @param {string} prompt - User prompt
     * @param {function} onStreamChunk - Stream callback
     * @returns {Promise<ProviderResponse>} Generated content
     */
    async generateWithProvider(provider, prompt, onStreamChunk) {
        switch (provider) {
            case 'OPENAI':
                return this.generateWithOpenAI(prompt, onStreamChunk);
            case 'ANTHROPIC':
                return this.generateWithAnthropic(prompt, onStreamChunk);
            case 'GEMINI':
                return this.generateWithGemini(prompt, onStreamChunk);
            case 'OLLAMA':
                return this.generateWithOllama(prompt);
            case 'LOCAL':
                return this.generateWithLocalAI(prompt);
            default:
                throw new Error(`Unknown AI provider: ${provider}`);
        }
    },

    /**
     * Generate with OpenAI
     * @param {string} prompt - User prompt
     * @param {function} onStreamChunk - Stream callback
     * @returns {Promise<ProviderResponse>} Generated content
     */
    async generateWithOpenAI(prompt, onStreamChunk) {
        if (!state.apiKey) throw new Error('OpenAI API key not configured');
        
        const systemPrompt = 'You are an expert userscript developer. Return only a complete, working userscript with metadata, error handling, and clear structure.';
        
        if (state.config.enableStreaming && onStreamChunk) {
            try {
                const controller = new AbortController();
                state.streamController = controller;
                
                const content = await fetchJsonStream(
                    CONFIG.AI_PROVIDERS.OPENAI.endpoint,
                    {
                        headers: {
                            'Content-Type': 'application/json',
                            Authorization: `Bearer ${state.apiKey}`
                        },
                        body: {
                            model: CONFIG.AI_PROVIDERS.OPENAI.model,
                            messages: [
                                { role: 'system', content: systemPrompt },
                                { role: 'user', content: prompt }
                            ],
                            max_tokens: 4000,
                            temperature: 0.7,
                            stream: true
                        }
                    },
                    onStreamChunk,
                    controller.signal
                );
                
                return { content, provider: 'OPENAI', timestamp: Date.now() };
            } catch (streamError) {
                console.warn('[Unified Suite] Streaming failed, falling back to non-streaming:', streamError);
                if (state.streamController?.signal?.aborted) throw streamError;
            } finally {
                state.streamController = null;
            }
        }
        
        const data = await fetchJson(CONFIG.AI_PROVIDERS.OPENAI.endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${state.apiKey}`
            },
            body: JSON.stringify({
                model: CONFIG.AI_PROVIDERS.OPENAI.model,
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: prompt }
                ],
                max_tokens: 4000,
                temperature: 0.7
            })
        });
        
        const content = data?.choices?.[0]?.message?.content;
        if (!content) throw new Error('OpenAI returned no script content');
        
        return { content, provider: 'OPENAI', timestamp: Date.now() };
    },

    /**
     * Generate with Anthropic
     * @param {string} prompt - User prompt
     * @param {function} onStreamChunk - Stream callback
     * @returns {Promise<ProviderResponse>} Generated content
     */
    async generateWithAnthropic(prompt, onStreamChunk) {
        if (!state.apiKey) throw new Error('Anthropic API key not configured');
        
        if (state.config.enableStreaming && onStreamChunk) {
            try {
                const controller = new AbortController();
                state.streamController = controller;
                
                const content = await fetchJsonStream(
                    CONFIG.AI_PROVIDERS.ANTHROPIC.endpoint,
                    {
                        headers: {
                            'Content-Type': 'application/json',
                            'x-api-key': state.apiKey,
                            'anthropic-version': '2023-06-01'
                        },
                        body: {
                            model: CONFIG.AI_PROVIDERS.ANTHROPIC.model,
                            max_tokens: 4000,
                            messages: [{ role: 'user', content: prompt }],
                            stream: true
                        }
                    },
                    onStreamChunk,
                    controller.signal
                );
                
                return { content, provider: 'ANTHROPIC', timestamp: Date.now() };
            } catch (streamError) {
                console.warn('[Unified Suite] Streaming failed, falling back to non-streaming:', streamError);
                if (state.streamController?.signal?.aborted) throw streamError;
            } finally {
                state.streamController = null;
            }
        }
        
        const data = await fetchJson(CONFIG.AI_PROVIDERS.ANTHROPIC.endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': state.apiKey,
                'anthropic-version': '2023-06-01'
            },
            body: JSON.stringify({
                model: CONFIG.AI_PROVIDERS.ANTHROPIC.model,
                max_tokens: 4000,
                messages: [{ role: 'user', content: prompt }]
            })
        });
        
        const textBlock = Array.isArray(data?.content) 
            ? data.content.find((item) => item?.type === 'text' && item?.text) 
            : null;
        if (!textBlock?.text) throw new Error('Anthropic returned no script content');
        
        return { content: textBlock.text, provider: 'ANTHROPIC', timestamp: Date.now() };
    },

    /**
     * Generate with Google Gemini
     * @param {string} prompt - User prompt
     * @param {function} onStreamChunk - Stream callback
     * @returns {Promise<ProviderResponse>} Generated content
     */
    async generateWithGemini(prompt, onStreamChunk) {
        if (!state.apiKey) throw new Error('Gemini API key not configured');
        
        const apiKey = state.apiKey;
        const url = `${CONFIG.AI_PROVIDERS.GEMINI.endpoint}?key=${apiKey}`;
        
        const data = await fetchJson(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: {
                    temperature: 0.7,
                    maxOutputTokens: 4000
                }
            })
        });
        
        const content = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!content) throw new Error('Gemini returned no script content');
        
        return { content, provider: 'GEMINI', timestamp: Date.now() };
    },

    /**
     * Generate with Ollama (local)
     * @param {string} prompt - User prompt
     * @returns {Promise<ProviderResponse>} Generated content
     */
    async generateWithOllama(prompt) {
        if (!state.apiKey) throw new Error('Ollama API key not configured');
        
        const data = await fetchJson(CONFIG.AI_PROVIDERS.OLLAMA.endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: CONFIG.AI_PROVIDERS.OLLAMA.model,
                prompt: `You are an expert userscript developer. Return only a complete, working userscript with metadata.\n\n${prompt}`,
                stream: false
            })
        });
        
        const content = data?.response;
        if (!content) throw new Error('Ollama returned no script content');
        
        return { content, provider: 'OLLAMA', timestamp: Date.now() };
    },

    /**
     * Generate with local AI (fallback)
     * @param {string} prompt - User prompt
     * @returns {Promise<ProviderResponse>} Generated content
     */
    async generateWithLocalAI(prompt) {
        return {
            content: `// ==UserScript==\n// @name         Generated Assistant Script\n// @namespace    http://tampermonkey.net/\n// @version      1.0.0\n// @description  Auto-generated from prompt\n// @match        *://*/*\n// @grant        none\n// @run-at       document-end\n// ==/UserScript==\n\n(function() {\n    'use strict';\n    console.info('Generated Assistant Script is active.');\n    // TODO: Implement based on: ${sanitizeText(prompt).slice(0, 100)}\n})();`,
            provider: 'LOCAL',
            timestamp: Date.now()
        };
    }
};

// Export for module system
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { ProvidersModule };
}

// Export for userscript context
if (typeof window !== 'undefined') {
    window.UnifiedSuite.providers = ProvidersModule;
}