/**
 * Cross-browser smoke tests (Ongoing — Testing & Quality).
 * Playwright spec covering popup + marketplace gallery across engines.
 * Run: npx playwright test (with @playwright/test installed)
 */

const { test, expect } = require('@playwright/test');

const EXT_POPUP = 'file:///' + __dirname + '/../extension/popup.html';
const MARKETPLACE = 'file:///' + __dirname + '/../plugins/marketplace/index.html';

test('popup renders tabs', async ({ page }) => {
  await page.goto(EXT_POPUP);
  await expect(page.locator('.tab')).toHaveCount(4); // Generate/Config/History/Stats
  await page.click('.tab:nth-child(4)');
  await expect(page.locator('#stats-list')).toBeVisible();
});

test('marketplace renders catalog cards', async ({ page }) => {
  await page.goto(MARKETPLACE);
  await page.waitForSelector('.card', { timeout: 15000 });
  const count = await page.locator('.card').count();
  expect(count).toBeGreaterThan(0);
});