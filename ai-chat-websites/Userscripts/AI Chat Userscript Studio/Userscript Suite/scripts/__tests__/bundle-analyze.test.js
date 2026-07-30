const path = require('path');
const { analyzeBundle } = require('../bundle-analyze.cjs');

describe('bundle analyze', () => {
  test('throws when the dist directory is missing', () => {
    expect(() => analyzeBundle({
      distDir: '/workspace/dist',
      fs: {
        existsSync: jest.fn(() => false)
      },
      logger: { info: jest.fn() },
      path,
      utils: {
        log: jest.fn(),
        success: jest.fn()
      }
    })).toThrow('Dist directory not found. Run a bundle build first.');
  });

  test('throws when there are no dist files to analyze', () => {
    expect(() => analyzeBundle({
      distDir: '/workspace/dist',
      fs: {
        existsSync: jest.fn(() => true),
        readdirSync: jest.fn(() => ['notes.txt'])
      },
      logger: { info: jest.fn() },
      path,
      utils: {
        log: jest.fn(),
        success: jest.fn()
      }
    })).toThrow('No distribution files found to analyze.');
  });

  test('returns a size-sorted report and logs analyzed files', () => {
    const logger = { info: jest.fn() };
    const utils = {
      log: jest.fn(),
      success: jest.fn()
    };
    const statsByFile = {
      'bundle-a.user.js': {
        mtime: new Date('2026-04-05T16:00:00.000Z'),
        size: 1024
      },
      'stats.json': {
        mtime: new Date('2026-04-05T17:00:00.000Z'),
        size: 3072
      },
      'bundle-b.js': {
        mtime: new Date('2026-04-05T15:00:00.000Z'),
        size: 2048
      }
    };

    const report = analyzeBundle({
      distDir: '/workspace/dist',
      fs: {
        existsSync: jest.fn(() => true),
        readdirSync: jest.fn(() => ['bundle-a.user.js', 'stats.json', 'notes.txt', 'bundle-b.js']),
        statSync: jest.fn(filePath => statsByFile[path.basename(filePath)])
      },
      logger,
      path,
      utils
    });

    expect(report).toEqual([
      {
        file: 'stats.json',
        modified: '2026-04-05T17:00:00.000Z',
        sizeKB: '3.00'
      },
      {
        file: 'bundle-b.js',
        modified: '2026-04-05T15:00:00.000Z',
        sizeKB: '2.00'
      },
      {
        file: 'bundle-a.user.js',
        modified: '2026-04-05T16:00:00.000Z',
        sizeKB: '1.00'
      }
    ]);
    expect(utils.log).toHaveBeenCalledWith('Starting bundle analysis...');
    expect(utils.success).toHaveBeenCalledWith('Analyzing 3 dist files...');
    expect(utils.success).toHaveBeenCalledWith('Bundle analysis complete.');
    expect(logger.info).toHaveBeenCalledWith(' - stats.json: 3.00 KB (modified 2026-04-05T17:00:00.000Z)');
  });
});
