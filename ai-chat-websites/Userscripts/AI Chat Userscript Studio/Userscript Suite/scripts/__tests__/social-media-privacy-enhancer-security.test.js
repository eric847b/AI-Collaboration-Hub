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
      else if (entry.isFile() && (entry.name === '015-social-media-privacy-enhancer.module.user.js')) matches.push(fullPath);
    }
  };
  walk(modulesDir);
  return matches[0] || path.join(modulesDir, '09-social-media-privacy-enhancer.module.user.js');
})();

describe('social media privacy enhancer security regressions', () => {
  test('builds the privacy panel without innerHTML writes', () => {
    const source = fs.readFileSync(modulePath, 'utf8');

    expect(source).not.toMatch(/panel\.innerHTML\s*=/);
    expect(source).not.toMatch(/row\.innerHTML\s*=/);
    expect(source).toMatch(/const createPanelButton = \(text, action, className = ''\) =>/);
    expect(source).toMatch(/const createPanelFieldRow = \(field\) =>/);
    expect(source).toMatch(/input\.dataset\.key = field\.key;/);
    expect(source).toMatch(/panel\.appendChild\(header\);/);
  });
});
