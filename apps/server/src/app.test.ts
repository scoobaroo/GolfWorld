import { it, expect } from 'vitest';
import { app } from './app';
it('serves guests without Postgres and exposes the course and catalog', async () => {
  const response = await app.request('/health');
  expect(await response.json()).toMatchObject({ status: 'ok', mode: 'local-guest' });
  expect((await app.request('/api/course')).status).toBe(200);
  expect((await app.request('/api/catalog')).status).toBe(200);
});
it('does not accept client-asserted scores or grants', async () => {
  expect((await app.request('/api/scores', { method: 'POST', body: JSON.stringify({ strokes: 1 }) })).status).toBe(404);
  expect((await app.request('/api/grant', { method: 'POST' })).status).toBe(404);
});
