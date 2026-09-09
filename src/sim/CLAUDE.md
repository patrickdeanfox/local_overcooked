# src/sim — the simulation arm

The kitchen rules as pure TypeScript. Deterministic given a level, a seed and an input sequence. No Phaser, no Three, no DOM, no clock, no `Math.random`. Everything that presentation shows is read from the `SimState` this arm produces; nothing here knows how it is drawn.

Owner: the simulation agent. Files: `src/sim/**` and `tests/sim*.test.ts`. Branch prefix `sim/`. Read `docs/DESIGN.md` once for the whole picture and `docs/WORKFLOW.md` for how PRs land.

## Files
- `types.ts` — the contract: tiles, items, chefs, orders, `Modifiers`, `SimState`, `PlayerInput`, `SimEvent`. **Additive changes only**: new optional fields and new union members. Renaming or removing a member means updating every consumer in the same PR and saying so in the PR description.
- `constants.ts` — every tuned number (`SIM_DT`, `CHEF_SPEED`, `REACH`, `CHOP_TIME`, `COOK_TIME`, `BURN_TIME`, `WASH_TIME`, `TIP_BASE`, `ORDER_FAIL_PENALTY`, ...). `docs/research/` is the source for each; when you change one, cite the source in a comment. No number is ever inline in `index.ts`.
- `recipes.ts` — `RECIPES` and the matchers (`dishMatchesRecipe`, `recipeForDish`, `recipeDishType`, `isBurgerComponent`). Ingredient lists are sorted alphabetically so a match is a walk.
- `rng.ts` — `mulberry32`, the only randomness. Two draw sites in the whole sim: which recipe a new order gets, and which neighbour a fire spreads to.
- `index.ts` — the `Sim` class and the barrel (`export * from './types'`, `./constants`, the recipe helpers, `mulberry32`).

## Boundary
- Imports from outside this arm: only `../levels/schema` (`LevelDef`, `OrderSettings`, `parseGrid`, `SOLID_TILES`). Nothing else, and never `src/config.ts` or `src/log.ts`.
- Consumers: `GameScene` builds and steps the `Sim`; the renderer, HUD, debug overlay, audio, input, art and settings import types, constants and recipes. `src/levels/schema.ts` imports ingredient lists and `RECIPES` back from here (a known, type-safe cycle).
- Playtest scripts reach the live sim through `window.__oc.sim` in dev builds.

## Public API (`index.ts`)
- `new Sim(level, { players, seed, modifiers? })`. Players are clamped to `1..level.spawns.length`. The constructor already draws from the RNG (initial orders) and renumbers every item parsed from the grid from 1, because `parseGrid` uses a module-global id counter.
- `step(inputs, dt = SIM_DT): SimEvent[]` — fresh event array each call; returns `[]` once `phase === 'ended'`. A missing input falls back to `NO_INPUT`.
- `getState(): Readonly<SimState>` — **the live object, not a copy.** Presentation reads it every frame and never mutates it. Tests take determinism snapshots with `JSON.stringify(sim.getState())`, which is why `SimState` holds no Map, Set, NaN, class instance or function.
- `getEffectiveSettings()`, `getTargetTile(chef)`, `tileAt`, `itemAt`, `fireAt`, `gateOpen(group)`, `sliderOffset(group)`.

## Fixed-step contract
`SIM_DT = 1/60`. The caller (`GameScene.runSim`) runs an accumulator loop capped at 30 steps per frame and 0.25 s per frame, and delivers `pickupPressed` / `interactPressed` rising edges on the first sub-step only; edges from frames too short to run a step are latched by the input arm, never dropped. Budget asserted by test: under 0.2 ms per step averaged over 5000 steps.

## Step order (`step()` in `index.ts`)
elapsed → sliders → gates (writes `staticSolid`) → pedestrians → per chef: movement with swept X then Y → chef separation → pushes from pedestrians, sliders, gates → `pushOutOfTiles` last, so no push can leave a chef inside a counter → per chef: spray, then pickup on the rising edge, then chop or wash while interact is held → cooking and burning → fires → plate returns → orders → timer → return events.

