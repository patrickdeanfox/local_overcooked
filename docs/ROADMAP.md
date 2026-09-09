# Roadmap

Where the game goes from the 2026-09-08 build. Ordered by value per effort, not by the order the ideas arrived. Each item says what exists today, what to build, and which files it touches, so a session can start on it without re-deriving the plan. Effort marks: **S** about half a day of agent work, **M** one to two days, **L** three days or a dedicated agent.

Done so far: first playable, Overcooked 1 world 1 (1-1 to 1-6) with soups, burgers, fire, sinks, plate stacks, pedestrians, sliders and the earthquake gate; the full 3D kitchen (Three.js behind Phaser, CC0 Kenney and KayKit kits, level themes, steam, a chopping animation, street dressing with parked cars); level select with saved stars and unlocks; four difficulty presets, a custom difficulty page that scales every timer and ticket number, and three seed modes; the Chefs page with 15 characters previewed in 3D; the Settings page with three assists and separate music and effects switches; the F8 play-note reporter; the headless playtest harness with 20 scripted scenarios; the https LAN server and desktop launcher; and a research catalog of all 74 Overcooked 1 and 2 levels (`docs/research/catalog/`).

How the items relate: throwing and dashing (item 4) unblock 24 catalogued levels, so they come before the bulk of the level work (item 5). New kits (item 6) dress the levels as they land. Procedural kitchens (item 8) read the catalog and reuse the level validator, so they need nothing from items 4 to 7. The theme reskin (item 13) waits for the station set from item 5 to settle and takes item 6's data-driven dressing as its first half; the noun map it needs can be written now. `docs/WORKFLOW.md` says how to run several of these at once.

## 1. Tune world 1 by play — S, ongoing
- Apply `docs/research/sim-constants-recommendations.md` to `src/sim/constants.ts`.
- Play each level with two people; measure seconds per served dish; adjust `orders` per level JSON until 3 stars is hard but reachable (`docs/LEVELS.md` has the tuning knobs and the numbers measured so far).
- Fix feel issues first: chef speed, interaction reach, chop and wash times.
- Run `npm run notes` at the start of every session and act on the F8 notes.

## 2. Custom difficulty: timers and everything else — done 2026-09-08
Shipped in PRs #41 and #42: a fifth preset, `custom`, whose modifiers come from `Settings.custom` (ten numbers, `CUSTOM_FIELDS` in `src/game/settings.ts`, each with a range and a step); five additive `Modifiers` fields (`cookTimeScale`, `burnTimeScale`, `chopTimeScale`, `washTimeScale`, `initialOrdersDelta`) applied in `effectiveSettings()`; a Custom difficulty page (`src/game/scenes/CustomDifficultyScene.ts`) opened from the Settings page, one row per number, the line under the list computed by a throwaway `Sim` on the first level; HUD and results say "Custom"; a custom run is saved but never counts toward unlocks. Tests in `tests/game.settings.test.ts`, `tests/game.progress.test.ts` and `tests/sim.kitchen.test.ts`; harness script `tools/playtests/20-custom-difficulty.txt`.

Left for later: station swaps within slots and fewer plates as modifiers (item 9), and a per-level reference in the preview line once the title remembers which level the cursor was on.

## 3. Controller setup that feels intentional — done 2026-09-08, except step 6
Shipped in PR #43 (input arm): a **Device** row per player (Keyboard set 1, Keyboard set 2, or any connected pad by name; a pad another player holds is swapped, a keyboard set releases the pad and the sets stay distinct); **Set up controls**, a guided wizard that asks for every action one press at a time; captures on an action row **add** to its list and the chop button **clears** it for the chosen device, so Shift+Ctrl survives; bindings **keyed by pad id** (`BINDINGS_VERSION` 2 with a one-shot v1 migration in `parseBindings`); **Left stick, D-pad and Stick deadzone** rows per pad; and **`menuLabels`**, the one helper every hint line (title, Settings, Custom difficulty, Chefs, pause, results) reads its labels through, so a PlayStation pad sees Cross / Square everywhere. `hasSavedBindings()` drives a first-run pointer on the title and the page. Docs in `docs/CONTROLS.md`; tests in `tests/input.test.ts`; harness script `tools/playtests/21-controllers-setup.txt`.

