# Roadmap

Where the game goes after the first playable build (Overcooked 1 levels 1-1 to 1-3, two players on one screen). Ordered by value per effort. Each item names the files it touches so a future session can start without re-deriving the plan.

## 1. Tune the first three levels
- Apply `docs/research/sim-constants-recommendations.md` to `src/sim/constants.ts`.
- Play each level with two people; measure seconds per served dish; adjust `orders` settings per level JSON until 3 stars is hard but reachable (see `docs/LEVELS.md` tuning knobs).
- Fix feel issues first: chef speed, interaction reach, chop and wash times.

## 2. Level select, stars, progress
- `TitleScene` gets a world map style list with stars earned per level; progress in `localStorage` under a new `STORAGE_KEYS.PROGRESS`.
- Unlock rule from the wiki: next level opens at the star total listed in each level's infobox (`unlock` field in `docs/research/oc1-levels.md`).

## 3. Rest of Overcooked 1
- Transcribe worlds 1-4 to 6-4 from `docs/research/screens/oc1/` using `docs/LEVEL_SCHEMA.md`. World 1 first (1-4 burgers, 1-5 soup, 1-6 burger).
- New mechanics in order of first appearance (see `docs/research/oc1-levels.md` and `oc1-recipes.md`): burgers (frying pan on stove, buns, lettuce, tomato, assembly on a plate), fish and chips (fryer), pizza (oven), burritos, then level gimmicks (moving trucks in world 2, ice floors in world 3, dark kitchen and rat in world 4, lava and conveyor belts later).
- Each new station is an additive `TileType` in `src/sim/types.ts`, a legend char in `src/levels/schema.ts`, a texture key in `src/art/keys.ts`, and drawing code in `src/art/`.

## 4. Overcooked 2 mechanics
- Order and effort from `docs/research/oc2-roadmap-notes.md`: throwing (ingredients only, straight line, lands on the first solid tile or chef), dash, then multi-step recipes and new appliances.
- Throw and dash need one new `PlayerInput` action each (`throwPressed`, `dashPressed`, optional fields), a `GameAction` in `src/input/types.ts`, and a `Projectile` list in `SimState`.
- OC2 levels transcribe with the same schema; dynamic levels (moving platforms, portals) become new `Dynamic` variants.

## 5. Replayability without procedural layouts
- Randomised order sequences per seed (already seeded in `src/sim/rng.ts`); a "daily seed" mode.
- Difficulty modifiers on authored kitchens: shorter timers, more concurrent orders, fewer plates, station swaps within slots. Expose as an optional `modifiers` block in `LevelDef`.
- Full procedural kitchens are deliberately last: layouts need a throughput/pathing scorer to be fun, which is a bigger project than the game. Revisit only after 20+ authored levels exist.

## 6. Two devices on the LAN
- `server.mjs` grows a WebSocket endpoint (Node's built-in `WebSocket` client exists; the server side needs a small handshake implementation or one dependency, decide then).
- Host runs the authoritative `Sim`; clients send `PlayerInput` at 60 Hz and receive `SimState` snapshots at 30 Hz. LAN latency is 1-3 ms, so no prediction is needed. The pure `Sim` and JSON-serialisable `SimState` were designed for this.

## 7. Art and sound upgrades
- Swap code-drawn textures for generated sprites behind `src/art/keys.ts`: a pixel-art MCP (PixelLab or MagicPixel) generates one chef, then `generate_directions` / rotation for the four facings, then variants for the second colour. Load PNGs in `BootScene` and skip `generateTextures` for keys that loaded.
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
