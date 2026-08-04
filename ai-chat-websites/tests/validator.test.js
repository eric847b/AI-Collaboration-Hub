/**
 * Validator Module Unit Tests
 * @version 2.1.0
 */

const { describe, it, expect, beforeAll, beforeEach, afterEach } = require('@jest/globals');

global.window = global.window || {};
global.window.UnifiedSuite = global.window.UnifiedSuite || {};
global.window.UnifiedSuite.CONFIG = { VERSION: '2.1.0' };
global.window.UnifiedSuite.debugLog = () => {};

describe('Validator Module', () => {
    let ValidatorModule;

    beforeAll(() => {
        ValidatorModule = require('../Userscripts/modules/validator.js').ValidatorModule;
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    describe('validate', () => {
        it('should validate a correct script', () => {
            const script = `// ==UserScript==
// @name Test
// @version 1.0
// @match *://example.com/*
// @grant none
// ==/UserScript==
console.log('Hello');`;
            const result = ValidatorModule.validate(script);
            expect(result.isValid).toBe(true);
            expect(result.score).toBeGreaterThanOrEqual(0);
            expect(result.score).toBeLessThanOrEqual(100);
        });

        it('should reject script without header', () => {
            const script = 'console.log("no header");';
            const result = ValidatorModule.validate(script);
            expect(result.isValid).toBe(false);
            expect(result.issues.length).toBeGreaterThan(0);
        });

        it('should reject script with missing @name', () => {
            const script = `// ==UserScript==
// @version 1.0
// ==/UserScript==
console.log('test');`;
            const result = ValidatorModule.validate(script);
            expect(result.isValid).toBe(false);
        });

        it('should reject script with missing @match or @include', () => {
            const script = `// ==UserScript==
// @name Test
// @version 1.0
// ==/UserScript==
console.log('test');`;
            const result = ValidatorModule.validate(script);
            expect(result.warnings.length).toBeGreaterThan(0);
        });

        it('should return score', () => {
            const script = 'console.log("test");';
            const result = ValidatorModule.validate(script);
            expect(result.score).toBeGreaterThanOrEqual(0);
            expect(result.score).toBeLessThanOrEqual(100);
        });

        it('should detect eval usage', () => {
            const script = `// ==UserScript==
// @name Test
// @version 1.0
// @match *://example.com/*
// ==/UserScript==
eval('alert(1)');`;
            const result = ValidatorModule.validate(script);
            expect(result.issues.length).toBeGreaterThan(0);
        });
    });

    describe('checkSecurity', () => {
        it('should detect eval()', () => {
            const result = ValidatorModule.checkSecurity('eval("test")');
            expect(result.issues.length).toBeGreaterThan(0);
        });

        it('should detect document.write()', () => {
            const result = ValidatorModule.checkSecurity('document.write("<p>test</p>")');
            expect(result.warnings.length).toBeGreaterThan(0);
        });

        it('should detect innerHTML usage', () => {
            const result = ValidatorModule.checkSecurity('elem.innerHTML = "<p>test</p>";');
            expect(result.warnings.length).toBeGreaterThan(0);
        });
    });

    describe('checkBestPractices', () => {
        it('should detect missing userscript header', () => {
            const result = ValidatorModule.checkBestPractices('console.log("test")');
            expect(result.issues.length).toBeGreaterThan(0);
        });

        it('should detect long lines', () => {
            const longLine = 'const x = '.padEnd(150, 'a');
            const script = `// ==UserScript==\n// @name Test\n// @version 1.0\n// @match *://example.com/*\n// ==/UserScript==\n${longLine}`;
            const result = ValidatorModule.checkBestPractices(script);
            expect(result.warnings.length).toBeGreaterThan(0);
        });
    });

    describe('calculateMetrics', () => {
        it('should calculate metrics', () => {
            const script = `// ==UserScript==
// @name Test
// @version 1.0
// @match *://example.com/*
// ==/UserScript==
console.log('test');`;
            const metrics = ValidatorModule.calculateMetrics(script);
            expect(metrics).toHaveProperty('totalLines');
            expect(metrics).toHaveProperty('codeLines');
            expect(metrics).toHaveProperty('cyclomaticComplexity');
            expect(metrics).toHaveProperty('maintainabilityIndex');
        });

        it('should return non-negative complexity', () => {
            const metrics = ValidatorModule.calculateMetrics('console.log("test");');
            expect(metrics.cyclomaticComplexity).toBeGreaterThanOrEqual(1);
        });
    });

    describe('isAvailable', () => {
        it('should return true', () => {
            expect(ValidatorModule.isAvailable()).toBe(true);
        });
    });
});
