const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

function findGitRoot(startDir, options = {}) {
  const fsImpl = options.fs || fs;
  const pathImpl = options.path || path;
  let currentDir = startDir;

  while (currentDir) {
    const gitDir = pathImpl.join(currentDir, '.git');
    if (fsImpl.existsSync(gitDir)) {
      return currentDir;
    }

    const parentDir = pathImpl.dirname(currentDir);
    if (parentDir === currentDir) {
      break;
    }

    currentDir = parentDir;
  }

  return null;
}

function runSetupHusky(options = {}) {
  const { codePackRoot } = options;
  const fsImpl = options.fs || fs;
  const logger = options.logger || console;
  const pathImpl = options.path || path;
  const processImpl = options.process || process;
  const spawnSyncImpl = options.spawnSync || spawnSync;
  const huskyDir = options.huskyDir || pathImpl.join(codePackRoot, '.husky');
  const gitRoot = options.gitRoot || findGitRoot(codePackRoot, {
    fs: fsImpl,
    path: pathImpl
  });

  if (!gitRoot) {
    logger.info('[prepare] Skipping husky install: no enclosing git repository found.');
    return 0;
  }

  const npxCommand = processImpl.platform === 'win32' ? 'npx.cmd' : 'npx';
  const result = spawnSyncImpl(npxCommand, ['husky', 'install', huskyDir], {
    cwd: gitRoot,
    shell: false,
    stdio: 'inherit'
  });

  return result.status || 0;
}

module.exports = {
  findGitRoot,
  runSetupHusky
};
