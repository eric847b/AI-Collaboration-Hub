#!/usr/bin/env node

/**
 * suite-cli.cjs — Unified AI Assistant Suite CLI
 * 
 * Commands: test, health, report, validate, regression, perf, error-track
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const SUITE_DIR = path.resolve(__dirname, '..', 'AI Chat Userscript Studio', 'Userscript Suite');
const MODULES_DIR = path.join(SUITE_DIR, 'Modules', '00-Core');
const TEST_DIR = path.join(SUITE_DIR, '12-Testing');

const C = {
  reset: '\x1b[0m', green: '\x1b[32m', red: '\x1b[31m',
  yellow: '\x1b[33m', cyan: '\x1b[36m', bold: '\x1b[1m',
};

function clr(name, text) { return `${C[name]}${text}${C.reset}`; }
function hdr(t) { console.log('\n' + clr('bold', clr('cyan', `━━━ ${t} ━━━`))); }
function ok(m) { console.log(clr('green', '  ✓ ') + m); }
function bad(m) { console.log(clr('red', '  ✗ ') + m); }
function inf(m) { console.log(clr('yellow', '  ℹ ') + m); }

function findTests() {
  if (!fs.existsSync(TEST_DIR)) return [];
  return fs.readdirSync(TEST_DIR)
    .filter(f => f.endsWith('.cjs') || f.endsWith('.test.js'))
    .map(f => path.join(TEST_DIR, f))
    .sort();
}
function findModules() {
  const modules = [];
  try {
    const entries = fs.readdirSync(MODULES_DIR);
    for (const entry of entries) {
      const fullPath = path.join(MODULES_DIR, entry);
      try {
        const stat = fs.statSync(fullPath);
        if (stat.isFile() && entry.endsWith('.module.user.js')) {
          modules.push(fullPath);
        } else if (stat.isDirectory()) {
          const subFiles = fs.readdirSync(fullPath).filter(f => f.endsWith('.module.user.js'));
          for (const f of subFiles) modules.push(path.join(fullPath, f));
        }
      } catch {}
    }
  } catch {}
  return modules.sort();
}

// ─── COMMAND: test ─────────────────────────────────────────────
function cmdTest() {
  hdr('Running All Tests');
  const tests = findTests();
  if (tests.length === 0) { inf('No test files found.'); return 0; }
  let passed = 0, failed = 0;
  for (const test of tests) {
    const r = spawnSync('node', [test], { cwd: SUITE_DIR, encoding: 'utf8' });
    if (r.status === 0) {
      const first = (r.stdout || '').trim().split('\n')[0] || 'PASS';
      ok(`${path.basename(test)} — ${first}`);
      passed++;
    } else {
      bad(`${path.basename(test)} — exit ${r.status}`);
      if (r.stderr) console.log(r.stderr.split('\n').slice(0, 3).map(l => '      ' + l).join('\n'));
      failed++;
    }
  }
  console.log(`\n  ${passed} passed, ${failed} failed (${tests.length} total)`);
  return failed > 0 ? 1 : 0;
}

// ─── COMMAND: health ───────────────────────────────────────────
function cmdHealth() {
  hdr('Module Health Check (node --check)');
  const modules = findModules();
  if (modules.length === 0) { inf('No module files found.'); return 0; }
  let passed = 0, failed = 0;
  for (const mod of modules) {
    const r = spawnSync('node', ['--check', mod], { encoding: 'utf8' });
    if (r.status === 0) { ok(path.basename(mod)); passed++; }
    else { bad(`${path.basename(mod)} — ${(r.stderr||'').trim().split('\n')[0]}`); failed++; }
  }
  console.log(`\n  ${passed} passed, ${failed} failed (${modules.length} total modules)`);
  return failed > 0 ? 1 : 0;
}


// ─── COMMAND: report ─────────────────────────────────────────────────────────────────────────────────
function cmdReport() {
  hdr('Comprehensive Status Report');
  const modules = findModules();
  const tests = findTests();

  let totalModuleLines = 0, totalModuleSize = 0;
  for (const mod of modules) {
    const content = fs.readFileSync(mod, 'utf8');
    totalModuleLines += content.split('\n').length;
    totalModuleSize += fs.statSync(mod).size;
  }

  let testLines = 0;
  for (const t of tests) {
    testLines += fs.readFileSync(t, 'utf8').split('\n').length;
  }

  const roadmapPath = path.join(SUITE_DIR, 'ROADMAP.md');
  let roadmapItems = 0, roadmapDone = 0;
  if (fs.existsSync(roadmapPath)) {
    for (const line of fs.readFileSync(roadmapPath, 'utf8').split('\n')) {
      if (line.match(/^- \[[ x]\]/)) {
        roadmapItems++;
        if (line.includes('[x]')) roadmapDone++;
      }
    }
  }

  console.log(clr('bold', '\n  📦 Modules'));
  console.log(`     Count:       ${modules.length}`);
  console.log(`     Total lines:  ${totalModuleLines.toLocaleString()}`);
  console.log(`     Total size:   ${(totalModuleSize / 1024).toFixed(1)} KB`);

  console.log(clr('bold', '\n  🧪 Tests'));
  console.log(`     Test files:   ${tests.length}`);
  console.log(`     Total lines:  ${testLines.toLocaleString()}`);

  console.log(clr('bold', '\n  📋 ROADMAP'));
  const pct = roadmapItems > 0 ? ` (${((roadmapDone / roadmapItems) * 100).toFixed(0)}%)` : '';
  console.log(`     Items:        ${roadmapDone}/${roadmapItems} done${pct}`);

  const gitResult = spawnSync('git', ['log', '--oneline', '-1'], { cwd: REPO_ROOT, encoding: 'utf8' });
  if (gitResult.status === 0) {
    console.log(clr('bold', '\n  🔀 Git'));
    console.log(`     Last commit:  ${gitResult.stdout.trim()}`);
  }

  const gitStatus = spawnSync('git', ['status', '--short'], { cwd: REPO_ROOT, encoding: 'utf8' });
  if (gitStatus.status === 0) {
    const changed = gitStatus.stdout.trim().split('\n').filter(Boolean).length;
    if (changed > 0) inf(`${changed} uncommitted changes`);
    else ok('Clean working tree');
  }
  return 0;
}


// ─── COMMAND: validate ─────────────────────────────────────────
function cmdValidate() {
  hdr('Full Validation');
  const h = cmdHealth();
  console.log('');
  const t = cmdTest();
  return h || t;
}

// ─── COMMAND: regression ───────────────────────────────────────
function cmdRegression() {
  hdr('Full Regression Suite');
  const modules = findModules();
  const tests = findTests();

  // 1. Module health
  console.log(clr('bold', '\n  [1/4] Module Health'));
  let hp = 0, hf = 0;
  for (const mod of modules) {
    const r = spawnSync('node', ['--check', mod], { encoding: 'utf8' });
    if (r.status === 0) hp++; else hf++;
  }
  if (hf === 0) ok(`${hp} modules OK`); else bad(`${hf} modules failed health check`);

  // 2. Tests
  console.log(clr('bold', '\n  [2/4] Test Suites'));
  let tp = 0, tf = 0;
  for (const t of tests) {
    const r = spawnSync('node', [t], { cwd: SUITE_DIR, encoding: 'utf8' });
    if (r.status === 0) tp++; else tf++;
  }
  if (tf === 0) ok(`${tp} test suites OK`); else bad(`${tf} test suites failed`);

  // 3. Performance (bundle size)
  console.log(clr('bold', '\n  [3/4] Performance'));
  let totalSize = 0;
  for (const mod of modules) totalSize += fs.statSync(mod).size;
  const sizeKB = totalSize / 1024;
  const budgetKB = 300;
  if (sizeKB <= budgetKB) ok(`Bundle size ${sizeKB.toFixed(1)} KB (budget ${budgetKB} KB)`);
  else bad(`Bundle size ${sizeKB.toFixed(1)} KB EXCEEDS budget ${budgetKB} KB`);

  // 4. Error pattern scan
  console.log(clr('bold', '\n  [4/4] Error Pattern Scan'));
  let uncaughtCount = 0;
  const errorPatterns = [
    /catch\s*\(\w+\)\s*\{\s*\}/,
    /throw\s+[^;]+;\s*\/\/\s*TODO/i,
    /console\.error\([^)]*\)\s*;\s*$/m,
  ];
  for (const mod of modules) {
    const content = fs.readFileSync(mod, 'utf8');
    for (const p of errorPatterns) { if (p.test(content)) uncaughtCount++; }
  }
  if (uncaughtCount === 0) ok('No suspicious error patterns');
  else inf(`${uncaughtCount} potential issues (review recommended)`);

  const allOk = hf === 0 && tf === 0 && sizeKB <= budgetKB;
  console.log('\n' + (allOk
    ? clr('bold', clr('green', '  ✓ REGRESSION PASSED'))
    : clr('bold', clr('red', '  ✗ REGRESSION FAILED'))));
  return allOk ? 0 : 1;
}


// ─── COMMAND: perf ─────────────────────────────────────────────
function cmdPerf() {
  hdr('Performance Monitoring');
  const modules = findModules();
  let totalSize = 0;
  const sizes = [];
  for (const mod of modules) {
    const size = fs.statSync(mod).size;
    totalSize += size;
    sizes.push({ name: path.basename(mod), size });
  }
  sizes.sort((a, b) => b.size - a.size);

  console.log(clr('bold', '\n  Top 10 modules by size:'));
  for (const m of sizes.slice(0, 10)) {
    const bar = '█'.repeat(Math.max(1, Math.round(m.size / 2048)));
    console.log(`    ${m.name.padEnd(45)} ${(m.size / 1024).toFixed(1).padStart(6)} KB  ${clr('cyan', bar)}`);
  }

  const totalKB = totalSize / 1024;
  const budgetKB = 300;
  console.log(`\n  Total: ${totalKB.toFixed(1)} KB / ${budgetKB} KB budget`);
  if (totalKB <= budgetKB) ok('Within performance budget');
  else bad(`OVER budget by ${(totalKB - budgetKB).toFixed(1)} KB`);
  return totalKB <= budgetKB ? 0 : 1;
}

// ─── COMMAND: error-track ──────────────────────────────────────
function cmdErrorTrack() {
  hdr('Error Tracking Report');
  const modules = findModules();
  const issues = [];
  const patterns = [
    { re: /catch\s*\(\w+\)\s*\{\s*\}/, name: 'Empty catch block' },
    { re: /throw\s+new\s+Error\([^)]*\)\s*;\s*\/\/\s*TODO/i, name: 'TODO error throw' },
    { re: /console\.error\([^)]*\)\s*;\s*(?!\/\/)/m, name: 'Bare console.error' },
    { re: /Promise\.reject\([^)]*\)/, name: 'Unhandled Promise.reject' },
  ];

  for (const mod of modules) {
    const lines = fs.readFileSync(mod, 'utf8').split('\n');
    for (let i = 0; i < lines.length; i++) {
      for (const p of patterns) {
        if (p.re.test(lines[i])) {
          issues.push({ file: path.basename(mod), line: i + 1, type: p.name, text: lines[i].trim().substring(0, 80) });
        }
      }
    }
  }

  if (issues.length === 0) ok('No error handling issues detected');
  else {
    inf(`${issues.length} potential issues found:`);
    for (const issue of issues.slice(0, 20)) {
      console.log(`    ${issue.file}:${issue.line}  ${clr('yellow', issue.type)}`);
      console.log(`      ${issue.text}`);
    }
    if (issues.length > 20) inf(`... and ${issues.length - 20} more`);
  }

  let tryCount = 0, catchCount = 0;
  for (const mod of modules) {
    const content = fs.readFileSync(mod, 'utf8');
    tryCount += (content.match(/\btry\b/g) || []).length;
    catchCount += (content.match(/\bcatch\b/g) || []).length;
  }
  console.log(`\n  Try/catch balance: ${tryCount} try, ${catchCount} catch`);
  if (tryCount === catchCount) ok('All try blocks have matching catch');
  else bad(`Mismatched: ${tryCount} try vs ${catchCount} catch`);

  return issues.length === 0 && tryCount === catchCount ? 0 : 1;
}

// ─── MAIN ──────────────────────────────────────────────────────
const command = process.argv[2];

if (!command || command === 'help' || command === '--help' || command === '-h') {
  console.log(`
${clr('bold', 'suite-cli.cjs')} — Unified AI Assistant Suite CLI

${clr('bold', 'Commands:')}
  test        Run all test suites
  health      Module health check (node --check on all module files)
  report      Comprehensive status report (modules, tests, coverage)
  validate    Alias for health + test
  regression  Full regression: tests + health + perf + error scan
  perf        Performance monitoring (bundle size, thresholds)
  error-track Error tracking report (scan for uncaught patterns)
  help        Show this help

${clr('bold', 'Examples:')}
  node tools/suite-cli.cjs test
  node tools/suite-cli.cjs regression
  node tools/suite-cli.cjs report
  node tools/suite-cli.cjs perf
`);
  process.exit(0);
}

const commands = {
  test: cmdTest,
  health: cmdHealth,
  report: cmdReport,
  validate: cmdValidate,
  regression: cmdRegression,
  perf: cmdPerf,
  'error-track': cmdErrorTrack,
};

const fn = commands[command];
if (!fn) {
  bad(`Unknown command: ${command}`);
  console.log('Run with --help for usage.');
  process.exit(1);
}

try {
  process.exit(fn() || 0);
} catch (err) {
  bad(`Command failed: ${err.message}`);
  process.exit(1);
}
