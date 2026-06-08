import { test, expect } from '@playwright/test';
import { mockNoaaApis } from './helpers/mockNoaaApis';

// All smoke tests use mocked NOAA APIs so results are deterministic and
// the suite does not depend on external network availability.
test.describe('AuroraWatch smoke tests', () => {
  test.beforeEach(async ({ page }) => {
    await mockNoaaApis(page);
  });

  test('homepage loads with 200', async ({ page }) => {
    const response = await page.goto('/');
    expect(response?.status()).toBe(200);
  });

  test('LIVE CONDITIONS section is visible', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('div.section-title', { hasText: 'LIVE CONDITIONS' }).first()).toBeVisible();
  });

  test('hero status heading is present after data loads', async ({ page }) => {
    await page.goto('/');
    // Mocked Kp=3.33 → outlook resolves to a non-Loading status
    const statusTexts = ['very low', 'Low', 'Good', 'Moderate', 'Excellent'];
    const found = await Promise.any(
      statusTexts.map((t) =>
        expect(
          page.locator('div.tracking-tighter', { hasText: t }).first()
        ).toBeVisible({ timeout: 15_000 }).then(() => true)
      )
    ).catch(() => false);
    expect(found).toBe(true);
  });

  test('SOLAR ACTIVITY section is visible', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('div.section-title', { hasText: 'SOLAR ACTIVITY' }).first()).toBeVisible();
  });

  test('metric cards are visible (Solar Wind, IMF Bz)', async ({ page }) => {
    await page.goto('/');
    // Wait for the live-data cards to finish loading before asserting
    await page.getByLabel('About Solar Wind data').waitFor({ timeout: 15_000 });
    await expect(
      page.locator('div.metric').filter({ hasText: 'SOLAR WIND' }).first()
    ).toBeVisible();
    await expect(
      page.locator('div.metric').filter({ hasText: 'IMF Bz' }).first()
    ).toBeVisible();
  });

  test('METEOR ACTIVITY section is visible', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('div.section-title', { hasText: 'METEOR ACTIVITY' }).first()).toBeVisible();
  });

  test('AURORA ALERTS section is visible', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('div.section-title', { hasText: 'AURORA ALERTS' })).toBeVisible();
  });

  test('Kp pill in header has an activity-level CSS class', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.kp-pill', { timeout: 15_000 });
    const pill = page.locator('.kp-pill').first();
    await expect(pill).toBeVisible();
    // Each tier class also carries the pulse animation added in globals.css
    const hasActivityClass = await pill.evaluate((el) => {
      const cls = Array.from(el.classList);
      return cls.some((c) =>
        ['kp-quiet', 'kp-moderate', 'kp-active', 'kp-strong', 'kp-storm'].includes(c)
      );
    });
    expect(hasActivityClass).toBe(true);
  });

  test('solar wind speed value is rendered as a number', async ({ page }) => {
    await page.goto('/');
    // Mocked plasma returns speed=450 → UI rounds it to 450
    await page.getByLabel('About Solar Wind data').waitFor({ timeout: 15_000 });
    await expect(page.locator('div.metric').filter({ hasText: 'SOLAR WIND' }).getByText('450')).toBeVisible();
  });
});
