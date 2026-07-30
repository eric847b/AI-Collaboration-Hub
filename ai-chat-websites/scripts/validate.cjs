/**
 * Root-level project validation
 * Checks userscript metadata, support files, and common structural issues.
 * Usage: node scripts/validate.cjs
 */

const fs = require('fs');
const path = require('path');

const BASE_DIR = path.join(__dirname, '..');
const USERSCRIPTS_DIR = path.join(BASE_DIR, 'Userscripts');
const UNIFIED_SUITE = path.join(USERSCRIPTS_DIR, 'Unified-AI-Assistant-Suite.user.js');
const PACKAGE_FILE = path.join(BASE_DIR, 'package.json');
const README_FILE = path.join(BASE_DIR, 'README.md');

function createReporter() {
  return {
    issues: [],
    warnings: [],
    addIssue(message) {
      this.issues.push(message);
    },
    addWarning(message) {
      this.warnings.push(message);
    }
  };
}

function readFile(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf-8');
  } catch (error) {
    return null;
  }
}

function checkMojibake(label, content, reporter) {
  if (/[âð]/.test(content)) {
    reporter.addWarning(`${label}: Contains mojibake characters that should be cleaned up`);
  }
}

function validateUserscriptMetadata(content, reporter) {
  const hasHeader = /\/\/ ==UserScript==/.test(content) && /\/\/ ==\/UserScript==/.test(content);
  const hasName = /\/\/ @name\s+/.test(content);
  const hasNamespace = /\/\/ @namespace\s+/.test(content);
  const hasVersion = /\/\/ @version\s+/.test(content);
  const hasMatch = /\/\/ @match\s+/.test(content);
  const hasGrant = /\/\/ @grant\s+/.test(content);

  if (!hasHeader) reporter.addIssue('Missing userscript metadata header block');
  if (!hasName) reporter.addIssue('Missing @name metadata');
  if (!hasNamespace) reporter.addIssue('Missing @namespace metadata');
  if (!hasVersion) reporter.addIssue('Missing @version metadata');
  if (!hasMatch) reporter.addIssue('Missing @match metadata');
  if (!hasGrant) reporter.addWarning('Missing @grant metadata');

  return hasHeader;
}

function validatePackageJson(content, reporter) {
  if (!content) {
    reporter.addIssue('package.json not found');
    return false;
  }

  try {
    const pkg = JSON.parse(content);
    if (!pkg.name) reporter.addIssue('package.json missing name');
    if (!pkg.version) reporter.addIssue('package.json missing version');
    if (!pkg.scripts) reporter.addIssue('package.json missing scripts');
    return true;
  } catch (error) {
    reporter.addIssue(`package.json parse error: ${error.message}`);
    return false;
  }
}

function validateReadme(content, reporter) {
  if (!content) {
    reporter.addIssue('README.md not found');
    return false;
  }
  if (!/AI Chat Websites/i.test(content)) {
    reporter.addWarning('README.md missing project identifier');
  }
  return true;
}

function validateSupportingFiles(reporter) {
  const required = [
    'Userscripts/modules/config.js',
    'Userscripts/modules/state.js',
    'Userscripts/modules/utilities.js',
    'Userscripts/modules/storage.js',
    'Userscripts/modules/providers.js',
    'Userscripts/modules/ui.js',
    'Userscripts/modules/theme.js',
    'Userscripts/modules/versioning.js',
    'Userscripts/modules/auth.js',
    'Userscripts/modules/index.js',
    'scripts/build-userscript.js',
    'scripts/validate-modules.js',
    'scripts/check-dependencies.js'
  ];

  required.forEach(relPath => {
    const fullPath = path.join(BASE_DIR, relPath);
    if (!fs.existsSync(fullPath)) {
      reporter.addIssue(`Missing required file: ${relPath}`);
    }
  });
}

function validate() {
  console.log('🔍 Validating project structure...\n');

  const reporter = createReporter();

  const unifiedContent = readFile(UNIFIED_SUITE);
  const packageContent = readFile(PACKAGE_FILE);
  const readmeContent = readFile(README_FILE);

  if (!unifiedContent) {
    reporter.addIssue('Unified-AI-Assistant-Suite.user.js not found');
  } else {
    validateUserscriptMetadata(unifiedContent, reporter);
    checkMojibake('Unified-AI-Assistant-Suite.user.js', unifiedContent, reporter);
  }

  validatePackageJson(packageContent, reporter);
  validateReadme(readmeContent, reporter);
  validateSupportingFiles(reporter);

  console.log('='.repeat(50));
  console.log('📊 Validation Results:');

  if (reporter.warnings.length > 0) {
    console.log('\n⚠️  Warnings:');
    reporter.warnings.forEach(w => console.log(`  - ${w}`));
  }

  if (reporter.issues.length > 0) {
    console.log('\n❌ Issues:');
    reporter.issues.forEach(i => console.log(`  - ${i}`));
    console.log('\n❌ Validation failed');
    process.exit(1);
  } else {
    console.log('✅ Validation passed');
    process.exit(0);
  }
}

if (require.main === module) {
  try {
    validate();
  } catch (error) {
    console.error('❌ Validation error:', error);
    process.exit(1);
  }
}

module.exports = { validate };