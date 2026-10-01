import { test, expect, type Page } from '@playwright/test';

async function ready(page: Page): Promise<void> {
  await page.goto('/');
  await expect(page.getByText('Opening Meadow Club…')).not.toBeVisible({ timeout: 30_000 });
  await expect(page.locator('canvas')).toBeVisible();
  await expect(page.locator('main')).toHaveAttribute('data-world-ready', 'true', { timeout: 30_000 });
}
test('guest can open phone, save settings, arrange a lot, and swing', async ({ page }, testInfo) => {
  const errors: string[] = []; page.on('pageerror', (error) => errors.push(error.message));
  await ready(page);
  await page.screenshot({ path: testInfo.outputPath('hub.png') });
  await page.getByRole('button', { name: 'Phone', exact: false }).click();
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByLabel('Display name').fill('Meadow Tester');
  await page.getByLabel('Invert look Y').check(); await page.getByRole('button', { name: 'Save name' }).click();
  await expect(page.getByText('Name saved.')).toBeVisible();
  await page.getByRole('button', { name: 'Ocean outfit' }).click();
  await expect(page.getByLabel('Shirt color')).toHaveValue('#1267ab');
  await page.getByRole('button', { name: 'Phone home', exact: true }).click();
  await page.getByRole('button', { name: 'Scores', exact: true }).click();
  await expect(page.getByText('Your first round awaits.')).toBeVisible();
  await page.getByRole('button', { name: 'Close phone' }).click();
  await page.getByRole('button', { name: 'Home', exact: true }).click();
  await page.getByRole('button', { name: 'Oak chair', exact: true }).click();
  await page.waitForTimeout(1500);
  await page.locator('canvas').click({ position: { x: testInfo.project.name.startsWith('mobile') ? 190 : 630, y: testInfo.project.name.startsWith('mobile') ? 370 : 360 } });
  await expect(page.getByText('1/40 pieces')).toBeVisible();
  await page.getByRole('button', { name: 'Rotate 90°' }).click();
  await page.reload(); await expect(page.getByText('Opening Meadow Club…')).not.toBeVisible({ timeout: 30_000 });
  await page.getByRole('button', { name: 'Phone', exact: false }).click();
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await expect(page.getByLabel('Shirt color')).toHaveValue('#1267ab');
  await page.screenshot({ path: testInfo.outputPath('appearance.png') });
  await page.getByRole('button', { name: 'Close phone' }).click();
  await page.getByRole('button', { name: 'Home', exact: true }).click(); await expect(page.getByText('1/40 pieces')).toBeVisible();
  await page.getByRole('button', { name: 'Golf', exact: true }).click();
  await expect(page.getByText('Meadow Run', { exact: true })).toBeVisible();
  const button = page.locator('.swing-button'); const bounds = await button.boundingBox();
  if (!bounds) throw new Error('Swing control has no bounds');
  if (testInfo.project.name.startsWith('mobile')) {
    if (testInfo.project.name === 'mobile-chromium') {
      const touchSession = await page.context().newCDPSession(page);
      await touchSession.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: bounds.x + 30, y: bounds.y + 20 }] });
      await page.waitForTimeout(350);
      await touchSession.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      await touchSession.detach();
    } else await button.tap();
    await expect(page.getByRole('button', { name: 'Tap at center to strike' })).toBeVisible();
    await page.getByRole('button', { name: 'Tap at center to strike' }).tap();
  } else {
    await page.mouse.move(bounds.x + 30, bounds.y + 20); await page.mouse.down(); await page.waitForTimeout(350); await page.mouse.up();
    await expect(page.getByRole('button', { name: 'Tap at center to strike' })).toBeVisible();
    await page.getByRole('button', { name: 'Tap at center to strike' }).click();
  }
  await expect(page.getByRole('button', { name: 'Ball in motion…' })).toBeVisible();
  await expect(page.locator('.stroke-count b')).toHaveText('1');
  await expect(page.getByRole('button', { name: 'Hold to swing' })).toBeVisible({ timeout: 30_000 });
  expect(errors).toEqual([]);
  await page.screenshot({ path: testInfo.outputPath('golf.png') });
});
test('desktop keyboard opens and closes the phone', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium');
  await ready(page); await page.keyboard.press('p'); await expect(page.getByRole('dialog', { name: 'In-world phone' })).toBeVisible();
  await page.keyboard.press('Escape'); await expect(page.getByRole('dialog')).not.toBeVisible();
});

async function playShot(page: Page, power: number): Promise<void> {
  const button = page.locator('.swing-button');
  const bounds = await button.boundingBox();
  if (!bounds) throw new Error('Swing control missing');
  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
  await page.mouse.down();
  await expect.poll(async () => Number(/Release · (\d+)% power/.exec(await button.textContent() ?? '')?.[1] ?? 0), { intervals: [10] }).toBeGreaterThanOrEqual(Math.round(power * 100));
  await page.mouse.up();
  await expect(button).toHaveText('Tap at center to strike');
  await page.waitForTimeout(610); await page.mouse.down(); await page.mouse.up();
  await expect(button).toHaveText('Ball in motion…');
  await expect(page.getByRole('button', { name: 'Hold to swing' }).or(page.getByRole('button', { name: 'Play another round' }))).toBeVisible({ timeout: 30_000 });
}
test('plays a complete hole through the UI and saves the score', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium');
  test.setTimeout(180_000);
  await ready(page);
  await page.getByRole('button', { name: 'Golf', exact: true }).click();
  for (let shotIndex = 0; shotIndex < 12; shotIndex++) {
    if (await page.getByRole('button', { name: 'Play another round' }).isVisible()) break;
    const distance = Number(await page.locator('.swing-panel .lie').getAttribute('data-distance'));
    const club = distance > 200 ? 'Driver' : distance > 12 ? '7-iron' : 'Putter';
    await page.getByRole('button', { name: club, exact: true }).click();
    const power = club === 'Driver' ? 1 : Math.min(1, Math.sqrt(distance / (club === '7-iron' ? 125 : 18)));
    await playShot(page, power);
  }
  await expect(page.getByRole('button', { name: 'Play another round' })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('hole-out.png') });
  await page.getByRole('button', { name: 'Open phone & scores' }).click();
  await page.getByRole('button', { name: 'Scores', exact: true }).click();
  await expect(page.locator('.score-list li')).toHaveCount(1);
  await expect(page.locator('.score-list')).toContainText('Guest golfer');
  await page.reload(); await expect(page.locator('main')).toHaveAttribute('data-world-ready', 'true');
  await page.getByRole('button', { name: 'Phone', exact: false }).click();
  await page.getByRole('button', { name: 'Scores', exact: true }).click();
  await expect(page.locator('.score-list li')).toHaveCount(1);
  const secondTab = await page.context().newPage();
  await ready(secondTab);
  await secondTab.getByRole('button', { name: 'Phone', exact: false }).click();
  await secondTab.getByRole('button', { name: 'Scores', exact: true }).click();
  await expect(secondTab.locator('.score-list li')).toHaveCount(1);
  await secondTab.close();
});
