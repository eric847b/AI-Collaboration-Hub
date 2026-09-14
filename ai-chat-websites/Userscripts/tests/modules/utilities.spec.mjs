/**
 * Spec for modules/utilities.js (loads via its CommonJS export guard).
 * Sets a minimal window shim first so generateId() can use crypto.randomUUID.
 * Usage: node Userscripts/tests/modules/utilities.spec.mjs
 */
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';

globalThis.window = { crypto: { randomUUID: () => 'test-uuid-0000-0000' } };
const require = createRequire(import.meta.url);
const u = require('../../modules/utilities.js');

// sanitizeText: strips null bytes, trims, coerces
assert.equal(u.sanitizeText('a' + String.fromCharCode(0) + 'b'), 'ab');
assert.equal(u.sanitizeText('  padded  '), 'padded');
assert.equal(u.sanitizeText(null), '');
assert.equal(u.sanitizeText(42), '42');

// safeJsonParse: valid / invalid / empty
assert.deepEqual(u.safeJsonParse('{"x":1}', null), { x: 1 });
assert.equal(u.safeJsonParse('not json', 'fb'), 'fb');
assert.equal(u.safeJsonParse('', 'fb'), 'fb');

// generateId: prefers crypto.randomUUID
assert.equal(u.generateId(), 'test-uuid-0000-0000');

// indentCode
assert.equal(u.indentCode('a\nb', 2), '  a\n  b');
assert.equal(u.indentCode('x', 0), 'x');

// extractCodeBlock: fenced vs plain
assert.equal(u.extractCodeBlock('```js\nalert(1)\n```'), 'alert(1)');
assert.equal(u.extractCodeBlock('```javascript\nvar a;\n```'), 'var a;');
assert.equal(u.extractCodeBlock('plain text'), 'plain text');

// deriveDescription: code blocks removed, whitespace collapsed
assert.equal(u.deriveDescription('```js\ncode\n``` hello world'), 'hello world');
assert.equal(u.deriveDescription('   '), 'Auto-generated from AI');

// deriveScriptName / generateFilename
assert.equal(u.deriveScriptName('// @name My Script\n// ==/UserScript=='), 'My Script');
assert.equal(u.deriveScriptName('no name here'), '');
assert.equal(u.generateFilename('// @name My Cool Script!'), 'my-cool-script.user.js');
assert.equal(u.generateFilename('', 'fallback'), 'fallback.user.js');

// optimizeScript: trailing whitespace + 3+ newlines collapsed
assert.equal(u.optimizeScript('a  \nb\n\n\n\nc '), 'a\nb\n\nc');

console.log('utilities.spec: all assertions passed');
