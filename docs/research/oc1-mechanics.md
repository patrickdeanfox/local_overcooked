# Overcooked! 1 — mechanics reference

Source: the Overcooked wiki (`https://overcooked.fandom.com`), fetched 2026-09-08 with
`docs/research/tools/fetch_wiki.py`. Every row cites the page it came from.

**How to read this.** `wiki: none` means the wiki states no number anywhere; the value that
follows is my estimate with the reasoning behind it, and the integrator should treat it as
tunable. Anything without `wiki: none` is quoted or paraphrased from the cited page.

The wiki is a fan wiki. It is descriptive, not a spec: it names mechanics and occasionally
gives a rough duration ("about three seconds", "5-ish seconds"), but it never publishes
frame data, per-recipe scores, tip formulas, or order cadence. Roughly 60% of the numbers
this project needs are estimates.

---

## 1. Movement

| Fact | Value | Source |
|---|---|---|
| Chef moves in 8 directions, faces the direction of travel | yes | universal to the series; no wiki page states it |
| Chef walk speed | wiki: none. Estimate **4.2 tiles/s**. Reasoning: in the 1-1 screenshot (`screens/oc1/1-1.png`) the kitchen is ~12 tiles wide and a chef crosses it in a bit under 3 s of normal play footage; 4.2 tiles/s puts a full lap of the 1-1 loop at ~8 s, which matches the pace the level's 2:30 timer assumes. | estimate |
| Dash | propels the chef forward, outruns conveyor belts, flings held ingredients further, and knocks items out of other chefs' hands. **Just over 0.5 s cooldown.** | [Dash](https://overcooked.fandom.com/wiki/Dash) |
| Dash duration / distance | wiki: none. Estimate **0.25 s at ~2.5x walk speed** (≈1.7 tiles). Reasoning: the cooldown is stated as "just above half a second", so the dash itself must be well under that to feel like a burst rather than a run. | estimate |
| Chefs collide with each other and with pedestrians | yes — pedestrians in 1-2 "interrupt the chefs" | [1-2](https://overcooked.fandom.com/wiki/1-2_(Overcooked!)) |
| Chef radius / hitbox | wiki: none. Estimate **0.35 tile radius** for chef-chef, **0.6 tile square** against solid tiles. Reasoning: two chefs visibly pass each other in a 1-tile-wide corridor in the 1-5 shot only with difficulty; 0.35 makes a 1-tile gap just barely passable for one chef and impassable for two. | estimate |
| Reach (which tile the chef acts on) | wiki: none. Estimate **the tile directly in front of the chef centre, 0.6 tiles out**. Reasoning: OC1 has no free-aim; the highlight always lands on the single facing tile. | estimate |
| Time penalty for falling off the map | **5 seconds** — stated identically for falling off trucks (2-1, 3-3), falling in the sea (3-1), falling in the frozen river (3-4) and falling in lava (5-2). | [2-1](https://overcooked.fandom.com/wiki/2-1_(Overcooked!)), [3-1](https://overcooked.fandom.com/wiki/3-1_(Overcooked!)), [3-4](https://overcooked.fandom.com/wiki/3-4_(Overcooked!)) |
| Slippery floor (world 3, 6-3) | ice carries momentum; "steer into the corners before you even need to turn". Snowy patches in 3-4 are **not** slippery, so the surface changes mid-kitchen. | [3-1](https://overcooked.fandom.com/wiki/3-1_(Overcooked!)), [3-4](https://overcooked.fandom.com/wiki/3-4_(Overcooked!)) |

---

## 2. Pick up / put down

One button ("Pick Up/Drop") does all carrying; a second button ("Action") does chopping,
washing and spraying. A chef holds exactly one thing.

### What a chef can carry
Raw ingredient, chopped ingredient, plate (clean, dirty, or holding a dish), pot, pan,
frying basket, fire extinguisher. Sources: [Fire Extinguisher](https://overcooked.fandom.com/wiki/Fire_Extinguisher),
[Pot](https://overcooked.fandom.com/wiki/Pot), [Plate](https://overcooked.fandom.com/wiki/Plate).

### Transfer table
`held` × `target` → result. Wiki-sourced rows are cited; the rest are `wiki: none` and are
the standard series behaviour, which the level Strategies sections assume throughout.

| Holding | Target | Result | Source |
|---|---|---|---|
| nothing | crate / ingredient box | new raw ingredient in hand (infinite source) | [Ingredient boxes](https://overcooked.fandom.com/wiki/Ingredient_boxes) (stub); behaviour assumed by every level page |
| nothing | counter with item | pick the item up | wiki: none — universal |
| nothing | board with ingredient | pick the ingredient up (chopped or not) | wiki: none |
| nothing | stove with pot | pick the pot up ("you can take the pots from the burners") | [3-2 Strategies](https://overcooked.fandom.com/wiki/3-2_(Overcooked!)) |
| raw ingredient | board (empty) | ingredient goes on the board, ready to chop | [Chopping](https://overcooked.fandom.com/wiki/Chopping) |
| raw ingredient | pot | **rejected in OC1** — "the Burners will push the players away if they try to put a Plate, an unchopped ingredient or a Fire Extinguisher" on a burner | [Burner](https://overcooked.fandom.com/wiki/Burner) |
| chopped ingredient | pot (on or off a stove, not full) | ingredient goes in the pot; the pot starts cooking once it is on a lit burner | [Burner](https://overcooked.fandom.com/wiki/Burner), [Pot](https://overcooked.fandom.com/wiki/Pot) |
| chopped ingredient | plate | plates the ingredient (this is how salad, burgers and pizza are assembled) | [Intro Apocalypse dialogue](https://overcooked.fandom.com/wiki/Intro_Apocalypse) |
| pot with cooked soup | plate on a counter | pours the soup onto the plate, leaving an empty pot | [1-1 Strategies](https://overcooked.fandom.com/wiki/1-1_(Overcooked!)) ("pour out the Onion Soups onto plates") |
| plate (empty) | pot with cooked soup | **scoops the soup onto the plate** — the reverse direction also works | [3-2 Strategies](https://overcooked.fandom.com/wiki/3-2_(Overcooked!)) ("you can use the plates to scoop up the food from the pot") |
| plate | sink | allowed for a dirty plate (that is how washing starts); **a plate cannot be put back on a sink once picked up** | [Sink](https://overcooked.fandom.com/wiki/Sink) |
| chopped ingredient | plate resting on a sink | **rejected in OC1** — "Chefs would not be able to put food on top of Plates on Sinks" | [Plate](https://overcooked.fandom.com/wiki/Plate) |
| plate | burner | **rejected in OC1** — the burner pushes the chef away | [Burner](https://overcooked.fandom.com/wiki/Burner) |
| fire extinguisher | burner | **rejected in OC1** — burner pushes the chef away | [Burner](https://overcooked.fandom.com/wiki/Burner) |
| plate with a dish | serving counter | serves the order, awards coins | [Service Counter](https://overcooked.fandom.com/wiki/Service_Counter) |
| anything | trash bin | burnt food and off-menu meals are destroyed; **cookware and plates cannot normally be trashed** | [Trash Bin](https://overcooked.fandom.com/wiki/Trash_Bin) |
| pot | pot | pouring soup pot-to-pot worked in OC1 (it is only *All You Can Eat* where a bug blocks it) | [Pot](https://overcooked.fandom.com/wiki/Pot) |
| plate holding food | plate | wiki: none. Estimate **rejected**. Reasoning: nothing in the wiki describes merging two plates, and the "mud" bug below implies plate contents are a single slot. | estimate |

### OC1-only quirks the wiki records
- **Boil-anything bug.** "In *Overcooked!* only, chefs could boil anything by placing it on a
  Plate, then clicking a pot whilst holding that very plate." Pouring a cooked item onto a
  plate that already holds something creates "a mud-like substance that can only be put in
  the Trash Bin." ([Pot](https://overcooked.fandom.com/wiki/Pot))
- **Two plate sizes.** OC1 had small and large plates; large ones appear only in Pizza
  kitchens (and *The Lost Morsel* 1-4). Every later game uses one size.
  ([Plate](https://overcooked.fandom.com/wiki/Plate))
- **Dropping items off counters.** Letting go of an item away from a counter is a real,
  usable mechanic (and buggy: items can be dropped across railings and become unreachable).
  ([Broken Mechanics](https://overcooked.fandom.com/wiki/Broken_Mechanics))

---

## 3. Chopping

| Fact | Value | Source |
|---|---|---|
| How | put an ingredient on a chopping board, hold/press *Action* while standing at the board | [Chopping](https://overcooked.fandom.com/wiki/Chopping) |
| Duration | **"about three seconds"** | [Chopping Board](https://overcooked.fandom.com/wiki/Chopping_Board) |
| Single-player is slower | "Chopping is slower in Singleplayer Mode in all *Overcooked!* games, allowing the other chef to be used while the one used before chops" — i.e. in 1P a board keeps chopping while you walk away | [Chopping](https://overcooked.fandom.com/wiki/Chopping) |
| Double chopping | "If two Chefs chop at the same time, the chopping will become faster." | [Chopping](https://overcooked.fandom.com/wiki/Chopping) |
| Does the chef stay put? | yes — the chef is locked to the board for the duration | wiki: none; implied by the Chopping how-to |
| Ingredients that skip chopping in OC1 | buns and tortillas (the OC1-relevant entries of the no-chop list) | [Chopping Board](https://overcooked.fandom.com/wiki/Chopping_Board) |
| Other utensils on a board | can be placed there but cannot be chopped | [Chopping Board](https://overcooked.fandom.com/wiki/Chopping_Board) |

**Recommendation:** 3.0 s for two-player, which is the wiki number. If the sim ever models
1P, slow it to ~4.5 s to reproduce the stated 1P penalty.

---

## 4. Pot, burner, cooking

| Fact | Value | Source |
|---|---|---|
| Pot capacity | **3 chopped ingredients → 1 soup** | [Onion](https://overcooked.fandom.com/wiki/Onion), [Tomato](https://overcooked.fandom.com/wiki/Tomato), [Mushroom](https://overcooked.fandom.com/wiki/Mushroom) — all three say "3 Chopped X cooked into 1 soup" |
| Mixed-ingredient soups | not a thing in OC1: every soup is three of one ingredient | [Soup](https://overcooked.fandom.com/wiki/Soup) recipe tables |
| Where cooking happens | pot must sit on a burner; dropping an ingredient into cookware on a burner starts it cooking | [Burner](https://overcooked.fandom.com/wiki/Burner) |
| Progress display | a green bar fills; when full a green check mark appears | [Burnt food](https://overcooked.fandom.com/wiki/Burnt_food), [Burner](https://overcooked.fandom.com/wiki/Burner) |
| Cook time | wiki: none. Estimate **9 s for a full pot**. Reasoning: 1-1 gives 2:30 and asks 3 soups for 3 stars with one pot. A soup cycle is 3 chops (3 s each) + carry + cook + pour + serve. At 9 s cook, a single chef closes a full cycle in ~25 s, which fits 3 soups plus slack in 150 s; at 20 s cook it does not. |
| Does cook time scale with ingredient count? | wiki: none. Estimate **no — the timer runs only when the pot is full**. Reasoning: the [1-2 Strategies](https://overcooked.fandom.com/wiki/1-2_(Overcooked!)) say "take the Pots off of the Burners if you don't have a full soup cooking to not burn it", which only makes sense if a partly-filled pot on a burner is already advancing toward burning. So: **a pot on a burner with any contents advances; adding the third ingredient does not restart the timer.** Simplest faithful model: progress advances whenever contents > 0, and the dish is ready when progress completes *and* the pot is full. |
| Adding an ingredient to a cooking pot | wiki: none. Estimate **allowed while the pot is not full and not yet cooked; progress is kept, not reset.** Reasoning: same 1-2 strategy line — players deliberately part-fill pots and top them up. Adding to an already-*cooked* pot should be rejected. |
| Burner off with no cookware | OC1 burners stay lit (the "burners turn off if cookware is not placed on them" note is explicitly *Overcooked! 2 only*) | [Burner](https://overcooked.fandom.com/wiki/Burner) |
| Taking a pot to the food | supported strategy: "take pots to the chopping stations to shorten the running time" (1-5), "grab a Pot and throw all of the Ingredients in before sending it back" (5-6) | [1-5](https://overcooked.fandom.com/wiki/1-5_(Overcooked!)), [5-6](https://overcooked.fandom.com/wiki/5-6_(Overcooked!)) |

---

## 5. Overcooking, burning, fire

The [Burnt food](https://overcooked.fandom.com/wiki/Burnt_food) page is the only place the
wiki gives a burn timeline, and it gives it in stages:

| Stage | Duration | Signal |
|---|---|---|
| cooked, quiet | ~5 s ("5-ish seconds") | green check mark, no alarm |
| warning 1 | ~5 s ("another 5-ish seconds") | beeping, red exclamation mark |
| warning 2 | ~3 s ("another 3-ish seconds") | fast beeping, fast-blinking exclamation |
| burnt | — | food is burnt, may cause a fire |

**Total grace after the check mark ≈ 13 s.** Round to **13 s** (or 12 s for a cleaner
three-stage 4/4/4 split — either is inside the wiki's stated tolerance).

| Fact | Value | Source |
|---|---|---|
| Burnt food is unrecoverable | "must be placed in the bin, as it cannot be recovered by any means" | [Burnt food](https://overcooked.fandom.com/wiki/Burnt_food) |
| Burning always starts a fire? | "may cause a fire" — not guaranteed | [Burnt food](https://overcooked.fandom.com/wiki/Burnt_food) |
| | wiki: none for the probability. Estimate **always ignite** — deterministic sim, and every OC1 level with a burner ships a fire extinguisher, which only makes sense if fire is the expected outcome. |
| Fire spreads | "Fire expands on adjacent Countertops, Burners, Deep Fryers, and other kitchen utensils **upon which objects are placed**" — spread targets are stations, and (reading the clause literally) ones holding an item | [Fire](https://overcooked.fandom.com/wiki/Fire) |
| Fire spread interval | wiki: none. Estimate **6 s per spread step to one orthogonally adjacent station**. Reasoning: 1-1's kitchen is small; faster than ~4 s makes a single unattended pot unrecoverable for two players, slower than ~8 s makes fire a non-threat. |
| A burning cooking device cannot cook | "Any cooking device affected by tabletop fire cannot cook food until the fire is extinguished." | [Fire](https://overcooked.fandom.com/wiki/Fire) |
| Chefs can still use a burning counter | "Chefs can still chop, assemble and take out ingredients out of Countertops etc. when they are on fire." | [Fire](https://overcooked.fandom.com/wiki/Fire) |
| Does fire block chefs in OC1? | **countertop fire only** in OC1 — the walk-blocking floor fire is an OC2 mechanic. So in OC1 fire sits on solid tiles and never blocks a walkable tile. | [Fire](https://overcooked.fandom.com/wiki/Fire) infobox |
| Fire also from meteors | in The Peckening the Ever Peckish drops meteors that set counters alight | [Fire Extinguisher](https://overcooked.fandom.com/wiki/Fire_Extinguisher), [The Peckening](https://overcooked.fandom.com/wiki/The_Peckening) |
| Controller rumble while a fire burns | constant vibration | [Fire](https://overcooked.fandom.com/wiki/Fire) |

### Fire extinguisher

| Fact | Value | Source |
|---|---|---|
| Handling | picked up and dropped with *Pick Up/Drop*; sprayed by **holding** *Action* | [Fire Extinguisher](https://overcooked.fandom.com/wiki/Fire_Extinguisher) |
| Prompt | when a kitchen catches fire a prompt appears over the extinguisher until the fire is gone | [Fire Extinguisher](https://overcooked.fandom.com/wiki/Fire_Extinguisher) |
| Placement | some kitchens have none (no cooking device), some have two or more (separated chefs, mass fires) | [Fire Extinguisher](https://overcooked.fandom.com/wiki/Fire_Extinguisher) |
| It sits on a counter and can be moved off it | yes — 5-2 explicitly advises "throw the Fire Extinguisher off of its counter to free up space" | [5-2](https://overcooked.fandom.com/wiki/5-2_(Overcooked!)) |
| Spray range | wiki: none. Estimate **2 tiles in a cone in front of the chef**. Reasoning: the spray visibly reaches past the counter the chef is standing at; 1 tile would make cross-counter fires unfightable, which contradicts every level layout. |
| Time to extinguish one fire | wiki: none. Estimate **~0.8 s of continuous spray** (fire health 1.0, extinguish rate 1.2/s). Reasoning: it has to be fast enough that two fires plus a re-pot fit inside the ~13 s before the *next* pot burns. |
| Does the extinguisher run out? | wiki: none. Estimate **no** — no page mentions a charge, and levels ship exactly one. |

---

## 6. Plates, sink, plate return

| Fact | Value | Source |
|---|---|---|
| Serving returns the plate | "After serving them to the Service Counter, money is awarded, and **after a few seconds** the plate is returned in the Plate Return." | [Plate](https://overcooked.fandom.com/wiki/Plate) |
| Plate return delay | wiki: "a few seconds", no number. Estimate **8 s**. Reasoning: 1-1 has 2 plates and a 1-pot bottleneck; a return much under 6 s removes the pressure the level is built around, and much over 10 s stalls the loop entirely. |
| Dirty vs clean on return | in kitchens **with** a sink the plate comes back **dirty** and must be washed; the wiki's per-level `plates=Yes/No` field is exactly "does this kitchen have dirty dishes" | [Plate](https://overcooked.fandom.com/wiki/Plate), [Sink](https://overcooked.fandom.com/wiki/Sink) |
| Kitchens without a sink | "Sinks are not necessary in kitchens; in fact, some kitchens remove them and Dirty dishes to reduce the kitchen's difficulty." → plates come back **clean** at the plate return / plate stack | [Sink](https://overcooked.fandom.com/wiki/Sink) |
| Washing | put the dirty plate in the sink, then press *Action* to clean it | [Sink](https://overcooked.fandom.com/wiki/Sink) |
| Where clean plates emerge | the sink has "a place to store clean Plates" — the drying rack beside the basin; they stack there | [Sink](https://overcooked.fandom.com/wiki/Sink) |
| Plates cannot go back on a sink | "Plates cannot be placed back on a sink once picked up." | [Sink](https://overcooked.fandom.com/wiki/Sink) |
| Wash time | wiki: none. Estimate **2.0 s of held *Action* per plate**. Reasoning: chopping is the wiki's only timed action at ~3 s; washing feels shorter in play and 1-1/3-4 both advise washing "as soon as they pop in", which implies a short interruption, not a long one. |
| Dirty plates stack | yes — chefs carry a stack; 1-4 advises "Wash Plates only if there are 3-5 in the Sink/Plate Return" | [1-4](https://overcooked.fandom.com/wiki/1-4_(Overcooked!)) |
| Serving an empty clean plate | "Serving clean plates without food will make them come back dirty." (so an empty plate *is* accepted by the serving counter, scores nothing, and costs you a wash) | [Plate](https://overcooked.fandom.com/wiki/Plate) |
| Plates are not trashable | "Cookware and Plates cannot normally be trashed" | [Trash Bin](https://overcooked.fandom.com/wiki/Trash_Bin) |
| Trashed-by-conveyor items respawn | after **5 seconds**, at the place they were initially found; clean plates stay clean, dirty stay dirty | [Trash Bin](https://overcooked.fandom.com/wiki/Trash_Bin) |
| Plate count per level | 2 in 1-1, 1-2 and 3-4; 3 in 2-1, 5-6, 6-1, 6-3; **5 in 1-4, the most of any level in the series** | the per-level Overview sections |
| Two plate returns | 6-4 has two, and "in *Overcooked!* only, Dirty Plates will only appear at **one** Plate Return at a time" | [6-4](https://overcooked.fandom.com/wiki/6-4_(Overcooked!)) |
| Level starting with dirty plates | only The Peckening (3 dirty plates on the plate return at start) | [The Peckening](https://overcooked.fandom.com/wiki/The_Peckening) |

---

## 7. Serving, orders, score

| Fact | Value | Source |
|---|---|---|
| Serving | put a plate holding a finished dish on the service counter; coins are awarded | [Service Counter](https://overcooked.fandom.com/wiki/Service_Counter) |
| Serving backwards | possible in 1-3 — "you can serve dishes on the Serving Counter backwards (from the other side)", so a serve counter is reachable from more than one side | [1-3](https://overcooked.fandom.com/wiki/1-3_(Overcooked!)) |
| More than one serve counter | usually one, sometimes two or more (4-4 and 6-4 have two) | [Service Counter](https://overcooked.fandom.com/wiki/Service_Counter) |
| Off-menu dish | "throw away meals not present in the Recipes" — an unordered dish is trash, not a serve, and serving one **breaks the combo** | [Trash Bin](https://overcooked.fandom.com/wiki/Trash_Bin), [Combos](https://overcooked.fandom.com/wiki/Combos) |
| Serving a correct dish that is not currently ordered | wiki: none. Estimate **rejected at the counter** (the plate stays in hand). Reasoning: [Combos](https://overcooked.fandom.com/wiki/Combos) says serving off-menu dishes breaks the combo, which implies the counter *accepts* them and punishes you — so the friendlier model for a clone is: accept it, score 0, break the combo. Pick one and be consistent; I recommend accept-and-score-zero because it matches the combo rule. |
| Level goal | "deliver as many Orders as possible in the set amount of time" | [Levels](https://overcooked.fandom.com/wiki/Levels) |
| Typical time limit | "usually 3 to 4 minutes"; in OC1 every numbered level is **4:00** except 1-1 | [Levels](https://overcooked.fandom.com/wiki/Levels) and the per-level infoboxes |

### Orders

The wiki says nothing about order cadence, timeout, or concurrency. Everything here is
estimated.

| Fact | Value | Reasoning |
|---|---|---|
| Orders on screen at once | wiki: none. Estimate **max 4** (3 in 1-1). | The 1-1 screenshot shows a single ticket at the top-left with room for a short row; OC1's HUD tickets are wide, and 4 is the ceiling the UI can hold at 1280x800. |
| New order interval | wiki: none. Estimate **every 12 s**, first order at t=0. | 1-2 wants 4 soups in 240 s for 3 stars (1P). A 12 s cadence produces ~20 orders — enough that failing some is survivable and the combo is the real difficulty, which matches "not fail orders" being the hard part of the combo rule. |
| Order timeout | wiki: none. Estimate **60 s**. | Long enough that one full soup cycle (chop 3 + cook + plate + walk ≈ 25-30 s) always fits with slack, short enough that a stalled kitchen visibly bleeds orders. |
| Order recipe choice | wiki: none for OC1's algorithm, but "In some levels specifically, there is a **recipe order that's preset** for 1 player" — so at least some OC1 orders are scripted, not random. The Peckening's four phases have explicit fixed order lists. | [Levels](https://overcooked.fandom.com/wiki/Levels), [The Peckening](https://overcooked.fandom.com/wiki/The_Peckening) |
| | Estimate for a clone: **uniform random from the level's recipe list, no immediate repeat of a recipe already queued twice.** | |

### Score

The wiki publishes **no per-recipe point value anywhere.** What it does publish is star
thresholds, and those constrain the answer.

| Fact | Value | Reasoning / source |
|---|---|---|
| Soup base score | wiki: none. Estimate **20 points.** | 1-1 is onion soup only, 2:30, one pot, and 3 stars at 60 points ([1-1 star chart](https://overcooked.fandom.com/wiki/1-1_(Overcooked!))). 60/20 = 3 soups, which is exactly what one pot and a 2:30 clock allow. 1-2's 1P 3-star is 80 = 4 soups over 4:00; 1-3's is 100 = 5 soups. Every world-1 soup threshold is a clean multiple of 20. **High confidence.** |
| Burger / fish and chips / pizza / burrito | wiki: none. Estimate **20 points each** for the base variant, **+5 per optional extra ingredient**. | 1-4 (burger) 1P 3-star is 160 = 8 dishes over 4:00, plausible for a 4-pan kitchen. Extras (lettuce, tomato, pepperoni, mushroom) cost real work, so they must pay; +5 keeps thresholds near multiples of 20. **Low confidence** — the wiki does not distinguish variants by score. |
| Salad | wiki: none. Estimate **15 points** (no cooking step). | Intro Apocalypse 1P 3-star is 300 over 1:40, which is far too high for 20-point salads; that level's scoring is clearly tuned differently (it is a scripted tutorial). Treat salad as the cheap dish. **Low confidence.** |
| Penalty for an expired order | wiki: none. Estimate **-10 points, floored at 0.** | Star thresholds in world 1 are low (1 star at 10-40); a penalty of a full dish's value would make 1 star unreachable after two mistakes. Half a dish is the largest penalty consistent with those thresholds. |
| Score floor | wiki: none. Estimate **score never goes below 0.** | No wiki page mentions negative scores, and the coin HUD in the 1-1 screenshot has no minus sign. |

### Tips and combos

| Fact | Value | Source |
|---|---|---|
| What a combo is | "Combos... closely linked with tip multipliers." | [Combos](https://overcooked.fandom.com/wiki/Combos) |
| How to maintain a combo | three conditions, all stated: **complete recipes in exact order**, **do not fail orders**, **do not serve dishes not present on the menu** | [Combos](https://overcooked.fandom.com/wiki/Combos) |
| Combos are visible as "Tip Combo Nx" | OC2 Kevin-level unlocks are phrased as "Tip Combo 2x / 3x / 4x / 5x / 7x / 9x", so the multiplier is an integer counter of consecutive clean serves | [Levels](https://overcooked.fandom.com/wiki/Levels) |
| Combos matter for 4 stars | "it's necessary to maintain a combo in order to four-star most levels"; in AYCE The Peckening's star rating is driven by the tip combo | [Combos](https://overcooked.fandom.com/wiki/Combos), [The Peckening](https://overcooked.fandom.com/wiki/The_Peckening) |
| Tip size | wiki: none. Estimate **+2 points per consecutive on-time serve, capped at +8** (so serve 1 = +0 bonus at combo 1, serve 5 onward = +8). | The combo multipliers the wiki names top out around 5x-9x. A tip that grew without limit would swamp the base score and make the world-1 thresholds meaningless; a cap at ~40% of a dish's value keeps combo play worth chasing without breaking the star maths. |
| Combo reset | wiki: none directly, but implied exactly by the three maintenance rules: **any expired order, any out-of-order serve, or any off-menu serve resets the counter to 0.** | [Combos](https://overcooked.fandom.com/wiki/Combos) |

**"Complete recipes in exact order" is the load-bearing rule** and the one most clones get
wrong. In OC1 the order tickets are a queue: serving the *third* ticket while the first is
still waiting is a legal serve that scores, but it breaks the combo.

---

## 8. Timer and prep time

| Fact | Value | Source |
|---|---|---|
| Standard OC1 level | **4:00** | every numbered level infobox except 1-1 |
| 1-1 | **"2:30 until 1 order complete"** — the clock does not start until the first dish is served | [1-1](https://overcooked.fandom.com/wiki/1-1_(Overcooked!)) infobox; the Strategies section confirms: "Because the timer doesn't start until you serve the first dish, you can stock up on chopped Onions before it starts" |
| Intro Apocalypse | 1:40, `preptime=Yes` | [Intro Apocalypse](https://overcooked.fandom.com/wiki/Intro_Apocalypse) |
| The Peckening | **17:00**, four phases, each ending when its final order is delivered | [The Peckening](https://overcooked.fandom.com/wiki/The_Peckening) |
| Which OC1 levels have prep time | **only Intro Apocalypse and 1-1.** Every other OC1 infobox says `preptime=No`. (1-4 and 5-1 gain prep time in *All You Can Eat* only.) | per-level infoboxes |
| Timer warning | wiki: none. Estimate **30 s left** triggers the audible warning and red clock. | Series-standard; the OC1 HUD clock in the 1-1 screenshot has no distinct state at 2:30, so the change must come late. |
| Falling-off penalty is time, not score | +5 s off the clock (see §1) | [3-4](https://overcooked.fandom.com/wiki/3-4_(Overcooked!)) uses the phrase "Time Penalty +5 seconds" |

---

## 9. Stars

| Fact | Value | Source |
|---|---|---|
| Max stars per level | **3 in OC1** (4 exists only in OC2/AYCE game+) | [Story Mode](https://overcooked.fandom.com/wiki/Story_Mode) |
| Star thresholds | per-level, per-player-count score milestones | [Stars to Unlock](https://overcooked.fandom.com/wiki/Stars_to_Unlock) |
| Campaign gating | each stage needs a running star total to unlock (1-1: 1 star, 1-2: 2, 1-3: 4 ... 6-4: 74) and you must earn **at least 1 star** in a stage to advance | [Stars to Unlock](https://overcooked.fandom.com/wiki/Stars_to_Unlock) |
| Free stars | Intro Apocalypse grants 3 stars regardless of score | [Stars to Unlock](https://overcooked.fandom.com/wiki/Stars_to_Unlock) |
| Campaign total | 90 stars over 30 stages; +18 per DLC; 126 for 100% | [Stars to Unlock](https://overcooked.fandom.com/wiki/Stars_to_Unlock) |

Note the wiki's `unlock=` infobox fields disagree with the [Stars to Unlock](https://overcooked.fandom.com/wiki/Stars_to_Unlock)
table for several levels (e.g. 2-1's infobox says 7 stars, the table says 10). **The Stars to
Unlock table is the more careful source**; it includes a worked "data + analysis" section.
Neither matters for this clone, which has no campaign gate.

---

## 10. Obstacles catalogue (what each OC1 level throws at you)

| Obstacle | First seen | Behaviour | Source |
|---|---|---|---|
| Static counter maze | 1-1 | a counter island you must walk around | [1-1](https://overcooked.fandom.com/wiki/1-1_(Overcooked!)) |
| Pedestrians | 1-2 | walk both ways across a crosswalk that splits the kitchen; they block chefs | [1-2](https://overcooked.fandom.com/wiki/1-2_(Overcooked!)) |
| Moving counters | 1-3 | the middle counters slide back and forth as the ship sways | [1-3](https://overcooked.fandom.com/wiki/1-3_(Overcooked!)) |
| Earthquake / raising platform | 1-6 | the right half of the kitchen rises and falls, cutting it off; chefs can drop down | [1-6](https://overcooked.fandom.com/wiki/1-6_(Overcooked!)) |
| Moving trucks | 2-1, 3-3 | two trucks drift together and apart; falling off costs 5 s | [2-1](https://overcooked.fandom.com/wiki/2-1_(Overcooked!)) |
| Rats | 2-2 | come out of counter holes, steal ingredients (chopped or not) and carry them back; you stop them by **sprinting into them** | [2-2](https://overcooked.fandom.com/wiki/2-2_(Overcooked!)) |
| Conveyor belts | 2-3 | run in a loop around the kitchen; used to pass items between separated chefs | [2-3](https://overcooked.fandom.com/wiki/2-3_(Overcooked!)) |
| Conveyors into a bin | 2-4, 4-4, 6-2 | items ride into the trash if not caught; trashed cookware respawns after 5 s | [2-4](https://overcooked.fandom.com/wiki/2-4_(Overcooked!)), [Trash Bin](https://overcooked.fandom.com/wiki/Trash_Bin) |
| Slippery ice | 3-1, 3-4, 6-3 | momentum carries; snow patches inside the same kitchen are not slippery | [3-1](https://overcooked.fandom.com/wiki/3-1_(Overcooked!)), [3-4](https://overcooked.fandom.com/wiki/3-4_(Overcooked!)) |
| Ice floes | 3-4, 6-3 | moving platforms crossing a river; falling in costs 5 s | [3-4](https://overcooked.fandom.com/wiki/3-4_(Overcooked!)) |
| Free-floating counters | 4-1 | counters drift around rather than sliding on one axis, re-partitioning the kitchen | [4-1](https://overcooked.fandom.com/wiki/4-1_(Overcooked!)) |
| Darkness | 4-2 | only chef-mounted flashlights light the kitchen; raw ingredients glow in the dark | [4-2](https://overcooked.fandom.com/wiki/4-2_(Overcooked!)) |
| Moving stations | 4-3 | the burners, the beef box and the single chopping board themselves relocate between quadrants | [4-3](https://overcooked.fandom.com/wiki/4-3_(Overcooked!)) |
| Buttons | 5-1, 6-4 | press to move a shared chamber / rotate the outer rooms 90° | [5-1](https://overcooked.fandom.com/wiki/5-1_(Overcooked!)), [6-4](https://overcooked.fandom.com/wiki/6-4_(Overcooked!)) |
| Cannons / fireballs | 5-2 | a cannon fires down the middle of the kitchen | [5-2](https://overcooked.fandom.com/wiki/5-2_(Overcooked!)) |
| Shifting bridges | 5-2 | 3 of 4 rock bridges are up at any time; falling in lava costs time | [5-2](https://overcooked.fandom.com/wiki/5-2_(Overcooked!)) |
| Pressure plates | 5-3, 5-6 | a chef standing on one opens a door for the other | [5-3](https://overcooked.fandom.com/wiki/5-3_(Overcooked!)) |
| Orbiting platforms | 5-4 | counters and burners circle two platforms in a figure-8 | [5-4](https://overcooked.fandom.com/wiki/5-4_(Overcooked!)) |
| Rotating rooms | 6-4 | buttons rotate the four outer chambers; only two opposite chambers are reachable at once | [6-4](https://overcooked.fandom.com/wiki/6-4_(Overcooked!)) |
| Meteors | The Peckening | set counters on fire on impact; one hit is scripted at the start of phase 2 | [The Peckening](https://overcooked.fandom.com/wiki/The_Peckening) |

---

## 11. What the wiki does not answer

Open questions the integrator should treat as tunable, in rough order of how much they
change the feel of the game:

1. Per-recipe score and the tip formula. Nothing on the wiki. Soup = 20 is well-constrained
   by 1-1's star chart; everything else is inference.
2. Order cadence, concurrency and timeout. Nothing at all.
3. Cook time in seconds. Only "green line increases" and the post-cook burn timeline.
4. Wash time and plate-return delay in seconds. Only "a few seconds".
5. Chef speed, hitbox, reach.
6. Whether a partly-filled pot burns. The 1-2 strategy line strongly implies yes, but says
   it obliquely.
7. Whether the serving counter rejects a correct-but-unordered dish or accepts it for 0.
8. Fire spread rate and whether burning is deterministic.
