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
  '007-conversation-enhancer.module.user.js',
  '28-conversation-enhancer.module.user.js',
  '28-ai-conversation-enhancer.module.user.js'
]);

describe('AI conversation enhancer security regressions', () => {
  test('renders suggestion UI without innerHTML writes', () => {
    const source = fs.readFileSync(modulePath, 'utf8');

    expect(source).not.toMatch(/\.\s*innerHTML\s*=/);
    expect(source).not.toMatch(/\bonclick\s*=/);
    expect(source).toMatch(/list\.replaceChildren\(\)/);
    expect(source).toMatch(/item\.addEventListener\('click'/);
    expect(source).toMatch(/textSpan\.textContent = suggestion;/);
    expect(source).toMatch(/document\.getElementById\('ai-enhancer-suggestions'\)/);
  });
});