#!/usr/bin/env node

/**
 * Build script for Unified AI Assistant Suite
 * Concatenates modular source files into a single userscript
 * 
 * Usage: node scripts/build-userscript.js
 */

const fs = require('fs');
const path = require('path');

const CONFIG = {
    sourceDir: 'Userscripts/modules',
    outputFile: 'Userscripts/Unified-AI-Assistant-Suite.user.js',
    templateFile: 'Userscripts/Unified-AI-Assistant-Suite.user.js',
    moduleOrder: [
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
    ],
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
 * Read a file and return its contents
 * @param {string} filePath - Path to file
 * @returns {string} File contents
 */
function readFile(filePath) {
    try {
        return fs.readFileSync(filePath, 'utf8');
    } catch (error) {
        console.error(`Error reading ${filePath}:`, error.message);
        process.exit(1);
    }
}

/**
 * Extract the userscript header from the template
 * @param {string} template - Template file contents
 * @returns {string} Userscript header block
 */
function extractUserscriptHeader(template) {
    const match = template.match(/\/\/ ==UserScript==[\s\S]*?\/\/ ==\/UserScript==\n\n/);
    return match ? match[0] : '';
}

/**
 * Extract the IIFE wrapper from the template
 * @param {string} template - Template file contents
 * @returns {string} IIFE wrapper
 */
function extractIIFE(template) {
    const match = template.match(/\(function\(\)\s*\{[\s\S]*\}\)\(\);/);
    return match ? match[0] : '';
}

/**
 * Extract module content from a module file (remove exports)
 * @param {string} content - Module file contents
 * @returns {string} Clean module content
 */
function extractModuleContent(content) {
    // Remove export statements for module system
    let cleaned = content.replace(/\/\/ Export for module system[\s\S]*?\}\n\n/g, '');
    // Remove export for userscript context
    cleaned = cleaned.replace(/\/\/ Export for userscript context[\s\S]*?\}\n\n/g, '');
    // Remove any stray module.exports lines if present
    cleaned = cleaned.replace(/module\.exports\s*=\s*\{[^}]*\};\s*/g, '');
    return cleaned;
}

/**
 * Build the single-file userscript
 */
function build() {
    console.log('🔨 Building Unified AI Assistant Suite...\n');

    // Read template
    const template = readFile(CONFIG.templateFile);
    const userscriptHeader = extractUserscriptHeader(template);
    
    if (!userscriptHeader) {
        console.error('❌ Could not find userscript header in template');
        process.exit(1);
    }

    console.log('📋 Userscript header found');

    // Build module content
    let moduleContent = '';
    let moduleCount = 0;

    for (const moduleFile of CONFIG.moduleOrder) {
        const modulePath = path.join(CONFIG.sourceDir, moduleFile);
        
        if (!fs.existsSync(modulePath)) {
            console.warn(`⚠️  Module not found: ${moduleFile}`);
            continue;
        }

        const content = readFile(modulePath);
        const cleanedContent = extractModuleContent(content);
        
        moduleContent += `\n\n    // ========================================\n`;
        moduleContent += `    // MODULE: ${moduleFile.replace('.js', '').toUpperCase()}\n`;
        moduleContent += `    // ========================================\n\n`;
        moduleContent += cleanedContent;
        
        moduleCount++;
        console.log(`  ✅ Processed: ${moduleFile}`);
    }

    console.log(`\n📦 ${moduleCount} modules processed`);

    // Extract IIFE wrapper from template
    const iifeMatch = template.match(/\(function\(\)\s*\{([\s\S]*)\}\)\(\);/);
    let finalContent = '';

    if (iifeMatch) {
        // Use template's IIFE structure
        const [iifeStart, iifeEnd] = template.match(/\(function\(\)\s*\{/) ? 
            ['(function() {\n    \'use strict\';\n\n', '\n})();'] :
            ['', ''];
        
        finalContent = userscriptHeader + '\n' + iifeStart + moduleContent + '\n\n' + iifeEnd;
    } else {
        // Fallback: just concatenate
        finalContent = userscriptHeader + '\n' + moduleContent;
    }

    // Write output
    fs.writeFileSync(CONFIG.outputFile, finalContent, 'utf8');
    console.log(`\n✅ Build complete: ${CONFIG.outputFile}`);
    console.log(`   Size: ${(fs.statSync(CONFIG.outputFile).size / 1024).toFixed(2)} KB`);
}

// Run if called directly
if (require.main === module) {
    try {
        build();
    } catch (error) {
        console.error('❌ Build failed:', error);
        process.exit(1);
    }
}

// Export for npm scripts
module.exports = { build };