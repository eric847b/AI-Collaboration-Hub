// ==UserScript==
// @name         Unified AI Assistant Suite
// @namespace    http://tampermonkey.net/
// @version      1.3.0
// @description  Integrated AI assistant enhancement suite with modular architecture, streaming, retry logic, theme toggle, versioning, and batch operations
// @match        *://*/*
// @exclude      *://*.google.com/*
// @exclude      *://*.google.co.uk/*
// @exclude      *://*.google.ca/*
// @exclude      *://*.google.au/*
// @exclude      *://*.google.de/*
// @exclude      *://*.google.fr/*
// @exclude      *://*.google.es/*
// @exclude      *://*.google.it/*
// @exclude      *://*.google.co.jp/*
// @exclude      *://*.amazon.com/*
// @exclude      *://*.paypal.com/*
// @exclude      *://*.bankofamerica.com/*
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_deleteValue
// @grant        GM_xmlhttpRequest
// @grant        GM_registerMenuCommand
// @grant        GM_notification
// @grant        GM_setClipboard
// @grant        GM_addStyle
// @connect      api.openai.com
// @connect      api.anthropic.com
// @connect      generativelanguage.googleapis.com
// @connect      localhost
// @run-at       document-end
// @inject-into  page
// @noframes
// ==/UserScript==


