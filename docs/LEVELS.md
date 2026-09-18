# Overcooked 1 world 1: levels 1-1 to 1-6

Transcriptions of the six Overcooked 1 world-1 kitchens into the grid format described in
`docs/LEVEL_SCHEMA.md`. One JSON file per level under `src/levels/oc1/`.

## How these were read

Screenshots: `docs/research/screens/oc1_1-*.png` (the OC1 shots on the wiki) plus the All You
Can Eat remaster shots (`File:Overcooked11-1.png` and friends) as a second camera angle. The
1-4 to 1-6 transcriptions use `docs/research/screens/oc1/1-4.jpg`, `1-4-ayce.jpg`, `1-5.jpg`
and `1-6.jpg` from the same folder. Text facts come from the level pages' infobox, Overview
and Star Chart sections, fetched through the MediaWiki API as described in `CLAUDE.md`, and
the star numbers the level pages leave blank come from the
[Level 1](https://overcooked.fandom.com/wiki/Level_1) summary and the
[Overcooked! Levels](https://overcooked.fandom.com/wiki/Overcooked!_Levels) overview table,
as catalogued in `docs/research/oc1-levels.md`.

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
###O####S##E#
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
| `E` (11,0) | Counter with the fire extinguisher. The screenshot puts it in the corner at (12,0), but that tile touches no floor tile, so no chef could ever reach it; it sits one tile in, where a chef at (11,1) can grab it. |
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
lanes (x 6 and x 8) every 7 s, starting at 1.0 s; the second walks people up the middle lane
(x 7) on the same interval, starting at 4.5 s. At 2.5 tiles/s a walker needs about 2 s to
cross, so every 7 s cycle has two clear windows of about 1.5 s (3.0-4.5 s and 6.5-8.0 s), enough
for a chef at 4.2 tiles/s to cross the three-tile road. The first cut (4 s intervals, starts at
1.5 s and 3.5 s) left the crossing occupied at every moment. Tuning knobs: `intervalSec`,
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

## 1-4 — Treacle Town burgers

```
##WD####FFFF#
T....###....E
A....###....#
U...........V
L....###....V
#....###....R
X....###....p
##B#B###pppp#
```

13 x 8. The first burger kitchen and the first with frying pans.

| Tile | Station |
| --- | --- |
| `W` (2,0) / `D` (3,0) | Sink basin and its draining board, side by side on the top wall |
| `F` (8,0)-(11,0) | The four burners, each with a frying pan |
| `T` (0,1), `A` (0,2), `U` (0,3), `L` (0,4) | Tomato, beef, bun and lettuce crates down the left wall |
| `E` (12,1) | Counter with the fire extinguisher |
| `V` (12,3), (12,4) | Serving hatch, two tiles tall |
| `R` (12,5) | Plate return |
| `p` (12,6) and (8,7)-(11,7) | The five clean plates — the most of any level in the series |
| `X` (0,6) | Bin |
| `B` (2,7), (4,7) | Chopping boards |
| columns 5-7 | The dividing counter block, open only at row 3 |

Wiki facts used: three burgers (Meat, Lettuce, Tomato-Lettuce); 4:00 with no prep time in
OC1; plates yes, washed at a sink; "the kitchen is made of two sectors connected by a small
1x3 corridor"; five plates, plate return, serving counter, four pans on burners and spare
counters on one side, ingredient boxes, sink, bin and chopping stations on the other; and the
strategy "place chopped beef on the counters in the middle of the level so that another chef
can grab it and fry it", which is what the divider is for.

Uncertainties, and how they were settled:

- **The wiki says "left" twice.** The Overview puts the plates, plate return, serving counter
  and pans "on the left side" and then the crates, sink, bin and boards "on the left side"
  too. The AYCE screenshot settles it: cooking and serving are on the right, ingredients and
  prep on the left. Same copy-paste slip as 1-6's Overview.
- **Tile count.** Anchored on the AYCE shot (`1-4-ayce.jpg`), which is the sharper of the two.
  The four bottom-row plates sit 65 px apart and the four pans 52 px apart; the room spans
  843 px at the bottom row and 670 px at the top, a ratio of 0.795 that matches the same 13
  columns at both depths. Eight rows come off the left wall, where the four crates, the
  counter and the bin are drawn one tile each.
- **The divider is three columns wide, and its middle column is a brick pillar**, not a
  counter you can use. `(6,1)`, `(6,5)` and `(6,6)` therefore have no walkable neighbour.
  `(6,2)` and `(6,4)` are reachable from inside the corridor, which is exactly how the
  screenshot reads.
- **Which row the corridor is on.** The upper block of the divider is three rows deep and the
  lower block four, so the gap lands at row 3, slightly above centre. Measured: the upper
  block covers screen y 250-405 and the lower 435-680.
- **The extinguisher is at (12,1), not the corner.** Items sit raised on their counter, so
  the extinguisher drawn at y=300 belongs to the tile centred at y=318, one row below the top
  wall. That also makes it reachable, which the corner tile would not be — the bug
  `tools/playtests/09-1-1-extinguisher-unreachable.txt` found in 1-1.
- **Star thresholds.** The level page's OC1 columns are blank. The
  [Level 1](https://overcooked.fandom.com/wiki/Level_1) summary gives one player 40 / 90 /
  160, and the Overcooked! Levels overview gives two players a 3-star of 280. The 1- and
  2-star values for two players are the one-player row scaled by 280/160 = 1.75 and rounded
  to tens: 40 → 70, 90 → 157.5 → **160**, so `[70, 160, 280]`.

Tuning knobs: `orders` (initial 2, a new order every 20 s, at most 4 at a time, 100 s each).
A burger is a longer dish than a soup (fetch, chop, fry, plate, and up to four components),
so the ticket life is longer than the soup kitchens'. The drip started at 24 s and was
measured down to 20 s because at 24 s the ticket supply, not the kitchen, was what kept the
score short of three stars — see "World 1 playtest" below.

## 1-5 — the ring

```
#MOT#RVVE#WD##
#............X
#.##########.#
#.##########.#
#.##########.#
#.#######ppp.#
#............#
#B#B####S#S#S#
```

14 x 8. One oval corridor, one tile wide, with every station on its rim.

| Tile | Station |
| --- | --- |
| `M` (1,0), `O` (2,0), `T` (3,0) | Mushroom, onion and tomato crates, upper-left |
| `R` (5,0) | Plate return |
| `V` (6,0), (7,0) | Serving hatch, two tiles wide |
| `E` (8,0) | Counter with the fire extinguisher |
| `W` (10,0) / `D` (11,0) | Sink basin and draining board, upper-right |
| `X` (13,1) | Bin, top of the right wall |
| `p` (9,5), (10,5), (11,5) | The three clean plates, on the island's south edge |
| `B` (1,7), (3,7) | The two chopping boards, lower-left |
| `S` (8,7), (10,7), (12,7) | The three pots on burners, lower-right |
| rows 2-5, columns 2-11 | The island — a solid counter block with the grill on top |

Wiki facts used: all three soups; 4:00, no prep time; plates yes, sink washing; "this kitchen
features an oval corridor in which all of the appliances lie", with ingredient boxes
upper-left, two chopping stations lower-left, three pots and burners lower-right and a sink
upper-right; the strategy that both chefs should run circles rather than turn back; star
thresholds 30 / 70 / 120 for one player.

Uncertainties, and how they were settled:

- **The ring is exactly one tile wide, and the test asserts it.** Measured off `1-5.jpg`: the
  checkered corridor between the crates and the island is 35 px deep where the row pitch is
  47, and the same on the left, right and bottom runs. The island's south face carries ten
  counter-front handles, one per tile, 60 px apart, which is where the 10-wide island and
  therefore the 14-wide room come from.
- **The corridor is wider in front of the serving counter, and that is not modelled.** The
  infobox says "1 block wide pathway everywhere except near Serving Counter", and the
  screenshot does show the top wall stepping back around the hatch. Flattening it keeps the
  ring a true loop, which is what the level is about and what the test checks. A ring cannot
  deadlock — two chefs who meet head-on can always go the other way round — so nothing is
  lost but a passing place. To restore it, add a row and open the two tiles behind `V`.
- **The plate return is inferred.** The infobox says plates yes, so a plate return exists,
  but in the only screenshot both chefs are stood in front of the hatch and one of them
  covers the tile at (5,0). Every other tile on the rim is accounted for, and the plate
  return sits beside the serving counter in every other world-1 kitchen, so it goes there.
  This is the single least certain tile in the three levels.
- **The island's middle is dead counter.** Rows 3-4, columns 3-10 have no walkable
  neighbour. That is the raised brick grill in the screenshot, not a mistake, and the
  reachability test ignores plain counters for exactly this reason.
- **Star thresholds.** One player 30 / 70 / 120 from the Level 1 summary; two players only
  have a 3-star of 160 from the overview table. Scaling the one-player row by 160/120 = 1.333
  and rounding to tens gives `[40, 90, 160]`.

Tuning knobs: `orders` (initial 2, every 20 s, at most 4, 85 s each — the same as 1-3, which
is the closest level in shape: three soups, three cookers, one long walk). The ring makes
walking, not cooking, the bottleneck, so `intervalSec` matters more here than `max`.

## 1-6 — the earthquake

```
##WD###pFpFp#
A.....G.....#
T.....G.....E
L.....G.....V
#.....G.....V
#.....G.....R
X.....G.....#
##B#BF###F#U#
```

13 x 8. The only Overcooked 1 kitchen with an elevated half.

| Tile | Station |
| --- | --- |
| `W` (2,0) / `D` (3,0) | Sink basin and draining board, top-left |
| `p` (7,0), (9,0), (11,0) | The three clean plates, along the top wall of the high side |
| `F` (8,0), (10,0) | Two of the three high-side pans |
| `A` (0,1), `T` (0,2), `L` (0,3) | Beef, tomato and lettuce crates down the left wall |
| `X` (0,6) | Bin |
| `E` (12,2) | Counter with the fire extinguisher |
| `V` (12,3), (12,4) | Serving hatch, two tiles tall |
| `R` (12,5) | Plate return |
| `B` (2,7), (4,7) | Chopping boards |
| `F` (5,7) | The low side's single pan |
| `F` (9,7) | The third high-side pan |
| `U` (11,7) | Bun crate |
| `G` (6,1)-(6,6) | The seam: gate group `1` |

Wiki facts used: three burgers; 4:00, no prep time; plates yes, sink washing; "this kitchen
has a constant earthquake that splits the right and left sides… the right side is elevated,
meaning all chefs can drop down at any moment"; low side has tomato, lettuce and beef crates,
chopping stations, the sink, a pan and the bin; high side has 3 plates, 3 pans, the serving
counter, the bun crate and the plate return; and the strategy "when the floor lowers, chuck
all of the food to the right".

Uncertainties, and how they were settled:

- **The earthquake is a gate, and the gate is symmetric. The original is not.** In the real
  1-6 the right half rises and falls: when it is down you can walk both ways, when it is up
  you can still *drop down* from the high side to the low side but not climb back, and
  everything else is thrown across. This sim has no throwing and no one-way tiles, so the
  seam is a column of `gate` tiles that is simply open or shut for both chefs alike. That
  makes the high side easier to leave than it should be and the low side impossible to leave
  when it should merely be expensive. It is the largest approximation in these three levels.
- **Gate timing is a guess.** `periodSec` 10, `openSec` 4, starting open. Four seconds is
  about two crossings at 4.2 tiles/s, and six seconds shut is long enough to hurt without
  stranding a chef mid-burger. `periodSec`, `openSec` and `phase` are the dials.
- **Where the seam runs.** The screenshot (`1-6.jpg`) catches the two halves level, so the
  seam is invisible in it and had to be reasoned out from the station split. The 13 columns
  resolve cleanly: the top wall carries plates at columns 7, 9 and 11 and pans at 8 and 10;
  the bottom wall carries boards at 2 and 4, pans at 7 and 9 and the bun crate at 11. Put the
  seam anywhere and the counts do not match the wiki: at 6/7 the high side gets four pans and
  the low side none, at 7/8 the high side gets only two of its three plates. The seam is at
  column 6 — which keeps all three plates, the bun crate and the serving side together — and
  **the bottom-wall pan at column 7 was moved to column 5**, so the low side gets its one pan
  and the high side its three. One pan, two columns; everything else is where the screenshot
  puts it.
- **The counters at (6,0) and (6,7)** sit at the top and bottom of the seam and can only be
  reached through the gate. They are the natural hand-off ledges and are left as counters.
- **Star thresholds.** The level page's OC1 columns are blank, but the Level 1 summary does
  fill in one player: **40 / 60 / 90**. (The brief for this transcription assumed only the
  3-star was known and proposed 30 / 60 / 90; the wiki's own 1-star is 40, so 40 is used.)
  For two players only the 3-star of 200 exists. Scaling the one-player row by 200/90 = 2.22
  would put a 2-player 1-star at 90, as demanding as the whole one-player three-star run, and
  1-6's one-player row is unusually compressed to begin with. So two players get 30 % / 60 %
  of the 3-star instead — the same rule 1-3 uses — giving `[60, 120, 200]`.

Tuning knobs: the gate (`periodSec`, `openSec`, `phase`), and `orders` (initial 2, every
24 s, at most 4, 100 s each — the same starting point as 1-4, since it is the same recipe
set). If the gate proves punishing, lengthen `openSec` before touching the orders.

## 2-3 — Treacle Town, the belt loop

```
>>>>>>>>>>>>v
^W...E .p..#v
^D...F B...#v
^A.... ....Vv
^L...F B...Rv
^U.... ....#v
^T...X#p.pX#v
^<<<<<<<<<<<<
```

13 x 8. The catalog grid (`docs/research/catalog/oc1/oc1-2-3.md`, medium confidence) with three changes:

- **The belt runs through the pillar.** The catalog drew the pillar's column as `#` on rows 0 and 7, which would stop the loop at a counter. The wiki says the belt "runs in a circle around the kitchen", so (6,0) and (6,7) are belt.
- **Corners turn.** (12,0) is `v` and (0,7) is `^`; the catalog's `>` and `<` there point off the grid.
- **The pillar is wall, not counter.** Rows 1 to 5 of column 6 are interior void (drawn as a wall block), because the catalog says nothing can be put on it. (6,6) is a `#`: it has no walkable neighbour, so as void it would draw as a hole.

| Tile | Station |
| --- | --- |
| `>` `v` `<` `^` | The clockwise belt round the whole kitchen, 38 tiles; only the north and south runs have floor beside them |
| `W` (1,1), `D` (1,2) | Sink and rack, west |
| `A` `L` `U` `T` (1,3)-(1,6) | Beef, lettuce, bun and tomato crates, west |
| `F` (5,2), (5,4) | Two pans, west |
| `E` (5,1), `X` (5,6) | Extinguisher and bin, west |
| `B` (7,2), (7,4) | Boards, east |
| `p` (8,1), (7,6), (9,6) | The three plates, east |
| `V` (11,3), `R` (11,4), `X` (10,6) | Serve, plate return and bin, east |

Wiki facts used: the three burgers; 4:00, no prep time; the clockwise loop and which chef has what (Overview); 15 stars to unlock from the stars-to-unlock table (the infobox says 9); 3-star scores 120 (1P) and 180 (2P). The 1- and 2-star values are a third and two-thirds of those, an estimate. Orders are the catalog's estimate (2, every 26 s, at most 4, 110 s), untested. Belt speed is not on the wiki: 1.5 tiles/s, the catalog's estimate (a dash must outrun it, per the Dash page).

## 2-4 — Treacle Town, belts into bins

```
#ppp##B#B######
#.............V
#.............R
#X<<<>>X<<>>>X#
F.............#
F.............#
F.............#
###WD##E##ULTA#
```

15 x 8, the catalog grid unchanged. The middle band is three bins with belts between them, each run carrying toward its nearest bin; the two rooms never touch. North: three plates, two boards, serve, plate return. South: three pans, sink and rack, extinguisher, the four crates.

Wiki facts used: the three burgers; 4:00; belts that lead to bins instead of circling (Overview); three plates (Overview); 17 stars to unlock from the table (infobox 10); 3-star 110 (1P) and 160 (2P), lower thresholds estimated as for 2-3; trashed plates and cookware respawn after 5 s where they started, clean staying clean and dirty staying dirty (Trash Bin page), which is `TRASH_RESPAWN_SEC`. A clean plate that did not start on the grid (one washed at the sink) goes back to the first plate's counter. Orders are the catalog's estimate (2, every 24 s, at most 4, 110 s), untested.

## 2-1 — Ravenous Roads, two trucks

```
#FFF#ppp#
U.......V
#.......R
____GGGGG____
    A.......X
    L.......#
    T.......B
    #E###B###
```

13 x 8, the catalog grid (medium confidence) with its highway row written as a seam: `G` hole gates across the five columns where the beds overlap, `_` road either side. The sim's grid is static, so the trucks do not move; what moves is the seam. It is deck (walkable) for 4 s of every 12 while the trucks touch, then road for 8 s: a chef on it falls and is out 5 s. The deck glows before it goes, the tell the 3-3 page describes. Throws cross either way.

Wiki facts used: the three burgers; 4:00; "Moving Trucks, 5 second penalty for falling off" (infobox); no sink, plates come back clean (the plate return at (8,2) is a `plateStack` override, as in 3-2); 10 stars to unlock (table; the infobox says 7); 3-star 180 (1P) and 240 (2P), lower thresholds estimated. The cycle (12 s, touching a third of it) is the catalog's estimate. Orders the catalog's estimate (2, every 26 s, at most 4, 110 s), untested.

## 3-3 — Ravenous Road, three trucks

```
#BB#_OJ%MTX_#BB#
S...G......G...Y
#...G......G...p
S...G......G...Y
#...G......G...p
S...G......G...Y
E...G......G...E
#...G......G...#
#pp#_##VR##_####
```

16 x 9. The catalog's arrangement is 20 x 9, over the 16 x 10 budget, and it says itself that the arrangement is invented ("the three beds counted cleanly; what is invented is their arrangement in one grid"). So the beds are turned on their side and stood in a row: the soup truck (three pots with a counter between each, two boards, extinguisher, two plates) on the left, the supply truck (onion, fish, potato, mushroom and tomato crates, bin, serving counter, plate return) in the middle, the fish truck (three fryers with plates between, two boards, extinguisher) on the right. Station counts match the catalog. Each seam is a column of hole gates: group `1` on the left, group `2` (a `stations` override per tile) on the right, each open 6 s of 12 and out of phase, so the supply truck touches one cooking truck at a time.

Wiki facts used: soups and fish and chips in one order pool, the first level to do that; no sink, plates return clean (the return at (8,8) is a `plateStack`); four plates; one chef per cooking truck (Strategies); 26 stars (table; infobox 16); 3-star 150 (1P) and 270 (2P), lower thresholds estimated. Orders the catalog's estimate (2, every 20 s, at most 5, 110 s), untested.

## 3-4 — Glazed Glacier, the frozen river

```
#XYY##___#ppY##
J.....___.....#
%.,,,,___,,,,.#
E.,,,,___,,,,.V
#.,,,,___,,,,.V
#.,,,,___,,,,.R
#.....___.....#
#WD###___#B#B##
```

15 x 8, the catalog grid with its two `=` frames of floe turned back into river: the floes are a `floes` dynamic now. Floor next to a counter is snow (`.`, not slippery), the open middle of each bank ice (`,`), as the screenshot shows (white snow along the counter runs, blue ice inside) and the Overview says ("the snowy areas are not slippery"). Floes 3 wide (the river's width), 3, 2, 3 tiles long in turn, one every 6.5 s at 0.8 tiles/s, prefilled, all estimates: the wiki gives no interval, speed or size. West bank: bin, two fryers, fish and potato crates, extinguisher, sink and rack. East bank: two plates, the third fryer, the two-tile hatch, plate return, both boards.

Wiki facts used: the fish and chips family; 4:00; two plates (Strategies); the floes as the only way across; +5 s for falling in (infobox); snow grips and ice does not; 29 stars (table; infobox 18); 3-star 170 (1P) and 180 (2P), lower thresholds estimated. Orders the catalog's estimate (2, every 24 s, at most 4, 110 s), untested.

## 3-1 — Glazed Glacier, fish and chips on the ice

```
_____RVV_____
____,,,,,____
__,,,,,,,,,__
_,,#B#BE#X,,_
_,,W#####J,,_
_,,D#####%,,_
_,,#YYY##Y,,_
_,,,,,,ppp,,_
__,,,,,,,,,__
____,,,,,____
```

13 x 10, the catalog grid (`docs/research/catalog/oc1/oc1-3-1.md`, medium confidence) with its floor written as ice (`,`) and its sea as `_` gaps. The island counted cleanly; the floe's rounded outline is read off the screenshot's silhouette, not measured.

| Tile | Station |
| --- | --- |
| `R` (5,0), `V` (6,0)-(7,0) | Plate return and the two-tile serving hatch, on their own ledge north of the floe |
| `B` (4,3), (6,3) | Boards |
| `E` (7,3), `X` (9,3) | Extinguisher and bin |
| `W` (3,4), `D` (3,5) | Sink and rack, the island's west face |
| `J` (9,4), `%` (9,5) | Fish and potato crates, east face |
| `Y` (4,6)-(6,6), (9,6) | The four deep fryers with baskets |
| `p` (7,7)-(9,7) | Three clean plates |
| `_` | The sea: falling in costs `FALL_PENALTY_SEC` (5 s, the infobox) |

Wiki facts used: chips, fried fish, fish and chips; 4:00, no prep time; the slippery floor and the detached hatch (Overview); "steer into the corners" (the one strategy line); 20 stars to unlock from the table (infobox 12); 3-star 200 (1P) and 220 (2P), lower thresholds a third and two-thirds, estimated. The recipe id is `fried_fish`, not the catalog's `fish`, so the dish never reads as the ingredient. Scores 15 / 15 / 25 are the research doc's estimates. The wiki gives no fry time (`DEEP_FRY_TIME` is the pan's 9 s) and no friction (`ICE_ACCEL` 7, `ICE_DECEL` 3.5 tiles/s², a slide of about 2.5 tiles from full speed); both want tuning by play. Orders are the catalog's estimate (2, every 22 s, at most 4, 100 s), untested.

## Overcooked 2 1-2 — Sushi City courtyard

```
 #BBBppRV##
 ..........
 ..........
 ....IJn...
~~~~~~~~~~~~
 ..........
 ..........
 ###XpSSSp#
```

12 x 8, the catalog grid with its crates in the clone's legend (`I` rice, `J` fish, `n` nori) and the pedestrian row running the full width so townsfolk enter and leave through the gaps in the side walls. Two lanes, one each way, every 8 s at 2.2 tiles/s, offset by 4 s (estimates; the wiki names the obstacle only). The plate return at (7,0) is a `plateStack` (no sink, plates come back clean).

Wiki facts used: fish sushi only; 2:30 with the clock starting on the first serve; four plates; the plate return beside the serve; 2 stars to unlock; stars 1P 60 / 180 / 300, 2P 60 / 220 / 420 (OC2 star chart, used as is; the 4-star column is not modelled). Sushi scores 40 (a boil and a chop at 20 each, the research estimate). Orders the catalog's estimate (2, every 22 s, at most 4, 80 s), untested.

## Overcooked 2 1-3 — Sushi City, the diagonal

```
#BBB###SSS###
I.....#.....#
Ø.p...#.....p
n.#...#.....c
#.p...#.....p
V.#...#.....#
#.....X.....#
#...........#
#######DWR###
```

13 x 9, the catalog grid (`n` nori, `c` cucumber). The centre counter runs from the top wall to the bin, so the halves meet only along the bottom rows. The first OC2 sink.

Wiki facts used: prawn sashimi and cucumber sushi; 3:00; four plates, sink and return together; the left/right split (Strategies); 3 stars; stars 1P 40 / 120 / 160, 2P 40 / 160 / 320. Orders the catalog's estimate, untested.

## Overcooked 2 1-4 — Sushi City, the moving floors

```
#nI##Jc#BB###
X»»»»»»»»»»»S
W...........S
D..##pp##...#
#..##pp##...S
#...........#
#«««««««««««#
#####RV######
```

13 x 8, the catalog grid (low confidence) with its two belt rows written as walkable belts: the wiki says to travel with them and dash against them, so they are floor that carries chefs, not counters. The two fire pits are plain counters; the four plates sit between them. The wiki's Overview names a prawn crate, but no recipe uses prawn and the screenshot's crate is blue: fish, as the catalog decided.

Wiki facts used: fish and cucumber sushi; 3:30; four plates, sink; conveyor belts and a narrow corridor (infobox); 4 stars; stars 1P 80 / 180 / 340, 2P 120 / 260 / 400. Belt speed 1.5 tiles/s, an estimate. Orders the catalog's estimate, untested.

## Overcooked 2 1-5 — Buffet Balloons

```
#########
#...FF..#
#.......# ##WD#
#XBBBpp.# #...T
#.......#_#...R
#........G....a
#..S#S..#_#...#
#.......# #...#
######### ##V##
```

15 x 9, the catalog grid (low confidence) with three changes. The crossing `=` is a hole gate (open 6 s of 12): the balloons drift together and apart. The three boards are a slider group (`boards`, 1 tile up and down every 8 s), the "moving tables". And the counter line across the big balloon leaves its last tile open at (7,3), with the two plates at (5,3) and (6,3): as catalogued the line sealed the pans off from the rest of the deck, which only the moving boards could open, and a board that is not there yet cannot be the only way to the pans. The tiles either side of the crossing are `_` so the sky shows there, not a wall.

Wiki facts used: tomato pasta; 3:00; two plates; the sink on the small balloon; shifting platforms and moving tables (infobox); 5 stars; stars 1P 40 / 100 / 200, 2P 80 / 180 / 260. Pasta scores 60 (a boil, a chop and a fry). Orders the catalog's estimate (2, every 26 s, at most 4, 100 s), untested.

## Overcooked 2 2-4 — Moreish Mines, the bridge

```
##SS##___##BB##
r....#___#....A
M....p___p....I
p....p___#....#
#....#___#....W
#.............D
#....#___#....#
V....#___#....X
#R####___##FFE#
```

15 x 9, the catalog grid with its bridge `=` as plain floor and the chasm as `_`. Pots, tortillas and mushrooms left; boards, pans, beef and rice right.

Wiki facts used: beef and mushroom burritos; 4:00; four plates; the single bridge (infobox: bottleneck); the left/right roles (Strategies); 10 stars; stars 1P 300 / 420 / 560, 2P 360 / 480 / 660. Burritos score 60. Orders the catalog's estimate, untested.

## Overcooked 2 4-3 — Moreish Mines, the reversing walkways

```
####### #######
#UHppp. .B#ER##
V.....»»».....#
#AL.... .....B#
#......#..F...#
#W..... ..F...#
#....««««..X..#
####### #######
```

15 x 8, the catalog grid with its two belt runs written as walkable belts (the Strategies talk of walking on them) and a `beltReverse` dynamic turning both every 30 s (a wiki fact). The rift is interior void, drawn as wall.

Wiki facts used: meat, cheese and lettuce-cheese burgers; 4:00; three plates; the hand-off counter on the dividing wall at (7,4); 32 stars; stars 1P 180 / 220 / 300, 2P 200 / 240 / 340. The burgers are OC2's own ids (`oc2_meat_burger` 40, `cheese_burger` 60, `lettuce_cheese_burger` 80), since OC1's burgers score by OC1's table. Orders the catalog's estimate (2, every 20 s, at most 5, 80 s), untested.

## 4-2 — Munch Mansion, in the dark

```
       #ES#ppp#
##WD##B.......V
B.............R
#.............#
#.....##X######
S.....#######T#
#.............#
#.............#
O.............M
###############
```

15 x 10, the catalog grid unchanged, with `"dark": true`: the stage's lights drop to a sliver and each chef carries a lamp (a cone about 90 degrees wide and 3 tiles long ahead of it, and a small glow round it; the catalog's estimate). The wiki's glowing raw ingredients are not modelled yet.

Wiki facts used: the three soups; 4:00; three plates beside the serve; darkness, lit only by the chefs' lamps; 35 stars (table; the infobox says 22); 3-star 100 (1P) and 110 (2P), lower thresholds estimated. Orders the catalog's estimate (2, every 18 s, at most 4, 60 s), untested.

## Overcooked 2 5-2 — Buffet Balloons, fires in the ring

```
###############
#.............#
#.##B.#U#.#B#.#
V.#....#....E.#
#.F...H#L...F.#
#.#...T#A...F.#
#.X....W....R.#
#.#.#######.#.#
#.............#
##p#p#####p#p##
```

15 x 10, the catalog grid (medium confidence) with four openings: as catalogued both stations were sealed off from the ring corridor, which the catalog itself says has three exits. Each station now opens to the corridor at the top (5,2) and (9,2) and the bottom (3,7) and (11,7). The two stations share the bun crate and the sink on their dividing wall. A `floorFires` dynamic lights a fire on a random floor tile every 22 s, at most two at once, the first after 30 s (estimates: the wiki gives no period).

Wiki facts used: the four burgers (OC2's own ids); 4:00; four plates round the ring; random floor fires that block corridors and can corner a chef; 47 stars; stars 1P 180 / 220 / 300, 2P 240 / 300 / 420. Orders the catalog's estimate (2, every 20 s, at most 5, 80 s), untested.

## 4-1 — Munch Mansion, the drifting counters

```
  #E#N#N#N#X#
 ............#
###.....#ppp####
W.......#......V
D.......#......V
#.......#......R
#..............#
####B#B##...####
............#
####&THMe###
```

16 x 10: the catalog's 16 x 12 (low confidence) with one row taken out of each corridor to fit the 10-row budget, and the corridors' open ends closed with a counter. The wiki's "free-floating counters" become three slider groups: the wall between the rooms (`divider`, up and down), the counter of boards (`boards`, left and right) and the counter of plates (`plates`, left and right, the plates riding on it); a waypoint path would be more faithful. Three ovens north, five crates south (`&` dough, `T` tomato, `H` cheese, `M` mushroom, `e` pepperoni).

Wiki facts used: pizza, pepperoni and mushroom pizza; 4:00; three ovens; the moving counters that swap who washes and who serves; 29 stars (table; infobox 20); 3-star 120 (1P) and 200 (2P), lower thresholds estimated. Pizza scores 25 / 30 / 30 are the research doc's OC1 estimates. The ticket life is 90 s rather than the catalog's 60 s estimate, which a pizza (three chops and a bake) does not fit; untested.

## Overcooked 2 3-1 — Conjurer's Kitchen, the moving wall

```
##X##V#R#####
#...........#
######.######
#.....#.....#
#.....B.....#
#.....B.....#
#.....B.....#
p.....#.....#
E.....#.....W
#Tpp####NN&HD
```

13 x 10. The catalog grid (low confidence) with its sliding counter re-based at the room's middle: a slider group (`wall`, six tiles, three of them boards) swings two tiles either side every 60 s, so it sweeps the lower room and decides who can reach the stairs at (6,2), the ovens and the sink. The extinguisher moved up a row beside the plates (as catalogued it had no floor next to it), and a plate with it.

Wiki facts used: pizza only; 3:30 with the clock waiting for the first pizza; three plates; the counter moving about every 30 s; 16 stars; stars 1P 240 / 340 / 460, 2P 480 / 600 / 820. OC2 pizza scores 80. Orders the catalog's estimate, untested.

## Overcooked 2 3-3 — Conjurer's Kitchen, the quarters

```
##X#B###BE###
#.....G.....#
#.....G.....V
#.....G.....#
#.....&.....#
#G#pHGpGTp#G#
#.....e.....#
#.....G.....#
#.....G.....#
#NWD#####NR##
```

13 x 10 (one of the catalog's two identical south rows dropped for the budget). The wiki's sliding crates close a vertical and then a horizontal split in turn; here the crates stay put in the middle cross and the splits are two wall-gate groups: `v` down the middle column, `h` across the middle row. `v` closes at 10 s for 35 s of every 70; `h` is open the first 45 s of every 70, so the room is whole for the first ten seconds and then cut one way and the other in turn (the wiki: open 10 s, then alternating every 30 to 40 s).

Wiki facts used: pizza and pepperoni pizza; 4:00; three plates on the middle counters; every quarter missing something; 20 stars; stars 1P 200 / 280 / 380, 2P 380 / 480 / 640. Orders the catalog's estimate, untested.

## 3-2 — Savoury Seas, the split deck

```
#EV#####XV####
S..  ..M....S.
X..  ..O....S.
S.####.T......
.......#.  ...
.......#.  ...
.......#......
pppB#B##......
.......#......
```

14 x 9.

| Tile | Station |
| --- | --- |
| `E` (1,0) | Counter with the fire extinguisher |
| `V` (2,0), (9,0) | The two serving hatches, one per half |
| `#` (5,0) → `plateStack` | The plate return, overridden in `stations`: plates come back clean here |
| `X` (8,0), (0,2) | Bins, one per half |
| `S` (0,1), (0,3), (12,1), (12,2) | The four burners with pots, two per half |
| `M` (7,1), `O` (7,2), `T` (7,3) | The crates, on the divider so both chefs reach them |
| `#` (2,3)-(5,3) | The mid-deck counter run |
| `p` (0,7), (1,7), (2,7) | The three clean plates |
| `B` (3,7), (5,7) | Chopping boards, port side only |
| ` ` (3,1)-(4,2), (9,4)-(10,5) | The two open cargo grates: solid holes, drawn as void |

Wiki facts used: onion, tomato and mushroom soup; 4:00, no prep time; plates "No", so
`plates.mode` is `stack`; 23 stars to unlock from the stars-to-unlock table (the infobox says
14; the table is the better source); the overview's rotation of roles between "handing
Ingredients, serving and cooking" and "Chopping and bringing plates from the Plate Return"; and
the strategy tip to keep the plates where every chef can reach them.

Uncertainties, and how they were settled:

- **The grid is a schematic.** The catalog record (`docs/research/catalog/oc1/oc1-3-2.md`) rates
  its own grid low confidence: the deck has no tile-aligned texture and the railings give no
  usable vanishing point, so station families and sides are right and exact tiles are not.
  Taken as is; walk it and move stations by feel.
- **The plate return.** The wiki's plate return hands plates back clean and there is no sink,
  which is `plates.mode: 'stack'`: plates respawn on a `plateStack` tile after a serve. The
  return tile at (5,0) is a `#` overridden to `plateStack` so it starts empty, and the three
  starting plates sit on the south counter as `p`, matching `plates.count: 3`.
- **Star thresholds.** Only the 3-star values are published: 100 for one player, 160 for two.
  The 1- and 2-star values follow 1-3's 30% / 60% rule: 1P `[30, 60, 100]`, 2P `[50, 100, 160]`.
- **Orders.** No cadence on the wiki. The catalog's estimate, initial 2, every 22 s, at most 4,
  95 s each, close to 1-3's numbers on the same deck with the same recipes. Untested.
- **The grates.** Obstacles with no penalty in Overcooked 1, so they are void (solid, drawn as
  a hole), not the clone's `gap` tile, which a chef falls into.
- **The unlock.** 23 stars is more than world 1 can give (18), so until worlds 2 and 3 land the
  level opens through free play only.

The two halves never touch: everything crosses over the divider, and the strip of deck below
the south counter (row 8, port side) is a dead end. The starboard chef has no board, so chopped
ingredients travel over the divider; the port chef has the only plates.

Tuning knobs: orders; the plate count; which side the second bin sits on.

## Overcooked 2 1-1 — Sushi City

```
##########
#........V
X........#
J.pp..pp.Ø
#........#
#........#
#........#
#BB####BB#
```

10 x 8.

| Tile | Station |
| --- | --- |
| `V` (9,1) | Serving hatch |
| `#` (9,2) → `plateStack` | The plate return, overridden in `stations`: plates come back clean here, beside the hatch |
| `X` (0,2) | Bin |
| `J` (0,3), `Ø` (9,3) | Fish and prawn crates, on opposite walls |
| `p` (2,3), (3,3), (6,3), (7,3) | The four clean plates on the two centre islands |
| `B` (1,7), (2,7), (7,7), (8,7) | Chopping boards, two per bottom corner |

Wiki facts used: Fish Sashimi and Prawn Sashimi, one chop and no heat; 2:30 with the clock
starting on the first serve; 1 star to unlock; no sink, plates return clean beside the serving
counter; star thresholds 1P 20 / 60 / 240 and 2P 20 / 160 / 300 (the 4-star column, 1300 and
2650, is dropped: the clone scores three stars).

Uncertainties, and how they were settled:

- **The grid** is the catalog's medium-confidence count (`docs/research/catalog/oc2/oc2-1-1.md`):
  counter seams along the top row and the left column, single-tile stations as the ruler,
  each island two plates wide.
- **The plate return.** Dirty plates come back clean with no sink, which is `plates.mode: 'stack'`;
  the return tile is a `#` overridden to `plateStack` so it starts empty, and the four plates sit
  on the islands as `p`.
- **Orders.** No cadence on the wiki. The catalog's estimate: initial 2, every 18 s, at most 4,
  60 s each. One chop per dish, so a quick drip. Untested.
- **Spawns** (2,6) and (7,6) are the catalog's best guess.
- **Theme** `sushi-city` has no dressing yet and draws with the default kitchen.

Tuning knobs: orders; whether the wiki's 4-player crowd at the islands matters with two chefs.

## The mechanics additions in shipped levels

`docs/MECHANICS.md` adds five switchable mechanics. Three shipped kitchens adopt the ones that
need level content, each through `stations`, `items` and an `eightySix` block so the grid text
stays the transcription. With the switches off every change is inert: the door is a solid tile,
the rack a plain counter, the crates bottomless.

| Level | Change | Why there |
| --- | --- | --- |
| 1-4 | `delivery` door at (0,5), a plain `#` on the left wall under the crates; `eightySix` crateSize 6, restock 30 s | The crates are on the left wall, so the delivery comes in beside them. Bun and meat are in every burger and exempt themselves; lettuce and tomato run out and rewrite Salad Burger to Lettuce Burger to Burger |
| 1-5 | `trayRack` at (11,3) on the island's right face, halfway round the ring from the crates, with the tray; `delivery` door at (4,0), the `#` between the tomato crate and the plate return; `eightySix` crateSize 6, restock 30 s | Three chopped ingredients per soup and a one-tile ring is the tray's case; the rack sits on the far side so fetching it is a decision, not a default. The door is beside the crates |
| OC2 1-1 | `delivery` door at (0,5) on the left wall; `eightySix` crateSize 6, restock 25 s | Fish and prawn each feed one sashimi, so a shortage swaps the ticket to the other |

1-1 to 1-3 and 1-6 are untouched: 1-1 has one recipe, so its onion is exempt and the 86 system
would never fire; the rest wait for play to say where a door or a rack helps. Two-plate carry
and chop assist need no level content and apply everywhere.

## Custom kitchens for the mechanics

Three levels under `src/levels/custom/`, `game: 'custom'`, one per layout-dependent mechanic.
They carry a title instead of a world-index and have no wiki source. Each must also play with
every mechanic off (a shelf becomes a wall, the rack a counter, the crates never run out), so
none of the layouts depends on a hatch or a tray for its route. Star thresholds and order numbers
are estimates from the nearest shipped level and have not been playtested.

### Hatch Row (`custom-1-1`)

```
#OTM####SSS#E##
#...... ......#
#......h......#
#......h......V
#......h......R
X...... ......W
#.............D
##B#B#####ppp##
```

15 x 8. A near-split soup kitchen: prep on the left, cooking on the right, a wall of void down
column 7 with three hatches (`h` at (7,2), (7,3), (7,4)) and a one-tile floor gap at the bottom
end (7,6). The hatches are the short way across; the gap is the long way round.

| Tile | Station |
| --- | --- |
| `O` (1,0), `T` (2,0), `M` (3,0) | The three soup crates, left room |
| `B` (2,7), (4,7) | Chopping boards, left room |
| `X` (0,5) | Bin, left room |
| `S` (8,0), (9,0), (10,0) | Three pots on burners, right room |
| `E` (12,0) | Counter with the fire extinguisher, right room |
| `V` (14,3) / `R` (14,4) | Serving hatch and plate return, right wall |
| `W` (14,5) / `D` (14,6) | Sink and draining board, right wall |
| `p` (10,7), (11,7), (12,7) | The three clean plates |
| ` ` (7,1), (7,5) | The wall itself: void, solid, a hole in the ground as the renderer draws interior void today |

Spawns (3,3) and (11,3), one per room. Orders as 1-5 (initial 2, every 22 s, at most 4, 90 s):
three soups with the walk as the bottleneck. Stars 1P 30 / 70 / 120, 2P 40 / 90 / 160.

Design notes: a chopped ingredient goes across a hatch in one step instead of a 12-tile walk
through the gap, so the hatches are worth about ten seconds per soup; with the shelf switch off
the level is the walk. Chop assist reads here too: the two boards are two tiles apart on one
wall. No `eightySix` block, so the 86 switch uses the constants (eight-item crates, 30 s restock,
no door: the crates refill by themselves).

### Long Haul (`custom-1-2`)

```
#dAULT######FFE#
#..............V
#..............R
#X#BB###t#pppWD#
```

16 x 4. A two-tile corridor the full width of the budget, for the tray. Everything an
ingredient needs is at the left end and everything a dish needs at the right, with the rack
in the middle.

| Tile | Station |
| --- | --- |
| `d` (1,0) | Delivery door, far left |
| `A` (2,0), `U` (3,0), `L` (4,0), `T` (5,0) | Meat, bun, lettuce and tomato crates |
| `X` (1,3) | Bin |
| `B` (3,3), (4,3) | Chopping boards, mid-left |
| `t` (8,3) | Tray rack, the middle of the run, with the tray |
| `p` (10,3), (11,3), (12,3) | The three clean plates |
| `W` (13,3) / `D` (14,3) | Sink and draining board, near the right end |
| `F` (12,0), (13,0) | Two pans on burners, far right |
| `E` (14,0) | Counter with the fire extinguisher |
| `V` (15,1) / `R` (15,2) | Serving hatch and plate return, right wall |

Spawns (6,1) and (9,2). Burgers, so shortages rewrite (bun and meat exempt themselves).
`eightySix` crateSize 5, restock 25 s. Orders initial 2, every 24 s, at most 4, 110 s, from
1-6's drip. Stars 1P 40 / 90 / 160, 2P 70 / 160 / 280, from 1-4.

Design notes: crate to pan is at least seven tiles, so a tray of three parts saves two round
trips per burger; the rack is three tiles from the nearest board and six from the crates, so
fetching it costs a trip too. The corridor is two tiles wide so two chefs pass, and bump.

### Short Order (`custom-1-3`)

```
#OTMJ#d#SSE#
W..........#
D..........V
#..........V
#..........R
X..........#
#..........#
###BB###ppp#
```

12 x 8. A compact room for the 86 system and two-plate carry: four crates, two of them
scripted to run out, and a sink on the opposite wall from the serve.

| Tile | Station |
| --- | --- |
| `O` (1,0), `T` (2,0), `M` (3,0), `J` (4,0) | Onion, tomato, mushroom and fish crates |
| `d` (6,0) | Delivery door, top wall |
| `S` (8,0), (9,0) | Two pots on burners |
| `E` (10,0) | Counter with the fire extinguisher |
| `W` (0,1) / `D` (0,2) | Sink and draining board, left wall |
| `X` (0,5) | Bin |
| `V` (11,2), (11,3) / `R` (11,4) | Serving hatch and plate return, right wall |
| `B` (3,7), (4,7) | Chopping boards side by side |
| `p` (8,7), (9,7), (10,7) | The three clean plates |

Spawns (3,3) and (8,3). Recipes: the three soups and fish sashimi. `eightySix` crateSize 4,
restock 35 s, scripted shortages onion at 40 s and fish at 90 s. Orders initial 2, every 18 s,
at most 4, 80 s (one-chop sashimi keeps the drip quick). Stars 1P 30 / 70 / 120, 2P 40 / 100 / 170.

Design notes: the drying rack is eleven tiles from the serve, so a chef who carries two clean
plates across saves a round trip each time; the dirty plates come back beside the serve and go
the other way. The scripted shortages hit a soup and the sashimi in turn, each with three
substitutes on the board; with four-item crates the play-driven shortages arrive between them.

## Tutorial kitchens

Five levels under `src/levels/tutorial/`, `game: 'tutorial'`, one per mechanic in the order the
Settings page lists them. Each forces its own switch on through `mechanics`, so it plays the
same whatever the player has toggled, and carries a `tutorial` block: the rules on a panel
before play, then one step at a time in a banner with a pointer over the tile it names. The
walkthroughs are in the JSON, not in code; `docs/LEVEL_SCHEMA.md` has the goal vocabulary.

Shared shape: two minutes, one soup recipe (two for the 86 system), one ticket at a time (at
most two or three up), `timerStartsOnFirstServe: true` so the clock waits while the player
reads and practises, and a `served` goal as the last step so finishing the walkthrough starts
the clock. Plates come off stacks (no sink) so nothing but the mechanic needs explaining.
Stars 1P 20 / 40 / 60, 2P 20 / 40 / 80, saved like any level but never counted toward unlocks.
The title screen keeps them off its list; the Tutorials page lists them with their rules.

### Pass-through shelf (`tutorial-1-1`)

```
#O#####S#PP#
#....h.....V
#....h.....#
#....h.....#
#..........#
####X##B#E##
```

12 x 6. An onion crate and the bin on the left, the board, pot, two plate stacks and the serve
on the right, a wall of three hatches down column 5 with a one-tile gap at the bottom. Steps:
take an onion, put it on a hatch (any of the three), take it from the right-hand room (a `zone`
on the holding goal, so taking it straight back does not count), then cook and serve.

### Chop assist (`tutorial-1-2`)

```
#O###S#P##
#........V
#........#
#........#
#........#
#X#BB###E#
```

10 x 6. One room, two boards side by side. Steps: an onion onto a board, both chefs at that
board until the sim marks one `assisting` (this step carries `minPlayers: 2` and is dropped
from a solo run, which the page and the intro say), finish the chop, then cook and serve.

### Two-plate carry (`tutorial-1-3`)

```
#O##B#SSE##
P.........V
P.........#
#.........#
#.........X
###########
```

11 x 6. Two plate stacks on the left wall, the serve on the right. Steps: a plate from one
stack, a second from the other (`count` on the holding goal is exact, so the step reads two in
hand), one put down on a counter (back to exactly one), then cook and serve.

### The 86 system (`tutorial-1-4`)

```
#OT#d#SS#E#
#.........V
#.........#
P.........#
#.........X
###BB######
```

11 x 6. Onion and tomato crates, the delivery door beside them. `orders.first` pins a tomato
soup then an onion soup so the tomato ticket is up when the crate runs dry; a `stations`
override gives the tomato crate three items (one soup's worth) and `eightySix` sets nine-item
crates otherwise with a 12 s delivery. Steps: empty the tomato crate (a `stock` goal), a six
second beat to read the rewritten ticket, unload the delivery at the door (`restocked`), then
serve either soup: the rewritten ticket still pays for the tomato soup it used to ask for.

### The tray (`tutorial-1-5`)

```
#O#######B#S#
#...........V
#...........#
#...........#
#X###t##PP#E#
```

13 x 5. The onion crate at the far left, the board and pot at the far right, the rack on the
bottom wall halfway along. Steps: lift the tray at the rack, load three onions at the crate
(`load` on the holding goal), unload the top one onto the board (`tileItem`), set the tray
down on a counter (`traySet`), then cook and serve.

## Unlock thresholds

`unlockStars` is the total star count the campaign needs before a level opens. Numbers come
from the wiki's [Stars to Unlock](https://overcooked.fandom.com/wiki/Stars_to_Unlock) table,
which `docs/research/oc1-levels.md` prefers over the per-level infobox where the two
disagree.

| Level | `unlockStars` | Infobox says | Note |
| --- | --- | --- | --- |
| 1-1 | 0 | 1 Star | The star comes free from Intro Apocalypse, which this clone skips, so 1-1 is always open |
| 1-2 | 2 | 2 Stars | |
| 1-3 | 4 | 4 Stars | |
| 1-4 | 5 | 4 Stars | The unlock table says 5; the infobox repeats 1-3's value |
| 1-5 | 6 | 6 Stars | |
| 1-6 | 8 | 8 Stars | |

## Order tuning after the playtest

This section covers 1-1, 1-2 and 1-3. 1-4 to 1-6 were measured later, in "World 1 playtest"
below.

The 1-1 to 1-3 order numbers were guesses. They have since been measured against the levels as
built, using the scripts in `tools/playtests/` to drive both chefs through the headless harness
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

- **1-1's fire extinguisher could not be picked up (fixed).** `E` sat at (12,0) with a counter
  at (11,0), a counter at (12,1) and the edge of the map on its other two sides, so no chef could
  ever face it and a fire could never be put out. The `E` now sits one column left, at (11,0),
  reachable from the walkable (11,1); the grid above shows the shipped layout. Evidence:
  `tools/playtests/09-1-1-extinguisher-unreachable.txt`; the guard is the extinguisher-reach
  test in `tests/levels.test.ts`.
- **1-2 has exactly one way through the crossing.** Column 9 is counter at every row except
  y=1, and column 5 opens only at y=3 and y=4, so every ingredient, every plate and every
  finished dish funnels through the single tile (9,1). Two chefs cannot pass each other in it,
  and one left standing there blocks the other completely. A second gap — opening (9,3) or
  (9,4) — would turn the level from a queue into a kitchen.
- **1-2's crossing used to be never empty.** With 4 s intervals the three lanes tiled the whole
  timeline. Both dynamics now run on 7 s intervals (starts 1.0 s and 4.5 s), which opens two
  1.5 s windows per cycle. If the level plays as too easy, shorten `intervalSec` again.
- **1-3's open deck is nearly sealed off.** Row 7 runs the full width, but row 6 is solid at
  every column except 0, 10 and 11. A chef on the deck on the left-hand side has to walk to
  column 0 and up through row 0 to get back to the burners. That is fine — it is a real
  Overcooked detour — but it makes the left half slower than the map suggests at a glance.
- **1-3's two divider segments pass through each other.** At amplitude 1 in opposite phase the
  three-tile group and the two-tile group overlap by up to 1.6 tiles, so the divider is five
  tiles long only at offset 0 and about 3.4 tiles the rest of the time. It reads fine on screen
  and the gap behaviour is what the level wants, but the two runs of counter are occupying the
  same space, and a smaller amplitude or a different split would avoid it.

## World 1 playtest: 1-4, 1-5 and 1-6

Measured with the headless harness once the sim could cook burgers, run the gate and hold a
saved profile. One script per subject, all under `tools/playtests/`:

| Script | What it drives |
| --- | --- |
| `11-1-4-two-player-burgers.txt` | Two chefs, two burgers, the tip, the plate return, the sink |
| `12-1-4-pan-burn-and-fire.txt` | A patty left in the pan: burn, fire, extinguisher, bin, reuse |
| `13-1-5-ring-three-soups.txt` | The ring pipeline, head-on blocking, one soup from each pot |
| `14-1-6-earthquake-gate.txt` | Gate cycle, crossings, being shoved off the seam, both pans |
| `15-level-select-locks-and-progress.txt` | Locks, stars, unlocks, Retry's seed, Next level |
| `16-settings-difficulty-seed-freeplay.txt` | Difficulty, seed modes, free play, saved settings |
| `17-relaxed-stars-do-not-unlock.txt` | Relaxed stars count on the header but not toward unlocks |

`tools/playtests/qa-lib.txt` is the shared helper the scripts fetch: it stamps every SimEvent
with the sim clock, and it reads the title and results screens through the live Phaser scenes,
so the assertions are about what is on screen rather than about localStorage.

### What a burger and a soup actually cost

The harness drives one chef at a time, so every figure is an upper bound. Two people
overlapping the fetching with the frying beat them, and the ratios are the part to trust.

| Level | Measured | What two players should manage | Why |
| --- | --- | --- | --- |
| 1-4 | 37.8 s to the first salad burger, 22.0 s for the burger after it | 20-25 s and 12-15 s | Four components against two, and the fry is 9 s of it |
| 1-5 | 60.9 s to the first soup, then 47.7 s and 39.6 s | 25-30 s | Walking, not cooking: one ingredient is one lap of the ring |
| 1-6 | 41.8 s to the first burger, 20.0 s for the second | 20-25 s | Every burger crosses the seam, which is shut 6 s in 10 |

Frying and burning, timed on 1-4: patty into the pan at 10.0 s, cooked at 18.9 s (`COOK_TIME`
9), burnt with a fire at 31.9 s (`BURN_TIME` 13), sprayed out in 1.1 s, emptied in the bin, and
cooking again on the same burner. A burning tile refuses every interaction but the spray.

### The one change: 1-4's drip, 24 s to 20 s

1-4 was the only level where the arithmetic forbade its own three-star target.

`updateOrders` spawns the first ticket one `intervalSec` in, so a 240 s level on a 24 s drip
sees 2 + 9 = 11 tickets in the whole run (the tenth arrival lands as the clock runs out). The
three burgers average 25 points and the tip ladder caps at 8, so a flawless run — every ticket
served, every serve in order — is worth about 343. Two players cost about 20 s a burger, well
inside the drip, so the kitchen waits for tickets a quarter of the time and still has to serve
all eleven to clear the two-player three-star of 280.

At 20 s the run sees 2 + 11 = 13 tickets, a flawless one is worth about 409, and three stars
asks for nine or ten of the thirteen. Demanding, and no longer flawless-or-nothing, and the
chefs stop idling. Nothing else moved: `initial` 2, `max` 4 and `timeSec` 100 are unchanged,
and the one-player thresholds ([40, 90, 160]) were comfortable at either drip.

1-5 and 1-6 keep their numbers:

- **1-5, every 20 s, 85 s each.** Three stars for two players is 160, or eight soups. A pair
  circling at 25-30 s a soup manages nine or ten, and the same 20 s drip already suits 1-3,
  which is the closest level in shape. The scripted run served three and lost two tickets to
  the clock, which is what a rigid one-chef-at-a-time pipeline looks like, not what the level
  costs.
- **1-6, every 24 s, 100 s each.** Same recipes as 1-4, but the seam is shut 60% of the time
  and every burger crosses it at least once, so the slower drip is buying something here. Three
  stars for two players is 200, or eight of the eleven tickets, against a measured pace that
  supports twelve.

### Behaviour the playtest turned up

None of it is order tuning, so none of it was changed here.

- **A pot burns before the ring can fill it.** A pot starts cooking on its first ingredient
  and is cooked 9 s later, then burns 13 s after that, so a pot has to be filled within 22 s
  of the first ingredient going in. One lap of 1-5's ring is about 30 tiles, or 8 s, plus a
  3 s chop, so a player who fetches, chops and delivers one ingredient per lap needs 22-36 s
  for three and sets the pot on fire. The strategy that works — and the one the script uses —
  is to park two chopped ingredients on the island counters at (7,5) and (8,5) and tip all
  three in together. Worth knowing before anyone reads a burnt pot on 1-5 as a bug.
- **1-5 cannot deadlock, but it cannot let anyone pass either.** Two chefs walked into each
  other along the top run stop 0.700 tiles apart, exactly two chef radii, and neither budges:
  the corridor is one tile wide everywhere. Nobody is trapped, because the ring is a loop and
  either chef can turn round and reach any station the other way. What the real 1-5 has and
  this one does not is the passing place in front of the serving counter, which the infobox
  describes and which was flattened to keep the loop true (see the 1-5 section above). Adding
  it back is a row and two open tiles behind `V`.
- **1-4's hand-off happens on the divider, not in the corridor.** The counters at (7,2) and
  (7,4) can be reached from inside the 1x3 corridor at row 3 as well as from column 8, so the
  prep chef steps three tiles into the corridor, puts the part down and turns back, and the
  cooking chef picks it up from its own side; (5,2) and (5,4) are the mirror pair on the left.
  That is what makes the wiki's "place chopped beef on the counters in the middle" work, and
  it is what script 11 does. 1-6 has no equivalent: its two halves only meet on the seam, so
  every part is carried across during an open window.
- **The seam shoves rather than swallows.** A chef standing at x=6.4 when 1-6's gate shuts is
  put down at x=5.7, flush against the seam column on the side it came from, and the sampler
  in `tools/playtests/monitor.txt` recorded no overlap with a solid tile across the whole run.
  While the seam is shut each side still works its own counters, and a chef walking into it
  stops at x=5.7 with the gate tile as its target and can do nothing with it.
- **1-6's hand-off ledges are only usable while the gate is open.** (6,0) and (6,7) can be
  reached only from a gate tile, so for 6 s in every 10 they belong to nobody. That is the
  intended reading of the seam, but it means a dish parked there is stranded for the shut
  window.

## Schema

No schema changes were needed for any of the six. Every station maps onto a `LEGEND`
character and every obstacle onto a `Dynamic` variant that already exists: 1-4 needs `F`
(burner with a pan) and the burger crates `A`, `U`, `L`; 1-5 needs nothing new at all; 1-6
needs `G` plus the `gate` dynamic. `unlockStars` was already declared optional on `LevelDef`,
so filling it in on 1-1 to 1-3 is additive.

The order settings on 1-4, 1-5 and 1-6 have since been measured too — see "World 1 playtest"
above. `tests/levels.test.ts` pins the four numbers per level so that changing them stays
deliberate.
