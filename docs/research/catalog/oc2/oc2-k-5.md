# oc2 Kevin 5 — Kevin Level
Source: https://overcooked.fandom.com/wiki/Kevin_5 · Screenshots: docs/research/screens/oc2/kevin-5.jpg

## Facts
- Time limit 4:00. Timer starts immediately. Unlock: Accessible from 4-3; solo challenge tip combo 4x, team challenge tip combo 5x. Players 1-4.
- Recipes: Steamed Food, 4 order variants — steamed_fish, steamed_beef, steamed_carrot, steamed_prawn. Order pattern: the wiki gives none, so initial 2, one new ticket every 20 s, at most 5 on screen, 90 s per ticket are all `(estimate)`.
- Star thresholds (1★ / 2★ / 3★ / 4★; the OC2 chart has a fourth column, so these arrays hold four numbers). Provenance: OC2 base game, from the page's Star Chart.
  - 1 player: 180 / 240 / 320 / 620
  - 2 players: 260 / 320 / 440 / 1000
  - 3 players: 320 / 420 / 560 / 1100
  - 4 players: 320 / 420 / 560 / 1100
- Plates: infobox `plates = Yes`, so the level has a sink and plates come back dirty. 3 plates on the grid, in the positions the Overview describes.

## Layout
- Grid size: 16 x 11, counted from `kevin-5.jpg`; method: the level-select polaroid is only 382 px wide, so the tile ruler is the single-tile stations (ingredient boxes, mixers, steamers, plates) read along the counter runs, cross-checked against the station list in the wiki Overview. Confidence: **low**.

```
pp............W#
................
.........K#K##..
.........J!ØA#..
................
~~~~~~~~~~~~~~~V
................
..&##ZZ.........
..BBB##.........
................
RX............pE
```

- Legend extensions used:
  - `!` — carrot ingredient box
  - `&` — flour ingredient box
  - `J` — fish ingredient box
  - `K` — mixer
  - `Z` — steamer (burner carrying a bamboo steamer)
  - `~` — the road between the two work areas; cars drive along it
  - `Ø` — prawn ingredient box
- Station inventory: boards 3, pot burners 0, pan burners 0, fryers 0, ovens 0, mixers 2, steamers 2, sinks 1, serve counters 1, plate returns 1, bins 1, extinguishers 1, plates 3, plain counters 9; crates: beef 1, carrot 1, fish 1, flour 1, prawn 1.
- Spawns (best guess): P1 (4,7), P2 (11,3), P3 (3,9), P4 (10,2)
- Zones:
  - **upper band (mixers and boxes)** — mixer x2, fish box, carrot box, prawn box, beef box. Crosses to: lower band (boards and steamers) (walk across the road, or throw)
  - **lower band (boards and steamers)** — board x3, steamer x2, flour box. Crosses to: upper band (mixers and boxes) (walk across the road, or throw)
  - **corners** — plates, sink, plate return, bin, extinguisher, serve. Crosses to: both bands (walk)

## Dynamics
- **wind-swap** — gusts of wind swap the two 2x5 work areas from one side of their band to the other, and push chefs while they blow. Period: not on the wiki `(estimate)` none given
- **cars** — cars drive at random along the road between the two bands. Period: not on the wiki `(estimate)` none given

Hazards:
- cars on the road
- wind pushes chefs

## Cooperation notes
Two 2x5 work areas on opposite sides of a street, one in the upper half and one in the lower half, with cars driving between them. The upper area starts on the right and carries two mixers on its left with every ingredient box except flour on its right; the lower area starts on the left and carries three chopping boards on its left, two steamers on its right and the flour box above the boards. Each corner of the playable area holds two tiles of gear: two plates top-left, the sink top-right, plate return and bin bottom-left, a plate and the fire extinguisher bottom-right. The service counter is middle-right.

Wiki: 2P one chef per band; 3P/4P the same, with the spare chefs floating. The bands swap sides under you, so the useful habit is re-anchoring on the corners, which never move.

Other notes:
- The level-select polaroid is rotated 90 degrees from the orientation the wiki Overview describes. The grid follows the wiki (road horizontal, mixers in the upper band).
- The wiki gives no gust period and no car interval.

## Recreate checklist
1. steamer station
2. mixer station
3. Steamed Food recipe family
4. flour / fish / prawn / carrot ingredients
5. throwing
6. wind that both moves stations and pushes chefs
7. cars as a moving hazard (the clone has pedestrians, not cars)

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
- `dynamics[1].periodSec`
- `the exact tile layout inside each 2x5 band`

Derived `features` (computed from the ASCII grid above): floor 147, counter 29, station 20, longest crate-to-serve walk 13 tiles, chokepoint width 2 `(estimate)`, recipe steps 4.