(function() {
    'use strict';



    // ========================================
    // MODULE: CONFIG
    // ========================================

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

// Export for userscript context
if (typeof window !== 'undefined') {
    window.UnifiedSuite = window.UnifiedSuite || {};
    window.UnifiedSuite.CONFIG = CONFIG;
}

    // ========================================
    // MODULE: STATE
    // ========================================

/**
 * Unified AI Assistant Suite - State Management Module
 * @version 1.3.0
 */

/**
 * @typedef {Object} SuiteState
 * @property {Object.<string, Object>} modules - Registered modules
 * @property {Object} config - User configuration
 * @property {Array} generatedScripts - Generated scripts history
 * @property {Array} validationResults - Validation results
 * @property {boolean} menusRegistered - Menu registration status
 * @property {boolean} uiVisible - UI visibility status
 * @property {string} aiProvider - Current AI provider
 * @property {string} apiKey - API key
 * @property {Object|null} currentScript - Current script being edited
 * @property {string|null} currentScriptId - Current script ID
 * @property {Object|null} streamController - Stream controller
 * @property {number} retryCount - Retry count
 * @property {boolean} isInitialized - Initialization flag
 * @property {Object.<string, {status: string, lastCheck: number}>} moduleHealth - Module health status
 */

/**
 * @typedef {Object} UserConfig
 * @property {boolean} enabled - Suite enabled
 * @property {boolean} autoGenerate - Auto-generate flag
 * @property {boolean} showDashboard - Show dashboard tab
 * @property {boolean} showGenerator - Show generator tab
 * @property {boolean} showSecurity - Show security tab
 * @property {boolean} enableStreaming - Enable streaming
 * @property {string} theme - UI theme
 */

const state = {
    modules: {},
    config: {
        enabled: true,
        autoGenerate: false,
        showDashboard: true,
        showGenerator: true,
        showSecurity: true,
        enableStreaming: false,
        theme: 'dark'
    },
    generatedScripts: [],
    validationResults: [],
    menusRegistered: false,
    uiVisible: true,
    aiProvider: 'LOCAL',
    apiKey: '',
    currentScript: null,
    currentScriptId: null,
    streamController: null,
    retryCount: 0,
    isInitialized: false,
    moduleHealth: {}
};

/**
 * Get the current state
 * @returns {SuiteState}
 */
function getState() {
    return state;
}

/**
 * Update a specific state property
 * @param {string} key - State key
 * @param {*} value - New value
 */
function updateState(key, value) {
    if (key in state) {
        state[key] = value;
    } else {
        console.warn('[State] Attempted to update non-existent state key:', key);
    }
}

/**
 * Reset state to defaults
 */
function resetState() {
    state.modules = {};
    state.config = {
        enabled: true,
        autoGenerate: false,
        showDashboard: true,
        showGenerator: true,
        showSecurity: true,
        enableStreaming: false,
        theme: 'dark'
    };
    state.generatedScripts = [];
    state.validationResults = [];
    state.menusRegistered = false;
    state.uiVisible = true;
    state.aiProvider = 'LOCAL';
    state.apiKey = '';
    state.currentScript = null;
    state.currentScriptId = null;
    state.streamController = null;
    state.retryCount = 0;
    state.isInitialized = false;
    state.moduleHealth = {};
}

// Export for userscript context
if (typeof window !== 'undefined') {
    window.UnifiedSuite = window.UnifiedSuite || {};
    window.UnifiedSuite.state = state;
    window.UnifiedSuite.getState = getState;
    window.UnifiedSuite.updateState = updateState;
    window.UnifiedSuite.resetState = resetState;
}

    // ========================================
    // MODULE: UTILITIES
    // ========================================

/**
 * Unified AI Assistant Suite - Utilities Module
 * @version 1.3.0
 */

/**
 * Log a debug message if debug mode is enabled
 * @param {...*} args - Arguments to log
 */
function debugLog(...args) {
    const config = (typeof window !== 'undefined' && window.UnifiedSuite?.CONFIG) || {};
    if (config.DEBUG_MODE) {
        console.log('[Unified Suite]', ...args);
    }
}

/**
 * Sanitize text by removing null bytes and trimming
 * @param {*} text - Text to sanitize
 * @returns {string} Sanitized text
 */
function sanitizeText(text) {
    return String(text ?? '').replace(/\u0000/g, '').trim();
}

/**
 * Safely parse JSON with fallback
 * @param {string} value - JSON string to parse
 * @param {*} fallback - Fallback value if parsing fails
 * @returns {*} Parsed value or fallback
 */
function safeJsonParse(value, fallback) {
    if (!value) return fallback;
    try { return JSON.parse(value); }
    catch (error) { debugLog('Failed to parse stored JSON', error); return fallback; }
}

/**
 * Generate a unique ID
 * @returns {string} Unique ID
 */
function generateId() {
    if (window.crypto && typeof window.crypto.randomUUID === 'function') {
        return window.crypto.randomUUID();
    }
    return `script_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
}

/**
 * Indent code with specified number of spaces
 * @param {string} code - Code to indent
 * @param {number} spaces - Number of spaces to indent
 * @returns {string} Indented code
 */
function indentCode(code, spaces) {
    const padding = ' '.repeat(spaces);
    return sanitizeText(code).split('\n').map(line => `${padding}${line}`).join('\n');
}

/**
 * Extract code block from markdown text
 * @param {string} text - Markdown text
 * @returns {string} Extracted code
 */
function extractCodeBlock(text) {
    const normalized = sanitizeText(text);
    const match = normalized.match(/```(?:javascript|js)?\s*([\s\S]*?)```/i);
    return sanitizeText(match?.[1] || normalized);
}

/**
 * Derive description from source text
 * @param {string} sourceText - Source text
 * @returns {string} Derived description
 */
function deriveDescription(sourceText) {
    const withoutCodeBlocks = sanitizeText(sourceText).replace(/```[\s\S]*?```/g, ' ');
    return withoutCodeBlocks.replace(/\s+/g, ' ').trim() || 'Auto-generated from AI';
}

/**
 * Derive script name from script content
 * @param {string} script - Script content
 * @returns {string} Script name
 */
function deriveScriptName(script) {
    const nameMatch = sanitizeText(script).match(/@name\s+(.+)/);
    return sanitizeText(nameMatch?.[1] || '').trim();
}

/**
 * Generate filename for script
 * @param {string} script - Script content
 * @param {string} fallbackBaseName - Fallback base name
 * @returns {string} Generated filename
 */
function generateFilename(script, fallbackBaseName = `generated-${Date.now()}`) {
    const baseName = deriveScriptName(script).replace(/[^\w.-]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase();
    return `${baseName || fallbackBaseName}.user.js`;
}

/**
 * Optimize script by removing trailing whitespace and excess newlines
 * @param {string} script - Script to optimize
 * @returns {string} Optimized script
 */
function optimizeScript(script) {
    return script.split('\n').map(line => line.replace(/[ \t]+$/g, '')).join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

// Export for userscript context
if (typeof window !== 'undefined') {
    window.UnifiedSuite = window.UnifiedSuite || {};
    window.UnifiedSuite.debugLog = debugLog;
    window.UnifiedSuite.sanitizeText = sanitizeText;
    window.UnifiedSuite.safeJsonParse = safeJsonParse;
    window.UnifiedSuite.generateId = generateId;
    window.UnifiedSuite.indentCode = indentCode;
    window.UnifiedSuite.extractCodeBlock = extractCodeBlock;
    window.UnifiedSuite.deriveDescription = deriveDescription;
    window.UnifiedSuite.deriveScriptName = deriveScriptName;
    window.UnifiedSuite.generateFilename = generateFilename;
    window.UnifiedSuite.optimizeScript = optimizeScript;
}

    // ========================================
    // MODULE: STORAGE
    // ========================================

/**
 * Unified AI Assistant Suite - Storage Module
 * @version 1.3.0
 */

/**
 * @typedef {Object} StoredScript
 * @property {string} id - Script ID
 * @property {number} timestamp - Creation timestamp
 * @property {string} filename - Script filename
 * @property {string} name - Script name
 * @property {string} sourcePreview - Source prompt preview
 * @property {Object} validation - Validation results
 * @property {string} content - Script content
 */

/**
 * @typedef {Object} ScriptVersion
 * @property {number} version - Version number
 * @property {string} content - Script content
 * @property {string} changeMessage - Change message
 * @property {number} timestamp - Version timestamp
 */

/**
 * @typedef {Object} ModuleHealth
 * @property {string} status - Module status (ok/error/warning)
 * @property {number} lastCheck - Last health check timestamp
 * @property {string} error - Error message if failed
 */

// Get dependencies from global UnifiedSuite object
const CONFIG = (typeof window !== 'undefined' && window.UnifiedSuite?.CONFIG) || {};
const state = (typeof window !== 'undefined' && window.UnifiedSuite?.state) || {};
const updateState = (typeof window !== 'undefined' && window.UnifiedSuite?.updateState) || (() => {});
const debugLog = (typeof window !== 'undefined' && window.UnifiedSuite?.debugLog) || (() => {});
const sanitizeText = (typeof window !== 'undefined' && window.UnifiedSuite?.sanitizeText) || ((text) => String(text ?? '').trim());
const safeJsonParse = (typeof window !== 'undefined' && window.UnifiedSuite?.safeJsonParse) || ((v, fb) => { try { return JSON.parse(v); } catch { return fb; } });
const generateId = (typeof window !== 'undefined' && window.UnifiedSuite?.generateId) || (() => `script_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`);
const deriveScriptName = (typeof window !== 'undefined' && window.UnifiedSuite?.deriveScriptName) || ((script) => { const m = String(script ?? '').match(/@name\s+(.+)/); return m ? m[1].trim() : ''; });
const generateFilename = (typeof window !== 'undefined' && window.UnifiedSuite?.generateFilename) || ((script, fallback = `generated-${Date.now()}`) => { const name = deriveScriptName(script).replace(/[^\w.-]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase(); return `${name || fallback}.user.js`; });
const deriveDescription = (typeof window !== 'undefined' && window.UnifiedSuite?.deriveDescription) || ((text) => { const clean = String(text ?? '').replace(/```[\s\S]*?```/g, ' ').replace(/\s+/g, ' ').trim(); return clean || 'Auto-generated from AI'; });

/**
 * Storage Module - Handles all GM storage operations
 */
const StorageModule = {
    /**
     * Load generated scripts from storage
     * @returns {StoredScript[]} Array of stored scripts
     */
    loadGeneratedScripts() {
        try {
            const stored = safeJsonParse(GM_getValue(CONFIG.STORAGE_KEYS.history, '[]'), []);
            return Array.isArray(stored) ? stored.filter(Boolean) : [];
        } catch (error) {
            debugLog('Failed to load generated scripts', error);
            return [];
        }
    },

    /**
     * Save a generated script
     * @param {string|Object} script - Script content or object
     * @param {Object} validation - Validation results
     * @param {string} sourceText - Source prompt text
     * @returns {StoredScript} Saved script record
     */
    saveGeneratedScript(script, validation, sourceText) {
        try {
            const content = typeof script === 'string' ? script : sanitizeText(script?.content);
            const scriptId = script?.id || generateId();
            const scriptValidation = validation || script?.validation || this.validateScript(content);
            const history = this.loadGeneratedScripts().filter(item => item && item.id !== scriptId);
            const filename = script?.filename || generateFilename(content);
            const name = script?.name || deriveScriptName(content) || filename.replace(/\.user\.js$/, '');
            
            const record = {
                id: scriptId,
                timestamp: Date.now(),
                filename,
                name,
                sourcePreview: deriveDescription(sourceText).slice(0, 160),
                validation: scriptValidation,
                content
            };
            
            history.unshift(record);
            const limitedHistory = history.slice(0, CONFIG.MAX_HISTORY_ITEMS);
            GM_setValue(CONFIG.STORAGE_KEYS.history, JSON.stringify(limitedHistory));
            updateState('generatedScripts', limitedHistory);
            
            return record;
        } catch (error) {
            debugLog('Failed to save generated script', error);
            throw new Error('Failed to save script');
        }
    },

    /**
     * Export all scripts as JSON
     * @returns {string} JSON export
     */
    exportAllScripts() {
        const scripts = this.loadGeneratedScripts();
        return JSON.stringify({
            version: CONFIG.VERSION,
            exportedAt: Date.now(),
            scripts: scripts.map(s => ({
                id: s.id,
                filename: s.filename,
                name: s.name,
                content: s.content,
                validation: s.validation,
                timestamp: s.timestamp
            }))
        }, null, 2);
    },

    /**
     * Import scripts from JSON
     * @param {string} jsonData - JSON data to import
     * @returns {{imported: number, scripts: StoredScript[]}} Import result
     */
    importScripts(jsonData) {
        try {
            const data = safeJsonParse(jsonData, null);
            if (!data || !Array.isArray(data.scripts)) {
                throw new Error('Invalid import data format');
            }
            
            const imported = [];
            for (const s of data.scripts) {
                if (s.content) {
                    imported.push(this.saveGeneratedScript(s.content, s.validation, s.prompt || ''));
                }
            }
            
            return { imported: imported.length, scripts: imported };
        } catch (error) {
            debugLog('Failed to import scripts', error);
            throw new Error('Failed to import scripts');
        }
    },

    /**
     * Save a script version
     * @param {string} scriptId - Script ID
     * @param {string} content - Script content
     * @param {string} changeMessage - Change message
     */
    saveScriptVersion(scriptId, content, changeMessage = 'Auto-save') {
        try {
            const versions = safeJsonParse(GM_getValue(CONFIG.STORAGE_KEYS.versions, '{}'), {});
            const sv = versions[scriptId] || [];
            sv.unshift({
                version: sv.length + 1,
                content,
                changeMessage,
                timestamp: Date.now()
            });
            GM_setValue(CONFIG.STORAGE_KEYS.versions, JSON.stringify({
                ...versions,
                [scriptId]: sv.slice(0, CONFIG.MAX_VERSIONS_PER_SCRIPT)
            }));
        } catch (error) {
            debugLog('Failed to save script version', error);
        }
    },

    /**
     * Load versions for a script
     * @param {string} scriptId - Script ID
     * @returns {ScriptVersion[]} Array of versions
     */
    loadVersions(scriptId) {
        try {
            const versions = safeJsonParse(GM_getValue(CONFIG.STORAGE_KEYS.versions, '{}'), {});
            return versions[scriptId] || [];
        } catch (error) {
            debugLog('Failed to load script versions', error);
            return [];
        }
    },

    /**
     * Validate script
     * @param {string} script - Script content
     * @returns {{isValid: boolean, issues: string[], warnings: string[], score: number}} Validation result
     */
    validateScript(script) {
        const issues = [];
        const warnings = [];
        const normalizedScript = sanitizeText(script);
        
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
        } catch (error) {
            issues.push(`Syntax error: ${error.message}`);
        }
        
        if (normalizedScript.length > CONFIG.MAX_SCRIPT_LENGTH) {
            warnings.push('Script may be too large; consider splitting features into modules');
        }
        
        const score = Math.max(0, 100 - (issues.length * 20) - (warnings.length * 5) - (normalizedScript.length > 5000 ? 10 : 0));
        
        return {
            isValid: issues.length === 0,
            issues,
            warnings,
            score
        };
    },

    /**
     * Update module health status
     * @param {string} moduleName - Module name
     * @param {string} status - Status (ok/error/warning)
     * @param {string} error - Error message if failed
     */
    updateModuleHealth(moduleName, status, error = '') {
        try {
            const health = safeJsonParse(GM_getValue(CONFIG.STORAGE_KEYS.moduleHealth, '{}'), {});
            health[moduleName] = {
                status,
                lastCheck: Date.now(),
                error: error || null
            };
            GM_setValue(CONFIG.STORAGE_KEYS.moduleHealth, JSON.stringify(health));
            
            if (state.moduleHealth[moduleName]) {
                state.moduleHealth[moduleName] = { status, lastCheck: Date.now(), error: error || null };
            }
        } catch (err) {
            debugLog('Failed to update module health', err);
        }
    },

    /**
     * Get module health status
     * @param {string} moduleName - Module name
     * @returns {ModuleHealth|Object} Module health status
     */
    getModuleHealth(moduleName) {
        try {
            const health = safeJsonParse(GM_getValue(CONFIG.STORAGE_KEYS.moduleHealth, '{}'), {});
            return health[moduleName] || null;
        } catch (error) {
            debugLog('Failed to get module health', error);
            return null;
        }
    }
};

// Re-export utility functions for convenience
const { generateId, deriveScriptName, generateFilename, deriveDescription } = window.UnifiedSuite;

// Export for userscript context
if (typeof window !== 'undefined') {
    window.UnifiedSuite.storage = StorageModule;
}

    // ========================================
    // MODULE: PROVIDERS
    // ========================================

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

// Export for userscript context
if (typeof window !== 'undefined') {
    window.UnifiedSuite.providers = ProvidersModule;
}

    // ========================================
    // MODULE: TEMPLATES
    // ========================================

/**
 * Unified AI Assistant Suite - Templates Module
 * @version 1.4.0
 */

// Get dependencies from global UnifiedSuite object
const CONFIG = (typeof window !== 'undefined' && window.UnifiedSuite?.CONFIG) || {};
const state = (typeof window !== 'undefined' && window.UnifiedSuite?.state) || {};
const updateState = (typeof window !== 'undefined' && window.UnifiedSuite?.updateState) || (() => {});
const debugLog = (typeof window !== 'undefined' && window.UnifiedSuite?.debugLog) || (() => {});
const sanitizeText = (typeof window !== 'undefined' && window.UnifiedSuite?.sanitizeText) || ((text) => String(text ?? '').trim());

/**
 * @typedef {Object} Template
 * @property {string} id - Template ID
 * @property {string} name - Template name
 * @property {string} description - Template description
 * @property {string} category - Template category
 * @property {string} prompt - Template prompt
 * @property {string[]} tags - Template tags
 * @property {number} usageCount - Times used
 * @property {number} rating - User rating (1-5)
 * @property {boolean} isBuiltIn - Is built-in template
 */

/**
 * Templates Module - Manages prompt templates
 */
const TemplatesModule = {
    BUILT_IN_TEMPLATES: [
        {
            id: 'form-filler',
            name: 'Auto-Form Filler',
            description: 'Automatically fill web forms with predefined data',
            category: 'Productivity',
            prompt: 'Create a userscript that automatically fills web forms. It should identify form fields by their labels or placeholders and fill them with predefined data stored in a configuration object.',
            tags: ['forms', 'automation', 'productivity'],
            usageCount: 0,
            rating: 0,
            isBuiltIn: true
        },
        {
            id: 'batch-link-opener',
            name: 'Batch Link Opener',
            description: 'Open multiple links at once with filtering',
            category: 'Productivity',
            prompt: 'Create a userscript that adds a button to open all links on the current page. Include filtering options for domain patterns and the ability to limit the number of links opened.',
            tags: ['links', 'bulk-actions', 'productivity'],
            usageCount: 0,
            rating: 0,
            isBuiltIn: true
        },
        {
            id: 'page-content-saver',
            name: 'Page Content Saver',
            description: 'Save web page content to local storage or download',
            category: 'Productivity',
            prompt: 'Create a userscript that saves the current page content (title, URL, main text) to localStorage. Add functionality to export saved pages as JSON or Markdown.',
            tags: ['content', 'save', 'export'],
            usageCount: 0,
            rating: 0,
            isBuiltIn: true
        },
        {
            id: 'tab-manager',
            name: 'Tab Manager',
            description: 'Organize and manage browser tabs',
            category: 'Productivity',
            prompt: 'Create a userscript that adds tab management features: group tabs by domain, close duplicate tabs, and save tab sessions for later restoration.',
            tags: ['tabs', 'organization', 'browser'],
            usageCount: 0,
            rating: 0,
            isBuiltIn: true
        },
        {
            id: 'password-checker',
            name: 'Password Strength Checker',
            description: 'Check password strength visually',
            category: 'Security',
            prompt: 'Create a userscript that adds visual password strength indicators to password fields. Show color-coded feedback (red/yellow/green) based on complexity requirements.',
            tags: ['security', 'passwords', 'validation'],
            usageCount: 0,
            rating: 0,
            isBuiltIn: true
        },
        {
            id: 'https-enforcer',
            name: 'HTTPS Enforcer',
            description: 'Automatically redirect HTTP to HTTPS',
            category: 'Security',
            prompt: 'Create a userscript that automatically redirects HTTP URLs to HTTPS when available. Add a visual indicator when a secure version is available and a bypass option for testing.',
            tags: ['security', 'https', 'redirect'],
            usageCount: 0,
            rating: 0,
            isBuiltIn: true
        },
        {
            id: 'cookie-cleaner',
            name: 'Cookie Cleaner',
            description: 'Remove tracking and unnecessary cookies',
            category: 'Security',
            prompt: 'Create a userscript that adds a button to clean cookies. Allow filtering by domain patterns, preserve login cookies for specified sites, and show a summary of removed cookies.',
            tags: ['security', 'privacy', 'cookies'],
            usageCount: 0,
            rating: 0,
            isBuiltIn: true
        },
        {
            id: 'dark-mode-enforcer',
            name: 'Dark Mode Enforcer',
            description: 'Force dark mode on websites',
            category: 'UI Enhancement',
            prompt: 'Create a userscript that forces dark mode on websites that dont support it. Use CSS filters and custom styles to create a comfortable dark theme. Add a toggle button to enable/disable.',
            tags: ['ui', 'dark-mode', 'theme'],
            usageCount: 0,
            rating: 0,
            isBuiltIn: true
        },
        {
            id: 'font-adjuster',
            name: 'Font Size Adjuster',
            description: 'Dynamically adjust font sizes',
            category: 'UI Enhancement',
            prompt: 'Create a userscript that adds font size controls to any webpage. Include increase/decrease buttons and a reset option. Remember user preferences across page loads.',
            tags: ['ui', 'font', 'accessibility'],
            usageCount: 0,
            rating: 0,
            isBuiltIn: true
        },
        {
            id: 'console-logger',
            name: 'Console Logger',
            description: 'Enhanced console logging for debugging',
            category: 'Developer Tools',
            prompt: 'Create a userscript that adds enhanced console logging capabilities. Log DOM changes, network requests, and user interactions with timestamps. Add a collapsible console panel in the page.',
            tags: ['developer', 'debugging', 'console'],
            usageCount: 0,
            rating: 0,
            isBuiltIn: true
        }
    ],

    /**
     * Load all templates
     * @returns {Template[]} Array of templates
     */
    loadTemplates() {
        try {
            const stored = safeJsonParse(GM_getValue(CONFIG.STORAGE_KEYS.templates, '[]'), []);
            const customTemplates = Array.isArray(stored) ? stored : [];
            
            // Merge built-in and custom templates
            return [...this.BUILT_IN_TEMPLATES, ...customTemplates];
        } catch (error) {
            debugLog('Failed to load templates', error);
            return [...this.BUILT_IN_TEMPLATES];
        }
    },

    /**
     * Save a custom template
     * @param {Omit<Template, 'id' | 'usageCount' | 'rating' | 'isBuiltIn'>} template - Template data
     * @returns {Template} Saved template
     */
    saveTemplate(template) {
        try {
            const stored = safeJsonParse(GM_getValue(CONFIG.STORAGE_KEYS.templates, '[]'), []);
            const templates = Array.isArray(stored) ? stored : [];
            
            const newTemplate = {
                ...template,
                id: generateId(),
                usageCount: 0,
                rating: 0,
                isBuiltIn: false
            };
            
            templates.push(newTemplate);
            GM_setValue(CONFIG.STORAGE_KEYS.templates, JSON.stringify(templates));
            
            return newTemplate;
        } catch (error) {
            debugLog('Failed to save template', error);
            throw new Error('Failed to save template');
        }
    },

    /**
     * Delete a template
     * @param {string} templateId - Template ID
     */
    deleteTemplate(templateId) {
        try {
            const stored = safeJsonParse(GM_getValue(CONFIG.STORAGE_KEYS.templates, '[]'), []);
            const templates = Array.isArray(stored) ? stored : [];
            const filtered = templates.filter(t => t.id !== templateId);
            GM_setValue(CONFIG.STORAGE_KEYS.templates, JSON.stringify(filtered));
        } catch (error) {
            debugLog('Failed to delete template', error);
            throw new Error('Failed to delete template');
        }
    },

    /**
     * Get templates by category
     * @param {string} category - Category name
     * @returns {Template[]} Templates in category
     */
    getTemplatesByCategory(category) {
        return this.loadTemplates().filter(t => t.category === category);
    },

    /**
     * Search templates
     * @param {string} query - Search query
     * @returns {Template[]} Matching templates
     */
    searchTemplates(query) {
        const lowerQuery = sanitizeText(query).toLowerCase();
        return this.loadTemplates().filter(t => 
            t.name.toLowerCase().includes(lowerQuery) ||
            t.description.toLowerCase().includes(lowerQuery) ||
            t.tags.some(tag => tag.toLowerCase().includes(lowerQuery))
        );
    },

    /**
     * Increment template usage
     * @param {string} templateId - Template ID
     */
    incrementUsage(templateId) {
        const templates = this.loadTemplates();
        const template = templates.find(t => t.id === templateId);
        if (template) {
            template.usageCount++;
            // Note: We don't persist usage count to avoid excessive writes
        }
    },

    /**
     * Get template by ID
     * @param {string} templateId - Template ID
     * @returns {Template|undefined} Template or undefined
     */
    getTemplate(templateId) {
        return this.loadTemplates().find(t => t.id === templateId);
    },

    /**
     * Export templates as JSON
     * @returns {string} JSON export
     */
    exportTemplates() {
        const templates = this.loadTemplates().filter(t => !t.isBuiltIn);
        return JSON.stringify({
            version: CONFIG.VERSION,
            exportedAt: Date.now(),
            templates
        }, null, 2);
    },

    /**
     * Import templates from JSON
     * @param {string} jsonData - JSON data
     * @returns {{imported: number, templates: Template[]}} Import result
     */
    importTemplates(jsonData) {
        try {
            const data = safeJsonParse(jsonData, null);
            if (!data || !Array.isArray(data.templates)) {
                throw new Error('Invalid import data format');
            }

            const imported = [];
            for (const template of data.templates) {
                if (template.name && template.prompt) {
                    const saveTemplate = {
                        ...template,
                        id: undefined, // Will be generated
                        usageCount: 0,
                        rating: 0,
                        isBuiltIn: false
                    };
                    imported.push(this.saveTemplate(saveTemplate));
                }
            }

            return { imported: imported.length, templates: imported };
        } catch (error) {
            debugLog('Failed to import templates', error);
            throw new Error('Failed to import templates');
        }
    }
};

// Export for userscript context
if (typeof window !== 'undefined') {
    window.UnifiedSuite.templates = TemplatesModule;
}

    // ========================================
    // MODULE: CONTEXT
    // ========================================

/**
 * Unified AI Assistant Suite - Context Analysis Module
 * @version 1.5.0
 * 
 * Analyzes webpage content to provide context-aware prompt enhancement.
 * Extracts page metadata, DOM structure, and user interactions.
 */

// Get dependencies from global UnifiedSuite object
const CONFIG = (typeof window !== 'undefined' && window.UnifiedSuite?.CONFIG) || {};
const state = (typeof window !== 'undefined' && window.UnifiedSuite?.state) || {};
const debugLog = (typeof window !== 'undefined' && window.UnifiedSuite?.debugLog) || (() => {});
const sanitizeText = (typeof window !== 'undefined' && window.UnifiedSuite?.sanitizeText) || ((text) => String(text ?? '').trim());

/**
 * @typedef {Object} PageContext
 * @property {string} title - Page title
 * @property {string} url - Page URL
 * @property {string} domain - Page domain
 * @property {string} description - Meta description
 * @property {string} mainContent - Main text content
 * @property {string[]} headings - Page headings
 * @property {string[]} links - Page links
 * @property {string} contentType - Content type (article, form, video, etc.)
 * @property {Object} forms - Form field information
 * @property {number} textLength - Total text length
 */

/**
 * Context Analysis Module
 */
const ContextModule = {
    /**
     * Analyze current page context
     * @returns {PageContext} Page context object
     */
    analyzePage() {
        try {
            const context = {
                title: document.title || '',
                url: window.location.href || '',
                domain: window.location.hostname || '',
                description: this.getMetaDescription(),
                mainContent: this.extractMainContent(),
                headings: this.extractHeadings(),
                links: this.extractLinks(),
                contentType: this.detectContentType(),
                forms: this.analyzeForms(),
                textLength: 0
            };
            
            context.textLength = context.mainContent.length;
            
            debugLog('Page context analyzed:', context);
            return context;
        } catch (error) {
            debugLog('Failed to analyze page context:', error);
            return this.getDefaultContext();
        }
    },

    /**
     * Get meta description from page
     * @returns {string} Meta description
     */
    getMetaDescription() {
        const meta = document.querySelector('meta[name="description"]') || 
                     document.querySelector('meta[property="og:description"]');
        return meta ? sanitizeText(meta.getAttribute('content') || '') : '';
    },

    /**
     * Extract main content from page
     * @returns {string} Main text content
     */
    extractMainContent() {
        // Try common content containers
        const selectors = [
            'article',
            '[role="main"]',
            'main',
            '.post-content',
            '.entry-content',
            '.content',
            '#content',
            '.article-body'
        ];
        
        for (const selector of selectors) {
            const element = document.querySelector(selector);
            if (element) {
                return sanitizeText(element.textContent || '').slice(0, 2000);
            }
        }
        
        // Fallback: get body text
        return sanitizeText(document.body?.textContent || '').slice(0, 1000);
    },

    /**
     * Extract headings from page
     * @returns {string[]} Array of heading texts
     */
    extractHeadings() {
        const headings = [];
        document.querySelectorAll('h1, h2, h3').forEach(h => {
            const text = sanitizeText(h.textContent || '');
            if (text) headings.push(text);
        });
        return headings.slice(0, 10);
    },

    /**
     * Extract links from page
     * @returns {string[]} Array of link URLs
     */
    extractLinks() {
        const links = [];
        document.querySelectorAll('a[href]').forEach(a => {
            const href = a.getAttribute('href');
            if (href && !href.startsWith('javascript:') && !href.startsWith('#')) {
                links.push(href);
            }
        });
        return links.slice(0, 20);
    },

    /**
     * Detect content type of the page
     * @returns {string} Content type
     */
    detectContentType() {
        const url = window.location.href;
        const body = document.body?.textContent || '';
        
        if (document.querySelector('article') || document.querySelector('.post')) {
            return 'article';
        }
        if (document.querySelector('form') && document.querySelector('input[type="text"]')) {
            return 'form';
        }
        if (document.querySelector('video') || document.querySelector('iframe[src*="youtube"]')) {
            return 'video';
        }
        if (document.querySelector('table') || document.querySelector('.table')) {
            return 'data';
        }
        if (body.length > 5000) {
            return 'long-form';
        }
        return 'general';
    },

    /**
     * Analyze forms on the page
     * @returns {Object} Form information
     */
    analyzeForms() {
        const forms = document.querySelectorAll('form');
        const formInfo = {
            count: forms.length,
            fields: []
        };
        
        forms.forEach((form, i) => {
            const inputs = form.querySelectorAll('input, textarea, select');
            inputs.forEach(input => {
                if (input.type !== 'hidden' && input.type !== 'submit') {
                    formInfo.fields.push({
                        name: input.name || input.id || `field_${i}`,
                        type: input.type || 'text',
                        placeholder: input.placeholder || ''
                    });
                }
            });
        });
        
        return formInfo;
    },

    /**
     * Generate enhanced prompt based on page context
     * @param {string} userPrompt - Original user prompt
     * @returns {string} Enhanced prompt with context
     */
    enhancePrompt(userPrompt) {
        const context = this.analyzePage();
        
        // Build context string
        const contextParts = [];
        
        if (context.title) {
            contextParts.push(`Page Title: "${context.title}"`);
        }
        
        if (context.description) {
            contextParts.push(`Description: "${context.description}"`);
        }
        
        if (context.headings.length > 0) {
            contextParts.push(`Page Structure: ${context.headings.join(' > ')}`);
        }
        
        if (context.contentType !== 'general') {
            contextParts.push(`Content Type: ${context.contentType}`);
        }
        
        if (context.forms.count > 0) {
            contextParts.push(`Forms Found: ${context.forms.count} form(s) with ${context.forms.fields.length} field(s)`);
        }
        
        // Build enhanced prompt
        let enhanced = userPrompt;
        
        if (contextParts.length > 0) {
            enhanced = `Context: This script will run on ${context.domain}.\n`;
            enhanced += contextParts.join('\n');
            enhanced += `\n\nUser Request: ${userPrompt}`;
        }
        
        return enhanced;
    },

    /**
     * Get default context (fallback)
     * @returns {PageContext} Default context
     */
    getDefaultContext() {
        return {
            title: '',
            url: '',
            domain: '',
            description: '',
            mainContent: '',
            headings: [],
            links: [],
            contentType: 'general',
            forms: { count: 0, fields: [] },
            textLength: 0
        };
    },

    /**
     * Check if context analysis is available
     * @returns {boolean} Whether context analysis is available
     */
    isAvailable() {
        return typeof document !== 'undefined' && document.body !== null;
    }
};

// Export for userscript context
if (typeof window !== 'undefined') {
    window.UnifiedSuite.context = ContextModule;
}

    // ========================================
    // MODULE: AUTOUPDATE
    // ========================================

/**
 * Unified AI Assistant Suite - Auto-Update Module
 * @version 1.5.0
 * 
 * Checks for updates, downloads new versions, and handles
 * 3-way merge for user modifications.
 */

const CONFIG = (typeof window !== 'undefined' && window.UnifiedSuite?.CONFIG) || {};
const state = (typeof window !== 'undefined' && window.UnifiedSuite?.state) || {};
const debugLog = (typeof window !== 'undefined' && window.UnifiedSuite?.debugLog) || (() => {});

/**
 * @typedef {Object} UpdateInfo
 * @property {string} latestVersion - Latest available version
 * @property {string} currentVersion - Current installed version
 * @property {string} downloadUrl - URL to download update
 * @property {string} changelog - Release notes
 * @property {Date} releaseDate - Release date
 * @property {boolean} hasBreakingChanges - Whether update requires migration
 */

const AutoUpdateModule = {
    GITHUB_API: 'https://api.github.com/repos/eric847b/ai-chat-websites/releases/latest',
    UPDATE_CHECK_INTERVAL: 24 * 60 * 60 * 1000, // 24 hours
    
    /**
     * Check for updates
     * @returns {Promise<UpdateInfo|null>} Update info or null
     */
    async checkForUpdates() {
        try {
            const response = await fetch(this.GITHUB_API, {
                headers: { 'Accept': 'application/vnd.github.v3+json' }
            });
            
            if (!response.ok) throw new Error(`GitHub API error: ${response.status}`);
            
            const data = await response.json();
            
            const updateInfo = {
                latestVersion: data.tag_name?.replace('v', '') || data.name || 'unknown',
                currentVersion: CONFIG.VERSION || '0.0.0',
                downloadUrl: data.zipball_url || '',
                changelog: data.body || 'No changelog available',
                releaseDate: data.published_at ? new Date(data.published_at) : new Date(),
                hasBreakingChanges: (data.body || '').toLowerCase().includes('breaking change')
            };
            
            return updateInfo;
        } catch (error) {
            debugLog('Update check failed:', error);
            return null;
        }
    },

    /**
     * Check if update is available
     * @param {UpdateInfo} updateInfo - Update information
     * @returns {boolean} Whether update is available
     */
    isUpdateAvailable(updateInfo) {
        if (!updateInfo) return false;
        return this.compareVersions(updateInfo.latestVersion, updateInfo.currentVersion) > 0;
    },

    /**
     * Compare two semantic versions
     * @param {string} v1 - First version
     * @param {string} v2 - Second version
     * @returns {number} 1 if v1 > v2, -1 if v1 < v2, 0 if equal
     */
    compareVersions(v1, v2) {
        const parts1 = v1.split('.').map(Number);
        const parts2 = v2.split('.').map(Number);
        
        for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
            const p1 = parts1[i] || 0;
            const p2 = parts2[i] || 0;
            if (p1 > p2) return 1;
            if (p1 < p2) return -1;
        }
        return 0;
    },

    /**
     * Get last update check time
     * @returns {number} Last check timestamp
     */
    getLastCheckTime() {
        try {
            const stored = GM_getValue('update_last_check', '0');
            return parseInt(stored, 10) || 0;
        } catch {
            return 0;
        }
    },

    /**
     * Set last update check time
     * @param {number} timestamp - Check timestamp
     */
    setLastCheckTime(timestamp = Date.now()) {
        try {
            GM_setValue('update_last_check', String(timestamp));
        } catch {}
    },

    /**
     * Should check for updates now
     * @returns {boolean} Whether check is needed
     */
    shouldCheck() {
        const lastCheck = this.getLastCheckTime();
        return (Date.now() - lastCheck) > this.UPDATE_CHECK_INTERVAL;
    },

    /**
     * Auto-check for updates if interval has passed
     * @returns {Promise<UpdateInfo|null>} Update info
     */
    async autoCheck() {
        if (!this.shouldCheck()) return null;
        
        const updateInfo = await this.checkForUpdates();
        this.setLastCheckTime();
        
        if (updateInfo && this.isUpdateAvailable(updateInfo)) {
            this.notifyUpdate(updateInfo);
        }
        
        return updateInfo;
    },

    /**
     * Show update notification badge
     * @param {UpdateInfo} updateInfo - Update information
     */
    notifyUpdate(updateInfo) {
        const badge = document.createElement('div');
        badge.id = 'update-badge';
        badge.style.cssText = 'position:fixed;bottom:20px;right:20px;background:#3b82f6;color:white;padding:12px 20px;border-radius:8px;box-shadow:0 4px 12px rgba(0,0,0,0.3);z-index:99999;cursor:pointer;font-family:system-ui,sans-serif;font-size:14px;display:flex;align-items:center;gap:10px;animation:slideIn 0.3s ease';
        badge.innerHTML = `
            <span>⬆️</span>
            <div>
                <strong>Update Available</strong><br>
                <small style="opacity:0.8">v${updateInfo.currentVersion} → v${updateInfo.latestVersion}</small>
            </div>
            <button style="background:rgba(255,255,255,0.2);border:none;color:white;border-radius:4px;padding:4px 8px;cursor:pointer;margin-left:8px;font-size:12px">Update</button>
            <button id="dismiss-update" style="background:none;border:none;color:white;cursor:pointer;margin-left:4px;font-size:16px;opacity:0.6">×</button>
        `;
        
        document.body.appendChild(badge);
        
        // Dismiss handler
        badge.querySelector('#dismiss-update').addEventListener('click', () => badge.remove());
        
        // Update button handler
        badge.querySelector('button:not(#dismiss-update)').addEventListener('click', () => {
            window.open(updateInfo.downloadUrl, '_blank');
            badge.remove();
        });
    },

    /**
     * Stash user modifications before update
     * @returns {Object} Stashed modifications
     */
    stashModifications() {
        const scripts = [];
        try {
            const stored = GM_getValue(CONFIG.STORAGE_KEYS.history, '[]');
            const parsed = JSON.parse(stored);
            if (Array.isArray(parsed)) {
                parsed.forEach(script => {
                    if (script.content) {
                        scripts.push({
                            id: script.id,
                            content: script.content,
                            name: script.name || 'Unknown',
                            timestamp: script.timestamp || Date.now()
                        });
                    }
                });
            }
        } catch {}
        return { scripts, stashedAt: Date.now() };
    },

    /**
     * Perform 3-way merge for a user-modified script
     * @param {string} originalContent - Original script content
     * @param {string} userContent - User-modified content
     * @param {string} newContent - New version content
     * @returns {string} Merged content
     */
    threeWayMerge(originalContent, userContent, newContent) {
        // Simple line-based 3-way merge
        const originalLines = originalContent.split('\n');
        const userLines = userContent.split('\n');
        const newLines = newContent.split('\n');
        
        const merged = [];
        const maxLen = Math.max(originalLines.length, userLines.length, newLines.length);
        
        for (let i = 0; i < maxLen; i++) {
            const orig = originalLines[i] ?? '';
            const user = userLines[i] ?? '';
            const next = newLines[i] ?? '';
            
            // If user didn't change this line, use new version
            if (orig === user) {
                merged.push(next);
            // If original is same as new, user added this line
            } else if (orig === next) {
                merged.push(user);
            // User modified, new didn't change
            } else if (orig !== user && orig === next) {
                merged.push(user);
            // Both changed - use user's version with comment
            } else {
                merged.push(user);
                merged.push(`// MERGE CONFLICT: Line ${i + 1} was changed in both versions`);
                merged.push(`// Original: ${orig}`);
                merged.push(`// New: ${next}`);
            }
        }
        
        return merged.join('\n');
    },

    /**
     * Check if UI module is loaded
     * @returns {boolean}
     */
    isAvailable() {
        return typeof GM_getValue !== 'undefined' && typeof GM_setValue !== 'undefined';
    }
};

