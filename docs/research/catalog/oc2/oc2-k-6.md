# oc2 Kevin 6 — Kevin Level
Source: https://overcooked.fandom.com/wiki/Kevin_6 · Screenshots: docs/research/screens/oc2/kevin-6.jpg

## Facts
- Time limit 4:00. Timer starts immediately. Unlock: Accessible from 4-5; solo challenge score 400, team challenge score 500. Players 1-4.
- Recipes: Steamed Food, 4 order variants — steamed_fish, steamed_beef, steamed_carrot, steamed_prawn. Order pattern: the wiki gives none, so initial 2, one new ticket every 20 s, at most 5 on screen, 90 s per ticket are all `(estimate)`.
- Star thresholds (1★ / 2★ / 3★ / 4★; the OC2 chart has a fourth column, so these arrays hold four numbers). Provenance: OC2 base game, from the page's Star Chart.
  - 1 player: 220 / 280 / 380 / 650
  - 2 players: 280 / 360 / 480 / 900
  - 3 players: 380 / 480 / 640 / 1000
  - 4 players: 380 / 480 / 640 / 1000
- Plates: infobox `plates = Yes`, so the level has a sink and plates come back dirty. 2 plates on the grid, in the positions the Overview describes.

## Layout
- Grid size: 13 x 13, counted from `kevin-6.jpg`; method: the level-select polaroid is only 382 px wide, so the tile ruler is the single-tile stations (ingredient boxes, mixers, steamers, plates) read along the counter runs, cross-checked against the station list in the wiki Overview. Confidence: **low**.

```
.............
.>>>>>>>>>>v.
.^ZZ##.EBBBv.
.^W.......pv.
.^p........v.
.^.........v.
V^>>>>.<<<<v.
.^.....KK##v.
.^........Rv.
.^........Xv.
.^AJØ&.!###v.
.<<<<<<<<<<<.
.............
```

- Legend extensions used:
  - `!` — carrot ingredient box
  - `&` — flour ingredient box
  - `<` — conveyor pushing left
  - `>` — conveyor pushing right
  - `J` — fish ingredient box
  - `K` — mixer
  - `Z` — steamer (burner carrying a bamboo steamer)
  - `^` — conveyor pushing up
  - `v` — conveyor pushing down
  - `Ø` — prawn ingredient box
- Station inventory: boards 3, pot burners 0, pan burners 0, fryers 0, ovens 0, mixers 2, steamers 2, sinks 1, serve counters 1, plate returns 1, bins 1, extinguishers 1, plates 2, plain counters 7; crates: beef 1, carrot 1, fish 1, flour 1, prawn 1.
- Spawns (best guess): P1 (4,4), P2 (8,4), P3 (4,8), P4 (8,8)
- Zones:
  - **top-left quadrant** — steamer x2, sink, plate. Crosses to: conveyor ring (one gap facing the centre, on the left)
  - **top-right quadrant** — board x3, plate, extinguisher. Crosses to: conveyor ring (one gap centred at the top, facing the outer ring)
  - **bottom-left quadrant** — beef box, fish box, prawn box, flour box. Crosses to: conveyor ring (one gap facing the centre, on the right)
  - **bottom-right quadrant** — mixer x2, plate return, bin, carrot box. Crosses to: conveyor ring (one gap facing right)
  - **conveyor ring** — serve (far left). Crosses to: every quadrant (ride the belts clockwise or inward)

## Dynamics
- **conveyors** — belts ring the four quadrants and cross between them, pushing chefs clockwise or towards the centre; working anywhere on a belt is close to impossible. Period: not on the wiki `(estimate)` none given

Hazards:
- belts carry chefs and dropped items away

## Cooperation notes
Four quadrants, each a ring of counters with one gap to walk through, laid out around a belt cross and enclosed by a belt ring. Top-left: a plate, two steamers and the sink, gap facing the centre on the left. Top-right: three chopping boards, a plate and the fire extinguisher, gap centred at the top and facing the outer ring. Bottom-left: the beef, fish, prawn and flour boxes, gap facing the centre on the right. Bottom-right: two mixers, the plate return, the bin and the carrot box, gap facing right. The service counter is on the very left, out on the ring.

Wiki: the belts make almost every task impossible outside a quadrant, so stay inside one; with four chefs, one per quadrant. Keep the plates near the steamers, because steaming is the last step of every recipe here.

Other notes:
- Only two plates in the whole kitchen (the infobox says so), which is what makes the belt hand-offs punishing.
- Belt directions in the grid are a reading of the polaroid, not a wiki fact.

## Recreate checklist
1. steamer station
2. mixer station
3. Steamed Food recipe family
4. flour / fish / prawn / carrot ingredients
5. throwing
6. walkable conveyor floor that moves chefs and items

Estimates made in the JSON:
- `orders.initial`
- `orders.intervalSec`
- `orders.max`
- `orders.timeSec`
- `spawns`
- `grid.cols`
- `grid.rows`
- `grid.ascii`
- `every belt direction`
- `quadrant gap positions`

Derived `features` (computed from the ASCII grid above): floor 143, counter 26, station 19, longest crate-to-serve walk 9 tiles, chokepoint width 1 `(estimate)`, recipe steps 4.
