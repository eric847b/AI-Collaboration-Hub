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
      else if (entry.isFile() && (entry.name === '007-user-interface.module.user.js')) matches.push(fullPath);
    }
  };
  walk(modulesDir);
  return matches[0] || path.join(modulesDir, '03-user-interface.module.user.js');
})();

describe('user interface security regressions', () => {
  test('builds the settings panel without innerHTML', () => {
    const source = fs.readFileSync(modulePath, 'utf8');

    expect(source).not.toMatch(/panel\.innerHTML\s*=/);
    expect(source).toMatch(/createSettingsPanel\(\)/);
    expect(source).toMatch(/document\.createTextNode\(' Enable Keyboard Shortcuts'\)/);
    expect(source).toMatch(/themeSelect\.appendChild\(lightOption\)/);
    expect(source).toMatch(/window\.ChatGPTModules\.register\("UserInterface", "2026\.04\.05\.1", module\)/);
  });
});
