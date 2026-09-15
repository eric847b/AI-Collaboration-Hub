import { expect, test } from '@playwright/test';

test('home page loads with a title', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/.+/);
});

test('app root renders', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#root')).toBeVisible();
});

test('no console or page errors on load', async ({ page }) => {
  const errors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', (err) => errors.push(String(err)));
  await page.goto('/');
  await expect(page.locator('#root')).toBeVisible();
  expect(errors).toEqual([]);
});
