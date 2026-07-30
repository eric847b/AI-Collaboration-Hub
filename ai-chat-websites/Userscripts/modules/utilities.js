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

// Export for module system
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        debugLog, sanitizeText, safeJsonParse, generateId, indentCode,
        extractCodeBlock, deriveDescription, deriveScriptName, generateFilename, optimizeScript
    };
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