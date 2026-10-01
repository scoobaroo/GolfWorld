# GolfWorld · Meadow Club

A browser-only local vertical slice: walk the neighborhood, arrange a home,
open your in-world phone, and play a 380-yard par-4 hole. Guest play needs no
database, account, or API connection. Source of truth:
[scoobaroo/GolfWorld](https://github.com/scoobaroo/GolfWorld).

## Run

Requires Node **22.12+** and **pnpm 11.19.0**. Use pnpm only.
On this Codex workstation, bundled Node/pnpm are available via the optional
first line below; on other machines it keeps an existing Node/pnpm installation.

```sh
cd /Users/erichan/Repos/GolfWorld
source scripts/use-codex-runtime.sh
pnpm install
pnpm dev
```

Open **http://localhost:5173**. The Hono guest API runs on **3001**
(`GET /health`, `/api/course`, `/api/catalog`). Both servers bind to `0.0.0.0`.
To try a phone on the same Wi-Fi, visit `http://<YOUR_LAN_IP>:5173` in Safari
or Chrome; Vite prints the network URL. Allow local-network access if your
browser asks. An HTTPS deployment or localhost is needed for service workers
and full PWA behavior; ordinary guest play works over LAN HTTP.

## Try the slice

| Action | Desktop | Phone |
| --- | --- | --- |
| Walk the hub | WASD or arrow keys | Drag the lower-left joystick |
| Look around | Drag the world | Drag the world |
| Open phone | P or Phone button | Phone button |
| Close phone | Esc or close button | Close button or swipe down from phone top |
| Move between areas | Hub / Home / Golf buttons | Same touch controls |
| Set your name and invert Y | Phone → Settings | Same |
| Set your appearance | Phone → Settings → Your appearance | Same color controls |
| Place furniture | Home → choose a piece → click the lot pad | Choose a piece → tap the pad |
| Move / rotate furniture | Select and drag; Rotate 90° | Select and drag; Rotate 90° |
| Swing | Hold mouse or Space, release, then tap/press at meter center | Hold Swing, release, then tap at center |

Home includes an oak chair, garden table, and fern planter. Place all three,
drag and rotate them, and reload to verify the layout. The navigation shortcuts
keep the slice quick to review; the golf tee also sits east of the hub.

Golf offers Driver, 7-iron, and Putter. Aim defaults toward the cup; the Aim
slider offsets that direction. Hold about 1.2 seconds for full power, release
to start the face meter, then tap near its center. If you wait, the meter
automatically strikes with the resulting face error. Wait for the ball to
settle before your next shot. Use the driver for distance, the iron for
approaches, and the putter on the green. Try aiming toward the blue pond or
outside the course: the ball drops at the last lie and adds one penalty.

A slow ball inside the cup completes the hole. The result records display
name, total strokes including penalties, last-shot club, course, and timestamp.
Open Phone → Scores and reload to verify persistence. Scores rank by strokes.
Phone Map is a schematic stub with travel buttons; Inventory and Shop display
the included starter catalog. Friends is a placeholder. Checkout is disabled.

## Commands

```sh
pnpm dev
pnpm --filter web dev
pnpm --filter server dev
pnpm lint
pnpm typecheck
pnpm test
pnpm --filter web test
pnpm --filter shared test
pnpm --filter web build
```

Browser tests are separate from unit tests:

```sh
pnpm --filter web exec playwright install chromium webkit
pnpm test:e2e
pnpm test:pwa        # production build + cached offline visit
```

Tests exercise desktop Chromium and 390×844 touch Chromium/WebKit, profile and
layout persistence, swing input, scoring, and complete Rapier ball flights.
WebKit emulation is not a substitute for a physical iPhone performance check.
For this session's downloaded browsers, set
`PLAYWRIGHT_BROWSERS_PATH=/private/tmp/golfworld-browsers` before browser tests;
a normal Playwright installation uses its default cache instead.

## Optional Postgres

```sh
docker compose up -d postgres
pnpm db:migrate
```

Compose uses **postgres:16** at **5432**. The initial Drizzle migration is
committed for profiles, lots, score events, and inventory grants. It can be
regenerated after schema changes with `pnpm db:generate`. Default development
credentials are in `.env.example`; set `DATABASE_URL` in your shell to override
them. The guest API does not connect to Postgres yet. Migration execution
requires Docker/Postgres and is separate from guest startup.

Environment options are documented in `.env.example`. Vite reads variables
from `apps/web/.env` or the shell; server/Drizzle variables come from the shell.
`VITE_COMMERCE_ENABLED=false` documents the future gate; this slice has no
checkout route or checkout action at either value.

## Boundaries and next slice

- 1 world unit = 1 meter; gravity is 9.81 m/s². Yards are display-only.
- React 19/Vite, R3F/Three/Drei/Rapier, Zustand, and Tailwind v4 are the only
  client renderer/state/style systems. Source art is primitive blockout.
- Local Rapier uses a regulation-radius collider with an enlarged visual ball,
  CCD, fixed 60 Hz stepping, per-surface friction/restitution and drag, and a
  forgiving 22 cm cup radius for this practice slice. The avatar is kinematic.
- Name, invert Y, avatar colors, furniture, and scores use the versioned
  `golfworld.local.v1` localStorage record. Corrupt data falls back to defaults.
  A warning appears if storage is unavailable. Local rounds are not competitive
  server-verified scores.
- Typed match/hub/lot/identity contracts leave room for Colyseus, Better Auth,
  and Drizzle persistence. No multiplayer or authentication is implemented.
  The server accepts no client score/grant submissions.
- `packages/economy` defines stable `ItemSku`, `InventoryGrant`, and
  `FulfillmentAdapter` contracts. `LocalFulfillment` uses a development memory
  store; its TODO is Drizzle rows. No payments, wallet, or on-chain logic exists.
- Production builds include a manifest, PNG/SVG icons, safe-area controls,
  and a network-first offline cache. Dev builds do not register a service worker.

The next job is **Colyseus GolfMatchRoom + authoritative scoring**.
[Ready-to-paste next-session prompt](docs/next-session.md).

The proposed Winnipeg pilot, Bay Area/Taiwan expansion, messaging, likeness
avatars, and friend teleport behavior are recorded in
[the user/Grok design review](docs/city-social-avatar-review.md).

```text
apps/web/src/       app/ world/ golf/ home/ phone/ net/ ui/
apps/server/src/    rooms/ sim/ db/ auth/ economy/
packages/shared/   models, Zod schemas, course, shot and score rules
packages/economy/  catalog and fulfillment port
docs/              stack decision and next-session prompt
```
