# Locked-stack review required

The first-session prompt requires reading `AGENTS.md` and following its locked
stack, commands, and future integration boundaries. On September 30, 2026,
both the local checkout and fetched `origin/main` contain only `agent.md`, which
repeats that prompt; neither contains `AGENTS.md`.

## Confirmed scope

- pnpm workspaces and Turborepo.
- `apps/web`, `apps/server`, `packages/shared`, and `packages/economy`.
- Browser-only React Three Fiber world, strict TypeScript, meters as world units.
- Local guest play, local ball physics, furniture layouts and scores in local storage.
- No multiplayer, authentication, crypto, or checkout in this slice.
- Future session: Colyseus `GolfMatchRoom` and authoritative scoring.

## User/Grok review needed

Please supply the intended `AGENTS.md`, including the web build framework,
physics library or approved local simulation approach, server framework,
test runner, supported runtime versions, required workspace commands, and
interfaces/TODO boundaries for future persistence and multiplayer.

No alternative stack has been scaffolded. Once these instructions are supplied,
resume the playable vertical slice described in `agent.md` and run
`pnpm install`, `pnpm typecheck`, and `pnpm test`.
