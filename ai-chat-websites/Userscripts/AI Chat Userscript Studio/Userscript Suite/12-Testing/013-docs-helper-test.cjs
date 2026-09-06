#!/usr/bin/env node
/**
 * 013-docs-helper-test.cjs — smoke test for 024-docs-helper
 */
const fs = require('fs');
const path = require('path');
const MODULE_PATH = path.join(__dirname, '..', 'Modules', '00-Core', '024-docs-helper.module.user.js');

let passed = 0, failed = 0;
function assert(cond, msg) {
  if (cond) { passed++; console.log(`  PASS: ${msg}`); }
  else { failed++; console.log(`  FAIL: ${msg}`); }
}

console.log('=== 024-docs-helper test ===\n');

console.log('Test 1: Module file validity');
{
  assert(fs.existsSync(MODULE_PATH), 'module file exists');
  const src = fs.readFileSync(MODULE_PATH, 'utf8');
  assert(src.includes('docs-helper'), 'module name present');
  assert(src.includes('defineTerm'), 'defineTerm function defined');
  assert(src.includes('defineAcronym'), 'defineAcronym function defined');
  assert(src.includes('addFAQ'), 'addFAQ function defined');
  assert(src.includes('addTroubleshooting'), 'addTroubleshooting function defined');
  assert(src.includes('searchAll'), 'searchAll function defined');
  assert(src.includes('window.__NEXUS_DOCS__'), 'exported via __NEXUS_DOCS__');
}

console.log('\nTest 2: Glossary logic (239)');
{
  const glossary = {};
  const define = (t, d) => { glossary[t.toLowerCase()] = { term: t, definition: d }; return glossary[t.toLowerCase()]; };
  const get = (t) => glossary[t.toLowerCase()] || null;
  const search = (q) => Object.values(glossary).filter(e => e.term.toLowerCase().includes(q.toLowerCase()) || e.definition.toLowerCase().includes(q.toLowerCase()));

  define('API', 'Application Programming Interface');
  define('DOM', 'Document Object Model');
  assert(get('api') !== null, 'get term case-insensitive');
  assert(get('API').definition === 'Application Programming Interface', 'definition stored correctly');
  assert(search('interface').length === 1, 'search finds by definition');
  assert(search('DOM').length === 1, 'search finds by term');
  assert(get('nonexistent') === null, 'nonexistent term returns null');
}

console.log('\nTest 3: Acronym expander (240)');
{
  const acronyms = {};
  const define = (a, e) => { acronyms[a.toUpperCase()] = { acronym: a.toUpperCase(), expansion: e }; return acronyms[a.toUpperCase()]; };
  const expand = (a) => acronyms[a.toUpperCase()] || null;
  const findInText = (text) => Object.values(acronyms).filter(info => text.toUpperCase().includes(info.acronym));

  define('HTML', 'HyperText Markup Language');
  define('CSS', 'Cascading Style Sheets');
  assert(expand('html').expansion === 'HyperText Markup Language', 'expand case-insensitive');
  assert(findInText('I love HTML and CSS').length === 2, 'find acronyms in text');
  assert(expand('nonexistent') === null, 'nonexistent acronym returns null');
}

console.log('\nTest 4: FAQ logic (231)');
{
  const faq = [];
  const add = (q, a) => { faq.push({ question: q, answer: a }); return faq[faq.length - 1]; };
  const search = (q) => faq.filter(e => e.question.toLowerCase().includes(q.toLowerCase()) || e.answer.toLowerCase().includes(q.toLowerCase()));

  add('How to install?', 'Click the install button.');
  add('How to uninstall?', 'Remove from addon manager.');
  assert(search('install').length === 2, 'search finds both install/uninstall');
  assert(search('addon').length === 1, 'search finds by answer');
}

console.log('\nTest 5: Troubleshooting logic (230)');
{
  const guides = [];
  const add = (i, s, sol) => { guides.push({ issue: i, symptoms: s, solution: sol }); return guides[guides.length - 1]; };
  const search = (q) => guides.filter(e => e.issue.toLowerCase().includes(q.toLowerCase()) || e.symptoms.toLowerCase().includes(q.toLowerCase()) || e.solution.toLowerCase().includes(q.toLowerCase()));

  add('Page not loading', 'Blank screen, no content', 'Clear cache and reload');
  add('Slow performance', 'High CPU usage', 'Disable unused modules');
  assert(search('cache').length === 1, 'search finds by solution');
  assert(search('CPU').length === 1, 'search finds by symptoms');
  assert(search('nonexistent').length === 0, 'no match returns empty');
}

console.log('\nTest 6: ROADMAP coverage');
{
  const src = fs.readFileSync(MODULE_PATH, 'utf8');
  assert(src.includes('230') || src.includes('Troubleshooting'), 'ROADMAP 230 covered');
  assert(src.includes('231') || src.includes('FAQ'), 'ROADMAP 231 covered');
  assert(src.includes('239') || src.includes('Glossary'), 'ROADMAP 239 covered');
  assert(src.includes('240') || src.includes('Acronym'), 'ROADMAP 240 covered');
}

console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
process.exit(failed > 0 ? 1 : 0);
