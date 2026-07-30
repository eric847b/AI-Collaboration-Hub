const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  cleanTargets,
  DEFAULT_TARGETS,
  resolveTargetPaths
} = require('../clean.cjs');

describe('clean script', () => {
  test('resolves targets against the provided base directory', () => {
    const resolved = resolveTargetPaths(['dist', '.eslintcache'], {
      baseDir: '/workspace/project',
      path
    });

    expect(resolved).toEqual([
      {
        absolutePath: path.resolve('/workspace/project', 'dist'),
        target: 'dist'
      },
      {
        absolutePath: path.resolve('/workspace/project', '.eslintcache'),
        target: '.eslintcache'
      }
    ]);
  });

  test('uses the expected default clean targets', () => {
    expect(DEFAULT_TARGETS).toEqual(['dist', 'node_modules', 'coverage', '.eslintcache']);
  });

  test('removes existing files and directories and reports missing targets', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'clean-script-'));
    const logger = { info: jest.fn() };
    const distDir = path.join(tempDir, 'dist');
    const cacheFile = path.join(tempDir, '.eslintcache');

    fs.mkdirSync(distDir);
    fs.writeFileSync(path.join(distDir, 'bundle.js'), 'bundle');
    fs.writeFileSync(cacheFile, 'cache');

    const result = cleanTargets(['dist', '.eslintcache', 'coverage'], {
      baseDir: tempDir,
      logger
    });

    expect(result).toEqual({
      missing: ['coverage'],
      removed: ['dist', '.eslintcache']
    });
    expect(fs.existsSync(distDir)).toBe(false);
    expect(fs.existsSync(cacheFile)).toBe(false);
    expect(logger.info).toHaveBeenCalledWith('[clean] Removed: dist, .eslintcache');
    expect(logger.info).toHaveBeenCalledWith('[clean] Skipped missing: coverage');

    fs.rmSync(tempDir, { force: true, recursive: true });
  });

  test('returns an empty removal summary when nothing exists', () => {
    const logger = { info: jest.fn() };
    const result = cleanTargets(['dist'], {
      baseDir: '/workspace/project',
      fs: {
        existsSync: jest.fn(() => false),
        rmSync: jest.fn()
      },
      logger,
      path
    });

    expect(result).toEqual({
      missing: ['dist'],
      removed: []
    });
    expect(logger.info).toHaveBeenCalledWith('[clean] Skipped missing: dist');
  });
});
