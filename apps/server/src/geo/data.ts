import { z } from 'zod';
import { geoPointSchema, geoToLocal, localToGeo, uniqueDestinations, type Destination, type GeoFeature, type GeoPoint, type Neighborhood } from '@golfworld/shared';

const coordinate = geoPointSchema;
const elementSchema = z.object({
  type: z.enum(['node', 'way', 'relation']), id: z.number(), tags: z.record(z.string(), z.string()).default({}),
  lat: z.number().optional(), lon: z.number().optional(), geometry: z.array(coordinate).optional(),
  members: z.array(z.object({ type: z.string(), ref: z.number(), role: z.string(), geometry: z.array(coordinate).optional() })).optional(),
});
const overpassSchema = z.object({ elements: z.array(elementSchema), remark: z.string().optional() });
const photonSchema = z.object({ features: z.array(z.object({
  geometry: z.object({ coordinates: z.tuple([z.number(), z.number()]) }),
  properties: z.record(z.string(), z.unknown()),
})) });

export function parseSearch(data: unknown): Destination[] {
  return uniqueDestinations(photonSchema.parse(data).features.flatMap(({ geometry, properties: p }) => {
    const text = (key: string): string => typeof p[key] === 'string' ? (p[key] as string).trim() : '';
    const country = text('countrycode').toUpperCase();
    const point = geoPointSchema.safeParse({ lat: geometry.coordinates[1], lon: geometry.coordinates[0] });
    if (!point.success || !['US', 'CA', 'TW'].includes(country)) return [];
    const house = text('housenumber');
    const street = country === 'TW' ? `${text('street')}${house ? /號$/.test(house) ? house : `${house}號` : ''}` : [house, text('street')].filter(Boolean).join(' ');
    const parts = country === 'TW' ? [text('state'), text('city'), text('district'), street, text('postcode'), text('country')] : [street, text('city') || text('district'), text('state'), text('postcode'), text('country')];
    const address = [...new Map(parts.filter(Boolean).map((value) => [value.replaceAll('臺', '台'), value])).values()].join(', ');
    return [{ ...point.data, id: `${p.osm_type ?? 'place'}:${p.osm_id ?? `${point.data.lat},${point.data.lon}`}`,
      name: text('name').split(';')[0] || street || address || 'Map location', address, country: country as Destination['country'],
      kind: text('osm_value') || text('type') || 'place', precision: text('housenumber') ? 'address' : text('type') === 'street' ? 'street' : 'place' } as Destination];
  }));
}
export function addressSearchQuery(query: string, country: string): string {
  const text = query.normalize('NFKC').trim();
  if (!['TW', 'all'].includes(country) || !/\p{Script=Han}/u.test(text) || !/\d+(?:[之-]\d+)?號/.test(text)) return text;
  // Photon needs word boundaries for commonly pasted, unspaced Taiwanese addresses.
  return text.replace(/^([\p{Script=Han}]{2,5}[縣市])(?=\S)/u, '$1 ')
    .replace(/^((?:[\p{Script=Han}]{2,5}[縣市]\s+)?[\p{Script=Han}]{1,5}[區鄉鎮])(?=\S)/u, '$1 ')
    .replace(/([路街](?:[一二三四五六七八九十百零〇\d]+段)?(?:\d+巷)?(?:\d+弄)?)(?=\d)/gu, '$1 ')
    .replace(/(\d+(?:[之-]\d+)?)號/gu, '$1').replace(/\s+/g, ' ').trim();
}
const same = (a: GeoPoint, b: GeoPoint): boolean => Math.abs(a.lat - b.lat) + Math.abs(a.lon - b.lon) < 1e-7;
function joinRings(parts: GeoPoint[][]): GeoPoint[][] {
  const pending = parts.map((part) => [...part]); const rings: GeoPoint[][] = [];
  while (pending.length) {
    let ring = pending.shift()!; let changed = true;
    while (!same(ring[0], ring[ring.length - 1]) && changed) {
      changed = false;
      for (let i = 0; i < pending.length; i++) {
        const next = pending[i]; const end = ring[ring.length - 1];
        if (same(end, next[0]) || same(end, next[next.length - 1])) {
          if (!same(end, next[0])) next.reverse();
          ring = [...ring, ...next.slice(1)]; pending.splice(i, 1); changed = true; break;
        }
      }
    }
    if (ring.length >= 4 && same(ring[0], ring[ring.length - 1])) rings.push(ring);
  }
  return rings;
}
export function buildingHeight(tags: Record<string, string>): { height: number; estimatedHeight: boolean } {
  const measured = tags.height?.match(/^\s*([\d.]+)\s*(m|ft|feet)?\s*$/);
  const meters = measured ? Number(measured[1]) * (measured[2] === 'ft' || measured[2] === 'feet' ? 0.3048 : 1) : NaN;
  if (Number.isFinite(meters) && meters > 0) return { height: Math.min(1200, meters), estimatedHeight: meters > 1200 };
  const levels = Number(tags['building:levels']);
  const fallback = ['garage', 'garages', 'shed', 'house', 'detached', 'farm_auxiliary'].includes(tags.building) ? 3 : 9;
  return { height: Math.max(1, Math.min(1200, levels > 0 ? levels * 3 + (Number(tags['roof:height']) || 0) : fallback)), estimatedHeight: true };
}
export function parseNeighborhood(data: unknown, origin: GeoPoint): Neighborhood {
  const parsed = overpassSchema.parse(data);
  if (parsed.remark) throw new Error('The map provider returned an incomplete neighborhood. Try again later.');
  const elements = parsed.elements;
  const relationWays = new Set(elements.filter((e) => e.type === 'relation').flatMap((e) => e.members?.filter((m) => m.type === 'way').map((m) => m.ref) ?? []));
  const features: GeoFeature[] = [];
  for (const element of elements) {
    const tags = element.tags; let rings: GeoPoint[][] = []; let holes: GeoPoint[][] = [];
    if (element.type === 'way' && relationWays.has(element.id) && (tags.building || tags['building:part'])) continue;
    if (element.type === 'relation') {
      rings = joinRings(element.members?.filter((m) => m.role === 'outer' || m.role === '').flatMap((m) => m.geometry ? [m.geometry] : []) ?? []);
      holes = joinRings(element.members?.filter((m) => m.role === 'inner').flatMap((m) => m.geometry ? [m.geometry] : []) ?? []);
    } else if (element.geometry?.length) rings = [element.geometry];
    else if (element.lat !== undefined && element.lon !== undefined) rings = [[{ lat: element.lat, lon: element.lon }]];
    if (!rings.length || rings.reduce((n, ring) => n + ring.length, 0) > 8000) continue;
    const kind = tags.building || tags['building:part'] ? 'building' : tags.highway || tags.golf === 'hole' ? 'road' : element.type === 'node' ? 'poi' : 'area';
    if ((kind === 'building' || kind === 'area') && (rings[0].length < 4 || !same(rings[0][0], rings[0][rings[0].length - 1]))) continue;
    features.push({ id: `${element.type}:${element.id}`, kind, rings, holes, tags,
      ...(kind === 'building' ? buildingHeight(tags) : { height: 0, estimatedHeight: false }) });
  }
  features.sort((a, b) => {
    const distance = (feature: GeoFeature): number => { const p = geoToLocal(feature.rings[0][0], origin); return Math.hypot(p[0], p[2]); };
    return distance(a) - distance(b);
  });
  return { origin, radius: 350, features: features.slice(0, 1000), fetchedAt: new Date().toISOString(), truncated: features.length > 1000, source: 'OpenStreetMap' };
}
export function neighborhoodQuery(origin: GeoPoint): string {
  const southWest = localToGeo(-350, 350, origin); const northEast = localToGeo(350, -350, origin);
  const bbox = `${southWest.lat},${southWest.lon},${northEast.lat},${northEast.lon}`;
  return `[out:json][timeout:20][maxsize:16777216];(way[building](${bbox});relation[building][type=multipolygon](${bbox});way["building:part"](${bbox});way[highway](${bbox});way[landuse](${bbox});way[natural~"water|wood"](${bbox});relation[natural=water][type=multipolygon](${bbox});way[leisure~"golf_course|park|pitch"](${bbox});relation[leisure=golf_course](${bbox});way[golf](${bbox});node[golf](${bbox});node[amenity](${bbox});node[shop](${bbox});node[natural=tree](${bbox}););out geom;`;
}
