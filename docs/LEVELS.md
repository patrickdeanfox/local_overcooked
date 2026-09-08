# Overcooked 1 levels 1-1, 1-2, 1-3

Transcriptions of the first three Overcooked 1 kitchens into the grid format described in
`docs/LEVEL_SCHEMA.md`. One JSON file per level under `src/levels/oc1/`.

## How these were read

Screenshots: `docs/research/screens/oc1_1-*.png` (the OC1 shots on the wiki) plus the All You
Can Eat remaster shots (`File:Overcooked11-1.png` and friends) as a second camera angle. Text
facts come from the level pages' infobox, Overview and Star Chart sections, fetched through
the MediaWiki API as described in `CLAUDE.md`.

Counters are the only reliable ruler; the floor texture is not tile-aligned and will mislead
you. Each camera is a fixed perspective, which means tile width grows linearly with screen y
and every vertical grid line converges on a single vanishing point. So for each level: measure
counter seams at two depths, solve for the vanishing point, then convert each station's pixel
centre into a column index. That is how 1-1 resolves to 13 tiles across, and how the two
chopping boards turn out to sit two columns apart rather than side by side. Row boundaries come
from the counter columns down the side walls, where every tile face is drawn separately.

The OC1 and AYCE shots differ in decoration but not in geometry, so AYCE doubled as the check on
tile counts.

## 1-1 — Treacle Town

```
###O####S###E
#...........#
#...........W
##########..D
R...........#
V...........#
V...........X
###B#B###pp##
```

13 x 8.

| Tile | Station |
| --- | --- |
| `O` (3,0) | Onion crate, top-left of the back counter |
| `S` (8,0) | Burner with a pot |
| `E` (12,0) | Corner counter with the fire extinguisher |
| `W` (12,2) / `D` (12,3) | Sink basin and its draining rack on the right wall |
| `R` (0,4) | Plate return |
| `V` (0,5), (0,6) | Serving hatch, two tiles tall |
| `X` (12,6) | Bin |
| `B` (3,7), (5,7) | Chopping boards on the front counter |
| `p` (9,7), (10,7) | The two clean plates the level starts with |
| row 3, x 0-9 | The long counter you have to walk around |

Wiki facts used: onion soup only; 2:30 "until 1 order complete", hence
`timerStartsOnFirstServe`; plates yes, washed at a sink; a single burner and a single pot, which
is why the strategy section tells you to plate soups quickly; star thresholds 10 / 40 / 60 at
both one and two players.

Uncertainties, and how they were settled:

- The Overview text puts the serving counter and plate return "in the lower-right corner". Both
  screenshots show them on the left wall — with the onion crate top-left and the burner
  top-right, exactly as the same text says. Since only those two stations disagree, the level is
  not mirrored and the sentence is just wrong. The screenshots win.
- The sink art is a single grey block roughly two rows tall: basin and tap on top, draining rack
  below. Transcribed as `W` above `D` rather than one sink tile.
- The serving hatch is two rows tall as well — twice the height of the plate return beside it,
  which measures exactly one tile — so two `V` tiles.
- Chef start tiles come straight off the screenshot. Both chefs stand in the upper corridor, one
  over on the crate side and one directly under the burner.

Tuning knobs: `orders` (initial 2, a new order every 18 s, at most 4 at a time, 60 s each) is
sized to the one pot. Star thresholds are the only scoring numbers the wiki supplies, so order
pressure is the dial to turn if the level plays badly. `initial` was 1 until the playtest; see
"Order tuning after the playtest" below.

## 1-2 — Treacle Town crosswalk

```
##S#S#~~~###EX.#
.....#~~~......V
D....p~~~p.....V
W.....~~~#.....R
......~~~#......
##B#B#~~~#T#O##.
```

16 x 6.

