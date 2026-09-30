import { serve } from '@hono/node-server';
import { app } from './app';

const port = Number(process.env.PORT ?? 3001);
serve({ fetch: app.fetch, port, hostname: '0.0.0.0' });
console.log(`GolfWorld guest API ready at http://localhost:${port}`);
