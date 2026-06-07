import { test, expect } from '@playwright/test';

test.describe('AuroraWatch smoke tests', () => {
  test('homepage loads with 200', async ({ page }) => {
    const response = await page.goto('/');
    expect(response?.status()).toBe(200);
  });

  test('CURRENT CONDITIONS section is visible', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('CURRENT CONDITIONS')).toBeVisible();
  });

  test('hero status heading is present', async ({ page }) => {
    await page.goto('/');
    // Any valid status: Quiet / Good / Moderate / Excellent / Loading
    const statusTexts = ['Quiet', 'Good', 'Moderate', 'Excellent', 'Loading'];
    const found = await Promise.any(
      statusTexts.map((t) => expect(page.getByRole('heading', { name: t, exact: false })).toBeVisible().then(() => true))
    ).catch(() => false);
    expect(found).toBe(true);
  });

  test('SOLAR ACTIVITY section is visible', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('SOLAR ACTIVITY')).toBeVisible();
  });

  test('metric cards are visible (Solar Wind, IMF Bz)', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('SOLAR WIND')).toBeVisible();
    await expect(page.getByText('IMF Bz')).toBeVisible();
  });

  test('METEOR ACTIVITY section is visible', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('METEOR ACTIVITY')).toBeVisible();
  });

  test('AURORA ALERTS section is visible', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('AURORA ALERTS')).toBeVisible();
  });
});
