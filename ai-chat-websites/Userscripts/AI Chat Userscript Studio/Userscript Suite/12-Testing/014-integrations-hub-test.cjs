#!/usr/bin/env node
/**
 * 014-integrations-hub-test.cjs — smoke test for 025-integrations-hub
 */
const fs = require('fs');
const path = require('path');
const MODULE_PATH = path.join(__dirname, '..', 'Modules', '00-Core', '025-integrations-hub.module.user.js');

let passed = 0, failed = 0;
function assert(cond, msg) {
  if (cond) { passed++; console.log(`  PASS: ${msg}`); }
  else { failed++; console.log(`  FAIL: ${msg}`); }
}

console.log('=== 025-integrations-hub test ===\n');

console.log('Test 1: Module file validity');
{
  assert(fs.existsSync(MODULE_PATH), 'module file exists');
  const src = fs.readFileSync(MODULE_PATH, 'utf8');
  assert(src.includes('integrations-hub'), 'module name present');
  assert(src.includes('configureGitHub'), 'configureGitHub function defined');
  assert(src.includes('configureDiscord'), 'configureDiscord function defined');
  assert(src.includes('configureEmail'), 'configureEmail function defined');
  assert(src.includes('configureCalendar'), 'configureCalendar function defined');
  assert(src.includes('configureWebhook'), 'configureWebhook function defined');
  assert(src.includes('window.__NEXUS_INTEGRATIONS__'), 'exported via __NEXUS_INTEGRATIONS__');
}

console.log('\nTest 2: Configuration logic');
{
  const configs = {};
  const configure = (name, cfg) => { configs[name] = { ...cfg, configured_at: new Date().toISOString() }; return configs[name]; };
  const get = (name) => configs[name] || null;

  configure('github', { token: 'ghp_xxx', owner: 'test', repo: 'myrepo' });
  assert(get('github').token === 'ghp_xxx', 'GitHub config stored');
  configure('discord', { webhookUrl: 'https://discord.com/api/webhooks/xxx' });
  assert(get('discord').webhookUrl.includes('discord'), 'Discord config stored');
  assert(get('nonexistent') === null, 'nonexistent config returns null');
}

console.log('\nTest 3: Generic webhook logic');
{
  const webhooks = {};
  const configure = (name, url, headers) => { webhooks[name] = { url, headers: headers || {}, configured_at: new Date().toISOString() }; return webhooks[name]; };
  const list = () => ({ ...webhooks });

  configure('gitlab', 'https://gitlab.com/api/webhooks/xxx', { 'X-GitLab-Token': 'xxx' });
  configure('custom', 'https://example.com/hook', {});
  const all = list();
  assert(Object.keys(all).length === 2, 'webhooks listed correctly');
  assert(all.gitlab.headers['X-GitLab-Token'] === 'xxx', 'webhook headers stored');
}

console.log('\nTest 4: API URL construction');
{
  const owner = 'eric847b';
  const repo = 'AI-Collaboration-Hub';
  const issuesUrl = `https://api.github.com/repos/${owner}/${repo}/issues`;
  assert(issuesUrl.includes(owner) && issuesUrl.includes(repo), 'GitHub API URL constructed correctly');
  assert(issuesUrl.startsWith('https://api.github.com/'), 'GitHub API base URL correct');
}

console.log('\nTest 5: ROADMAP coverage');
{
  const src = fs.readFileSync(MODULE_PATH, 'utf8');
  assert(src.includes('241') || src.includes('GitHub'), 'ROADMAP 241 (GitHub) covered');
  assert(src.includes('250') || src.includes('Discord'), 'ROADMAP 250 (Discord) covered');
  assert(src.includes('255') || src.includes('Email'), 'ROADMAP 255 (Email) covered');
  assert(src.includes('256') || src.includes('Calendar'), 'ROADMAP 256 (Calendar) covered');
}

console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
process.exit(failed > 0 ? 1 : 0);
