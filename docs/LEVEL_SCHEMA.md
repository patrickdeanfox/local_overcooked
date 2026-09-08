# Level JSON schema (v1)

One JSON file per level under `src/levels/<game>/`. Type: `LevelDef` in `src/levels/schema.ts`. Validate with `validateLevel()` (tests run it over every level).

## Grid
`grid` is an array of equal-length strings, one character per tile, y down. Fixed legend:

| Char | Tile | Notes |
|---|---|---|
| ` ` (space) | void | outside the kitchen, solid |
| `.` | floor | walkable |
| `~` | road | walkable; pedestrians use it (1-2 crosswalk) |
| `#` | counter | holds one item |
| `O` `T` `M` | crate | onion / tomato / mushroom source |
| `B` | board | chopping board |
| `S` | stove | burner, starts with an empty pot |
| `W` | sink | wash dirty plates |
| `D` | drying | clean plates come out here, must touch the sink |
| `R` | plateReturn | dirty plates arrive here after a serve (`plates.mode: sink`) |
| `V` | serve | serving counter |
| `X` | trash | |
| `E` | counter | starts with a fire extinguisher on it |
| `P` | plateStack | `plates.mode: stack`: clean plates respawn here |
| `p` | counter | starts with a clean plate on it |
| `1`–`4` | slider | moving counter in group 1–4, driven by a `sliders` dynamic |

`stations` can override any cell (`{x, y, type?, ingredient?, group?}`); `items` can place items (`{x, y, item, count?}`).

## Fields
- `id` (`oc1-1-1`), `name` (`1-1`), `game` (`oc1`|`oc2`|`custom`), `world`, `index`, `theme`, `source` (wiki URL).
- `timeLimitSec`, `timerStartsOnFirstServe` (1-1 has prep time).
- `recipes`: ids from `src/sim/recipes.ts`. Orders are drawn from this list.
- `orders`: `{initial, intervalSec, max, timeSec}`.
- `stars`: `{"1": [s1, s2, s3], "2": [s1, s2, s3]}` score thresholds by player count.
- `plates`: `{mode: 'sink' | 'stack', count}`.
- `spawns`: chef start tiles, index = player.
- `dynamics` (optional):
  - `{type: 'pedestrians', lanes: [{from, to}], intervalSec, speed, firstDelaySec?}`
  - `{type: 'sliders', group, axis, amplitude, periodSec, phase?}`

## Authoring method
1. Download the wiki screenshot (see CLAUDE.md), convert to PNG, view it.
2. Count tiles along the top counter row and the left column; perspective widens the bottom row, so anchor on counters, not pixels.
3. Write the grid; run `npm test` (validation) and `npm run dev` to walk it with the keyboard.
4. Copy timers and star thresholds from the level page infobox and star chart.
