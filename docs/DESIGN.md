# Design

How the pieces of local_overcooked fit together, and where the seams are. Read this once; the per-arm `CLAUDE.md` files (`src/sim`, `src/game`, `src/input`, `src/art`, `src/audio`, `src/levels`, `tools`) carry the detail for one arm, and `docs/WORKFLOW.md` says how to work on several arms at once.

## The shape
A pure simulation in the middle, with data flowing one way through it.

```
 keyboard / gamepads                  level JSON            models.json + assets/
        |                                |                          |
   src/input  --PlayerInput-->  src/sim  <--LevelDef--  src/levels  |  src/art (keys, manifest)
        |                          |                                 |  src/audio (SfxName)
        |                     SimState + SimEvent[]                  |
        |                          v                                 v
        +------------------>  src/game  (Phaser scenes, HUD)  +  Three.js kitchen renderer
                                   |
                     settings / progress / bindings in localStorage
                                   |
                       server.mjs (static + play notes)  ->  browser on the LAN
```

- **Input** turns devices into one `PlayerInput` per player per frame, with rising edges latched so no press is lost between fixed steps.
- **Sim** steps the kitchen at 60 Hz from those inputs and a level. It is deterministic given level, seed and inputs, has no clock and no `Math.random`, and hands back its live `SimState` plus the events of that step.
- **Presentation** runs the loop, draws the state (Phaser for menus and HUD on a transparent canvas, Three.js for the kitchen on a canvas behind it), plays sounds for events, and persists settings and progress.
- **Levels**, **art** and **audio** are data and contracts: a level is JSON through a schema, a model is a role in a manifest, a sound is a name in a table.
- **Tools** and the **server** sit outside the bundle: a headless playtest harness, the play-note store, model sync, the desktop launcher.

## One frame
`GameScene.update` polls input once, merges menu navigation, and unless paused runs `runSim`: clamp the frame to 0.25 s, latch edges, step `Sim.step(inputs, SIM_DT)` up to 30 times with rising edges on the first sub-step only, drop the accumulator if saturated. Then `getState()` once, check for level end, and render: `KitchenRenderer.draw(state)`, `Hud.update(state, events)`, `DebugOverlay.update`, and every event through `sfxForEvent` to the audio bus. Nothing allocates per frame. The F8 note form freezes the sim but keeps rendering.

## Contracts and the additive rule
Six files are the shared interface between arms. Changes are additive: new optional fields, new union members. Renaming or removing a member means updating every consumer in the same PR and saying so in the PR description.
- `src/sim/types.ts` — `SimState`, tiles, items, chefs, orders, `Modifiers`, `PlayerInput`, `SimEvent`.
- `src/sim/constants.ts` and `src/sim/recipes.ts` — tuning numbers and recipes.
- `src/levels/schema.ts` — `LevelDef`, `LEGEND`, `parseGrid`, `validateLevel`.
- `src/art/keys.ts` and `src/art/models.ts` — texture keys, model roles, chef skins.
- `src/audio/types.ts` — `SfxName`, `AudioBus`, `sfxForEvent`.
- `src/input/types.ts` — `GameAction`, bindings, `InputManager`.
- `src/config.ts` — canvas size, `TILE`, `SCENE` keys, `STORAGE_KEYS`, `MAX_PLAYERS`, `DEBUG`. `src/log.ts` is the only logger.

Types make most consumer breakage a compile error (`Record<TileType, …>` tables, exhaustive switches). The exceptions are listed under couplings below.

## Determinism
The sim's only randomness is `mulberry32` seeded from `SimOptions.seed`, drawn at two sites: the recipe of a new order and the neighbour a fire spreads to. Id counters are per `Sim`, and items parsed from the grid are renumbered from 1 because `parseGrid` uses a module-global counter. `SimState` holds plain data only (no Map, Set, NaN, class or function) so `JSON.stringify` is a valid snapshot and two Sims with the same inputs compare byte for byte. This is what makes seeded and daily runs, replays, the headless harness, and a future LAN host-and-clients possible.

## Levels
`src/levels/index.ts` globs every JSON under `src/levels/`, keys `LEVELS` by the `id` inside the file and sorts by game, world, index. `src/game/levelHotReload.ts` is the only browser module that imports that barrel; it accepts Vite HMR for it and notifies `GameScene`, which rebuilds the kitchen in place. Any other import of `src/levels` in the browser graph turns a JSON edit into a full page reload. `parseGrid` turns the ASCII grid plus `stations` and `items` overrides into tile and item arrays; `validateLevel` runs only in tests, so `npm test` is the gate for a new level. The catalog in `docs/research/catalog/` holds a record for every Overcooked 1 and 2 level in an extended legend; characters the clone lacks mark the mechanic the level waits on.

## Assets
`assets/` holds whole CC0 kits with their licences. `src/art/models.json` maps a role to one file and a normaliser (scale, then fit to a footprint in tiles, then height in tiles; centred, feet at y = 0). `npm run models` copies referenced files with their buffers and textures into `public/models/`, which is committed. `src/game/render/three/loader.ts` loads every role once at boot; a failure becomes a magenta placeholder box. The chef rig is baked from the Kenney character and its clips by `tools/export-chef.py` (Blender) and skinned at runtime from PNGs painted by `tools/make-chef-skins.py` (Pillow). The 2D texture set in `src/art` is code-drawn at boot; after the move to 3D only ground textures, effect sprites, icons, the order card and button prompts are still consumed.

