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

// Export for module system
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { state, getState, updateState, resetState };
}

// Export for userscript context
if (typeof window !== 'undefined') {
    window.UnifiedSuite = window.UnifiedSuite || {};
    window.UnifiedSuite.state = state;
    window.UnifiedSuite.getState = getState;
    window.UnifiedSuite.updateState = updateState;
    window.UnifiedSuite.resetState = resetState;
}