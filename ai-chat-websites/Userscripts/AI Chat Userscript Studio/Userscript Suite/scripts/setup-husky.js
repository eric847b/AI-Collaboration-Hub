import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url);
const { runSetupHusky } = require('./setup-husky.cjs');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const codePackRoot = path.resolve(__dirname, '..');
const huskyDir = path.join(codePackRoot, '.husky');

const exitCode = runSetupHusky({
  codePackRoot,
  fs,
  huskyDir,
  logger: console,
  path,
  process,
  spawnSync
});

process.exit(exitCode);
