import { z } from 'zod';

export const geoPointSchema = z.object({ lat: z.number().finite().min(-85).max(85), lon: z.number().finite().min(-180).max(180) });
export type GeoPoint = z.infer<typeof geoPointSchema>;
export const destinationSchema = geoPointSchema.extend({
  id: z.string(), name: z.string(), address: z.string(), country: z.enum(['US', 'CA', 'TW']),
  kind: z.string(), precision: z.enum(['address', 'street', 'place']),
});
export type Destination = z.infer<typeof destinationSchema>;
export const geoFeatureSchema = z.object({
  id: z.string(), kind: z.enum(['building', 'road', 'area', 'poi']),
  rings: z.array(z.array(geoPointSchema)), holes: z.array(z.array(geoPointSchema)).default([]),
  tags: z.record(z.string(), z.string()), height: z.number().nonnegative(), estimatedHeight: z.boolean(),
});
export type GeoFeature = z.infer<typeof geoFeatureSchema>;
export const neighborhoodSchema = z.object({
  origin: geoPointSchema, radius: z.number().positive(), features: z.array(geoFeatureSchema).max(1000),
  fetchedAt: z.string(), truncated: z.boolean(), source: z.literal('OpenStreetMap'),
});
export type Neighborhood = z.infer<typeof neighborhoodSchema>;
export const WINNIPEG: GeoPoint = { lat: 49.8951, lon: -97.1384 };

// WGS84 Earth-centred coordinates -> a local east/up/north meter frame.
// R3F uses +X east, +Y up, -Z north. Never scale Web Mercator pixels into physics.
const A = 6378137;
const E2 = 6.69437999014e-3;
const RAD = Math.PI / 180;
function ecef(point: GeoPoint): [number, number, number] {
  const lat = point.lat * RAD; const lon = point.lon * RAD;
  const n = A / Math.sqrt(1 - E2 * Math.sin(lat) ** 2);
  return [n * Math.cos(lat) * Math.cos(lon), n * Math.cos(lat) * Math.sin(lon), n * (1 - E2) * Math.sin(lat)];
}
export function geoToLocal(point: GeoPoint, origin: GeoPoint): [number, number, number] {
  const target = ecef(point); const base = ecef(origin);
  const [dx, dy, dz] = target.map((value, i) => value - base[i]);
  const lat = origin.lat * RAD; const lon = origin.lon * RAD;
  const east = -Math.sin(lon) * dx + Math.cos(lon) * dy;
  const north = -Math.sin(lat) * Math.cos(lon) * dx - Math.sin(lat) * Math.sin(lon) * dy + Math.cos(lat) * dz;
  return [east, 0, -north];
}
export function localToGeo(x: number, z: number, origin: GeoPoint): GeoPoint {
  const lat = origin.lat * RAD; const lon = origin.lon * RAD; const base = ecef(origin);
  const north = -z;
  const px = base[0] - Math.sin(lon) * x - Math.sin(lat) * Math.cos(lon) * north;
  const py = base[1] + Math.cos(lon) * x - Math.sin(lat) * Math.sin(lon) * north;
  const pz = base[2] + Math.cos(lat) * north;
  const p = Math.hypot(px, py); let latitude = Math.atan2(pz, p * (1 - E2));
  for (let i = 0; i < 6; i++) {
    const n = A / Math.sqrt(1 - E2 * Math.sin(latitude) ** 2);
    latitude = Math.atan2(pz + E2 * n * Math.sin(latitude), p);
  }
  return { lat: latitude / RAD, lon: Math.atan2(py, px) / RAD };
}
export function mapPixel(point: GeoPoint, zoom: number): [number, number] {
  const size = 256 * 2 ** zoom; const lat = Math.max(-85, Math.min(85, point.lat)) * RAD;
  return [(point.lon + 180) / 360 * size, (1 - Math.asinh(Math.tan(lat)) / Math.PI) / 2 * size];
}
export function pixelToGeo(x: number, y: number, zoom: number): GeoPoint {
  const size = 256 * 2 ** zoom;
  return { lon: ((x / size * 360) % 360 + 360) % 360 - 180, lat: Math.atan(Math.sinh(Math.PI * (1 - 2 * Math.max(0, Math.min(size, y)) / size))) / RAD };
}
export function pointInRing(x: number, z: number, ring: readonly (readonly number[])[]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, zi] = ring[i]; const [xj, zj] = ring[j];
    if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}
