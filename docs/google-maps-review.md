# Google Maps integration — user/Grok review

Status: the user explicitly approved switching address suggestions to Google.
The search integration is implemented; the user configured the key locally.
A live Google lookup returns River Springs Drive, West Saint Paul, MB, Canada,
and selecting it loads the destination's neighborhood in the existing world.
The building/scenery provider decision remains deferred. Keep the browser/PWA
and R3F slice.

## Problem and observed behavior

The user wants Google's address coverage and populated real-world buildings.
These require different services. The current `/api/geo/search` uses Photon;
`/api/geo/neighborhood` uses OSM/Overpass geometry; the 2D map uses OSM tiles.
Changing `GEOCODER_URL` to Google cannot work: authentication, request/response
formats, attribution, and storage rules differ.

Live checks found **River Springs Drive, Rivercrest, Manitoba** for `River
Springs Dr`, with both Canada and all supported countries selected. The full
query `River Springs Drive West St Paul Manitoba` returns one match. The live
phone dropdown also shows it first. This confirms current coverage, but does
not establish why the user's earlier request failed or guarantee other house
numbers are mapped. Canadian/Taiwanese formatting and duplicate removal are
implemented independently of this provider decision.

## Implemented first step: Google address search

Use Google's **Places UI Kit Basic Place Autocomplete + Place Details**
inside the existing Phone → Map. Keep Google attribution visible. Limit
countries to US/CA/TW, bias to the viewed region, and resolve only the selected
place. No city crawling or bulk population. Pass the UI Kit's selected coordinate
through the existing WGS84 travel flow. World geometry continues to come from open data
and independent user captures.

Why this candidate: Google's standard Places API prohibits using its content
with a non-Google map; the UI Kit has an explicit exception. Basic Autocomplete
returns a place ID; the UI Kit Details element exposes the selected location.
The kit is currently experimental, so this needs a mobile compatibility check
before committing the product to it. See the [UI Kit docs](https://developers.google.com/maps/documentation/javascript/places-ui-kit/overview),
[Basic Autocomplete flow](https://developers.google.com/maps/documentation/javascript/places-ui-kit/basic-autocomplete),
and [service terms §§14–15](https://cloud.google.com/maps-platform/terms/maps-service-terms).
If Grok prefers a fully custom Google-backed dropdown using the standard Places
API, propose a Google basemap replacement as a separate reviewed scope.

Google is the default, with lazy SDK load only when Map opens and provider
provenance on selected places. Configure `VITE_GOOGLE_MAPS_API_KEY` in root `.env`;
restart Vite after changing it. Enable Maps JavaScript API and Places UI Kit,
with a browser key restricted to the app origins/APIs. An absent key is disclosed,
and failures never silently fall back to Photon. Explicit keyless mode is
`VITE_ADDRESS_SEARCH_PROVIDER=photon`.

The widget owns Google's suggestions and visible place details. Its public
selection object provides ID/location/viewport, so the world uses a neutral
"Selected Google location" label rather than fetching additional content through
the standard Places API. Google selections bypass general search caches and
indefinite destination saves: they remain in memory and reload returns to Meadow.
No Google names/addresses are copied into records or capture exports. Capture
targets must come from a mapped OSM building, device GPS or an independently
placed map pin. This avoids relying on the maximum 30-day coordinate cache period.
Device GPS, user-authored layouts, and independently recorded capture metadata
remain their own data sources. No device GPS needs to be sent to Google for
search; bias with the map viewport.

Google access requires a billing-enabled Cloud project, enabled APIs, and a
restricted key ([UI Kit setup](https://developers.google.com/maps/documentation/javascript/places-ui-kit/get-started)).
Configure service quotas and an agreed request budget before live testing;
do not put keys in Git or chat. The local `.env` is excluded from Git.

## Buildings and visual detail

Places search does not supply editable building meshes, interiors, collision
geometry, or the complete Google Maps database. Google's [Photorealistic 3D
Tiles](https://developers.google.com/maps/documentation/tile/3d-tiles) can stream
textured scenery in covered areas, subject to viewport attribution and usage
rules. Coverage and mobile performance need a Winnipeg/Bay Area/Taiwan audit.

The [tile policy](https://developers.google.com/maps/documentation/tile/policies)
does not permit extracting/tracing that scenery into our building dataset,
object detection, or offline world imports. Independently authored objects can
be overlaid. A future tile visualization therefore needs a separate rendering
design; it does not replace course/building authoring or interior captures.
Do not introduce Cesium or another world renderer in this change.

## Remaining decision and acceptance

The user has approved search. Google photorealistic scenery and a different
basemap remain separate review items. The Cloud project owner controls the key
and quotas. Mock-SDK tests validate the integration; live provider checks
separately validate observed coverage.

Acceptance: River Springs Dr and a mapped house number, a US street/golf course,
and a full Traditional Chinese Taiwan address; touch/keyboard selection on
iPhone/iPad/Android; region changes and stale-result cancellation; blocked key,
quota exhaustion and provider failure; attribution; expiring/restoring selected
places; no Google content in capture exports; Meadow golf remains playable.
