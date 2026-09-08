# Build plan: first playable

Decided 2026-09-08. Scope: Overcooked 1 levels 1-1, 1-2, 1-3, cloned 1:1 from the wiki. Two players, one screen, gamepads or keyboard. Code-drawn art, synthesized audio. Everything else is roadmap (`docs/ROADMAP.md`).

## Phases
0. **Scaffold (integrator).** Vite + Phaser + TS, `server.mjs`, contracts (`src/sim/types.ts`, `src/levels/schema.ts`, `src/art/keys.ts`, `src/audio/types.ts`, `src/input/types.ts`), stubs so every module compiles and runs.
1. **Parallel build, one Opus agent each, own branch + PR:**
   - Research OC1 → `docs/research/oc1-*.md`
   - Research OC2 → `docs/research/oc2-*.md`
   - Simulation → `src/sim/**`, `tests/sim*.test.ts`
   - Presentation → `src/game/**`
   - Input + controller screen → `src/input/**`, `ControllerScene.ts`
   - Art + audio → `src/art/**`, `src/audio/**`
   - Levels → `src/levels/**`, `tests/levels*.test.ts`
2. **Integration + playtest (integrator + QA agent).** Merge, wire `main.ts`, play every level in Chrome, code review, fix.
3. **Docs.** README, ROADMAP.

## Mechanics in scope (Overcooked 1)
Walk, pick up / put down, chop (hold), pot cooking on a stove with burn → fire, extinguisher spray, sink washing with dirty-plate return, plate stack mode (no sink), serving counter with order matching, tips for on-time serves, penalties for expired orders, timer with 1-1 prep time, star thresholds, pedestrians crossing (1-2), sliding counters (1-3).

## Out of scope for the first shot
Throwing, dashing, level select / progress save, LAN multi-device, pixel-art MCP sprites, Tiled import, procedural generation.
