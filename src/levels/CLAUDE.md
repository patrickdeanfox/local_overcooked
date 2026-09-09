# src/levels — the levels arm

Level JSON (an ASCII grid plus a legend), the schema that types it, the parser and the validator. Research input is the level catalog in `docs/research/catalog/`.

Owner: the levels agent. Files: `src/levels/**`, `tests/levels*.test.ts`, `docs/LEVEL_SCHEMA.md`, `docs/LEVELS.md`. Branch prefix `levels/`. Read `docs/DESIGN.md` once for the whole picture and `docs/WORKFLOW.md` for how PRs land.

## Files
- `schema.ts` — the contract: `LevelDef` and its parts (`OrderSettings`, `LevelStars`, `PlateSettings`, `StationOverride`, `ItemPlacement`, the `Dynamic` union: `pedestrians`, `sliders`, `gate`), `LEGEND` (30 characters, including the generic `C` crate that takes its ingredient from a `stations` override), `SOLID_TILES` (tiles with a wall), `isWalkable` (not solid and not a `gap`), `makeItem`, `parseGrid`, `validateLevel`. Additive changes only.
- `index.ts` — discovers every JSON under this directory with `import.meta.glob`, keys `LEVELS` by the `id` inside the file (not the path), sorts `LEVEL_ORDER` by game, world, index, and exports `DEFAULT_LEVEL_ID`.
- `oc1/1-1.json` to `1-6.json`, `oc1/3-2.json` and `oc2/1-1.json` — the eight shipped levels. 3-2 is the first split kitchen; it and OC2 1-1 use a `stations` override (their plate return is a `plateStack` that starts empty).

## Boundary
- Imports from `src/sim`: ingredient lists, `RECIPES`, `recipeDishType`, and the `Tile`, `Item`, `TileType`, `Ware` types. The sim imports `parseGrid` and `SOLID_TILES` back (a known cycle).
- Consumers: `src/game/levelHotReload.ts` is the only browser module that imports the barrel; every scene reads levels through it. `src/sim/index.ts` and `src/game/debug/fakeState.ts` import `schema` for types and `parseGrid`. Never import `src/levels` from any other browser module or a JSON edit becomes a full page reload.
- `validateLevel` runs only in tests. A broken level loads silently in the browser, so run `npm test` before you look at it.

## The format (details in `docs/LEVEL_SCHEMA.md`)
Required: `id` (`oc1-2-1`), `name` (`2-1`), `game`, `world`, `index`, `theme` (kebab-case), `timeLimitSec`, `timerStartsOnFirstServe`, `recipes`, `orders` (`initial`, `intervalSec`, `max`, `timeSec`), `stars` (`{1: [a,b,c], 2: [a,b,c]}`), `plates` (`mode: 'sink' | 'stack'`, `count`), `grid`, `spawns`. Optional: `source` (wiki URL), `unlockStars`, `stations`, `items`, `dynamics`.

Parser behaviour worth knowing: row 0 sets the width, short rows are padded with void and long rows truncated; an unknown character becomes void; overrides outside the grid are skipped; `makeItem('ingredient')` always yields an unchopped onion; item ids come from a module-global counter, so never assert on them. Legend `G` tiles are always gate group `1` and `1` to `4` are slider groups; other groups need a `stations` override.

## What the tests demand of every level (`tests/levels.test.ts`)
Beyond `validateLevel`: grid at most 16x10; `id` equals `<game>-<world>-<index>` and `name` equals `<world>-<index>`; `source` is an overcooked.fandom.com URL; exactly two distinct walkable spawns; the flood fills from the spawns (gates open) together reach a neighbour of every crate, board, stove, serve and sink, and each spawn on its own reaches a serve and a crate (split kitchens share the rest over a counter); every extinguisher tile has a walkable neighbour; plate items on the grid equal `plates.count`; every recipe resolves and each ingredient has a crate; star triples strictly increase; `orders.timeSec > 1.5 * intervalSec` and `0 < initial <= max`. The `order tuning` block pins each level's four order numbers exactly, so changing them is a deliberate act. World 1 unlocks are pinned to `[0, 2, 4, 5, 6, 8]` and `LEVEL_ORDER` must start with the six world-1 ids. Reuse the helpers: `level(id)`, `reachableFrom`, `countType`, `countCrate`, `stovesWith`, `walkableNeighbours`, `unreachableStations`.

## Adding a level
1. Start from `docs/research/catalog/<game>/<id>.md` and `.json`: the ASCII grid (`grid.ascii`) drops straight into `grid`; `timeLimitSec`, `timerStartsOnFirstServe`, `unlockStars`, `recipes`, `orders`, `plates`, `spawns` map by name; `wiki` becomes `source`; `theme` needs kebab-case; `stars` keeps rows `1` and `2` only and every entry must be a number. Catalog `stations` is a count table, unrelated to `LevelDef.stations`. Catalog `dynamics` are free text; rewrite them as `Dynamic` members. Any extension character in the grid (fryer `Y`, oven `N`, mixer `K`, belts `> < ^ v`, and so on) has no `LEGEND` entry: the level waits on that mechanic. Gaps `_` are in the legend: a hole a throw crosses and a chef falls into. `plates.mode: 'return-clean'` has no equivalent yet; `stack` is the nearest.
2. Write `src/levels/<game>/<world>-<index>.json`. Fill `unlockStars` from the wiki's stars-to-unlock table, which beats the infobox where they disagree.
3. `npm test`; add the level's order numbers to the pinned table and, for a level with a gimmick, a named `describe` block with geometry assertions like the existing six.
4. `npm run dev`, play it; a JSON edit rebuilds the kitchen in place. Headless: `tools/playtest.mjs` with a script in `tools/playtests/`.
5. Add the transcription to `docs/LEVELS.md`: grid, station table, the wiki facts used, uncertainties, tuning notes.

## Reading a screenshot
Counters are the only reliable ruler; the floor texture is not tile-aligned. Single-tile stations (crate, burner, plate return) set the column count. The camera is a fixed perspective, so measure counter seams at two depths, solve for the vanishing point, and convert each station's pixel centre to a column; row boundaries come from the side-wall counters. Items sit raised on their counter, so an item drawn at a given pixel height belongs to the tile one row lower than it looks; that misread produced the unreachable 1-1 extinguisher. AYCE remaster shots share OC1's geometry and double as the tile-count check.

## When a level needs a new mechanic
It leaves this arm. The sim adds the `TileType`, item, ware, ingredient or recipe; presentation draws it; audio names it. Here you then add the `LEGEND` character (keep the catalog's extension character so catalog grids stay valid), the `Dynamic` member, the `validateLevel` rule, and the `docs/LEVEL_SCHEMA.md` row. Order the work by the catalog's `missingMechanics` roll-up (`docs/research/catalog/README.md` has the `jq` lines); `docs/ROADMAP.md` item 5 has the sequence.

## Roadmap work that lands here
Worlds 2 to 6 and Overcooked 2 (`docs/ROADMAP.md` item 5), the generator `src/levels/generate.ts` and its thousand-seed test (item 8), the catalog-to-LevelDef converter (item 11).
