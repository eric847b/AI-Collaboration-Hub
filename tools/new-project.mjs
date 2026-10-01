#!/usr/bin/env node
/**
 * new-project.mjs — scaffold a new workspace-standard Vite/React app.
 * Turns docs/WORKSPACE_TEMPLATES.md into an executable, non-interactive
 * generator (Round 12 D). Explicit flags only — no stdin prompts.
 *   node tools/new-project.mjs --name my-app [--out my-app] [--port 4173]
 *     [--app-id my-app] [--force] [--dry-run]
 *   node tools/new-project.mjs --self-test
 * Exit codes: 0 success · 1 usage/generation failure · 2 self-test failure.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const opt = (name, def) => {
  const i = argv.indexOf(name);
  return i >= 0 && i + 1 < argv.length ? argv[i + 1] : def;
};
const has = (name) => argv.includes(name);
const VALID_NAME = /^[a-z0-9][a-z0-9-]*$/;
const DEFAULT_PORT = 4173;

function fail(msg) {
  console.error(`new-project: ${msg}`);
  process.exit(1);
}

function canonicalTelemetry() {
  const candidates = [
    path.join(ROOT, 'nexus-infinity-hub', 'src', 'lib', 'telemetry.ts'),
    path.join(ROOT, 'self-evolve-dash', 'src', 'lib', 'telemetry.ts'),
  ];
  for (const c of candidates) {
    try {
      const text = fs.readFileSync(c, 'utf8');
      if (text.includes('installTelemetry')) return text;
    } catch { /* try next */ }
  }
  return null;
}

function printHelp() {
  console.log('new-project.mjs — scaffold a workspace-standard Vite/React app\nUsage:\n  node tools/new-project.mjs --name <kebab> [--out <dir>] [--port N] [--app-id <id>] [--force] [--dry-run]\n  node tools/new-project.mjs --self-test\nFlags: --name required ^[a-z0-9][a-z0-9-]*$; --out relative resolves under root (default: <name>); --port default 4173; --app-id default <name>');
}

