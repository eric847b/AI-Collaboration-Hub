/**
 * Find duplicate userscript modules/snippets and report consolidation opportunities.
 * Usage: node scripts/consolidate-all.cjs [--dry-run]
 */

const fs = require('fs');
const path = require('path');

const BASE_DIR = path.join(__dirname, '..');
const MODULES_DIR = path.join(BASE_DIR, 'Userscripts', 'modules');
const PLUGINS_DIR = path.join(BASE_DIR, 'Userscripts', 'plugins');
const UNIFIED_SUITE = path.join(BASE_DIR, 'Userscripts', 'Unified-AI-Assistant-Suite.user.js');

const dryRun = process.argv.includes('--dry-run');

function createReporter() {
  return {
    duplicates: [],
    addDuplicate(a, b, reason) {
      this.duplicates.push({ a, b, reason });
    }
  };
}

function checksum(content) {
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    hash = ((hash << 5) - hash) + content.charCodeAt(i);
    hash |= 0;
  }
  return String(hash);
}

function findDuplicates(dir, reporter) {
  if (!fs.existsSync(dir)) return;
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.js') || f.endsWith('.user.js'));
  const map = new Map();

  files.forEach(file => {
    const full = path.join(dir, file);
    const content = fs.readFileSync(full, 'utf-8');
    const hash = checksum(content);
    if (!map.has(hash)) map.set(hash, []);
    map.get(hash).push(file);
  });

  map.forEach((list, hash) => {
    if (list.length > 1) {
      list.forEach((file, idx) => {
        if (idx === 0) return;
        reporter.addDuplicate(list[0], file, 'identical content');
      });
    }
  });
}

function consolidate() {
  console.log('🔎 Scanning for duplicate userscript modules...\n');

  const reporter = createReporter();

  findDuplicates(MODULES_DIR, reporter);
  findDuplicates(PLUGINS_DIR, reporter);

  // Simple size-based heuristic for consolidated comparisons
  console.log('='.repeat(50));
  console.log('📊 Consolidation Report:');

  if (reporter.duplicates.length === 0) {
    console.log('✅ No duplicates found');
    process.exit(0);
  }

  console.log(`\n⚠️  Found ${reporter.duplicates.length} potential duplicate(s):`);
  reporter.duplicates.forEach(d => console.log(`  - ${d.a} <-> ${d.b}: ${d.reason}`));

  if (!dryRun) {
    console.log('\nℹ️  Dry run recommended before deletion.');
  }

  process.exit(0);
}

if (require.main === module) {
  try {
    consolidate();
  } catch (error) {
    console.error('❌ Consolidation scan failed:', error);
    process.exit(1);
  }
}

module.exports = { consolidate };