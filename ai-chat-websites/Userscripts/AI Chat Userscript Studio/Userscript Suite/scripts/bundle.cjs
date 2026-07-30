const fs = require('fs');
const path = require('path');
const utils = require('./bundler-utils.cjs');

const BASE_DIR = path.join(__dirname, '..');
const HUB_FILE = path.join(BASE_DIR, '00-hub.user.js');
const MODULES_DIR = path.join(BASE_DIR, 'Modules');
const DIST_DIR = path.join(BASE_DIR, 'dist');
const OUTPUT_FILE = path.join(DIST_DIR, 'ai-chat-userscript-suite.bundle.user.js');

function buildBundle(options = {}) {
  const fsImpl = options.fs || fs;
  const pathImpl = options.path || path;
  const utilsImpl = options.utils || utils;
  const distDir = options.distDir || DIST_DIR;
  const hubFile = options.hubFile || HUB_FILE;
  const modulesDir = options.modulesDir || MODULES_DIR;
  const outputFile = options.outputFile || OUTPUT_FILE;
  const generatedAt = options.generatedAt || new Date().toISOString();

  utilsImpl.ensureDir(distDir);
  utilsImpl.log('Starting bundle process...');
  utilsImpl.validateFile(hubFile);

  const hubContent = fsImpl.readFileSync(hubFile, 'utf-8');
  const hubHeader = utilsImpl.extractHeader(hubContent);
  const hubCode = utilsImpl.extractCode(hubContent);

  if (!utilsImpl.validateHeader(hubHeader)) {
    utilsImpl.warn('Hub header validation failed, continuing anyway...');
  }

  const hubMetadata = utilsImpl.parseHeader(hubHeader);
  utilsImpl.log(`Hub file loaded: ${hubMetadata.name || 'Unknown'} v${hubMetadata.version || '1.0.0'}`);

  const moduleFiles = utilsImpl.getModuleFilesRecursive(modulesDir);
  const moduleContents = [];
  const moduleMetadata = [];

  moduleFiles.forEach(filePath => {
    const fileName = pathImpl.basename(filePath);
    const content = fsImpl.readFileSync(filePath, 'utf-8');
    const code = utilsImpl.extractCode(content);
    const header = utilsImpl.extractHeader(content);
    const metadata = utilsImpl.parseHeader(header);

    moduleContents.push(code);
    moduleMetadata.push({
      name: metadata.name || fileName,
      version: metadata.version || '1.0.0'
    });

    utilsImpl.log(`Loaded: ${metadata.name || fileName} v${metadata.version || '1.0.0'}`);
  });

  const bundledCode = [
    hubHeader,
    '',
    '// ============================================================================',
    '// BUNDLED AI CHAT USERSCRIPT SUITE',
    `// Generated: ${generatedAt}`,
    `// Modules: ${moduleMetadata.length}`,
    '// ============================================================================',
    '',
    hubCode,
    '',
    '// ============================================================================',
    '// MODULES',
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
    throw new Error(`Bundle output seems too small: ${finalSize} KB`);
  }

  const sizeKB = utilsImpl.getFileSizeKB(outputFile);
  utilsImpl.success(`Bundle created: ${outputFile}`);
  utilsImpl.success(`Size: ${sizeKB} KB`);
  utilsImpl.success(`Modules bundled: ${moduleMetadata.length}`);
  utilsImpl.log('Bundle process complete.\n');

  return {
    bundledCode,
    moduleMetadata,
    outputFile,
    sizeKB
  };
}

module.exports = {
  buildBundle
};

if (require.main === module) {
  try {
    buildBundle();
  } catch (err) {
    utils.error(`Bundle failed: ${err.message}`);
    console.error(err.stack);
    process.exit(1);
  }
}