function filePlan({ name, appId, port }) {
  const m = new Map();
  m.set('package.json', JSON.stringify({ name, version: '1.0.0', private: true, type: 'module', description: name + ' — workspace-standard Vite/React app', engines: { node: '>=26.0.0' }, scripts: { dev: 'vite', build: 'vite build', preview: 'vite preview', lint: 'eslint . --max-warnings=0', 'lint:fix': 'eslint . --fix || true', typecheck: 'tsc --noEmit', check: 'npm run lint && npm run typecheck && npm run build', ci: 'npm run check && npm run build', 'test:e2e': 'playwright test --grep-invert visual' }, dependencies: { react: '^19.3.0', 'react-dom': '^19.3.0', 'react-router-dom': '^7.18.4' }, devDependencies: { '@eslint/js': '^10.0.1', '@playwright/test': '^1.63.0', '@types/react': '^19.3.0', '@vitejs/plugin-react': '^6.1.1', eslint: '^10.10.0', 'eslint-plugin-react-hooks': '^7.1.1', globals: '^17.12.0', typescript: '~5.9.3', 'typescript-eslint': '^8.70.0', vite: '^8.3.0', vitest: '^5.0.0' } }, null, 2) + '\n');
  m.set('vite.config.ts', 'import { defineConfig } from "vite";\nimport react from "@vitejs/plugin-react";\nimport path from "path";\n\nexport default defineConfig({\n  server: { host: "::", port: 8080 },\n  plugins: [react()],\n  resolve: { alias: { "@": path.resolve(import.meta.dirname, "./src") } },\n});\n');
  m.set('tsconfig.json', JSON.stringify({ files: [], references: [{ path: './tsconfig.app.json' }, { path: './tsconfig.node.json' }] }, null, 2) + '\n');
  m.set('tsconfig.app.json', JSON.stringify({ compilerOptions: { target: 'ES2020', lib: ['ES2020', 'DOM', 'DOM.Iterable'], module: 'ESNext', skipLibCheck: true, moduleResolution: 'bundler', allowImportingTsExtensions: true, isolatedModules: true, moduleDetection: 'force', noEmit: true, jsx: 'react-jsx', strict: true, noUnusedLocals: true, noUnusedParameters: true, noImplicitAny: true, paths: { '@/*': ['./src/*'] } }, include: ['src'] }, null, 2) + '\n');
  m.set('tsconfig.node.json', JSON.stringify({ compilerOptions: { target: 'ES2022', lib: ['ES2023'], module: 'ESNext', skipLibCheck: true, moduleResolution: 'bundler', isolatedModules: true, noEmit: true, strict: true }, include: ['vite.config.ts'] }, null, 2) + '\n');
  return { m, appId, port, name };
}
function addPart2(plan) {
  const { m, appId, port, name } = plan;
  m.set('eslint.config.js', 'import js from "@eslint/js";\nimport globals from "globals";\nimport reactHooks from "eslint-plugin-react-hooks";\nimport reactRefresh from "eslint-plugin-react-refresh";\nimport tseslint from "typescript-eslint";\n\nexport default tseslint.config(\n  { ignores: ["dist"] },\n  {\n    extends: [js.configs.recommended, ...tseslint.configs.recommended],\n    files: ["**/*.{ts,tsx}"],\n    languageOptions: { ecmaVersion: 2020, globals: globals.browser },\n    plugins: { "react-hooks": reactHooks, "react-refresh": reactRefresh },\n    rules: { ...reactHooks.configs.recommended.rules, "react-refresh/only-export-components": ["warn", { allowConstantExport: true }] },\n  },\n);\n');
  m.set('.prettierrc', JSON.stringify({ singleQuote: true, trailingComma: 'all', printWidth: 110 }, null, 2) + '\n');
  return plan;
}
function addPart3(plan) {
  const { m, appId, name } = plan;
  m.set('index.html', '<!doctype html>\n<html lang="en">\n  <head>\n    <meta charset="UTF-8" />\n    <meta name="viewport" content="width=device-width, initial-scale=1.0" />\n    <title>' + name + '</title>\n  </head>\n  <body>\n    <div id="root"></div>\n    <script type="module" src="/src/main.tsx"></script>\n  </body>\n</html>\n');
  m.set('src/main.tsx', 'import { createRoot } from "react-dom/client";\nimport App from "./App.tsx";\nimport { installTelemetry } from "./lib/telemetry";\nimport "./index.css";\n\ntry {\n  installTelemetry({ appId: "' + appId + '", version: "1.0.0" });\n} catch {\n}\n\ncreateRoot(document.getElementById("root")!).render(<App />);\n');
  m.set('src/index.css', ':root { color-scheme: light dark; }\nbody { margin: 0; }\n#root { min-height: 100vh; }\n');
  m.set('src/vite-env.d.ts', '/// <reference types="vite/client" />\n');
  const tel = canonicalTelemetry();
  m.set('src/lib/telemetry.ts', tel ? tel : '// Fallback: copy nexus-infinity-hub/src/lib/telemetry.ts over this file.\nexport function installTelemetry(): () => void { return () => {}; }\n');
  return plan;
}

