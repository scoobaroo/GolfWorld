import { test, expect, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { buildingCaptureSchema, type BuildingCapture } from '@golfworld/shared';

async function fixture(page: Page, denied = false): Promise<void> {
  await page.route('https://tile.openstreetmap.org/**', (route) => route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><rect width="256" height="256" fill="#d9e4cf"/></svg>' }));
  await page.addInitScript((deny) => {
    const tracks: MediaStreamTrack[] = []; const watches = new Set<number>();
    Object.assign(window, { captureTest: { tracks, watches } });
    Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia: async () => {
      if (deny) throw new DOMException('Denied', 'NotAllowedError');
      const canvas = document.createElement('canvas'); canvas.width = 640; canvas.height = 480; const context = canvas.getContext('2d')!;
      let frame = 0; const draw = (): void => {
        context.fillStyle = '#a9c9d7'; context.fillRect(0, 0, 640, 480); context.fillStyle = '#c39f80'; context.fillRect(90, 100, 450, 300);
        context.fillStyle = '#425a60'; for (let x = 130; x < 530; x += 100) context.fillRect(x, 150, 55, 130);
        context.fillStyle = '#6f925b'; context.fillRect(frame++ % 640, 400, 35, 35);
      };
      draw(); const stream = canvas.captureStream(15); tracks.push(...stream.getTracks()); const timer = window.setInterval(draw, 66);
      stream.getTracks()[0].addEventListener('ended', () => clearInterval(timer)); return stream;
    } } });
    Object.defineProperty(navigator, 'geolocation', { configurable: true, value: {
      watchPosition: (success: PositionCallback, failure: PositionErrorCallback) => {
        if (deny) { window.setTimeout(() => failure({ code: 1, message: 'Denied' } as GeolocationPositionError), 0); return 1; }
        const fix = (): void => success({ coords: { latitude: 49.89503, longitude: -97.13846, accuracy: 8, altitude: 229, altitudeAccuracy: 15, heading: null, speed: null }, timestamp: Date.now() } as GeolocationPosition);
        window.setTimeout(fix, 0); const id = window.setInterval(fix, 500); watches.add(id); return id;
      }, clearWatch: (id: number) => { clearInterval(id); watches.delete(id); },
    } });
    if (typeof DeviceOrientationEvent !== 'undefined') Object.defineProperty(DeviceOrientationEvent, 'requestPermission', { configurable: true, value: async () => deny ? 'denied' : 'granted' });
    window.setInterval(() => {
      const event = new Event('deviceorientation'); Object.assign(event, { alpha: 30, beta: 88, gamma: 4, absolute: true }); window.dispatchEvent(event);
    }, 200);
  }, denied);
  await page.goto('/'); await expect(page.locator('main[data-world-ready="true"]')).toBeVisible({ timeout: 30000 });
  await page.getByRole('button', { name: 'Global map', exact: true }).click();
  await page.getByRole('button', { name: 'Capture building or area' }).click();
  await expect(page.getByRole('heading', { name: 'Capture', exact: true })).toBeVisible();
}
async function metadata(page: Page): Promise<BuildingCapture> {
  const download = page.waitForEvent('download'); await page.getByRole('button', { name: 'Download metadata' }).click();
  return buildingCaptureSchema.parse(JSON.parse(await readFile((await (await download).path())!, 'utf8')));
}
async function sensorsStopped(page: Page): Promise<void> {
  await expect.poll(() => page.evaluate(() => {
    const state = (window as unknown as { captureTest: { tracks: MediaStreamTrack[]; watches: Set<number> } }).captureTest;
    return state.tracks.every((track) => track.readyState === 'ended') && state.watches.size === 0;
  })).toBe(true);
}
test('photo captures keep GPS separate from building pins, persist, export, and reopen from the map', async ({ page }, info) => {
  await fixture(page); await page.getByLabel('Building / place name').fill('Winnipeg exterior fixture');
  await page.getByRole('button', { name: 'Enable GPS', exact: true }).click(); await expect(page.getByText('GPS readings available')).toBeVisible();
  await page.getByRole('button', { name: 'Enable direction sensor' }).click(); await expect(page.getByText('Direction readings available')).toBeVisible();
  await page.getByRole('button', { name: 'Enable camera', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Take photo' })).toBeEnabled(); await page.getByRole('button', { name: 'Take photo' }).click();
  await expect(page.getByRole('img', { name: 'Capture of Winnipeg exterior fixture' })).toBeVisible(); await sensorsStopped(page);
  await page.getByLabel('Detail notes').fill('Facade and roofline need review.');
  await page.getByRole('button', { name: 'Save local draft' }).click(); await expect(page.getByText('Draft saved on this device.')).toBeVisible();
  const capture = await metadata(page);
  expect(capture).toMatchObject({ acquisition: 'live-camera', cameraPose: 'unresolved', cameraIntrinsics: null, note: 'Facade and roofline need review.', media: { kind: 'photo' } });
  expect(capture.capturedAt).not.toBeNull(); expect(capture.target.point.lat).not.toBe(capture.samples[0].gps?.lat);
  expect(capture.samples[0].gps).toMatchObject({ lat: 49.89503, lon: -97.13846, accuracyM: 8, altitudeM: 229 });
  expect(capture.samples[0].orientation).toMatchObject({ alphaDeg: 30, betaDeg: 88, gammaDeg: 4, absolute: true });
  await page.getByRole('button', { name: 'Close phone', exact: true }).click();
  await page.getByRole('button', { name: 'Global map', exact: true }).click();
  await page.getByRole('button', { name: 'Local capture: Winnipeg exterior fixture' }).click();
  await expect(page.getByRole('img', { name: 'Capture of Winnipeg exterior fixture' })).toBeVisible();
  await page.reload(); await expect(page.locator('main[data-world-ready="true"]')).toBeVisible({ timeout: 30000 });
  await page.getByRole('button', { name: 'Phone', exact: false }).click(); await page.getByRole('button', { name: 'Capture', exact: true }).click();
  await page.getByRole('button', { name: /Winnipeg exterior fixture photo/ }).click();
  await expect(page.getByRole('button', { name: 'Saved locally' })).toBeVisible();
  const downloadedMedia = page.waitForEvent('download'); await page.getByRole('button', { name: 'Download media' }).click();
  expect((await downloadedMedia).suggestedFilename()).toMatch(/\.jpg$/);
  await page.locator('.capture-metadata').scrollIntoViewIfNeeded(); await page.screenshot({ path: info.outputPath('capture-review.png') });
});
test('short video records playable media and timestamped sensor samples; closing releases devices', async ({ page }) => {
  await fixture(page); await page.getByRole('radio', { name: 'Area', exact: true }).check();
  await page.getByLabel('Building / place name').fill('Area video fixture');
  await page.getByRole('button', { name: 'Enable GPS', exact: true }).click();
  await page.getByRole('button', { name: 'Enable camera', exact: true }).click(); await expect(page.getByRole('button', { name: 'Record video' })).toBeEnabled();
  await page.getByRole('button', { name: 'Record video' }).click();
  await expect.poll(() => page.locator('.capture-recording').textContent()).toMatch(/Recording · [2-9] \/ 20/);
  await page.getByRole('button', { name: 'Stop video' }).click();
  const preview = page.getByLabel('Recorded building video'); await expect(preview).toBeVisible();
  await page.getByRole('button', { name: 'Play video', exact: true }).click();
  await expect.poll(() => preview.evaluate((element: HTMLVideoElement) => element.videoWidth)).toBeGreaterThan(0);
  await expect.poll(() => preview.evaluate((element: HTMLVideoElement) => element.currentTime)).toBeGreaterThan(0);
  const capture = await metadata(page); expect(capture.media.kind).toBe('video'); expect(capture.media.durationMs).toBeGreaterThan(1000); expect(capture.samples.length).toBeGreaterThan(2);
  expect(capture.coverage).toBe('area');
  expect(capture.samples.at(-1)?.offsetMs).toBe(capture.media.durationMs); await sensorsStopped(page);
  await page.getByRole('button', { name: 'Save local draft' }).click(); await expect(page.getByText('Draft saved on this device.')).toBeVisible();
  await page.getByRole('button', { name: 'New capture' }).click(); await page.getByRole('button', { name: /Area video fixture video/ }).click();
  await page.getByRole('button', { name: 'Play video', exact: true }).click();
  await expect.poll(() => preview.evaluate((element: HTMLVideoElement) => element.currentTime)).toBeGreaterThan(0);
  await page.getByRole('button', { name: 'New capture' }).click(); await page.getByRole('button', { name: 'Enable GPS', exact: true }).click();
  await page.getByRole('button', { name: 'Enable camera', exact: true }).click(); await expect(page.getByRole('button', { name: 'Take photo' })).toBeEnabled();
  await page.getByRole('button', { name: 'Close phone', exact: true }).click(); await sensorsStopped(page);
});
test('denied sensors and imported files retain unknown original pose; quota failure preserves export', async ({ page }, info) => {
  await fixture(page, true); await page.getByRole('button', { name: 'Enable camera', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Camera could not open');
  await page.getByRole('button', { name: 'Enable GPS', exact: true }).click(); await expect(page.getByText('GPS unavailable or denied.')).toBeVisible();
  await page.getByLabel('Building / place name').fill('Indoor lobby fixture');
  await page.getByRole('radio', { name: 'Interior', exact: true }).check();
  await page.getByLabel('Floor / level (optional)').fill('Ground'); await page.getByLabel('Room / space (optional)').fill('Lobby');
  await page.getByLabel('Detail notes').fill('Two doors, stone walls, tile floor.');
  await page.getByLabel('Add photo', { exact: true }).setInputFiles('public/icon-192.png');
  await expect(page.locator('.capture-preview img')).toBeVisible();
  const imported = await metadata(page); expect(imported.acquisition).toBe('file-picker'); expect(imported.capturedAt).toBeNull(); expect(imported.samples).toEqual([]);
  expect(imported).toMatchObject({ coverage: 'interior', floor: 'Ground', room: 'Lobby', note: 'Two doors, stone walls, tile floor.' });
  await expect(page.getByText('Camera GPS: unknown')).toBeVisible();
  if (info.project.name === 'desktop-chromium') {
    await page.evaluate(() => { IDBObjectStore.prototype.put = () => { throw new DOMException('Full', 'QuotaExceededError'); }; });
    await page.getByRole('button', { name: 'Save local draft' }).click();
    await expect(page.getByRole('alert')).toContainText('export it instead'); await expect(page.locator('.capture-preview img')).toBeVisible();
    expect((await metadata(page)).id).toBe(imported.id);
  } else {
    await page.getByRole('button', { name: 'Save local draft' }).click(); await expect(page.getByText('Draft saved on this device.')).toBeVisible();
    await page.getByRole('button', { name: 'New capture' }).click();
    await page.getByRole('button', { name: /Indoor lobby fixture photo/ }).click();
    await expect(page.getByRole('radio', { name: 'Interior', exact: true })).toBeChecked();
    await expect(page.getByLabel('Room / space (optional)')).toHaveValue('Lobby');
    expect((await metadata(page)).target.point).toEqual(imported.target.point);
  }
});