Left for item 4: **room for throw and dash.** The action list grows to nine; B / Circle stays the fixed menu-back button and `backPressed` is only read by menus, so in-game B is free for dash. Decide the defaults when item 4 lands and put them in `src/input/mapping.ts`; the saved payload then needs a migration step next to `parseV1` that fills the new actions with their defaults.

## 4. Overcooked 2 dynamics: throwing and dashing — done 2026-09-08
Shipped in PR #45 (sim arm): `TileType 'gap'` (legend `_`; no wall, a throw crosses it, a chef that steps on it falls and respawns after `FALL_PENALTY_SEC`), `PlayerInput.throwPressed? / dashPressed?`, `SimState.flying?`, `Chef.dashCooldown? / dashTimeLeft? / respawnIn?`, `ChefAction 'dashing' | 'falling'`, events `throw`, `catch`, `throwLand`, `dash`, `dashBump`, `chefFell`, and the rules below in `src/sim/index.ts` with `tests/sim.throw.test.ts`, `sim.dash.test.ts`, `sim.gap.test.ts`. Throws already fly over a closed 1-6 gate, so 1-6 has its drop with no level change. Input landed in PR #46: `GameAction 'throw' | 'dash'` (keyboard E / Q and / / ., pad Y and B), the two extra rows and wizard steps, `LATER_ACTIONS` so older saved maps keep their keys. Audio landed in PR #47 (six `SfxName`s) and presentation in PR #48 (thrown items pooled by flight id on an arc, a dash stretch and dust trail, a hidden falling chef with a burst of dust, the gap as a hole in the floor; harness script `tools/playtests/23-throw-dash-gap.txt`). What remains of this item is levels: the OC2 cheap list in `docs/research/oc2-roadmap-notes.md` section 15, which is item 5.

Why first among the mechanics: the catalog lists throwing as missing on 24 of 74 levels, more than any other mechanic, and OC1 1-6 was shipped with a timed gate standing in for its throw-over drop. The design is written out in `docs/research/oc2-roadmap-notes.md` sections 3, 4 and 16; the short version:
- **Decide gap vs void first.** `void` stays "outside, solid"; add `TileType 'gap'` (not walkable, throwable over, fall in and respawn at spawn with a time penalty, `SimEvent 'chefFell'`). Do this before throwing because throwing is the first rule that has to tell them apart.
- **Sim** (`src/sim/types.ts`, additive): `PlayerInput.throwPressed?` and `dashPressed?`; `SimState.flying?: FlyingItem[]` (`{ id, item, x, y, vx, vy, thrower }`); `ChefAction 'dashing'`; `Chef.dashCooldown?`; events `throw`, `catch`, `throwLand`, `dash`, `chefFell`. Rules: throwable are ingredients and cookware contents, never plates; direction is the chef's facing; the item resolves against the first chef with free hands (catch), cookware that accepts it, a trash tile, a free counter, else the floor; walls stop it, gaps and portals let it pass. Dash bumps other chefs and knocks a held item loose; a dash then throw travels further.
- **Constants** in `src/sim/constants.ts`: `THROW_SPEED`, `THROW_RANGE` (start at 3.5 tiles), `CATCH_RADIUS`, `DASH_SPEED`, `DASH_TIME`, `DASH_COOLDOWN` (0.6 s is the only number the wiki gives).
- **Input**: `GameAction 'throw' | 'dash'` in `src/input/types.ts`, defaults in `src/input/mapping.ts`, rows on the Controllers page, PlayerInput mapping. See item 3 step 6 for the B/Circle conflict.
- **Presentation**: flying items as an arc in `src/game/render/three/` (items already have a model per kind), a dash stretch on the chef rig, a dust puff effect; **audio**: `SfxName` `throw`, `catch`, `dash` in `src/audio/types.ts` mapped in `sfxForEvent`.
- **Levels**: 1-6 gets its real drop; the OC2 cheap list in `docs/research/oc2-roadmap-notes.md` section 15 opens up.
- Tests: `tests/sim.throw.test.ts` (flight resolution table), `tests/sim.dash.test.ts` (cooldown, bump), `tests/input.test.ts` (new actions parse and default).

