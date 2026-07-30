const fs = require('fs');
const path = require('path');
const utils = require('./bundler-utils.cjs');

const BASE_DIR = path.join(__dirname, '..');
const HUB_FILE = path.join(BASE_DIR, '00-hub.user.js');
const MODULES_DIR = path.join(BASE_DIR, 'Modules');
const DIST_DIR = path.join(BASE_DIR, 'dist');
const OUTPUT_FILE = path.join(DIST_DIR, 'ai-chat-userscript-suite.bundle.merged.user.js');

function buildMergedBundle(options = {}) {
  const fsImpl = options.fs || fs;
  const pathImpl = options.path || path;
  const utilsImpl = options.utils || utils;
  const distDir = options.distDir || DIST_DIR;
  const hubFile = options.hubFile || HUB_FILE;
  const modulesDir = options.modulesDir || MODULES_DIR;
  const outputFile = options.outputFile || OUTPUT_FILE;
  const generatedAt = options.generatedAt || new Date().toISOString();

  utilsImpl.ensureDir(distDir);
  utilsImpl.log('Starting merged bundle process...');
  utilsImpl.validateFile(hubFile);

  const hubContent = fsImpl.readFileSync(hubFile, 'utf-8');
  const hubHeader = utilsImpl.extractHeader(hubContent);
  const hubCode = utilsImpl.extractCode(hubContent);

  if (!utilsImpl.validateHeader(hubHeader)) {
    utilsImpl.warn('Hub header validation failed');
  }

  const hubMeta = utilsImpl.parseHeader(hubHeader);
  utilsImpl.success(`Hub loaded: ${hubMeta.name || 'Unknown'} v${hubMeta.version || '1.0.0'}`);

  const moduleFiles = utilsImpl.getModuleFilesRecursive(modulesDir);
  const moduleContents = [];
  const allHeaders = [hubHeader];
  const moduleMeta = [];

  moduleFiles.forEach(filePath => {
    const fileName = pathImpl.basename(filePath);
    const content = fsImpl.readFileSync(filePath, 'utf-8');
    const header = utilsImpl.extractHeader(content);
    const code = utilsImpl.extractCode(content);
    const meta = utilsImpl.parseHeader(header);

    moduleContents.push(code);
    allHeaders.push(header);
    moduleMeta.push({ name: meta.name || fileName, version: meta.version || '1.0.0' });
    utilsImpl.log(`Loaded: ${meta.name || fileName}`);
  });

  const mergedHeader = utilsImpl.mergeHeaders(allHeaders);

  const bundledCode = [
    mergedHeader,
    '',
    '// ============================================================================',
    '// MERGED AI CHAT USERSCRIPT SUITE - ALL-IN-ONE BUNDLE',
    `// Generated: ${generatedAt}`,
    `// Modules: ${moduleMeta.length}`,
    '// ============================================================================',
    '',
    hubCode,
    '',
    '// ============================================================================',
    '// BUNDLED MODULES',
    '// ============================================================================',
    '',
    moduleContents.join('\n\n')
  ].join('\n');

  // atomic write with backup and validation
  utilsImpl.backupFile(outputFile);
  const tmpFile = `${outputFile}.tmp`;
  fsImpl.writeFileSync(tmpFile, bundledCode, 'utf-8');
  fsImpl.renameSync(tmpFile, outputFile);

  // basic validation
  const finalSize = utilsImpl.getFileSizeKB(outputFile);
  if (Number(finalSize) < 1) {
    throw new Error(`Merged bundle output seems too small: ${finalSize} KB`);
  }

  const sizeKB = utilsImpl.getFileSizeKB(outputFile);
  utilsImpl.success(`Merged bundle created: ${outputFile}`);
  utilsImpl.success(`Size: ${sizeKB} KB`);
  utilsImpl.success(`Modules: ${moduleMeta.length}`);
  utilsImpl.log('Merged bundle complete.\n');

  return {
    bundledCode,
    mergedHeader,
    moduleMeta,
    outputFile,
    sizeKB
  };
}

module.exports = {
  buildMergedBundle
};

if (require.main === module) {
  try {
    buildMergedBundle();
  } catch (err) {
    utils.error(`Merge failed: ${err.message}`);
    console.error(err.stack);
    process.exit(1);
  }
}
