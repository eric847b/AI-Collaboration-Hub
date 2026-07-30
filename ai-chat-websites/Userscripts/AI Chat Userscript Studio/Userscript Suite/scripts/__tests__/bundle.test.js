const path = require('path');
const { buildBundle } = require('../bundle.cjs');

describe('bundle builder', () => {
  test('builds a concatenated bundle with hub header and module code', () => {
    const files = {
      '/workspace/hub.user.js': '// ==UserScript==\n// @name Hub Name\n// @version 2.0.0\n// ==/UserScript==\nconsole.info("hub");',
      '/workspace/Modules/a.user.js': '// ==UserScript==\n// @name Alpha\n// @version 1.0.0\n// ==/UserScript==\nconsole.info("alpha");',
      '/workspace/Modules/b.user.js': '// ==UserScript==\n// ==/UserScript==\nconsole.info("beta");'
    };
    const writes = [];
    const utils = {
      ensureDir: jest.fn(),
      extractCode: jest.fn(content => content.split('// ==/UserScript==\n')[1].trim()),
      extractHeader: jest.fn(content => content.split('\nconsole.info')[0]),
      backupFile: jest.fn(() => {}),
      getFileSizeKB: jest.fn(() => '12.34'),
      getModuleFilesRecursive: jest.fn(() => ['/workspace/Modules/a.user.js', '/workspace/Modules/b.user.js']),
      log: jest.fn(),
      parseHeader: jest.fn(header => {
        if (header.includes('@name Hub Name')) {
          return { name: 'Hub Name', version: '2.0.0' };
        }
        if (header.includes('@name Alpha')) {
          return { name: 'Alpha', version: '1.0.0' };
        }
        return {};
      }),
      success: jest.fn(),
      validateFile: jest.fn(),
      validateHeader: jest.fn(() => true),
      warn: jest.fn()
    };

    const result = buildBundle({
      distDir: '/workspace/dist',
      fs: {
        readFileSync: jest.fn(filePath => files[filePath]),
        writeFileSync: jest.fn((filePath, content, encoding) => {
          writes.push({ filePath, content, encoding });
        }),
        renameSync: jest.fn()
      },
      generatedAt: '2026-04-05T17:30:00.000Z',
      hubFile: '/workspace/hub.user.js',
      modulesDir: '/workspace/Modules',
      outputFile: '/workspace/dist/bundle.user.js',
      path,
      utils
    });

    expect(writes[0]).toEqual({
      content: expect.stringContaining('// Generated: 2026-04-05T17:30:00.000Z'),
      encoding: 'utf-8',
      filePath: '/workspace/dist/bundle.user.js.tmp'
    });
    expect(writes[0].content).toContain('console.info("hub");');
    expect(writes[0].content).toContain('console.info("alpha");');
    expect(writes[0].content).toContain('console.info("beta");');
    expect(result.outputFile).toBe('/workspace/dist/bundle.user.js');
    expect(result.sizeKB).toBe('12.34');
    expect(result.moduleMetadata).toEqual([
      { name: 'Alpha', version: '1.0.0' },
      { name: 'b.user.js', version: '1.0.0' }
    ]);
    expect(utils.success).toHaveBeenCalledWith('Bundle created: /workspace/dist/bundle.user.js');
    expect(utils.success).toHaveBeenCalledWith('Modules bundled: 2');
  });

  test('warns when the hub header validation fails and continues', () => {
    const writes = [];
    const utils = {
      ensureDir: jest.fn(),
      extractCode: jest.fn(() => 'console.info("hub");'),
      extractHeader: jest.fn(() => '// ==UserScript==\n// ==/UserScript=='),
      backupFile: jest.fn(() => {}),
      getFileSizeKB: jest.fn(() => '1.00'),
      getModuleFilesRecursive: jest.fn(() => []),
      log: jest.fn(),
      parseHeader: jest.fn(() => ({})),
      success: jest.fn(),
      validateFile: jest.fn(),
      validateHeader: jest.fn(() => false),
      warn: jest.fn()
    };

    buildBundle({
      distDir: '/workspace/dist',
      fs: {
        readFileSync: jest.fn(() => '// ==UserScript==\n// ==/UserScript==\nconsole.info("hub");'),
        writeFileSync: jest.fn((filePath, content, encoding) => {
          writes.push({ filePath, content, encoding });
        }),
        renameSync: jest.fn()
      },
      hubFile: '/workspace/hub.user.js',
      modulesDir: '/workspace/Modules',
      outputFile: '/workspace/dist/bundle.user.js',
      path,
      utils
    });

    expect(utils.warn).toHaveBeenCalledWith('Hub header validation failed, continuing anyway...');
  });
});