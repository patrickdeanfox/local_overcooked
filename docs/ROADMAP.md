# Roadmap

Where the game goes after the current build (Overcooked 1 world 1, levels 1-1 to 1-6, two players on one screen, level select with saved stars, difficulty presets, seeded orders). Ordered by value per effort. Each item names the files it touches so a future session can start without re-deriving the plan.

Done so far: first playable (1-1 to 1-3), research docs, headless playtest harness, https LAN server, desktop launcher, level select with progress and unlocks, difficulty presets and seed modes, burgers with frying pans, the earthquake gate, levels 1-4 to 1-6.

## 1. Tune world 1 by play
- Apply `docs/research/sim-constants-recommendations.md` to `src/sim/constants.ts`.
- Play each level with two people; measure seconds per served dish; adjust `orders` settings per level JSON until 3 stars is hard but reachable (see `docs/LEVELS.md` tuning knobs).
- Fix feel issues first: chef speed, interaction reach, chop and wash times.

## 2. Level select, stars, progress (done)
- Shipped: `src/game/progress.ts`, `settings.ts`, `ui/LevelList.ts`. Remaining polish: a world-map look, per-level best times, a "reset progress" entry.

## 3. Rest of Overcooked 1
- Transcribe worlds 2-1 to 6-4 from `docs/research/screens/oc1/` using `docs/LEVEL_SCHEMA.md`. World 2 is burgers and soups on moving trucks (a 'sliders'-style dynamic for the two trucks plus a fall-off penalty), so it needs one new dynamic and no new recipes.
- New mechanics in order of first appearance (see `docs/research/oc1-levels.md` and `oc1-recipes.md`): fish and chips (fryer basket, world 3), pizza (dough, cheese, oven, world 4), burritos (rice pot + pan, world 5), then level gimmicks (ice floors in world 3, dark kitchen and rat in world 4, lava and conveyor belts later).
- Each new station is an additive `TileType` in `src/sim/types.ts`, a legend char in `src/levels/schema.ts`, a texture key in `src/art/keys.ts`, and drawing code in `src/art/`.

## 4. Overcooked 2 mechanics
- Order and effort from `docs/research/oc2-roadmap-notes.md`: throwing (ingredients only, straight line, lands on the first solid tile or chef), dash, then multi-step recipes and new appliances.
- Throw and dash need one new `PlayerInput` action each (`throwPressed`, `dashPressed`, optional fields), a `GameAction` in `src/input/types.ts`, and a `Projectile` list in `SimState`.
- OC2 levels transcribe with the same schema; dynamic levels (moving platforms, portals) become new `Dynamic` variants.

## 5. Replayability without procedural layouts (partly done)
- Shipped: seeded order sequences with random / daily / fixed modes and four difficulty presets (`src/game/settings.ts`, `Modifiers` in `src/sim/types.ts`).
- Next: per-level leaderboards for the daily seed, station swaps within slots, fewer plates as a modifier.
- Full procedural kitchens are deliberately last: layouts need a throughput/pathing scorer to be fun, which is a bigger project than the game. Revisit only after 20+ authored levels exist.

## 6. Two devices on the LAN
- `server.mjs` grows a WebSocket endpoint (Node's built-in `WebSocket` client exists; the server side needs a small handshake implementation or one dependency, decide then).
- Host runs the authoritative `Sim`; clients send `PlayerInput` at 60 Hz and receive `SimState` snapshots at 30 Hz. LAN latency is 1-3 ms, so no prediction is needed. The pure `Sim` and JSON-serialisable `SimState` were designed for this.

## 7. Art and sound upgrades (art done: full 3D)
- Done: the kitchen is a Three.js scene behind Phaser's transparent canvas, built from CC0 Kenney and KayKit glTF kits (`src/art/models.json`, `src/game/render/three/`). Chefs are the Kenney animated character with painted apron skins and baked idle/run clips. Levels dress by `theme` (back wall with windows, ship deck on water).
- Next art steps: order-card icons rendered from the 3D dishes; steam over cooking pots; a chopping pose for the chef; per-theme props from the kits (fridge, hood, shelves); Kenney Car Kit trucks for world 2.
- Replace synthesised SFX with recorded CC0 samples behind `src/audio/types.ts`; keep the synth as fallback.

## 8. Authoring tools
- Tiled import: a script that converts a Tiled JSON map with a `stations` object layer into `LevelDef`. Only worth it once several people author levels; the ASCII grid is faster for one person.
- In-game level JSON hot reload already exists (`npm run dev`, edit the file, the kitchen rebuilds).

## Known gaps in the first build
- Order cadence, timeout and tip amounts are estimates; the wiki publishes none of them (`docs/research/sim-constants-recommendations.md`). Tune by play.
- 1-3's 1-star and 2-star thresholds are derived, not published (`docs/LEVELS.md`).
- Pedestrians are grey-tinted chefs; fire, smoke and spray are single frames animated by scale and alpha.
- Gamepad paths are unit-tested against fake pads only; no physical pad was available while building. Use the Controllers screen to verify yours.
- One music loop for every level; no per-level themes.
