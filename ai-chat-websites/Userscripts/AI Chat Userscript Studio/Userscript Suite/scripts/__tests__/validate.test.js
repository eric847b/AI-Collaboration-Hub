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
} = require('../validate');

describe('validate helpers', () => {
  test('recognizes legacy 3-argument registration as module identity', () => {
    const content = `
      class DemoModule {}
      const module = new DemoModule();
      window.ChatGPTModules.register("Demo", "1.2.3", module);
    `;

    expect(hasModuleIdentity(content)).toBe(true);
    expect(hasRegistrationPattern(content)).toBe(true);
  });

  test('recognizes init lifecycle methods', () => {
    expect(hasInitLifecycle('class Demo { init() {} }')).toBe(true);
    expect(hasInitLifecycle('const demo = { async init() {} };')).toBe(true);
    expect(hasInitLifecycle('const demo = { setup() {} };')).toBe(false);
  });

  test('detects utility modules so structure warnings can be skipped', () => {
    const metadata = { name: '0. Utilities .M' };
    const content = 'window.ChatGPTUtils = window.ChatGPTUtils || {};';

    expect(isUtilityModule(content, metadata)).toBe(true);
  });

  test('treats grant none as an intentional no-GM script', () => {
    expect(hasGrant({ grant: 'none' }, 'none')).toBe(true);
    expect(hasGrant({ grant: ['GM_getValue', 'GM_setValue'] }, 'none')).toBe(false);
  });

  test('creates isolated reporters', () => {
    const reporter = createReporter();
    reporter.addIssue('issue');
    reporter.addWarning('warning');

    expect(reporter.issues).toEqual(['issue']);
    expect(reporter.warnings).toEqual(['warning']);
  });

  test('flags invalid node script syntax in referenced helpers', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'validate-test-'));
    const brokenScriptPath = path.join(tempDir, 'broken-script.cjs');
    const reporter = createReporter();

    fs.writeFileSync(brokenScriptPath, 'you#!/usr/bin/env node\nconsole.log("broken");\n');

    checkNodeSyntax(brokenScriptPath, reporter);

    expect(reporter.issues).toHaveLength(1);
    expect(reporter.issues[0]).toContain('Node syntax check failed');

    fs.rmSync(tempDir, { recursive: true, force: true });
  });
});
