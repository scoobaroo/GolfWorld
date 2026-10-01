import { expect, it } from 'vitest';
import { localToGeo, WINNIPEG, type Neighborhood } from '@golfworld/shared';
import { blockedAt, polygonGeometry, projectFeatures, safeArrival } from './geometry';
it('preserves footprints in meters, keeps courtyards open, and lands outside walls', () => {
  const ring = [[-10, -10], [10, -10], [10, 10], [-10, 10], [-10, -10]].map(([x, z]) => localToGeo(x, z, WINNIPEG));
  const scene: Neighborhood = { origin: WINNIPEG, radius: 350, source: 'OpenStreetMap', fetchedAt: '', truncated: false,
    features: [{ id: 'b', kind: 'building', rings: [ring], holes: [], tags: { building: 'house' }, height: 6, estimatedHeight: true }] };
  const features = projectFeatures(scene); const geometry = polygonGeometry(features[0]); geometry.computeBoundingBox();
  expect(geometry.boundingBox!.max.x - geometry.boundingBox!.min.x).toBeCloseTo(20, 3);
  expect(geometry.boundingBox!.max.z).toBeCloseTo(6, 5); geometry.dispose();
  expect(blockedAt(0, 0, features)).toBe(true);
  const arrival = safeArrival(0, 0, features); expect(blockedAt(...arrival, features)).toBe(false);
  const hole = [[-2, -2], [2, -2], [2, 2], [-2, 2], [-2, -2]] as [number, number][];
  features[0].holes = [hole]; expect(blockedAt(0, 0, features)).toBe(false);
});
