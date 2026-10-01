# AGENTS.md — GolfWorld

Browser-only PWA. Real-world 1:1 later (WGS84). First sport is golf. Players sign up, walk as avatars, see others, do ordinary actions, build buildings as data, author courses the same way. No native app.

Grok: product. Codex: implement against this tree. Do not rescaffold.

## Now (commit `43dae41`)

Monorepo is up. Local slice lives in the client. Server is a stub API.

Working today:
- `apps/web` — Vite + React 19 + R3F + Rapier + Zustand + Tailwind v4 + PWA
- Hub walk, home lot editor, local Meadow Run par-4, two-phase swing, phone overlay, HUD, localStorage scores
- `packages/shared` — Zod models, `COURSE` (`meadow-1`), clubs, `shotVelocity`, `surfaceAt`, `isHoled`
- `packages/economy` — catalog + `LocalFulfillment` (in-memory)
- `apps/server` — Hono `/health`, `/api/course`, `/api/catalog`; Drizzle tables; room **ports only**
- Persistence: `golfworld.local.v1` in localStorage. Guest works without Postgres.

Not built:
- Colyseus (not even a dependency)
- Better Auth (commented TODO)
- `apps/web/src/geo`, `apps/web/src/build`, `apps/server/src/records`
- Second avatar, WGS84 tile, building/course records, checkout

## Commands

pnpm 11 + Node >= 22. Never npm/yarn.

```bash
pnpm install
pnpm dev                 # turbo web + server
pnpm lint && pnpm typecheck && pnpm test
pnpm --filter web build
pnpm test:e2e
docker compose up -d     # optional Postgres
pnpm db:generate && pnpm db:migrates

<!-- BEGIN:turborepo-agent-rules -->

# This is NOT the Turborepo you know

Turborepo configuration, task behavior, and CLI commands can vary between installed versions and may differ from your training data. Resolve the `turbo` package from this file's directory or relevant workspace; in monorepos, it may not be visible from the repository root. For example, run `node -p "require.resolve('turbo/package.json')"` from a workspace that depends on `turbo`.

Read `docs/README.md` inside that installed package first, then read the relevant pages from its `docs/` directory before changing Turborepo configuration or commands. Heed deprecation notices. These bundled docs match the installed package version and are available without network access.

This block is written and re-added by `turbo` before repository-scoped commands when an AI agent is detected. In the Turborepo source repository, its template is defined in `crates/turborepo-cli/src/cli/agent_guidance.rs`. Removing the managed block while updates are enabled means a later qualifying invocation will add it again. Set `"agentGuidance": false` in the root `turbo.json` or `turbo.jsonc` to opt out; this does not remove an existing block. Keep the block committed with your work to avoid an uncommitted change on the next agent invocation.
<!-- END:turborepo-agent-rules -->
