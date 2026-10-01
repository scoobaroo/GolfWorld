# Next session: authoritative golf

Ready-to-paste prompt:

```text
Work in GolfWorld. Read agents.md and README.md first. Keep the current local
slice playable and follow the locked stack. Implement Colyseus 0.16+
GolfMatchRoom with two-browser, turn-based golf: player A finishes before B.
Use packages/shared shot validation, course data, units, gravity, surface
rules, and scoring. Run Rapier on the server at 20 Hz. The server owns strokes,
ball state, rest detection, water/OOB drops and penalties, active turn, and
hole-outs; reject forged or out-of-turn client state. Implement the existing
MatchConnection port with client prediction and interpolation/correction.
Publish append-only authoritative score events and project a live leaderboard
in Phone → Scores. Preserve a local guest fallback without Postgres. Add
meaningful room and scoring tests plus a two-tab Playwright match test.
Do not add auth, commerce, crypto, other sports, or a second stack. Document
protocol changes and run pnpm lint, pnpm typecheck, pnpm test, browser smoke,
and pnpm --filter web build. Stop with a docs/ design note for user/Grok review
if an unresolved architecture decision blocks this slice.
```
