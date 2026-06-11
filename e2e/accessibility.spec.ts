import AxeBuilder from '@axe-core/playwright';
import { test, expect } from '@playwright/test';
import { mockNoaaApis } from './helpers/mockNoaaApis';

test.describe('Accessibility', () => {
  test.beforeEach(async ({ page }) => {
    await mockNoaaApis(page);
    await page.goto('/');
    // Wait for hero to exit Loading state — "Current indicators —" only renders with Kp data
    await page.getByText(/Current indicators/).waitFor();
  });

  test('no critical or serious axe violations on homepage', async ({ page }) => {
    const results = await new AxeBuilder({ page })
      // Color contrast is a design-space tradeoff, not a functional barrier
      .disableRules(['color-contrast', 'color-contrast-enhanced'])
      .analyze();

    const blocking = results.violations.filter(
      (v) => v.impact === 'critical' || v.impact === 'serious'
    );

    expect(
      blocking,
      `Axe violations found:\n${blocking.map((v) => `  [${v.impact}] ${v.id}: ${v.description}`).join('\n')}`
    ).toHaveLength(0);
  });

  test('aurora map section has no critical axe violations', async ({ page }) => {
    await expect(page.getByText('OVATION MODEL', { exact: true })).toBeVisible();

    const results = await new AxeBuilder({ page })
      .include('[data-testid="aurora-map-section"]')
      .disableRules(['color-contrast', 'color-contrast-enhanced'])
      .analyze();

    const critical = results.violations.filter((v) => v.impact === 'critical');
    expect(critical).toHaveLength(0);
  });

  test('Kp info modal is keyboard accessible', async ({ page }) => {
    // Wait for the info button to exist
    await page.getByLabel('About Planetary Kp index').waitFor();

    // Activate via keyboard
    await page.getByLabel('About Planetary Kp index').focus();
    await page.keyboard.press('Enter');

    const dialog = page.getByRole('dialog', { name: 'Planetary Kp Index' });
    await expect(dialog).toBeVisible();

    // Close button is focusable and works
    await page.getByRole('button', { name: 'Close' }).focus();
    await page.keyboard.press('Enter');
    await expect(dialog).not.toBeVisible();
  });

  test('aurora map Details button is keyboard accessible', async ({ page }) => {
    const mapCard = page.locator('.card', { hasText: 'Aurora Visibility Forecast' });
    await mapCard.getByRole('button', { name: 'Details' }).focus();
    await page.keyboard.press('Enter');

    const dialog = page.getByRole('dialog', { name: 'Aurora Map' });
    await expect(dialog).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(dialog).not.toBeVisible();
  });
});
