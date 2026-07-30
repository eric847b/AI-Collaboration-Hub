const fs = require('fs');
const path = require('path');
const utils = require('./bundler-utils.cjs');

const BASE_DIR = path.join(__dirname, '..');
const DIST_DIR = path.join(BASE_DIR, 'dist');
const INPUT_FILE = path.join(DIST_DIR, 'ai-chat-userscript-suite.bundle.merged.user.js');
const OUTPUT_FILE = path.join(DIST_DIR, 'ai-chat-userscript-suite.bundle.merged.min.user.js');

function minifyBundle(options = {}) {
  const fsImpl = options.fs || fs;
  const utilsImpl = options.utils || utils;
  const distDir = options.distDir || DIST_DIR;
  const inputFile = options.inputFile || INPUT_FILE;
  const outputFile = options.outputFile || OUTPUT_FILE;

  utilsImpl.ensureDir(distDir);
  utilsImpl.log('Starting bundle minification...');
  utilsImpl.validateFile(inputFile);

  const original = fsImpl.readFileSync(inputFile, 'utf-8');
  const minifiedBody = utilsImpl.minify(original);

  // preserve header from original and prepend to minified body
  const header = utilsImpl.extractHeader(original) || utilsImpl.defaultHeader?.() || '';
  const outContent = `${header}\n\n${minifiedBody}`.trim();

  // atomic write with backup and validation
  utilsImpl.backupFile(outputFile);
  const tmpFile = `${outputFile}.tmp`;
  fsImpl.writeFileSync(tmpFile, outContent, 'utf-8');
  fsImpl.renameSync(tmpFile, outputFile);

  // basic validation
  const finalSize = utilsImpl.getFileSizeKB(outputFile);
  if (Number(finalSize) < 1) {
    throw new Error(`Minified bundle output seems too small: ${finalSize} KB`);
  }
  const sizeOriginal = Number(utilsImpl.getFileSizeKB(inputFile));
  const sizeMinified = Number(utilsImpl.getFileSizeKB(outputFile));
  const reductionPercent = sizeOriginal > 0
    ? ((sizeOriginal - sizeMinified) / sizeOriginal * 100).toFixed(2)
    : '0.00';

  utilsImpl.success(`Minified bundle created: ${outputFile}`);
  utilsImpl.success(`Original size: ${sizeOriginal.toFixed(2)} KB`);
  utilsImpl.success(`Minified size: ${sizeMinified.toFixed(2)} KB`);
  utilsImpl.success(`Reduction: ${reductionPercent}%`);

  return {
    outputFile,
    reductionPercent,
    sizeMinifiedKB: sizeMinified.toFixed(2),
    sizeOriginalKB: sizeOriginal.toFixed(2)
  };
}

module.exports = {
  minifyBundle
};

if (require.main === module) {
  try {
    minifyBundle();
  } catch (err) {
    utils.error(`Minification failed: ${err.message}`);
    console.error(err.stack);
    process.exit(1);
  }
}
