# oc1 The Peckening — Treacle Town (Apocalypse)

Source: https://overcooked.fandom.com/wiki/The_Peckening · Screenshots: `docs/research/screens/oc1/peckening.jpg`

## Facts
- Time limit **17:00** (1020 s) — by far the longest in the game. Timer starts immediately.
  Unlock: **0 stars**, but 6-4 must be completed
  ([Stars to Unlock](https://overcooked.fandom.com/wiki/Stars_to_Unlock)). Player counts 1-4.
  **Story Mode only** — it cannot be replayed from a level select in the original.
- Recipes: **four scripted phases of five orders each**, no random draw. From the wiki, in AYCE order:
  - **Phase 1** (Soup): Tomato, Onion, Tomato, Onion, Tomato. *In Overcooked! 1 the second Tomato
    Soup is a Mushroom Soup* (so the mushroom crate matters), *and in single player the last two
    orders are removed.*
  - **Phase 2** (Burger): Burger, Salad Burger, Lettuce Burger, Burger, Salad Burger.
  - **Phase 3** (Pizza + Fish and Chips): Pizza, Fish and Chips, Pepperoni Pizza, Fish and Chips,
    Pizza.
  - **Phase 4** (one of everything but burrito): Tomato Soup, Mushroom Pizza, Salad Burger, Fish and
    Chips, Tomato Salad.
  - A phase ends the moment its final order is delivered to the Ever Peckish; delivering the last
    order of phase 4 wins the level. **17 order variants across five recipe families** — the widest
    menu in the game.
- Stars. **OC1: none published.** **AYCE**: 160/360/560/880 (1P), 200/440/700/1080 (2P),
  240/540/840/1320 (3P), 220/500/780/1220 (4P). **AYCE Switch**: 240/540/840/1300 (1P),
  240/520/820/1280 (2P), 260/580/920/1420 (3P), 240/520/820/1280 (4P). In AYCE the star rating is
  driven by the **Tip Combo** rather than by raw throughput. The JSON carries the AYCE-Switch
  numbers, **not OC1 values**.
- Plates: sink kitchen, sink in the right building. **3 plates, and they start DIRTY on the plate
  return** — the only kitchen in Overcooked! that opens with dirty dishes.

## Layout
- Grid size: **18 x 9**, counted from `peckening.jpg`; confidence **low**. Method: the burner column
  down the left building's west edge gives a ~60 px row pitch, sizing each rooftop at roughly 6 x 9;
  the street between them is about six columns. Confidence is low because the capture only shows the
  two buildings — the ferry platform is out of frame between them, and its layout **changes every
  phase**, so any single grid is one phase of four.
- The grid below shows the two rooftops with the **phase 1** ferry platform drawn in the street,
  docked toward the left building. In the capture the platform is mid-crossing and touches neither.

```
##N#E#      #N##X#
S.....      ......
S##X#.#TOM  .#B##.
S.........  ......
S####.####  .#WD#V
#.........  .....R
###Y#.####  .#Y##.
......      ......
######      ######
```

- Legend extensions used: `N` oven, `Y` deep fryer (with a frying basket), and — not on this grid but
  needed for phases 2-4 — `>` `<` `^` `v` conveyor. The blank street columns are a fall/void gap the
  chefs cannot cross on foot.
- Station inventory: boards 1 fixed (right building; phases 2 and 4 add more **on the platform**),
  **pot burners 4** (left building, west spine — they start with pots and must be re-fitted with pans
  before phase 2), pan burners 0 fixed, **fryers 2** (one per building), **ovens 2** (one per
  building), mixers 0, steamers 0, sinks 1 (right building), serve counters 1 — **the Ever Peckish
  itself** — plate returns 1 (below the Ever Peckish, holding the 3 dirty plates), bins 2 (left
  building centre, right building upper-right), extinguishers 1 (left building), plates 3 (dirty),
  crates: **all of them live on the ferry platform** and change per phase — mushroom, tomato and onion
  in phase 1; bun plus the chopped ingredients in phase 2; pizza and fish-and-chips crates in
  phase 3; a full set in phase 4. Plain counters 49. Floor 60, counter 68, station 19.
- Spawns: the capture puts both chefs on the left rooftop at (3,1) and (4,1) `(estimate)`.
- Zones:
  - **Left rooftop** (E-shaped): four burners down the west spine, a bin in the middle, an oven and
    the extinguisher at the top, a deep fryer with a basket at the bottom.
  - **Right rooftop** (3-shaped, tight corridors): oven top-left, bin top-right, chopping board and
    sink in the middle, deep fryer at the bottom, and the **Ever Peckish** on the east side as the
    serving counter with the plate return below it.
  - **Ferry platform**: carries every ingredient crate and, depending on the phase, extra chopping
    boards or conveyor sections. It is the only link between the two rooftops.
  - Nothing on this level has a walkable route from a crate to the serving counter — `longestWalk` is
    `null` — because the crates ride the platform and the serve is on a rooftop.

## Dynamics
- **Kevin's helicopter platform** ferries between the two buildings, and is **reconfigured every
  phase**:
  - Phase 1: counters shaped like a sideways letter H, with the ingredient boxes in the upper-right
    section.
  - Phase 2: two conveyor sections — the upper one running right, the lower one an L running down and
    left; chop-needing crates on one side and buns on the other; **an extra chopping board** on the
    right. The whole platform moves up and down.
  - Phase 3: split in half by two chopping boards and a run of counters; **the platform rotates 90°
    clockwise every so often** so nobody is trapped on one side.
  - Phase 4: three table sections — counters in the middle, crates and two more chopping boards above
    and below. The platform now "moves really slowly across the entire gap, making stops in the middle
    and on the edges".
  - No crossing times, dwell times or rotation periods are published — ~10 s per crossing with a ~5 s
    dwell at each dock, and a 90° rotation every ~20 s in phase 3 `(estimate)`.
- **Falling meteors** land throughout and set counters on fire on impact. Rate and target selection
  are not published — one meteor every ~20 s at a random counter `(estimate)`. **One strike is
  scripted**: at the start of phase 2 a meteor from the Ever Peckish hits the right building's oven,
  its chopping board and the counters near them.
- **Cookware swap between phases**: pots must come off the burners and pans go on before phase 2, and
  at least one pot must go back on before phase 4's Tomato Soup. That is a player action the level
  script depends on, not an automatic change.

## Cooperation notes
- Wiki Strategies, in full: "Keep the chefs split up"; "Get your chefs off the platform as soon as a
  phase ends"; "Chop extra tomatoes for the later phases".
- The intended shape is **one chef per rooftop, goods on the ferry**. Each rooftop has an oven and a
  deep fryer, so both can cook; only the right has the board and the sink, and only the right can
  serve.
- The bottleneck moves with the phase. Phase 1 is pot throughput; phase 2 is the cookware swap plus
  the scripted fire; phase 3 is running two recipe families (oven and fryer) at once on a platform
  that keeps rotating; phase 4 is five different dishes with one board each side.
- The dirty-plate opening means the first thing anyone does is wash up, before a single order can be
  served.

## Recreate checklist
1. **Scripted phases**: an ordered list of orders per phase, the phase advancing when its last order
   is served, and the level ending on the last phase. Nothing in the clone's `orders` model supports
   a script.
2. **A ferry platform whose layout is replaced per phase** — moving floor plus stations, carrying
   chefs and items, with a different arrangement each phase and a 90° rotation in phase 3.
3. **Meteors**: timed projectiles that set a counter alight, plus one scripted strike.
4. **Deep fryer + frying basket** and the Fish and Chips family; **oven** and the Pizza family;
   **Salad** (chop and plate). Together with soups and burgers this level needs *all five* OC1
   recipe families.
5. **Cookware that can be taken off a burner and swapped** (pots ↔ pans), and burners that start with
   the wrong cookware for the coming phase.
6. **Plates that start dirty** on the plate return.
7. A serving counter that is a character rather than a counter — cosmetic, but the Ever Peckish is
   also the meteor source.
