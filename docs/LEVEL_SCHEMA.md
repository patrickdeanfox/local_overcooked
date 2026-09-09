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
| `B` | board | chopping board |
| `S` | stove | burner, starts with an empty pot |
| `F` | stove | burner, starts with an empty frying pan (fries one chopped meat) |
| `G` | gate | floor that is walkable only while gate group `1` is open (1-6 earthquake); needs a `gate` dynamic |
| `W` | sink | wash dirty plates |
| `D` | drying | clean plates come out here, must touch the sink |
| `R` | plateReturn | dirty plates arrive here after a serve (`plates.mode: sink`) |
| `V` | serve | serving counter |
| `X` | trash | |
| `E` | counter | starts with a fire extinguisher on it |
| `P` | plateStack | `plates.mode: stack`: clean plates respawn here |
| `p` | counter | starts with a clean plate on it |
| `1`–`4` | slider | moving counter in group 1–4, driven by a `sliders` dynamic |

`stations` can override any cell (`{x, y, type?, ingredient?, group?}`); `items` can place items (`{x, y, item, count?, ware?}`, with `ware: 'pan'` turning a placed `pot` into a pan). Legend `G` tiles are always gate group `1` and `1`–`4` are slider groups; a second gate group needs a `stations` override with its `group`.

## Fields
- `id` (`oc1-1-1`), `name` (`1-1`), `game` (`oc1`|`oc2`|`custom`), `world`, `index`, `theme`, `source` (wiki URL).
- `timeLimitSec`, `timerStartsOnFirstServe` (1-1 has prep time).
- `recipes`: ids from `src/sim/recipes.ts`. Orders are drawn from this list.
- `orders`: `{initial, intervalSec, max, timeSec}`.
- `stars`: `{"1": [s1, s2, s3], "2": [s1, s2, s3]}` score thresholds by player count.
- `plates`: `{mode: 'sink' | 'stack', count}`.
- `spawns`: chef start tiles, index = player.
- `unlockStars` (optional): total stars needed before the level appears unlocked (wiki infobox `unlock`). Absent or 0 = always open.
- `dynamics` (optional):
  - `{type: 'pedestrians', lanes: [{from, to}], intervalSec, speed, firstDelaySec?}`
  - `{type: 'sliders', group, axis, amplitude, periodSec, phase?}`
  - `{type: 'gate', group, periodSec, openSec, phase?}`: the group's `gate` tiles are walkable for `openSec` of every `periodSec`, starting open.

Validation (`validateLevel`, run by `npm test`, not at runtime) checks: an `id`, a non-empty rectangular grid of known legend characters, at least two spawns on walkable tiles inside the grid, a serve tile and a crate tile, at least one recipe and every recipe id known; then the recipe-driven rules: every ingredient of every recipe needs a crate, soups need a stove with a pot (`S`) and only soup ingredients, meat needs a stove with a pan (`F`), chopped ingredients need a board; `plates.mode: 'sink'` needs a sink and a plate return, `'stack'` needs a plate stack; `timeLimitSec > 0`, `unlockStars >= 0`; every `sliders` and `gate` dynamic names a group with tiles, every gate group has exactly one dynamic with `0 < openSec < periodSec`, and `pedestrians` need road tiles.

`tests/levels.test.ts` adds gates the validator does not: the grid fits 16x10; `id` is `<game>-<world>-<index>` and `name` is `<world>-<index>`; `source` is an overcooked.fandom.com URL; exactly two distinct spawns; every crate, board, stove, serve and sink is reachable from both spawns; every extinguisher tile has a walkable neighbour; plate items on the grid equal `plates.count`; star triples strictly increase; `orders.timeSec > 1.5 * intervalSec` and `0 < initial <= max`; and each level's four order numbers are pinned in a table so a change is deliberate.

## Authoring method
1. Download the wiki screenshot (see CLAUDE.md), convert to PNG, view it.
2. Count tiles along the top counter row and the left column; perspective widens the bottom row, so anchor on counters, not pixels. Counter seams and single-tile stations (crate, burner, plate return) are the ruler; floor texture is not tile-aligned.
3. For anything ambiguous, measure counter seams at two depths, solve for the vanishing point (tile width grows linearly with screen y), and convert station pixel centres into column indices.
4. Write the grid; run `npm test` (validation, per-level assertions, reachability) and `npm run dev` to walk it with the keyboard.
5. Copy timers and star thresholds from the level page infobox and star chart.

Transcriptions of the shipped levels, with the wiki facts used and the judgement calls made, are in `docs/LEVELS.md`.
