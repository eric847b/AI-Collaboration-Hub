const path = require('path');
const {
  normalizeRegistrationArgs,
  runQuickTest
} = require('../quick-test.cjs');

describe('quick test helpers', () => {
  test('normalizes single-object registrations', () => {
    const instance = { name: 'Demo', version: '1.0.0' };

    expect(normalizeRegistrationArgs([instance])).toBe(instance);
  });

  test('normalizes legacy name/version/object registrations', () => {
    const instance = {};

    expect(normalizeRegistrationArgs(['Demo', '1.2.3', instance])).toBe(instance);
    expect(instance).toEqual({
      name: 'Demo',
      version: '1.2.3'
    });
  });

  test('returns a passing summary when all module evaluations succeed', () => {
    const logger = {
      error: jest.fn(),
      info: jest.fn(),
      warn: jest.fn()
    };
    const result = runQuickTest({
      fs: {
        readFileSync: jest.fn(() => '// ==UserScript==\n// @name Test\n// ==/UserScript==\nconsole.info("ok");')
      },
      logger,
      moduleFiles: ['/workspace/Modules/alpha.module.user.js', '/workspace/Modules/beta.module.user.js'],
      path,
      performance: {
        now: jest
          .fn()
          .mockReturnValueOnce(0)
          .mockReturnValueOnce(5)
          .mockReturnValueOnce(5)
          .mockReturnValueOnce(11)
      },
      utils: {
        extractCode: jest.fn(content => content)
      },
      vm: {
        createContext: jest.fn(() => ({})),
        runInContext: jest.fn()
      }
    });

    expect(result).toEqual({
      exitCode: 0,
      failed: 0,
      failures: [],
      passed: 2,
      performanceMetrics: [
        { fileName: 'alpha.module.user.js', loadTime: 5, status: 'passed' },
        { fileName: 'beta.module.user.js', loadTime: 6, status: 'passed' }
      ]
    });
    expect(logger.info).toHaveBeenCalledWith('[QuickTest] PASSED');
  });

  test('returns a failing summary and logs failures when evaluation throws', () => {
    const logger = {
      error: jest.fn(),
      info: jest.fn(),
      warn: jest.fn()
    };
    const result = runQuickTest({
      fs: {
        readFileSync: jest.fn(() => 'throw new Error("broken");')
      },
      logger,
      moduleFiles: ['/workspace/Modules/broken.module.user.js'],
      path,
      performance: {
        now: jest
          .fn()
          .mockReturnValueOnce(0)
          .mockReturnValueOnce(3)
      },
      utils: {
        extractCode: jest.fn(content => content)
      },
      vm: {
        createContext: jest.fn(() => ({})),
        runInContext: jest.fn(() => {
          throw new Error('broken');
        })
      }
    });

    expect(result.exitCode).toBe(1);
    expect(result.failed).toBe(1);
    expect(result.failures).toEqual([
      { fileName: 'broken.module.user.js', message: 'broken', loadTime: 3 }
    ]);
    expect(logger.error).toHaveBeenCalledWith('[QuickTest] FAILED');
  });

  test('returns early when there are no module files', () => {
    const logger = {
      error: jest.fn(),
      info: jest.fn(),
      warn: jest.fn()
    };
    const result = runQuickTest({
      logger,
      moduleFiles: []
    });

    expect(result).toEqual({
      exitCode: 0,
      failed: 0,
      failures: [],
      passed: 0,
      performanceMetrics: []
    });
    expect(logger.warn).toHaveBeenCalledWith('[QuickTest] No modules found');
  });
});
