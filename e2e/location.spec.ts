import { test, expect } from '@playwright/test';
import { mockNoaaApis } from './helpers/mockNoaaApis';

test.describe('Location flows', () => {
  test.beforeEach(async ({ page }) => {
    await mockNoaaApis(page);
    await page.goto('/');
    // Wait for hero to exit Loading state — "Current indicators —" only renders with Kp data
    await page.getByText(/Current indicators/).waitFor();
  });

  test('direct lat/lon entry sets location label in hero', async ({ page }) => {
    await page.getByRole('button', { name: 'Enter manually' }).click();

    // LocationPicker — type a valid lat,lon string (bypasses the search API)
    await page.getByPlaceholder(/City, state/i).fill('44.0, -93.0');
    // exact: true — the Cancel button's aria-label "Cancel location search" also substring-matches "Search"
    await page.getByRole('button', { name: 'Search', exact: true }).click();

    // onConfirm fires immediately (no API call for direct coords).
    // The label can appear in both the hero list and the footer row — first() avoids strict-mode failure.
    await expect(page.getByText(/44\.0000°/).first()).toBeVisible();
    // Clear control appears when location is set
    await expect(page.getByRole('button', { name: 'Clear saved location' })).toBeVisible();
  });

  test('GPS location flow resolves and shows Clear control', async ({ browser }) => {
    const context = await browser.newContext({
      permissions: ['geolocation'],
      geolocation: { latitude: 46.5, longitude: -84.3 },
    });
    const page = await context.newPage();
    await mockNoaaApis(page);
    await page.goto('/');
    await page.getByText(/Current indicators/).waitFor();

    await page.getByRole('button', { name: 'Use my location' }).click();

    // GPS resolves via browser geolocation mock — Clear control appears
    await expect(page.getByRole('button', { name: 'Clear saved location' })).toBeVisible({ timeout: 15_000 });
    await context.close();
  });

  test('clearing a set location returns to idle state', async ({ page }) => {
    // Set location first
    await page.getByRole('button', { name: 'Enter manually' }).click();
    await page.getByPlaceholder(/City, state/i).fill('44.0, -93.0');
    // exact: true — the Cancel button's aria-label "Cancel location search" also substring-matches "Search"
    await page.getByRole('button', { name: 'Search', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Clear saved location' })).toBeVisible();

    // Clear it
    await page.getByRole('button', { name: 'Clear saved location' }).click();

    // Hero returns to idle: GPS and manual-entry buttons are visible again
    await expect(page.getByRole('button', { name: 'Enter manually' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Use my location' })).toBeVisible();
  });

  test('Cancel button closes the LocationPicker without setting location', async ({ page }) => {
    await page.getByRole('button', { name: 'Enter manually' }).click();
    await expect(page.getByPlaceholder(/City, state/i)).toBeVisible();

    await page.getByRole('button', { name: 'Cancel location search' }).click();

    await expect(page.getByPlaceholder(/City, state/i)).not.toBeVisible();
    await expect(page.getByRole('button', { name: 'Enter manually' })).toBeVisible();
  });
});
