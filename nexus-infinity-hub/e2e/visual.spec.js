import { expect, test } from '@playwright/test';

// Visual regression: baseline snapshots are seeded ON LINUX CI via
// `gh workflow run playwright-e2e.yml -f mode=seed` (fonts/rendering differ per OS,
// so baselines must come from the same environment that checks them).
test('home page visual baseline', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#root')).toBeVisible();
  await expect(page).toHaveScreenshot('home.png', {
    fullPage: true,
    animations: 'disabled',
    maxDiffPixelRatio: 0.02,
  });
});
