
---

## First Codex prompt

Save as `PROMPT.md` if you want it in-repo, and paste this into Codex on session one:

```text
You are Codex working in the GolfWorld repo. Read AGENTS.md first and follow it exactly.

The GitHub repo https://github.com/scoobaroo/GolfWorld.git is the source of truth. It is currently empty. Scaffold the locked stack from AGENTS.md (pnpm workspaces + Turborepo, apps/web, apps/server, packages/shared, packages/economy).

Goal of THIS session: a playable local slice, not the whole game.

Deliver in this session:
1. Monorepo scaffold with the commands listed in AGENTS.md actually working.
2. README with how to run (including Docker Postgres optional; guest mode must work without Postgres if you stub the store).
3. apps/web: full-screen R3F canvas, third-person avatar, walk on a green hub pad with a clubhouse blockout. Touch + keyboard.
4. In-world phone: tap a Phone button or press P to open a mobile-style overlay with Map (stub) and Settings (name + invert-Y).
5. Home: one lot pad, place/move/rotate at least 3 furniture glTFs or primitive stand-ins, serialize layout to local storage for now with a TODO to persist via API.
6. Golf: one stylized par-4 hole adjacent to the hub. Local physics ball, 3 clubs, two-phase swing that works with mouse AND touch. Cup + stroke counter + hole-out screen.
7. Leaderboard panel / Phone → Scores app that records local hole-outs (array in local storage) with name, strokes, club used on last shot, timestamp.
8. packages/economy: ItemSku catalog for clubs + furniture + a phone skin. No checkout.
9. .env.example, PWA manifest, basic mobile safe-area HUD.

Constraints:
- Browser only. Must be usable on a phone in Chrome/Safari.
- TypeScript strict. pnpm only.
- 1 world unit = 1 meter.
- Do not implement Colyseus multiplayer, auth, or crypto yet. Leave interfaces/TODOs where AGENTS.md says they will go.
- After scaffolding, run pnpm install, pnpm typecheck, and pnpm test. Fix what you break.
- Commit in logical chunks if you are allowed to commit; otherwise stop and show the file tree + how to run.

When finished, print:
- exact commands to run the game
- what a reviewer should try on desktop and on a phone
- the next session’s job (Colyseus GolfMatchRoom + authoritative scoring) as a ready-to-paste prompt
