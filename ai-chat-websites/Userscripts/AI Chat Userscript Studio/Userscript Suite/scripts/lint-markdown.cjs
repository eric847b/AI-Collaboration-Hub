const fs = require('fs');
const path = require('path');

const DEFAULT_IGNORED_DIRS = ['.git', 'dist', 'node_modules'];

function collectMarkdownFiles(dirPath, options = {}) {
  const fsImpl = options.fs || fs;
  const pathImpl = options.path || path;
  const ignoredDirs = new Set(options.ignoredDirs || DEFAULT_IGNORED_DIRS);

  return fsImpl.readdirSync(dirPath, { withFileTypes: true }).flatMap(entry => {
    const fullPath = pathImpl.join(dirPath, entry.name);

    if (entry.isDirectory()) {
      if (ignoredDirs.has(entry.name)) {
        return [];
      }

      return collectMarkdownFiles(fullPath, {
        fs: fsImpl,
        ignoredDirs: Array.from(ignoredDirs),
        path: pathImpl
      });
    }

    return entry.isFile() && entry.name.toLowerCase().endsWith('.md')
      ? [fullPath]
      : [];
  });
}

function runMarkdownLint(options = {}) {
  const { rootDir } = options;
  const lintImpl = options.lint;
  const logger = options.logger || console;
  const pathImpl = options.path || path;
  const readConfigImpl = options.readConfig;
  const configPath = options.configPath || pathImpl.join(rootDir, '.markdownlint.json');

  const files = options.files || collectMarkdownFiles(rootDir, options);
  const config = options.config || readConfigImpl(configPath);
  const results = lintImpl({ files, config });
  const output = results.toString().trim();

  if (output) {
    logger.error(output);
    return {
      exitCode: 1,
      files,
      output
    };
  }

  logger.info(`[MarkdownLint] Passed ${files.length} file(s)`);
  return {
    exitCode: 0,
    files,
    output
  };
}

module.exports = {
  DEFAULT_IGNORED_DIRS,
  collectMarkdownFiles,
  runMarkdownLint
};
