import { test, expect } from '@playwright/test';
import { mockNoaaApis } from './helpers/mockNoaaApis';

test.describe('Aurora map section', () => {
  test.beforeEach(async ({ page }) => {
    await mockNoaaApis(page);
    await page.goto('/');
    // Card header is always present once the section mounts.
    // exact: true avoids matching the loading skeleton's "AURORA MAP — OVATION MODEL".
    await expect(page.getByText('OVATION MODEL', { exact: true })).toBeVisible();
  });

  test('map card shows the OVATION header and forecast title', async ({ page }) => {
    await expect(page.getByText('Aurora Visibility Forecast')).toBeVisible();
  });

  test('Details button opens the aurora map modal', async ({ page }) => {
    const mapCard = page.locator('.card', { hasText: 'Aurora Visibility Forecast' });
    await mapCard.getByRole('button', { name: 'Details' }).click();

    const dialog = page.getByRole('dialog', { name: 'Aurora Map' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText('What this map is showing')).toBeVisible();
    await expect(dialog.getByText('What the colors mean')).toBeVisible();
  });

  test('Close button dismisses the aurora map modal', async ({ page }) => {
    const mapCard = page.locator('.card', { hasText: 'Aurora Visibility Forecast' });
    await mapCard.getByRole('button', { name: 'Details' }).click();

    const dialog = page.getByRole('dialog', { name: 'Aurora Map' });
    await expect(dialog).toBeVisible();

    // Modal has two close controls (header X and bottom button) — either works
    await dialog.getByRole('button', { name: 'Close' }).first().click();
    await expect(dialog).not.toBeVisible();
  });

  test('Escape key closes the aurora map modal', async ({ page }) => {
    const mapCard = page.locator('.card', { hasText: 'Aurora Visibility Forecast' });
    await mapCard.getByRole('button', { name: 'Details' }).click();

    const dialog = page.getByRole('dialog', { name: 'Aurora Map' });
    await expect(dialog).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(dialog).not.toBeVisible();
  });
});
