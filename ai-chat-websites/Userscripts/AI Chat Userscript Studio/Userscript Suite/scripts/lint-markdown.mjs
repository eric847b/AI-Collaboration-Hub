import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { lint, readConfig } from 'markdownlint/sync';

const require = createRequire(import.meta.url);
const { runMarkdownLint } = require('./lint-markdown.cjs');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const configPath = path.join(rootDir, '.markdownlint.json');

const result = runMarkdownLint({
  configPath,
  fs,
  lint,
  logger: console,
  path,
  readConfig,
  rootDir
});

process.exit(result.exitCode);
