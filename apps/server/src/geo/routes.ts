import { Hono } from 'hono';
import { geoPointSchema, type Destination, type Neighborhood } from '@golfworld/shared';
import { neighborhoodQuery, parseNeighborhood, parseSearch } from './data';

export function createGeoRoutes(fetcher: typeof fetch = fetch): Hono {
  const routes = new Hono();
  const searches = new Map<string, { time: number; data: Destination[] }>();
  const scenes = new Map<string, { time: number; data: Neighborhood }>();
  let nextSearch = 0; let nextScene = 0; let sceneBusy = false;
  const headers = { 'User-Agent': 'GolfWorld/0.1 (+https://github.com/scoobaroo/GolfWorld)', Accept: 'application/json' };
  routes.get('/search', async (c) => {
    const query = c.req.query('q')?.trim() ?? '';
    if (query.length < 3 || query.length > 180) return c.json({ error: 'Enter an address or place name between 3 and 180 characters.' }, 400);
    const country = c.req.query('country') ?? 'all';
    if (!['all', 'US', 'CA', 'TW'].includes(country)) return c.json({ error: 'Choose USA, Canada, or Taiwan.' }, 400);
    const key = `${country}:${query.toLocaleLowerCase()}`; const cached = searches.get(key);
    if (cached && Date.now() - cached.time < 3600000) return c.json({ results: cached.data, source: 'OpenStreetMap / Photon' });
    if (Date.now() < nextSearch) return c.json({ error: 'Please wait a moment before searching again.' }, 429);
    nextSearch = Date.now() + 1100;
    try {
      const url = new URL(process.env.GEOCODER_URL ?? 'https://photon.komoot.io/api/');
      url.searchParams.set('q', query); url.searchParams.set('limit', '12');
      for (const code of country === 'all' ? ['US', 'CA', 'TW'] : [country]) url.searchParams.append('countrycode', code);
      const response = await fetcher(url, { headers, signal: AbortSignal.timeout(12000) });
      if (!response.ok) throw new Error('Search provider unavailable');
      const results = parseSearch(await response.json());
      if (searches.size >= 100) searches.delete(searches.keys().next().value!);
      searches.set(key, { time: Date.now(), data: results });
      return c.json({ results, source: 'OpenStreetMap / Photon' });
    } catch { return c.json({ error: 'Location search is unavailable. Try again shortly.' }, 502); }
  });
  routes.get('/neighborhood', async (c) => {
    const lat = c.req.query('lat'); const lon = c.req.query('lon');
    const parsed = geoPointSchema.safeParse({ lat: lat ? Number(lat) : NaN, lon: lon ? Number(lon) : NaN });
    if (!parsed.success) return c.json({ error: 'Invalid latitude or longitude.' }, 400);
    const key = `${parsed.data.lat.toFixed(5)},${parsed.data.lon.toFixed(5)}`; const cached = scenes.get(key);
    if (cached && Date.now() - cached.time < 86400000) return c.json(cached.data);
    if (sceneBusy || Date.now() < nextScene) return c.json({ error: 'The map data service is busy. Wait a few seconds and retry.' }, 429);
    sceneBusy = true; nextScene = Date.now() + 5000;
    try {
      const response = await fetcher(process.env.GEODATA_URL ?? 'https://overpass-api.de/api/interpreter', {
        method: 'POST', headers: { ...headers, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ data: neighborhoodQuery(parsed.data) }), signal: AbortSignal.timeout(28000),
      });
      if (!response.ok) throw new Error('World data unavailable');
      const scene = parseNeighborhood(await response.json(), parsed.data);
      if (scenes.size >= 24) scenes.delete(scenes.keys().next().value!);
      scenes.set(key, { time: Date.now(), data: scene }); return c.json(scene);
    } catch { return c.json({ error: 'Neighborhood data could not load. Your current world is unchanged; retry the location.' }, 502); }
    finally { sceneBusy = false; }
  });
  return routes;
}
