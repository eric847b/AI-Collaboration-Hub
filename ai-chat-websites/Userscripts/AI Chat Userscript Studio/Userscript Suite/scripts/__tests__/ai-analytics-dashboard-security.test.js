const fs = require('fs');
const path = require('path');

function resolveModulePath(candidates) {
  const modulesDir = path.join(__dirname, '../../Modules');
  const matches = [];

  const walk = (dir) => {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.isFile() && candidates.includes(entry.name)) {
        matches.push(fullPath);
      }
    }
  };

  walk(modulesDir);

  if (matches.length > 0) {
    return matches[0];
  }

  throw new Error(`Could not resolve module path from candidates: ${candidates.join(", ")}`);
}

const modulePath = resolveModulePath([
  '001-analytics-dashboard.module.user.js',
  '36-analytics-dashboard.module.user.js',
  '14-ai-analytics-dashboard.module.user.js',
  '21-analytics-dashboard.module.user.js'
]);

describe('ai analytics dashboard security', () => {
  const source = fs.readFileSync(modulePath, 'utf8');

  test('builds the dashboard without innerHTML writes', () => {
    expect(source).not.toMatch(/container\.innerHTML\s*=/);
    expect(source).toMatch(/const container = document\.createElement\('div'\);/);
    expect(source).toMatch(/container\.id = CONTAINER_ID;/);
    expect(source).toMatch(/document\.body\.appendChild\(container\);/);
  });

  test('preserves all dashboard elements and IDs', () => {
    expect(source).toMatch(/analytics-dashboard-container/);
    expect(source).toMatch(/analytics-dashboard-header/);
    expect(source).toMatch(/analytics-dashboard-title/);
    expect(source).toMatch(/analytics-dashboard-toggle/);
    expect(source).toMatch(/analytics-tabs/);
    expect(source).toMatch(/analytics-tab/);
    expect(source).toMatch(/analytics-content/);
    expect(source).toMatch(/createContentSection\('overview'/);
    expect(source).toMatch(/createContentSection\('conversations'/);
    expect(source).toMatch(/createContentSection\('performance'/);
    expect(source).toMatch(/createContentSection\('usage'/);
    expect(source).toMatch(/content\.id = `\$\{id\}-content`;/);
    expect(source).toMatch(/analytics-chart/);
    expect(source).toMatch(/chart-placeholder/);
    expect(source).toMatch(/analytics-metrics/);
    expect(source).toMatch(/metric-group/);
    expect(source).toMatch(/metric-item/);
    expect(source).toMatch(/metric-label/);
    expect(source).toMatch(/metric-value/);
    expect(source).toMatch(/analytics-actions/);
    expect(source).toMatch(/analytics-btn/);
    expect(source).toMatch(/export-btn/);
    expect(source).toMatch(/clear-btn/);
    expect(source).toMatch(/total-conversations/);
    expect(source).toMatch(/avg-response-time/);
    expect(source).toMatch(/avg-tokens/);
    expect(source).toMatch(/success-rate/);
    expect(source).toMatch(/active-users/);
    expect(source).toMatch(/data-usage/);
    expect(source).toMatch(/conversations-today/);
    expect(source).toMatch(/avg-messages-conv/);
    expect(source).toMatch(/longest-conv/);
    expect(source).toMatch(/active-convs/);
    expect(source).toMatch(/avg-duration/);
    expect(source).toMatch(/peak-hour/);
    expect(source).toMatch(/avg-latency/);
    expect(source).toMatch(/error-rate/);
    expect(source).toMatch(/throughput/);
    expect(source).toMatch(/peak-load/);
    expect(source).toMatch(/system-health/);
    expect(source).toMatch(/uptime/);
    expect(source).toMatch(/data-used-today/);
    expect(source).toMatch(/api-calls/);
    expect(source).toMatch(/cost-estimate/);
    expect(source).toMatch(/storage-used/);
    expect(source).toMatch(/cache-hit-rate/);
    expect(source).toMatch(/optimization-rate/);
    expect(source).toMatch(/export-data-btn/);
    expect(source).toMatch(/clear-data-btn/);
    expect(source).toMatch(/toggle-monitoring-btn/);
  });

  test('preserves all event listeners and functionality', () => {
    expect(source).toMatch(/container\.querySelectorAll\('\.analytics-tab'\)\.forEach/);
    expect(source).toMatch(/tab\.addEventListener\('click'/);
    expect(source).toMatch(/container\.querySelector\('#export-data-btn'\)\.addEventListener/);
    expect(source).toMatch(/container\.querySelector\('#clear-data-btn'\)\.addEventListener/);
    expect(source).toMatch(/container\.querySelector\('#toggle-monitoring-btn'\)\.addEventListener/);
  });

  test('preserves all CSS styles', () => {
    expect(source).toMatch(/style\.textContent\s*=/);
    expect(source).toMatch(/\.analytics-dashboard-container/);
    expect(source).toMatch(/\.analytics-dashboard-header/);
    expect(source).toMatch(/\.analytics-dashboard-title/);
    expect(source).toMatch(/\.analytics-dashboard-toggle/);
    expect(source).toMatch(/\.analytics-tabs/);
    expect(source).toMatch(/\.analytics-tab/);
    expect(source).toMatch(/\.analytics-content/);
    expect(source).toMatch(/\.analytics-chart/);
    expect(source).toMatch(/\.chart-placeholder/);
    expect(source).toMatch(/\.analytics-metrics/);
    expect(source).toMatch(/\.metric-group/);
    expect(source).toMatch(/\.metric-item/);
    expect(source).toMatch(/\.metric-label/);
    expect(source).toMatch(/\.metric-value/);
    expect(source).toMatch(/\.analytics-actions/);
    expect(source).toMatch(/\.analytics-btn/);
    expect(source).toMatch(/\.export-btn/);
    expect(source).toMatch(/\.clear-btn/);
  });

  test('preserves all functionality', () => {
    expect(source).toMatch(/this\.switchTab\(targetTab\);/);
    expect(source).toMatch(/this\.exportData\(\);/);
    expect(source).toMatch(/this\.clearData\(\);/);
    expect(source).toMatch(/this\.config\.autoRefresh/);
    expect(source).toMatch(/this\.startAnalyticsMonitoring\(\);/);
    expect(source).toMatch(/this\.stopAnalyticsMonitoring\(\);/);
  });
});