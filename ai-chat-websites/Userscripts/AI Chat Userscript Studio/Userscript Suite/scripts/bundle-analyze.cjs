const fs = require('fs');
const path = require('path');
const utils = require('./bundler-utils.cjs');

const BASE_DIR = path.join(__dirname, '..');
const DIST_DIR = path.join(BASE_DIR, 'dist');

function analyzeBundle(options = {}) {
  const fsImpl = options.fs || fs;
  const pathImpl = options.path || path;
  const utilsImpl = options.utils || utils;
  const logger = options.logger || console;
  const distDir = options.distDir || DIST_DIR;

  utilsImpl.log('Starting bundle analysis...');

  if (!fsImpl.existsSync(distDir)) {
    throw new Error('Dist directory not found. Run a bundle build first.');
  }

  const files = fsImpl.readdirSync(distDir).filter(file => file.endsWith('.user.js') || file.endsWith('.js') || file.endsWith('.json'));
  if (files.length === 0) {
    throw new Error('No distribution files found to analyze.');
  }

  const report = files.map(file => {
    const filePath = pathImpl.join(distDir, file);
    const stats = fsImpl.statSync(filePath);
    return {
      file,
      sizeKB: (stats.size / 1024).toFixed(2),
      modified: stats.mtime.toISOString()
    };
  }).sort((a, b) => Number(b.sizeKB) - Number(a.sizeKB));

  utilsImpl.success(`Analyzing ${report.length} dist files...`);
  report.forEach(entry => {
    logger.info(` - ${entry.file}: ${entry.sizeKB} KB (modified ${entry.modified})`);
  });

  utilsImpl.success('Bundle analysis complete.');
  return report;
}

module.exports = {
  analyzeBundle
};

if (require.main === module) {
  try {
    analyzeBundle();
  } catch (err) {
    utils.error(`Analysis failed: ${err.message}`);
    console.error(err.stack);
    process.exit(1);
  }
}
