import { test, expect } from '@playwright/test';
import { mockNoaaApis } from './helpers/mockNoaaApis';

test.describe('Metric info modals', () => {
  test.beforeEach(async ({ page }) => {
    await mockNoaaApis(page);
    await page.goto('/');
    // Wait for Current Conditions cards to finish loading (not a skeleton)
    await page.getByLabel('About Solar Wind data').waitFor();
  });

  test('Solar Wind modal opens and shows educational content', async ({ page }) => {
    await page.getByLabel('About Solar Wind data').click();

    const dialog = page.getByRole('dialog', { name: 'Solar Wind' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText('Speed')).toBeVisible();
    await expect(dialog.getByText('Density')).toBeVisible();
    await expect(dialog.getByText('Aurora relevance')).toBeVisible();
  });

  test('IMF Bz modal opens and shows southward content', async ({ page }) => {
    await page.getByLabel('About IMF Bz').click();

    const dialog = page.getByRole('dialog', { name: 'IMF Bz' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText('Southward is favorable')).toBeVisible();
    await expect(dialog.getByText('Northward blocks activity')).toBeVisible();
  });

  test('Kp modal opens and shows visibility table', async ({ page }) => {
    await page.getByLabel('About Planetary Kp index').click();

    const dialog = page.getByRole('dialog', { name: 'Planetary Kp Index' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText('Kp 5')).toBeVisible();
    await expect(dialog.getByText('Minneapolis, Seattle, Montreal')).toBeVisible();
  });

  test('Close button dismisses modal', async ({ page }) => {
    await page.getByLabel('About IMF Bz').click();
    await expect(page.getByRole('dialog')).toBeVisible();

    await page.getByRole('button', { name: 'Close' }).click();

    await expect(page.getByRole('dialog')).not.toBeVisible();
  });

  test('clicking the backdrop closes modal', async ({ page }) => {
    await page.getByLabel('About Solar Wind data').click();
    const dialog = page.getByRole('dialog', { name: 'Solar Wind' });
    await expect(dialog).toBeVisible();

    // Click at the outer edge of the backdrop (not on the inner card)
    const box = await dialog.boundingBox();
    if (box) {
      await page.mouse.click(box.x + 5, box.y + 5);
    }

    await expect(dialog).not.toBeVisible();
  });

  test('opening one modal and then another replaces the first', async ({ page }) => {
    await page.getByLabel('About Solar Wind data').click();
    await expect(page.getByRole('dialog', { name: 'Solar Wind' })).toBeVisible();
    await page.getByRole('button', { name: 'Close' }).click();

    await page.getByLabel('About Planetary Kp index').click();
    await expect(page.getByRole('dialog', { name: 'Planetary Kp Index' })).toBeVisible();
    await expect(page.getByRole('dialog', { name: 'Solar Wind' })).not.toBeVisible();
  });
});
