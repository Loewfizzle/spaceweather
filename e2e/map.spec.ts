import { test, expect } from '@playwright/test';
import { mockNoaaApis } from './helpers/mockNoaaApis';

test.describe('Aurora map controls', () => {
  test.beforeEach(async ({ page }) => {
    await mockNoaaApis(page);
    await page.goto('/');
    // The map section title is always present (doesn't depend on OVATION loading)
    await expect(page.getByText('AURORA MAP — OVATION MODEL')).toBeVisible();
  });

  test('probability slider is visible with default value of 3', async ({ page }) => {
    const slider = page.getByRole('slider', { name: /minimum aurora probability/i });
    await expect(slider).toBeVisible();
    await expect(slider).toHaveValue('3');
    await expect(page.getByText('3%')).toBeVisible();
  });

  test('reset button is not shown at the default value', async ({ page }) => {
    await expect(page.getByTitle('Reset filter to default')).not.toBeVisible();
  });

  test('changing slider shows reset button and updates percentage label', async ({ page }) => {
    const slider = page.getByRole('slider', { name: /minimum aurora probability/i });
    await slider.fill('25');

    await expect(page.getByTitle('Reset filter to default')).toBeVisible();
    await expect(page.getByText('25%')).toBeVisible();
  });

  test('reset button restores slider to 3 and hides itself', async ({ page }) => {
    const slider = page.getByRole('slider', { name: /minimum aurora probability/i });
    await slider.fill('20');
    await expect(page.getByTitle('Reset filter to default')).toBeVisible();

    await page.getByTitle('Reset filter to default').click();

    await expect(slider).toHaveValue('3');
    await expect(page.getByTitle('Reset filter to default')).not.toBeVisible();
  });
});
