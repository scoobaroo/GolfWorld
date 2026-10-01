# Interior, exterior and area contributions — local capture and Grok review

September 30, 2026. The user selected **local capture drafts** as the first
version. This extends the existing browser/PWA and R3F map; no new renderer,
service, reconstruction framework, or upload destination is introduced.

## Implemented local slice

Phone → Capture, Map → Capture building or area, or a mapped building's
Capture details button. Choose Exterior / Interior / Area. Interior captures
include optional floor/level and room/space labels. Choose/correct the place pin using the map center,
name it, enable the camera and optional direction sensor,
then take a photo or record a silent video of up to 20 seconds. Review the
media and metadata before saving locally. Add photo/video also opens a native
camera/file picker, which is useful when a browser lacks live recording.

IndexedDB keeps media as binary buffers and versioned shared Zod records independently of
the existing profile/furniture/scores save. Limits: 25 MB per capture, 30
drafts, 100 MB total. Quota failures preserve the review preview for export.
Open/review/edit/remove saved drafts, download media and JSON separately, and
see purple local draft pins on the global map. Drafts remain on this browser's
device and can be lost if site data is cleared. There are no upload/API calls
for captures. The existing basemap still fetches visible map tiles; choosing
View GPS area changes that map view, but GPS samples/media are not uploaded.

Users can collect multiple drafts for one place: facades/rooflines outside,
rooms/doors/finishes inside, and surrounding paths/grounds. Category, floor,
room and detail notes persist with every draft and appear in JSON exports.
These are evidence contributions, not automatic geometry or live world edits.

## Coordinate and camera semantics

- A **building target** is the chosen map pin or linked OSM footprint ID. It
  is independent of the photographer's device position and can represent a
  missing building without an OSM ID. Interior evidence uses this building/area
  anchor plus contributor floor/room labels. GPS can be weak or absent indoors;
  labels do not imply measured indoor coordinates, floor height or room layout.
- A **camera observation** stores WGS84 device latitude/longitude, reported
  horizontal accuracy, available altitude/altitude accuracy, and fix time.
  GPS fixes older than 15 seconds are excluded from a new sample. Device GPS
  never comes from the teleported avatar. Proximity is a displayed estimate,
  not proof that a contributor was physically at a site.
- Device orientation is retained as raw alpha/beta/gamma, absolute/relative
  flag, screen angle and available WebKit compass readings with timestamps.
  Stale direction readings (>2 seconds) are unknown. These are device-frame
  sensor readings, not a fabricated optical camera transform. Intrinsics and
  calibrated 6-DoF camera pose remain explicitly unresolved.
- Photos have a capture-time sample. Video stores observations every 500 ms,
  with monotonic offsets from its recording start plus start/end samples.
  This is not per-frame tracking. Live photos are JPEG, up to 1600 pixels wide;
  camera facing mode is recorded when the browser reports it. Live video picks
  a supported MP4/WebM codec, records no microphone audio and stops at 20 s.
- Added files may be old media or a native camera result; their original
  capture time/GPS/orientation are unknown. The app does not apply today's GPS
  or the avatar position to those files. EXIF extraction is not implemented.

Camera/GPS/orientation need HTTPS on a physical phone; localhost works for
desktop development. HTTP LAN URLs cannot supply live camera/GPS. Permission
denials and absent sensors are shown without inventing values.
GPS permission is requested once when the world becomes ready and remains a
shared foreground session across phone pages/captures. Phone → Settings can
turn GPS off; that preference is remembered. Denial does not trigger repeated
requests. Backgrounding or leaving the world pauses GPS; returning resumes a
previously active session. Closing the phone or leaving Capture stops its
camera and direction listeners while foreground-world GPS remains available.
Tests use synthetic camera/sensor fixtures, not real device access.
Physical iPhone/Android hardware accuracy and optical calibration still need
field testing.

Sources: [secure browser APIs](https://developer.mozilla.org/en-US/docs/Web/Security/Defenses/Secure_Contexts/features_restricted_to_secure_contexts),
[geolocation measurements](https://www.w3.org/TR/geolocation/),
[device orientation frames](https://www.w3.org/TR/orientation-event/),
[recording format detection](https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder/isTypeSupported_static).

## Shared publishing: stop here for user/Grok architecture review

Per the user's instruction to review ambiguous architecture, no shared upload
or automatic building-generation pipeline is invented in this session. Decide:

1. Authenticated ownership, upload/object-storage provider, size budgets,
   retention, deletion, and rights to publish contributed imagery.
2. Review/deduplication process, face/plate handling, location evidence and
   geometry accuracy thresholds before a draft becomes public world data.
3. Reconstruction approach and worker budget: multiple overlapping views,
   georeferenced/calibrated camera poses, scale validation, facade/roof/footprint
   edits, interior room/floor alignment, surrounding-area geometry, and mobile
   asset budgets. A single photo cannot describe unseen sides or hidden rooms.
4. Authoritative building records in the existing shared/Drizzle/Hono ports,
   source/provenance/versioning and how approved additions coexist with OSM.

Next prompt: "Read agents.md and docs/building-capture-review.md. Keep the
existing PWA and local capture draft format. Design the authenticated
contribution ingestion/review and approved-building record model, identify
the provider and reconstruction decisions requiring product review, and keep
the golf slice playable. Do not introduce a second world renderer or silently
publish local drafts."