| Tile | Station |
| --- | --- |
| `S` (2,0), (4,0) | The two burners with pots, left half |
| `D` (0,2) / `W` (0,3) | Draining rack above the sink basin, far left |
| `p` (5,2), (9,2) | The two clean plates, one on each side of the crossing |
| `~` columns 6-8 | The pedestrian crossing |
| `E` (12,0) | Counter with the fire extinguisher |
| `X` (13,0) | Bin |
| `V` (15,1), (15,2) | Serving hatch, two tiles tall |
| `R` (15,3) | Plate return |
| `B` (2,5), (4,5) | Chopping boards, left half |
| `T` (10,5), `O` (12,5) | Tomato and onion crates, right half |

Wiki facts used: onion and tomato soup; 4:00 with no prep time; two plates; sink washing;
"split into two halves separated by a crosswalk on which pedestrians walk from both sides";
ingredient boxes, serving counter and plate return on the right, bin at the top, sink, pots and
chopping boards on the left; star thresholds 20 / 60 / 80 for one player and 20 / 60 / 150 for
two.

Uncertainties, and how they were settled:

- Measured honestly, the map is 17 columns wide: the sink juts one column left of both counter
  runs, into otherwise empty street. To stay inside the 16-wide budget it was pushed flush with
  the runs. Nothing else moves, and the sink is still approached from the same side, so all that
  is lost is a strip of road nobody stands on. To undo it, add a `.` column on the left and move
  `D`/`W` into it.
- The gap between the two counter runs measures 2.87 tiles at the top row and again at the
  bottom row, which rounds to three road columns. Inside that gap, the painted crossing markings
  sit about 2.3 tiles apart.
- `~` marks the crossing and nothing else. The rest of the street is `.`, which keeps
  pedestrians on the crossing instead of wandering through the kitchen.
- The two inner counter columns are not symmetric. The left one (x 5) runs rows 0-2 and ends
  with its plate; the right one (x 9) has a gap at row 1, then runs rows 2-4 down to the bottom
  counter. Both screenshots agree, so it is not a transcription slip.
- Row 0 has one tile of open road between the bin and the serving column, and the bottom-right
  corner (15,5) is open too. That is how the street reads in the screenshots.

Pedestrians use two dynamics so arrivals can be staggered. The first walks people down the outer
lanes (x 6 and x 8) every 4 s, starting at 1.5 s; the second walks people up the middle lane
(x 7) on the same interval, starting at 3.5 s. At 2.5 tiles/s a walker needs roughly 2.4 s to
cross, so the crossing is usually passable but not reliably so. Tuning knobs: `intervalSec`,
`speed`, `firstDelaySec`, and how many lanes each dynamic owns.

Order tuning: initial 2, a new order every 26 s, at most 4, 90 s each. That is slower and more
forgiving than the first guess of 18 s / 5 / 70 s; see "Order tuning after the playtest" below.

## 1-3 — Savoury Seas

```
...S#S##VVRE
.#....1.....
.P....1.....
.P....1.....
.P....2.....
.X....2.....
.#B#B##OTM..
............
```

12 x 8.

| Tile | Station |
| --- | --- |
| `S` (3,0), (5,0) | The two burners with pots |
| `V` (8,0), (9,0) | Serving hatch, two tiles wide |
| `R` (10,0) | Plate return |
| `E` (11,0) | Counter with the fire extinguisher |
| `P` (1,2), (1,3), (1,4) | The three clean plates; with no sink these are the plate stack |
| `X` (1,5) | Bin |
| `B` (2,6), (4,6) | Chopping boards |
| `O` (7,6), `T` (8,6), `M` (9,6) | Onion, tomato and mushroom crates |
| `1` (6,1)-(6,3), `2` (6,4)-(6,5) | The two sliding counter segments |

Wiki facts used: onion, tomato and mushroom soup; 4:00, no prep time; plates "No", so
`plates.mode` is `stack`; "the right half has a Serving Counter, the Plate Return and Ingredient
boxes while the left has Chopping Stations and Pots with Burners"; "the middle countertops slide
back and forth as the Ship sways in opposite directions"; "There is no Sink in this kitchen";
and the strategy note that the bottom is not blocked off.

