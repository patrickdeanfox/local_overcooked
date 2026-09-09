# docs/research — the research arm

Facts about the original games, gathered from the Overcooked wiki, in the shape the other arms need. Research, not content: nothing here is loaded by the game.

Owner: research agents. Files: `docs/research/**`. Branch prefix `research/`. Read `docs/DESIGN.md` once and `docs/WORKFLOW.md` for how PRs land.

## What is here
- `oc1-levels.md`, `oc2-levels.md` — the master tables (time, recipes, gimmick, stars, wiki link, screenshot) with a paragraph of layout notes per level.
- `oc1-recipes.md`, `oc2-recipes.md` — recipes and prep steps. `oc1-mechanics.md`, `oc2-mechanics.md` — timings, scoring, obstacles.
- `oc2-roadmap-notes.md` — how each OC2 mechanic maps onto this codebase, additively, with effort marks. `sim-constants-recommendations.md` — numbers for `src/sim/constants.ts` with provenance.
- `catalog/` — one `.md` and one `.json` per level, 30 for OC1 and 44 for OC2, in the template and extended legend described in `catalog/README.md`; `catalog/recipes.json` for both games' recipes. The `.md` is written from the sources; if the `.json` disagrees, the `.json` is the mistake.
- `screens/oc1/`, `screens/oc2/` — the screenshots the grids were counted from, JPEG quality 88. `tools/fetch_wiki.py` fetches pages and images.

## Sources and method
- The wiki blocks plain fetches. Use the MediaWiki API with curl and a browser user agent, as the root `CLAUDE.md` shows; images come back WebP and need converting with Pillow before viewing.
- Infobox first (time, recipes, obstacles, dynamic, plates, unlock), then Overview, Recipes, Strategies, Star Chart. Note the infobox verbatim: it is terse and often the only hard numbers.
- Counters are the ruler; the floor texture is not tile-aligned. Measure counter seams at two depths, solve the vanishing point, convert station centres to columns. Say `(estimate)` for any number without a wiki sentence behind it, and list its key path under `estimates` in the JSON.
- OC1 star charts are often blank and editors filled the remaster columns instead; those numbers are higher and carry `starsProvenance: ayce` or `ayce-switch`. Never ship them as OC1 values.

## Rules
- Do not duplicate the master tables inside catalog pages; link to them.
- Keep the extension legend in `catalog/README.md` the single table for stations the clone lacks. When the clone adopts a station, the levels arm keeps the same character.
- Do not commit a new screenshot when the level already has one.
- Adding a level to the catalog: both files, all headings in template order, `features` counted off your own grid, `missingMechanics` against the clone's current legend.

## Who reads this
The levels arm transcribes from the catalog (`src/levels/CLAUDE.md`), the sim arm reads the mechanics notes and the constants recommendations, the roadmap's level ordering comes from the catalog's `missingMechanics` roll-up (the `jq` lines in `catalog/README.md`), and the procedural generator (roadmap item 8) learns its size and feature ranges from `features`.
