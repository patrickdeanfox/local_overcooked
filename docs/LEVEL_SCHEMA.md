# Level JSON schema (v1)

One JSON file per level under `src/levels/<game>/`. Type: `LevelDef` in `src/levels/schema.ts`. Validate with `validateLevel()` (tests run it over every level).

## Grid
`grid` is an array of equal-length strings, one character per tile, y down. Fixed legend:

| Char | Tile | Notes |
|---|---|---|
| ` ` (space) | void | outside the kitchen, solid |
| `.` | floor | walkable |
| `~` | road | walkable; pedestrians use it (1-2 crosswalk). Mark the crossing lanes only — street the chefs share with nobody stays `.` |
| `#` | counter | holds one item |
| `O` `T` `M` | crate | onion / tomato / mushroom source (soups) |
| `A` `U` `L` | crate | meat (beef) / bun / lettuce source (burgers) |
| `J` `Ø` | crate | fish / prawn source (sashimi, Overcooked 2) |
| `C` | crate | a crate whose ingredient a `stations` override sets (`{ x, y, ingredient }`); the validator rejects one left without |
| `B` | board | chopping board |
| `S` | stove | burner, starts with an empty pot |
| `F` | stove | burner, starts with an empty frying pan (fries one chopped meat) |
| `G` | gate | floor that is walkable only while gate group `1` is open (1-6 earthquake); needs a `gate` dynamic. A closed gate stops chefs but a thrown item flies over it |
| `_` | gap | a hole: no wall, a thrown item flies over it, a chef that steps on it falls, loses what it held and respawns at its spawn after `FALL_PENALTY_SEC` (5 s). Not walkable for spawns or reachability |
| `W` | sink | wash dirty plates |
| `D` | drying | clean plates come out here, must touch the sink |
| `R` | plateReturn | dirty plates arrive here after a serve (`plates.mode: sink`) |
| `V` | serve | serving counter |
| `X` | trash | |
| `E` | counter | starts with a fire extinguisher on it |
| `P` | plateStack | `plates.mode: stack`: clean plates respawn here |
| `p` | counter | starts with a clean plate on it |
| `1`–`4` | slider | moving counter in group 1–4, driven by a `sliders` dynamic |
| `h` | shelf | pass-through shelf (`docs/MECHANICS.md` section 4): a hatch in a wall, a counter reachable from both sides that a throw stops at. With the mechanic off it is a solid wall, so give the level another route |
| `t` | trayRack | counter that starts with the tray on it (section 3). With the mechanic off the tray is removed and the rack is a plain counter |
| `d` | delivery | delivery door (section 5): restocks arrive here and are unloaded with held interact. At most one per level. With the mechanic off it is a solid tile that does nothing |

The three mechanics characters are lowercase so the catalog's uppercase extension characters (`Y` fryer, `N` oven, `K` mixer and so on in `docs/research/catalog/README.md`) stay free for the stations they name.

`stations` can override any cell (`{x, y, type?, ingredient?, group?, stock?}`); `items` can place items (`{x, y, item, count?, ware?}`, with `ware: 'pan'` turning a placed `pot` into a pan, and `item: 'tray'` only on a `trayRack` tile). Legend `G` tiles are always gate group `1` and `1`–`4` are slider groups; a second gate group needs a `stations` override with its `group`. `stock` on a crate sets how many items that crate holds when the 86 system is on, overriding `eightySix.crateSize` and making an otherwise exempt ingredient finite.

Shipped levels adopt a mechanic through `stations`, `items` and `eightySix`, never by editing the grid text, so the grid stays the transcription of the original kitchen.

## Fields
- `id` (`oc1-1-1`), `name` (`1-1`), `game` (`oc1`|`oc2`|`custom`|`tutorial`), `world`, `index`, `theme`, `source` (wiki URL).
- `timeLimitSec`, `timerStartsOnFirstServe` (1-1 has prep time).
- `recipes`: ids from `src/sim/recipes.ts`. Orders are drawn from this list.
- `orders`: `{initial, intervalSec, max, timeSec, first?}`. `first` pins the recipes of the first tickets in order (each must be on the menu); the seed deals the rest. The 86 tutorial uses it so the tomato ticket is up when the tomato crate empties.
- `stars`: `{"1": [s1, s2, s3], "2": [s1, s2, s3]}` score thresholds by player count.
- `plates`: `{mode: 'sink' | 'stack', count}`.
- `spawns`: chef start tiles, index = player.
- `unlockStars` (optional): total stars needed before the level appears unlocked (wiki infobox `unlock`). Absent or 0 = always open.
- `dynamics` (optional):
  - `{type: 'pedestrians', lanes: [{from, to}], intervalSec, speed, firstDelaySec?}`
  - `{type: 'sliders', group, axis, amplitude, periodSec, phase?}`
  - `{type: 'gate', group, periodSec, openSec, phase?}`: the group's `gate` tiles are walkable for `openSec` of every `periodSec`, starting open.
