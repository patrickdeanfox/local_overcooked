# src/game — the presentation arm

Everything the player sees and touches that is not the raw simulation: Phaser scenes, the HUD, the 3D kitchen renderer, settings and progress persistence, the pause menu, the debug overlay, level hot reload and the F8 note reporter. This arm never decides a game rule; it reads `SimState` and draws it.

Owner: the presentation agent. Files: `src/game/**` except `scenes/ControllerScene.ts` (input arm). Tests: `tests/game.*.test.ts`, `tests/playnotes.test.ts`. Branch prefix `game/` (or `ui/`, `render/`). Read `docs/DESIGN.md` once for the whole picture and `docs/WORKFLOW.md` for how PRs land.

## Files
Top level
- `types.ts` — scene payloads `GameSceneData` and `ResultsSceneData`.
- `settings.ts` — presets, assists, seed modes, audio switches, chef picks; `loadSettings` / `saveSettings` with an injectable storage. Pure, no Phaser.
- `progress.ts` — best score, stars and plays per level, stars kept per preset; `recordRun`, `isUnlocked`, `unlockingStars`. Pure.
- `storage.ts` — guarded `localStorage` and value coercion; a private window, a full quota or a hand-edited value must never take the game down.
- `audioBus.ts` — the one `AudioBus` for the whole page, mute persistence, gesture resume, the M key.
- `levelHotReload.ts` — the only browser module allowed to import `src/levels`; `currentLevels()`, `defaultLevelId()`, `onLevelsHotReload()`.
- `playnotes.ts` — F8 reporter: overlay, screenshot with the 3D canvas composited in, context provider, `POST /api/playnotes`, offline queue.

`scenes/` — `BootScene` (textures, then all models, then Title), `TitleScene` (level list plus players, difficulty, Chefs, Settings, Controllers rows), `SettingsScene`, `ChefsScene` (live 3D preview on the shared stage), `GameScene` (the loop), `ResultsScene` (the only writer of progress).

`ui/` — `theme.ts`, `Hud.ts` (order cards, score, timer, prep hint), `MenuList.ts`, `LevelList.ts`, `menuInput.ts` (`MenuInput` from `PlayerInput`, `KeyboardNav` from raw keys, merged into rising edges), `PauseMenu.ts` (an overlay, not a scene: the sim simply stops stepping), `DebugOverlay.ts` (F3 or backtick).

`render/` — `KitchenRenderer.ts` (SimState → Three scene plus a thin Phaser overlay) and `three/`: `stage.ts` (the WebGL canvas behind Phaser, camera fit, lights, projection, low-fx), `loader.ts` (glTF load, normalise, cache per `ModelRole`), `tiles.ts` (stations, ground, theme dressing, sliders, gates, knives), `items.ts` (item views and their change signature), `chefs.ts` (rig, skin, toque, idle/run crossfade), `fx.ts` (fire, smoke, steam, spray sprites).

`debug/fakeState.ts` — a plausible `SimState` for F4 smoke tests of the renderer and HUD.

## Boundary
- Imports: `Sim`, `SIM_DT`, types, `TIMER_WARNING_AT`, `RECIPES` from `src/sim`; `createInputManager` and the edge-latch helpers from `src/input`; `sfxForEvent`, `createAudioBus`, `AudioBus` from `src/audio`; `generateTextures`, `TEX`, `CHEF_SKINS`, `MODELS`, `MODEL_ROLES`, `PALETTE`, `soupColor` from `src/art`; `LevelDef` (type) and `parseGrid` from `src/levels/schema`; `SCENE`, `STORAGE_KEYS`, sizes from `src/config`; `log`.
- Never import `src/levels` anywhere but `levelHotReload.ts`, or a level JSON edit becomes a full page reload instead of an in-place rebuild. The accept path must be a string literal.
- `SCENE` keys live in `src/config.ts` and the scene list in `src/main.ts`; both are integrator-owned, so a new scene is a two-arm PR.

## The frame (`GameScene.update`)
Poll input once → if the F8 form is open, render the current state and return → merge menu navigation → paused: drive the pause menu, no stepping → else `runSim`: clamp the frame to 0.25 s, latch edges before the loop, step at `SIM_DT` up to 30 times, rising edges on the first sub-step only, drop the accumulator when saturated → `getState()` once → check level end → `render`: F4 swaps in the fake state, `getTargetTile` per chef, then `kitchen.draw`, `hud.update(state, events)`, `debugOverlay.update`. Every `SimEvent` goes to `recentEvents` (for notes) and through `sfxForEvent` to the bus. HUD flourishes read events (`serve` popup, `orderExpired` flash); 3D effects are derived from state, not events (fires, steam, spray). Nothing allocates per frame: step inputs, latches and the poll array are reused.

