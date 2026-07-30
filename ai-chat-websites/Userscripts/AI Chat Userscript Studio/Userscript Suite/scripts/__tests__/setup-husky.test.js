const path = require('path');
const {
  findGitRoot,
  runSetupHusky
} = require('../setup-husky.cjs');

describe('setup husky helper', () => {
  test('findGitRoot walks up to the nearest enclosing git directory', () => {
    const existing = new Set([
      path.join('/workspace', '.git')
    ]);

    const gitRoot = findGitRoot('/workspace/project/scripts', {
      fs: {
        existsSync: jest.fn(target => existing.has(target))
      },
      path
    });

    expect(gitRoot).toBe('/workspace');
  });

  test('findGitRoot returns null when no git directory exists', () => {
    const gitRoot = findGitRoot('/workspace/project/scripts', {
      fs: {
        existsSync: jest.fn(() => false)
      },
      path
    });

    expect(gitRoot).toBeNull();
  });

  test('runSetupHusky skips installation when there is no git root', () => {
    const logger = { info: jest.fn() };
    const spawnSync = jest.fn();

    const exitCode = runSetupHusky({
      codePackRoot: '/workspace/project',
      fs: {
        existsSync: jest.fn(() => false)
      },
      logger,
      path,
      process: {
        platform: 'linux'
      },
      spawnSync
    });

    expect(exitCode).toBe(0);
    expect(spawnSync).not.toHaveBeenCalled();
    expect(logger.info).toHaveBeenCalledWith('[prepare] Skipping husky install: no enclosing git repository found.');
  });

  test('runSetupHusky uses npx.cmd on Windows', () => {
    const spawnSync = jest.fn(() => ({ status: 0 }));

    const exitCode = runSetupHusky({
      codePackRoot: 'C:\\workspace\\project',
      gitRoot: 'C:\\workspace',
      huskyDir: 'C:\\workspace\\project\\.husky',
      logger: { info: jest.fn() },
      path,
      process: {
        platform: 'win32'
      },
      spawnSync
    });

    expect(exitCode).toBe(0);
    expect(spawnSync).toHaveBeenCalledWith('npx.cmd', ['husky', 'install', 'C:\\workspace\\project\\.husky'], {
      cwd: 'C:\\workspace',
      shell: false,
      stdio: 'inherit'
    });
  });

  test('runSetupHusky returns the husky process status', () => {
    const exitCode = runSetupHusky({
      codePackRoot: '/workspace/project',
      gitRoot: '/workspace',
      huskyDir: '/workspace/project/.husky',
      logger: { info: jest.fn() },
      path,
      process: {
        platform: 'linux'
      },
      spawnSync: jest.fn(() => ({ status: 3 }))
    });

    expect(exitCode).toBe(3);
  });
});
