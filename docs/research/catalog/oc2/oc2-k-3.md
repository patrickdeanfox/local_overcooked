# oc2 Kevin 3 — Kevin Level
Source: https://overcooked.fandom.com/wiki/Kevin_3 · Screenshots: docs/research/screens/oc2/kevin-3.jpg

## Facts
- Time limit 4:00. Timer starts immediately. Unlock: Accessible from 2-4; solo challenge score 600, team challenge score 1000. Players 1-4.
- Recipes: Steamed Food, 4 order variants — steamed_fish, steamed_beef, steamed_carrot, steamed_prawn. Order pattern: the wiki gives none, so initial 2, one new ticket every 20 s, at most 5 on screen, 90 s per ticket are all `(estimate)`.
- Star thresholds (1★ / 2★ / 3★ / 4★; the OC2 chart has a fourth column, so these arrays hold four numbers). Provenance: OC2 base game, from the page's Star Chart.
  - 1 player: 200 / 240 / 340 / 690
  - 2 players: 240 / 300 / 400 / 800
  - 3 players: 380 / 480 / 640 / 900
  - 4 players: 380 / 480 / 640 / 1060
- Plates: infobox `plates = Yes`, so the level has a sink and plates come back dirty. 3 plates on the grid, in the positions the Overview describes.

## Layout
- Grid size: 16 x 10, counted from `kevin-3.jpg`; method: the level-select polaroid is only 382 px wide, so the tile ruler is the single-tile stations (ingredient boxes, mixers, steamers, plates) read along the counter runs, cross-checked against the station list in the wiki Overview. Confidence: **low**.

```
#########X&ØZZZW
#VR######.......
E.......#.......
p.......=.......
A.......=#p###p#
!.......=.......
J.......#....BB#
#.......#......#
#.......#......#
##K##K##########
```

- Legend extensions used:
  - `!` — carrot ingredient box
  - `&` — flour ingredient box
  - `=` — elevator car (the only link between the three height levels)
  - `J` — fish ingredient box
  - `K` — mixer
  - `Z` — steamer (burner carrying a bamboo steamer)
  - `Ø` — prawn ingredient box
- Station inventory: boards 2, pot burners 0, pan burners 0, fryers 0, ovens 0, mixers 2, steamers 3, sinks 1, serve counters 1, plate returns 1, bins 1, extinguishers 1, plates 3, plain counters 44; crates: beef 1, carrot 1, fish 1, flour 1, prawn 1.
- Spawns (best guess): P1 (4,5), P2 (12,2), P3 (3,7), P4 (12,6)
- Zones:
  - **lower level** — mixer x2, serve, plate return, extinguisher, beef box, carrot box, fish box, plate. Crosses to: top high level (elevator); right high level (elevator)
  - **top high level** — steamer x3, sink, bin, flour box, prawn box. Crosses to: right high level (shared countertop (place, do not walk)); lower level (elevator, or throw down)
  - **right high level** — board x2. Crosses to: top high level (shared countertop); lower level (elevator)

## Dynamics
- **elevator** — one car shuttles between the lower level and the two high levels; it is the only walkable link. Period: not on the wiki `(estimate)` none given

Hazards:
- None.

## Cooperation notes
Three height levels joined by a single elevator. The lower level holds two mixers, the service counter, the plate return, the fire extinguisher and the beef, carrot and fish boxes. The top high level holds three steamers, the sink, the bin and the flour and prawn boxes. The right high level holds two chopping boards and shares countertop space with the top high level, so items cross between the two high levels by being put down, not carried.

Wiki: toss spare bags of flour down, keep spare beef/fish/carrot up top ready to cut, and keep one chef permanently upstairs on the steamers because waiting for the lift burns food.

Other notes:
- The ASCII grid flattens the three height levels onto one plane: the `=` column is the elevator shaft, and the counter runs on either side stand in for the drops. Reachability in the grid is therefore more generous than in the real level.
- The wiki does not give the elevator's period or its dwell time at each stop.

## Recreate checklist
1. steamer station
2. mixer station
3. Steamed Food recipe family
4. flour / fish / prawn / carrot ingredients
5. throwing
6. height levels
7. an elevator (a one-tile timed platform)

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
- `zones`

Derived `features` (computed from the ASCII grid above): floor 96, counter 64, station 20, longest crate-to-serve walk 13 tiles, chokepoint width 1 `(estimate)`, recipe steps 4.
