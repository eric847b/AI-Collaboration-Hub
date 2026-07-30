const path = require('path');
const { buildMergedBundle } = require('../bundle-merge.cjs');

describe('bundle merge builder', () => {
  test('builds an all-in-one bundle with a merged header', () => {
    const files = {
      '/workspace/hub.user.js': '// ==UserScript==\n// @name Hub Name\n// @version 2.0.0\n// ==/UserScript==\nconsole.info("hub");',
      '/workspace/Modules/a.user.js': '// ==UserScript==\n// @name Alpha\n// @grant GM_getValue\n// ==/UserScript==\nconsole.info("alpha");',
      '/workspace/Modules/b.user.js': '// ==UserScript==\n// @name Beta\n// @grant GM_setValue\n// ==/UserScript==\nconsole.info("beta");'
    };
    const writes = [];
    const mergedHeader = '// ==UserScript==\n// @name Hub Name\n// @grant GM_getValue\n// @grant GM_setValue\n// ==/UserScript==';
    const utils = {
      ensureDir: jest.fn(),
      extractCode: jest.fn(content => content.split('// ==/UserScript==\n')[1].trim()),
      extractHeader: jest.fn(content => content.split('\nconsole.info')[0]),
      getFileSizeKB: jest.fn(() => '22.22'),
      backupFile: jest.fn(() => {}),
      getModuleFilesRecursive: jest.fn(() => ['/workspace/Modules/a.user.js', '/workspace/Modules/b.user.js']),
      log: jest.fn(),
      mergeHeaders: jest.fn(() => mergedHeader),
      parseHeader: jest.fn(header => {
        if (header.includes('@name Hub Name')) {
          return { name: 'Hub Name', version: '2.0.0' };
        }
        if (header.includes('@name Alpha')) {
          return { name: 'Alpha', version: '1.0.0' };
        }
        if (header.includes('@name Beta')) {
          return { name: 'Beta', version: '1.0.0' };
        }
        return {};
      }),
      success: jest.fn(),
      validateFile: jest.fn(),
      validateHeader: jest.fn(() => true),
      warn: jest.fn()
    };

    const result = buildMergedBundle({
      distDir: '/workspace/dist',
      fs: {
        readFileSync: jest.fn(filePath => files[filePath]),
        writeFileSync: jest.fn((filePath, content, encoding) => {
          writes.push({ filePath, content, encoding });
        }),
        renameSync: jest.fn()
      },
      generatedAt: '2026-04-05T17:35:00.000Z',
      hubFile: '/workspace/hub.user.js',
      modulesDir: '/workspace/Modules',
      outputFile: '/workspace/dist/bundle.merged.user.js',
      path,
      utils
    });

    expect(result.mergedHeader).toBe(mergedHeader);
    expect(result.moduleMeta).toEqual([
      { name: 'Alpha', version: '1.0.0' },
      { name: 'Beta', version: '1.0.0' }
    ]);
    expect(writes[0]).toEqual({
      content: expect.stringContaining('// MERGED AI CHAT USERSCRIPT SUITE - ALL-IN-ONE BUNDLE'),
      encoding: 'utf-8',
      filePath: '/workspace/dist/bundle.merged.user.js.tmp'
    });
    expect(writes[0].content).toContain(mergedHeader);
    expect(writes[0].content).toContain('// Generated: 2026-04-05T17:35:00.000Z');
    expect(utils.success).toHaveBeenCalledWith('Merged bundle created: /workspace/dist/bundle.merged.user.js');
    expect(utils.success).toHaveBeenCalledWith('Modules: 2');
  });

  test('warns when merged bundle hub header validation fails and continues', () => {
    const writes = [];
    const utils = {
      ensureDir: jest.fn(),
      extractCode: jest.fn(() => 'console.info("hub");'),
      extractHeader: jest.fn(() => '// ==UserScript==\n// ==/UserScript=='),
      getFileSizeKB: jest.fn(() => '1.00'),
      backupFile: jest.fn(() => {}),
      getModuleFilesRecursive: jest.fn(() => []),
      log: jest.fn(),
      mergeHeaders: jest.fn(() => '// ==UserScript==\n// ==/UserScript=='),
      parseHeader: jest.fn(() => ({})),
      success: jest.fn(),
      validateFile: jest.fn(),
      validateHeader: jest.fn(() => false),
      warn: jest.fn()
    };

    buildMergedBundle({
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
      outputFile: '/workspace/dist/bundle.merged.user.js',
      path,
      utils
    });

    expect(utils.warn).toHaveBeenCalledWith('Hub header validation failed');
  });
});