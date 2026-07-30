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
      else if (entry.isFile() && (entry.name === '004-code-assistant.module.user.js')) matches.push(fullPath);
    }
  };
  walk(modulesDir);
  return matches[0] || path.join(modulesDir, '19-code-assistant.module.user.js');
})();

describe('AI code assistant security regressions', () => {
  const source = fs.readFileSync(modulePath, 'utf8');

  test('builds the code assistant UI without innerHTML or inline click handlers', () => {
    expect(source).not.toMatch(/\.\s*innerHTML\s*=/);
    expect(source).not.toMatch(/\bonclick\s*=/);
    expect(source).toMatch(/container\.className = 'code-assistant-container';/);
    expect(source).toMatch(/suggestionsList\.replaceChildren\(\);/);
    expect(source).toMatch(/title\.textContent = suggestion\.title;/);
    expect(source).toMatch(/description\.textContent = suggestion\.description;/);
  });

  test('exposes and implements the runtime methods used by the UI', () => {
    expect(source).toMatch(/deleteSuggestion: \(id\) => this\.deleteSuggestion\(id\),/);
    expect(source).toMatch(/toggleCodeUI: \(\) => this\.toggleCodeUI\(\)/);
    expect(source).toMatch(/deleteSuggestion\(id\) \{/);
    expect(source).toMatch(/getHistory\(\) \{/);
    expect(source).toMatch(/checkForCodeIssues\(\) \{/);
    expect(source).toMatch(/stopCodeMonitoring\(\) \{/);
    expect(source).toMatch(/window\.getComputedStyle\(container\)\.display === 'none'/);
  });
});