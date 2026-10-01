import { expect, it, vi } from 'vitest';
import { googleDestination } from './google-places';

it('passes only validated UI Kit coordinates and ID into travel without copying place content', () => {
  const place = { id: 'mapped-place', location: { lat: () => 49.9980668, lng: () => -97.0479472 }, displayName: 'Provider title', formattedAddress: 'Provider address' };
  expect(googleDestination(place, 'all')).toEqual({ id: 'google:mapped-place', lat: 49.9980668, lon: -97.0479472,
    name: 'Selected Google location', address: '', country: null, provider: 'google', kind: 'place', precision: 'place' });
  expect(googleDestination(place, 'TW').country).toBe('TW');
  expect(() => googleDestination({ id: 'no-coordinate' }, 'CA')).toThrow();
  expect(() => googleDestination({ id: 'invalid', location: { lat: () => NaN, lng: () => 999 } }, 'CA')).toThrow();
});
it('reports missing configuration before trying to contact Google', async () => {
  vi.stubEnv('VITE_GOOGLE_MAPS_API_KEY', ''); vi.resetModules();
  const { loadGooglePlaces } = await import('./google-places');
  await expect(loadGooglePlaces()).rejects.toThrow('not configured');
  vi.unstubAllEnvs();
});
