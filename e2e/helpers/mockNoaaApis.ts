import type { Page } from '@playwright/test';

/**
 * Intercepts all NOAA/NASA network calls and returns minimal valid fixtures.
 * Register before page.goto() so routes are active for the initial load.
 *
 * Route precedence: Playwright uses the LAST registered route for a given URL,
 * so catch-alls are registered first and specific overrides come after.
 */
export async function mockNoaaApis(page: Page) {
  // Catch-all: any remaining SWPC request returns an empty array.
  // Non-critical sections (alerts, CMEs, flares) degrade gracefully on [].
  await page.route(/services\.swpc\.noaa\.gov/, route => route.fulfill({ json: [] }));

  // Fireballs proxy route
  await page.route('**/api/fireballs**', route =>
    route.fulfill({
      json: {
        fields: ['date', 'lat', 'lon', 'lat-dir', 'lon-dir', 'alt', 'vel', 'vf', 'energy', 'impact-e'],
        data: [],
      },
    })
  );

  // K-index — objects array; must have Kp !== null for hero to leave Loading state
  await page.route('**/noaa-planetary-k-index.json', route =>
    route.fulfill({
      json: [{ time_tag: '2026-06-07 18:00:00', Kp: 3.33, a_running: 0, station_count: 13 }],
    })
  );

  // Kp 3-day forecast — empty is fine
  await page.route('**/noaa-planetary-k-index-forecast.json', route =>
    route.fulfill({ json: [] })
  );

  // OVATION — provides maxAuroraProbNA and map data
  await page.route('**/ovation_aurora_latest.json', route =>
    route.fulfill({
      json: {
        'Observation Time': '2026-06-07T18:00:00Z',
        'Forecast Time': '2026-06-07T18:00:00Z',
        coordinates: [
          [212, 65, 30],
          [270, 50, 20],
          [300, 55, 15],
        ],
      },
    })
  );

  // Plasma — string[][] format; parsed by parseStringArrayRows
  await page.route('**/plasma-6-hour.json', route =>
    route.fulfill({
      json: [
        ['time_tag', 'density', 'speed', 'temperature'],
        ['2026-06-07 18:00:00', '5.0', '450', '50000'],
      ],
    })
  );

  // Mag — string[][] format
  await page.route('**/mag-6-hour.json', route =>
    route.fulfill({
      json: [
        ['time_tag', 'bx_gsm', 'by_gsm', 'bz_gsm', 'lon_gsm', 'lat_gsm', 'bt'],
        ['2026-06-07 18:00:00', '2.0', '-3.0', '-4.5', '10', '5', '8.0'],
      ],
    })
  );
}
