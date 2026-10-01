import { expect, it } from 'vitest';
import { WINNIPEG } from '@golfworld/shared';
import { addressSearchQuery, buildingHeight, neighborhoodQuery, parseNeighborhood, parseSearch } from './data';
import { createGeoRoutes } from './routes';

const ring = [{ lat: 49.895, lon: -97.138 }, { lat: 49.895, lon: -97.1379 }, { lat: 49.8951, lon: -97.1379 }, { lat: 49.8951, lon: -97.138 }, { lat: 49.895, lon: -97.138 }];
it('keeps footprints, arbitrary building types, relation courtyards and measured heights', () => {
  const scene = parseNeighborhood({ elements: [
    { type: 'way', id: 1, tags: { building: 'temple', height: '40 ft' }, geometry: ring },
    { type: 'relation', id: 2, tags: { building: 'hospital', type: 'multipolygon', 'building:levels': '4' }, members: [
      { type: 'way', ref: 3, role: 'outer', geometry: ring.slice(0, 3) }, { type: 'way', ref: 4, role: 'outer', geometry: ring.slice(2) },
      { type: 'way', ref: 5, role: 'inner', geometry: ring },
    ] },
    { type: 'way', id: 6, tags: { golf: 'hole' }, geometry: ring.slice(0, 2) },
  ] }, WINNIPEG);
  expect(scene.features.find((f) => f.id === 'way:1')).toMatchObject({ height: 12.192, estimatedHeight: false, rings: [ring], tags: { building: 'temple' } });
  expect(scene.features.find((f) => f.id === 'relation:2')).toMatchObject({ height: 12, estimatedHeight: true, rings: [ring], holes: [ring] });
  expect(scene.features.find((f) => f.id === 'way:6')?.kind).toBe('road');
  expect(buildingHeight({ building: 'house' })).toEqual({ height: 3, estimatedHeight: true });
  expect(buildingHeight({ building: 'office', height: '508' })).toEqual({ height: 508, estimatedHeight: false });
  expect(() => parseNeighborhood({ remark: 'runtime error', elements: [] }, WINNIPEG)).toThrow('incomplete');
  expect(neighborhoodQuery(WINNIPEG)).toContain('way[building]');
});
it('filters search countries and distinguishes a street result from an address', () => {
  const item = (code: string, house = ''): unknown => ({ geometry: { coordinates: [121.5654, 25.033] }, properties: { countrycode: code, country: 'Taiwan', name: '台北101', street: '信義路', housenumber: house, type: 'street', osm_type: 'W', osm_id: 1 } });
  expect(parseSearch({ features: [item('TW', '7'), item('DE')] })).toMatchObject([{ country: 'TW', precision: 'address', name: '台北101' }]);
  expect(parseSearch({ features: [item('TW')] })[0].precision).toBe('street');
});
it('formats Taiwanese street numbers and tokenizes unspaced Traditional Chinese addresses', () => {
  expect(addressSearchQuery('台北市信義區信義路五段７號', 'TW')).toBe('台北市 信義區 信義路五段 7');
  expect(addressSearchQuery('新北市板橋區文化路二段182巷3弄7之1號', 'all')).toBe('新北市 板橋區 文化路二段182巷3弄 7之1');
  expect(addressSearchQuery('市府路45號', 'TW')).toBe('市府路 45');
  expect(addressSearchQuery('333 Main Street Winnipeg', 'CA')).toBe('333 Main Street Winnipeg');
  expect(addressSearchQuery('台北101', 'TW')).toBe('台北101');
  const item = { geometry: { coordinates: [121.5644995, 25.0338352] }, properties: { countrycode: 'TW', name: '台北101', city: '台北市', district: '信義區', country: '臺灣', street: '信義路五段', housenumber: '7', osm_type: 'W', osm_id: 1 } };
  expect(parseSearch({ features: [item, { ...item, properties: { ...item.properties, osm_id: 2 } }] })).toMatchObject([{ address: '台北市, 信義區, 信義路五段7號, 臺灣', precision: 'address' }]);
});
it('keeps the selected country filter and sends the normalized Taiwan address to the provider', async () => {
  let requested = '';
  const routes = createGeoRoutes(async (input) => {
    requested = String(input);
    return Response.json({ features: ['CA', 'TW'].map((countrycode, osm_id) => ({ geometry: { coordinates: [121.5654, 25.033] }, properties: { countrycode, name: 'Match', osm_id } })) });
  });
  const response = await routes.request(`/search?${new URLSearchParams({ q: '台北市信義區信義路五段7號', country: 'TW' })}`);
  expect(response.status).toBe(200); expect(new URL(requested).searchParams.get('q')).toBe('台北市 信義區 信義路五段 7');
  expect(await response.json()).toMatchObject({ results: [{ country: 'TW' }] });
});
it('validates API input, limits calls, caches matches, and keeps provider URLs server controlled', async () => {
  let calls = 0; let requested = '';
  const routes = createGeoRoutes(async (input) => {
    calls++; requested = String(input);
    return Response.json({ features: [{ geometry: { coordinates: [-97.1384, 49.8951] }, properties: { countrycode: 'CA', name: 'Winnipeg', osm_type: 'R', osm_id: 1 } }] });
  });
  expect((await routes.request('/search?q=x')).status).toBe(400);
  expect((await routes.request('/search?q=Winnipeg&country=DE')).status).toBe(400);
  expect((await routes.request('/neighborhood?lat=NaN&lon=1')).status).toBe(400);
  expect((await routes.request('/search?q=Winnipeg')).status).toBe(200);
  const url = new URL(requested); expect(url.searchParams.getAll('countrycode')).toEqual(['US', 'CA', 'TW']);
  expect((await routes.request('/search?q=Winnipeg')).status).toBe(200); expect(calls).toBe(1);
  expect((await routes.request('/search?q=Toronto')).status).toBe(429);
});
it('reports provider failure without inventing a neighborhood', async () => {
  const routes = createGeoRoutes(async () => new Response('unavailable', { status: 503 }));
  expect((await routes.request('/neighborhood?lat=49.8951&lon=-97.1384')).status).toBe(502);
});
