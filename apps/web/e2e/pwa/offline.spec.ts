import { test, expect } from '@playwright/test';
test('production world and phone load offline after a cached visit', async ({ page, context }) => {
  const errors: string[] = []; page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await expect(page.locator('main')).toHaveAttribute('data-world-ready', 'true', { timeout: 30_000 });
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
  await page.reload();
  await expect(page.locator('main')).toHaveAttribute('data-world-ready', 'true', { timeout: 30_000 });
  await page.waitForFunction(async () => {
    const cache = await caches.open('golfworld-v1');
    const resources = performance.getEntriesByType('resource').map((entry) => entry.name).filter((name) => name.includes('/assets/'));
    return resources.length > 2 && (await Promise.all(resources.map((name) => cache.match(name)))).every(Boolean);
  });
  const manifest = await context.request.get('/manifest.webmanifest');
  expect(await manifest.json()).toMatchObject({ display: 'standalone' });
  expect((await context.request.get('/icon-192.png')).ok()).toBe(true);
  expect((await context.request.get('/icon-512.png')).ok()).toBe(true);
  await context.setOffline(true); await page.reload();
  await expect(page.locator('main')).toHaveAttribute('data-world-ready', 'true', { timeout: 30_000 });
  await page.getByRole('button', { name: 'Phone', exact: false }).click();
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Your appearance' })).toBeVisible();
  expect(errors).toEqual([]);
});