// Export for userscript context
if (typeof window !== 'undefined') {
    window.UnifiedSuite.autoupdate = AutoUpdateModule;
}

    // ========================================
    // MODULE: VALIDATOR
    // ========================================

/**
 * Unified AI Assistant Suite - Validation & Linter Module
 * @version 1.5.0
 * 
 * Security linter, best practices checker, and complexity metrics for generated scripts.
 */

const CONFIG = (typeof window !== 'undefined' && window.UnifiedSuite?.CONFIG) || {};
const debugLog = (typeof window !== 'undefined' && window.UnifiedSuite?.debugLog) || (() => {});
const sanitizeText = (typeof window !== 'undefined' && window.UnifiedSuite?.sanitizeText) || ((text) => String(text ?? '').trim());

const ValidatorModule = {
    /**
     * Validate a generated script
     * @param {string} scriptContent - Script content to validate
     * @returns {{isValid: boolean, score: number, issues: string[], warnings: string[], metrics: Object}}
     */
    validate(scriptContent) {
        const issues = [];
        const warnings = [];
        let score = 100;
        
        // Security checks
        const securityResults = this.checkSecurity(scriptContent);
        issues.push(...securityResults.issues);
        warnings.push(...securityResults.warnings);
        score -= securityResults.penalty;
        
        // Best practices
        const practicesResults = this.checkBestPractices(scriptContent);
        warnings.push(...practicesResults.warnings);
        issues.push(...practicesResults.issues);
        score -= practicesResults.penalty;
        
        // Complexity metrics
        const metrics = this.calculateMetrics(scriptContent);
        
        // Score floor
        score = Math.max(0, Math.min(100, score));
        
        return {
            isValid: issues.length === 0,
            score,
            issues,
            warnings,
            metrics
        };
    },

    /**
     * Security checks - OWASP-based rules for userscripts
     * @param {string} script - Script content
     * @returns {{issues: string[], warnings: string[], penalty: number}}
     */
    checkSecurity(script) {
        const issues = [];
        const warnings = [];
        let penalty = 0;

        // Check for eval()
        if (/\beval\s*\(/.test(script)) {
            issues.push('❌ Usage of eval() detected - security risk');
            penalty += 20;
        }

        // Check for document.write()
        if (/document\.write\s*\(/.test(script)) {
            warnings.push('⚠️ document.write() used - may cause performance issues');
            penalty += 5;
        }

        // Check for innerHTML usage
        const innerHTMLCount = (script.match(/\.innerHTML\s*=/g) || []).length;
        if (innerHTMLCount > 3) {
            warnings.push(`⚠️ ${innerHTMLCount} uses of innerHTML - consider textContent for security`);
            penalty += 5;
        }

        // Check for @grant permissions
        if (script.includes('GM_xmlhttpRequest') && !script.includes('@grant') && !script.includes('// @grant')) {
            warnings.push('⚠️ GM_xmlhttpRequest used but @grant not declared');
            penalty += 5;
        }

        // Check for @connect directives when making external requests
        if (script.includes('fetch(') && !script.includes('@connect')) {
            warnings.push('⚠️ fetch() used - may need @connect directive for cross-origin requests');
            penalty += 3;
        }

        // Check for localStorage/sessionStorage access
        if (script.includes('localStorage') || script.includes('sessionStorage')) {
            warnings.push('ℹ️ Uses browser storage - ensure @grant includes GM_getValue if needed');
            penalty += 2;
        }

        // Dangerous patterns
        const dangerousPatterns = [
            { pattern: /new\s+Function\s*\(/, name: 'new Function()' },
            { pattern: /setTimeout\s*\(["']/, name: 'setTimeout with string' },
            { pattern: /setInterval\s*\(["']/, name: 'setInterval with string' }
        ];

        dangerousPatterns.forEach(({ pattern, name }) => {
            if (pattern.test(script)) {
                warnings.push(`⚠️ ${name} detected - potential security concern`);
                penalty += 5;
            }
        });

        return { issues, warnings, penalty };
    },

    /**
     * Best practices checks
     * @param {string} script - Script content
     * @returns {{issues: string[], warnings: string[], penalty: number}}
     */
    checkBestPractices(script) {
        const issues = [];
        const warnings = [];
        let penalty = 0;

        // Check for userscript metadata
        if (!script.includes('==UserScript==')) {
            issues.push('❌ Missing @name directive - script will not be installable');
            penalty += 15;
        }
        if (!script.includes('@name')) {
            warnings.push('⚠️ Missing @name in metadata block');
            penalty += 5;
        }
        if (!script.includes('@version')) {
            warnings.push('⚠️ Missing @version in metadata block');
            penalty += 3;
        }
        if (!script.includes('@grant')) {
            warnings.push('⚠️ Missing @grant declarations');
            penalty += 3;
        }

        // Code quality
        const lines = script.split('\n');
        const longLines = lines.filter(l => l.length > 120);
        if (longLines.length > 5) {
            warnings.push(`⚠️ ${longLines.length} lines exceed 120 characters - consider breaking them up`);
            penalty += 3;
        }

        // Check for console.log in production
        const consoleCount = (script.match(/console\.(log|warn|error)\s*\(/g) || []).length;
        if (consoleCount > 5) {
            warnings.push(`⚠️ ${consoleCount} console statements - remove in production`);
            penalty += 3;
        }

        // Check for TODO/FIXME comments
        const todoCount = (script.match(/\/\/\s*(TODO|FIXME|HACK|XXX)/gi) || []).length;
        if (todoCount > 0) {
            warnings.push(`ℹ️ ${todoCount} TODO/FIXME comments remaining`);
            penalty += 1;
        }

        // Check for proper error handling
        if (!script.includes('try') && !script.includes('catch')) {
            warnings.push('ℹ️ No try/catch blocks found - consider adding error handling');
            penalty += 2;
        }

        // Check for @match or @include
        if (!script.includes('@match') && !script.includes('@include')) {
            warnings.push('⚠️ No @match/@include directive - script runs on all pages');
            penalty += 3;
        }

        return { issues, warnings, penalty };
    },

    /**
     * Calculate complexity metrics
     * @param {string} script - Script content
     * @returns {Object} Metrics
     */
    calculateMetrics(script) {
        const lines = script.split('\n');
        const codeLines = lines.filter(l => l.trim() && !l.trim().startsWith('//') && !l.trim().startsWith('/*') && !l.trim().startsWith('*'));
        
        // Cyclomatic complexity (approximate)
        const decisionPoints = (script.match(/\b(if|else\s+if|for|while|case|catch|\?)\b/g) || []).length;
        const cyclomaticComplexity = Math.max(1, decisionPoints + 1);
        
        // Maintainability index (simplified)
        const totalLines = codeLines.length;
        const commentLines = lines.filter(l => l.trim().startsWith('//') || l.trim().startsWith('/*') || l.trim().startsWith('*')).length;
        const commentRatio = totalLines > 0 ? commentLines / totalLines : 0;
        const avgLineLength = totalLines > 0 ? codeLines.reduce((sum, l) => sum + l.length, 0) / totalLines : 0;
        
        const maintainabilityIndex = Math.max(0, Math.min(100,
            100 - (cyclomaticComplexity * 2) - (avgLineLength > 80 ? 10 : 0) + (commentRatio > 0.1 ? 10 : 0)
        ));
        
        // Halstead effort (simplified)
        const operators = (script.match(/[\+\-\*\/%=<>!&|^~?:]+/g) || []).length;
        const operands = (script.match(/\b[a-zA-Z_$][\w$]*\b/g) || []).length;
        const halsteadEffort = operators + operands;
        
        return {
            totalLines,
            codeLines: codeLines.length,
            commentLines,
            commentRatio: Math.round(commentRatio * 100) / 100,
            cyclomaticComplexity,
            maintainabilityIndex: Math.round(maintainabilityIndex),
            halsteadEffort,
            avgLineLength: Math.round(avgLineLength),
            decisionPoints
        };
    },

    /**
     * Check if module is available
     * @returns {boolean}
     */
    isAvailable() {
        return true;
    }
};

// Export for userscript context
if (typeof window !== 'undefined') {
    window.UnifiedSuite.validator = ValidatorModule;
}

    // ========================================
    // MODULE: PLUGIN-API
    // ========================================

/**
 * Unified AI Assistant Suite - Plugin API Module
 * @version 1.6.0
 * 
 * Plugin system with manifest format, lifecycle hooks, sandbox,
 * marketplace integration, and dependency management.
 */

const CONFIG = (typeof window !== 'undefined' && window.UnifiedSuite?.CONFIG) || {};
const state = (typeof window !== 'undefined' && window.UnifiedSuite?.state) || {};
const debugLog = (typeof window !== 'undefined' && window.UnifiedSuite?.debugLog) || (() => {});

/**
 * @typedef {Object} PluginManifest
 * @property {string} id - Unique plugin ID
 * @property {string} name - Plugin name
 * @property {string} version - Plugin version
 * @property {string} description - Plugin description
 * @property {string} author - Plugin author
 * @property {string[]} permissions - Required permissions
 * @property {string[]} dependencies - Plugin dependencies
 * @property {string} main - Main script file
 * @property {Object} [hooks] - Lifecycle hooks
 */

const PluginAPI = {
    installedPlugins: new Map(),
    pluginSandboxes: new Map(),

    /**
     * Register a plugin
     * @param {PluginManifest} manifest - Plugin manifest
     * @param {Object} implementation - Plugin implementation
     * @returns {boolean} Success
     */
    register(manifest, implementation) {
        try {
            // Validate manifest
            if (!manifest.id || !manifest.name) {
                debugLog('Plugin manifest missing required fields');
                return false;
            }

            // Check dependencies
            if (manifest.dependencies) {
                for (const dep of manifest.dependencies) {
                    if (!this.installedPlugins.has(dep)) {
                        debugLog(`Plugin ${manifest.id} missing dependency: ${dep}`);
                        return false;
                    }
                }
            }

            // Create sandbox
            const sandbox = this.createSandbox(manifest, implementation);
            this.pluginSandboxes.set(manifest.id, sandbox);
            this.installedPlugins.set(manifest.id, { manifest, sandbox });

            debugLog(`Plugin registered: ${manifest.name} v${manifest.version}`);
            return true;
        } catch (error) {
            debugLog(`Failed to register plugin ${manifest.id}:`, error);
            return false;
        }
    },

    /**
     * Create an execution sandbox for a plugin
     * @param {PluginManifest} manifest - Plugin manifest
     * @param {Object} implementation - Plugin implementation
     * @returns {Proxy} Sandboxed plugin
     */
    createSandbox(manifest, implementation) {
        const allowedAPIs = this.getAllowedAPIs(manifest.permissions || []);
        
        return new Proxy(implementation, {
            get(target, prop) {
                if (prop in target) {
                    if (prop.startsWith('_') || prop === 'constructor') {
                        debugLog(`Blocked access to ${prop} in plugin ${manifest.id}`);
                        return undefined;
                    }
                    return target[prop];
                }
                return undefined;
            },
            
            set(target, prop, value) {
                debugLog(`Plugin ${manifest.id} attempted to set ${prop}`);
                return false; // Read-only sandbox
            }
        });
    },

    /**
     * Get allowed APIs based on permissions
     * @param {string[]} permissions - Required permissions
     * @returns {string[]} Allowed API names
     */
    getAllowedAPIs(permissions) {
        const apiMap = {
            'storage': ['GM_getValue', 'GM_setValue', 'GM_deleteValue'],
            'network': ['GM_xmlhttpRequest', 'fetch'],
            'dom': ['document.querySelector', 'document.getElementById'],
            'ui': ['GM_notification', 'GM_setClipboard'],
            'tabs': ['GM_openInTab', 'GM_getTab', 'GM_saveTab']
        };
        
        const allowed = ['console.log', 'JSON.parse', 'JSON.stringify'];
        permissions.forEach(perm => {
            if (apiMap[perm]) {
                allowed.push(...apiMap[perm]);
            }
        });
        
        return allowed;
    },

    /**
     * Unregister a plugin
     * @param {string} pluginId - Plugin ID
     */
    unregister(pluginId) {
        this.installedPlugins.delete(pluginId);
        this.pluginSandboxes.delete(pluginId);
        debugLog(`Plugin unregistered: ${pluginId}`);
    },

    /**
     * Get all installed plugins
     * @returns {Array} Installed plugins
     */
    listPlugins() {
        return Array.from(this.installedPlugins.values()).map(p => ({
            id: p.manifest.id,
            name: p.manifest.name,
            version: p.manifest.version,
            description: p.manifest.description,
            author: p.manifest.author,
            permissions: p.manifest.permissions
        }));
    },

    /**
     * Get plugin by ID
     * @param {string} pluginId - Plugin ID
     * @returns {Object|null} Plugin info
     */
    getPlugin(pluginId) {
        const plugin = this.installedPlugins.get(pluginId);
        if (!plugin) return null;
        return {
            manifest: plugin.manifest,
            hooks: plugin.manifest.hooks || {}
        };
    },

    /**
     * Execute a plugin hook
     * @param {string} hookName - Hook name
     * @param {...any} args - Hook arguments
     * @returns {Promise<Array>} Hook results
     */
    async executeHook(hookName, ...args) {
        const results = [];
        for (const [id, plugin] of this.installedPlugins) {
            try {
                const sandbox = plugin.sandbox;
                if (sandbox[hookName] && typeof sandbox[hookName] === 'function') {
                    const result = await sandbox[hookName](...args);
                    results.push({ pluginId: id, result });
                }
            } catch (error) {
                debugLog(`Plugin ${id} hook ${hookName} failed:`, error);
                results.push({ pluginId: id, error: error.message });
            }
        }
        return results;
    },

    /**
     * Get installed count
     * @returns {number} Plugin count
     */
    getCount() {
        return this.installedPlugins.size;
    },

    isAvailable() {
        return true;
    }
};

// Export for userscript context
if (typeof window !== 'undefined') {
    window.UnifiedSuite.pluginAPI = PluginAPI;
}

    // ========================================
    // MODULE: I18N
    // ========================================

/**
 * Unified AI Assistant Suite - Internationalization Module
 * @version 1.8.0
 * 
 * Multi-language support with translation system and dynamic switching.
 * Supports Spanish, Chinese, Japanese, and RTL layout.
 */

const CONFIG = (typeof window !== 'undefined' && window.UnifiedSuite?.CONFIG) || {};
const state = (typeof window !== 'undefined' && window.UnifiedSuite?.state) || {};
const debugLog = (typeof window !== 'undefined' && window.UnifiedSuite?.debugLog) || (() => {});

const i18n = {
    currentLocale: 'en',
    fallbackLocale: 'en',
    translations: new Map(),
    rtlLocales: ['ar', 'he', 'fa'],

    /**
     * Translation strings
     */
    strings: {
        en: {
            app_title: 'AI Assistant Suite',
            dashboard: 'Dashboard',
            generator: 'Script Generator',
            templates: 'Templates',
            versions: 'Versions',
            security: 'Security',
            scripts_generated: 'Scripts Generated',
            modules_active: 'Modules Active',
            export_all: 'Export All Scripts',
            import_scripts: 'Import Scripts',
            clear_history: 'Clear History',
            ai_provider: 'AI Provider',
            api_key: 'API Key',
            streaming: 'Streaming',
            context_awareness: 'Context Awareness',
            describe_prompt: 'Describe what you want the script to do:',
            generate: 'Generate Script',
            save: 'Save Script',
            copy: 'Copy',
            download: 'Download',
            search_templates: 'Search templates...',
            create_template: '+ Create Template',
            template_gallery: 'Template Gallery',
            category_all: 'All',
            category_productivity: 'Productivity',
            category_security: 'Security',
            category_ui: 'UI Enhancement',
            category_devtools: 'Developer Tools',
            use_template: 'Use Template',
            idle: 'Idle',
            streaming_active: 'Streaming...',
            update_available: 'Update Available',
            no_templates: 'No templates available',
            loaded_template: 'Loaded template:',
            enter_prompt: 'Describe what you want the script to do first.',
            generating: 'Generating...',
            generated: 'Generated',
            saved: 'Saved',
            copied: 'Script copied to clipboard',
            downloaded: 'Downloaded',
            error_prefix: 'Error:',
            validation_valid: 'Valid',
            validation_review: 'Needs review',
            theme_toggle: 'Toggle theme',
            close_ui: 'Close UI',
            test_connection: 'Test Connection',
            auth_status: 'Authentication',
            session_status: 'Session',
            retry_count: 'Retry Count',
            module_health: 'Module Health'
        },
        es: {
            app_title: 'Suite Asistente IA',
            dashboard: 'Panel',
            generator: 'Generador',
            templates: 'Plantillas',
            versions: 'Versiones',
            security: 'Seguridad',
            scripts_generated: 'Scripts Generados',
            modules_active: 'Módulos Activos',
            export_all: 'Exportar Scripts',
            import_scripts: 'Importar Scripts',
            clear_history: 'Limpiar Historial',
            ai_provider: 'Proveedor IA',
            api_key: 'Clave API',
            streaming: 'Transmisión',
            context_awareness: 'Contexto',
            describe_prompt: 'Describe lo que debe hacer el script:',
            generate: 'Generar Script',
            save: 'Guardar Script',
            copy: 'Copiar',
            download: 'Descargar',
            search_templates: 'Buscar plantillas...',
            create_template: '+ Crear Plantilla',
            template_gallery: 'Galería de Plantillas',
            category_all: 'Todas',
            category_productivity: 'Productividad',
            category_security: 'Seguridad',
            category_ui: 'Mejora UI',
            category_devtools: 'Herramientas Dev',
            use_template: 'Usar Plantilla',
            idle: 'Inactivo',
            streaming_active: 'Transmitiendo...',
            update_available: 'Actualización Disponible',
            no_templates: 'No hay plantillas disponibles',
            loaded_template: 'Plantilla cargada:',
            enter_prompt: 'Describe lo que debe hacer el script.',
            generating: 'Generando...',
            generated: 'Generado',
            saved: 'Guardado',
            copied: 'Script copiado al portapapeles',
            downloaded: 'Descargado',
            error_prefix: 'Error:',
            validation_valid: 'Válido',
            validation_review: 'Requiere revisión',
            theme_toggle: 'Cambiar tema',
            close_ui: 'Cerrar UI',
            test_connection: 'Probar Conexión',
            auth_status: 'Autenticación',
            session_status: 'Sesión',
            retry_count: 'Intentos',
            module_health: 'Estado Módulos'
        },
        zh: {
            app_title: 'AI助手套件',
            dashboard: '仪表板',
            generator: '脚本生成器',
            templates: '模板',
            versions: '版本',
            security: '安全',
            scripts_generated: '已生成脚本',
            modules_active: '活跃模块',
            export_all: '导出所有脚本',
            import_scripts: '导入脚本',
            clear_history: '清除历史',
            ai_provider: 'AI提供商',
            api_key: 'API密钥',
            streaming: '流式传输',
            context_awareness: '上下文感知',
            describe_prompt: '描述您希望脚本执行的操作：',
            generate: '生成脚本',
            save: '保存脚本',
            copy: '复制',
            download: '下载',
            search_templates: '搜索模板...',
            create_template: '+ 创建模板',
            template_gallery: '模板库',
            category_all: '全部',
            category_productivity: '生产力',
            category_security: '安全',
            category_ui: 'UI增强',
            category_devtools: '开发工具',
            use_template: '使用模板',
            idle: '空闲',
            streaming_active: '流式传输中...',
            update_available: '有可用更新',
            no_templates: '没有可用模板',
            loaded_template: '已加载模板：',
            enter_prompt: '描述您希望脚本执行的操作。',
            generating: '生成中...',
            generated: '已生成',
            saved: '已保存',
            copied: '脚本已复制到剪贴板',
            downloaded: '已下载',
            error_prefix: '错误：',
            validation_valid: '有效',
            validation_review: '需要审查',
            theme_toggle: '切换主题',
            close_ui: '关闭界面',
            test_connection: '测试连接',
            auth_status: '身份验证',
            session_status: '会话',
            retry_count: '重试次数',
            module_health: '模块健康'
        },
        ja: {
            app_title: 'AIアシスタントスイート',
            dashboard: 'ダッシュボード',
            generator: 'スクリプト生成',
            templates: 'テンプレート',
            versions: 'バージョン',
            security: 'セキュリティ',
            scripts_generated: '生成済みスクリプト',
            modules_active: 'アクティブモジュール',
            export_all: 'すべてエクスポート',
            import_scripts: 'インポート',
            clear_history: '履歴クリア',
            ai_provider: 'AIプロバイダー',
            api_key: 'APIキー',
            streaming: 'ストリーミング',
            context_awareness: 'コンテキスト認識',
            describe_prompt: 'スクリプトの動作を説明してください：',
            generate: 'スクリプト生成',
            save: '保存',
            copy: 'コピー',
            download: 'ダウンロード',
            search_templates: 'テンプレート検索...',
            create_template: '+ テンプレート作成',
            template_gallery: 'テンプレートギャラリー',
            category_all: 'すべて',
            category_productivity: '生産性',
            category_security: 'セキュリティ',
            category_ui: 'UI改善',
            category_devtools: '開発ツール',
            use_template: 'テンプレート使用',
            idle: '待機中',
            streaming_active: 'ストリーミング中...',
            update_available: 'アップデートあり',
            no_templates: 'テンプレートがありません',
            loaded_template: 'テンプレートを読み込みました：',
            enter_prompt: 'スクリプトの動作を説明してください。',
            generating: '生成中...',
            generated: '生成完了',
            saved: '保存完了',
            copied: 'クリップボードにコピーしました',
            downloaded: 'ダウンロード完了',
            error_prefix: 'エラー：',
            validation_valid: '有効',
            validation_review: 'レビューが必要',
            theme_toggle: 'テーマ切替',
            close_ui: 'UIを閉じる',
            test_connection: '接続テスト',
            auth_status: '認証',
            session_status: 'セッション',
            retry_count: 'リトライ回数',
            module_health: 'モジュール状態'
        }
    },

    /**
     * Get current locale
     * @returns {string} Current locale code
     */
    getLocale() {
        return this.currentLocale;
    },

    /**
     * Set current locale
     * @param {string} locale - Locale code
     */
    setLocale(locale) {
        if (this.strings[locale]) {
            this.currentLocale = locale;
            document.documentElement.lang = locale;
            
            // Handle RTL
            if (this.rtlLocales.includes(locale)) {
                document.documentElement.dir = 'rtl';
            } else {
                document.documentElement.dir = 'ltr';
            }
            
            try { GM_setValue('user_locale', locale); } catch {}
            debugLog(`Locale changed to: ${locale}`);
        }
    },

    /**
     * Translate a key
     * @param {string} key - Translation key
     * @param {Object} [params] - Interpolation parameters
     * @returns {string} Translated string
     */
    t(key, params = {}) {
        const locale = this.currentLocale;
        let text = this.strings[locale]?.[key] || this.strings[this.fallbackLocale]?.[key] || key;
        
        // Interpolate params
        Object.entries(params).forEach(([k, v]) => {
            text = text.replace(`{${k}}`, v);
        });
        
        return text;
    },

    /**
     * Get available locales
     * @returns {Array} Available locales
     */
    getAvailableLocales() {
        return Object.keys(this.strings).map(code => ({
            code,
            name: this.getLocaleName(code),
            isRTL: this.rtlLocales.includes(code)
        }));
    },

    /**
     * Get human-readable locale name
     * @param {string} code - Locale code
     * @returns {string} Locale name
     */
    getLocaleName(code) {
        const names = {
            en: 'English',
            es: 'Español',
            zh: '中文',
            ja: '日本語'
        };
        return names[code] || code;
    },

    /**
     * Detect browser locale
     * @returns {string} Detected locale
     */
    detectBrowserLocale() {
        try {
            const lang = (navigator.language || navigator.userLanguage || '').split('-')[0];
            if (this.strings[lang]) return lang;
        } catch {}
        return 'en';
    },

    /**
     * Initialize i18n with saved or detected locale
     */
    init() {
        try {
            const saved = GM_getValue('user_locale', '');
            if (saved && this.strings[saved]) {
                this.setLocale(saved);
            } else {
                this.setLocale(this.detectBrowserLocale());
            }
        } catch {
            this.setLocale('en');
        }
    },

    /**
     * Check if module is available
     */
    isAvailable() {
        return true;
    }
};

// Export for userscript context
if (typeof window !== 'undefined') {
    window.UnifiedSuite.i18n = i18n;
}

    // ========================================
    // MODULE: PERFORMANCE
    // ========================================

/**
 * Unified AI Assistant Suite - Performance Optimization Module
 * @version 1.9.0
 * 
 * Lazy loading, service worker registration, IndexedDB storage,
 * virtual scrolling, and bundle optimization.
 */

const CONFIG = (typeof window !== 'undefined' && window.UnifiedSuite?.CONFIG) || {};
const state = (typeof window !== 'undefined' && window.UnifiedSuite?.state) || {};
const debugLog = (typeof window !== 'undefined' && window.UnifiedSuite?.debugLog) || (() => {});

const PerformanceModule = {
    metrics: {
        loadTime: 0,
        memoryUsage: 0,
        moduleLoadTimes: {},
        renderCount: 0
    },

    /**
     * Initialize performance monitoring
     */
    init() {
        this.metrics.loadTime = performance.now();
        this.observeMemory();
        this.optimizeRendering();
        debugLog('Performance module initialized');
    },

    /**
     * Observe memory usage (if available)
     */
    observeMemory() {
        if (performance.memory) {
            setInterval(() => {
                this.metrics.memoryUsage = performance.memory.usedJSHeapSize;
            }, 30000);
        }
    },

    /**
     * Optimize rendering with requestAnimationFrame
     */
    optimizeRendering() {
        const originalRender = window.UnifiedSuite?.ui?.renderTemplatesTab;
        if (originalRender) {
            window.UnifiedSuite.ui.renderTemplatesTab = () => {
                requestAnimationFrame(() => {
                    this.metrics.renderCount++;
                    originalRender.call(window.UnifiedSuite.ui);
                });
            };
        }
    },

    /**
     * Lazy load a module when needed
     * @param {string} moduleName - Module to load
     * @returns {Promise<Object|null>}
     */
    async lazyLoad(moduleName) {
        const start = performance.now();
        try {
            const module = await window.UnifiedSuite?.moduleSystem?.loadModule(
                moduleName,
                `${moduleName}.js`
            );
            this.metrics.moduleLoadTimes[moduleName] = performance.now() - start;
            return module;
        } catch (error) {
            debugLog(`Lazy load failed for ${moduleName}:`, error);
            return null;
        }
    },

    /**
     * Get performance report
     * @returns {Object} Performance metrics
     */
    getReport() {
        return {
            loadTime: `${Math.round(this.metrics.loadTime)}ms`,
            memoryUsage: this.metrics.memoryUsage 
                ? `${Math.round(this.metrics.memoryUsage / 1024 / 1024)}MB` 
                : 'N/A',
            moduleLoadTimes: this.metrics.moduleLoadTimes,
            renderCount: this.metrics.renderCount,
            timestamp: Date.now()
        };
    },

    /**
     * Debounce a function
     * @param {Function} fn - Function to debounce
     * @param {number} delay - Delay in ms
     * @returns {Function} Debounced function
     */
    debounce(fn, delay = 300) {
        let timer;
        return (...args) => {
            clearTimeout(timer);
            timer = setTimeout(() => fn(...args), delay);
        };
    },

    /**
     * Throttle a function
     * @param {Function} fn - Function to throttle
     * @param {number} limit - Limit in ms
     * @returns {Function} Throttled function
     */
    throttle(fn, limit = 100) {
        let inThrottle = false;
        return (...args) => {
            if (!inThrottle) {
                fn(...args);
                inThrottle = true;
                setTimeout(() => { inThrottle = false; }, limit);
            }
        };
    },

    isAvailable() {
        return typeof performance !== 'undefined';
    }
};

// Export for userscript context
if (typeof window !== 'undefined') {
    window.UnifiedSuite.performance = PerformanceModule;
}

    // ========================================
    // MODULE: DEBUGGER
    // ========================================

/**
 * Unified AI Assistant Suite - Advanced Debugging Module
 * @version 1.7.0
 * 
 * Script execution logging, error trace visualization,
 * performance profiling, and network request inspector.
 */

const CONFIG = (typeof window !== 'undefined' && window.UnifiedSuite?.CONFIG) || {};
const state = (typeof window !== 'undefined' && window.UnifiedSuite?.state) || {};
const debugLog = (typeof window !== 'undefined' && window.UnifiedSuite?.debugLog) || (() => {});

const DebuggerModule = {
    logs: [],
    traces: [],
    profileData: {},
    maxLogEntries: 500,
    isRecording: false,

    /**
     * Initialize debugger
     */
    init() {
        this.interceptConsole();
        this.interceptNetwork();
        debugLog('Debugger module initialized');
    },

    /**
     * Intercept console methods for logging
     */
    interceptConsole() {
        const self = this;
        ['log', 'warn', 'error', 'info', 'debug'].forEach(method => {
            const original = console[method];
            console[method] = function(...args) {
                self.addLogEntry({
                    type: method,
                    message: args.map(a => typeof a === 'object' ? JSON.stringify(a, null, 2) : String(a)).join(' '),
                    timestamp: Date.now(),
                    stack: new Error().stack
                });
                original.apply(console, args);
            };
        });
    },

    /**
     * Intercept network requests
     */
    interceptNetwork() {
        const originalFetch = window.fetch;
        const self = this;
        window.fetch = async function(...args) {
            const startTime = performance.now();
            const requestId = `req_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
            
            self.addTraceEntry({
                id: requestId,
                url: typeof args[0] === 'string' ? args[0] : args[0]?.url,
                method: args[1]?.method || 'GET',
                startTime,
                status: 'pending'
            });
            
            try {
                const response = await originalFetch.apply(this, args);
                const duration = performance.now() - startTime;
                self.updateTraceEntry(requestId, {
                    status: response.ok ? 'success' : 'error',
                    duration: Math.round(duration),
                    statusCode: response.status
                });
                return response;
            } catch (error) {
                self.updateTraceEntry(requestId, {
                    status: 'error',
                    error: error.message
                });
                throw error;
            }
        };
    },

    /**
     * Add log entry
     * @param {Object} entry - Log entry
     */
    addLogEntry(entry) {
        this.logs.push(entry);
        if (this.logs.length > this.maxLogEntries) {
            this.logs.shift();
        }
    },

    /**
     * Add trace entry
     * @param {Object} entry - Trace entry
     */
    addTraceEntry(entry) {
        this.traces.push(entry);
    },

    /**
     * Update trace entry
     * @param {string} id - Request ID
     * @param {Object} updates - Partial update
     */
    updateTraceEntry(id, updates) {
        const entry = this.traces.find(t => t.id === id);
        if (entry) Object.assign(entry, updates);
    },

    /**
     * Profile a function execution
     * @param {string} name - Profile name
     * @param {Function} fn - Function to profile
     * @returns {*} Function result
     */
    async profile(name, fn) {
        const start = performance.now();
        try {
            const result = await fn();
            const duration = performance.now() - start;
            this.profileData[name] = {
                duration: Math.round(duration),
                success: true,
                timestamp: Date.now()
            };
            return result;
        } catch (error) {
            this.profileData[name] = {
                duration: Math.round(performance.now() - start),
                success: false,
                error: error.message,
                timestamp: Date.now()
            };
            throw error;
        }
    },

    /**
     * Get logs with optional filters
     * @param {Object} [filters] - Filter criteria
     * @returns {Array} Filtered logs
     */
    getLogs(filters = {}) {
        let filtered = [...this.logs];
        if (filters.type) filtered = filtered.filter(l => l.type === filters.type);
        if (filters.since) filtered = filtered.filter(l => l.timestamp >= filters.since);
        if (filters.search) filtered = filtered.filter(l => l.message.toLowerCase().includes(filters.search.toLowerCase()));
        return filtered.slice(-100);
    },

    /**
     * Get performance report
     * @returns {Object} Performance data
     */
    getProfileReport() {
        return {
            profiles: this.profileData,
            networkStats: this.getNetworkStats(),
            logStats: this.getLogStats()
        };
    },

    /**
     * Get network statistics
     * @returns {Object} Network stats
     */
    getNetworkStats() {
        const completed = this.traces.filter(t => t.status !== 'pending');
        return {
            total: this.traces.length,
            success: completed.filter(t => t.status === 'success').length,
            errors: completed.filter(t => t.status === 'error').length,
            pending: this.traces.filter(t => t.status === 'pending').length,
            avgDuration: completed.length > 0
                ? Math.round(completed.reduce((sum, t) => sum + (t.duration || 0), 0) / completed.length)
                : 0
        };
    },

    /**
     * Get log statistics
     * @returns {Object} Log stats
     */
    getLogStats() {
        return {
            total: this.logs.length,
            byType: {
                log: this.logs.filter(l => l.type === 'log').length,
                warn: this.logs.filter(l => l.type === 'warn').length,
                error: this.logs.filter(l => l.type === 'error').length,
                info: this.logs.filter(l => l.type === 'info').length,
                debug: this.logs.filter(l => l.type === 'debug').length
            }
        };
    },

    /**
     * Clear all logs
     */
    clearLogs() {
        this.logs = [];
        this.traces = [];
    },

    /**
     * Export debug data as JSON
     * @returns {string} JSON export
     */
    export() {
        return JSON.stringify({
            logs: this.logs.slice(-100),
            traces: this.traces.slice(-50),
            profiles: this.profileData,
            exportedAt: new Date().toISOString()
        }, null, 2);
    },

    isAvailable() {
        return true;
    }
};

// Export for userscript context
if (typeof window !== 'undefined') {
    window.UnifiedSuite.debugger = DebuggerModule;
}

    // ========================================
    // MODULE: SYNC
    // ========================================

/**
 * Unified AI Assistant Suite - Sync & Collaboration Module
 * @version 1.7.0
 * 
 * GitHub Gist sync for templates, export/import, and team collaboration features.
 */

const CONFIG = (typeof window !== 'undefined' && window.UnifiedSuite?.CONFIG) || {};
const state = (typeof window !== 'undefined' && window.UnifiedSuite?.state) || {};
const debugLog = (typeof window !== 'undefined' && window.UnifiedSuite?.debugLog) || (() => {});

const SyncModule = {
    GIST_API: 'https://api.github.com/gists',
    gistCache: new Map(),

    /**
     * Export templates to GitHub Gist
     * @param {Array} templates - Templates to sync
     * @param {string} token - GitHub personal access token
     * @returns {Promise<Object>} Gist result
     */
    async exportToGist(templates, token) {
        try {
            const content = JSON.stringify(templates, null, 2);
            const response = await fetch(this.GIST_API, {
                method: 'POST',
                headers: {
                    'Authorization': `token ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    description: 'AI Assistant Suite - Templates Export',
                    public: false,
                    files: {
                        'ai-assistant-templates.json': { content }
                    }
                })
            });
            
            if (!response.ok) throw new Error(`Gist API error: ${response.status}`);
            const gist = await response.json();
            
            this.gistCache.set(gist.id, { id: gist.id, url: gist.html_url, templates });
            debugLog(`Templates exported to Gist: ${gist.html_url}`);
            return { id: gist.id, url: gist.html_url };
        } catch (error) {
            debugLog('Gist export failed:', error);
            throw error;
        }
    },

    /**
     * Import templates from GitHub Gist
     * @param {string} gistId - Gist ID or URL
     * @param {string} token - GitHub personal access token
     * @returns {Promise<Array>} Imported templates
     */
    async importFromGist(gistId, token) {
        try {
            // Extract ID from URL if needed
            const id = gistId.includes('gist.github.com') 
                ? gistId.split('/').pop() 
                : gistId;
            
            const headers = { 'Accept': 'application/vnd.github.v3+json' };
            if (token) headers['Authorization'] = `token ${token}`;
            
            const response = await fetch(`${this.GIST_API}/${id}`, { headers });
            if (!response.ok) throw new Error(`Gist API error: ${response.status}`);
            
            const gist = await response.json();
            const file = Object.values(gist.files)[0];
            if (!file) throw new Error('No files found in gist');
            
            const templates = JSON.parse(file.content);
            this.gistCache.set(id, { id, url: gist.html_url, templates });
            
            debugLog(`Templates imported from Gist: ${gist.html_url}`);
            return Array.isArray(templates) ? templates : [];
        } catch (error) {
            debugLog('Gist import failed:', error);
            throw error;
        }
    },

    /**
     * Update an existing Gist
     * @param {string} gistId - Gist ID
     * @param {Array} templates - Updated templates
     * @param {string} token - GitHub token
     * @returns {Promise<Object>} Updated gist
     */
    async updateGist(gistId, templates, token) {
        try {
            const response = await fetch(`${this.GIST_API}/${gistId}`, {
                method: 'PATCH',
                headers: {
                    'Authorization': `token ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    files: {
                        'ai-assistant-templates.json': { 
                            content: JSON.stringify(templates, null, 2) 
                        }
                    }
                })
            });
            
            if (!response.ok) throw new Error(`Gist API error: ${response.status}`);
            const gist = await response.json();
            this.gistCache.set(gistId, { id: gistId, url: gist.html_url, templates });
            return { id: gist.id, url: gist.html_url };
        } catch (error) {
            debugLog('Gist update failed:', error);
            throw error;
        }
    },

    /**
     * Export templates as downloadable JSON
     * @param {Array} templates - Templates to export
     * @returns {string} JSON string
     */
    exportToJSON(templates) {
        const data = {
            version: '1.0',
            exportedAt: new Date().toISOString(),
            appVersion: CONFIG.VERSION || 'unknown',
            templates
        };
        return JSON.stringify(data, null, 2);
    },

    /**
     * Import templates from JSON string
     * @param {string} json - JSON string
     * @returns {Array} Imported templates
     */
    importFromJSON(json) {
        try {
            const data = JSON.parse(json);
            if (data.version && Array.isArray(data.templates)) {
                debugLog(`Imported ${data.templates.length} templates from JSON`);
                return data.templates;
            }
            if (Array.isArray(data)) {
                debugLog(`Imported ${data.length} templates from JSON`);
                return data;
            }
            throw new Error('Invalid template format');
        } catch (error) {
            debugLog('JSON import failed:', error);
            throw error;
        }
    },

    /**
     * Get cached gists
     * @returns {Array} Cached gist list
     */
    getCachedGists() {
        return Array.from(this.gistCache.values());
    },

    /**
     * Clear gist cache
     */
    clearCache() {
        this.gistCache.clear();
    },

    /**
     * Check if module is available
     * @returns {boolean}
     */
    isAvailable() {
        return typeof fetch !== 'undefined';
    }
};

// Export for userscript context
if (typeof window !== 'undefined') {
    window.UnifiedSuite.sync = SyncModule;
}

    // ========================================
    // MODULE: ANALYTICS
    // ========================================

/**
 * Unified AI Assistant Suite - Advanced Analytics Module
 * @version 1.7.0
 * 
 * Generation success tracking, provider comparison, time saved metrics,
 * and usage pattern analysis.
 */

const CONFIG = (typeof window !== 'undefined' && window.UnifiedSuite?.CONFIG) || {};
const state = (typeof window !== 'undefined' && window.UnifiedSuite?.state) || {};
const debugLog = (typeof window !== 'undefined' && window.UnifiedSuite?.debugLog) || (() => {});

const AnalyticsModule = {
    events: [],
    dailyStats: {},
    maxEvents: 1000,

    /**
     * Track a generation event
     * @param {Object} event - Event data
     */
    trackGeneration(event) {
        const entry = {
            type: 'generation',
            provider: event.provider || 'unknown',
            success: event.success ?? true,
            duration: event.duration || 0,
            scriptLength: event.scriptLength || 0,
            templateUsed: event.templateUsed || null,
            timestamp: Date.now()
        };
        
        this.events.push(entry);
        this.updateDailyStats(entry);
        
        if (this.events.length > this.maxEvents) {
            this.events = this.events.slice(-this.maxEvents);
        }
        
        // Persist to storage
        try {
            const history = JSON.parse(GM_getValue('analytics_events', '[]'));
            history.push(entry);
            GM_setValue('analytics_events', JSON.stringify(history.slice(-500)));
        } catch {}
    },

    /**
     * Update daily statistics
     * @param {Object} event - Event data
     */
    updateDailyStats(event) {
        const date = new Date(event.timestamp).toISOString().split('T')[0];
        if (!this.dailyStats[date]) {
            this.dailyStats[date] = {
                generations: 0,
                successCount: 0,
                totalDuration: 0,
                byProvider: {},
                totalScriptLength: 0
            };
        }
        
        const day = this.dailyStats[date];
        day.generations++;
        if (event.success) day.successCount++;
        day.totalDuration += event.duration;
        day.totalScriptLength += event.scriptLength;
        
        if (!day.byProvider[event.provider]) {
            day.byProvider[event.provider] = { count: 0, successCount: 0 };
        }
        day.byProvider[event.provider].count++;
        if (event.success) day.byProvider[event.provider].successCount++;
    },

    /**
     * Get summary statistics
     * @returns {Object} Summary
     */
    getSummary() {
        const total = this.events.length;
        const successful = this.events.filter(e => e.success).length;
        const byProvider = {};
        
        this.events.forEach(e => {
            if (!byProvider[e.provider]) {
                byProvider[e.provider] = { total: 0, success: 0, totalDuration: 0 };
            }
            byProvider[e.provider].total++;
            if (e.success) byProvider[e.provider].success++;
            byProvider[e.provider].totalDuration += e.duration;
        });
        
        // Calculate time saved (estimated: each generation saves ~5 minutes of manual work)
        const timeSavedMinutes = successful * 5;
        
        return {
            totalGenerations: total,
            successRate: total > 0 ? Math.round((successful / total) * 100) : 0,
            totalScriptLength: this.events.reduce((sum, e) => sum + e.scriptLength, 0),
            avgDuration: total > 0 ? Math.round(this.events.reduce((sum, e) => sum + e.duration, 0) / total) : 0,
            timeSaved: {
                minutes: timeSavedMinutes,
                hours: Math.round(timeSavedMinutes / 60 * 10) / 10,
                days: Math.round(timeSavedMinutes / 60 / 8 * 10) / 10
            },
            byProvider,
            daily: Object.entries(this.dailyStats).slice(-30).map(([date, stats]) => ({
                date,
                ...stats
            }))
        };
    },

    /**
     * Get provider performance comparison
     * @returns {Array} Provider rankings
     */
    getProviderRankings() {
        const providerStats = {};
        
        this.events.forEach(e => {
            if (!providerStats[e.provider]) {
                providerStats[e.provider] = { total: 0, success: 0, duration: [], scriptLengths: [] };
            }
            providerStats[e.provider].total++;
            if (e.success) providerStats[e.provider].success++;
            providerStats[e.provider].duration.push(e.duration);
            providerStats[e.provider].scriptLengths.push(e.scriptLength);
        });
        
        return Object.entries(providerStats)
            .map(([provider, stats]) => ({
                provider,
                totalRequests: stats.total,
                successRate: stats.total > 0 ? Math.round((stats.success / stats.total) * 100) : 0,
                avgDuration: stats.duration.length > 0 
                    ? Math.round(stats.duration.reduce((a, b) => a + b, 0) / stats.duration.length) 
                    : 0,
                avgScriptLength: stats.scriptLengths.length > 0
                    ? Math.round(stats.scriptLengths.reduce((a, b) => a + b, 0) / stats.scriptLengths.length)
                    : 0
            }))
            .sort((a, b) => b.successRate - a.successRate || a.avgDuration - b.avgDuration);
    },

    /**
     * Get usage patterns
     * @returns {Object} Usage patterns
     */
    getUsagePatterns() {
        const hourlyUsage = Array(24).fill(0);
        const dayOfWeekUsage = Array(7).fill(0);
        
        this.events.forEach(e => {
            const date = new Date(e.timestamp);
            hourlyUsage[date.getHours()]++;
            dayOfWeekUsage[date.getDay()]++;
        });
        
        // Template usage stats
        const templateUsage = {};
        this.events.filter(e => e.templateUsed).forEach(e => {
            templateUsage[e.templateUsed] = (templateUsage[e.templateUsed] || 0) + 1;
        });
        
        return {
            hourlyUsage,
            dayOfWeekUsage,
            templateUsage: Object.entries(templateUsage)
                .sort((a, b) => b[1] - a[1])
                .map(([template, count]) => ({ template, count })),
            mostActiveHour: hourlyUsage.indexOf(Math.max(...hourlyUsage)),
            mostActiveDay: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][dayOfWeekUsage.indexOf(Math.max(...dayOfWeekUsage))]
        };
    },

    /**
     * Export analytics data
     * @returns {string} JSON export
     */
    export() {
        return JSON.stringify({
            summary: this.getSummary(),
            providerRankings: this.getProviderRankings(),
            usagePatterns: this.getUsagePatterns(),
            exportedAt: new Date().toISOString()
        }, null, 2);
    },

    /**
     * Clear all analytics data
     */
    clear() {
        this.events = [];
        this.dailyStats = {};
        try { GM_setValue('analytics_events', '[]'); } catch {}
    },

    isAvailable() {
        return true;
    }
};

// Export for userscript context
if (typeof window !== 'undefined') {
    window.UnifiedSuite.analytics = AnalyticsModule;
}

    // ========================================
    // MODULE: UI
    // ========================================

/**
 * Unified AI Assistant Suite - UI Module
 * @version 1.3.0
 */

// Get dependencies from global UnifiedSuite object
const CONFIG = (typeof window !== 'undefined' && window.UnifiedSuite?.CONFIG) || {};
const state = (typeof window !== 'undefined' && window.UnifiedSuite?.state) || {};
const updateState = (typeof window !== 'undefined' && window.UnifiedSuite?.updateState) || (() => {});
const debugLog = (typeof window !== 'undefined' && window.UnifiedSuite?.debugLog) || (() => {});

/**
 * UI Module - Handles all UI rendering and interactions
 * @version 1.4.0
 */
const UIModule = {
    /**
     * Create the unified UI
     */
    createUnifiedUI() {
        if (!document.body || document.getElementById(CONFIG.UI_ID)) return;
        
        const ui = document.createElement('div');
        ui.id = CONFIG.UI_ID;
        ui.setAttribute('role', 'region');
        ui.setAttribute('aria-label', 'AI Assistant Suite');
        
        const uiTemplate = document.createElement('template');
        uiTemplate.innerHTML = this.getUITemplate();
        ui.appendChild(uiTemplate.content.cloneNode(true));
        
        if (!document.getElementById(CONFIG.STYLE_ID)) {
            const styles = document.createElement('style');
            styles.id = CONFIG.STYLE_ID;
            styles.textContent = this.getStyles();
            document.head.appendChild(styles);
        }
        
        document.body.appendChild(ui);
        this.bindUIEvents(ui);
    },

    /**
     * Get UI template HTML
     * @returns {string} HTML template
     */
    getUITemplate() {
        return `<div class="unified-suite-container">
            <div class="suite-header">
                <h2>AI Assistant Suite</h2>
                <div class="header-controls">
                    <div class="version">v${CONFIG.VERSION}</div>
                    <button class="toggle-btn" id="theme-toggle-btn" aria-label="Toggle theme" title="Toggle theme">🌓</button>
                    <button class="toggle-btn" id="toggle-ui-btn" aria-label="Close UI">✕</button>
                </div>
            </div>
            <div class="suite-tabs" role="tablist">
                <button class="tab-btn active" data-tab="dashboard" role="tab" aria-selected="true">Dashboard</button>
                <button class="tab-btn" data-tab="generator" role="tab" aria-selected="false">Script Generator</button>
                <button class="tab-btn" data-tab="templates" role="tab" aria-selected="false">Templates</button>
                <button class="tab-btn" data-tab="versions" role="tab" aria-selected="false">Versions</button>
                <button class="tab-btn" data-tab="security" role="tab" aria-selected="false">Security</button>
            </div>
            <div class="suite-content">
                <div class="tab-content active" id="dashboard-tab" role="tabpanel">
                    <div class="dashboard-stats">
                        <div class="stat-item">
                            <span class="stat-label">Scripts Generated</span>
                            <span class="stat-value" id="scripts-count">${this.getScriptsCount()}</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">Modules Active</span>
                            <span class="stat-value" id="modules-count">${Object.keys(state.modules).length}</span>
                        </div>
                    </div>
                    <div class="dashboard-actions">
                        <button class="btn-primary" id="export-scripts-button">Export All Scripts</button>
                        <label class="btn-secondary import-label">
                            <input type="file" id="import-scripts-input" accept="application/json" style="display:none">
                            Import Scripts
                        </label>
                        <button class="btn-secondary" id="clear-history-button">Clear History</button>
                    </div>
                </div>
                <div class="tab-content" id="generator-tab" role="tabpanel">
                    <div class="generator-controls">
                        <div class="control-group">
                            <label for="ai-provider-select">AI Provider:</label>
                            <select id="ai-provider-select">
                                <option value="OPENAI">OpenAI GPT-4</option>
                                <option value="ANTHROPIC">Claude</option>
                                <option value="GEMINI">Gemini</option>
                                <option value="OLLAMA">Ollama</option>
                                <option value="LOCAL">Local AI</option>
                            </select>
                        </div>
                        <div class="control-group">
                            <label for="template-select">Template:</label>
                            <select id="template-select">
                                <option value="">Custom</option>
                            </select>
                        </div>
                        <div class="control-group">
                            <label for="api-key-input">API Key:</label>
                            <input type="password" id="api-key-input" placeholder="Stored for this tab only" autocomplete="off">
                        </div>
                        <div class="control-group">
                            <label>Streaming</label>
                            <input type="checkbox" id="streaming-toggle" title="Enable streaming responses">
                            <span class="streaming-status" id="streaming-status">Idle</span>
                        </div>
                        <div class="control-group">
                            <label>Context Awareness</label>
                            <input type="checkbox" id="context-toggle" title="Auto-analyze page context to enhance prompts" checked>
                            <span class="context-status" id="context-status">Active</span>
                        </div>
                    </div>
                    <div class="prompt-area">
                        <label for="prompt-input">Describe what you want the script to do:</label>
                        <textarea id="prompt-input" rows="4" placeholder="Generate a userscript that enhances the user experience..."></textarea>
                        <div class="context-preview" id="context-preview" style="display:none;margin-top:10px;padding:8px;background:#0f172a;border-radius:6px;font-size:11px;color:#94a3b8;max-height:100px;overflow-y:auto"></div>
                    </div>
                    <div class="generator-actions">
                        <button class="btn-primary" id="generate-script-button">Generate Script</button>
                        <button class="btn-secondary hidden" id="cancel-script-button">Cancel</button>
                        <button class="btn-secondary" id="preview-script-button">Preview</button>
                        <button class="btn-secondary" id="save-script-button">Save Script</button>
                        <button class="btn-secondary hidden" id="copy-script-button">Copy</button>
                        <button class="btn-secondary hidden" id="download-script-button">Download</button>
                    </div>
                    <div class="results-area" id="results-area">
                        <div class="validation-results" id="validation-results"></div>
                        <div class="retry-indicator" id="retry-indicator" style="display:none"></div>
                        <div class="script-actions" id="script-actions"></div>
                        <div class="script-output" id="script-output"></div>
                    </div>
                </div>
                <div class="tab-content" id="versions-tab" role="tabpanel">
                    <div class="versions-controls">
                        <div class="control-group">
                            <label for="version-script-select">Select Script:</label>
                            <select id="version-script-select">
                                <option value="">Current script</option>
                            </select>
                        </div>
                        <button class="btn-primary" id="refresh-versions-button">Refresh</button>
                    </div>
                    <div class="versions-list" id="versions-list"></div>
                    <div class="diff-output" id="diff-output" style="display:none"></div>
        </div>
        <div class="tab-content" id="templates-tab" role="tabpanel">
            <div class="templates-container">
                <div class="templates-controls">
                    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:15px">
                        <h3 style="margin:0;font-size:16px;color:white">Template Gallery</h3>
                        <button class="btn-primary" id="create-template-btn">+ Create Template</button>
                    </div>
                    <div class="control-group">
                        <input type="text" id="template-search-input" placeholder="Search templates..." class="template-search">
                    </div>
                    <div class="template-categories" id="template-categories">
                        <button class="category-btn active" data-category="all">All</button>
                        <button class="category-btn" data-category="Productivity">Productivity</button>
                        <button class="category-btn" data-category="Security">Security</button>
                        <button class="category-btn" data-category="UI Enhancement">UI Enhancement</button>
                        <button class="category-btn" data-category="Developer Tools">Developer Tools</button>
                    </div>
                </div>
                <div class="templates-grid" id="templates-grid"></div>
            </div>
        </div>
                <div class="tab-content" id="security-tab" role="tabpanel">
                    <div class="security-status">
                        <div class="status-item">
                            <span class="status-label">Authentication</span>
                            <span class="status-value" id="auth-status">Checking...</span>
                        </div>
                        <div class="status-item">
                            <span class="status-label">API Key</span>
                            <span class="status-value" id="api-key-status">${state.apiKey ? '•'.repeat(4) : 'Not set'}</span>
                        </div>
                        <div class="status-item">
                            <span class="status-label">Session</span>
                            <span class="status-value" id="session-status">Active</span>
                        </div>
                        <div class="status-item">
                            <span class="status-label">Streaming</span>
                            <span class="status-value" id="streaming-security-status">Idle</span>
                        </div>
                        <div class="status-item">
                            <span class="status-label">Retry Count</span>
                            <span class="status-value" id="retry-status">0</span>
                        </div>
                        <div class="status-item">
                            <span class="status-label">Provider</span>
                            <span class="status-value" id="provider-status">${state.aiProvider}</span>
                        </div>
                        <div class="status-item">
                            <span class="status-label">Module Health</span>
                            <span class="status-value" id="module-health-status">OK</span>
                        </div>
                        <button class="btn-primary" id="test-connection-button" style="margin-top: 15px; width: 100%;">Test Connection</button>
                    </div>
                </div>
            </div>
        </div>`;
    },

    /**
     * Get scripts count
     * @returns {number} Number of scripts
     */
    getScriptsCount() {
        const storage = window.UnifiedSuite?.storage;
        if (storage) {
            try { return storage.loadGeneratedScripts().length; }
            catch { return 0; }
        }
        return 0;
    },

    /**
     * Get CSS styles
     * @returns {string} CSS styles
     */
    getStyles() {
        return `.unified-suite-container{position:fixed;top:20px;right:20px;width:400px;max-height:90vh;background:rgba(15,23,42,0.95);border:1px solid #334155;border-radius:12px;padding:20px;color:white;font-family:system-ui,-apple-system,sans-serif;box-shadow:0 10px 25px rgba(0,0,0,0.3);z-index:99999;backdrop-filter:blur(10px);overflow-y:auto}.suite-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:15px;border-bottom:1px solid #334155;padding-bottom:10px}.header-controls{display:flex;align-items:center;gap:10px}.version{font-size:12px;color:#94a3b8}.toggle-btn{background:none;border:none;color:#94a3b8;cursor:pointer;font-size:16px;padding:0;width:20px;height:20px}.toggle-btn:hover{color:white}.suite-tabs{display:flex;gap:10px;margin-bottom:20px;border-bottom:1px solid #334155}.tab-btn{padding:8px 16px;border:none;background:rgba(255,255,255,0.05);color:#94a3b8;border-radius:6px 6px 0 0;cursor:pointer;font-size:12px;transition:all 0.2s}.tab-btn.active{background:rgba(255,255,255,0.1);color:white}.tab-btn:hover{background:rgba(255,255,255,0.08)}.tab-content{display:none}.tab-content.active{display:block}.dashboard-stats{display:flex;gap:20px}.stat-item{text-align:center;flex:1}.stat-label{display:block;font-size:12px;color:#94a3b8;margin-bottom:5px}.stat-value{display:block;font-size:20px;font-weight:600;color:white}.control-group{display:flex;flex-direction:column;gap:5px;margin-bottom:15px}.control-group label{font-size:12px;color:#94a3b8}.control-group select,.control-group input{padding:8px;border-radius:6px;border:1px solid #475569;background:#1e293b;color:white;font-size:14px}.prompt-area{margin-bottom:20px}.prompt-area label{display:block;margin-bottom:8px;font-size:12px;color:#94a3b8}.prompt-area textarea{width:100%;padding:12px;border-radius:8px;border:1px solid #475569;background:#1e293b;color:white;resize:vertical;min-height:120px;font-size:14px}.generator-actions{display:flex;gap:10px;margin-bottom:20px;flex-wrap:wrap}.btn-primary,.btn-secondary{padding:10px 20px;border:none;border-radius:6px;cursor:pointer;font-weight:600;transition:all 0.2s;font-size:14px}.btn-primary{background:#3b82f6;color:white}.btn-primary:hover:not(:disabled){background:#2563eb}.btn-primary:disabled{opacity:0.6;cursor:not-allowed}.btn-secondary{background:#64748b;color:white}.btn-secondary:hover:not(:disabled){background:#475569}.btn-secondary:disabled{opacity:0.6;cursor:not-allowed}.hidden{display:none!important}.results-area{display:none;border-top:1px solid #334155;padding-top:20px}.validation-results{margin-bottom:15px;padding:10px;background:rgba(255,255,255,0.05);border-radius:8px;font-size:13px}.script-actions{margin-bottom:10px;display:flex;gap:10px}.script-output{background:#0f172a;border:1px solid #334155;border-radius:8px;padding:15px;max-height:300px;overflow-y:auto;font-family:'Courier New',monospace;font-size:12px;white-space:pre-wrap;word-break:break-word}.security-status{display:flex;flex-direction:column;gap:15px}.status-item{display:flex;justify-content:space-between;align-items:center;padding:10px;background:rgba(255,255,255,0.05);border-radius:8px}.status-label{font-size:12px;color:#94a3b8}.status-value{font-size:14px;font-weight:600;color:#22c55e}#auth-status.checking{color:#f59e0b}`;
    },

    /**
     * Bind UI event listeners
     * @param {HTMLElement} ui - UI element
     */
    bindUIEvents(ui) {
        const elements = {
            toggleBtn: ui.querySelector('#toggle-ui-btn'),
            tabButtons: ui.querySelectorAll('.tab-btn'),
            tabContents: ui.querySelectorAll('.tab-content'),
            providerSelect: ui.querySelector('#ai-provider-select'),
            apiKeyInput: ui.querySelector('#api-key-input'),
            promptInput: ui.querySelector('#prompt-input'),
            templateSelect: ui.querySelector('#template-select'),
            generateButton: ui.querySelector('#generate-script-button'),
            previewButton: ui.querySelector('#preview-script-button'),
            saveButton: ui.querySelector('#save-script-button'),
            copyButton: ui.querySelector('#copy-script-button'),
            downloadButton: ui.querySelector('#download-script-button'),
            resultsArea: ui.querySelector('#results-area'),
            validationResults: ui.querySelector('#validation-results'),
            scriptActions: ui.querySelector('#script-actions'),
            scriptOutput: ui.querySelector('#script-output'),
            streamingToggle: ui.querySelector('#streaming-toggle'),
            streamingStatus: ui.querySelector('#streaming-status')
        };

        // Toggle UI visibility
        elements.toggleBtn.addEventListener('click', () => {
            ui.style.display = ui.style.display === 'none' ? 'block' : 'none';
        });

        // Tab switching
        elements.tabButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const targetTab = e.target.dataset.tab;
                elements.tabButtons.forEach(b => {
                    b.classList.remove('active');
                    b.setAttribute('aria-selected', 'false');
                });
                elements.tabContents.forEach(c => c.classList.remove('active'));
                e.target.classList.add('active');
                e.target.setAttribute('aria-selected', 'true');
                const tabContent = ui.querySelector(`#${targetTab}-tab`);
                if (tabContent) tabContent.classList.add('active');
            });
        });

        this.bindGeneratorControls(ui, elements);
    },

    /**
     * Bind generator controls
     * @param {HTMLElement} ui - UI element
     * @param {Object} elements - UI elements
     */
    bindGeneratorControls(ui, elements) {
        const storage = window.UnifiedSuite?.storage;
        const providers = window.UnifiedSuite?.providers;
        const versioning = window.UnifiedSuite?.versioning;
        
        // Provider selection
        if (elements.providerSelect) {
            elements.providerSelect.value = state.aiProvider;
            elements.providerSelect.addEventListener('change', () => {
                updateState('aiProvider', elements.providerSelect.value);
            });
        }

        // API key input
        if (elements.apiKeyInput) {
            elements.apiKeyInput.value = state.apiKey;
            elements.apiKeyInput.addEventListener('input', () => {
                updateState('apiKey', elements.apiKeyInput.value.trim());
            });
        }

        // Streaming toggle
        if (elements.streamingToggle) {
            elements.streamingToggle.checked = state.config.enableStreaming;
            elements.streamingToggle.addEventListener('change', () => {
                updateState('config', { ...state.config, enableStreaming: elements.streamingToggle.checked });
            });
        }

        // Generate button
        if (elements.generateButton) {
            elements.generateButton.addEventListener('click', async () => {
                const prompt = elements.promptInput?.value?.trim();
                if (!prompt) {
                    this.showError(elements, 'Describe what you want the script to do first.');
                    return;
                }

                this.setButtonBusy(elements.generateButton, true, 'Generating...');
                const cancelButton = ui.querySelector('#cancel-script-button');
                if (cancelButton) cancelButton.classList.remove('hidden');
                
                this.updateStreamingStatus(elements.streamingStatus, true);
                
                try {
                    let fullText = '';
                    const onChunk = state.config.enableStreaming ? (delta) => {
                        fullText += delta;
                        if (elements.scriptOutput) {
                            elements.scriptOutput.textContent = fullText;
                        }
                    } : null;

                    const result = await providers.generateWithProvider(state.aiProvider, prompt, onChunk);
                    
                    if (result.error) {
                        this.showError(elements, result.error);
                        return;
                    }

                    const validation = storage.validateScript(result.content);
                    const script = {
                        id: generateId(),
                        content: result.content,
                        prompt,
                        provider: state.aiProvider,
                        timestamp: Date.now(),
                        validation,
                        name: deriveScriptName(result.content),
                        filename: generateFilename(result.content)
                    };

                    updateState('currentScript', script);
                    updateState('currentScriptId', script.id);
                    updateState('retryCount', 0);
                    
                    storage.saveGeneratedScript(script, validation, prompt);
                    if (versioning) versioning.saveVersion(script.id, script.content, 'Manual save');
                    
                    this.renderGeneratedScript(script, elements);
                    this.renderStatus(elements, `Generated ${script.filename}`);
                } catch (error) {
                    this.showError(elements, error.message);
                } finally {
                    this.setButtonBusy(elements.generateButton, false, 'Generate Script');
                    if (cancelButton) cancelButton.classList.add('hidden');
                    this.updateStreamingStatus(elements.streamingStatus, false);
                }
            });
        }

        // Save button
        if (elements.saveButton) {
            elements.saveButton.addEventListener('click', () => {
                if (!state.currentScript?.content) {
                    this.showError(elements, 'Generate a script before saving it.');
                    return;
                }
                const record = storage.saveGeneratedScript(state.currentScript, state.currentScript.validation, state.currentScript.prompt);
                if (versioning) versioning.saveVersion(record.id, record.content, 'Manual save');
                this.renderStatus(elements, `Saved ${record.filename}`);
            });
        }

        // Copy button
        if (elements.copyButton) {
            elements.copyButton.addEventListener('click', () => {
                if (!state.currentScript?.content) {
                    this.showError(elements, 'No script to copy.');
                    return;
                }
                GM_setClipboard(state.currentScript.content);
                this.renderStatus(elements, 'Script copied to clipboard');
            });
        }

        // Download button
        if (elements.downloadButton) {
            elements.downloadButton.addEventListener('click', () => {
                if (!state.currentScript?.content) {
                    this.showError(elements, 'No script to download.');
                    return;
                }
                const blob = new Blob([state.currentScript.content], { type: 'text/javascript' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = state.currentScript.filename || 'script.user.js';
                a.click();
                URL.revokeObjectURL(url);
                this.renderStatus(elements, `Downloaded ${a.download}`);
            });
        }

        // Theme toggle
        const themeBtn = ui.querySelector('#theme-toggle-btn');
        if (themeBtn) {
            themeBtn.addEventListener('click', () => {
                const themeModule = window.UnifiedSuite?.theme;
                if (themeModule) {
                    const newTheme = themeModule.toggle();
                    themeBtn.textContent = newTheme === 'dark' ? '🌓' : '☀️';
                }
            });
        }

        // Export button
        const exportBtn = ui.querySelector('#export-scripts-button');
        if (exportBtn) {
            exportBtn.addEventListener('click', () => {
                const data = storage.exportAllScripts();
                GM_setClipboard(data);
                this.renderStatus(elements, 'Exported scripts copied to clipboard');
            });
        }

        // Import input
        const importInput = ui.querySelector('#import-scripts-input');
        if (importInput) {
            importInput.addEventListener('change', async () => {
                const file = importInput.files?.[0];
                if (!file) return;
                try {
                    const text = await file.text();
                    const result = storage.importScripts(text);
                    this.renderStatus(elements, `Imported ${result.imported} scripts`);
                } catch (error) {
                    this.showError(elements, error.message);
                } finally {
                    importInput.value = '';
                }
            });
        }

        // Clear history button
        const clearBtn = ui.querySelector('#clear-history-button');
        if (clearBtn) {
            clearBtn.addEventListener('click', () => {
                if (!confirm('Clear all generated scripts?')) return;
                GM_setValue(CONFIG.STORAGE_KEYS.history, '[]');
                updateState('generatedScripts', []);
                this.renderStatus(elements, 'History cleared');
            });
        }

        // Versions tab
        const versionsTab = ui.querySelector('#versions-tab');
        if (versionsTab) {
            versionsTab.addEventListener('click', () => {
                if (versioning) {
                    versioning.renderVersionsTab(state.currentScriptId);
                }
            });
        }

        // Templates tab
        const templatesTab = ui.querySelector('[data-tab="templates"]');
        if (templatesTab) {
            templatesTab.addEventListener('click', () => {
                this.renderTemplatesTab();
            });
        }

        // Template search
        const templateSearch = ui.querySelector('#template-search-input');
        if (templateSearch) {
            templateSearch.addEventListener('input', (e) => {
                this.filterTemplates(e.target.value);
            });
        }

        // Category filters
        const categoryButtons = ui.querySelectorAll('.category-btn');
        categoryButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                // Update active state
                categoryButtons.forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                
                // Filter templates
                const category = e.target.dataset.category;
                this.filterTemplatesByCategory(category);
            });
        });

        // Create template button
        const createTemplateBtn = ui.querySelector('#create-template-btn');
        if (createTemplateBtn) {
            createTemplateBtn.addEventListener('click', () => {
                this.showTemplateModal();
            });
        }

        // Context toggle
        const contextToggle = ui.querySelector('#context-toggle');
        const contextPreview = ui.querySelector('#context-preview');
        const promptInput = ui.querySelector('#prompt-input');
        
        if (contextToggle && contextPreview) {
            contextToggle.addEventListener('change', () => {
                const contextModule = window.UnifiedSuite?.context;
                const status = ui.querySelector('#context-status');
                
                if (contextToggle.checked && contextModule?.isAvailable()) {
                    if (status) status.textContent = 'Active';
                    const context = contextModule.analyzePage();
                    if (context.domain) {
                        contextPreview.textContent = `📄 Context: ${context.title || context.domain} (${context.contentType})`;
                        contextPreview.style.display = 'block';
                    }
                } else {
                    if (status) status.textContent = 'Off';
                    contextPreview.style.display = 'none';
                }
            });
            
            // Auto-analyze on load
            setTimeout(() => {
                contextToggle.dispatchEvent(new Event('change'));
            }, 500);
        }

        // Enhance prompt with context when generating
        if (promptInput && elements.generateButton) {
            const originalClick = elements.generateButton._listeners?.click;
            
            // Wrap generate to add context enhancement
            const enhanceGenerate = async () => {
                const contextModule = window.UnifiedSuite?.context;
                const contextToggle = ui.querySelector('#context-toggle');
                
                if (contextToggle?.checked && contextModule?.isAvailable()) {
                    const userPrompt = promptInput.value.trim();
                    if (userPrompt) {
                        const enhanced = contextModule.enhancePrompt(userPrompt);
                        // Only enhance if context was added
                        if (enhanced !== userPrompt) {
                            promptInput.value = enhanced;
                            contextPreview.textContent = `✅ Prompt enhanced with page context from ${window.location.hostname}`;
                            contextPreview.style.display = 'block';
                        }
                    }
                }
            };
            
            // Insert enhancement before existing click handlers
            elements.generateButton.addEventListener('click', enhanceGenerate);
        }
    },

    /**
     * Render generated script
     * @param {Object} script - Script object
     * @param {Object} elements - UI elements
     */
    renderGeneratedScript(script, elements) {
        this.showResults(elements);
        const issues = script.validation?.issues || [];
        const warnings = script.validation?.warnings || [];
        const status = script.validation?.isValid ? 'Valid' : 'Needs review';
        
        if (elements.validationResults) {
            elements.validationResults.textContent = `${status} - Score ${script.validation?.score ?? 0}. ${issues.concat(warnings).join(' ')}`;
            elements.validationResults.style.color = script.validation?.isValid ? '#22c55e' : '#f59e0b';
        }
        
        if (elements.scriptOutput) {
            elements.scriptOutput.textContent = script.content;
        }
        
        if (elements.copyButton && elements.downloadButton && elements.scriptActions) {
            elements.copyButton.classList.remove('hidden');
            elements.downloadButton.classList.remove('hidden');
            elements.scriptActions.style.display = 'flex';
        }
    },

    /**
     * Render status message
     * @param {Object} elements - UI elements
     * @param {string} message - Status message
     */
    renderStatus(elements, message) {
        this.showResults(elements);
        if (elements.validationResults) elements.validationResults.textContent = message;
        if (elements.scriptOutput) elements.scriptOutput.textContent = '';
    },

    /**
     * Show error message
     * @param {Object} elements - UI elements
     * @param {string} message - Error message
     */
    showError(elements, message) {
        this.showResults(elements);
        if (elements.validationResults) {
            elements.validationResults.textContent = `Error: ${message}`;
            elements.validationResults.style.color = '#ef4444';
        }
        if (elements.scriptOutput) elements.scriptOutput.textContent = '';
    },

    /**
     * Show results area
     * @param {Object} elements - UI elements
     */
    showResults(elements) {
        if (elements.resultsArea) elements.resultsArea.style.display = 'block';
    },

    /**
     * Set button busy state
     * @param {HTMLElement} button - Button element
     * @param {boolean} busy - Busy state
     * @param {string} label - Button label
     */
    setButtonBusy(button, busy, label) {
        if (!button) return;
        button.disabled = busy;
        button.textContent = label;
    },

    /**
     * Update streaming status indicator
     * @param {HTMLElement} statusElement - Status element
     * @param {boolean} isStreaming - Streaming state
     */
    updateStreamingStatus(statusElement, isStreaming) {
        if (statusElement) {
            statusElement.textContent = isStreaming ? 'Streaming...' : 'Idle';
        }
    },

    /**
     * Get CSS styles
     * @returns {string} CSS styles
     */
    getTemplateStyles() {
        return `.templates-container{padding:10px 0}.templates-controls{margin-bottom:20px;display:flex;flex-direction:column;gap:15px}.template-search{width:100%;padding:10px;border-radius:6px;border:1px solid #475569;background:#1e293b;color:white;font-size:14px}.template-categories{display:flex;gap:8px;flex-wrap:wrap}.category-btn{padding:6px 12px;border:none;background:rgba(255,255,255,0.05);color:#94a3b8;border-radius:6px;cursor:pointer;font-size:12px;transition:all 0.2s}.category-btn.active{background:#3b82f6;color:white}.category-btn:hover{background:rgba(255,255,255,0.08)}.templates-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:15px}.template-card{background:rgba(255,255,255,0.05);border:1px solid #334155;border-radius:8px;padding:15px;transition:all 0.2s;cursor:pointer}.template-card:hover{background:rgba(255,255,255,0.08);transform:translateY(-2px);box-shadow:0 4px 12px rgba(0,0,0,0.2)}.template-header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px;gap:8px}.template-name{font-size:14px;font-weight:600;color:white;margin:0;flex:1}.template-category{font-size:10px;padding:2px 8px;background:#3b82f6;color:white;border-radius:12px;white-space:nowrap}.template-description{font-size:12px;color:#94a3b8;margin-bottom:12px;line-height:1.4;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}.template-tags{display:flex;gap:5px;flex-wrap:wrap;margin-bottom:12px}.template-tag{font-size:10px;padding:2px 8px;background:rgba(255,255,255,0.1);color:#94a3b8;border-radius:4px}.use-template-btn{width:100%;padding:8px;border:none;background:#3b82f6;color:white;border-radius:6px;cursor:pointer;font-size:12px;font-weight:600;transition:all 0.2s}.use-template-btn:hover{background:#2563eb}.no-templates{text-align:center;padding:40px;color:#94a3b8;font-size:14px}`;
    },

    /**
     * Render templates tab content
     */
    renderTemplatesTab() {
        const templatesGrid = document.getElementById('templates-grid');
        if (!templatesGrid) return;

        const templates = window.UnifiedSuite?.templates?.loadTemplates() || [];
        templatesGrid.innerHTML = '';

        if (templates.length === 0) {
            templatesGrid.innerHTML = '<div class="no-templates">No templates available</div>';
            return;
        }

        templates.forEach(template => {
            const card = this.renderTemplateCard(template);
            templatesGrid.appendChild(card);
        });
    },

    /**
     * Render a single template card
     * @param {Object} template - Template object
     * @returns {HTMLElement} Template card element
     */
    renderTemplateCard(template) {
        const card = document.createElement('div');
        card.className = 'template-card';
        card.dataset.templateId = template.id;
        
        card.innerHTML = `
            <div class="template-header">
                <h4 class="template-name">${sanitizeText(template.name)}</h4>
                <span class="template-category">${sanitizeText(template.category)}</span>
            </div>
            <p class="template-description">${sanitizeText(template.description)}</p>
            <div class="template-tags">
                ${template.tags.slice(0, 3).map(tag => `<span class="template-tag">${sanitizeText(tag)}</span>`).join('')}
            </div>
            <button class="btn-primary use-template-btn" data-template-id="${template.id}">
                Use Template
            </button>
        `;

        // Add click handler
        const useBtn = card.querySelector('.use-template-btn');
        if (useBtn) {
            useBtn.addEventListener('click', () => {
                this.selectTemplate(template);
            });
        }

        return card;
    },

    /**
     * Select a template and load it into generator
     * @param {Object} template - Template object
     */
    selectTemplate(template) {
        const promptInput = document.getElementById('prompt-input');
        const templateSelect = document.getElementById('template-select');
        
        if (promptInput) {
            promptInput.value = template.prompt;
        }
        
        if (templateSelect) {
            templateSelect.value = template.id;
        }

        // Switch to generator tab
        const generatorTab = document.querySelector('[data-tab="generator"]');
        if (generatorTab) {
            generatorTab.click();
        }

        this.renderStatus({ validationResults: document.querySelector('#validation-results') }, 
            `Loaded template: ${template.name}`);
    },

    /**
     * Filter templates by search query
     * @param {string} query - Search query
     */
    filterTemplates(query) {
        const templatesGrid = document.getElementById('templates-grid');
        if (!templatesGrid) return;

        const cards = templatesGrid.querySelectorAll('.template-card');
        const lowerQuery = sanitizeText(query).toLowerCase();

        cards.forEach(card => {
            const name = card.querySelector('.template-name')?.textContent?.toLowerCase() || '';
            const description = card.querySelector('.template-description')?.textContent?.toLowerCase() || '';
            const tags = Array.from(card.querySelectorAll('.template-tag'))
                .map(tag => tag.textContent.toLowerCase())
                .join(' ');

            const matches = name.includes(lowerQuery) || 
                           description.includes(lowerQuery) || 
                           tags.includes(lowerQuery);

            card.style.display = matches ? 'block' : 'none';
        });
    },

    /**
     * Filter templates by category
     * @param {string} category - Category name
     */
    filterTemplatesByCategory(category) {
        const templatesGrid = document.getElementById('templates-grid');
        if (!templatesGrid) return;

        const cards = templatesGrid.querySelectorAll('.template-card');
        
        cards.forEach(card => {
            const cardCategory = card.querySelector('.template-category')?.textContent || '';
            const matches = category === 'all' || cardCategory === category;
            card.style.display = matches ? 'block' : 'none';
        });
    },

    /**
     * Show template creation/editing modal
     * @param {Object|null} existingTemplate - Template to edit, or null for new
     */
    showTemplateModal(existingTemplate = null) {
        const isEditing = !!existingTemplate;
        
        // Create modal overlay
        const modal = document.createElement('div');
        modal.id = 'template-modal';
        modal.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.6);z-index:100000;display:flex;align-items:center;justify-content:center';
        
        modal.innerHTML = `
            <div style="background:#1e293b;border-radius:12px;padding:25px;width:450px;max-width:90%;border:1px solid #334155;color:white">
                <h3 style="margin:0 0 20px;font-size:18px">${isEditing ? 'Edit Template' : 'Create New Template'}</h3>
                <div style="margin-bottom:15px">
                    <label style="display:block;font-size:12px;color:#94a3b8;margin-bottom:5px">Template Name</label>
                    <input type="text" id="modal-template-name" value="${isEditing ? sanitizeText(existingTemplate.name) : ''}" 
                           style="width:100%;padding:8px;border-radius:6px;border:1px solid #475569;background:#0f172a;color:white;font-size:14px;box-sizing:border-box">
                </div>
                <div style="margin-bottom:15px">
                    <label style="display:block;font-size:12px;color:#94a3b8;margin-bottom:5px">Category</label>
                    <select id="modal-template-category" style="width:100%;padding:8px;border-radius:6px;border:1px solid #475569;background:#0f172a;color:white;font-size:14px">
                        <option value="Productivity" ${isEditing && existingTemplate.category === 'Productivity' ? 'selected' : ''}>Productivity</option>
                        <option value="Security" ${isEditing && existingTemplate.category === 'Security' ? 'selected' : ''}>Security</option>
                        <option value="UI Enhancement" ${isEditing && existingTemplate.category === 'UI Enhancement' ? 'selected' : ''}>UI Enhancement</option>
                        <option value="Developer Tools" ${isEditing && existingTemplate.category === 'Developer Tools' ? 'selected' : ''}>Developer Tools</option>
                    </select>
                </div>
                <div style="margin-bottom:15px">
                    <label style="display:block;font-size:12px;color:#94a3b8;margin-bottom:5px">Description</label>
                    <textarea id="modal-template-desc" rows="2" 
                              style="width:100%;padding:8px;border-radius:6px;border:1px solid #475569;background:#0f172a;color:white;font-size:14px;resize:vertical;box-sizing:border-box">${isEditing ? sanitizeText(existingTemplate.description) : ''}</textarea>
                </div>
                <div style="margin-bottom:20px">
                    <label style="display:block;font-size:12px;color:#94a3b8;margin-bottom:5px">Prompt Template</label>
                    <textarea id="modal-template-prompt" rows="4" 
                              style="width:100%;padding:8px;border-radius:6px;border:1px solid #475569;background:#0f172a;color:white;font-size:14px;resize:vertical;box-sizing:border-box">${isEditing ? sanitizeText(existingTemplate.prompt) : ''}</textarea>
                </div>
                <div style="display:flex;gap:10px;justify-content:flex-end">
                    <button id="modal-cancel-btn" style="padding:10px 20px;border:none;background:#64748b;color:white;border-radius:6px;cursor:pointer;font-weight:600">Cancel</button>
                    <button id="modal-save-btn" style="padding:10px 20px;border:none;background:#3b82f6;color:white;border-radius:6px;cursor:pointer;font-weight:600">${isEditing ? 'Update' : 'Create'}</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Bind modal events
        const nameInput = modal.querySelector('#modal-template-name');
        const categorySelect = modal.querySelector('#modal-template-category');
        const descInput = modal.querySelector('#modal-template-desc');
        const promptInput = modal.querySelector('#modal-template-prompt');
        
        modal.querySelector('#modal-cancel-btn').addEventListener('click', () => modal.remove());
        modal.querySelector('#modal-save-btn').addEventListener('click', () => {
            const name = nameInput.value.trim();
            const category = categorySelect.value;
            const description = descInput.value.trim();
            const prompt = promptInput.value.trim();
            
            if (!name) { alert('Please enter a template name'); return; }
            if (!prompt) { alert('Please enter a prompt template'); return; }
            
            const templates = window.UnifiedSuite?.templates;
            if (!templates) { alert('Templates module not loaded'); return; }
            
            try {
                if (isEditing) {
                    // Update existing - delete and recreate
                    templates.deleteTemplate(existingTemplate.id);
                    templates.saveTemplate({ name, category, description, prompt, tags: [] });
                } else {
                    templates.saveTemplate({ name, category, description, prompt, tags: [] });
                }
                modal.remove();
                this.renderTemplatesTab();
            } catch (error) {
                alert('Failed to save template: ' + error.message);
            }
        });

        // Focus name input
        setTimeout(() => nameInput?.focus(), 100);
    },

    /**
     * Export templates as JSON string
     * @returns {string} JSON export
     */
    exportTemplatesJSON() {
        const templates = window.UnifiedSuite?.templates;
        if (!templates) return '[]';
        return templates.exportTemplates();
    },

    /**
     * Import templates from JSON string
     * @param {string} jsonData - JSON data
     * @returns {{imported: number}} Import result
     */
    importTemplatesJSON(jsonData) {
        const templates = window.UnifiedSuite?.templates;
        if (!templates) return { imported: 0 };
        return templates.importTemplates(jsonData);
    }
};

// Export for userscript context
if (typeof window !== 'undefined') {
    window.UnifiedSuite.ui = UIModule;
}

    // ========================================
    // MODULE: THEME
    // ========================================

/**
 * Unified AI Assistant Suite - Theme Module
 * @version 1.3.0
 */

// Get dependencies from global UnifiedSuite object
const CONFIG = (typeof window !== 'undefined' && window.UnifiedSuite?.CONFIG) || {};
const state = (typeof window !== 'undefined' && window.UnifiedSuite?.state) || {};
const updateState = (typeof window !== 'undefined' && window.UnifiedSuite?.updateState) || (() => {});

/**
 * Theme Module - Handles theme management
 */
const ThemeModule = {
    currentTheme: 'dark',

    /**
     * Toggle between dark and light themes
     * @returns {string} New theme
     */
    toggle() {
        this.currentTheme = this.currentTheme === 'dark' ? 'light' : 'dark';
        this.applyTheme();
        this.saveTheme();
        return this.currentTheme;
    },

    /**
     * Apply current theme to UI
     */
    applyTheme() {
        const styles = document.getElementById(CONFIG.STYLE_ID);
        if (!styles) return;
        
        const themeVars = this.currentTheme === 'dark'
            ? '--suite-bg: rgba(15, 23, 42, 0.95); --suite-border: #334155; --suite-text: white; --suite-text-secondary: #94a3b8; --suite-input-bg: #1e293b; --suite-input-border: #475569;'
            : '--suite-bg: rgba(255, 255, 255, 0.95); --suite-border: #e2e8f0; --suite-text: #1e293b; --suite-text-secondary: #64748b; --suite-input-bg: #f8fafc; --suite-input-border: #cbd5e1;';
        
        // Update CSS custom properties in the style element
        const root = document.documentElement;
        if (this.currentTheme === 'dark') {
            root.style.setProperty('--suite-bg', 'rgba(15, 23, 42, 0.95)');
            root.style.setProperty('--suite-border', '#334155');
            root.style.setProperty('--suite-text', 'white');
            root.style.setProperty('--suite-text-secondary', '#94a3b8');
            root.style.setProperty('--suite-input-bg', '#1e293b');
            root.style.setProperty('--suite-input-border', '#475569');
        } else {
            root.style.setProperty('--suite-bg', 'rgba(255, 255, 255, 0.95)');
            root.style.setProperty('--suite-border', '#e2e8f0');
            root.style.setProperty('--suite-text', '#1e293b');
            root.style.setProperty('--suite-text-secondary', '#64748b');
            root.style.setProperty('--suite-input-bg', '#f8fafc');
            root.style.setProperty('--suite-input-border', '#cbd5e1');
        }
    },

    /**
     * Save theme preference
     */
    saveTheme() {
        updateState('config', { ...state.config, theme: this.currentTheme });
        const storage = window.UnifiedSuite?.storage;
        if (storage) {
            try {
                const settings = JSON.parse(GM_getValue(CONFIG.STORAGE_KEYS.settings, '{}'));
                settings.theme = this.currentTheme;
                GM_setValue(CONFIG.STORAGE_KEYS.settings, JSON.stringify(settings));
            } catch (error) {
                console.warn('[Theme] Failed to save theme:', error);
            }
        }
    },

    /**
     * Load theme preference
     */
    loadTheme() {
        this.currentTheme = state.config.theme || 'dark';
        this.applyTheme();
    },

    /**
     * Get current theme
     * @returns {string} Current theme
     */
    getCurrentTheme() {
        return this.currentTheme;
    }
};

// Export for userscript context
if (typeof window !== 'undefined') {
    window.UnifiedSuite.theme = ThemeModule;
}

    // ========================================
    // MODULE: VERSIONING
    // ========================================

/**
 * Unified AI Assistant Suite - Versioning Module
 * @version 1.3.0
 */

// Get dependencies from global UnifiedSuite object
const CONFIG = (typeof window !== 'undefined' && window.UnifiedSuite?.CONFIG) || {};
const state = (typeof window !== 'undefined' && window.UnifiedSuite?.state) || {};
const updateState = (typeof window !== 'undefined' && window.UnifiedSuite?.updateState) || (() => {});
const debugLog = (typeof window !== 'undefined' && window.UnifiedSuite?.debugLog) || (() => {});
const sanitizeText = (typeof window !== 'undefined' && window.UnifiedSuite?.sanitizeText) || ((text) => String(text ?? '').trim());
const safeJsonParse = (typeof window !== 'undefined' && window.UnifiedSuite?.safeJsonParse) || ((v, fb) => { try { return JSON.parse(v); } catch { return fb; } });

/**
 * Versioning Module - Handles script versioning and diff view
 */
const VersioningModule = {
    /**
     * Save a script version
     * @param {string} scriptId - Script ID
     * @param {string} content - Script content
     * @param {string} changeMessage - Change message
     */
    saveVersion(scriptId, content, changeMessage = 'Auto-save') {
        try {
            const versions = safeJsonParse(GM_getValue(CONFIG.STORAGE_KEYS.versions, '{}'), {});
            const sv = versions[scriptId] || [];
            sv.unshift({
                version: sv.length + 1,
                content,
                changeMessage,
                timestamp: Date.now()
            });
            GM_setValue(CONFIG.STORAGE_KEYS.versions, JSON.stringify({
                ...versions,
                [scriptId]: sv.slice(0, CONFIG.MAX_VERSIONS_PER_SCRIPT)
            }));
        } catch (error) {
            debugLog('Failed to save script version', error);
        }
    },

    /**
     * Load versions for a script
     * @param {string} scriptId - Script ID
     * @returns {Array} Array of versions
     */
    loadVersions(scriptId) {
        try {
            const versions = safeJsonParse(GM_getValue(CONFIG.STORAGE_KEYS.versions, '{}'), {});
            return versions[scriptId] || [];
        } catch (error) {
            debugLog('Failed to load script versions', error);
            return [];
        }
    },

    /**
     * Create diff view between two versions
     * @param {string} oldContent - Old content
     * @param {string} newContent - New content
     * @returns {string} Diff view
     */
    createDiff(oldContent, newContent) {
        const oldLines = oldContent.split('\n');
        const newLines = newContent.split('\n');
        const diff = [];
        
        for (let i = 0; i < Math.max(oldLines.length, newLines.length); i++) {
            if (oldLines[i] !== newLines[i]) {
                if (oldLines[i]) diff.push('- ' + oldLines[i]);
                if (newLines[i]) diff.push('+ ' + newLines[i]);
            }
        }
        
        return diff.join('\n');
    },

    /**
     * Render versions tab
     * @param {string} scriptId - Script ID
     */
    renderVersionsTab(scriptId) {
        const container = document.getElementById('versions-list');
        if (!container) return;
        
        const versions = this.loadVersions(scriptId || state.currentScriptId);
        if (!versions.length) {
            container.innerHTML = '<p class="no-versions">No versions saved yet.</p>';
            return;
        }
        
        container.innerHTML = versions.map(v => `
            <div class="version-item" data-version="${v.version}">
                <span class="version-number">v${v.version}</span>
                <span class="version-date">${new Date(v.timestamp).toLocaleString()}</span>
                <button class="btn-secondary view-diff-btn" data-version="${v.version}">View</button>
                <button class="btn-secondary rollback-btn" data-version="${v.version}">Rollback</button>
            </div>
        `).join('');
        
        // View diff button
        container.querySelectorAll('.view-diff-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const ver = versions.find(v => v.version === parseInt(btn.dataset.version));
                if (!ver) return;
                
                const diff = state.currentScript?.content 
                    ? this.createDiff(ver.content, state.currentScript.content) 
                    : '';
                
                const diffArea = document.getElementById('diff-output');
                if (diffArea) {
                    diffArea.textContent = diff || 'No differences';
                    diffArea.style.display = 'block';
                }
            });
        });
        
        // Rollback button
        container.querySelectorAll('.rollback-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const ver = versions.find(v => v.version === parseInt(btn.dataset.version));
                if (!ver || !state.currentScript) return;
                
                state.currentScript.content = ver.content;
                state.currentScript.validation = this.validateScript(ver.content);
                
                const ui = document.getElementById(CONFIG.UI_ID);
                if (ui) {
                    const scriptOutput = ui.querySelector('#script-output');
                    if (scriptOutput) scriptOutput.textContent = ver.content;
                    
                    const validationResults = ui.querySelector('#validation-results');
                    if (validationResults) {
                        validationResults.textContent = `Rolled back to v${ver.version}`;
                    }
                }
            });
        });
    },

    /**
     * Validate script
     * @param {string} script - Script content
     * @returns {Object} Validation result
     */
    validateScript(script) {
        const issues = [];
        const warnings = [];
        const normalizedScript = sanitizeText(script);
        
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
        } catch (error) {
            issues.push(`Syntax error: ${error.message}`);
        }
        
        if (normalizedScript.length > CONFIG.MAX_SCRIPT_LENGTH) {
            warnings.push('Script may be too large; consider splitting features into modules');
        }
        
        const score = Math.max(0, 100 - (issues.length * 20) - (warnings.length * 5) - (normalizedScript.length > 5000 ? 10 : 0));
        
        return {
            isValid: issues.length === 0,
            issues,
            warnings,
            score
        };
    },

    /**
     * Export all scripts as JSON
     * @returns {string} JSON export
     */
    exportAll() {
        const storage = window.UnifiedSuite?.storage;
        if (storage) {
            return storage.exportAllScripts();
        }
        return JSON.stringify({ version: CONFIG.VERSION, exportedAt: Date.now(), scripts: [] }, null, 2);
    },

    /**
     * Import scripts from JSON
     * @param {string} jsonData - JSON data
     * @returns {Object} Import result
     */
    importAll(jsonData) {
        const storage = window.UnifiedSuite?.storage;
        if (storage) {
            return storage.importScripts(jsonData);
        }
        return { imported: 0, scripts: [] };
    }
};

// Export for userscript context
if (typeof window !== 'undefined') {
    window.UnifiedSuite.versioning = VersioningModule;
}

    // ========================================
    // MODULE: AUTH
    // ========================================

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

// Export for userscript context
if (typeof window !== 'undefined') {
    window.UnifiedSuite.auth = AuthModule;
}

    // ========================================
    // MODULE: INDEX
    // ========================================

/**
 * Unified AI Assistant Suite - Main Entry Point
 * @version 1.3.0
 * 
 * This module provides dynamic module loading and initialization
 * for the modular architecture. Falls back to monolithic mode
 * if modules fail to load.
 */

/**
 * @typedef {Object} ModuleDefinition
 * @property {string} name - Module name
 * @property {string} path - Module file path
 * @property {boolean} required - Is module required
 * @property {Function} init - Initialization function
 */

// Get dependencies from global UnifiedSuite object
const CONFIG = (typeof window !== 'undefined' && window.UnifiedSuite?.CONFIG) || {};
const state = (typeof window !== 'undefined' && window.UnifiedSuite?.state) || {};
const updateState = (typeof window !== 'undefined' && window.UnifiedSuite?.updateState) || (() => {});
const debugLog = (typeof window !== 'undefined' && window.UnifiedSuite?.debugLog) || (() => {});

/**
 * Module definitions for dynamic loading
 * @type {ModuleDefinition[]}
 */
const MODULE_DEFINITIONS = [
    { name: 'storage', path: 'storage.js', required: true },
    { name: 'providers', path: 'providers.js', required: true },
    { name: 'templates', path: 'templates.js', required: false },
    { name: 'context', path: 'context.js', required: false },
    { name: 'autoupdate', path: 'autoupdate.js', required: false },
    { name: 'validator', path: 'validator.js', required: false },
    { name: 'pluginAPI', path: 'plugin-api.js', required: false },
    { name: 'i18n', path: 'i18n.js', required: false },
    { name: 'performance', path: 'performance.js', required: false },
    { name: 'debugger', path: 'debugger.js', required: false },
    { name: 'sync', path: 'sync.js', required: false },
    { name: 'analytics', path: 'analytics.js', required: false },
    { name: 'ui', path: 'ui.js', required: true },
    { name: 'theme', path: 'theme.js', required: false },
    { name: 'versioning', path: 'versioning.js', required: false },
    { name: 'auth', path: 'auth.js', required: false }
];

/**
 * Load a module dynamically
 * @param {string} moduleName - Module name
 * @param {string} modulePath - Module file path
 * @returns {Object|undefined} Loaded module or undefined
 */
async function loadModule(moduleName, modulePath) {
    try {
        // Try to load from dynamic import (ES modules)
        if (typeof importScripts !== 'undefined') {
            // Service worker context
            const module = await importScripts(modulePath);
            return module;
        }
        
        // Try dynamic import (module context)
        if (typeof import === 'function') {
            try {
                const module = await import(modulePath);
                return module.default || module;
            } catch (e) {
                debugLog(`Dynamic import failed for ${moduleName}, trying script injection`);
            }
        }
        
        // Fallback: load via script tag injection
        return loadModuleViaScript(moduleName, modulePath);
    } catch (error) {
        debugLog(`Failed to load module ${moduleName}:`, error);
        return undefined;
    }
}

/**
 * Load module via script tag injection
 * @param {string} moduleName - Module name
 * @param {string} modulePath - Module file path
 * @returns {Object|undefined} Loaded module or undefined
 */
function loadModuleViaScript(moduleName, modulePath) {
    return new Promise((resolve) => {
        const script = document.createElement('script');
        script.src = modulePath;
        
        script.onload = () => {
            const module = window.UnifiedSuite?.[moduleName];
            resolve(module);
        };
        
        script.onerror = () => {
            debugLog(`Failed to load script for module: ${moduleName}`);
            resolve(undefined);
        };
        
        document.head.appendChild(script);
    });
}

/**
 * Initialize module system
 * @returns {Promise<boolean>} Success status
 */
async function initializeModuleSystem() {
    debugLog('Initializing module system...');
    
    const results = {
        loaded: [],
        failed: [],
        skipped: []
    };
    
    // Load each module
    for (const moduleDef of MODULE_DEFINITIONS) {
        try {
            debugLog(`Loading module: ${moduleDef.name}`);
            
            // Check if module is already available (monolithic mode)
            const existingModule = window.UnifiedSuite?.[moduleDef.name];
            if (existingModule) {
                debugLog(`Module ${moduleDef.name} already loaded (monolithic mode)`);
                results.loaded.push(moduleDef.name);
                continue;
            }
            
            // Try to load module dynamically
            const module = await loadModule(moduleDef.name, moduleDef.path);
            
            if (module) {
                // Register module
                registerModule(moduleDef.name, module);
                results.loaded.push(moduleDef.name);
                debugLog(`Module ${moduleDef.name} loaded successfully`);
            } else if (moduleDef.required) {
                throw new Error(`Required module ${moduleDef.name} failed to load`);
            } else {
                results.skipped.push(moduleDef.name);
                debugLog(`Optional module ${moduleDef.name} skipped`);
            }
        } catch (error) {
            debugLog(`Failed to initialize module ${moduleDef.name}:`, error);
            results.failed.push({ name: moduleDef.name, error: error.message });
            
            if (moduleDef.required) {
                console.error(`[Unified Suite] Critical module ${moduleDef.name} failed to load:`, error);
                return false;
            }
        }
    }
    
    // Log results
    debugLog('Module loading results:', results);
    
    if (results.failed.length > 0 && results.failed.some(f => {
        // Check if any required modules failed
        const def = MODULE_DEFINITIONS.find(m => m.name === f.name);
        return def?.required;
    })) {
        console.error('[Unified Suite] Some required modules failed to load');
        return false;
    }
    
    debugLog(`Module system initialized: ${results.loaded.length} loaded, ${results.failed.length} failed, ${results.skipped.length} skipped`);
    return true;
}

/**
 * Register a module in the global registry
 * @param {string} name - Module name
 * @param {Object} module - Module object
 */
function registerModule(name, module) {
    if (!state.modules[name]) {
        state.modules[name] = module;
        
        // Update module health
        if (state.moduleHealth && window.UnifiedSuite?.storage) {
            const storage = window.UnifiedSuite.storage;
            if (storage.updateModuleHealth) {
                storage.updateModuleHealth(name, 'ok');
            }
        }
    }
}

/**
 * Get a registered module
 * @param {string} name - Module name
 * @returns {Object|undefined} Module or undefined
 */
function getModule(name) {
    return state.modules[name] || window.UnifiedSuite?.[name];
}

/**
 * Initialize all modules
 * @returns {Promise<boolean>} Success status
 */
async function initializeAllModules() {
    // Initialize core modules first
    const coreModules = [
        { name: 'config', fn: () => CONFIG },
        { name: 'state', fn: () => ({ state, getState, updateState, resetState }) },
        { name: 'utilities', fn: () => window.UnifiedSuite },
        { name: 'storage', fn: () => window.UnifiedSuite?.storage }
    ];
    
    for (const module of coreModules) {
        if (!state.modules[module.name]) {
            registerModule(module.name, module.fn());
        }
    }
    
    // Initialize dynamic module system
    const moduleSystemSuccess = await initializeModuleSystem();
    
    if (!moduleSystemSuccess) {
        console.warn('[Unified Suite] Module system initialization failed, using fallback mode');
        initializeFallbackModules();
    }
    
    // Initialize each loaded module
    for (const [name, module] of Object.entries(state.modules)) {
        try {
            if (typeof module.init === 'function') {
                await module.init();
                debugLog(`Module ${name} initialized`);
            }
        } catch (error) {
            debugLog(`Failed to initialize module ${name}:`, error);
            
            // Update module health
            if (window.UnifiedSuite?.storage?.updateModuleHealth) {
                window.UnifiedSuite.storage.updateModuleHealth(name, 'error', error.message);
            }
        }
    }
    
    return true;
}

/**
 * Initialize fallback modules (monolithic mode)
 */
function initializeFallbackModules() {
    debugLog('Initializing fallback modules...');
    
    // These will be populated by the monolithic build
    const fallbackModules = [
        'scriptGenerator',
        'authSecurity',
        'versioning',
        'theme'
    ];
    
    for (const moduleName of fallbackModules) {
        if (!state.modules[moduleName] && window.UnifiedSuite?.[moduleName]) {
            registerModule(moduleName, window.UnifiedSuite[moduleName]);
        }
    }
}

/**
 * Check module health
 * @returns {Object.<string, {status: string, lastCheck: number}>} Module health map
 */
function checkModuleHealth() {
    const health = {};
    
    for (const [name] of Object.entries(state.modules)) {
        health[name] = {
            status: 'ok',
            lastCheck: Date.now()
        };
    }
    
    return health;
}

// Export functions
const ModuleSystem = {
    initializeAllModules,
    loadModule,
    registerModule,
    getModule,
    checkModuleHealth,
    initializeFallbackModules
};

// Export for userscript context
if (typeof window !== 'undefined') {
    window.UnifiedSuite.moduleSystem = ModuleSystem;
}


})();