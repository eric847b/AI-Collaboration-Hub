/**
 * Pre-bundle validation script
 * Checks userscript metadata, support files, and common structural issues.
 * Usage: node scripts/validate.cjs
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const utils = require('./bundler-utils.cjs');

const BASE_DIR = path.join(__dirname, '..');
const MODULES_DIR = path.join(BASE_DIR, 'Modules');
const HUB_FILE = path.join(BASE_DIR, '00-hub.user.js');
const PACKAGE_FILE = path.join(BASE_DIR, 'package.json');

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
  return fs.readFileSync(filePath, 'utf-8');
}

function hasGrant(metadata, grantName) {
  let grants = [];

  if (metadata.grant) {
    grants = Array.isArray(metadata.grant) ? metadata.grant : [metadata.grant];
  }

  return grants.some(grant => String(grant).trim() === grantName);
}

function checkMojibake(label, content, reporter) {
  if (/[\u00E2\u00F0]/.test(content)) {
    reporter.addWarning(`${label}: Contains mojibake characters that should be cleaned up`);
  }
}

const LEGACY_MODULES = [
  '01-automation.module.user.js',
  '10-rmd-network-optimization.module.user.js',
  '11-ai-performance-monitor.module.user.js',
  '12-ai-security-enhancer.module.user.js',
  '13-rmd-screen-capture.module.user.js',
  '14-rmd-input-simulation.module.user.js',
  '15-rmd-decision-making.module.user.js',
  '16-ai-task-manager.module.user.js',
  '16-rmd-html-website-info.module.user.js',
  '17-ai-reminder-system.module.user.js',
  '17-rmd-debugging-logging.module.user.js',
  '18-rmd-dynamic-code-analysis.module.user.js',
  '19-rmd-caching-strategies.module.user.js',
  '20-rmd-parallel-processing.module.user.js',
  '21-rmd-memory-management.module.user.js',
  '22-rmd-authentication-security.module.user.js',
  'sovereign-activator.module.user.js',
  'sovereign-loader.module.user.js'
];

function isLegacyModule(filePath) {
  return LEGACY_MODULES.includes(path.basename(filePath).toLowerCase());
}

function isUtilityModule(content, metadata) {
  const moduleName = String(metadata.name || '').toLowerCase();
  return moduleName.includes('utilities') || content.includes('window.ChatGPTUtils');
}

function hasModuleIdentity(content) {
  return (
    /this\.name\s*=/.test(content) ||
    /name\s*:\s*['"`][^'"`]+['"`]/.test(content) ||
    /register\s*\(\s*['"`][^'"`]+['"`]\s*,\s*['"`][^'"`]+['"`]\s*,/.test(content)
  ) && (
    /this\.version\s*=/.test(content) ||
    /version\s*:\s*['"`][^'"`]+['"`]/.test(content) ||
    /register\s*\(\s*['"`][^'"`]+['"`]\s*,\s*['"`][^'"`]+['"`]\s*,/.test(content)
  );
}

function hasInitLifecycle(content) {
  return /(?:async\s+)?init\s*\(/.test(content);
}

function hasRegistrationPattern(content) {
  return /(?:ModuleRegistry|ChatGPTModules)\.register\(/.test(content);
}

function checkUserscriptFile(filePath, options = {}) {
  const {
    requireConstructorFields = false,
    reporter = createReporter()
  } = options;
  const label = path.relative(BASE_DIR, filePath);
  const content = readFile(filePath);
  const parsed = utils.parseUserScriptHeader(content);
  const {metadata} = parsed;

  if (!parsed.hasHeader) {
    reporter.addIssue(`${label}: Missing userscript header`);
    return reporter;
  }

  if (!metadata.name) {
    reporter.addIssue(`${label}: Missing @name in userscript header`);
  }

  if (!metadata.version) {
    reporter.addIssue(`${label}: Missing @version in userscript header`);
  }

  if (!metadata.match) {
    reporter.addWarning(`${label}: Missing @match declaration`);
  }

  if (!metadata.grant) {
    reporter.addWarning(`${label}: Missing @grant declaration`);
  }

  if (requireConstructorFields && !isUtilityModule(content, metadata) && !isLegacyModule(filePath)) {
    if (!hasModuleIdentity(content)) {
      reporter.addWarning(`${label}: No module name/version identity found`);
    }

    if (!hasInitLifecycle(content)) {
      reporter.addWarning(`${label}: No init() lifecycle found`);
    }

    if (!hasRegistrationPattern(content)) {
      reporter.addWarning(`${label}: No module registration call found`);
    }
  }

  checkMojibake(label, content, reporter);
  return reporter;
}

function collectReferencedFiles(pkg) {
  const referenced = new Set();

  Object.values(pkg.scripts || {}).forEach(scriptValue => {
    const matches = scriptValue.match(/\.\/[^\s'"]+/g) || [];
    matches.forEach(match => referenced.add(match.replace(/^\.\//, '')));
  });

  (pkg.jest?.setupFilesAfterEnv || []).forEach(entry => {
    referenced.add(entry.replace(/^<rootDir>\//, ''));
  });

  return Array.from(referenced).sort();
}

function checkNodeSyntax(filePath, reporter = createReporter()) {
  const label = path.relative(BASE_DIR, filePath);
  const result = spawnSync(process.execPath, ['--check', filePath], {
    encoding: 'utf-8'
  });

  if (result.error) {
    reporter.addIssue(`${label}: Node syntax check could not run (${result.error.message})`);
    return reporter;
  }

  if (result.status !== 0) {
    reporter.addIssue(`${label}: Node syntax check failed`);
  }

  return reporter;
}

function runValidation() {
  const reporter = createReporter();

  if (!fs.existsSync(MODULES_DIR)) {
    process.exit(1);
  }

  checkUserscriptFile(HUB_FILE, { reporter });
  checkNodeSyntax(HUB_FILE, reporter);
  console.info(`  [OK] ${path.relative(BASE_DIR, HUB_FILE)}`);

  // Scan recursively through all subdirectories
  const moduleFiles = utils.getModuleFilesRecursive(MODULES_DIR);

  if (moduleFiles.length === 0) {
    reporter.addWarning('No module files found in Modules directory');
  }

  moduleFiles.forEach(filePath => {
    checkUserscriptFile(filePath, { requireConstructorFields: true, reporter });
    console.info(`  [OK] ${path.relative(BASE_DIR, filePath)}`);
  });

  // console.log('\n2. Checking ConfigManager defaults...');
  try {
    const hubContent = readFile(HUB_FILE);
    if (hubContent.includes('getDefaultConfig')) {
      // console.log('  [OK] ConfigManager.getDefaultConfig found');
    } else {
      reporter.addIssue('00-hub.user.js: ConfigManager.getDefaultConfig not found');
    }
  } catch (err) {
    reporter.addWarning(`Could not inspect hub defaults: ${err.message}`);
  }

  // console.log('\n3. Checking package-referenced support files...');
  try {
    const pkg = JSON.parse(readFile(PACKAGE_FILE));
    const referencedFiles = collectReferencedFiles(pkg);

    referencedFiles.forEach(relativePath => {
      const fullPath = path.join(BASE_DIR, relativePath);
      if (!fs.existsSync(fullPath)) {
        reporter.addIssue(`package.json references missing file: ${relativePath}`);
      } else {
        if (/\.(?:c?js|mjs)$/i.test(relativePath)) {
          checkNodeSyntax(fullPath, reporter);
        }
        // console.log(`  [OK] ${relativePath}`);
      }
    });
  } catch (err) {
    reporter.addIssue(`package.json could not be validated: ${err.message}`);
  }

  // console.log('\n4. Checking for common issues...');
  moduleFiles.forEach(filePath => {
    const label = path.relative(BASE_DIR, filePath);
    const content = readFile(filePath);
    const {metadata} = utils.parseUserScriptHeader(content);

    if (content.includes('localStorage') && !hasGrant(metadata, 'none') && !/(?:GM_getValue|GM\.getValue)/.test(content)) {
      reporter.addWarning(`${label}: Uses localStorage without a GM_* fallback`);
    }
  });
  // console.log('  [OK] Common issue scan complete');

  // console.log(`\n${'='.repeat(70)}`);
  // console.log(`ISSUES: ${reporter.issues.length} | WARNINGS: ${reporter.warnings.length}`);
  // console.log('='.repeat(70));

  if (reporter.issues.length > 0) {
    console.error('\nISSUES (must fix):');
    reporter.issues.forEach(issue => console.error(`  [ERROR] ${issue}`));
  }

  if (reporter.warnings.length > 0) {
    console.warn('\nWARNINGS (review):');
    reporter.warnings.forEach(warning => console.warn(`  [WARN] ${warning}`));
  }

  if (reporter.issues.length > 0) {
    console.error('\n[Validate] FAILED: Fix issues before bundling');
    process.exit(1);
  }

  console.info('\n[Validate] PASSED: Ready to bundle\n');
  return reporter;
}

module.exports = {
  checkUserscriptFile,
  checkNodeSyntax,
  collectReferencedFiles,
  createReporter,
  hasGrant,
  hasInitLifecycle,
  hasModuleIdentity,
  hasRegistrationPattern,
  isUtilityModule,
  runValidation
};

if (require.main === module) {
  runValidation();
}
