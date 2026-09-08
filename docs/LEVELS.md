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

Tuning knobs: `orders` (initial 1, a new order every 18 s, at most 4 at a time, 60 s each) is a
guess sized to the one pot. Star thresholds are the only scoring numbers the wiki supplies, so
order pressure is the dial to turn if the level plays badly.

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

Order tuning: initial 2, a new order every 18 s, at most 5, 70 s each.

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
and `2`; orders (initial 2, a new order every 16 s, at most 5, 75 s each). Three recipes and no
sink means order pressure and plate count are what decide whether the plate stack becomes the
bottleneck.

## Schema

No schema changes were needed: every station in these three levels maps onto a `LEGEND`
character and a `Dynamic` variant that already exist.
