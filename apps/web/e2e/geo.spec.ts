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
    const suggestion = page.getByRole('listbox', { name: 'Address suggestions' }).getByRole('option');
    await expect(suggestion).toContainText(place.address);
    await expect(suggestion.locator('[data-place-icon]')).toHaveAttribute('data-place-icon', place.country === 'CA' ? 'flag' : place.country === 'US' ? 'office' : 'landmark');
    const bounds = await page.locator('.address-dropdown').boundingBox();
    expect(bounds).not.toBeNull(); expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(page.viewportSize()!.width);
    await page.getByRole('listbox', { name: 'Address suggestions' }).getByRole('option').click();
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
  await page.getByRole('listbox', { name: 'Address suggestions' }).getByRole('option').click();
  await expect(page.getByRole('alert')).toContainText('could not load');
  await page.getByRole('button', { name: 'Close phone', exact: true }).click();
  await expect(page.locator('.geo-info')).toContainText('台北101');
  await page.getByRole('button', { name: 'Golf', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Hold to swing' })).toBeVisible();
});

test('address suggestions debounce, show place icons, dismiss, and support keyboard selection', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop-chromium', 'Keyboard-specific search behavior; touch travel is covered above.');
  const requests: string[] = [];
  const suggestions: Destination[] = [
    { ...places[0], id: 'home', name: '12 Main Street', kind: 'house', address: '12 Main Street, Winnipeg, Canada' },
    { ...places[0], id: 'school', name: 'Main Street School', kind: 'school', address: '14 Main Street, Winnipeg, Canada' },
    { ...places[0], id: 'cafe', name: 'Main Street Cafe', kind: 'cafe', address: '16 Main Street, Winnipeg, Canada' },
    ...places,
    { ...places[0], id: 'street', name: 'Main Street', kind: 'residential', precision: 'street', address: 'Main Street, Winnipeg, Canada' },
  ];
  await page.route('https://tile.openstreetmap.org/**', (route) => route.fulfill({ status: 204 }));
  await page.route('**/api/geo/search?**', (route) => {
    const query = new URL(route.request().url()).searchParams.get('q')!; requests.push(query);
    return query === 'unavailable' ? route.fulfill({ status: 502, json: { error: 'Search temporarily unavailable.' } }) : route.fulfill({ json: { results: query === 'no matches' ? [] : suggestions } });
  });
  let traveled = false;
  await page.route('**/api/geo/neighborhood?**', (route) => {
    traveled = true;
    return route.fulfill({ status: 502, json: { error: 'Travel fixture reached.' } });
  });
  await page.goto('/'); await expect(page.locator('main[data-world-ready="true"]')).toBeVisible({ timeout: 30000 });
  await page.getByRole('button', { name: 'Global map', exact: true }).click();
  const input = page.getByRole('combobox', { name: 'Address or golf course' });
  const list = page.getByRole('listbox', { name: 'Address suggestions' });
  await input.fill('Ma'); await expect(input).toHaveAttribute('aria-expanded', 'false');
  await input.fill('Main'); await input.fill('Main Street');
  await expect(list.getByRole('option')).toHaveCount(7);
  expect(requests).toEqual(['Main Street']); expect(traveled).toBe(false);
  for (const [index, icon] of ['home', 'school', 'food', 'flag', 'office', 'landmark', 'map'].entries()) {
    await expect(list.getByRole('option').nth(index).locator('[data-place-icon]')).toHaveAttribute('data-place-icon', icon);
  }
  await input.press('ArrowDown'); await expect(list.getByRole('option').first()).toHaveAttribute('aria-selected', 'true');
  await input.press('ArrowDown'); await expect(list.getByRole('option').nth(1)).toHaveAttribute('aria-selected', 'true');
  await input.press('Escape'); await expect(list).not.toBeVisible();
  await expect(page.getByRole('dialog', { name: 'In-world phone' })).toBeVisible();
  await input.press('ArrowDown'); await expect(list.getByRole('option').first()).toHaveAttribute('aria-selected', 'true');
  expect(requests).toEqual(['Main Street']);
  await input.press('ArrowDown'); await input.press('Enter');
  await expect(page.getByRole('alert')).toContainText('Travel fixture reached.'); expect(traveled).toBe(true);
  await input.fill('no matches'); await expect(page.getByRole('status')).toContainText('No mapped match');
  await input.fill('unavailable'); await expect(page.getByRole('alert').filter({ hasText: 'Search temporarily' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Search', exact: true })).toBeEnabled();
});

test('old responses and unfinished Chinese composition cannot replace current suggestions', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop-chromium', 'Focused composition and request-cancellation regression.');
  let releaseOld: (() => void) | undefined;
  let oldFinished: (() => void) | undefined;
  const finished = new Promise<void>((resolve) => { oldFinished = resolve; });
  const requests: string[] = [];
  await page.route('https://tile.openstreetmap.org/**', (route) => route.fulfill({ status: 204 }));
  await page.route('**/api/geo/search?**', async (route) => {
    const query = new URL(route.request().url()).searchParams.get('q')!; requests.push(query);
    if (query === 'Old address') {
      await new Promise<void>((resolve) => { releaseOld = resolve; });
      await route.fulfill({ json: { results: [places[0]] } }); oldFinished?.();
    } else await route.fulfill({ json: { results: [places[2]] } });
  });
  await page.goto('/'); await expect(page.locator('main[data-world-ready="true"]')).toBeVisible({ timeout: 30000 });
  await page.getByRole('button', { name: 'Global map', exact: true }).click();
  const input = page.getByRole('combobox', { name: 'Address or golf course' });
  const options = page.getByRole('listbox', { name: 'Address suggestions' }).getByRole('option');
  await input.fill('Old address'); await expect.poll(() => !!releaseOld).toBe(true);
  await input.dispatchEvent('compositionstart'); await input.fill('台北市信義');
  await expect(input).toHaveAttribute('aria-expanded', 'false');
  // Explicit submit during IME composition must not request the unfinished text.
  await input.press('Enter'); expect(requests).toEqual(['Old address']);
  await input.dispatchEvent('compositionend');
  await expect(options).toContainText(['台北101']);
  expect(requests).toEqual(['Old address', '台北市信義']);
  releaseOld!(); await finished;
  await expect(options).toContainText(['台北101']); await expect(options).not.toContainText(['Kildonan']);
  await input.fill(''); await expect(input).toHaveAttribute('aria-expanded', 'false');
});
