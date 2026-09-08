# oc2 Kevin 8 — Kevin Level
Source: https://overcooked.fandom.com/wiki/Kevin_8 · Screenshots: docs/research/screens/oc2/kevin-8.jpg

## Facts
- Time limit 4:00. Timer starts immediately. Unlock: Accessible from 6-4; solo challenge tip combo 5x, team challenge tip combo 7x. Players 1-4.
- Recipes: Steamed Food, 4 order variants — steamed_fish, steamed_beef, steamed_carrot, steamed_prawn. Order pattern: the wiki gives none, so initial 2, one new ticket every 20 s, at most 5 on screen, 90 s per ticket are all `(estimate)`.
- Star thresholds (1★ / 2★ / 3★ / 4★; the OC2 chart has a fourth column, so these arrays hold four numbers). Provenance: OC2 base game, from the page's Star Chart.
  - 1 player: 180 / 220 / 300 / 700
  - 2 players: 180 / 240 / 320 / 800
  - 3 players: 240 / 300 / 420 / 1040
  - 4 players: 240 / 300 / 420 / 1040
- Plates: infobox `plates = Yes`, so the level has a sink and plates come back dirty. 4 plates on the grid, in the positions the Overview describes.

## Layout
- Grid size: 15 x 12, counted from `kevin-8.jpg`; method: the level-select polaroid is only 382 px wide, so the tile ruler is the single-tile stations (ingredient boxes, mixers, steamers, plates) read along the counter runs, cross-checked against the station list in the wiki Overview. Confidence: **low**.

```
EW#A#Ø#&#!#J#VR
...v.v.v.v.v...
...v.v.v.v.v...
...>>>>v<<<<...
.......v.......
..X<<<<?>>>>X..
.......v.......
.......v.......
.......v.......
.......v.......
.......v.......
ZpZpB##X#BpKpK#
```

- Legend extensions used:
  - `!` — carrot ingredient box
  - `&` — flour ingredient box
  - `<` — conveyor pushing left
  - `>` — conveyor pushing right
  - `?` — the rotating conveyor section that chooses which of the three bins the belt empties into
  - `A/Ø/&/!/J on row 0` — ingredient dispensers, not ingredient boxes — they drop items onto the belt on their own
  - `J` — fish ingredient box
  - `K` — mixer
  - `Z` — steamer (burner carrying a bamboo steamer)
  - `v` — conveyor pushing down
  - `Ø` — prawn ingredient box
- Station inventory: boards 2, pot burners 0, pan burners 0, fryers 0, ovens 0, mixers 2, steamers 2, sinks 1, serve counters 1, plate returns 1, bins 3, extinguishers 1, plates 4, plain counters 10; crates: beef 1, carrot 1, fish 1, flour 1, prawn 1.
- Spawns (best guess): P1 (3,8), P2 (11,8), P3 (2,6), P4 (12,6)
- Zones:
  - **left side (steamers)** — steamer x2, plate x2, board, sink, extinguisher. Crosses to: right side (mixers) (hand across the belt with the receiver downstream of the giver, or throw)
  - **right side (mixers)** — mixer x2, plate x2, board, serve, plate return. Crosses to: left side (steamers) (hand across the belt with the receiver downstream of the giver, or throw)
  - **belt** — 5 ingredient dispensers, 3 bins. Crosses to: both sides (step on and be carried)

## Dynamics
- **conveyors** — a fast tile-type belt fed by five dispensers (beef, prawn, flour, carrot, fish, left to right) merges 5 lanes into 1, then a rotating section splits it three ways into three bins. Period: not on the wiki `(estimate)` none given

Hazards:
- anything dropped on the belt ends in a bin

## Cooperation notes
A fast tile-type conveyor belt splits the kitchen in two. Five ingredient dispensers along the top feed five lanes (beef, prawn, flour, carrot, fish, left to right); the lanes merge into one, and a rotating section then splits that one lane three ways, each ending in a bin. Each side has a chopping board and two plates, one of which sits between the pair of machines: the left side has the steamers, the right side the mixers. The fire extinguisher and the sink are top-left; the service counter and the plate return are top-right.

Wiki: when handing items over the belt the receiver must be further downstream than the giver, never on the same tile. Stockpiling ingredients cuts downtime. With four chefs, two run hand-offs and two prepare.

Other notes:
- The five dispensers are Ingredient Dispensers, not Ingredient Boxes — they push items onto the belt rather than being grabbed from. The grid reuses the crate characters for them.
- The belt is the only route between the halves, and it eats anything put down on it, so this is the hardest hand-off in the set — reflected in the lowest 1-star thresholds of the eight (180 for 1P and 2P).

## Recreate checklist
1. steamer station
2. mixer station
3. Steamed Food recipe family
4. flour / fish / prawn / carrot ingredients
5. throwing
6. fast walkable conveyor floor
7. ingredient dispensers that feed a belt
8. a rotating belt splitter

Estimates made in the JSON:
- `orders.initial`
- `orders.intervalSec`
- `orders.max`
- `orders.timeSec`
- `spawns`
- `grid.cols`
- `grid.rows`
- `grid.ascii`
- `lane count and merge geometry`
- `belt speed`
- `rotating splitter period`

Derived `features` (computed from the ASCII grid above): floor 147, counter 33, station 23, longest crate-to-serve walk 10 tiles, chokepoint width 1 `(estimate)`, recipe steps 4.