Uncertainties, and how they were settled:

- **Star thresholds.** The wiki's OC1 column for 1-3 is blank. The level list gives 3 stars at
  100 for one player and 200 for two, so those are the 3-star values. The 1- and 2-star values
  were set at 30% and 60% of the 3-star target: 1P `[30, 60, 100]`, 2P `[60, 120, 200]`. The OC1
  rows that do exist run 17% / 67% (1-1), 25% / 75% (1-2 one player) and 13% / 40% (1-2 two
  players) of their own 3-star value, so 30% / 60% sits inside that band. The AYCE thresholds on
  the same page run far higher because AYCE scores dishes differently; they were not used.
- **Slider axis.** Both screenshots catch the divider aligned, so a still cannot settle the
  axis. Sliding along x would shuffle the counter surfaces sideways and never open a path;
  sliding along y opens and closes gaps between the segments, which is what makes "Moving
  Counters" an obstacle at all. Hence axis `y`, with the five divider tiles split 3 + 2 into
  groups `1` and `2` at opposite phase, amplitude 1 tile, period 6 s.
- **Column 0.** The bottom counter run reaches the same column as the plate and bin column, so
  without the strip of open deck to its left the whole left half would be sealed off. That strip
  is there in the screenshot, between the counters and the rope coil and cannonballs, and it is
  how a chef gets from the burners down to the open bottom row. Here it is column 0.
- **Serving hatch width.** The slab measures about 1.8 tiles across in the OC1 shot and exactly
  two plate-return widths in the AYCE shot, so: two `V` tiles. How many arrows are painted on it
  differs between the two versions and is not a tile count.
- The map is cropped to what the level uses. Real deck runs further left and right, but those
  tiles are scenery — barrels, cannons, a mast — and nothing is reachable through them.

Tuning knobs: slider `amplitude`, `periodSec` and `phase`; the 3 + 2 split between groups `1`
and `2`; orders (initial 2, a new order every 20 s, at most 4, 85 s each — 16 s / 5 / 75 s
before the playtest). Three recipes and no sink means order pressure and plate count are what
decide whether the plate stack becomes the bottleneck.

## Order tuning after the playtest

The order numbers above were guesses. They have now been measured against the levels as built,
using the scripts in `tools/playtests/` to drive both chefs through the headless harness
(`node tools/playtest.mjs --file tools/playtests/<script>`). Every figure below came out of a
recorded run, and the scripts are kept so the measurements can be repeated.

### What a soup actually costs

The harness moves one chef at a time, so its timings are an upper bound. Two people overlap the
fetching with the chopping and will beat them. The ratios between the levels are the part to
trust.

| Level | Measured, script | Estimated, two competent players | Why |
| --- | --- | --- | --- |
| 1-1 | 41 s serve-to-serve | 20-25 s | Onions are passed over the row-3 counter, so nobody walks the long way round |
| 1-2 | 70 s to the first serve | 35-45 s | Every ingredient crosses the road, and the crossing is one tile wide |
| 1-3 | ~50 s for the soup phase | 30-35 s | The crate-to-board run goes round the open bottom deck, about 16 tiles each way |

### Is three stars reachable?

- **1-1: yes, comfortably.** Three stars is 60 points, which is three soups. The clock does not
  start until the first serve, so the first soup is free, and 150 s buys three or four more at
  the measured pace. If anything the level is soft, which suits a first kitchen.
- **1-2: the arithmetic used to forbid it. Now it is only hard.** Three stars for two players is
  150. At one order every 18 s the queue produced about fifteen tickets in four minutes while the
  kitchen could serve six or seven, so eight or nine expired at -10 each and the score never
  climbed. Orders now arrive every 26 s, at most four are live at once, and a ticket lasts 90 s.
  That puts about eleven tickets on the board, a good pair serves seven or eight, and the penalty
  stream stops cancelling the score out. Three stars now asks for roughly eight soups in four
  minutes. Demanding, and reachable.
