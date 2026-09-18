import { defineConfig } from '@playwright/test';

// Full-browser E2E config. Serves the production build via `vite preview`
// (run `npm run build` first) and runs the specs in ./e2e.
export default defineConfig({
  testDir: './e2e',
  // Slow-laptop budget: 10 min per test, server, and expect.
  timeout: 600000,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['html', { open: 'never' }], ['list']] : [['list']],
  use: {
    baseURL: process.env.PLAYWRIGHT_TEST_BASE ? `http://127.0.0.1:${process.env.PLAYWRIGHT_TEST_BASE}` : 'http://127.0.0.1:4173',
    headless: true,
    trace: 'on-first-retry',
  },
  webServer: {
    // Slow-laptop budget: 10 min server-start. Installed `preview` script used
    // (no npx stall — see workspace rule 6).
    command: 'npm run preview -- --port 4173 --strictPort',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 600000,
  },
  expect: {
    timeout: 600000,
  },
});
