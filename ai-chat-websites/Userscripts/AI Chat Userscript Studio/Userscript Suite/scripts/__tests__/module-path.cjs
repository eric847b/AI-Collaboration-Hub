const fs = require('fs');
const path = require('path');

const modulesDir = path.join(__dirname, '../../Modules');

function getModuleFiles(dir = modulesDir) {
  const results = [];

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...getModuleFiles(fullPath));
    } else if (entry.name.endsWith('.module.user.js')) {
      results.push(fullPath);
    }
  }

  return results;
}

function resolveModulePath(candidates) {
  const moduleFiles = getModuleFiles();

  for (const candidate of candidates) {
    const exactMatch = moduleFiles.find(file => path.basename(file).toLowerCase() === candidate.toLowerCase());
    if (exactMatch) {
      return exactMatch;
    }
  }

  throw new Error(`Could not resolve module path from candidates: ${candidates.join(', ')}`);
}

module.exports = {
  resolveModulePath
};
