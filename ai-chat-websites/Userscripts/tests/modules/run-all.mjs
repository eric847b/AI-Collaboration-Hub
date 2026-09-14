/**
 * Runs every tests/modules/*.spec.mjs in one pass. Exit code 1 on any failure.
 * Usage: node Userscripts/tests/modules/run-all.mjs
 */
import { readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const specs = readdirSync(HERE).filter((f) => f.endsWith('.spec.mjs')).sort();
let failed = 0;
for (const spec of specs) {
  const r = spawnSync(process.execPath, [join(HERE, spec)], { encoding: 'utf8' });
  if (r.status === 0) {
    console.log('  ok ' + spec);
  } else {
    failed += 1;
    const out = (r.stderr || r.stdout || '').toString().trim().split('\n').slice(-4).join(' | ');
    console.error('  FAIL ' + spec + ' — ' + out);
  }
}
console.log(`modules: ${specs.length - failed}/${specs.length} spec files passed`);
process.exit(failed > 0 ? 1 : 0);
