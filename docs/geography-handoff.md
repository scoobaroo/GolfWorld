# Real-world search and travel — implementation and Grok handoff

September 30, 2026: the user explicitly requested implementation before Grok
review. This supersedes the earlier instruction to stop this geography work
at a proposal. GolfWorld remains a browser/PWA using the existing R3F, Three,
Rapier, Zustand, Hono, and shared Zod stack. No native app or second world
renderer was added. No paid service was purchased.

## What works

Global map in the HUD and Phone → Map: type a street address, city/landmark,
or golf course; filter USA, Canada, or Taiwan; choose a named/addressed dropdown
suggestion to travel. Suggestions show source-based icons and labels for homes,
apartments, offices, shops, food, healthcare, education, landmarks, industry,
golf courses and generic locations. Unknown types use a neutral pin. Tap/click
or use up/down and Enter; Escape dismisses the dropdown before closing the
phone. Search also submits explicitly. Chinese input composition is preserved
and does not issue searches until composition finishes.
Pan the map with mouse/touch, use zoom buttons, World, My avatar, region
shortcuts, and the larger map. The blue marker is the avatar's in-world
position, not the device's GPS position. The fictional Meadow practice slice
is labeled and never presented as a real address.

Travel requests a 700 × 700 meter neighborhood. Known OSM footprints and
arbitrary building/use tags are retained, including multipolygon courtyards.
Buildings are extruded from those footprints; roads, footpaths, mapped golf
course/green/bunker/hole shapes, land use, parks, water, and mapped trees are
rendered. Tap/click a building to inspect its source type, address, and height.
Geometry is batched by kind/material and trees are instanced.
Height tags in meters or feet are used when present; levels/default heights
are estimates and the HUD reports them. Roof detail, facade imagery,
interiors, real terrain elevation, bridges and stacked levels are not built.
These are sourced blockouts, not photoreal replicas.

The WGS84 ellipsoid maps each neighborhood into an east/up/north local frame:
R3F +X east, +Y up, -Z north; one unit is one meter. Web Mercator is used only
for the 2D map. Geographic position survives rebasing into the next
neighborhood, with no world-scale Mercator distortion. Source survey/geocode
accuracy still limits real-world accuracy; coordinate scale does not imply
every source is exact. Terrain is flat in this pass.

Arrival finds nearby outdoor ground/road when the result lies inside a mapped
building or water polygon. Walking avoids these footprints. A selected
destination pin can therefore differ from the avatar's safe arrival point.
Last destination/position restore locally on reload; explicitly returning to
the practice areas disables that restore. Old profile/furniture/score saves
are unchanged. Failed travel keeps the previous world. The HUD offers
**Load next neighborhood** near the edge; the current region is bounded until
the user requests more data. No automatic worldwide crawl or offline map
prefetch runs. Real mapped courses can be visited; playable golf remains the
Meadow Run slice.

## Providers and running locally

Run `pnpm dev` from the repo root (web 5173, API 3001). Copy `.env.example`
to `.env` if customization is needed; Vite and the server load the root file.
An empty `VITE_API_URL` uses `/api` on the same origin, proxied to 3001 in dev.
This works from another phone on the same LAN without pointing that phone's
API requests at its own localhost. Production hosting must route `/api` to
Hono or set an explicit API URL.

- `GEOCODER_URL`: Photon-compatible search endpoint. Local default is
  `https://photon.komoot.io/api/`. Country filters are sent to the provider and
  results are validated/filtered again. Suggestions require at least three
  characters and a 1.2-second typing pause; explicit Search bypasses that pause.
  The client spaces outbound requests at least 1.15 seconds apart, cancels old
  queries, ignores stale responses and caches up to 20 results during the map
  session. The server allows one outbound search per 1.1 seconds and maintains
  a bounded result cache. No search-history persistence or device-location permission.
- `GEODATA_URL`: Overpass-compatible interpreter endpoint. Local default is
  `https://overpass-api.de/api/interpreter`. Numeric bounded queries only,
  one request at a time, five-second minimum spacing, 20-second query budget,
  28-second fetch timeout, 24 bounded scene cache entries. At most 1,000
  features are sent; dense-region truncation is disclosed in the HUD.
- `VITE_MAP_TILE_URL`: raster XYZ template. Local default is OSM's standard
  map. Load visible tiles directly with browser caching and attribution;
  the service worker does not prefetch or cache third-party basemap tiles.

[Photon](https://github.com/komoot/photon#demo-server) welcomes reasonable
demo API usage but offers no availability guarantee. The
[Overpass operator](https://dev.overpass-api.de/overpass-doc/en/preface/commons.html)
specifically says relying on the public service as a general app backend is
unsustainable. These defaults are for local evaluation. Before public launch,
use dedicated/hosted compatible search and world-data infrastructure, an
imported regional dataset, and distributed quotas/caching. Configure tile
hosting to the expected load. Respect the
[tile policy](https://operations.osmfoundation.org/policies/tiles/) and retain
[OSM attribution/source obligations](https://www.openstreetmap.org/copyright).

No provider guarantees every street address, building footprint/type/height,
or golf course in these regions. Missing data is not replaced with invented
addresses or fabricated geographic buildings. An empty region and service
failure remain visibly distinct.

## Verification and next work

Unit checks cover WGS84 scale/round trips in all three regions, map projection,
country filtering, address precision, height units, courtyards, safe arrival,
API validation, cache/rate limits, and upstream failures. Browser scenarios
cover search/travel in all three regions, current-avatar marker, larger map,
reload, failure recovery, and returning to golf across desktop/Android/iPhone/
iPad emulation. Search regressions cover debouncing, source icons (including
residential streets), keyboard selection/dismissal, empty/error states, stale
responses and Chinese input composition. Browser fixtures make those tests deterministic; live provider
checks are recorded separately during implementation.

Grok's next decisions: dedicated provider/import budget; geographic coverage
audit and correction process; terrain/building-part/roof detail; streaming and
mobile LOD budgets; course authoring versus course map records. Keep Winnipeg
city limits as the first audited default pilot. Broad address travel does not
declare Winnipeg's complete course inventory or city art finished. Multiplayer
presence, owned lots, friend visits and authoritative course scoring remain
the previously planned server work.
