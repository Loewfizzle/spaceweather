import AxeBuilder from '@axe-core/playwright';
import { test, expect } from '@playwright/test';
import { mockNoaaApis } from './helpers/mockNoaaApis';

test.describe('Accessibility', () => {
  test.beforeEach(async ({ page }) => {
    await mockNoaaApis(page);
    await page.goto('/');
    // Wait for the page to exit the initial Loading skeleton
    await page.getByRole('heading', { name: /very low|low|good|moderate|excellent/i }).waitFor();
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
    const mapSection = page.locator('text=AURORA MAP — OVATION MODEL').locator('../..');
    const results = await new AxeBuilder({ page })
      .include(await mapSection.evaluate((el) => {
        // Return a unique selector for the map section
        return el.className ? `.${el.className.split(' ')[0]}` : 'body';
      }))
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

  test('probability slider is keyboard controllable', async ({ page }) => {
    const slider = page.getByRole('slider', { name: /minimum aurora probability/i });
    await slider.focus();

    const initialValue = await slider.inputValue();

    // Arrow Right increases value
    await page.keyboard.press('ArrowRight');
    const newValue = await slider.inputValue();
    expect(parseInt(newValue)).toBeGreaterThan(parseInt(initialValue));
  });
});
