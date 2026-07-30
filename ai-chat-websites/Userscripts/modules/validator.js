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

// Export for module system
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { ValidatorModule };
}

// Export for userscript context
if (typeof window !== 'undefined') {
    window.UnifiedSuite.validator = ValidatorModule;
}