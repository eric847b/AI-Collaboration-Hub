/**
 * Run autonomous check suite
 * Executes validate, security audit, and other checks.
 * Usage: node scripts/autonomous-check.cjs [--quick] [--fix]
 */

const { spawnSync } = require('child_process');
const path = require('path');

const BASE_DIR = path.join(__dirname, '..');
const QUICK = process.argv.includes('--quick');
const FIX = process.argv.includes('--fix');

function runScript(name, args = []) {
  const scriptPath = path.join(BASE_DIR, 'scripts', name);
  const result = spawnSync('node', [scriptPath, ...args], {
    stdio: 'inherit',
    shell: true
  });
  return result.status === 0;
}

function autonomousCheck() {
  console.log('🤖 Autonomous Check Suite\n');
  console.log('='.repeat(50));

  let failed = false;

  // 1. Validate project structure
  console.log('\n📋 Step 1: Project Validation');
  if (!runScript('validate.cjs')) {
    console.log('❌ Validation failed');
    failed = true;
  } else {
    console.log('✅ Validation passed');
  }

  // 2. Validate modules
  console.log('\n🔍 Step 2: Module Validation');
  if (!runScript('validate-modules.js')) {
    console.log('❌ Module validation failed');
    failed = true;
  } else {
    console.log('✅ Module validation passed');
  }

  // 3. Check dependencies
  console.log('\n🔗 Step 3: Dependency Check');
  if (!runScript('check-dependencies.js')) {
    console.log('❌ Dependency check failed');
    failed = true;
  } else {
    console.log('✅ Dependency check passed');
  }

  // 4. Security audit
  if (!QUICK) {
    console.log('\n🔒 Step 4: Security Audit');
    if (!runScript('security-audit.cjs')) {
      console.log('❌ Security audit failed');
      failed = true;
    } else {
      console.log('✅ Security audit passed');
    }
  }

  // 5. Consolidation check
  if (!QUICK) {
    console.log('\n🔎 Step 5: Duplicate Detection');
    if (!runScript('consolidate-all.cjs', ['--dry-run'])) {
      console.log('❌ Consolidation check failed');
      failed = true;
    } else {
      console.log('✅ Consolidation check passed');
    }
  }

  // 6. Lint
  console.log("\n🧹 Step 6: Lint Check");
  // Use npx to ensure eslint is resolved correctly from the root node_modules
  const eslintResult = spawnSync("npx", ["eslint", "Userscripts/modules", "scripts"], {
    stdio: "inherit",
    shell: true,
    cwd: BASE_DIR // Ensure npx runs from the project root
  });
  if (eslintResult.status !== 0) {
    console.log("⚠️  Lint check failed");
  } else {
    console.log("✅ Lint check passed");
  }

  console.log('\n' + '='.repeat(50));
  if (failed) {
    console.log('❌ Autonomous check suite failed');
    process.exit(1);
  } else {
    console.log('✅ Autonomous check suite passed');
    process.exit(0);
  }
}

if (require.main === module) {
  try {
    autonomousCheck();
  } catch (error) {
    console.error('❌ Autonomous check error:', error);
    process.exit(1);
  }
}

module.exports = { autonomousCheck };