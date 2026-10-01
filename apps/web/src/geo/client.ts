import { destinationSchema, neighborhoodSchema, uniqueDestinations, type Destination, type GeoPoint, type Neighborhood } from '@golfworld/shared';
const base = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
export async function geoRequest(path: string, signal?: AbortSignal): Promise<unknown> {
  const response = await fetch(`${base}/api/geo/${path}`, { signal });
  const data: unknown = await response.json();
  if (!response.ok) throw new Error(typeof data === 'object' && data && 'error' in data ? String(data.error) : 'Map service unavailable.');
  return data;
}
export async function searchPlaces(query: string, country: string, signal: AbortSignal): Promise<Destination[]> {
  const data = await geoRequest(`search?${new URLSearchParams({ q: query, country })}`, signal);
  if (!data || typeof data !== 'object' || !('results' in data)) throw new Error('Invalid search response.');
  return uniqueDestinations(destinationSchema.array().parse(data.results).filter((place) => country === 'all' || place.country === country));
}
export async function fetchNeighborhood(point: GeoPoint, signal?: AbortSignal): Promise<Neighborhood> {
  return neighborhoodSchema.parse(await geoRequest(`neighborhood?${new URLSearchParams({ lat: String(point.lat), lon: String(point.lon) })}`, signal));
}
