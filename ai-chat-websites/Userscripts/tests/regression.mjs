/**
 * Weekly regression runner (Ongoing — Testing & Quality).
 * Runs syntax checks + the v3 self-test in one pass so CI can gate on it.
 * Usage: node tests/regression.mjs
 */

import { execSync } from 'child_process';
import { existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// tests/ dir -> Userscripts -> ai-chat-websites (where `Userscripts/...` commands resolve)
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

const STEPS = [
  ['v3 self-test', 'node Userscripts/v3/index.js --selftest'],
  ['popup.js syntax', 'node --check Userscripts/extension/popup.js'],
  ['background.js syntax', 'node --check Userscripts/extension/background.js'],
  ['content-script.js syntax', 'node --check Userscripts/extension/content-script.js'],
  ['collab.js syntax', 'node --check Userscripts/extension/collab.js'],
  ['service-worker.js syntax', 'node --check Userscripts/extension/service-worker.js'],
  ['marketplace.js syntax', 'node --check Userscripts/plugins/marketplace/marketplace.js'],
  ['api-server syntax', 'node --check Userscripts/v3/api-server.js'],
  ['catalog.json valid', 'node -e "JSON.parse(require(\'fs\').readFileSync(\'Userscripts/plugins/marketplace/catalog.json\'))"']
];

let failed = 0;
for (const [name, cmd] of STEPS) {
  try {
    execSync(cmd, { cwd: ROOT, stdio: 'pipe', encoding: 'utf8' });
    console.log('  ok ' + name);
  } catch (e) {
    failed += 1;
    const detail = (e.stderr || e.message || '').toString().split('\n').slice(0, 3).join(' | ');
    console.error('  FAIL ' + name + ' — ' + detail);
  }
}

if (failed > 0) {
  console.error('\nREGRESSION FAILED (' + failed + '/' + STEPS.length + ')');
  process.exit(1);
}
console.log('\nREGRESSION PASS (' + STEPS.length + ' steps)');