## 5. The rest of the Overcooked levels — L, ongoing
What exists: six shipped levels under `src/levels/oc1/`; a catalog record for every level of both games (`docs/research/catalog/oc1/`, 30 records; `oc2/`, 44) with an ASCII grid in the shared extended legend, the station inventory, dynamics, and a `missingMechanics` list. Grid confidence across the catalog: 7 high, 32 medium, 35 low, so the low ones want a better screenshot before transcription (`docs/research/tools/fetch_wiki.py`).

Transcription recipe per level: copy the catalog grid, replace extension characters with `LEGEND` characters from `src/levels/schema.ts` where the clone has the station, write `src/levels/<game>/<world>-<n>.json`, run `npm test` (parses, validates, checks every station is reachable), then `npm run dev` and walk it. `docs/LEVELS.md` records how the six existing grids were counted. A catalog-to-LevelDef converter is item 11.

Order of work, cheapest first, using the catalog's `missingMechanics` roll-up (run the `jq` lines in `docs/research/catalog/README.md` to refresh it):
1. **Needs nothing new:** OC1 3-2 shipped in PR #49 (a clean plate return with no sink as a `plateStack` override, two serving counters, a split deck; the reachability test now takes the spawns together). Plated dishes (`DishType 'plated'`, `PLATED_INGREDIENTS`), fish and prawn, the sashimi recipes and the generic `C` crate shipped in PR #50, which is `oc2-roadmap-notes.md` steps 1 and 2; OC2 1-1 shipped in PR #51. The tutorial has no catalog record, so salad waits for cucumber.
2. **After throwing and dashing (item 4):** OC1 2-2 (dash stops the rat) and every split kitchen.
3. **Conveyor belts** (8 levels, first in OC1 2-3 and 2-4, then all of OC2 world 4): `TileType 'conveyor' | 'conveyorFloor'`, `Tile.dir` and `speed`, a `conveyors` dynamic with optional reversal and buttons, belts ending in bins, cookware respawn after trashing (generalise `pendingPlateReturns`).
4. **Moving platforms and fall penalties** (7 levels, first in OC1 2-1's trucks and 3-3): a `platform` dynamic that moves a `group` of floor tiles along a path with a render offset (reuse the `SliderGroup` offset shape), `gap` tiles from item 4.
5. **Fryer and fish and chips** (OC1 world 3): `TileType 'fryer'`, `PotItem.ware: 'basket'`, recipes from `docs/research/oc1-recipes.md`; slippery floors as a `friction` tile field for 3-1 and 3-4.
6. **Oven and pizza** (OC1 4-1, 4-4; 9 levels overall with OC2): `TileType 'oven'`, dough as a carrier item, `Recipe.steps` per ingredient (the prep-chain redesign in `oc2-roadmap-notes.md` step 6, which also unlocks pasta, burritos and OC2 burgers).
7. **Haunted Halls gimmicks** (OC1 4-2 darkness with light cones, 4-3 furniture that relocates): presentation-only for 4-2 (a darkness pass in the renderer), a `relocate` dynamic for 4-3.
8. **Burritos, buttons, moving rooms, lava** (OC1 world 5): rice and tortilla ingredients, `button` and pressure-plate tiles bound to gate groups, a `room` dynamic that carries floor and stations between docks, lava as `gap` with a different look, the 5-2 cannon.
9. **Mixer and steamer** (8 OC2 levels and all eight Kevin levels): `TileType 'mixer'` with a permanent-break failure mode, `ware: 'steamer'`.
10. **World 6 and the named levels**: rotating chambers, counter circuits, per-player-count layouts, two full station sets, scripted phases and meteors for The Peckening.

Each new station is an additive `TileType` in `src/sim/types.ts`, a `LEGEND` char in `src/levels/schema.ts`, a model role in `src/art/models.json`, tile code in `src/game/render/three/tiles.ts`, and an `SfxName` if it makes a sound. Keep the extension characters from the catalog README when the clone adopts a station, so catalog grids stay valid.

## 6. More Kenney kits for backgrounds and levels — M, parallel with 5
What exists: six CC0 kits in `assets/` (KayKit Restaurant Bits, 37 roles used of 144 pieces; Kenney Animated Characters; Food Kit, 2 of 201 models used; Car Kit, 4 of 51; Furniture Kit, 1 of 140; Platformer Kit, 5 characters). `src/art/models.json` maps a role to a file and a normaliser; `npm run models` copies only referenced files into `public/models/`. Themes are three `ThemeDressing` entries in `src/game/render/three/tiles.ts` (`default`, `treacle-town`, `savoury-seas`): backdrop colour, floor, optional back wall with windows. Road tiles at an edge get asphalt and parked cars regardless of theme.

Build:
- **Theme dressing as data.** Move `ThemeDressing` to a per-theme prop list (backdrop, floor material, wall pieces, props placed off the grid with position and rotation, ambient tint) so a theme is a manifest entry, not renderer code. `LevelDef.theme` is already a free string.
- **One kit per world theme.** Kit names below are from memory; confirm the current name and licence on kenney.nl before vendoring, and vendor only the pieces the manifest references.
  - Treacle Town and Ravenous Roads (OC1 worlds 1 and 2): Kenney City Kit (roads, suburban and commercial buildings) for the street beyond the grid; the trucks in 2-1 from the Car Kit already vendored.
  - Savoury Seas (1-3, 3-2, 6-1): Kenney Pirate Kit for hull, mast, barrels and water; the ship deck floor exists today.
  - Glazed Glacier (world 3): Kenney Nature Kit snow and ice pieces, Holiday Kit for the lodge.
  - Munch Mansion (world 4): Kenney Graveyard Kit and Castle Kit.
  - Melting Magma and Cosmic Canteen (worlds 5 and 6): Nature Kit rocks with an emissive lava plane; Kenney Space Kit.
  - Overcooked 2 themes (Sushi City, Buffet Balloons, Ravenous Rapids, Moreish Mines, Conjurer's Kitchen, Gourmet Galaxy): City Kit, Nature Kit, Mini Dungeon, Fantasy Town Kit, Space Kit.
  - Stations the kitchen lacks (fryer, oven, mixer, steamer, belts): audit the unused 107 KayKit pieces and the Furniture Kit first; Kenney publishes a Conveyor Kit for belts.
  - Ingredients: audit the Food Kit's 201 models against `docs/research/catalog/recipes.json` before modelling anything by hand.
- **Per-theme props already planned in the art item:** fridge, hood and shelves from KayKit along the back wall; order-card icons rendered from the 3D dishes.
- Files: `assets/<kit>/`, `src/art/models.json`, `src/art/models.ts` (roles), `src/game/render/three/tiles.ts`, `tests/art.test.ts` (every role resolves to a file in `public/models/`).

## 7. Custom characters and making your own — M
What exists: `CHEF_SKINS` in `src/art/models.ts` (15 entries, shape `{ name, model, url?, clips?, color, textColor }`). Entries 0 to 9 are one Kenney rig with a swapped 1024x1024 texture: six aprons painted by `tools/make-chef-skins.py` (region boxes plus a hue window on a stock skin) and four stock skins. Entries 10 to 14 are Platformer Kit creatures with their own `idle` and `sprint` clips and no head bone, so no toque. `tools/export-chef.py` retargets the Kenney clips onto the model rig by world-space constraints and bakes `public/models/chef/chef.glb` (the `jump` clip is baked but unused). The Chefs page cycles `CHEF_SKINS` and never lets two players share one. Pedestrians draw from the same skin pool.

Build, in this order:
1. **In-game character maker (no tools needed).** A "Make your own" entry per player on the Chefs page: apron colour, trousers, shoes, hat on or off, base body from the four stock textures. The renderer paints the texture at load on a canvas using the same region boxes as the Python script, so the maker and the shipped skins agree. Saved in settings as an optional `custom` skin per player; `ChefSkin` gains an optional `paint` field. Shows up in the picker as "Custom" with the live 3D preview the page already has.
2. **More Kenney skins and rigs.** Kenney's other animated character packs reportedly share this rig and UV layout; if that checks out they are texture-only additions to `CHEF_SKINS` and the skin script. Blocky or Mini character packs would follow the creature path (own mesh, own clips).
3. **Your own model.** Document and support a `public/models/chef/custom/` folder: glTF 2.0, y-up, about 1.4 units tall or a `height` normaliser in `src/art/models.json`, clips named `idle` and `run` (or a `clips` map), a head bone named like Kenney's to receive the toque. Blender path: import the Kenney rig, sculpt or repaint, `npm run chef` to rebake; other rigs go through the constraint-and-bake retarget in `tools/export-chef.py`.
4. **Emotes and the idle jump.** The baked `jump` clip is free to use on the results screen.
- Tests: `tests/game.settings.test.ts` (`cycleChef` vs `CHEF_SKINS`), `tests/art.test.ts` (every skin url exists).

## 8. Procedurally generated kitchens — L
Position change: the previous roadmap put this last because layouts need a scorer to be fun. That is still true, but the catalog now gives a corpus to learn from (74 records with `features`: floor, counter and station tile counts, longest walk, chokepoint width, recipe steps, split kitchen), the grid sizes cluster tightly (13x8 most common, then 15x8 to 15x12), and `validateLevel` plus the reachability tests already reject broken layouts. Nothing in `src/levels` or `src/sim` is random today; the sim's only RNG is `mulberry32` in `src/sim/rng.ts`, used for order picks and fire spread.

Build in stages, each shippable:
1. **Generator v1**: `src/levels/generate.ts`, pure and seeded with the same `mulberry32`. Pick a canvas from the catalog size distribution; pick a room template (open rectangle, ring corridor like 1-5, split kitchen with a pass-through counter, two rooms joined by sliders); place the station set the chosen recipe family needs (soups: crates, boards, stoves, sink, drying, serve, return, trash, extinguisher; burgers add pans and bun, lettuce, tomato crates); fill the remaining edge with counters; place spawns; run `validateLevel` and the reachability check; reject and retry. Output is a normal `LevelDef`, so the sim, renderer and tests need no changes.
2. **Score and select**: cheap heuristics from the catalog ranges (longest walk 8 to 14 tiles, chokepoint at least 1, stations spread across at least two walls, no station reachable from only one tile), generate N, keep the best. Then a bot-driven throughput estimate: the sim is pure and headless, so a greedy bot can play a hundred kitchens a second and the median serve time sets the order cadence, patience and star thresholds instead of guesses.
3. **Level select row**: "Random kitchen" with the existing seed modes, so a Daily kitchen is the same for everyone; theme picked from the dressing list; results kept in a separate progress record so authored stars stay meaningful.
4. **Dynamics by template**: sliders and gates can be placed by the template; pedestrians need road lanes at an edge, which the street dressing already handles.
- Tests: `tests/levels.generate.test.ts` runs a thousand seeds through `validateLevel` and the reachability check and asserts the feature ranges.
- Risk: fun is not guaranteed, which is what stage 2 exists for. Ship stage 1 behind free play and gather F8 notes.

## 9. Replayability without procedural layouts (partly done)
- Shipped: seeded order sequences with random, daily and fixed modes; four presets; assists.
- Next: a per-level best-time record and a daily-seed leaderboard on the results screen (local, in `src/game/progress.ts`); station swaps within slots and fewer plates as modifiers (both fold into the custom difficulty group from item 2).

## 10. Two devices on the LAN — L
- `server.mjs` grows a WebSocket endpoint (Node's built-in client exists; the server side needs a small handshake or one dependency, decide then).
- Host runs the authoritative `Sim`; clients send `PlayerInput` at 60 Hz and receive `SimState` snapshots at 30 Hz. LAN latency is 1 to 3 ms, so no prediction is needed. The pure `Sim` and JSON-serialisable `SimState` were designed for this.

## 11. Authoring tools — S each
- **Catalog to LevelDef converter**: `tools/catalog-to-level.mjs <id>` writes `src/levels/<game>/<id>.json` from the catalog record, mapping the shared legend characters and listing the extension characters it could not map, so a level is a five-minute job once its mechanics exist.
- **Tiled import**: only once several people author levels; the ASCII grid is faster for one person.
- Level JSON hot reload already exists (`npm run dev`, edit the file, the kitchen rebuilds).

## 12. Art and sound remaining
- Done today: steam over cooking pots, the knife chop animation, level themes with a back wall and windows, the ship deck on water, taller chefs with a toque sized from the head bone, street asphalt and parked cars, low-fx mode under browser automation.
- Next: order-card icons rendered from the 3D dishes; per-theme props (folded into item 6); recorded CC0 SFX behind `src/audio/types.ts` with the synth as fallback; per-level music themes (one loop today).

## 13. Reskin to a different theme — M for the look, M for the rename, after the station set settles
What exists: the cooking vocabulary is the domain model, not a skin. `IngredientType`, `DishType`, the `TileType` names (stove, sink, board, plateReturn, plateStack), `PotItem` and `PlateItem`, the chef actions `chopping` and `washing`, every `SfxName`, the `TEX` keys in `src/art/keys.ts`, the model roles in `src/art/models.json` and the `LEGEND` letters in `src/levels/schema.ts` all carry it. Counted on 2026-09-09: every sim file, 23 of 30 game files, all of art and levels, 3 of 5 audio files, 11 test files, the per-arm `CLAUDE.md` files and the docs. Player-facing copy is already data (`Recipe.name`, `LevelDef.title` and `theme`), so nothing in the sim has to change for the player to see another theme.

When: after item 5 has added the stations the chosen levels need (conveyor, fryer, oven, mixer, steamer) and the set stops growing, and after item 6 has made theme dressing data. Renaming earlier means every level transcription translates the catalog's cooking words in your head and every new station gets named twice. The rename is a whole-repo PR whichever day it happens (contracts are additive-only, so a rename touches every consumer), and its size grows linearly with the station count, so waiting costs little.

Do now, cheap, to keep the door open:
- Pick the theme and write the noun map into `docs/THEME.md`: ingredient, chop, cook, burn, fire and extinguisher, plate, dirty plate, wash, serve, trash, order, chef. A mechanic with no natural counterpart (dirty plates and fire are the usual casualties) is a mechanics change, not a reskin; decide it before more levels build on that mechanic.
- Keep player-facing copy in data (`Recipe.name`, level `title` and `theme`); no new hard-coded cooking copy in `src/game/scenes/`.
- Start item 6 with its "theme dressing as data" step; that is most of the visual reskin.

Build, in two layers:
1. **Presentation reskin** (art, audio and game arms; runs in parallel with anything): model roles in `src/art/models.json` then `npm run models`; the synth or recorded SFX in `src/audio/`; recipe names in `src/sim/recipes.ts`; HUD and menu copy in `src/game/scenes/`; the dressing manifest from item 6; `README.md` and the title. The player sees the new theme with the sim untouched.
2. **Vocabulary rename** (integrator, all arms idle, one PR): the unions in `src/sim/types.ts`, `LEGEND`, `TEX`, `SfxName`, the model roles, the level JSON, the tests, the per-arm `CLAUDE.md` files and `docs/`. Mechanical: a search-and-replace pass over the fixed word list in `docs/THEME.md`, then `npm test` and `npm run build`. Leave the catalog's cooking words in `docs/research/` as they are; the catalog-to-LevelDef converter (item 11) carries the map.

Caveat: a reskin does not change that the layouts are Overcooked's. If distance from the original is the goal, the levels matter more than the nouns.

## Known gaps in the current build
- Order cadence, timeout and tip amounts are estimates; the wiki publishes none (`docs/research/sim-constants-recommendations.md`). Tune by play.
- 1-3's 1-star and 2-star thresholds are derived, not published (`docs/LEVELS.md`).
- No reset-progress entry (item 9).
- Gamepad paths are unit-tested against fake pads only; use the Controllers screen to verify yours.
- 35 of the 74 catalog grids are low confidence and want a better screenshot before transcription.
- One music loop for every level; the chef's baked `jump` clip is unused.
