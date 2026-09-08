# Level catalog

One folder per game, one pair of files per level: a Markdown page a person reads and a JSON
file a script reads. Together they hold everything needed to rebuild an Overcooked level in
this clone's `LevelDef` format later, and enough structure that a procedural generator can
learn the shape of the series from them.

This is research, not content. Nothing here is loaded by the game. The shipped levels live in
`src/levels/`, and `docs/LEVELS.md` records how the six that exist were transcribed.

## What is here

```
docs/research/catalog/
  README.md            this file
  oc1/<level-id>.md    one page per Overcooked! 1 level
  oc1/<level-id>.json  the same facts, machine-readable
  oc2/<level-id>.md    the same for Overcooked! 2
  oc2/<level-id>.json
```

`<level-id>` is the level's id in `LevelDef` form: `oc1-1-1`, `oc1-2-3`, `oc2-4-6`,
`oc2-k-3` for the Kevin levels, and `oc1-intro` and `oc1-peckening` for the two named ones.
The `.md` and `.json` for a level always agree; if they disagree the `.md` is the one that was
written from the sources and the `.json` is the transcription mistake.

Read these first, and do not duplicate them:

- `docs/research/oc1-levels.md`, `oc2-levels.md` — the master tables (time, recipes, gimmick,
  stars, wiki link, screenshot) and a paragraph of layout notes per level.
- `docs/research/oc1-recipes.md`, `oc2-recipes.md` — recipes and their prep steps.
- `docs/research/oc1-mechanics.md`, `oc2-mechanics.md` — timings, scoring, obstacles.
- `docs/research/screens/oc1/*.jpg`, `screens/oc2/*.jpg` — the screenshots the grids were
  counted from. Most OC1 shots are *All You Can Eat* remaster captures: the layouts are
  faithful, the art is not.
- `docs/LEVEL_SCHEMA.md` — the grid legend the clone actually implements.

## The Markdown template

Every page uses exactly these headings, in this order.

````markdown
# <oc1|oc2> <level name> — <world theme>
Source: <wiki URL> · Screenshots: <file names under docs/research/screens/>

## Facts
- Time limit; timer start rule (immediately, or on first serve); unlock requirement; player counts supported
- Recipes and order variants; order pattern if the wiki states one (initial tickets, cadence, max on screen); `(estimate)` otherwise
- Star thresholds by player count, with provenance (OC1 original vs AYCE vs AYCE-Switch; OC2 base)
- Plates: sink and dirty return, or clean respawn; initial plate count and where they start

## Layout
- Grid size: <cols> x <rows>, counted from <screenshot>; method (counter seams, station count along a row); confidence high/med/low
- ASCII grid using the legend in docs/LEVEL_SCHEMA.md plus the extension characters below. One row per line, all rows equal length, y down, in a fenced code block.
- Legend extensions used: list each extension char and what it stands for on this level
- Station inventory: counts per type (boards, burners with pots, burners with pans, fryers, ovens, mixers, steamers, sinks, serve counters, plate returns, bins, extinguishers, plates, crates per ingredient, plain counters)
- Spawns: best-guess start tiles per chef
- Zones: name each walkable region, list its stations, and say how items cross between zones (walk, throw, conveyor, moving platform, portal, rope, none)

## Dynamics
- Every moving or scheduled element: what moves, path, period, phase, time-based triggers, hazards (meteors, rats, lava, wind, cars, traffic). Numbers from the wiki, or `(estimate)`.

## Cooperation notes
- Intended division of labour, the bottleneck, and what the wiki overview or strategy section says

## Recreate checklist
- Mechanics this clone lacks that the level needs, in the order they matter (new station types, new dynamics, new recipes).
````

What the clone has today, for the last section: soups (onion, tomato, mushroom), burgers, and
the stations `pot`, `pan`, `board`, `sink`, `drying rack`, `plate return`, `plate stack`,
`crates`, `trash`, `extinguisher`, plus pedestrians on roads, sliding counter groups and timed
gates. Nothing else. Anything a level needs beyond that list belongs in the checklist.

## The JSON keys

Use `null` when a value is unknown. Never invent a number without naming its key in
`estimates`.

