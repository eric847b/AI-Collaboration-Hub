import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';

const __dir = dirname(fileURLToPath(import.meta.url));
const snapshotDir = join(__dir, 'visual.spec.js-snapshots');
const hasBaselines = existsSync(join(snapshotDir, 'home-linux.png'));

// Visual regression: seed ON LINUX CI via
// `gh workflow run playwright-e2e.yml -f mode=seed`
// (fonts/rendering differ per OS — baselines must match the checker).
test('home page visual baseline', async ({ page }) => {
  test.skip(
    !hasBaselines,
    'No visual baselines yet — run playwright-e2e.yml with mode=seed once',
  );
  await page.goto('/');
  await expect(page.locator('#root')).toBeVisible();
  await expect(page).toHaveScreenshot('home.png', {
    fullPage: true,
    animations: 'disabled',
    maxDiffPixelRatio: 0.02,
  });
});
