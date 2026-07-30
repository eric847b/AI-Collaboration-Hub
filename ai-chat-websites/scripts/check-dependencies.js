#!/usr/bin/env node

/**
 * Check module dependencies and circular references
 */

const fs = require('fs');
const path = require('path');

const CONFIG = {
    modulesDir: 'Userscripts/modules',
    modules: [
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
 * Extract dependencies from a module file
 * @param {string} content - Module content
 * @returns {string[]} List of dependencies
 */
function extractDependencies(content) {
    const deps = [];
    const importRegex = /const\s+(\w+)\s*=\s*window\.UnifiedSuite\?\.(\w+)/g;
    let match;
    
    while ((match = importRegex.exec(content)) !== null) {
        deps.push(match[2]);
    }
    
    return deps;
}

/**
 * Check dependencies for all modules
 */
function checkDependencies() {
    console.log('🔗 Checking module dependencies...\n');
    
    const dependencyMap = {};
    
    for (const moduleFile of CONFIG.modules) {
        const modulePath = path.join(CONFIG.modulesDir, moduleFile);
        const moduleName = moduleFile.replace('.js', '');
        
        if (!fs.existsSync(modulePath)) {
            console.warn(`  ⚠️  Module not found: ${moduleFile}`);
            continue;
        }
        
        const content = fs.readFileSync(modulePath, 'utf8');
        const deps = extractDependencies(content);
        
        dependencyMap[moduleName] = deps;
        console.log(`  📦 ${moduleName}`);
        console.log(`     Dependencies: ${deps.length > 0 ? deps.join(', ') : 'none'}`);
    }
    
    console.log('\n' + '='.repeat(50));
    console.log('📊 Dependency Summary:');
    
    // Check for potential circular dependencies
    const circular = [];
    for (const [module, deps] of Object.entries(dependencyMap)) {
        for (const dep of deps) {
            if (dependencyMap[dep] && dependencyMap[dep].includes(module)) {
                circular.push(`${module} <-> ${dep}`);
            }
        }
    }
    
    if (circular.length > 0) {
        console.log('\n⚠️  Potential circular dependencies:');
        circular.forEach(dep => console.log(`  - ${dep}`));
    } else {
        console.log('✅ No circular dependencies detected');
    }
    
    // Check for missing dependencies
    console.log('\n📋 Module initialization order:');
    const order = ['config', 'state', 'utilities', 'storage', 'providers', 'ui', 'theme', 'versioning', 'auth'];
    order.forEach((mod, i) => {
        const deps = dependencyMap[mod] || [];
        console.log(`  ${i + 1}. ${mod}${deps.length > 0 ? ` (needs: ${deps.join(', ')})` : ''}`);
    });
    
    console.log('\n✅ Dependency check complete');
}

// Run if called directly
if (require.main === module) {
    try {
        checkDependencies();
    } catch (error) {
        console.error('❌ Dependency check failed:', error);
        process.exit(1);
    }
}

module.exports = { checkDependencies };