```json
{
  "id": "oc1-2-1", "game": "oc1", "world": 2, "index": 1, "name": "2-1", "theme": "Ravenous Roads",
  "wiki": "https://...", "screenshots": ["oc1/2-1.jpg"],
  "timeLimitSec": 240, "timerStartsOnFirstServe": false, "unlockStars": 10, "players": [1, 2, 3, 4],
  "recipes": ["meat_burger", "lettuce_burger", "tomato_lettuce_burger"], "orderVariants": 3,
  "orders": { "initial": 2, "intervalSec": 20, "max": 4, "timeSec": 60 },
  "stars": { "1": [null, null, 180], "2": [null, null, 240], "3": null, "4": null },
  "starsProvenance": "oc1",
  "plates": { "mode": "stack", "count": 3 },
  "grid": { "cols": 13, "rows": 7, "confidence": "med", "ascii": ["#####...", "..."] },
  "legendExtensions": { "Y": "fryer" },
  "stations": {
    "board": 2, "potBurner": 0, "panBurner": 3, "fryer": 0, "oven": 0, "mixer": 0, "steamer": 0,
    "sink": 0, "serve": 1, "plateReturn": 1, "trash": 1, "extinguisher": 1, "plate": 3,
    "counter": 14, "crates": { "bun": 1, "meat": 1, "lettuce": 1, "tomato": 1 }
  },
  "spawns": [{ "x": 3, "y": 3 }, { "x": 9, "y": 3 }],
  "zones": [
    { "name": "lower truck", "stations": ["board", "crates", "trash", "extinguisher"],
      "links": [{ "to": "upper truck", "via": "throw" }] }
  ],
  "dynamics": [
    { "type": "moving-platforms", "detail": "two trucks drift apart and together", "periodSec": null }
  ],
  "hazards": ["fall-off: 5 s time penalty"],
  "features": {
    "splitKitchen": true, "throwRequired": true, "movingPlatforms": true, "conveyors": false,
    "portals": false, "floorTiles": 40, "counterTiles": 22, "stationTiles": 14,
    "longestWalkTiles": 12, "chokepointWidth": 1, "recipeSteps": 4
  },
  "missingMechanics": ["throwing", "moving platforms"],
  "estimates": ["orders.intervalSec", "dynamics[0].periodSec", "spawns"]
}
```

Key notes:

- `starsProvenance` is one of `oc1`, `ayce`, `ayce-switch`, `oc2`. The OC1 star charts are
  blank for most levels and the editors filled the remaster columns instead; those numbers are
  systematically higher and must be labelled, never shipped as OC1 values. Where only the
  3-star is known, write `[null, null, 180]` rather than guessing the lower two.
- `orders` is almost never on the wiki. Fill it with the clone's own tuned numbers for a level
  of the same shape and list every key you filled under `estimates`.
- `plates.mode` is `sink` when dirty plates come back to a plate return and must be washed,
  `stack` when clean plates respawn at a plate stack, `return-clean` when a return hands back
  clean plates with no sink.
- `zones[].links[].via` is one of `walk`, `walk-when-close`, `throw`, `conveyor`,
  `moving-platform`, `portal`, `rope`, `none`.

### `features`, and how to count them

These exist so a generator can be scored against the real levels. Count them off your own
ASCII grid, so they always agree with it.

| Key | How to count |
| --- | --- |
| `floorTiles` | walkable tiles: `.`, `~`, `G`, `=`, conveyor tiles a chef can stand on |
| `counterTiles` | every non-walkable, non-void tile — plain counters and stations alike |
| `stationTiles` | every tile that is not a plain counter: crates, cookers, sink, serve, return, bin, extinguisher, plate stack |
| `longestWalkTiles` | Manhattan tile distance from the farthest crate to the serve counter, walking through walkable tiles only |
| `chokepointWidth` | the narrowest corridor a chef must pass through to complete a dish, in tiles |
| `recipeSteps` | the most steps any recipe on the level needs; chop, cook, plate and serve each count one |
| `splitKitchen` | true when the walkable floor is not one connected region, or is only connected intermittently |
| `throwRequired` | true when an item must cross a gap no chef can walk |

## Confidence and estimates

Two separate marks, and they mean different things.

- **`grid.confidence`** — `high`, `med` or `low` — is about the ASCII grid only: how sure the
  tile count and station placement are. `high` means the counter seams and single-tile
  stations were countable at two depths and agreed. `med` means the dimensions are solid but
  some stations were placed by reasoning rather than measured. `low` means the screenshot was
  too small, too dark or too oblique to count, and the grid is a sketch of the right shape.
- **`estimates`** is a list of JSON key paths whose values were invented rather than sourced —
  `"orders.intervalSec"`, `"dynamics[0].periodSec"`, `"spawns"`, `"stars.2"`. Anything
  written into the Markdown without a wiki sentence behind it gets an `(estimate)` marker
  there and its key path here. A number that appears in neither place is a wiki fact.

The wiki gives no order cadence, no platform period, no rat timing and no chef start tiles for
any level, so those keys are estimated everywhere. Say so once per level rather than hedging
every sentence.

## Aggregating

Every JSON file is a flat, self-contained record, so the whole catalog loads in one line:

