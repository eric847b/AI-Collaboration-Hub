#!/usr/bin/env node

/**
 * Validate module structure and exports
 * Ensures all modules follow the standard pattern
 */

const fs = require('fs');
const path = require('path');

const BASE_DIR = path.join(__dirname, '..');

const CONFIG = {
    modulesDir: path.join(BASE_DIR, 'Userscripts', 'modules'),
    requiredModules: [
        'config.js',
        'state.js',
        'utilities.js',
        'storage.js',
        'providers.js',
        'templates.js',
        'context.js',
        'autoupdate.js',
        'validator.js',
        'plugin-api.js',
        'i18n.js',
        'performance.js',
        'debugger.js',
        'sync.js',
        'analytics.js',
        'ui.js',
        'theme.js',
        'versioning.js',
        'auth.js',
        'index.js'
    ]
};

/**
 * Validate a single module file
 * @param {string} modulePath - Path to module file
 * @returns {Object} Validation results
 */
function validateModule(modulePath) {
    const results = {
        file: path.basename(modulePath),
        exists: false,
        hasJSDoc: false,
        hasModuleExport: false,
        hasUserscriptExport: false,
        hasModulePattern: false,
        errors: []
    };

    if (!fs.existsSync(modulePath)) {
        results.errors.push('File does not exist');
        return results;
    }

    results.exists = true;
    const content = fs.readFileSync(modulePath, 'utf8');

    // Check for JSDoc
    results.hasJSDoc = content.includes('/**') && content.includes('@version');
    if (!results.hasJSDoc) {
        results.errors.push('Missing JSDoc header with @version');
    }

    // Check for module system export
    results.hasModuleExport = content.includes('module.exports');
    if (!results.hasModuleExport) {
        results.errors.push('Missing module.exports export');
    }

    // Check for userscript context export
    results.hasUserscriptExport = content.includes('window.UnifiedSuite');
    if (!results.hasUserscriptExport) {
        results.errors.push('Missing window.UnifiedSuite export');
    }

    // Check for module pattern OR significant implementation
    const modulePatterns = [
        'const ModuleName',
        'const ThemeModule',
        'const UIModule',
        'const StorageModule',
        'const ProvidersModule',
        'const VersioningModule',
        'const AuthModule',
        'const ModuleSystem',
        'const CONFIG',
        'const state',
        'function debugLog',
        'function sanitizeText',
        'function validateScript',
        'function fetchJson'
    ];
    
    const hasPattern = modulePatterns.some(pattern => content.includes(pattern));
    const hasFunctions = (content.match(/function\s+\w+/g) || []).length >= 3;
    results.hasModulePattern = hasPattern || hasFunctions;
    if (!results.hasModulePattern) {
        results.errors.push('Missing module object pattern');
    }

    return results;
}

/**
 * Run validation on all modules
 */
function validate() {
    console.log('🔍 Validating modules...\n');

    let allValid = true;
    const results = [];

    for (const moduleFile of CONFIG.requiredModules) {
        const modulePath = path.join(CONFIG.modulesDir, moduleFile);
        const result = validateModule(modulePath);
        results.push(result);

        if (result.exists && result.errors.length === 0) {
            console.log(`  ✅ ${moduleFile}`);
        } else {
            console.log(`  ❌ ${moduleFile}`);
            allValid = false;
        }

        for (const error of result.errors) {
            console.log(`     - ${error}`);
        }
    }

    console.log('\n' + '='.repeat(50));
    
    if (allValid) {
        console.log('✅ All modules validated successfully');
        process.exit(0);
    } else {
        console.log('❌ Module validation failed');
        process.exit(1);
    }
}

// Run if called directly
if (require.main === module) {
    try {
        validate();
    } catch (error) {
        console.error('❌ Validation failed:', error);
        process.exit(1);
    }
}

module.exports = { validate };