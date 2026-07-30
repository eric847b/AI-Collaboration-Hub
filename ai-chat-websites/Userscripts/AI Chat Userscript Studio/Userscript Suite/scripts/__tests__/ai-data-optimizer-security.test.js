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
  '011-data-optimizer.module.user.js',
  '13-data-optimizer.module.user.js',
  '13-ai-data-optimizer.module.user.js'
]);

describe('AI data optimizer security regressions', () => {
  test('builds the optimizer panel without innerHTML or inline click handlers', () => {
    const source = fs.readFileSync(modulePath, 'utf8');

    expect(source).not.toMatch(/\.\s*innerHTML\s*=/);
    expect(source).not.toMatch(/\bonclick\s*=/);
    expect(source).toMatch(/container\.className = 'data-optimizer-container';/);
    expect(source).toMatch(/closeButton\.addEventListener\('click'/);
    expect(source).toMatch(/clearCacheButton\.addEventListener\('click'/);
    expect(source).toMatch(/toggleOptimizationButton\.addEventListener\('click'/);
  });
});