- `eightySix` (optional, `docs/MECHANICS.md` section 5; read only while the 86 mechanic is on): `{crateSize?, restockDelaySec?, exempt?, scripted?}`. `crateSize` is items per crate (`CRATE_SIZE`, 8, when absent), `restockDelaySec` the wait from a shortage to its delivery (`RESTOCK_DELAY_SEC`, 30), `exempt` ingredients whose crates never run out on top of the automatic rule (an ingredient in every recipe of the level is exempt unless a crate override sets `stock`), and `scripted` a list of `{atSec, ingredient}` shortages that empty the ingredient's crates on the clock. A level with no `delivery` tile restocks by itself when the delivery is due.
- `game: 'custom'` marks the clone's own kitchens (`src/levels/custom/`): they carry a title in `name` instead of `<world>-<index>`, have no `source`, and sort after both campaigns.
- `game: 'tutorial'` marks the tutorial kitchens (`src/levels/tutorial/`, one per mechanic): a title in `name`, no `source`, sorted last. The title screen leaves them out of its list; the Tutorials page lists them, and their stars never count toward unlocks.
- `mechanics` (optional): `{ passThroughShelf?, chopAssist?, twoPlateCarry?, eightySix?, tray? }`, switches the level always plays with, on top of whatever the Settings page has on. A tutorial kitchen forces its own; nothing else should need it.
- `tutorial` (optional): the walkthrough the game plays when the level starts. `{ title, intro: string[], steps: [{ text, goal, at?, minPlayers? }], outro? }`. `title` heads the rules panel (the level's `name` is the kicker above it), `intro` lines are the rules on that panel and on the Tutorials page, and `outro` is the banner after the last step. In every text `{pickup}`, `{interact}`, `{throw}` and `{dash}` become the player's own button names. A step shows `text` in the banner along the bottom, hangs a pointer over the tile `at` if given, is skipped in a run with fewer than `minPlayers` players, and is done when its `goal` holds:

  | Goal | Done when |
  |---|---|
  | `{ type: 'event', event, count? }` | `count` (1) sim events of that type have fired since the step began |
  | `{ type: 'holding', kind, count?, load?, zone? }` | some chef holds an item of `kind`: exactly `count` plates in the stack, at least `load` items on the tray, and the chef stands inside the `zone` block `{x, y, w, h}` |
  | `{ type: 'tileItem', x, y, w?, h?, kind }` | an item of `kind` rests on the tile, or on any tile of the `w` by `h` block |
  | `{ type: 'stock', x, y, max }` | the crate at `(x, y)` holds at most `max` items (`0`: it is 86'd) |
  | `{ type: 'served', count }` | `servedCount` has reached `count` |
  | `{ type: 'assisting' }` | a chef is the second pair of hands at a station (chop assist) |
  | `{ type: 'wait', sec }` | `sec` sim seconds have passed since the step began: a step that only explains |

  One frame can finish several steps in a row (the last tomato empties the crate and rewrites the ticket at once); the events of that frame count for the step that follows. Tutorial kitchens set `timerStartsOnFirstServe: true`, so the walkthrough runs on a stopped clock, and end every walkthrough with a `served` goal so the clock starts when it is done.

Validation (`validateLevel`, run by `npm test`, not at runtime) checks: an `id`, a non-empty rectangular grid of known legend characters, at least two spawns on walkable tiles inside the grid, a serve tile and a crate tile, at least one recipe and every recipe id known; then the recipe-driven rules: every ingredient of every recipe needs a crate, soups need a stove with a pot (`S`) and only soup ingredients, meat needs a stove with a pan (`F`), chopped ingredients need a board; `plates.mode: 'sink'` needs a sink and a plate return, `'stack'` needs a plate stack; `timeLimitSec > 0`, `unlockStars >= 0`; every `sliders` and `gate` dynamic names a group with tiles, every gate group has exactly one dynamic with `0 < openSec < periodSec`, and `pedestrians` need road tiles. For the mechanics: a `stock` override sits on a crate and is at least 1; `eightySix.crateSize >= 1`, `restockDelaySec > 0`, every `exempt` and `scripted` ingredient has a crate, `scripted[].atSec >= 0`; at most one `delivery` tile; a `tray` item only on a `trayRack` tile. For tutorials: every `mechanics` key is one of the five switches, every `orders.first` entry is on the menu, a `tutorial` has a title and at least one step, every step has text and a goal, pointers and `tileItem` / `stock` goals sit on the grid, a `stock` goal on a crate, `wait` seconds and `served` counts are positive.

`tests/levels.test.ts` adds gates the validator does not: the grid fits 16x10; `id` is `<game>-<world>-<index>`; for the campaigns `name` is `<world>-<index>` and `source` is an overcooked.fandom.com URL, for `custom` levels `name` is a title and there is no `source`; exactly two distinct spawns; every crate, board, stove, serve, sink, delivery door and tray rack is reachable from both spawns together; every extinguisher tile and every delivery door has a walkable neighbour; every tray rack starts with a tray and there are no other trays; every shelf has walkable tiles on two opposite sides; plate items on the grid equal `plates.count`; star triples strictly increase; `orders.timeSec > 1.5 * intervalSec` and `0 < initial <= max`; the games list in the order Overcooked 1, Overcooked 2, custom, tutorial; and each level's four order numbers are pinned in a table so a change is deliberate. The tutorial kitchens are pinned one per mechanic in the Settings page's order, each forcing exactly its own switch, always open, at most three tickets, within 13 by 6 tiles, with pointers on stations and a `served` goal last; `tests/game.tutorial.test.ts` walks every one of them through the real Sim.

## Authoring method
1. Download the wiki screenshot (see CLAUDE.md), convert to PNG, view it.
2. Count tiles along the top counter row and the left column; perspective widens the bottom row, so anchor on counters, not pixels. Counter seams and single-tile stations (crate, burner, plate return) are the ruler; floor texture is not tile-aligned.
3. For anything ambiguous, measure counter seams at two depths, solve for the vanishing point (tile width grows linearly with screen y), and convert station pixel centres into column indices.
4. Write the grid; run `npm test` (validation, per-level assertions, reachability) and `npm run dev` to walk it with the keyboard.
5. Copy timers and star thresholds from the level page infobox and star chart.

Transcriptions of the shipped levels, with the wiki facts used and the judgement calls made, are in `docs/LEVELS.md`.
