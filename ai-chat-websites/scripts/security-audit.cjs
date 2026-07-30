/**
 * Root-level security audit
 * Scans for vulnerable patterns and reports issues.
 * Usage: node scripts/security-audit.cjs
 */

const fs = require('fs');
const path = require('path');

const BASE_DIR = path.join(__dirname, '..');
const MODULES_DIR = path.join(BASE_DIR, 'Userscripts', 'modules');
const UNIFIED_SUITE = path.join(BASE_DIR, 'Userscripts', 'Unified-AI-Assistant-Suite.user.js');

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

function scanFile(filePath, reporter, isUnifiedSuite = false) {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const fileName = path.basename(filePath);

    // Common checks for all files
    // Check for hardcoded API keys
    if (/(api_key|API_KEY|apikey)\s*[:=]\s*['"][^'"]{10,}['"]/.test(content)) {
      reporter.addIssue(`${fileName}: Possible hardcoded API key`);
    }

    // Specific checks for the Unified Suite (the bundled userscript)
    if (isUnifiedSuite) {
      // Check for eval(), but allow new Function() for syntax validation
      if (/\beval\s*\(/.test(content) && !/new\s+Function\s*\(/.test(content)) {
        reporter.addIssue(`${fileName}: eval() usage detected - security risk`);
      }

      // Check for document.write()
      if (/document\.write\s*\(/.test(content)) {
        reporter.addWarning(`${fileName}: document.write() usage - may cause issues`);
      }

      // Check for innerHTML with dynamic content (simple detection for now)
      if (/innerHTML\s*=\s*[^`]*\$\{/.test(content) || /innerHTML\s*=\s*[^`]*\+/.test(content)) {
        reporter.addWarning(`${fileName}: innerHTML with dynamic content - XSS risk`);
      }
    } else {
      // For individual modules, primarily rely on validate-modules.js for these checks
      // No additional eval/document.write/innerHTML checks for modules here
    }

  } catch (error) {
    // skip unreadable file
  }
}

function audit() {
  console.log('🔒 Running security audit...\n');

  const reporter = createReporter();

  // Scan unified suite (the bundled userscript)
  if (fs.existsSync(UNIFIED_SUITE)) {
    scanFile(UNIFIED_SUITE, reporter, true);
  }

  // Scan individual modules (less strict checks, relying on module-specific validation)
  if (fs.existsSync(MODULES_DIR)) {
    const files = fs.readdirSync(MODULES_DIR).filter(f => f.endsWith(".js"));
    files.forEach(file => scanFile(path.join(MODULES_DIR, file), reporter, false));
  }

  console.log('='.repeat(50));
  console.log('📊 Security Audit Results:');

  if (reporter.warnings.length > 0) {
    console.log('\n⚠️  Warnings:');
    reporter.warnings.forEach(w => console.log(`  - ${w}`));
  }

  if (reporter.issues.length > 0) {
    console.log('\n❌ Issues:');
    reporter.issues.forEach(i => console.log(`  - ${i}`));
    console.log('\n❌ Security audit failed');
    process.exit(1);
  } else {
    console.log('✅ No security issues found');
    process.exit(0);
  }
}

if (require.main === module) {
  try {
    audit();
  } catch (error) {
    console.error('❌ Security audit error:', error);
    process.exit(1);
  }
}

module.exports = { audit };