# oc1 Intro Apocalypse — Treacle Town (Apocalypse)
Source: https://overcooked.fandom.com/wiki/Intro_Apocalypse · Screenshots: oc1/intro-apocalypse.jpg, oc1/intro-apocalypse-2p.jpg

## Facts
- 1:40 (100 s). The infobox marks `preptime=Yes` for both Overcooked! and All You Can Eat, so the clock waits for the first serve, as it does on 1-1. Unlock: 0 stars — it is the campaign's opening level, and finishing it grants 3 stars whatever you score. 1-4 players; the layout itself changes at 2 players.
- Salad and Tomato Salad — the only two recipes with no cooking step at all. The wiki gives no order cadence; the level is scripted around the Onion King's tutorial prompts, which walk the chef through pick up → chop → plate → serve before the ticket board takes over. `orders` here is `(estimate)`.
- OC1 thresholds are on the level's own Star Chart: 1P 60 / 180 / 300, 2P 60 / 220 / 420, 3P 60 / 300 / 460, 4P 60 / 300 / 460. Provenance `oc1`. Note the tension with the rest of the catalog: at the ~15-20 points a salad is worth elsewhere in this repo's estimate, 300 in 100 s would need fifteen salads, so either the tutorial's tips are unusually generous or the salad is worth far more here. Worth resolving before anyone tunes a clone of it.
- Infobox `plates = No`, `servetype = Plates`: dishes are plated but dirty plates never appear, so there is no sink and no washing. One clean plate starts on the south counter at (10,7). Nothing on either screenshot looks like a plate return, so where the plate comes back is `(estimate)`.

## Layout
- Grid size: 13 x 8, counted from oc1/intro-apocalypse-2p.jpg; method: counter seams on the north and south runs measured at two depths (47.1 px and 59.2 px per tile), solved for a vanishing x of 630 and checked against the row seams on the west wall; every station lands inside a whole column; confidence **high**
- This is the 2-4 player layout. In 1 player the divider at column 6 is five tiles instead of six and (6,6) is floor, which is the only difference between the two — see the Dynamics section.
```
##B#B###L#T##
#.....#.....#
#.....#.....#
#.....#......
#.....#......
#.....#.....V
#.....#.....#
##########p##
```
- Legend extensions used: none
- Station inventory: board 2, serve 1, plates on counters 1, plain counters 37; crates: lettuce 1, tomato 1
- Spawns: (3,1) and (9,1), where the two chefs stand in the 2-player screenshot — one per side of the divider `(estimate)`
- Zones:
- **West room** (columns 1-5, rows 1-6): both chopping boards, on the north wall at (2,0) and (4,0). Nothing else — no crate, no plate, no hatch.
- **East room** (columns 7-11 rows 1-6, plus (12,3) and (12,4)): the lettuce and tomato crates at (8,0) and (10,0), the clean plate at (10,7), and the Ever Peckish's serving counter at (12,5).
- The two rooms meet only across the divider counter at column 6. In 1 player they also meet on the floor at (6,6).

## Dynamics
- Nothing moves. The only variable is the player count: the wiki says the divider "5 spaced counter … has been replaced with a six-block counter, blocking the pathway off" for 2-4 players, and the two screenshots confirm it — five divider tiles and an open (6,6) in the 1-player shot, six tiles and no gap in the 2-player shot.
- The Ever Peckish rises and roars in the opening cutscene and eats every dish served; it is scenery plus the serving counter, not a hazard.

## Cooperation notes
- The whole lesson is the counter hand-off. Crates and the serving counter are on one side, boards on the other, so at 2+ players neither chef can build a salad alone: the east chef pulls lettuce and tomato and puts them on the divider, the west chef chops and puts them back, the east chef plates and feeds the beast.
- The bottleneck is the divider itself — one item per tile, six tiles — and the single plate. With one plate, a serve has to complete before the next salad can be assembled.
- In 1 player the gap at (6,6) makes the level a walk rather than a hand-off, which is why the wiki calls the level "quite simple".

## Recreate checklist
- Salad recipes (chop-and-plate, no cooking device) — `salad` and `tomato_salad` do not exist in `src/sim/recipes.ts`.
- A plate that returns clean with no sink and no plate stack (`plates.mode` would need a third mode, or map onto `stack` with count 1).
- A per-player-count layout switch, if the 1-player variant matters. Otherwise ship the 2-4 player grid, which is the one the clone's two-player target needs.
- Nothing else: the grid uses only characters the clone already implements.
