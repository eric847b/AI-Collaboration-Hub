'use strict';

// Runs on Node's built-in test runner (no node_modules required):
//   node --test scripts/__tests__/validate.test.cjs
// Kept as .cjs because package.json sets "type": "module" (.js = ESM).
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  checkNodeSyntax,
  createReporter,
  hasGrant,
  hasInitLifecycle,
  hasModuleIdentity,
  hasRegistrationPattern,
  isUtilityModule
} = require('../validate.cjs');

describe('validate helpers', () => {
  it('recognizes legacy 3-argument registration as module identity', () => {
    const content = `
      class DemoModule {}
      const module = new DemoModule();
      window.ChatGPTModules.register("Demo", "1.2.3", module);
    `;

    assert.equal(hasModuleIdentity(content), true);
    assert.equal(hasRegistrationPattern(content), true);
  });

  it('recognizes init lifecycle methods', () => {
    assert.equal(hasInitLifecycle('class Demo { init() {} }'), true);
    assert.equal(hasInitLifecycle('const demo = { async init() {} };'), true);
    assert.equal(hasInitLifecycle('const demo = { setup() {} };'), false);
  });

  it('detects utility modules so structure warnings can be skipped', () => {
    const metadata = { name: '0. Utilities .M' };
    const content = 'window.ChatGPTUtils = window.ChatGPTUtils || {};';

    assert.equal(isUtilityModule(content, metadata), true);
  });

  it('treats grant none as an intentional no-GM script', () => {
    assert.equal(hasGrant({ grant: 'none' }, 'none'), true);
    assert.equal(hasGrant({ grant: ['GM_getValue', 'GM_setValue'] }, 'none'), false);
  });

  it('creates isolated reporters', () => {
    const reporter = createReporter();
    reporter.addIssue('issue');
    reporter.addWarning('warning');

    assert.deepEqual(reporter.issues, ['issue']);
    assert.deepEqual(reporter.warnings, ['warning']);
  });

  it('flags invalid node script syntax in referenced helpers', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'validate-test-'));
    const brokenScriptPath = path.join(tempDir, 'broken-script.cjs');
    const reporter = createReporter();

    fs.writeFileSync(brokenScriptPath, 'you#!/usr/bin/env node\nconsole.log("broken");\n');

    checkNodeSyntax(brokenScriptPath, reporter);

    assert.equal(reporter.issues.length, 1);
    assert.match(reporter.issues[0], /Node syntax check failed/);

    fs.rmSync(tempDir, { recursive: true, force: true });
  });
});