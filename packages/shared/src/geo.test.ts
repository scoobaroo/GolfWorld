import { describe, expect, it } from 'vitest';
import { geoToLocal, localToGeo, mapPixel, pixelToGeo, WINNIPEG } from './geo';
describe('real-world coordinate scale', () => {
  for (const origin of [WINNIPEG, { lat: 37.422, lon: -122.084 }, { lat: 25.033, lon: 121.5654 }]) {
    it(`round trips meter offsets at ${origin.lat}`, () => {
      const east = localToGeo(100, 0, origin); const north = localToGeo(0, -100, origin);
      expect(east.lon).toBeGreaterThan(origin.lon); expect(north.lat).toBeGreaterThan(origin.lat);
      const [x, , z] = geoToLocal(localToGeo(250, -200, origin), origin);
      expect(x).toBeCloseTo(250, 3); expect(z).toBeCloseTo(-200, 3);
      for (const value of geoToLocal(origin, origin)) expect(Math.abs(value)).toBe(0);
      const [px, py] = mapPixel(origin, 17); const map = pixelToGeo(px, py, 17);
      expect(map.lat).toBeCloseTo(origin.lat, 8); expect(map.lon).toBeCloseTo(origin.lon, 8);
    });
  }
  it('does not confuse Mercator map distortion with physics meters', () => {
    expect(geoToLocal({ lat: 0, lon: 0.00000898315284 }, { lat: 0, lon: 0 })[0]).toBeCloseTo(1, 6);
    const [equator] = mapPixel(localToGeo(100, 0, { lat: 0, lon: 0 }), 17);
    const [equatorOrigin] = mapPixel({ lat: 0, lon: 0 }, 17);
    const [north] = mapPixel(localToGeo(100, 0, WINNIPEG), 17); const [northOrigin] = mapPixel(WINNIPEG, 17);
    expect(north - northOrigin).toBeGreaterThan(equator - equatorOrigin);
  });
});
