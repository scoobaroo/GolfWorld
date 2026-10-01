# City, social, and avatar expansion — user/Grok review

Status: proposal, September 30, 2026. The local Meadow Club slice remains
playable. Basic avatar colors can now be selected in Phone → Settings and
saved locally. Accounts, messaging, city geometry, likeness generation, and
friend teleporting are not implemented.

## Product direction

Confirmed by the user: Winnipeg is the first default pilot, covering
Winnipeg city limits. Verify the golf inventory against that boundary before
declaring coverage complete. The Bay Area
and Taiwan are subsequent regions; they contain multiple cities. Their city
records should use the same system, rather than copying the Winnipeg app.
The [Bay Area regional agency](https://census.bayareametro.gov/cities-counties)
lists its nine counties and constituent cities.

Players choose an in-world home neighborhood/lot, customize an avatar, message
friends through the phone, and request travel to a friend's current avatar.
Signup onboarding offers a written appearance description; an optional photo
or camera capture can help create a likeness. Show an editable preview before
setting the avatar. Text-only and manual customization remain available.

## Proposed architecture within the locked stack

- Shared data: city/region IDs, WGS84 boundaries and source metadata; tile
  origin plus local ENU meter coordinates; course records with source and
  verification status; imaginary home lot ownership; avatar specification;
  friendship, conversation, and teleport request records.
- Render roads, simplified buildings, terrain, and course outlines in the
  existing R3F world. Load nearby tiles and instance repeated geometry. Keep
  playable course geometry separate from a catalog/map marker; a course in
  the inventory is not automatically a completed 18-hole simulation.
- Better Auth supplies account identity. Drizzle persists profiles, avatar
  specifications, city/lot choices, friendships, and messages. Colyseus
  HubRoom supplies presence and server-owned in-world transforms. Reuse the
  existing GolfMatchRoom plan for authoritative golf.
- Phone messaging uses authenticated conversations, delivery history, and
  block controls. Friend teleport requests are checked on the server for
  accepted friendship, the destination player's visit permission, and a safe
  landing point in the correct city/room. Friends may enable automatic
  acceptance; otherwise accept/decline an invitation. No arbitrary client
  coordinate jumps and no interruption of an active golf turn.
- Choose a mobile-suitable avatar generation provider/asset format before
  adding text/photo generation. Recommend stylized likenesses rendered as
  compressed rigged glTF in R3F. Photo/camera input is optional and initiated
  by the user. Review the preview, upload destination, and retention policy
  before uploading; store the accepted avatar specification/asset afterward.

## Winnipeg data and first playable city

Use an attributed, versioned map-data import, then verify the course inventory
against operator sources. [OpenStreetMap's source terms](https://www.openstreetmap.org/copyright)
describe its ODbL attribution/data requirements. Confirm the map data pipeline
and compatible building/terrain sources before importing assets.

The [City of Winnipeg golf directory](https://www.winnipeg.ca/recreation-leisure/golf-courses)
provides a verified municipal seed: Canoe Club (50 Dunkirk Dr), Crescent Drive
(781 Crescent Dr), Kildonan Park (2021 Main St), and Windsor Park (10 Des
Meurons St). This is not an exhaustive list of all public and private courses.

First city milestone: one bounded Winnipeg launch tile with a hub, selectable
imaginary lots, a sourced city course catalog, and one playable course/hole.
Validate coordinate scale, course coverage, phone performance, persistence,
and two-player visits before designating Winnipeg the default and repeating
the import for Bay Area/Taiwan city records.

## Decisions needed before implementation

1. Confirmed: Winnipeg first, with courses inside Winnipeg city limits.
2. Approve the proposed geo/tile and social-room model, including friend visit
   permissions and golf-turn restrictions.
3. Select the avatar likeness provider/style and photo retention behavior.
4. Confirm map/building/terrain sources and the first course to make playable.

Per the collaboration rule, city/social/likeness implementation stops at this
design note until user/Grok review. No second stack has been introduced.