## Canvases and camera
`three/stage.ts` inserts a WebGL canvas before Phaser's, with pointer events off, and forces Phaser's canvas above it; Phaser runs with `transparent: true`. One tile is one world unit, x right, z toward the camera, y up. `fitToGrid` frames the kitchen inside the band left between `CAMERA.hudTopPx` and `hudBottomPx`; Phaser overlays (progress bars, badges, the debug grid) get their positions from `Stage.project`, which maps through the perspective camera into Phaser's logical 1280x800 space so FIT scaling is respected. Low-fx mode (half resolution, no shadows) switches on under browser automation.

## Scenes
`Boot` (textures, models) → `Title` (level list, players, difficulty, doors to `Chefs`, `Settings`, `Controller`; `Settings` opens `CustomDifficulty`) → `Game` → `Results` → `Game` (retry with the same seed, or next level with a fresh one) or `Title`. The pause menu is an overlay inside `Game`, not a scene. `SCENE` keys live in `src/config.ts` and the scene list in `src/main.ts`; both are integrator-owned.

## Persistence (`localStorage`)
`local-overcooked.settings.v1` (players, preset, the custom difficulty numbers, seed mode and number, free play, assists, audio, chef picks), `local-overcooked.progress.v1` (per level: best score, stars, plays, stars by preset; unlocks count Normal and harder), `local-overcooked.bindings.v1` (keyboard and pad bindings per player; pad assignment is never saved), `local-overcooked.muted.v1` (raw flag), `local-overcooked.playnotes.v1` (notes waiting for the server). Each versioned payload is validated on load and replaced by defaults on any mismatch.

## Server and tools
`server.mjs` serves `dist/` on http 7777 and https 7778 (self-signed, because the Gamepad API is blocked on plain http off localhost), steps to the next free port, and stores play notes under `playnotes/`. `npm run dev` does the same through a Vite plugin. `tools/playtest.mjs` drives a headless Chromium with real key holds, screenshots and page evaluation; dev builds expose `window.__oc = { sim, level, scene }`. Twenty scripted scenarios live in `tools/playtests/`.

## The arms
| Arm | Directory | Owns (contract) | Consumes | Must not import | Tests | Also verify with |
|---|---|---|---|---|---|---|
| Simulation | `src/sim/` | `types.ts`, `constants.ts`, `recipes.ts` | `levels/schema` | Phaser, Three, DOM, config, log | `tests/sim*.test.ts` | determinism snapshot, harness on the level |
| Presentation | `src/game/` (minus `ControllerScene.ts`) | scene payloads, settings, progress | sim, input, audio, art, levels via hot reload, config, log | `src/levels` outside `levelHotReload.ts` | `tests/game.*.test.ts`, `tests/playnotes.test.ts` | `npm run typecheck`, harness screenshots |
| Input | `src/input/` + `ControllerScene.ts` | `input/types.ts`, bindings format | sim `PlayerInput`, config, log, art `TEX` | Phaser or DOM in `mapping.ts` | `tests/input.test.ts` | a real pad, `docs/CONTROLS.md` |
| Art | `src/art/`, `assets/`, `public/models/`, model tools | `keys.ts`, `models.json`, `models.ts` | sim types | Phaser scenes | `tests/art.test.ts` | `npm run models`, the kitchen in the harness |
| Audio | `src/audio/` | `audio/types.ts`, `SFX_TABLE` | sim `SimEvent`, config, log | Phaser, Three, `src/game` | `tests/audio.test.ts` | the game unmuted |
| Levels | `src/levels/`, `docs/LEVEL_*.md` | `schema.ts`, level JSON | sim ingredient lists and recipes | anything else | `tests/levels.test.ts` | walk it in `npm run dev` |
| Research | `docs/research/` | the catalog and mechanics notes | the wiki | code | none | cross-check `.md` against `.json` |
| Integration | `src/main.ts`, `src/config.ts`, `src/log.ts`, `server.mjs`, configs, `package.json`, `README.md`, `docs/PLAN.md`, `docs/ROADMAP.md`, `docs/DESIGN.md`, `docs/WORKFLOW.md`, harness and launcher tools | scene keys, storage keys | everything | — | all | `npm run build`, `npm start` |

## Couplings that types do not catch
- `ACTIONS` in `src/input/mapping.ts` is a plain array: a `GameAction` missing from it compiles and silently loses defaults, validation and a Controllers row.
- `ALL_EVENT_TYPES` and `ALL_SFX` in `tests/audio.test.ts` are kept in sync by hand.
- `CHEF_SKINS` order in `src/art/models.ts` must match the apron order in `tools/make-chef-skins.py`; the index is the persisted setting, so never reorder or remove.
- `CAMERA.hudTopPx` / `hudBottomPx` in `three/stage.ts` must match the HUD layout in `ui/Hud.ts`.
- `parseGrid` maps an unknown legend character to void and `validateLevel` runs only in tests.
- Nothing checks that every `models.json` `url` exists under `public/models/`; a typo is a magenta box at runtime.
- `src/levels/schema.ts` and `src/sim/index.ts` import each other (types one way, `parseGrid` and `SOLID_TILES` the other). It works because of ESM live bindings; keep new imports between the two type-only.
- `SCENE` keys and the scene list are split between `src/config.ts` and `src/main.ts`; a new scene needs both.
