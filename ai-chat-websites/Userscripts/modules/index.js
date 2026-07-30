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

// Export for module system
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { ModuleSystem };
}

// Export for userscript context
if (typeof window !== 'undefined') {
    window.UnifiedSuite.moduleSystem = ModuleSystem;
}