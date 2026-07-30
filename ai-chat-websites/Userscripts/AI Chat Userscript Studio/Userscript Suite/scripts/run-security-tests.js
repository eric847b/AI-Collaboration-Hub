const fs = require('fs');
const path = require('path');

function resolveModulePath(candidates) {
  const modulesDir = path.join(__dirname, '../Modules');
  const filenames = fs.readdirSync(modulesDir);

  for (const candidate of candidates) {
    if (filenames.includes(candidate)) {
      return path.join(modulesDir, candidate);
    }
  }

  throw new Error(`Could not resolve module path from candidates: ${candidates.join(', ')}`);
}

const modulePath = resolveModulePath([
  '36-analytics-dashboard.module.user.js',
  '14-ai-analytics-dashboard.module.user.js',
  '21-analytics-dashboard.module.user.js'
]);
const source = fs.readFileSync(modulePath, 'utf8');

console.log('Running security tests for AI Analytics Dashboard module...');
console.log('========================================');

console.log('Test 1: innerHTML usage');
if (source.includes('container.innerHTML')) {
  console.log('[FAIL] innerHTML usage found');
} else {
  console.log('[OK] No innerHTML usage found');
}

console.log('\nTest 2: Preserved elements and IDs');
const requiredElements = [
  'analytics-dashboard-container',
  'analytics-dashboard-header',
  'analytics-dashboard-title',
  'analytics-dashboard-toggle',
  'analytics-tabs',
  'analytics-tab',
  'analytics-content',
  "createContentSection('overview'",
  "createContentSection('conversations'",
  "createContentSection('performance'",
  "createContentSection('usage'",
  'content.id =',
  'analytics-chart',
  'chart-placeholder',
  'analytics-metrics',
  'metric-group',
  'metric-item',
  'metric-label',
  'metric-value',
  'analytics-actions',
  'analytics-btn',
  'export-btn',
  'clear-btn',
  'total-conversations',
  'avg-response-time',
  'avg-tokens',
  'success-rate',
  'active-users',
  'data-usage',
  'conversations-today',
  'avg-messages-conv',
  'longest-conv',
  'active-convs',
  'avg-duration',
  'peak-hour',
  'avg-latency',
  'error-rate',
  'throughput',
  'peak-load',
  'system-health',
  'uptime',
  'data-used-today',
  'api-calls',
  'cost-estimate',
  'storage-used',
  'cache-hit-rate',
  'optimization-rate',
  'export-data-btn',
  'clear-data-btn',
  'toggle-monitoring-btn'
];

let allElementsFound = true;
requiredElements.forEach((element) => {
  if (source.includes(element)) {
    console.log(`[OK] ${element} found`);
  } else {
    console.log(`[FAIL] ${element} not found`);
    allElementsFound = false;
  }
});

console.log('\nTest 3: Event listeners');
const eventListeners = [
  "container.querySelectorAll('.analytics-tab').forEach",
  "tab.addEventListener('click'",
  "container.querySelector('#export-data-btn').addEventListener",
  "container.querySelector('#clear-data-btn').addEventListener",
  "container.querySelector('#toggle-monitoring-btn').addEventListener"
];

let allListenersFound = true;
eventListeners.forEach((listener) => {
  if (source.includes(listener)) {
    console.log(`[OK] ${listener} found`);
  } else {
    console.log(`[FAIL] ${listener} not found`);
    allListenersFound = false;
  }
});

console.log('\nTest 4: CSS styles');
if (source.includes('style.textContent')) {
  console.log('[OK] CSS styles found');
} else {
  console.log('[FAIL] CSS styles not found');
}

console.log('\nTest 5: Functionality');
const functions = [
  'this.switchTab(targetTab)',
  'this.exportData()',
  'this.clearData()',
  'this.config.autoRefresh',
  'this.startAnalyticsMonitoring()',
  'this.stopAnalyticsMonitoring()'
];

let allFunctionsFound = true;
functions.forEach((fn) => {
  if (source.includes(fn)) {
    console.log(`[OK] ${fn} found`);
  } else {
    console.log(`[FAIL] ${fn} not found`);
    allFunctionsFound = false;
  }
});

console.log('\n========================================');
console.log('Security test completed!');
console.log(`Elements found: ${allElementsFound ? '[OK]' : '[FAIL]'}`);
console.log(`Event listeners found: ${allListenersFound ? '[OK]' : '[FAIL]'}`);
console.log(`Functions found: ${allFunctionsFound ? '[OK]' : '[FAIL]'}`);