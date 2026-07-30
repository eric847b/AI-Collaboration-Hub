/**
 * Unified AI Assistant Suite - Configuration Module
 * @version 1.3.0
 */

/**
 * @typedef {Object} RetryConfig
 * @property {number} maxRetries - Maximum retry attempts
 * @property {number} baseDelay - Base delay in milliseconds
 * @property {number} maxTotalTime - Maximum total retry time in milliseconds
 * @property {number} backoffFactor - Exponential backoff multiplier
 */

/**
 * @typedef {Object} AIProviderConfig
 * @property {string} endpoint - API endpoint URL
 * @property {string} model - Model identifier
 */

/**
 * @typedef {Object} StorageKeys
 * @property {string} history - Generated scripts history key
 * @property {string} settings - User settings key
 * @property {string} sessionApiKey - Session API key
 * @property {string} versions - Script versions key
 * @property {string} templates - User templates key
 * @property {string} moduleHealth - Module health status key
 */

/**
 * @typedef {Object} SuiteConfig
 * @property {string} VERSION - Suite version
 * @property {boolean} DEBUG_MODE - Debug logging flag
 * @property {number} MAX_SCRIPT_LENGTH - Maximum script length
 * @property {number} MAX_HISTORY_ITEMS - Maximum history items
 * @property {number} NETWORK_TIMEOUT - Network timeout in milliseconds
 * @property {number} MAX_VERSIONS_PER_SCRIPT - Maximum versions per script
 * @property {RetryConfig} RETRY - Retry configuration
 * @property {StorageKeys} STORAGE_KEYS - Storage key names
 * @property {Object.<string, AIProviderConfig>} AI_PROVIDERS - AI provider configs
 * @property {string} UI_ID - UI container ID
 * @property {string} STYLE_ID - Style element ID
 * @property {string} MODULE_REGISTRY - Module registry storage key
 * @property {string[]} EXCLUDED_DOMAINS - Excluded domain list
 */

const CONFIG = {
    VERSION: '1.3.0',
    DEBUG_MODE: false,
    MAX_SCRIPT_LENGTH: 8000,
    MAX_HISTORY_ITEMS: 25,
    NETWORK_TIMEOUT: 60000,
    MAX_VERSIONS_PER_SCRIPT: 10,
    MAX_TEMPLATES: 50,
    RETRY: {
        maxRetries: 5,
        baseDelay: 1000,
        maxTotalTime: 120000,
        backoffFactor: 2
    },
    STORAGE_KEYS: {
        history: 'unified_ai_suite_history',
        settings: 'unified_ai_suite_settings',
        sessionApiKey: 'unified_ai_suite_session_api_key',
        versions: 'unified_ai_suite_versions',
       templates: 'unified_ai_suite_templates',
        moduleHealth: 'unified_ai_suite_module_health'
    },
    AI_PROVIDERS: {
        OPENAI: {
            endpoint: 'https://api.openai.com/v1/chat/completions',
            model: 'gpt-4o'
        },
        ANTHROPIC: {
            endpoint: 'https://api.anthropic.com/v1/messages',
            model: 'claude-3-5-sonnet-20241022'
        },
        GEMINI: {
            endpoint: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent',
            model: 'gemini-pro'
        },
        OLLAMA: {
            endpoint: 'http://localhost:11434/api/generate',
            model: 'llama2'
        }
    },
    UI_ID: 'unified-ai-suite-ui',
    STYLE_ID: 'unified-ai-suite-styles',
    MODULE_REGISTRY: 'unified_ai_suite_modules',
    EXCLUDED_DOMAINS: [
        'google.com', 'google.co.uk', 'google.ca', 'google.au',
        'amazon.com', 'paypal.com', 'bankofamerica.com'
    ]
};

// Export for module system
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { CONFIG };
}

// Export for userscript context
if (typeof window !== 'undefined') {
    window.UnifiedSuite = window.UnifiedSuite || {};
    window.UnifiedSuite.CONFIG = CONFIG;
}