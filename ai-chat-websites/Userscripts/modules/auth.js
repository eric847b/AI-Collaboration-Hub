/**
 * Unified AI Assistant Suite - Authentication & Security Module
 * @version 1.3.0
 */

// Get dependencies from global UnifiedSuite object
const CONFIG = (typeof window !== 'undefined' && window.UnifiedSuite?.CONFIG) || {};
const state = (typeof window !== 'undefined' && window.UnifiedSuite?.state) || {};
const updateState = (typeof window !== 'undefined' && window.UnifiedSuite?.updateState) || (() => {});
const debugLog = (typeof window !== 'undefined' && window.UnifiedSuite?.debugLog) || (() => {});
const sanitizeText = (typeof window !== 'undefined' && window.UnifiedSuite?.sanitizeText) || ((text) => String(text ?? '').trim());

/**
 * Auth & Security Module
 */
const AuthModule = {
    /**
     * Test API connection
     * @param {string} provider - Provider name
     * @param {string} apiKey - API key
     * @returns {Promise<{success: boolean, message: string}>} Test result
     */
    async testConnection(provider, apiKey) {
        if (!apiKey) {
            return { success: false, message: 'API key is required' };
        }

        try {
            switch (provider) {
                case 'OPENAI':
                    return await this.testOpenAI(apiKey);
                case 'ANTHROPIC':
                    return await this.testAnthropic(apiKey);
                case 'GEMINI':
                    return await this.testGemini(apiKey);
                case 'OLLAMA':
                    return await this.testOllama(apiKey);
                default:
                    return { success: false, message: 'Unknown provider' };
            }
        } catch (error) {
            return { success: false, message: error.message };
        }
    },

    /**
     * Test OpenAI connection
     * @param {string} apiKey - API key
     * @returns {Promise<{success: boolean, message: string}>} Test result
     */
    async testOpenAI(apiKey) {
        try {
            const response = await new Promise((resolve, reject) => {
                GM_xmlhttpRequest({
                    url: 'https://api.openai.com/v1/models',
                    method: 'GET',
                    headers: { Authorization: `Bearer ${apiKey}` },
                    timeout: CONFIG.NETWORK_TIMEOUT,
                    onload: (res) => resolve(res),
                    onerror: () => reject(new Error('Network request failed')),
                    ontimeout: () => reject(new Error('Request timed out'))
                });
            });

            if (response.status >= 200 && response.status < 300) {
                const data = JSON.parse(response.responseText);
                const modelCount = data?.data?.length || 0;
                return { success: true, message: `Connected (${modelCount} models available)` };
            }

            const error = JSON.parse(response.responseText);
            return { success: false, message: error?.error?.message || `HTTP ${response.status}` };
        } catch (error) {
            return { success: false, message: error.message };
        }
    },

    /**
     * Test Anthropic connection
     * @param {string} apiKey - API key
     * @returns {Promise<{success: boolean, message: string}>} Test result
     */
    async testAnthropic(apiKey) {
        try {
            const response = await new Promise((resolve, reject) => {
                GM_xmlhttpRequest({
                    url: 'https://api.anthropic.com/v1/messages',
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'x-api-key': apiKey,
                        'anthropic-version': '2023-06-01'
                    },
                    data: JSON.stringify({
                        model: CONFIG.AI_PROVIDERS.ANTHROPIC.model,
                        max_tokens: 1,
                        messages: [{ role: 'user', content: 'Hi' }]
                    }),
                    timeout: CONFIG.NETWORK_TIMEOUT,
                    onload: (res) => resolve(res),
                    onerror: () => reject(new Error('Network request failed')),
                    ontimeout: () => reject(new Error('Request timed out'))
                });
            });

            if (response.status >= 200 && response.status < 300) {
                return { success: true, message: 'Connected' };
            }

            const error = JSON.parse(response.responseText);
            return { success: false, message: error?.error?.message || `HTTP ${response.status}` };
        } catch (error) {
            return { success: false, message: error.message };
        }
    },

    /**
     * Test Gemini connection
     * @param {string} apiKey - API key
     * @returns {Promise<{success: boolean, message: string}>} Test result
     */
    async testGemini(apiKey) {
        try {
            const url = `${CONFIG.AI_PROVIDERS.GEMINI.endpoint}?key=${apiKey}`;
            const response = await new Promise((resolve, reject) => {
                GM_xmlhttpRequest({
                    url,
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    data: JSON.stringify({
                        contents: [{ parts: [{ text: 'Hi' }] }],
                        generationConfig: { maxOutputTokens: 1 }
                    }),
                    timeout: CONFIG.NETWORK_TIMEOUT,
                    onload: (res) => resolve(res),
                    onerror: () => reject(new Error('Network request failed')),
                    ontimeout: () => reject(new Error('Request timed out'))
                });
            });

            if (response.status >= 200 && response.status < 300) {
                return { success: true, message: 'Connected' };
            }

            const error = JSON.parse(response.responseText);
            return { success: false, message: error?.error?.message || `HTTP ${response.status}` };
        } catch (error) {
            return { success: false, message: error.message };
        }
    },

    /**
     * Test Ollama connection
     * @param {string} apiKey - API key (not used for Ollama)
     * @returns {Promise<{success: boolean, message: string}>} Test result
     */
    async testOllama(apiKey) {
        try {
            const response = await new Promise((resolve, reject) => {
                GM_xmlhttpRequest({
                    url: CONFIG.AI_PROVIDERS.OLLAMA.endpoint.replace('/generate', '/tags'),
                    method: 'GET',
                    timeout: CONFIG.NETWORK_TIMEOUT,
                    onload: (res) => resolve(res),
                    onerror: () => reject(new Error('Network request failed')),
                    ontimeout: () => reject(new Error('Request timed out'))
                });
            });

            if (response.status >= 200 && response.status < 300) {
                const data = JSON.parse(response.responseText);
                const modelCount = data?.models?.length || 0;
                return { success: true, message: `Connected (${modelCount} models available)` };
            }

            return { success: false, message: `HTTP ${response.status}` };
        } catch (error) {
            return { success: false, message: error.message };
        }
    },

    /**
     * Get masked API key (last 4 chars)
     * @param {string} apiKey - API key
     * @returns {string} Masked key
     */
    maskApiKey(apiKey) {
        if (!apiKey || apiKey.length < 8) return '****';
        return '••••' + apiKey.slice(-4);
    },

    /**
     * Get API key fingerprint (last 4 chars)
     * @param {string} apiKey - API key
     * @returns {string} Key fingerprint
     */
    getKeyFingerprint(apiKey) {
        if (!apiKey || apiKey.length < 4) return 'N/A';
        return apiKey.slice(-4);
    },

    /**
     * Validate API key format
     * @param {string} apiKey - API key
     * @param {string} provider - Provider name
     * @returns {boolean} Is valid
     */
    validateApiKeyFormat(apiKey, provider) {
        if (!apiKey) return false;
        
        switch (provider) {
            case 'OPENAI':
                return apiKey.startsWith('sk-') && apiKey.length >= 20;
            case 'ANTHROPIC':
                return apiKey.startsWith('sk-ant-') || apiKey.startsWith('sk-');
            case 'GEMINI':
                return apiKey.length >= 20;
            default:
                return apiKey.length >= 8;
        }
    },

    /**
     * Clear session data
     */
    clearSession() {
        updateState('apiKey', '');
        try {
            sessionStorage.removeItem(CONFIG.STORAGE_KEYS.sessionApiKey);
        } catch (error) {
            debugLog('Failed to clear session', error);
        }
    },

    /**
     * Initialize module
     * @returns {Object} Module interface
     */
    init() {
        debugLog('Authentication & Security module initialized');
        return {
            isSessionValid: () => true,
            authenticateUser: () => Promise.resolve(true),
            refreshSessionToken: () => Promise.resolve(true),
            clearSession: () => this.clearSession()
        };
    }
};

// Export for module system
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { AuthModule };
}

// Export for userscript context
if (typeof window !== 'undefined') {
    window.UnifiedSuite.auth = AuthModule;
}