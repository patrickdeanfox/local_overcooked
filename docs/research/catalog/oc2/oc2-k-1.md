# oc2 Kevin 1 — Kevin Level
Source: https://overcooked.fandom.com/wiki/Kevin_1 · Screenshots: docs/research/screens/oc2/kevin-1.jpg

## Facts
- Time limit 4:00. Timer starts only when the first order is served — Kevin 1 introduces Steamed Food, and the wiki's Recipe page says a level introducing a new recipe holds the clock until the first serve. Unlock: Accessible from 1-3; solo challenge tip combo 2x (team challenge TBA on the wiki). Players 1-4.
- Recipes: Steamed Food, 2 order variants — steamed_fish, steamed_beef. Order pattern: the wiki gives none, so initial 2, one new ticket every 20 s, at most 5 on screen, 90 s per ticket are all `(estimate)`.
- Star thresholds (1★ / 2★ / 3★ / 4★; the OC2 chart has a fourth column, so these arrays hold four numbers). Provenance: OC2 base game, from the page's Star Chart.
  - 1 player: 300 / 380 / 520 / 920
  - 2 players: 480 / 600 / 820 / 1460
  - 3 players: 540 / 660 / 900 / 1650
  - 4 players: 540 / 660 / 900 / 1920
- Plates: infobox `plates = Yes`, so the level has a sink and plates come back dirty. 4 plates on the grid, in the positions the Overview describes.

## Layout
- Grid size: 17 x 10, counted from `kevin-1.jpg`; method: the level-select polaroid is only 382 px wide, so the tile ruler is the single-tile stations (ingredient boxes, mixers, steamers, plates) read along the counter runs, cross-checked against the station list in the wiki Overview. Confidence: **low**.

```
###W########RV###
........X........
.#K#K#..p..#Z#Z#.
.....#..p..#.....
........#........
........#........
.....#..p..#.....
.#B#B#..p..#B#B#.
........#........
####A#######J&###
```

- Legend extensions used:
  - `&` — flour ingredient box
  - `J` — fish ingredient box
  - `K` — mixer
  - `Z` — steamer (burner carrying a bamboo steamer)
- Station inventory: boards 4, pot burners 0, pan burners 0, fryers 0, ovens 0, mixers 2, steamers 2, sinks 1, serve counters 1, plate returns 1, bins 1, extinguishers 0, plates 4, plain counters 47; crates: beef 1, fish 1, flour 1.
- Spawns (best guess): P1 (3,4), P2 (13,4), P3 (4,5), P4 (12,5)
- Zones:
  - **left side (mixers)** — mixer x2, board x2, sink, beef box, plates. Crosses to: right side (steamers) (place on the centre counter column, or throw)
  - **right side (steamers)** — steamer x2, board x2, plate return, serve, flour box, fish box, plates. Crosses to: left side (mixers) (place on the centre counter column, or throw)

## Dynamics
- None. The kitchen is static for the whole run.

Hazards:
- None.

## Cooperation notes
Two mirrored halves, one chef each, split by an unbroken column of countertops that runs from the top counter row to the bottom one. The centre column carries the bin at its top and four plates below it. Each half has three bands: the top counter row holds the plate gear (sink on the left, plate return and service counter on the right), the middle band holds two chopping boards per side facing the mixers/steamers across a corridor, and the bottom counter row holds the ingredient boxes (beef on the left; flour and fish on the right). Stairs lead down into the middle band.

Wiki: the left chefs keep a steady stream of beef+flour mixes and clean plates coming; the right chefs throw flour left whenever they walk down for fish, carry dirty dishes back on the return trip, and steam in ticket order. The bottleneck is flour: it only exists on the right, and every non-fish dumpling needs the mixers, which only exist on the left.

Other notes:
- The wiki lists no fire extinguisher for Kevin 1 and the polaroid shows none; every other Kevin level has one.
- Fish dumplings skip the mixer entirely, so the right side can serve them without any cross-kitchen traffic — the only self-sufficient chain in the level.

## Recreate checklist
1. steamer station
2. mixer station
3. Steamed Food recipe family
4. flour / fish / prawn / carrot ingredients
5. throwing
6. nothing beyond the core five — Kevin 1 has no dynamic element at all, which makes it the cheapest of the eight to rebuild

Estimates made in the JSON:
- `orders.initial`
- `orders.intervalSec`
- `orders.max`
- `orders.timeSec`
- `spawns`
- `grid.cols`
- `grid.rows`
- `grid.ascii`
- `zones`

Derived `features` (computed from the ASCII grid above): floor 104, counter 66, station 19, longest crate-to-serve walk 13 tiles (1 crate(s) cannot reach the serve counter on foot at all: the kitchen is split, so those ingredients have to be handed or thrown across), chokepoint width 2 `(estimate)`, recipe steps 4.
