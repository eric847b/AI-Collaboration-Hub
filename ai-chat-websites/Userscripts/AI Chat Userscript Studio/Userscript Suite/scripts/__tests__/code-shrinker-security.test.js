const fs = require('fs');
const path = require('path');

const modulePath = (function() {
  const modulesDir = path.join(__dirname, '../../Modules');
  const matches = [];
  const walk = (dir) => {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(fullPath);
      else if (entry.isFile() && (entry.name === '003-code-shrinker.module.user.js')) matches.push(fullPath);
    }
  };
  walk(modulesDir);
  return matches[0] || path.join(modulesDir, '08-code-shrinker.module.user.js');
})();

describe('code shrinker security regressions', () => {
  test('builds the shrinker panel without innerHTML writes', () => {
    const source = fs.readFileSync(modulePath, 'utf8');

    expect(source).not.toMatch(/panel\.innerHTML\s*=/);
    expect(source).toMatch(/const createCheckboxLabel = \(id, text\) =>/);
    expect(source).toMatch(/const createButton = \(id, text, className = ''\) =>/);
    expect(source).toMatch(/const advanced = document\.createElement\('details'\);/);
    expect(source).toMatch(/panel\.appendChild\(header\);/);
    expect(source).toMatch(/version: '2026\.04\.05\.1',/);
  });
});
