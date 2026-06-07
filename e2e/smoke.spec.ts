import { test, expect } from '@playwright/test';

test.describe('AuroraWatch smoke tests', () => {
  test('homepage loads with 200', async ({ page }) => {
    const response = await page.goto('/');
    expect(response?.status()).toBe(200);
  });

  test('LIVE CONDITIONS section is visible', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('div.section-title', { hasText: 'LIVE CONDITIONS' }).first()).toBeVisible();
  });

  test('hero status heading is present', async ({ page }) => {
    await page.goto('/');
    const statusTexts = ['very low', 'Low', 'Good', 'Moderate', 'Excellent'];
    const found = await Promise.any(
      statusTexts.map((t) =>
        expect(
          page.locator('div.tracking-tighter', { hasText: t }).first()
        ).toBeVisible().then(() => true)
      )
    ).catch(() => false);
    expect(found).toBe(true);
  });

  test('SOLAR ACTIVITY section is visible', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('div.section-title', { hasText: 'SOLAR ACTIVITY' })).toBeVisible();
  });

  test('metric cards are visible (Solar Wind, IMF Bz)', async ({ page }) => {
    await page.goto('/');
    await expect(
      page.locator('div.metric').filter({ hasText: 'SOLAR WIND' }).first()
    ).toBeVisible();
    await expect(
      page.locator('div.metric').filter({ hasText: 'IMF Bz' }).first()
    ).toBeVisible();
  });

  test('METEOR ACTIVITY section is visible', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('div.section-title', { hasText: 'METEOR ACTIVITY' })).toBeVisible();
  });

  test('AURORA ALERTS section is visible', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('div.section-title', { hasText: 'AURORA ALERTS' })).toBeVisible();
  });
});
