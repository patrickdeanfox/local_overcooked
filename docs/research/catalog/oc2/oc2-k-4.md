# oc2 Kevin 4 — Kevin Level
Source: https://overcooked.fandom.com/wiki/Kevin_4 · Screenshots: docs/research/screens/oc2/kevin-4.jpg

## Facts
- Time limit 4:00. Timer starts immediately. Unlock: Accessible from 3-1; solo challenge score 600, team challenge score 1100. Players 1-4.
- Recipes: Steamed Food, 4 order variants — steamed_fish, steamed_beef, steamed_carrot, steamed_prawn. Order pattern: the wiki gives none, so initial 2, one new ticket every 20 s, at most 5 on screen, 90 s per ticket are all `(estimate)`.
- Star thresholds (1★ / 2★ / 3★ / 4★; the OC2 chart has a fourth column, so these arrays hold four numbers). Provenance: OC2 base game, from the page's Star Chart.
  - 1 player: 220 / 280 / 380 / 800
  - 2 players: 340 / 420 / 580 / 960
  - 3 players: 400 / 500 / 680 / 1250
  - 4 players: 400 / 500 / 680 / 1600
- Plates: infobox `plates = Yes`, so the level has a sink and plates come back dirty. 4 plates on the grid, in the positions the Overview describes.

## Layout
- Grid size: 15 x 11, counted from `kevin-4.jpg`; method: the level-select polaroid is only 382 px wide, so the tile ruler is the single-tile stations (ingredient boxes, mixers, steamers, plates) read along the counter runs, cross-checked against the station list in the wiki Overview. Confidence: **low**.

```
###RBBBV#######
.............E.
.K#.........#K.
.#....._.....#.
.Z....._.....Z.
.#....._.....#.
.Z....._.....Z.
.#....._.....#.
.X...........W.
...............
###Jp&p!pØpA###
```

- Legend extensions used:
  - `!` — carrot ingredient box
  - `&` — flour ingredient box
  - `J` — fish ingredient box
  - `K` — mixer
  - `Z` — steamer (burner carrying a bamboo steamer)
  - `_` — the central fireplace — solid, and it throws fire onto the surrounding floor
  - `Ø` — prawn ingredient box
- Station inventory: boards 3, pot burners 0, pan burners 0, fryers 0, ovens 0, mixers 2, steamers 4, sinks 1, serve counters 1, plate returns 1, bins 1, extinguishers 1, plates 4, plain counters 24; crates: beef 1, carrot 1, fish 1, flour 1, prawn 1.
- Spawns (best guess): P1 (4,5), P2 (10,5), P3 (4,9), P4 (10,9)
- Zones:
  - **ring around the fireplace** — everything. Crosses to: itself (walk either side of the fireplace)

## Dynamics
- **fire-source** — the central fireplace throws fire onto floor tiles all around the kitchen; burning floor blocks the ring until it is put out. Period: not on the wiki `(estimate)` none given

Hazards:
- floor fire from the central fireplace

## Cooperation notes
A rectangular ring around a long central fireplace. The top counter row carries the plate return, three chopping boards and the service counter. The left arm is a mixer and two steamers, each separated by a countertop one down and one to the right of it, with the bin on the lowest tile. The right arm mirrors it, with the sink at the end instead of the bin and the fire extinguisher at the top of the area. The bottom counter row carries all five ingredient boxes with plates between them.

Wiki: one chef prioritises dishes, serving and fires while the others chop, mix and steam. With two players, one owns the mixers and one owns the steamers.

Other notes:
- This is the only Kevin level whose whole obstacle is fire, and the only one where all five ingredient boxes sit in one row.
- The wiki gives no rate or pattern for the fireplace, so the dynamic has no period.

## Recreate checklist
1. steamer station
2. mixer station
3. Steamed Food recipe family
4. flour / fish / prawn / carrot ingredients
5. throwing
6. a fire source that ignites floor tiles (the clone only has fires on stations)

Estimates made in the JSON:
- `orders.initial`
- `orders.intervalSec`
- `orders.max`
- `orders.timeSec`
- `spawns`
- `grid.cols`
- `grid.rows`
- `grid.ascii`
- `dynamics[0].periodSec`
- `the exact step pattern of the left and right arms`

Derived `features` (computed from the ASCII grid above): floor 113, counter 52, station 28, longest crate-to-serve walk 12 tiles, chokepoint width 2 `(estimate)`, recipe steps 4.
