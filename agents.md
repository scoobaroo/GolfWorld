# AGENTS.md — GolfWorld

Browser-only persistent world on real WGS84. Players sign up, appear as avatars, see others, do ordinary actions (wave, sit, follow, knock, visit, invite), build houses/apartments/other buildings as data, author golf courses the same way, and play golf first. No native app. PWA. Phone + desktop.

Repo is nearly empty (`agent.md` only). Scaffold the stack below as task one. Smallest playable slice per milestone. Grok owns product; Codex implements.

## Lock

pnpm workspaces + Turborepo. Do not add Next.js, Babylon, PlayCanvas, Unity, Photon, Firebase, Prisma, Redux, or CSS-in-JS.

| Layer | Choice |
|---|---|
| TS | 5.x strict, shared types |
| Web | Vite + React 19 |
| 3D | R3F + Drei |
| Physics | Rapier (`@react-three/rapier`) |
| State | Zustand (server is source of truth) |
| CSS | Tailwind v4 |
| Net | Colyseus 0.16+ (`HubRoom`, `GolfMatchRoom`) |
| API/Auth | Hono + Better Auth (guest + email) |
| DB | Postgres + Drizzle |
| Geo | WGS84 → local ENU meters; one launch tile |
| Validate | Zod |
| Test | Vitest + Playwright |

`packages/economy`: `ItemSku`, `InventoryGrant`, `FulfillmentAdapter`. V1 = `LocalFulfillment`. No wallets, mint, or checkout (`VITE_COMMERCE_ENABLED=false`).

## Layout

```text
apps/web/src/{app,world,geo,golf,build,home,phone,net,ui}
apps/server/src/{rooms,sim,db,auth,records,economy}
packages/{shared,economy}
assets/