```sh
node -e 'const fs=require("fs"),p="docs/research/catalog";const all=fs.readdirSync(p).flatMap(g=>fs.existsSync(`${p}/${g}`)&&fs.statSync(`${p}/${g}`).isDirectory()?fs.readdirSync(`${p}/${g}`).filter(f=>f.endsWith(".json")).map(f=>JSON.parse(fs.readFileSync(`${p}/${g}/${f}`,"utf8"))):[]);console.log(all.length,"levels");console.table(all.map(l=>({id:l.id,cols:l.grid.cols,rows:l.grid.rows,conf:l.grid.confidence,floor:l.features.floorTiles,steps:l.features.recipeSteps})))'
```

or with `jq`:

```sh
jq -s 'map({id, cols: .grid.cols, rows: .grid.rows, conf: .grid.confidence, missing: .missingMechanics})' docs/research/catalog/*/*.json
```

Useful roll-ups once the catalog is complete:

```sh
# every mechanic the clone still lacks, by how many levels need it
jq -s '[.[].missingMechanics[]] | group_by(.) | map({m: .[0], levels: length}) | sort_by(-.levels)' docs/research/catalog/*/*.json

# grid size distribution, for sizing a generator's canvas
jq -s 'map("\(.grid.cols)x\(.grid.rows)") | group_by(.) | map({size: .[0], n: length})' docs/research/catalog/*/*.json

# which levels are still low-confidence and want a better screenshot
jq -sr '.[] | select(.grid.confidence == "low") | .id' docs/research/catalog/*/*.json
```

## Legend extension characters

The clone's own legend is in `docs/LEVEL_SCHEMA.md`. It covers everything the sim can build
today:

| Char | Tile |
| --- | --- |
| ` ` | void — outside the kitchen, solid |
| `.` | floor |
| `~` | road — walkable, pedestrians use it |
| `#` | plain counter |
| `O` `T` `M` | onion / tomato / mushroom crate |
| `A` `U` `L` | meat (beef) / bun / lettuce crate |
| `B` | chopping board |
| `S` | burner with a pot |
| `F` | burner with a frying pan |
| `W` | sink |
| `D` | drying rack |
| `R` | plate return |
| `V` | serving counter |
| `X` | trash bin |
| `E` | counter holding the fire extinguisher |
| `P` | plate stack — clean plates respawn here |
| `p` | counter starting with a clean plate on it |
| `1`–`4` | sliding counter, group 1–4 |
| `G` | gate — walkable only while its group is open |

Stations and hazards the clone does not have get these extension characters. Every shard uses
the same set, so a future parser only has to learn one table.

| Char | Stands for |
| --- | --- |
| `Y` | deep fryer (with a frying basket unless the page says otherwise) |
| `N` | oven |
| `K` | mixer |
| `Z` | steamer |
| `Q` | burner with no cookware on it |
| `H` | cheese crate |
| `C` | chicken crate |
| `I` | rice crate |
| `J` | fish crate |
| `Ø` | prawn crate |
| `%` | potato crate |
| `&` | flour / dough crate |
| `$` | egg crate |
| `!` | any other crate — name the ingredient under "Legend extensions used" |
| `>` `<` `^` `v` | conveyor belt, arrow pointing the way it carries |
| `@` | portal |
| `=` | bridge, or a walkable moving platform |
| `_` | water, lava or pit — falling in is a hazard |
| `+` | rope or ladder |
| `*` | rat hole |
| `?` | anything else — explain it under "Legend extensions used" |

When a cell carries two facts — a burner that starts with a specific pan, a counter that
starts with an item, a conveyor tile that is also a bin mouth — pick the character for the
station and write the second fact in prose under the grid. The clone's `LevelDef` has
`stations` and `items` overrides for exactly this, and a later transcription will use them.

## Method

1. Fetch the level page wikitext: infobox first (time, recipes, obstacles, dynamic, plates,
   unlock), then Overview, Recipes, Strategies and the Star Chart. Note the infobox fields
   verbatim; they are terse and often the only hard numbers on the page.
2. Read the screenshot. Count tiles by counter seams along the top row and the left column.
   Single-tile stations — a crate, a burner, a plate return — are the ruler; floor texture is
   not tile-aligned and will mislead you. Perspective widens the bottom row, so measure at two
   depths and check the ratio holds for the same column count.
3. Write the ASCII grid. Re-read the screenshot and check every station is on the grid exactly
   once, with the right neighbours. Set `grid.confidence` honestly.
4. Fill both files, then cross-check the station counts in `stations` against the characters in
   the ASCII grid. They must agree.

Screenshots: do not commit new ones unless the level has none in `docs/research/screens/`. If
you add one, store it as JPEG quality 88 beside the others —
`docs/research/tools/fetch_wiki.py download "File:<name>" out.jpg` does the conversion.
