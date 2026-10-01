import { test, expect, type Page } from '@playwright/test';
import { localToGeo } from '@golfworld/shared';

async function ready(page: Page): Promise<void> {
  await page.goto('/'); await expect(page.locator('main')).toHaveAttribute('data-world-ready', 'true', { timeout: 30000 });
  await expect(page.getByRole('button', { name: /^Jump/ })).toBeEnabled();
}
async function actor(page: Page): Promise<{ x: number; y: number; z: number; head: number; handZ: number; action: string; propZ: number }> {
  return page.evaluate(async () => {
    const resource = performance.getEntriesByType('resource').find((entry) => entry.name.includes('/@react-three_fiber.js'));
    if (!resource) throw new Error('Renderer missing');
    const fiber = await import(resource.name);
    const scene = fiber._roots.get(document.querySelector('canvas')).store.getState().scene;
    const golfer = scene.getObjectByName('golfer'); const p = golfer.getWorldPosition(golfer.position.clone());
    const head = golfer.getObjectByName('mixamorigHead'); const hand = golfer.getObjectByName('mixamorigRightHand');
    const prop = scene.getObjectByName('practice-crate-0');
    return { x: p.x, y: p.y, z: p.z, head: head.getWorldPosition(head.position.clone()).y,
      handZ: hand.getWorldPosition(hand.position.clone()).z, action: golfer.userData.action,
      propZ: prop?.getWorldPosition(prop.position.clone()).z ?? 0 };
  });
}
test('desktop moves in four directions, jumps, crouches, and punches a physical prop', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop-chromium');
  const errors: string[] = []; page.on('pageerror', (error) => errors.push(error.message));
  await ready(page);
  for (const [key, axis, sign] of [['d', 'x', 1], ['a', 'x', -1], ['s', 'z', 1], ['w', 'z', -1]] as const) {
    const before = await actor(page); await page.keyboard.down(key);
    try { await expect.poll(async () => ((await actor(page))[axis] - before[axis]) * sign).toBeGreaterThan(0.55); }
    finally { await page.keyboard.up(key); }
    await expect.poll(async () => (await actor(page)).action).toBe('idle');
  }
  // Arrow controls use the same input path, including the reverse direction.
  const beforeArrow = await actor(page); await page.keyboard.down('ArrowUp');
  try { await expect.poll(async () => (await actor(page)).z).toBeLessThan(beforeArrow.z - 0.35); }
  finally { await page.keyboard.up('ArrowUp'); }
  await page.keyboard.press('Space'); await expect.poll(async () => (await actor(page)).y, { intervals: [30] }).toBeGreaterThan(0.2);
  await expect.poll(async () => (await actor(page)).action).toBe('idle');
  const upright = await actor(page); await page.keyboard.down('c');
  await expect.poll(async () => (await actor(page)).head).toBeLessThan(upright.head - 0.25);
  await page.screenshot({ path: info.outputPath('crouch.png') }); await page.keyboard.up('c');
  await expect.poll(async () => (await actor(page)).head).toBeGreaterThan(upright.head - 0.1);
  // Walk into reach of the crate; stop at its collision face rather than passing through it.
  await page.keyboard.down('w');
  try { await expect.poll(async () => (await actor(page)).z).toBeLessThan(7.3); }
  finally { await page.keyboard.up('w'); }
  await expect.poll(async () => (await actor(page)).action).toBe('idle');
  const propBefore = (await actor(page)).propZ; const handBefore = (await actor(page)).handZ;
  await page.keyboard.press('f');
  await expect.poll(async () => Math.abs((await actor(page)).handZ - handBefore), { intervals: [20] }).toBeGreaterThan(0.2);
  await expect.poll(async () => (await actor(page)).propZ).toBeLessThan(propBefore - 0.15);
  expect(errors).toEqual([]);
});
test('golf allows movement and actions, requires a nearby standing golfer, and keeps E for swings', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop-chromium');
  await ready(page); await page.getByRole('button', { name: 'Golf', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Hold to swing' })).toBeEnabled();
  const before = await actor(page); await page.keyboard.down('d');
  try { await expect.poll(async () => (await actor(page)).x).toBeGreaterThan(before.x + 5); }
  finally { await page.keyboard.up('d'); }
  await expect(page.getByRole('button', { name: 'Stand beside the ball to swing' })).toBeDisabled();
  await page.keyboard.press('e'); await expect(page.locator('.stroke-count b')).toHaveText('0');
  await page.getByRole('button', { name: 'Return to ball' }).click(); await expect(page.getByRole('button', { name: 'Hold to swing' })).toBeEnabled();
  // Space jumps here too and cannot count a golf stroke.
  await page.locator('canvas').click({ position: { x: 600, y: 360 } }); await page.keyboard.press('Space');
  await expect.poll(async () => (await actor(page)).y, { intervals: [30] }).toBeGreaterThan(0.2);
  await expect(page.locator('.stroke-count b')).toHaveText('0'); await expect(page.getByRole('button', { name: 'Hold to swing' })).toBeEnabled();
  await page.keyboard.down('c'); await expect(page.getByRole('button', { name: 'Stand beside the ball to swing' })).toBeDisabled(); await page.keyboard.up('c');
  await expect(page.getByRole('button', { name: 'Hold to swing' })).toBeEnabled();
  await page.keyboard.press('f'); await expect.poll(async () => (await actor(page)).action, { intervals: [20] }).toBe('punch');
  await expect(page.getByRole('button', { name: 'Hold to swing' })).toBeEnabled();
  await page.keyboard.down('e'); await expect(page.locator('.swing-button')).toContainText('Release'); await page.waitForTimeout(300); await page.keyboard.up('e');
  await expect(page.getByRole('button', { name: 'Tap at center to strike' })).toBeVisible();
  const stance = await actor(page); await page.keyboard.down('w'); await page.waitForTimeout(150); await page.keyboard.up('w');
  expect(Math.abs((await actor(page)).z - stance.z)).toBeLessThan(0.1);
  await page.keyboard.press('e'); await expect(page.locator('.stroke-count b')).toHaveText('1');
  await expect(page.getByRole('button', { name: 'Hold to swing' })).toBeEnabled({ timeout: 30000 });
  const after = await actor(page); expect(after.z).toBeLessThan(before.z - 2);
});
test('touch joystick and action buttons work in the hub and on the course without overlapping Swing', async ({ page }, info) => {
  test.skip(info.project.name === 'desktop-chromium');
  await ready(page);
  const joystick = page.getByRole('group', { name: 'Touch movement joystick' }); const box = (await joystick.boundingBox())!;
  const before = await actor(page); await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 30, box.y + box.height / 2);
  try { await expect.poll(async () => (await actor(page)).x).toBeGreaterThan(before.x + 0.5); }
  finally { await page.mouse.up(); }
  if (info.project.name === 'mobile-chromium') {
    const touch = await page.context().newCDPSession(page);
    const first = { id: 1, x: box.x + box.width / 2 + 30, y: box.y + box.height / 2 };
    const jump = (await page.getByRole('button', { name: 'Jump', exact: true }).boundingBox())!;
    const second = { id: 2, x: jump.x + jump.width / 2, y: jump.y + jump.height / 2 };
    await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [first] });
    const moving = await actor(page);
    await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [first, second] });
    await expect.poll(async () => (await actor(page)).y, { intervals: [20] }).toBeGreaterThan(0.15);
    await expect.poll(async () => (await actor(page)).x).toBeGreaterThan(moving.x + 0.3);
    await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await touch.detach();
    await expect(page.getByRole('button', { name: 'Jump', exact: true })).toBeEnabled();
  }
  await page.getByRole('button', { name: 'Crouch', exact: true }).tap();
  await expect(page.getByRole('button', { name: 'Crouch', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Crouch', exact: true }).tap();
  await expect(page.getByRole('button', { name: 'Jump', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Jump', exact: true }).tap(); await expect.poll(async () => (await actor(page)).y, { intervals: [20] }).toBeGreaterThan(0.15);
  await expect(page.getByRole('button', { name: 'Punch', exact: true })).toBeEnabled(); await page.getByRole('button', { name: 'Punch', exact: true }).tap();
  await expect.poll(async () => (await actor(page)).action, { intervals: [20] }).toBe('punch');
  await page.getByRole('button', { name: 'Golf', exact: true }).tap(); await expect(page.getByRole('button', { name: 'Hold to swing' })).toBeEnabled();
  const swing = (await page.locator('.swing-panel').boundingBox())!; const move = (await joystick.boundingBox())!;
  const actions = (await page.getByRole('group', { name: 'Avatar actions' }).boundingBox())!;
  expect(swing.y + swing.height).toBeLessThan(Math.min(move.y, actions.y));
  await page.getByRole('button', { name: 'Jump', exact: true }).tap(); await expect.poll(async () => (await actor(page)).y, { intervals: [20] }).toBeGreaterThan(0.15);
  await expect(page.locator('.stroke-count b')).toHaveText('0'); await expect(page.getByRole('button', { name: 'Hold to swing' })).toBeEnabled();
  await page.getByRole('button', { name: 'Club and aim options' }).tap();
  await expect(page.getByRole('button', { name: '7-iron', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '7-iron', exact: true }).tap();
  await page.getByRole('button', { name: 'Driver', exact: true }).tap();
  await page.getByRole('button', { name: 'Club and aim options' }).tap();
  await page.screenshot({ path: info.outputPath('mobile-golf-controls.png') });
});
test('mapped buildings block the same controller and phone input cannot move or punch the avatar', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop-chromium');
  await page.route('https://tile.openstreetmap.org/**', (route) => route.fulfill({ status: 204 }));
  await page.route('**/api/geo/search?**', (route) => route.fulfill({ json: { results: [{ id: 'motion', name: 'Movement test', address: 'Winnipeg, Canada', country: 'CA', lat: 49.895, lon: -97.138, kind: 'house', precision: 'address' }] } }));
  await page.route('**/api/geo/neighborhood?**', (route) => {
    const url = new URL(route.request().url()); const origin = { lat: Number(url.searchParams.get('lat')), lon: Number(url.searchParams.get('lon')) };
    return route.fulfill({ json: { origin, radius: 350, source: 'OpenStreetMap', fetchedAt: new Date().toISOString(), truncated: false,
      features: [{ id: 'wall', kind: 'building', rings: [[[-5, -3], [5, -3], [5, -1], [-5, -1], [-5, -3]].map(([x, z]) => localToGeo(x, z, origin))], holes: [], height: 4, estimatedHeight: true, tags: { building: 'house' } }] } });
  });
  await ready(page); await page.getByRole('button', { name: 'Global map', exact: true }).click(); await page.getByLabel('Address or golf course', { exact: true }).fill('Movement test');
  await page.getByRole('listbox', { name: 'Address suggestions' }).getByRole('option').click(); await expect(page.locator('.geo-info')).toContainText('Movement test');
  await expect(page.getByRole('button', { name: /^Jump/ })).toBeEnabled();
  await page.keyboard.down('w'); await page.waitForTimeout(1500); await page.keyboard.up('w');
  expect((await actor(page)).z).toBeGreaterThan(-0.75); expect((await actor(page)).z).toBeLessThan(-0.5);
  await page.keyboard.press('Space'); await expect.poll(async () => (await actor(page)).y, { intervals: [20] }).toBeGreaterThan(0.2);
  await expect(page.getByRole('button', { name: /^Jump/ })).toBeEnabled();
  await page.getByRole('button', { name: 'Phone', exact: false }).click(); await page.getByRole('button', { name: 'Settings', exact: true }).click();
  const before = await actor(page); await page.getByLabel('Display name').fill('wasd cf e'); await page.keyboard.press('Space');
  await page.waitForTimeout(300); const after = await actor(page); expect(after.z).toBeCloseTo(before.z, 2); expect(after.y).toBeCloseTo(before.y, 2); expect(after.action).toBe('idle');
});
