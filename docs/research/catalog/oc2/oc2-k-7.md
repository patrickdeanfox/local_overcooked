# oc2 Kevin 7 — Kevin Level
Source: https://overcooked.fandom.com/wiki/Kevin_7 · Screenshots: docs/research/screens/oc2/kevin-7.jpg

## Facts
- Time limit 4:30. Timer starts immediately. Unlock: Accessible from 5-5; solo challenge tip combo 5x, team challenge tip combo 9x. Players 1-4.
- Recipes: Steamed Food, 4 order variants — steamed_fish, steamed_beef, steamed_carrot, steamed_prawn. Order pattern: the wiki gives none, so initial 2, one new ticket every 20 s, at most 5 on screen, 90 s per ticket are all `(estimate)`.
- Star thresholds (1★ / 2★ / 3★ / 4★; the OC2 chart has a fourth column, so these arrays hold four numbers). Provenance: OC2 base game, from the page's Star Chart.
  - 1 player: 240 / 300 / 420 / 800
  - 2 players: 300 / 360 / 500 / 1280
  - 3 players: 320 / 400 / 540 / 1280
  - 4 players: 320 / 400 / 540 / 1280
- Plates: infobox `plates = Yes`, so the level has a sink and plates come back dirty. 3 plates on the grid, in the positions the Overview describes.

## Layout
- Grid size: 15 x 12, counted from `kevin-7.jpg`; method: the level-select polaroid is only 382 px wide, so the tile ruler is the single-tile stations (ingredient boxes, mixers, steamers, plates) read along the counter runs, cross-checked against the station list in the wiki Overview. Confidence: **low**.

```
#RXA&#p#BB#####
...............
...............
...............
...............
K.............Z
K      #      Z
!.............J
...............
...............
..........V....
#W#BB#pp#Ø#####
```

- Legend extensions used:
  - `!` — carrot ingredient box
  - `&` — flour ingredient box
  - `J` — fish ingredient box
  - `K` — mixer
  - `K/Z/!/J at x=0 and x=14` — the two moving platforms; they are drawn in place as counter tiles, but the whole three-tile run travels between the halves
  - `Z` — steamer (burner carrying a bamboo steamer)
  - `Ø` — prawn ingredient box
- Station inventory: boards 4, pot burners 0, pan burners 0, fryers 0, ovens 0, mixers 2, steamers 2, sinks 1, serve counters 1, plate returns 1, bins 1, extinguishers 0, plates 3, plain counters 18; crates: beef 1, carrot 1, fish 1, flour 1, prawn 1.
- Spawns (best guess): P1 (5,2), P2 (5,9), P3 (9,2), P4 (9,9)
- Zones:
  - **top half** — plate return, bin, beef box, flour box, plate, board x2. Crosses to: bottom half (the single centre countertop, the two moving platforms, or a throw)
  - **bottom half** — sink, board x2, plate x2, prawn box, serve. Crosses to: top half (the single centre countertop, the two moving platforms, or a throw)
  - **left platform** — mixer x2, carrot box. Crosses to: both halves (it drives between them)
  - **right platform** — steamer x2, fish box. Crosses to: both halves (it drives between them)

## Dynamics
- **moving-platforms** — one platform on each side carries its stations back and forth between the top and bottom halves; the left one holds both mixers and the carrot box, the right one both steamers and the fish box. Period: not on the wiki `(estimate)` none given

Hazards:
- None.

## Cooperation notes
Top and bottom halves, separated by a wall whose only opening is one countertop in the dead centre. The top half carries the plate return, the bin, the beef and flour boxes, a plate and two chopping boards. The bottom half carries the sink, two chopping boards, two plates and the prawn box. A moving platform runs on each side: the left one carries both mixers and the carrot box, the right one both steamers and the fish box — so the two cooking stations are literally in transit for most of the run.

Wiki: the platforms move away while you are mid-action, so hand ingredients to the other side rather than chasing a platform.

Other notes:
- The wiki Overview does not mention a service counter. The polaroid shows one on the right wall of the bottom half; that is where the grid puts it and the exact tile is an estimate.
- Longest level of the eight at 4:30.

## Recreate checklist
1. steamer station
2. mixer station
3. Steamed Food recipe family
4. flour / fish / prawn / carrot ingredients
5. throwing
6. platforms that carry stations between two isolated halves

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
- `the platform travel path`
- `serve counter tile`

Derived `features` (computed from the ASCII grid above): floor 130, counter 38, station 20, longest crate-to-serve walk 11 tiles (2 crate(s) cannot reach the serve counter on foot at all: the kitchen is split, so those ingredients have to be handed or thrown across), chokepoint width 1 `(estimate)`, recipe steps 4.
