#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const BASE_DIR = path.join(__dirname, '..');
const DEFAULT_TARGETS = ['dist', 'node_modules', 'coverage', '.eslintcache'];

function resolveTargetPaths(targets, options = {}) {
  const pathImpl = options.path || path;
  const baseDir = options.baseDir || BASE_DIR;

  return (targets || []).map(target => ({
    absolutePath: pathImpl.resolve(baseDir, target),
    target
  }));
}

function cleanTargets(targets = DEFAULT_TARGETS, options = {}) {
  const fsImpl = options.fs || fs;
  const logger = options.logger || console;
  const resolvedTargets = resolveTargetPaths(targets, options);
  const removed = [];
  const missing = [];

  resolvedTargets.forEach(({ absolutePath, target }) => {
    if (!fsImpl.existsSync(absolutePath)) {
      missing.push(target);
      return;
    }

    fsImpl.rmSync(absolutePath, {
      force: true,
      recursive: true
    });
    removed.push(target);
  });

  if (removed.length > 0) {
    logger.info(`[clean] Removed: ${removed.join(', ')}`);
  }

  if (missing.length > 0) {
    logger.info(`[clean] Skipped missing: ${missing.join(', ')}`);
  }

  return {
    missing,
    removed
  };
}

module.exports = {
  cleanTargets,
  DEFAULT_TARGETS,
  resolveTargetPaths
};

if (require.main === module) {
  const targets = process.argv.slice(2);
  cleanTargets(targets.length > 0 ? targets : DEFAULT_TARGETS);
}