## Renderer
- World units: one tile is one unit, x right, z toward the camera, y up. A level change rebuilds the `TileSet` and refits the camera; a frame only updates offsets, items, chefs, effects.
- Views are pooled: tile items by tile index and held items by chef, reused while `itemSignature(item)` is unchanged (cook progress is bucketed so a pot is not rebuilt every frame); chef rigs by index, pedestrians by id.
- Phaser overlays (progress bars, stack badges, the debug grid) get screen positions from `Stage.project`, which maps through the perspective camera into Phaser's logical 1280x800 space, so they survive FIT scaling. The camera reserves `CAMERA.hudTopPx` and `hudBottomPx` for the HUD band: change the HUD layout and change those.
- Themes are `THEMES` in `three/tiles.ts` (`default`, `treacle-town`, `savoury-seas`: backdrop, floor, back wall). Unknown themes fall back to `default`. `themeSceneHeight` feeds the camera fit. Road tiles at an edge get asphalt and parked cars on every theme.
- `loader.ts` loads every role in `MODEL_ROLES` once at boot; a failed or early request becomes a magenta placeholder box and a log line, never a crash. Skinned meshes have frustum culling off. Instances share geometry and materials, so tint through `tintObject`.
- Low-fx mode (half pixel ratio, no shadows) switches on under `navigator.webdriver` or a HeadlessChrome user agent so the playtest harness keeps its frame budget.

## Persistence
`local-overcooked.settings.v1` (players, preset, seed mode and number, free play, assists, audio, chefs; a version mismatch resets to defaults) and `local-overcooked.progress.v1` (per level: best score, stars, plays, stars by preset; unlocks count Normal and harder only). Mute is a separate raw `'1'`/`'0'` key. Progress is written in exactly one place, `ResultsScene`, before its menu is built and never for an assisted run. Both load functions take an injectable storage; the tests rely on it.

## How to add
- **A scene**: `scenes/X.ts` extending `Phaser.Scene` with the standard skeleton (`createInputManager`, `MenuInput` plus `KeyboardNav`, `installAudioGestureResume` and `installMuteToggle` pushed into `disposers`, `events.once(SHUTDOWN, cleanup)`, a `ready` flag cleared before every `scene.start`); a `SCENE` key in `src/config.ts` and the class in `src/main.ts` (integrator); a payload in `types.ts`; a row that opens it.
- **A HUD element**: a constants block at the top of `ui/Hud.ts`, create in the constructor and add to `root`, update in `update()`, destroyed with `root`. Icons must be `TEX` keys the art arm generates.
- **A model on a tile or item**: the role belongs to `src/art/models.json`; here add the `buildStation` case (plus `GROUND_TEXTURE`, `SOLID_FOR_WALL`) in `three/tiles.ts`, or the `INGREDIENT_ROLE` / `BURGER_LAYER_ROLE` entry or a `buildItemView` branch in `three/items.ts`, and make `itemSignature` change whenever the look changes.
- **A theme**: a `THEMES` entry; report its height in `themeSceneHeight` if it adds tall scenery. Roadmap item 6 moves themes to data.
- **An effect**: sound is `sfxForEvent` (audio arm); a HUD flourish is `Hud.handleEvents`; a 3D effect is a `drawX` in `KitchenRenderer` derived from state plus a spawner on `FxPool` with a `TEX` sprite.
- **A settings row**: `RowId`, the `ROWS` order and `DESCRIPTIONS` in `SettingsScene.ts`, a case in `item(id)`, every mutation through `applySettings()`; a persisted field also needs `Settings`, `DEFAULT_SETTINGS`, coercion in `loadSettings` and `settingsSummary`.

## Tests and checks
`tests/game.settings.test.ts`, `tests/game.progress.test.ts` (fake and throwing storages), `tests/playnotes.test.ts` (`buildNote`, queue helpers: keep them importable in Node), `tests/art.test.ts` for the `TEX` contract. There are no unit tests for scenes, the renderer or the HUD: `npm run typecheck` plus the headless harness are the checks. Every feature has a script in `tools/playtests/` (`07` covers the scene flow, `15` to `19` cover menus, settings, assists and chefs); add one for anything new and read the screenshots.

## Gotchas
- A menu choice can start another scene mid-update; check `ready` after every handler.
- `KeyboardNav` tracks its own previous state and never uses `JustDown`, whose flag is consumed by the first reader.
- The Title settings list is moved, not rebuilt, because a rebuild from inside a row callback destroys the list mid-handle.
- Nudging or typing the seed pins `seedMode` to `fixed`; Esc reaches menus as the pause action.
- The 3D kitchen is its own canvas: the note screenshot composites it first, and the F8 form takes the keyboard in the capture phase so nothing reaches Phaser.
- Dead surface (no `noUnusedLocals`): `TILE` import in `DebugOverlay`, `CHEF_COLORS` in `ui/theme.ts`, `Stage.dispose`, `loader.modelsReady`, `loader.modelScaleFactor`, `KitchenRenderer.scaleValue`.

## Roadmap work that lands here
Custom difficulty rows (`docs/ROADMAP.md` item 2), glyph labels in every hint (item 3), flying items and the dash pose (item 4), theme dressing as data (item 6), the character maker and custom skins (item 7), the Random kitchen row (item 8), best times and leaderboards (item 9).
