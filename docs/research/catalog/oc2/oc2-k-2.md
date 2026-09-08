# oc2 Kevin 2 — Kevin Level
Source: https://overcooked.fandom.com/wiki/Kevin_2 · Screenshots: docs/research/screens/oc2/kevin-2.jpg

## Facts
- Time limit 4:00. Timer starts immediately. Unlock: Accessible from 2-2; solo challenge tip combo 3x, team challenge tip combo 5x. Players 1-4.
- Recipes: Steamed Food, 4 order variants — steamed_fish, steamed_beef, steamed_carrot, steamed_prawn. Order pattern: the wiki gives none, so initial 2, one new ticket every 20 s, at most 5 on screen, 90 s per ticket are all `(estimate)`.
- Star thresholds (1★ / 2★ / 3★ / 4★; the OC2 chart has a fourth column, so these arrays hold four numbers). Provenance: OC2 base game, from the page's Star Chart.
  - 1 player: 260 / 320 / 420 / 950
  - 2 players: 380 / 480 / 640 / 1300
  - 3 players: 420 / 540 / 720 / 1400
  - 4 players: 420 / 540 / 720 / 1250
- Plates: infobox `plates = Yes`, so the level has a sink and plates come back dirty. 4 plates on the grid, in the positions the Overview describes.

## Layout
- Grid size: 15 x 12, counted from `kevin-2.jpg`; method: the level-select polaroid is only 382 px wide, so the tile ruler is the single-tile stations (ingredient boxes, mixers, steamers, plates) read along the counter runs, cross-checked against the station list in the wiki Overview. Confidence: **low**.

```
...............
...............
..ZpZ...p#Z....
..###...###....
..W#E...ØR&....
......##.......
.............V.
..J!A...KBK....
..p##...p##....
..#X#...B#B....
...............
...............
```

- Legend extensions used:
  - `!` — carrot ingredient box
  - `&` — flour ingredient box
  - `J` — fish ingredient box
  - `K` — mixer
  - `Z` — steamer (burner carrying a bamboo steamer)
  - `Ø` — prawn ingredient box
- Station inventory: boards 3, pot burners 0, pan burners 0, fryers 0, ovens 0, mixers 2, steamers 3, sinks 1, serve counters 1, plate returns 1, bins 1, extinguishers 1, plates 4, plain counters 17; crates: beef 1, carrot 1, fish 1, flour 1, prawn 1.
- Spawns (best guess): P1 (6,3), P2 (6,8), P3 (1,5), P4 (12,5)
- Zones:
  - **open plaza** — everything — the four islands sit in one walkable square. Crosses to: itself (walk; the islands rotate under you)

## Dynamics
- **rotating-islands** — the four 3x3 islands are pushed one quarter-turn clockwise around the two centre countertops, then counter-clockwise, starting at 3:00 remaining. Period: 23 s

Hazards:
- None.

## Cooperation notes
Four 3x3 counter islands stand in an open street plaza with two plain countertops between them. Top-left: two steamers, a plate, the sink and the fire extinguisher. Top-right: a plate, a steamer, the plate return, and the prawn and flour boxes. Bottom-left: the fish, carrot and beef boxes, a plate and the bin. Bottom-right: two mixers, three chopping boards and a plate. Every island is a solid 3x3 block — chefs work around the outside.

Wiki: 2P one chef owns the mixers, the other the steamers; 3P adds a dedicated server and dishwasher; 4P puts one chef on each island. The whole point is that ownership rotates — the island you were working stops being the one in front of you every ~23 seconds.

Other notes:
- The wiki Overview never mentions a service counter. The polaroid shows it on the right pavement, against the restaurant wall outside the four islands — that is where the grid puts it, and the exact tile is an estimate.
- The rotation only starts at 3:00 remaining, so the first minute is a static kitchen.

## Recreate checklist
1. steamer station
2. mixer station
3. Steamed Food recipe family
4. flour / fish / prawn / carrot ingredients
5. throwing
6. islands that rotate around a pivot

Estimates made in the JSON:
- `orders.initial`
- `orders.intervalSec`
- `orders.max`
- `orders.timeSec`
- `spawns`
- `grid.cols`
- `grid.rows`
- `grid.ascii`
- `dynamics[0].periodSec (wiki says ~23 s)`
- `stations.serve position`

Derived `features` (computed from the ASCII grid above): floor 141, counter 39, station 22, longest crate-to-serve walk 10 tiles, chokepoint width 2 `(estimate)`, recipe steps 4.