function addPart4(plan) {
  const { m, port, name } = plan;
  m.set('src/App.tsx', 'export default function App() {\n  return (\n    <main style={{ fontFamily: "system-ui, sans-serif", padding: 32 }}>\n      <h1>' + name + '</h1>\n      <p>Scaffolded with <code>node tools/new-project.mjs</code>.</p>\n    </main>\n  );\n}\n');
  m.set('vitest.config.ts', 'import { defineConfig } from "vitest/config";\nimport path from "path";\n\nexport default defineConfig({\n  test: {\n    environment: "happy-dom",\n    include: ["src/**/*.{test,spec}.{ts,tsx}"],\n    coverage: {\n      provider: "v8",\n      reporter: ["text", "json", "html"],\n      include: ["src/**/*.{ts,tsx}"],\n      exclude: ["src/**/*.{test,spec}.{ts,tsx}", "src/main.tsx", "src/vite-env.d.ts", "src/App.tsx"],\n    },\n  },\n  resolve: { alias: { "@": path.resolve(__dirname, "./src") } },\n});\n');
  m.set('playwright.config.js', "import { defineConfig } from '@playwright/test';\n\nexport default defineConfig({\n  testDir: './e2e',\n  timeout: 600000,\n  retries: process.env.CI ? 1 : 0,\n  reporter: 'list',\n  use: { baseURL: 'http://127.0.0.1:" + port + "', headless: true },\n  webServer: { command: 'npm run preview -- --port " + port + " --strictPort', url: 'http://127.0.0.1:" + port + "', reuseExistingServer: !process.env.CI, timeout: 600000 },\n});\n");
  m.set('e2e/app.spec.js', "import { expect, test } from '@playwright/test';\n\ntest('home page loads with a title', async ({ page }) => {\n  await page.goto('/');\n  await expect(page).toHaveTitle(/.+/);\n});\n\ntest('app root renders', async ({ page }) => {\n  await page.goto('/');\n  await expect(page.locator('#root')).toBeVisible();\n});\n");
  m.set('.gitignore', 'logs\n*.log\nnode_modules\ndist\n*.local\n.vscode/*\n!.vscode/extensions.json\n.idea\n.DS_Store\ncoverage\ntest-results/\n');
  m.set('README.md', '# ' + name + '\n\nWorkspace-standard Vite/React app — scaffolded with `node tools/new-project.mjs`.\n\n```powershell\nnpm install\nnpm run check\n```\n\nSee `docs/WORKSPACE_TEMPLATES.md` for the integration checklist.\n');
  return plan;
}
function runSelfTest() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'new-project-selftest-'));
  const target = path.join(tmp, 'demo-app');
  const plan = addPart4(addPart3(addPart2(filePlan({ name: 'demo-app', appId: 'demo-app', port: DEFAULT_PORT }))));
  const fails = [];
  for (const [rel, content] of plan.m) {
    const abs = path.join(target, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, content, 'utf8');
  }
  const must = ['package.json', 'vite.config.ts', 'tsconfig.app.json', 'eslint.config.js', 'index.html', 'src/main.tsx', 'src/App.tsx', 'src/lib/telemetry.ts', 'vitest.config.ts', 'playwright.config.js', 'e2e/app.spec.js', 'README.md'];
  for (const f of must) if (!fs.existsSync(path.join(target, f))) fails.push('missing ' + f);
  fs.rmSync(tmp, { recursive: true, force: true });
  if (fails.length > 0) { console.error('new-project --self-test FAIL: ' + fails.join(', ')); process.exit(2); }
  console.log('new-project --self-test PASS (' + must.length + ' files)');
}
/**
 * Explicit flag inventory (Round 12 D hardening). This tool is a generator, so
 * a silently-ignored typo is the worst kind of failure: `--dryrun` would have
 * scaffolded real files where the caller expected a dry run. Unknown flags and
 * stray positionals exit 1 (its documented usage-error code) before any write.
 */
const BOOL_FLAGS = new Set(['--force', '--dry-run', '--self-test']);
const VAL_FLAGS = new Set(['--name', '--out', '--port', '--app-id']);

function rejectBadFlags() {
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--help' || a === '-h') return;
    if (!a.startsWith('-')) fail(`unexpected argument "${a}" - this tool takes flags only (see --help)`);
    const eq = a.indexOf('=');
    const key = eq >= 0 ? a.slice(0, eq) : a;
    if (!BOOL_FLAGS.has(key) && !VAL_FLAGS.has(key)) fail(`unknown flag "${key}" - see --help`);
    if (BOOL_FLAGS.has(key) && eq >= 0) fail(`flag "${key}" takes no value - see --help`);
    if (VAL_FLAGS.has(key) && eq < 0) {
      if (i + 1 >= argv.length) fail(`flag "${key}" requires a value - see --help`);
      i += 1;
    }
  }
}

function runMain() {
  if (has('--help') || argv.includes('-h')) { printHelp(); return; }
  rejectBadFlags();
  if (has('--self-test')) { runSelfTest(); return; }
  const pname = opt('--name', '');
  if (!pname) fail('missing --name <kebab-name> (or use --self-test / --help)');
  if (!VALID_NAME.test(pname)) fail('invalid --name');
  const portN = Number.parseInt(opt('--port', String(DEFAULT_PORT)), 10);
  if (!Number.isInteger(portN) || portN < 1024 || portN > 65535) fail('invalid --port');
  const outRaw = opt('--out', pname);
  const t = path.isAbsolute(outRaw) ? outRaw : path.join(ROOT, outRaw);
  const plan = addPart4(addPart3(addPart2(filePlan({ name: pname, appId: opt('--app-id', pname), port: portN }))));
  if (has('--dry-run')) {
    console.log('new-project: dry-run ' + plan.m.size + ' files for ' + pname + ':');
    for (const f of [...plan.m.keys()].sort()) console.log('  ' + f);
    return;
  }
  if (fs.existsSync(t) && fs.readdirSync(t).length > 0 && !has('--force')) fail('target non-empty — pass --force');
  for (const [rel, content] of plan.m) {
    const abs = path.join(t, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, content, 'utf8');
  }
  console.log('new-project: scaffolded ' + plan.m.size + ' files -> ' + t);
}
runMain();