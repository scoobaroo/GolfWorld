import { test, expect } from '@playwright/test';
import { localToGeo, type Destination, type Neighborhood } from '@golfworld/shared';

const places: Destination[] = [
  { id: 'ca', name: 'Kildonan Park Golf Course', address: '2021 Main Street, Winnipeg, Canada', country: 'CA', kind: 'golf_course', precision: 'address', lat: 49.947385, lon: -97.1044382 },
  { id: 'us', name: 'Google Building 41', address: '1600 Amphitheatre Parkway, Mountain View, USA', country: 'US', kind: 'commercial', precision: 'address', lat: 37.4224858, lon: -122.0855846 },
  { id: 'tw', name: '台北101', address: '7 信義路五段, 台北市, 臺灣', country: 'TW', kind: 'attraction', precision: 'address', lat: 25.0338352, lon: 121.5644995 },
];
test('search, real-world travel, avatar map, restore, and failed travel work on touch and desktop', async ({ page }, info) => {
  await page.route('https://tile.openstreetmap.org/**', (route) => route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><rect width="256" height="256" fill="#d9e4cf"/><path d="M0 120H256M128 0V256" stroke="#fff" stroke-width="12"/></svg>' }));
  await page.route('**/api/geo/search?**', (route) => {
    const url = new URL(route.request().url());
    return route.fulfill({ json: { results: places.filter((p) => p.country === url.searchParams.get('country')) } });
  });
  let fail = false;
  await page.route('**/api/geo/neighborhood?**', (route) => {
    if (fail) return route.fulfill({ status: 502, json: { error: 'Neighborhood data could not load. Retry the location.' } });
    const url = new URL(route.request().url()); const origin = { lat: Number(url.searchParams.get('lat')), lon: Number(url.searchParams.get('lon')) };
    const polygon = [[-10, -10], [10, -10], [10, 10], [-10, 10], [-10, -10]].map(([x, z]) => localToGeo(x, z, origin));
    const scene: Neighborhood = { origin, radius: 350, fetchedAt: new Date().toISOString(), source: 'OpenStreetMap', truncated: false, features: [
      { id: 'test-building', kind: 'building', rings: [polygon], holes: [], height: 18, estimatedHeight: true, tags: { building: 'apartments' } },
      { id: 'test-road', kind: 'road', rings: [[localToGeo(-80, 20, origin), localToGeo(80, 20, origin)]], holes: [], height: 0, estimatedHeight: false, tags: { highway: 'residential' } },
    ] };
    return route.fulfill({ json: scene });
  });
  await page.goto('/'); await expect(page.locator('main[data-world-ready="true"]')).toBeVisible({ timeout: 30000 });
  for (const place of places) {
    await page.getByRole('button', { name: 'Global map', exact: true }).click();
    await page.getByLabel('Search region', { exact: true }).selectOption(place.country);
    await page.getByLabel('Address or golf course', { exact: true }).fill(place.name);
    await page.getByRole('button', { name: 'Search', exact: true }).click();
    await page.getByRole('list', { name: 'Location results' }).getByRole('button').click();
    await expect(page.getByRole('dialog', { name: 'In-world phone' })).not.toBeVisible();
    await expect(page.locator('.geo-info')).toContainText(place.name);
    await expect(page.locator('.geo-info')).toContainText('1 unit = 1 meter');
    await expect(page.locator('.geo-info')).toContainText('1 mapped buildings');
    await expect(page.getByText('World data © OpenStreetMap contributors')).toBeVisible();
    if (info.project.name === 'desktop-chromium' && place.country === 'CA') {
      const viewport = page.viewportSize()!;
      await page.locator('canvas').click({ position: { x: viewport.width / 2, y: viewport.height * 0.27 } });
      await expect(page.getByRole('region', { name: 'Building details' })).toContainText('apartments');
      await expect(page.getByRole('region', { name: 'Building details' })).toContainText('18.0 m (estimated)');
      await page.getByRole('button', { name: 'Close building details' }).click();
    }
    await page.getByRole('button', { name: 'Global map', exact: true }).click();
    await expect(page.getByLabel('Your avatar location')).toBeVisible();
    await expect(page.locator('.map-caption').first()).toContainText(String(place.lat).slice(0, 6));
    await page.getByRole('button', { name: 'Large map', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Explore the world' })).toBeVisible();
    await page.screenshot({ path: info.outputPath(`map-${place.country}.png`) });
    await page.getByRole('button', { name: 'Close large map' }).click();
    await page.getByRole('button', { name: 'Close phone', exact: true }).click();
  }
  await page.reload(); await expect(page.locator('.geo-info')).toContainText('台北101', { timeout: 30000 });
  await page.getByRole('button', { name: 'Global map', exact: true }).click();
  await page.getByLabel('Search region', { exact: true }).selectOption('CA');
  await page.getByLabel('Address or golf course', { exact: true }).fill('Kildonan');
  await page.getByRole('button', { name: 'Search', exact: true }).click(); fail = true;
  await page.getByRole('list', { name: 'Location results' }).getByRole('button').click();
  await expect(page.getByRole('alert')).toContainText('could not load');
  await page.getByRole('button', { name: 'Close phone', exact: true }).click();
  await expect(page.locator('.geo-info')).toContainText('台北101');
  await page.getByRole('button', { name: 'Golf', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Hold to swing' })).toBeVisible();
});
