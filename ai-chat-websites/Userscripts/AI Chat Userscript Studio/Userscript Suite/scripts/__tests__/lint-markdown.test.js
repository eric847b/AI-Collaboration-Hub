const path = require('path');
const {
  DEFAULT_IGNORED_DIRS,
  collectMarkdownFiles,
  runMarkdownLint
} = require('../lint-markdown.cjs');
const posixPath = path.posix;

describe('markdown lint helper', () => {
  test('collectMarkdownFiles skips ignored directories and returns markdown files only', () => {
    const dirEntries = {
      '/workspace': [
        { name: 'README.md', isDirectory: () => false, isFile: () => true },
        { name: 'docs', isDirectory: () => true, isFile: () => false },
        { name: 'dist', isDirectory: () => true, isFile: () => false },
        { name: 'notes.txt', isDirectory: () => false, isFile: () => true }
      ],
      '/workspace/docs': [
        { name: 'guide.md', isDirectory: () => false, isFile: () => true }
      ]
    };

    const files = collectMarkdownFiles('/workspace', {
      fs: {
        readdirSync: jest.fn(dirPath => dirEntries[dirPath] || [])
      },
      path: posixPath
    });

    expect(files).toEqual([
      posixPath.join('/workspace', 'README.md'),
      posixPath.join('/workspace/docs', 'guide.md')
    ]);
    expect(DEFAULT_IGNORED_DIRS).toEqual(['.git', 'dist', 'node_modules']);
  });

  test('runMarkdownLint logs success when there are no lint issues', () => {
    const logger = {
      error: jest.fn(),
      info: jest.fn()
    };

    const result = runMarkdownLint({
      config: { default: true },
      files: ['/workspace/README.md', '/workspace/docs/guide.md'],
      lint: jest.fn(() => ({
        toString: () => ''
      })),
      logger,
      path: posixPath,
      readConfig: jest.fn(),
      rootDir: '/workspace'
    });

    expect(result).toEqual({
      exitCode: 0,
      files: ['/workspace/README.md', '/workspace/docs/guide.md'],
      output: ''
    });
    expect(logger.info).toHaveBeenCalledWith('[MarkdownLint] Passed 2 file(s)');
  });

  test('runMarkdownLint logs errors and returns a failing exit code when lint output exists', () => {
    const logger = {
      error: jest.fn(),
      info: jest.fn()
    };

    const result = runMarkdownLint({
      config: { default: true },
      files: ['/workspace/README.md'],
      lint: jest.fn(() => ({
        toString: () => '/workspace/README.md:1 MD001/example rule'
      })),
      logger,
      path: posixPath,
      readConfig: jest.fn(),
      rootDir: '/workspace'
    });

    expect(result).toEqual({
      exitCode: 1,
      files: ['/workspace/README.md'],
      output: '/workspace/README.md:1 MD001/example rule'
    });
    expect(logger.error).toHaveBeenCalledWith('/workspace/README.md:1 MD001/example rule');
    expect(logger.info).not.toHaveBeenCalled();
  });

  test('runMarkdownLint reads config and collects files when they are not provided', () => {
    const logger = {
      error: jest.fn(),
      info: jest.fn()
    };
    const fs = {
      readdirSync: jest.fn(dirPath => {
        if (dirPath === '/workspace') {
          return [
            { name: 'README.md', isDirectory: () => false, isFile: () => true }
          ];
        }

        return [];
      })
    };
    const readConfig = jest.fn(() => ({ default: true }));

    const result = runMarkdownLint({
      fs,
      lint: jest.fn(() => ({
        toString: () => ''
      })),
      logger,
      path: posixPath,
      readConfig,
      rootDir: '/workspace'
    });

    expect(result.files).toEqual(['/workspace/README.md']);
    expect(readConfig).toHaveBeenCalledWith(posixPath.join('/workspace', '.markdownlint.json'));
  });
});
