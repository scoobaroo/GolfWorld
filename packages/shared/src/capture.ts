import { z } from 'zod';
import { geoPointSchema } from './geo';

export const MAX_CAPTURE_BYTES = 25 * 1024 * 1024;
export const MAX_CAPTURE_MS = 20_000;
const nullableNumber = z.number().finite().nullable();
export const captureFixSchema = geoPointSchema.extend({
  accuracyM: z.number().finite().nonnegative(), altitudeM: nullableNumber,
  altitudeAccuracyM: z.number().finite().nonnegative().nullable(),
  timestamp: z.string().datetime(),
});
export const captureOrientationSchema = z.object({
  alphaDeg: nullableNumber, betaDeg: nullableNumber, gammaDeg: nullableNumber,
  absolute: z.boolean(), compassHeadingDeg: nullableNumber, compassAccuracyDeg: nullableNumber,
  screenAngleDeg: z.number().finite(), timestamp: z.string().datetime(),
});
export const captureSampleSchema = z.object({
  offsetMs: z.number().finite().nonnegative(), gps: captureFixSchema.nullable(),
  orientation: captureOrientationSchema.nullable(),
});
export const buildingCaptureSchema = z.object({
  version: z.literal(1), id: z.string().min(1), status: z.literal('local-draft'),
  createdAt: z.string().datetime(), capturedAt: z.string().datetime().nullable(),
  acquisition: z.enum(['live-camera', 'file-picker']),
  target: z.object({ point: geoPointSchema, label: z.string().trim().min(1).max(120), featureId: z.string().nullable(), source: z.enum(['map-pin', 'mapped-building']) }),
  // Older local drafts were exterior-only. Floor/room are contributor labels, not measured coordinates.
  coverage: z.enum(['exterior', 'interior', 'area']).default('exterior'),
  floor: z.string().trim().max(80).default(''), room: z.string().trim().max(120).default(''),
  note: z.string().max(1000),
  media: z.object({ kind: z.enum(['photo', 'video']), mimeType: z.string().min(1), bytes: z.number().int().positive().max(MAX_CAPTURE_BYTES), width: z.number().int().positive(), height: z.number().int().positive(), durationMs: z.number().finite().nonnegative().max(MAX_CAPTURE_MS + 2000).nullable(), facingMode: z.string().nullable() }),
  samples: z.array(captureSampleSchema).max(100),
  // Browser GPS/orientation are observations, not solved/calibrated camera extrinsics.
  cameraPose: z.literal('unresolved'), cameraIntrinsics: z.null(),
}).superRefine((capture, context) => {
  if (capture.acquisition === 'file-picker' && (capture.capturedAt !== null || capture.samples.length)) context.addIssue({ code: 'custom', message: 'Imported media has no observed original camera time or pose.' });
  if (capture.acquisition === 'live-camera' && (!capture.capturedAt || !capture.samples.length)) context.addIssue({ code: 'custom', message: 'Live capture requires a capture time and observation sample.' });
  if (capture.media.kind === 'photo' && capture.media.durationMs !== null || capture.media.kind === 'video' && capture.media.durationMs === null) context.addIssue({ code: 'custom', message: 'Only video has a duration.' });
  let previous = -1;
  for (const sample of capture.samples) {
    if (sample.offsetMs < previous || sample.offsetMs > (capture.media.durationMs ?? 0) + 1) context.addIssue({ code: 'custom', message: 'Samples must be ordered within the capture interval.' });
    previous = sample.offsetMs;
  }
});
export type CaptureFix = z.infer<typeof captureFixSchema>;
export type CaptureOrientation = z.infer<typeof captureOrientationSchema>;
export type CaptureSample = z.infer<typeof captureSampleSchema>;
export type BuildingCapture = z.infer<typeof buildingCaptureSchema>;
