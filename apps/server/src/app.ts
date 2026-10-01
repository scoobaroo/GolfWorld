import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { COURSE } from '@golfworld/shared';
import { catalog } from '@golfworld/economy';
import { createGeoRoutes } from './geo/routes';

export const app = new Hono();
app.use('/api/geo/*', cors());
app.get('/health', (context) => context.json({ status: 'ok', mode: 'local-guest', persistence: 'browser' }));
app.get('/api/course', (context) => context.json(COURSE));
app.get('/api/catalog', (context) => context.json(catalog));
app.route('/api/geo', createGeoRoutes());
// TODO: Better Auth cookie sessions before protected API routes.
// TODO: accept score events only from GolfMatchRoom, never client-submitted strokes.