Rules the tests pin down: a stove on fire stops cooking and its burn clock; fire never spreads to a tile no chef can stand next to nor onto the extinguisher's tile; adding to a cooking pot rescales progress and a cooked pot goes back to cooking; the tip streak only continues when the oldest ticket is served; the first serve starts the clock on prep-time levels; no orders arrive or expire during prep; chop progress lives on the item, wash progress does not.

## How to add
- **A tile type**: union member in `types.ts`; `isPlaceableCounter` if items can be set down on it; `indexLevel` if it needs a precomputed tile list; `handlePickup` for pick up and place rules; `handleWork` for held interact; `updateCooking` if it cooks. Outside this arm it also needs a `LEGEND` char and `SOLID_TILES` entry in `src/levels/schema.ts`, an entry in `src/art/keys.ts` `TILE_TYPES` and `src/art/tiles.ts` `TILE_DRAWERS` (a `Record` over `TileType`, so the build breaks until drawn), and the three lookups in `src/game/render/three/tiles.ts` (`GROUND_TEXTURE`, `WALKABLE`, `SOLID_FOR_WALL`).
- **An item kind**: interface plus `Item` union member; a `case` in the `handlePickup` switch on `held.kind` and in the bare-hands branch; a factory next to `newIngredient` so ids come from `nextItemId`. Outside: `makeItem` in the schema, `src/game/render/three/items.ts`, `DebugOverlay`, the stack badge in `KitchenRenderer`.
- **A recipe**: `RECIPES` entry with ingredients sorted, a `score`, `dish: 'burger'` for anything not a soup. A new ingredient also joins `IngredientType`, `INGREDIENT_TYPES` and the right prep list (`SOUP_`, `CHOPPED_`, `FRIED_INGREDIENTS`), which drive `wareAccepts` and `readyForPlate`. `validateLevel` rejects a level whose recipes lack a crate, board, pot or pan.
- **A dynamic**: schema union member and validation first (`src/levels/schema.ts`); then a private spec type, a branch in `indexLevel`, an `updateX` called from `step`, a `SimState` field if presentation must see it, and collision handling mirrored on `pushChefsFromSliders` / `escapeBox` if it is solid.
- **A modifier**: optional field on `Modifiers`, a line in `effectiveSettings()`, one read site. The presets and assists that set it live in `src/game/settings.ts` (presentation arm) — coordinate in the PR.
- **A sim event**: `SimEventType` member, push it with `{ type, chef, x, y, value }`; continuous events go through the `TICK_EVENT_HZ` limiter. The audio arm maps every event type in `sfxForEvent`, so tell them.

## Tests (`tests/sim*.test.ts`, `npm test`)
- `sim.test.ts` smoke on the real 1-1; `sim.kitchen.test.ts` the main suite (movement, pick up, chop, soup end to end, fire, plate modes, orders, timer, pedestrians, sliders, modifiers, determinism, assists); `sim.burgers.test.ts` pans and assembly; `sim.collision.test.ts` push invariants; `sim.gates.test.ts` the 1-6 gate.
- Reuse the helpers each file carries: `makeLevel(patch)` on a fixture grid, `stepFor(sim, seconds, a, b)`, `tap(sim)`, `place` / `faceTile`, `mutable(sim)` to set up a scenario, `potOnStove`, `panOnStove`, `heldPlate`, `types(events)`, and the determinism harness `run(seed)` that stringifies state after 600 scripted steps. Copy that harness into any PR that touches step order.
- Collision tests allow flush contact (`TOUCH = 1e-6`); only real overlap fails.

## Before a PR
`npm test`, `npm run typecheck`, and a headless playtest of the affected level (`docs/WORKFLOW.md`). Determinism: two Sims with the same level, seed and inputs must produce identical `JSON.stringify(getState())`.

## Roadmap work that lands here
Custom difficulty scales (`docs/ROADMAP.md` item 2), throwing and dashing plus the `gap` tile (item 4), conveyor belts, moving platforms, fryer, oven, mixer, buttons and the OC2 prep-chain recipes (item 5), and the bot that scores generated kitchens (item 8).
