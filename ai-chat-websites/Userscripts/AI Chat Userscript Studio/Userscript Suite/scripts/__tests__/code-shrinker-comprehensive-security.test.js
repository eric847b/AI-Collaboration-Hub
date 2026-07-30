const fs = require('fs');
const path = require('path');

function countMatches(source, pattern) {
  return (source.match(pattern) || []).length;
}

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

describe('code shrinker comprehensive security', () => {
  const source = fs.readFileSync(modulePath, 'utf8');

  test('validates GM_addStyle usage', () => {
    expect(source).toMatch(/GM_addStyle\(/);
    expect(source).not.toMatch(/GM_addStyle\(.*innerHTML/);
    expect(source).not.toMatch(/GM_addStyle\(.*script/);
  });

  test('validates GM_openInTab usage', () => {
    expect(source).toMatch(/GM_openInTab\(url/);
    expect(source).toMatch(/url = 'data:text\/plain/);
    expect(source).not.toMatch(/GM_openInTab\(.*javascript:/);
    expect(source).not.toMatch(/GM_openInTab\(.*http/);
  });

  test('validates GM_setClipboard usage', () => {
    expect(source).toMatch(/GM_setClipboard\(text\)/);
    expect(source).not.toMatch(/GM_setClipboard\(.*innerHTML/);
    expect(source).not.toMatch(/GM_setClipboard\(.*script/);
  });

  test('validates GM_notification usage', () => {
    expect(source).toMatch(/GM_notification\(/);
    expect(source).not.toMatch(/GM_notification\(.*innerHTML/);
    expect(source).not.toMatch(/GM_notification\(.*script/);
  });

  test('validates GM_registerMenuCommand usage', () => {
    expect(source).toMatch(/GM_registerMenuCommand\(/);
    expect(source).not.toMatch(/GM_registerMenuCommand\(.*innerHTML/);
    expect(source).not.toMatch(/GM_registerMenuCommand\(.*script/);
  });

  test('validates input sanitization', () => {
    expect(source).toMatch(/const code = inputEl\.value \|\| '';/);
    expect(source).toMatch(/if \(!code\.trim\(\)\)/);
    expect(source).not.toMatch(/innerHTML\s*=/);
    expect(source).not.toMatch(/\beval\(/);
  });

  test('uses safe text sinks for dynamic content', () => {
    expect(source).not.toMatch(/innerHTML\s*=/);
    expect(source).toMatch(/button\.textContent = text;/);
    expect(source).toMatch(/option\.textContent = text;/);
  });

  test('validates DOM creation security', () => {
    expect(countMatches(source, /document\.createElement\(/g)).toBeGreaterThanOrEqual(10);
    expect(source).not.toMatch(/createElement\(.*innerHTML/);
    expect(source).not.toMatch(/createElement\(.*script/);
  });

  test('validates data handling', () => {
    expect(source).toMatch(/encodeURIComponent\(text\)/);
    expect(source).toMatch(/const url = 'data:text\/plain/);
    expect(source).not.toMatch(/unescape\(/);
    expect(source).not.toMatch(/decodeURIComponent\(/);
  });
});