- **1-3: two stars for a competent pair, three for experts.** Three stars for two players is 200,
  which is nine or ten soups — beyond 240 s at 30-35 s a soup. Two stars (120) is comfortable.
  Orders were arriving every 16 s against a 30 s production rate, so the board sat permanently
  full and every extra ticket became a penalty. At 20 s, capped at four and lasting 85 s, the
  queue saturates gently instead: a pair serving seven soups lands around 120 rather than 100.

`max` is worth understanding here. `updateOrders` skips a spawn entirely when the board is
already full, so lowering `max` lowers the number of tickets that ever exist, not just how many
are on screen. That is why dropping 5 to 4 on 1-2 and 1-3 does more than tidy the HUD.

### The changes

| Level | Before | After |
| --- | --- | --- |
| 1-1 | initial 1, every 18 s, max 4, 60 s | initial **2**, every 18 s, max 4, 60 s |
| 1-2 | initial 2, every 18 s, max 5, 70 s | initial 2, every **26** s, max **4**, **90** s |
| 1-3 | initial 2, every 16 s, max 5, 75 s | initial 2, every **20** s, max **4**, **85** s |

The 1-1 change is not about difficulty. With a single starting ticket, serving it leaves the
kitchen with nothing to serve for a further 18 s, and a soup carried to the hatch in that window
is rejected outright and costs its plate. A second ticket on the board removes the dead window.

`tests/levels.test.ts` asserts these four numbers per level, so a future change to them has to
be deliberate.

### Geometry the playtest turned up

None of it is order tuning, so none of it was changed here. Each item is a one- or
two-character edit for whoever owns the grids.

- **1-1's fire extinguisher cannot be picked up.** `E` sits at (12,0) with a counter at (11,0),
  a counter at (12,1) and the edge of the map on its other two sides, so no chef can ever face
  it. A fire in this kitchen can never be put out. Moving the `E` one column left, to (11,0),
  fixes it: that tile is reachable from the walkable (11,1). Evidence:
  `tools/playtests/09-1-1-extinguisher-unreachable.txt`.
- **1-2 has exactly one way through the crossing.** Column 9 is counter at every row except
  y=1, and column 5 opens only at y=3 and y=4, so every ingredient, every plate and every
  finished dish funnels through the single tile (9,1). Two chefs cannot pass each other in it,
  and one left standing there blocks the other completely. A second gap — opening (9,3) or
  (9,4) — would turn the level from a queue into a kitchen.
- **1-2's crossing is never empty.** Lanes 6 and 8 are occupied from 1.5 s to 3.5 s of every 4 s
  cycle and lane 7 from 3.5 s to 5.5 s, so the union covers the whole timeline. A single lane is
  clear about half the time, which is what makes crossing possible at all, but there is no
  moment when a chef can simply walk across. If the level plays as too hostile, raising
  `intervalSec` on one of the two pedestrian dynamics is the dial.
- **1-3's open deck is nearly sealed off.** Row 7 runs the full width, but row 6 is solid at
  every column except 0, 10 and 11. A chef on the deck on the left-hand side has to walk to
  column 0 and up through row 0 to get back to the burners. That is fine — it is a real
  Overcooked detour — but it makes the left half slower than the map suggests at a glance.
- **1-3's two divider segments pass through each other.** At amplitude 1 in opposite phase the
  three-tile group and the two-tile group overlap by up to 1.6 tiles, so the divider is five
  tiles long only at offset 0 and about 3.4 tiles the rest of the time. It reads fine on screen
  and the gap behaviour is what the level wants, but the two runs of counter are occupying the
  same space, and a smaller amplitude or a different split would avoid it.

## Schema

No schema changes were needed: every station in these three levels maps onto a `LEGEND`
character and a `Dynamic` variant that already exist.
