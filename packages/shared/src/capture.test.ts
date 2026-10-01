import { describe, expect, it } from 'vitest';
import { buildingCaptureSchema, type BuildingCapture } from './capture';
const capture: BuildingCapture = {
  version: 1, id: 'draft', status: 'local-draft', createdAt: '2026-09-30T12:00:00.000Z', capturedAt: '2026-09-30T12:00:00.000Z', acquisition: 'live-camera',
  target: { point: { lat: 49.8951, lon: -97.1384 }, label: 'Facade', source: 'map-pin', featureId: null }, coverage: 'exterior', floor: '', room: '', note: '',
  media: { kind: 'photo', mimeType: 'image/jpeg', bytes: 1024, width: 1280, height: 720, facingMode: 'environment', durationMs: null },
  samples: [{ offsetMs: 0, gps: { lat: 49.895, lon: -97.1385, accuracyM: 12, altitudeM: null, altitudeAccuracyM: null, timestamp: '2026-09-30T12:00:00.000Z' }, orientation: null }], cameraPose: 'unresolved', cameraIntrinsics: null,
};
describe('building evidence contract', () => {
  it('retains separate camera/building positions and unknown sensor values', () => {
    const parsed = buildingCaptureSchema.parse(capture);
    expect(parsed.samples[0].gps?.lat).not.toBe(parsed.target.point.lat); expect(parsed.samples[0].orientation).toBeNull();
  });
  it('cannot claim imported media was observed by current sensors', () => {
    expect(buildingCaptureSchema.safeParse({ ...capture, acquisition: 'file-picker' }).success).toBe(false);
    expect(buildingCaptureSchema.safeParse({ ...capture, acquisition: 'file-picker', capturedAt: null, samples: [] }).success).toBe(true);
  });
  it('anchors indoor evidence to a place without inventing indoor coordinates', () => {
    const indoor = buildingCaptureSchema.parse({ ...capture, coverage: 'interior', floor: '2', room: 'Lobby', samples: [{ offsetMs: 0, gps: null, orientation: null }] });
    expect(indoor).toMatchObject({ coverage: 'interior', floor: '2', room: 'Lobby', cameraPose: 'unresolved' });
    const olderDraft = { ...capture, coverage: undefined, floor: undefined, room: undefined };
    expect(buildingCaptureSchema.parse(olderDraft)).toMatchObject({ coverage: 'exterior', floor: '', room: '' });
  });
  it('rejects invented solved pose, invalid GPS accuracy, and oversized media', () => {
    expect(buildingCaptureSchema.safeParse({ ...capture, cameraPose: 'solved' }).success).toBe(false);
    expect(buildingCaptureSchema.safeParse({ ...capture, samples: [{ ...capture.samples[0], gps: { ...capture.samples[0].gps, accuracyM: -1 } }] }).success).toBe(false);
    expect(buildingCaptureSchema.safeParse({ ...capture, media: { ...capture.media, bytes: 30 * 1024 * 1024 } }).success).toBe(false);
  });
  it('requires ordered observations aligned with the video interval', () => {
    const video = { ...capture, media: { ...capture.media, kind: 'video', mimeType: 'video/mp4', durationMs: 1000 }, samples: [{ ...capture.samples[0], offsetMs: 0 }, { ...capture.samples[0], offsetMs: 1000 }] };
    expect(buildingCaptureSchema.safeParse(video).success).toBe(true);
    expect(buildingCaptureSchema.safeParse({ ...video, samples: [...video.samples].reverse() }).success).toBe(false);
    expect(buildingCaptureSchema.safeParse({ ...video, media: { ...video.media, durationMs: 500 } }).success).toBe(false);
  });
});
