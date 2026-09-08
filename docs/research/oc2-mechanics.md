# Overcooked! 2 — mechanics research

Source: <https://overcooked.fandom.com> via the MediaWiki API (see `CLAUDE.md`). Every row cites the
page it came from. Rows marked **wiki: none, estimate** are my inference from level text or from OC1
behaviour; the wiki gives no number. Nothing here is invented from memory of the game.

Scope: the OC2 base game (6 worlds × 6 levels + Kevin 1–8). DLC-only stations are listed separately
at the bottom so they don't leak into the port plan.

---

## 1. Summary — what OC2 adds over OC1

| Change | Kind | Wiki page |
|---|---|---|
| Throwing (toss any held item, other chefs can catch) | new verb | [Overcooked! 2](https://overcooked.fandom.com/wiki/Overcooked!_2) |
| Dashing (short forward burst, ~0.5 s cooldown) | new verb | [Dash](https://overcooked.fandom.com/wiki/Dash) |
| Emotes (canned callouts, no gameplay effect found) | new verb | [Achievements and Trophies](https://overcooked.fandom.com/wiki/Achievements_and_Trophies) |
| Online multiplayer, 1–4 players | mode | [Overcooked! 2](https://overcooked.fandom.com/wiki/Overcooked!_2) |
| 4th star per level (New Game+ update, Aug 2018) | scoring | [Overcooked! 2](https://overcooked.fandom.com/wiki/Overcooked!_2) |
| Tip combo requires serving orders **in the exact listed order** | scoring | [Combos](https://overcooked.fandom.com/wiki/Combos) |
| Multi-step recipes: chop → mix/boil/fry → bake/steam → plate | recipes | [Recipe](https://overcooked.fandom.com/wiki/Recipe) |
| New stations: Mixer, Steamer, Oven (reused), Deep Fryer + Frying Basket | stations | [Category:Kitchen utensils](https://overcooked.fandom.com/wiki/Category:Kitchen_utensils) |
| Portals, moving/sinking platforms, moving counters, conveyor **floors**, wind, cars, elevators | level tech | per-level pages |
| Colored conveyor belts flipped by colored buttons | level tech | [Conveyor Belt](https://overcooked.fandom.com/wiki/Conveyor_Belt), [Button](https://overcooked.fandom.com/wiki/Button) |
| Dynamic levels — the kitchen itself changes mid-run (1-6, 3-6, 5-6, 6-6) | level tech | [Levels](https://overcooked.fandom.com/wiki/Levels) |
| Floor fire — a wall-like flame that spawns on the ground, not just on counters | hazard | [Fire](https://overcooked.fandom.com/wiki/Fire) |
| Rats removed | hazard | [Rats](https://overcooked.fandom.com/wiki/Rats) ("Rats aren't in any *Overcooked! 2* kitchens") |
| Burners switch off when no cookware sits on them | polish | [Burner](https://overcooked.fandom.com/wiki/Burner) |
| Kevin Levels — 8 hidden levels unlocked by in-level challenges | progression | [Levels](https://overcooked.fandom.com/wiki/Levels) |

---

## 2. Throwing

There is no dedicated wiki page for throwing; the facts below are assembled from the game page, the
achievement list, and per-level strategy sections.

| Fact | Detail | Source |
|---|---|---|
| Exists at all | "Throwing is now an official game mechanic, allowing you to toss ingredients to your fellow chefs or even straight into the pan/blender/onto the floor" | [Overcooked! 2](https://overcooked.fandom.com/wiki/Overcooked!_2) |
| Not in OC1 | Achievement "Back in my day…" = *Attempt to throw something in Overcooked!* | [Achievements](https://overcooked.fandom.com/wiki/Achievements_and_Trophies) |
| Throwable | Raw and chopped ingredients; assembled-but-unplated food (implied by "toss ingredients across") | [3-4](https://overcooked.fandom.com/wiki/3-4_(Overcooked!_2)), [2-2](https://overcooked.fandom.com/wiki/2-2_(Overcooked!_2)) |
| Not throwable | **Plates.** "Players should coordinate and prioritize passing plates to the other half, **as they cannot be tossed**" | [4-5](https://overcooked.fandom.com/wiki/4-5_(Overcooked!_2)) |
| Plate-dash exception | "When holding a plate, dash forward and hit the toss button. If done correctly, the plate can be tossed a short distance." Described as a trick, not a normal action | [4-2](https://overcooked.fandom.com/wiki/4-2_(Overcooked!_2)) |
| Lands in cookware | Achievement "Hot Pot Shot" = *Throw 100 ingredients into a cooking pot*; woks accept thrown noodles/bok choy/beef/prawn | [Achievements](https://overcooked.fandom.com/wiki/Achievements_and_Trophies), [Wok](https://overcooked.fandom.com/wiki/Wok) |
| Lands on stations | Can land in a mixer — "try not to … accidentally toss more than one flour into the right mixer" | [5-4](https://overcooked.fandom.com/wiki/5-4_(Overcooked!_2)) |
| Lands in the bin | "try to not toss them straight into the bin" — a throw into a trash bin destroys the item | [5-4](https://overcooked.fandom.com/wiki/5-4_(Overcooked!_2)) |
| Catching | Achievement "I Ain't No Butterfingers" = *Catch 250 items*; "Space Jelly" = *Throw and Catch an Ingredient between 4 Alien chefs 15 times without dropping it*. So catching is a distinct, failable event, not automatic pickup | [Achievements](https://overcooked.fandom.com/wiki/Achievements_and_Trophies) |
| Aim | Throw direction follows chef facing, including diagonals: "throwing ingredients by looking down or diagonally down-right at the ledge … will overshoot them outside of the playable area" | [5-6](https://overcooked.fandom.com/wiki/5-6_(Overcooked!_2)) |
| Angle between chefs | "Chefs can also throw ingredients from one another at an angle … by having both chefs standing close to the edge and facing each other" | [6-2](https://overcooked.fandom.com/wiki/6-2_(Overcooked!_2)) |
| Blocked by geometry | "The high walls prevent players from tossing ingredients towards the middle" | [6-1](https://overcooked.fandom.com/wiki/6-1_(Overcooked!_2)) |
| Crosses gaps | Chasms/rifts/rivers that chefs cannot walk over are throwable across | [3-4](https://overcooked.fandom.com/wiki/3-4_(Overcooked!_2)), [3-2](https://overcooked.fandom.com/wiki/3-2_(Overcooked!_2)) |
| Crosses portals | "You can toss items in the portal" | [6-6](https://overcooked.fandom.com/wiki/6-6_(Overcooked!_2)) |
| Range | **wiki: none, estimate** — roughly 3–4 tiles flat, further with a dash. Wiki never gives a number; the only quantified hint is that a plate-dash throws "a short distance". | — |
| Landing on a counter vs floor | **wiki: none, estimate** — items land where they hit; the game page explicitly lists "onto the floor" as an outcome, so a miss is a floor item, not a lost item. | — |
| Landing on an occupied counter | **wiki: none, estimate** — presumably bounces off / stays on the floor. | — |

**Design read for the port:** throwing is a *pass* mechanic. Every mid/late OC2 level's cooperation
plan is "cut on one side, throw to the other". It is the single highest-value mechanic to add.

---

## 3. Dashing

| Fact | Detail | Source |
|---|---|---|
| Effect | "Can propel you forward a bit" | [Dash](https://overcooked.fandom.com/wiki/Dash) |
| Cooldown | "just above half a second" (~0.5–0.6 s) | [Dash](https://overcooked.fandom.com/wiki/Dash) |
| Beats conveyors | "allowing you to outrun conveyor belts" | [Dash](https://overcooked.fandom.com/wiki/Dash) |
| Extends a throw | "fling ingredients further (when letting them go away from a countertop)" | [Dash](https://overcooked.fandom.com/wiki/Dash) |
| Knocks items loose | "knock items out of other players' hands" | [Dash](https://overcooked.fandom.com/wiki/Dash) |
| Pushes chefs | Achievement "You're a Real Pizza-work" = *Push someone off a level* | [Achievements](https://overcooked.fandom.com/wiki/Achievements_and_Trophies) |
| Used to cross hazards | "Because of the cars, the center of the map should be avoided (dash across if needed)" | [4-1](https://overcooked.fandom.com/wiki/4-1_(Overcooked!_2)) |
| Used against belts | "they can walk on the conveyor belt, dashing if needed when doing so against it" | [4-3](https://overcooked.fandom.com/wiki/4-3_(Overcooked!_2)) |
| Ledge grip | "you can … keep yourself on ledges for longer" (listed as a glitch) | [Dash](https://overcooked.fandom.com/wiki/Dash) |
| Distance / duration / speed multiplier | **wiki: none, estimate** — ~1.5 tiles over ~0.2 s. | — |

---

## 4. Emotes

The wiki has no Emotes page. Only two facts exist:

| Fact | Source |
|---|---|
| Emotes exist and there is a fixed finite set | achievement "It's Bean Emotional" = *Use every emote* (Bronze in OC2, Silver in AYCE) |
| Nothing on their gameplay effect, count, names, or bindings | — |

**wiki: none, estimate** — they are cosmetic callouts for online play ("I need this", "hurry up").
Not worth porting to a shared-screen build; two players on one couch talk instead.

---

## 5. Stations and appliances

### 5.1 In the OC2 base campaign

| Station | Verb | Holds | Used by | Notes | Source |
|---|---|---|---|---|---|
| Chopping Board | hold *Action* | 1 ingredient | every recipe except Pancake-plain | ~3 s per ingredient; two chefs on one board is faster ("double chopping"); single-player chopping is deliberately slower | [Chopping Board](https://overcooked.fandom.com/wiki/Chopping_Board), [Chopping](https://overcooked.fandom.com/wiki/Chopping) |
| Burner | passive | 1 cookware | pots, pans, steamers | OC2 only: burner switches **off** when no cookware sits on it; pushes chefs away if they try to place a plate, unchopped ingredient, or extinguisher | [Burner](https://overcooked.fandom.com/wiki/Burner) |
| Pot (on burner) | boil | ingredients | Sushi (rice), Burrito (rice), Pasta (pasta) | | [Pot](https://overcooked.fandom.com/wiki/Pot) |
| Pan (on burner) | fry | ingredients | Burger (patty), Burrito (meat), Pasta (sauce), Pancake (batter) | pans cannot fry "anything" like OC1 pots could — the recipe must call for frying | [Pan](https://overcooked.fandom.com/wiki/Pan) |
| Steamer (on burner) | steam | mixed/chopped filling | Steamed Food (all Kevin levels) | OC2-exclusive; bamboo steamer | [Steamer](https://overcooked.fandom.com/wiki/Steamer) |
| Mixer | mix | 2–4 ingredients | Cake, Pancake, Steamed Food (except fish-only) | OC2-exclusive. **Leave contents in too long and the mixer breaks** (electric icon) and is unusable for the rest of the level — a distinct failure mode from burning | [Mixer](https://overcooked.fandom.com/wiki/Mixer) |
| Oven | bake | mixed batter / assembled pizza | Cake, Pizza | in OC2 you *can* plate straight out of the oven (you could not in OC1) | [Oven](https://overcooked.fandom.com/wiki/Oven) |
| Deep Fryer + Frying Basket | deep fry | 1 basket of chopped food | Fast Food (chips, nuggets, fish) | two-part: the basket is the cookware, the fryer is the heat. Baskets cannot pour into other cookware (bug) | [Deep Fryer](https://overcooked.fandom.com/wiki/Deep_Fryer), [Frying Basket](https://overcooked.fandom.com/wiki/Frying_Basket) |
| Sink | hold *Action* | dirty plate stack | levels with `plates=Yes` | plates cannot be put *back* on a sink once picked up | [Sink](https://overcooked.fandom.com/wiki/Sink) |
| Plate Return | passive | plates | every level | returns plates after a serve; dirty in sink levels, clean in sink-less levels | [Plate Return](https://overcooked.fandom.com/wiki/Plate_Return) |
| Service Counter | serve | plated dish | every level | usually one per level, some levels have two or more | [Service Counter](https://overcooked.fandom.com/wiki/Service_Counter) |
| Trash Bin | destroy | anything droppable | most levels | see §8 for the conveyor-into-bin rule | [Trash Bin](https://overcooked.fandom.com/wiki/Trash_Bin) |
| Ingredient Box | pick up | infinite source | every level | doubles as a temporary counter | [Ingredient Box](https://overcooked.fandom.com/wiki/Ingredient_Box) |
| Ingredient Dispenser | auto-emit | onto a conveyor | 4-1, Kevin 8 | can cycle types: "in 4-1 there are two Dispensers; one shifts between dispensing Nori and Rice" | [Ingredient Dispenser](https://overcooked.fandom.com/wiki/Ingredient_Dispenser) |
| Conveyor Belt | transport | items | 1-4, 1-6, 4-1…4-6, 6-1, 6-3, 6-5, 6-6, Kevin 6, Kevin 8 | OC2 adds **colored** belts flipped by matching buttons, and per-level belt speed | [Conveyor Belt](https://overcooked.fandom.com/wiki/Conveyor_Belt) |
| Conveyor Floor | transport chefs | — | 4-6 ("walkable conveyor belts"), Kevin 8 ("fast tile-type conveyor belt") | distinct mechanic, first in OC2 | [Conveyor Floor](https://overcooked.fandom.com/wiki/Conveyor_Floor) |
| Button | press (*Pick Up*) | — | 4-5 and 6-3 (redirect belts), 6-6 (open a gate) | toggles mechanisms; activated buttons turn red; OC2 introduces colored buttons matched to belt colors | [Button](https://overcooked.fandom.com/wiki/Button) |
| Control stick / joystick | hold to steer | — | 5-1, 5-3, 5-5, 6-4 | a counter-height stick that drives a movable platform or an ingredient-box island. Distinct from a button: it is continuous, not a toggle | per-level pages |
| Fire Extinguisher | hold *Action* | carried | most levels | also puts out OC2's new floor fires, not just cookware fires | [Fire Extinguisher](https://overcooked.fandom.com/wiki/Fire_Extinguisher) |
| Portal | walk / throw through | — | 3-2, 3-4, 5-4, 5-6, 6-6 | no wiki page; behaviour only described per-level. Achievement "Jelly-Porter" = *Go through portals 75 times* | per-level pages |

### 5.2 DLC-only (do not port with the base campaign)

Blender (Surf 'n' Turf, smoothies), Wok (Chinese New Year, hot pot), Guillotine (Hangry Horde,
button-driven chopper holding 2 items), Furnace, Campfire/Barbecue/Bellows, Backpack, Cannon,
Condiment Machine, Drinks Machine, Glass, Water Gun, Flamethrower, Service Barrier, Unlockable Gate,
Lever, Lily Pad.
Source: [Category:Kitchen utensils](https://overcooked.fandom.com/wiki/Category:Kitchen_utensils).

---

## 6. Multi-step recipes

OC1's model was *chop N of the same thing → pot → plate*. OC2's model is a **per-ingredient step
chain that converges on a shared station**.

> "Recipes require one or more cooking methods, so various kitchen utensils will be employed for
> their preparation. Additionally, each recipe has variations so while the general prep remains the
> same, some ingredients might differ. The last step is always plating the dish."
> — [Recipe](https://overcooked.fandom.com/wiki/Recipe)

Two shapes exist:

**A. Parallel chains, combined on the plate.** Each ingredient runs its own chain independently and
the plate is the join. Sushi, Burrito, Burger, Salad, Sashimi, Pasta, Fast Food.
Example — Beef Burrito ([Template:BeefBurrito](https://overcooked.fandom.com/wiki/Template:BeefBurrito)):

```
tortilla  ──────────────────────────────► plate
rice      ── boil ──────────────────────► plate
beef      ── chop ── fry (pan) ─────────► plate
```

**B. Serial chains, combined in a machine.** Ingredients are merged in a mixer, then the *mixture* is
moved to a second appliance. Cake, Pancake, Steamed Food.
Example — Carrot Cake ([Template:CarrotCake](https://overcooked.fandom.com/wiki/Template:CarrotCake)):

```
flour ─┐
egg   ─┤
honey ─┼─ chop (honey, carrot) ─► MIX (all four) ─► OVEN ─► plate
carrot ┘
```

Pizza is a hybrid: three or four ingredients are each chopped, assembled **on the dough** (not a
plate), then the whole assembly is baked and plated.
([Template:NormalPizza](https://overcooked.fandom.com/wiki/Template:NormalPizza))

Ingredients that are **never chopped**: buns, tortillas, nori, pasta, eggs, flour, noodles, milk, beans,
crackers, turkey, whipped cream, mustard, ketchup, drinks.
([Chopping Board](https://overcooked.fandom.com/wiki/Chopping_Board))

Full per-recipe tables live in `oc2-recipes.md`.

---

## 7. Dynamic and moving levels

The wiki treats "dynamic" as a formal level flag (a lightning/hourglass icon on the world map),
separate from levels that merely have moving furniture.
[Levels](https://overcooked.fandom.com/wiki/Levels)

| Level | What changes | When | Source |
|---|---|---|---|
| 1-6 | Buffet balloon crashes into a Sushi City restaurant; recipe set changes from salad+sushi to a bigger kitchen | 2:20 elapsed (level is 4:10) | [1-6](https://overcooked.fandom.com/wiki/1-6_(Overcooked!_2)) |
| 3-6 | Moreish Mine floods and becomes a Ravenous Rapids raft kitchen; the three platforms become rafts | 2:20 elapsed (level is 4:10) | [3-6](https://overcooked.fandom.com/wiki/3-6_(Overcooked!_2)) |
| 5-6 | Three phases. Phase 2 at 3:48 **remaining**, phase 3 at 1:58 **remaining**. In phase 2 counters slide across the kitchen into their phase-3 positions. A new recipe variant (Fish & Prawn Pasta) only appears in phase 3 | timed | [5-6](https://overcooked.fandom.com/wiki/5-6_(Overcooked!_2)) |
| 6-6 | Unbread swap out countertops; layout changes **after the burgers are delivered** (progress-driven, not timed); the ground breaks after the last burger | order-driven | [6-6](https://overcooked.fandom.com/wiki/6-6_(Overcooked!_2)), [Levels](https://overcooked.fandom.com/wiki/Levels) |

Non-flagged but moving level tech, with the timings the wiki actually gives:

| Mechanic | Timing | Levels | Source |
|---|---|---|---|
| Rotating counter | rotates counter-clockwise every 30 s | 2-6 | [2-6](https://overcooked.fandom.com/wiki/2-6_(Overcooked!_2)) |
| Sliding chopping-board counter | moves left/right every ~30 s | 3-1 | [3-1](https://overcooked.fandom.com/wiki/3-1_(Overcooked!_2)) |
| Ingredient boxes sectioning the kitchen | all open for the first 10 s, then vertical/horizontal split alternating every 30–40 s | 3-3 | [3-3](https://overcooked.fandom.com/wiki/3-3_(Overcooked!_2)) |
| Stairs ↔ portals swap | every ~35 s | 3-2, 5-4 | [3-2](https://overcooked.fandom.com/wiki/3-2_(Overcooked!_2)), [5-4](https://overcooked.fandom.com/wiki/5-4_(Overcooked!_2)) |
| Conveyor belts reversing | every 30 s | 4-3 | [4-3](https://overcooked.fandom.com/wiki/4-3_(Overcooked!_2)) |
| Wind gusts | direction flips every ~13 s; upper and lower gusts always oppose; wind moves chefs *and* items | 4-4, Kevin 5 | [4-4](https://overcooked.fandom.com/wiki/4-4_(Overcooked!_2)), [Kevin 5](https://overcooked.fandom.com/wiki/Kevin_5) |
| Counter contents swapping | every 30 s | 4-6 | [4-6](https://overcooked.fandom.com/wiki/4-6_(Overcooked!_2)) |
| Sinking platforms | up ~13 s, down ~5 s, shape changes in a fixed cycle | 6-2 | [6-2](https://overcooked.fandom.com/wiki/6-2_(Overcooked!_2)) |
| Sinking half-sections | alternate every 45 s, telegraphed by a rumble; items stay put while sunk, pans burn, fires self-extinguish underwater | 6-5 | [6-5](https://overcooked.fandom.com/wiki/6-5_(Overcooked!_2)) |
| Pushed 3×3 quadrants | clockwise then counter-clockwise, starting at 3:00 remaining, every ~23 s | Kevin 2 | [Kevin 2](https://overcooked.fandom.com/wiki/Kevin_2) |
| Chef-driven platform | joystick/control-stick counter the players steer | 5-1, 5-3, 5-5, 6-4 | per-level pages |
| Cars on a road | cross when the light turns green and run chefs over | 4-1, Kevin 5 | [4-1](https://overcooked.fandom.com/wiki/4-1_(Overcooked!_2)) |
| Elevator | moves between three height levels | Kevin 3 | [Kevin 3](https://overcooked.fandom.com/wiki/Kevin_3) |

---

## 8. Orders, tips, combos, scoring

| Rule | Detail | Source |
|---|---|---|
| Goal | "deliver as many Orders as possible in the set amount of time (usually 3 to 4 minutes)" | [Levels](https://overcooked.fandom.com/wiki/Levels) |
| Stars | 0–3 in OC1; **0–4 in OC2** after the New Game+ update (Aug 24 2018 Steam / Oct 3 2018 console) | [Story Mode](https://overcooked.fandom.com/wiki/Story_Mode), [Overcooked! 2](https://overcooked.fandom.com/wiki/Overcooked!_2) |
| Star thresholds | Per-level and **per player count** (1/2/3/4). Full table in `oc2-levels.md` | per-level star charts |
| Tip combo | Tips scale with a combo multiplier. To keep it you must: **complete recipes in the exact order shown**, not fail an order, and not serve a dish that isn't on the menu | [Combos](https://overcooked.fandom.com/wiki/Combos) |
| Combo is required for 4 stars | "it's necessary to maintain a combo in order to four-star most levels" | [Combos](https://overcooked.fandom.com/wiki/Combos) |
| Combo unlocks content | Kevin levels are unlocked by hitting a specific combo (2×–9×) or score in a specific level — see `oc2-levels.md` | [Levels](https://overcooked.fandom.com/wiki/Levels) |
| Prep time / delayed timer | "When a new recipe is presented, the instructions will be shown at the start of the level and **the timer will not start until the first order is served**" | [Recipe](https://overcooked.fandom.com/wiki/Recipe) |
| Levels with a delayed timer | Confirmed on-page for 1-1 (sashimi), 1-2 (sushi), 2-6 (burger), 3-1 (pizza), 6-1 (cake). By the rule above it also applies at each recipe's first appearance: 1-5 pasta, 2-1 fast food, 2-4 burrito, 5-4 pancake, Kevin 1 steamed food, Tutorial salad | per-level pages + [Recipe](https://overcooked.fandom.com/wiki/Recipe) |
| Wrong dish | Serving something not on the menu breaks the combo. Achievement "It's RAAW" = *Deliver a wrong dish 10 times* — so it is served, not rejected | [Combos](https://overcooked.fandom.com/wiki/Combos), [Achievements](https://overcooked.fandom.com/wiki/Achievements_and_Trophies) |
| Points per dish | **wiki: none, estimate.** The wiki never lists a per-recipe score. The best anchor is 1-1 (sashimi only): 1★ = 20 points for every player count, and every star chart in the game is a multiple of 20. So dishes are worth multiples of 20 and the simplest dish (one-chop sashimi) is plausibly the 20-point floor | derived from star charts |
| Tip size | **wiki: none, estimate** — the tip is an on-time bonus added on top of the base score and multiplied by the combo counter. | — |
| Expiry penalty | **wiki: none, estimate** — no page states a point penalty; the confirmed cost of a failed order is losing the combo. | — |
| Order cap | **wiki: none, estimate** — 3–5 tickets on screen; 6-1 mentions "a maximum capacity of 5 ready, baked cakes" but that is prepared food, not tickets. | — |
| Preset order sequences | "In some levels specifically, there is a recipe order that's preset for 1 player." 6-6 is fully scripted: "two of each type of dish … Their order is set to always be the same" | [Levels](https://overcooked.fandom.com/wiki/Levels), [6-6](https://overcooked.fandom.com/wiki/6-6_(Overcooked!_2)) |
| Cold food | No penalty found. Achievement "It's COLD" = *Keep a finished meal 30 seconds before serving it* is a challenge, not a fail state | [Achievements](https://overcooked.fandom.com/wiki/Achievements_and_Trophies) |

---

## 9. Plates and washing

| Rule | Detail | Source |
|---|---|---|
| Two level modes | Levels have `plates = Yes` (a sink exists, plates come back dirty) or `plates = No` (no sink, plates come back clean). 6 of the 44 base levels are sink-less: 1-1, 1-2, 2-1, 2-2, 3-2, 3-6 | per-level infoboxes |
| Return delay | Plates come back on the Plate Return "after a few seconds" | [Plate](https://overcooked.fandom.com/wiki/Plate) |
| Washing | Put a dirty plate in the sink, hold *Action*. Two chefs can wash the same sink simultaneously and "it's a lot faster" | [Sink](https://overcooked.fandom.com/wiki/Sink), [4-4](https://overcooked.fandom.com/wiki/4-4_(Overcooked!_2)) |
| One-way | "Plates cannot be placed back on a sink once picked up" | [Sink](https://overcooked.fandom.com/wiki/Sink) |
| Serving an empty plate | "Serving clean plates without food will make them come back dirty" | [Plate](https://overcooked.fandom.com/wiki/Plate) |
| Plate count | 2–4 per level, placed at fixed start positions (per-level Overview sections) | per-level pages |
| Plates cannot be thrown | see §2 | [4-5](https://overcooked.fandom.com/wiki/4-5_(Overcooked!_2)) |
| Plate size | OC1 had small and large plates (large only for pizza); **OC2 uses one plate size** | [Plate](https://overcooked.fandom.com/wiki/Plate) |
| Lost-item respawn | Cookware and plates destroyed by a conveyor-into-bin, or dropped into water, **respawn at their original spot after 5 seconds**, keeping their clean/dirty state | [Trash Bin](https://overcooked.fandom.com/wiki/Trash_Bin), [6-2](https://overcooked.fandom.com/wiki/6-2_(Overcooked!_2)) |
| Deliberate respawn as a tactic | "bowls should be dropped into water to make them respawn back at their stand after 5 seconds, saving chefs a dedicated trip" | [6-2](https://overcooked.fandom.com/wiki/6-2_(Overcooked!_2)) |

---

## 10. Fire and burning

| Rule | Detail | Source |
|---|---|---|
| Burn warning ladder | Green progress bar fills → green check → after ~5 s a beep + exclamation mark → after another ~5 s faster beeps + blinking red mark → after another ~3 s the food is burnt. **~13 s of grace from "done" to "burnt".** | [Burnt food](https://overcooked.fandom.com/wiki/Burnt_food) |
| Burnt food | Marked with 🔥, unrecoverable, must go in the bin | [Burnt food](https://overcooked.fandom.com/wiki/Burnt_food) |
| Cookware fire | Burnt food may ignite the appliance | [Fire](https://overcooked.fandom.com/wiki/Fire) |
| Spread | "Fire expands on adjacent Countertops, Burners, Deep Fryers, and other kitchen utensils upon which objects are placed" | [Fire](https://overcooked.fandom.com/wiki/Fire) |
| Effect on cooking | "Any cooking device affected by tabletop fire cannot cook food until the fire is extinguished" | [Fire](https://overcooked.fandom.com/wiki/Fire) |
| Chefs can still work through it | "Chefs can still chop, assemble and take out ingredients out of Countertops etc. when they are on fire" | [Fire](https://overcooked.fandom.com/wiki/Fire) |
| **New in OC2 — floor fire** | "a new type of fire … appears after a certain amount of time has passed and appears constantly. It is stuck to the ground of the kitchen and **will block players** that try to walk through it. These flames go out once their timer ends, but can also be extinguished to shorten the process." | [Fire](https://overcooked.fandom.com/wiki/Fire), first in [1-6](https://overcooked.fandom.com/wiki/1-6_(Overcooked!_2)) |
| Floor-fire refresh | "If a ground flame appears on top of an existing one, the timer of the existing one resets" | [Fire](https://overcooked.fandom.com/wiki/Fire) |
| Floor-fire levels | 1-6 (shot from a central flame at random spots), 4-6, 5-2 ("Fires will randomly start throughout the kitchen, cutting off movement across the corridors and even cornering unlucky chefs"), 6-1, Kevin 4 (a central fireplace that "shoots fire everywhere") | per-level pages |
| Underwater | Fires self-extinguish when their section sinks | [6-5](https://overcooked.fandom.com/wiki/6-5_(Overcooked!_2)) |
| Mixer overrun | Distinct failure: the mixer "will be broken and display an electric sign. Then the mixer is no longer usable." No extinguisher fix mentioned | [Mixer](https://overcooked.fandom.com/wiki/Mixer) |
| Fire duration / extinguish rate | **wiki: none, estimate** — no numbers given for either. | — |

---

## 11. Timer rules

| Rule | Detail | Source |
|---|---|---|
| Level lengths in the base campaign | 2:20 (2-1) up to 5:10 (5-6); 6-6 is 15:00 for 2+ players and 25:00 solo. Most are 3:30–4:00 | per-level infoboxes |
| Delayed start | See §8 — first appearance of a recipe means the clock does not start until the first serve | [Recipe](https://overcooked.fandom.com/wiki/Recipe) |
| Solo gets more time | 6-6 is the only base level with an explicit per-player-count time. Chopping is also explicitly slower in single player | [6-6](https://overcooked.fandom.com/wiki/6-6_(Overcooked!_2)), [Chopping](https://overcooked.fandom.com/wiki/Chopping) |
| Dynamic transitions are on the clock | 1-6 and 3-6 at 2:20 elapsed; 5-6 at 3:48 and 1:58 remaining; Kevin 2's rotation starts at 3:00 remaining | per-level pages |
| Warning at 30 s / 60 s | **wiki: none, estimate.** | — |

---

## 12. Other things worth knowing

- **Chef respawn.** Chefs who fall in water respawn at their starting area ([5-6](https://overcooked.fandom.com/wiki/5-6_(Overcooked!_2))).
  Achievement "Clutz in the Kitchen" = *Respawn 10 times*.
- **Ingredient despawn.** "If too many ingredients are prepared, some can despawn" ([6-1](https://overcooked.fandom.com/wiki/6-1_(Overcooked!_2))).
  This is OC2's replacement for OC1's rats — it caps stockpiling without an NPC. No count or timer given (**wiki: none, estimate**).
- **Double-chop.** Two chefs on one board chop faster ([Chopping](https://overcooked.fandom.com/wiki/Chopping)). Double-wash is the same ([4-4](https://overcooked.fandom.com/wiki/4-4_(Overcooked!_2))).
- **Solo penalty.** "Chopping is slower in Singleplayer Mode in all Overcooked! games, allowing the other chef to be used while the one used before chops" ([Chopping](https://overcooked.fandom.com/wiki/Chopping)).
- **Trash bin as a hazard.** A conveyor that ends in a bin deletes everything, including cookware and plates ([Trash Bin](https://overcooked.fandom.com/wiki/Trash_Bin)).
- **Portals move.** 5-4 has a portal that floats left and right; entering the fixed portal spawns you wherever the moving one currently is, "even into the pit as it moves across sections" ([5-4](https://overcooked.fandom.com/wiki/5-4_(Overcooked!_2))).

---

## 13. Open questions the wiki cannot answer

1. Throw range, arc height, and travel speed.
2. Whether a catch is automatic on collision or requires an input.
3. Dash distance, duration, and impulse applied to a bumped chef.
4. Per-recipe base score and the exact tip formula (base tip, per-combo increment, cap).
5. Order expiry penalty in points.
6. Concurrent order cap and the order-arrival interval.
7. Cook / boil / fry / bake / steam / mix durations per station (only chopping's ~3 s is given).
8. Ingredient despawn timer and stockpile cap.
9. Exact conveyor belt speed values (the wiki only says they vary per level).
10. How many emotes exist and what they are.
