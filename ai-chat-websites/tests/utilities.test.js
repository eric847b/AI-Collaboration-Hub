/**
 * Utilities Module Unit Tests
 * @version 2.1.0
 */

const { describe, it, expect, beforeAll } = require('@jest/globals');

// Mock window for browser APIs
global.window = global.window || {};
global.window.crypto = global.window.crypto || { randomUUID: () => 'test-uuid-' + Math.random().toString(36).slice(2, 11) };

describe('Utilities Module', () => {
  let utils;

  beforeAll(() => {
    utils = require('../Userscripts/modules/utilities.js');
  });

  describe('sanitizeText', () => {
    it('should sanitize null bytes and trim whitespace', () => {
      expect(utils.sanitizeText('  hello  ')).toBe('hello');
      expect(utils.sanitizeText('hello\u0000world')).toBe('helloworld');
      expect(utils.sanitizeText('  test\u0000  ')).toBe('test');
    });

    it('should handle null/undefined input', () => {
      expect(utils.sanitizeText(null)).toBe('');
      expect(utils.sanitizeText(undefined)).toBe('');
    });

    it('should convert non-strings to strings', () => {
      expect(utils.sanitizeText(123)).toBe('123');
      expect(utils.sanitizeText(true)).toBe('true');
    });
  });

  describe('safeJsonParse', () => {
    it('should parse valid JSON', () => {
      expect(utils.safeJsonParse('{"a":1}', null)).toEqual({ a: 1 });
      expect(utils.safeJsonParse('[1,2,3]', [])).toEqual([1, 2, 3]);
    });

    it('should return fallback for invalid JSON', () => {
      expect(utils.safeJsonParse('invalid', 'fallback')).toBe('fallback');
      expect(utils.safeJsonParse('{bad json', null)).toBeNull();
    });

    it('should return fallback for empty/null input', () => {
      expect(utils.safeJsonParse('', 'default')).toBe('default');
      expect(utils.safeJsonParse(null, 'default')).toBe('default');
      expect(utils.safeJsonParse(undefined, 'default')).toBe('default');
    });
  });

  describe('generateId', () => {
    it('should generate a unique string ID', () => {
      const id1 = utils.generateId();
      const id2 = utils.generateId();
      expect(typeof id1).toBe('string');
      expect(id1.length).toBeGreaterThan(0);
      expect(id1).not.toBe(id2);
    });
  });

  describe('indentCode', () => {
    it('should indent each line with specified spaces', () => {
      const result = utils.indentCode('line1\nline2', 4);
      expect(result).toBe('    line1\n    line2');
    });

    it('should handle single line', () => {
      expect(utils.indentCode('hello', 2)).toBe('  hello');
    });

    it('should handle empty string', () => {
      expect(utils.indentCode('', 4)).toBe('    ');
    });
  });

  describe('extractCodeBlock', () => {
    it('should extract code from markdown code block', () => {
      const md = 'Some text\n```javascript\nconsole.log("hello");\n```\nMore text';
      expect(utils.extractCodeBlock(md)).toBe('console.log("hello");');
    });

    it('should extract code from plain js code block', () => {
      const md = '```js\nvar x = 1;\n```';
      expect(utils.extractCodeBlock(md)).toBe('var x = 1;');
    });

    it('should return text as-is if no code block found', () => {
      expect(utils.extractCodeBlock('plain text')).toBe('plain text');
    });
  });

  describe('deriveDescription', () => {
    it('should strip code blocks and normalize whitespace', () => {
      const text = '```js\ncode\n```\nHello   world';
      expect(utils.deriveDescription(text)).toBe('Hello world');
    });

    it('should return default for empty text', () => {
      expect(utils.deriveDescription('')).toBe('Auto-generated from AI');
      expect(utils.deriveDescription('   ')).toBe('Auto-generated from AI');
    });
  });

  describe('deriveScriptName', () => {
    it('should extract @name from userscript header', () => {
      const script = '// ==UserScript==\n// @name My Awesome Script\n// @version 1.0\n// ==/UserScript==';
      expect(utils.deriveScriptName(script)).toBe('My Awesome Script');
    });

    it('should return empty string if no @name found', () => {
      expect(utils.deriveScriptName('no name here')).toBe('');
    });
  });

  describe('generateFilename', () => {
    it('should generate filename from script @name', () => {
      const script = '// @name My Test Script';
      expect(utils.generateFilename(script)).toBe('my-test-script.user.js');
    });

    it('should use fallback when no @name', () => {
      const filename = utils.generateFilename('no name', 'fallback');
      expect(filename).toBe('fallback.user.js');
    });
  });

  describe('optimizeScript', () => {
    it('should remove trailing whitespace from lines', () => {
      const script = 'line1   \nline2\t\nline3';
      expect(utils.optimizeScript(script)).toBe('line1\nline2\nline3');
    });

    it('should collapse multiple blank lines', () => {
      const script = 'line1\n\n\n\nline2';
      expect(utils.optimizeScript(script)).toBe('line1\n\nline2');
    });

    it('should trim leading/trailing whitespace', () => {
      expect(utils.optimizeScript('  hello  ')).toBe('hello');
    });
  });

  describe('debugLog', () => {
    it('should not throw when called', () => {
      expect(() => utils.debugLog('test', 'message')).not.toThrow();
    });
  });
});