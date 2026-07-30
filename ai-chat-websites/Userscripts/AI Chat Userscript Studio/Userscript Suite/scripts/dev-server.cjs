/**
 * Lightweight development watcher for the Userscript Suite.
 * Rebuilds the merged bundle when source files change.
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const utils = require('./bundler-utils.cjs');

function createDevServer(dependencies = {}) {
  const fsImpl = dependencies.fs || fs;
  const pathImpl = dependencies.path || path;
  const spawnImpl = dependencies.spawn || spawn;
  const utilsImpl = dependencies.utils || utils;
  const processImpl = dependencies.process || process;
  const scriptDir = dependencies.scriptDir || __dirname;
  const baseDir = pathImpl.join(scriptDir, '..');
  const watchTargets = [
    pathImpl.join(baseDir, '00-hub.user.js'),
    pathImpl.join(baseDir, 'settings-ui.js'),
    pathImpl.join(baseDir, 'Modules')
  ];

  let buildInFlight = false;
  let queuedReason = null;

  function runBuild(reason) {
    if (buildInFlight) {
      queuedReason = reason;
      return;
    }

    buildInFlight = true;
    utilsImpl.log(`Starting merged bundle build (${reason})...`);

    const child = spawnImpl(processImpl.execPath, [pathImpl.join(scriptDir, 'bundle-merge.cjs')], {
      cwd: baseDir,
      stdio: 'inherit'
    });

    child.on('exit', code => {
      buildInFlight = false;

      if (code === 0) {
        utilsImpl.success('Dev build completed successfully.');
      } else {
        utilsImpl.error(`Dev build failed with exit code ${code}.`);
      }

      if (queuedReason) {
        const pendingReason = queuedReason;
        queuedReason = null;
        runBuild(`${pendingReason} (queued)`);
      }
    });
  }

  function watchTarget(targetPath) {
    const stats = fsImpl.statSync(targetPath);
    const options = stats.isDirectory() && processImpl.platform === 'win32'
      ? { recursive: true }
      : {};

    fsImpl.watch(targetPath, options, (eventType, fileName) => {
      const label = fileName || pathImpl.basename(targetPath);
      utilsImpl.log(`Change detected (${eventType}): ${label}`);
      runBuild(label);
    });
  }

  function start() {
    watchTargets.filter(fsImpl.existsSync).forEach(targetPath => {
      watchTarget(targetPath);
      utilsImpl.log(`Watching: ${pathImpl.relative(baseDir, targetPath)}`);
    });

    runBuild('initial build');
  }

  return {
    baseDir,
    runBuild,
    start,
    watchTarget,
    watchTargets
  };
}

module.exports = {
  createDevServer
};

if (require.main === module) {
  createDevServer().start();
}
