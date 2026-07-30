const { parseUserScriptHeader, buildMergedHeader } = require('../bundler-utils');

test('parseUserScriptHeader extracts @meta from // ==UserScript== header', () => {
  const content = `// ==UserScript==\n// @name Test\n// @version 1.0\n// @grant GM_setValue\n// ==/UserScript==\nconsole.log('hi');`;
  const parsed = parseUserScriptHeader(content);
  expect(parsed.meta).toEqual(expect.arrayContaining(['name Test','version 1.0','grant GM_setValue']));
});

test('buildMergedHeader deduplicates and orders keys', () => {
  const meta = ['grant GM_setValue', 'match https://chat.openai.com/*', 'grant GM_getValue', 'name Example'];
  const header = buildMergedHeader(meta);
  // header should include @name and both grants and match
  expect(header).toMatch(/@name Example/);
  expect((header.match(/@grant/g) || []).length).toBe(2);
  expect(header).toMatch(/@match https:\/\/chat.openai.com\/*/);
});
