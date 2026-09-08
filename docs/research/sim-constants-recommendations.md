# Recommended values for `src/sim/constants.ts`

For the integrator. One row per constant currently in the file, plus a short list of
constants the sim will need that the file does not have yet.

`Source` is either a wiki page (with the quote that justifies it) or `estimate`.
`Confidence`: **high** = the wiki states it, or a star chart pins it; **med** = the wiki
states it loosely ("about three seconds") or one wiki sentence constrains it indirectly;
**low** = no wiki support, reasoned from level design and playtest feel.

## Summary — what actually changes

| Constant | Now | Recommended | Why |
|---|---|---|---|
| `CHOP_TIME` | 1.5 | **3.0** | The wiki states chopping takes "about three seconds". Doubling this is the single largest behavioural change in the list. |
| `BURN_TIME` | 10 | **13** | The wiki's burn timeline is 5 + 5 + 3 seconds of warning stages after the check mark. |
| `PLATE_RETURN_DELAY` | 8 | **6** | The wiki says the plate returns "after a few seconds"; 8 stretches "a few". |

Everything else: keep the current value.

---

## Full table

| Constant | Current | Recommended | Source | Confidence | Notes |
|---|---|---|---|---|---|
| `SIM_DT` | 1/60 | **1/60** | estimate | high | Not a game fact. 60 Hz fixed step is right for determinism and matches AYCE's stated 60 fps. |
| `CHEF_SPEED` | 4.2 | **4.2** | estimate | low | No wiki number. 4.2 tiles/s puts a lap of the 1-5 ring corridor at ~10 s and a corner-to-corner walk in 1-1 at ~3 s, which is the pace 1-1's 2:30 assumes. Tune by playing 1-1: if 3 soups in 2:30 feels comfortable for one player, it is a touch fast. |
| `CHEF_RADIUS` | 0.35 | **0.35** | estimate | low | Makes a 1-tile corridor passable for one chef and blocked for two, which is what 1-5's "1 block wide pathway everywhere" gimmick needs to mean something. |
| `CHEF_HITBOX` | 0.6 | **0.6** | estimate | low | Square side against solid tiles. Slightly under 1 tile so corners forgive. |
| `REACH` | 0.6 | **0.6** | estimate | med | OC1 has no free aim: the highlighted station is always the single tile the chef faces. Any value in 0.5–0.7 picks the same tile; the constant only matters at tile boundaries. |
| `CHOP_TIME` | 1.5 | **3.0** | [Chopping Board](https://overcooked.fandom.com/wiki/Chopping_Board): "After about three seconds, the chopping is done" | **high** | This is the only action the wiki times directly. 3 chops per soup at 3.0 s makes chopping the dominant cost of a soup, which is exactly why 1-1 tells you to pre-chop during prep and why 1-2's kitchen has two boards. |
| `POT_CAPACITY` | 3 | **3** | [Onion](https://overcooked.fandom.com/wiki/Onion)/[Tomato](https://overcooked.fandom.com/wiki/Tomato)/[Mushroom](https://overcooked.fandom.com/wiki/Mushroom): "3 Chopped X cooked into 1 soup" | **high** | Stated on three separate pages. |
| `COOK_TIME` | 9 | **9** | estimate | low | The wiki describes the green progress bar but gives no duration. 9 s is defensible: a full soup cycle is then 3 chops (9 s) + cook (9 s) + pour + walk ≈ 25 s solo, so 1-1's 3-soups-for-3-stars is reachable in 2:30 with prep, and 1-2's 4 soups in 4:00 is comfortable. Anything in **8–15 s** is consistent with every OC1 star threshold — the thresholds are too generous to pin it down. Prefer the low end so the burn window is the tense part, not the wait. |
| `BURN_TIME` | 10 | **13** | [Burnt food](https://overcooked.fandom.com/wiki/Burnt_food) | **med** | The page gives three stages after the green check mark: "5-ish seconds" quiet, "another 5-ish" of beeping, "another 3-ish" of fast beeping, then burnt. 5+5+3 = 13. Use it as three visible warning stages at 5/10/13 s so the HUD can escalate the way the game does. |
| `WASH_TIME` | 2.0 | **2.0** | estimate | low | No wiki number. Must be clearly shorter than `CHOP_TIME` — [1-1](https://overcooked.fandom.com/wiki/1-1_(Overcooked!)) and [3-4](https://overcooked.fandom.com/wiki/3-4_(Overcooked!)) both advise washing "as soon as they pop in", which only works if a wash is a quick interruption. |
| `PLATE_RETURN_DELAY` | 8 | **6** | [Plate](https://overcooked.fandom.com/wiki/Plate): "after a few seconds the plate is returned in the Plate Return" | low-med | "A few seconds" argues for something under 8. 6 keeps 1-1's two-plate squeeze real without stalling the loop. |
| `PLATE_STACK_RETURN_DELAY` | 6 | **6** | same page | low | The wiki draws **no** distinction between sink and no-sink levels for the return delay — the difference between the modes is that one comes back dirty ([Sink](https://overcooked.fandom.com/wiki/Sink): "some kitchens remove them and Dirty dishes to reduce the kitchen's difficulty"). Keeping both delays equal is the faithful reading. |
| `FIRE_SPREAD_TIME` | 6 | **6** | estimate | low | The wiki confirms fire spreads to adjacent stations but gives no rate. 6 s means a two-player kitchen can contain a fire if someone reacts immediately, which is the intended tension. |
| `EXTINGUISH_RATE` | 1.2 | **1.2** | estimate | low | With fire health 1.0 this is ~0.83 s of spray per fire. Must be fast enough that clearing two fires plus re-potting fits inside the 13 s before the next pot burns. |
| `SPRAY_RANGE` | 2 | **2** | estimate | low | Must exceed 1 tile: in 1-1 the extinguisher counter and the burner are not adjacent, so a 1-tile spray would make the level's own fire tutorial unwinnable. |
| `ORDER_FAIL_PENALTY` | 10 | **10** | estimate | low-med | Half a soup. [Combos](https://overcooked.fandom.com/wiki/Combos) makes the real cost of a failed order the broken tip streak, not the points. A full-dish penalty would put 1-1's 1★ at 10 points out of reach after two mistakes. Floor the score at 0. |
| `TIP_BASE` | 2 | **2** | estimate | low | [Combos](https://overcooked.fandom.com/wiki/Combos) confirms tips scale with a combo counter but gives no amount. +2 per consecutive clean serve keeps the star maths in `oc1-levels.md` intact. |
| `TIP_MAX` | 8 | **8** | estimate | low | Caps the bonus at 40% of a soup. The wiki names combo tiers up to "Tip Combo 9x", so the counter runs high; capping the *payout* rather than the counter keeps 4-serve streaks worth chasing without breaking thresholds. |
| `TIMER_WARNING_AT` | 30 | **30** | estimate | low | Pure presentation. No wiki support. |

---

## Combo / tip rules the sim must implement

`SimState.tipStreak` already exists. From [Combos](https://overcooked.fandom.com/wiki/Combos),
which states all three conditions explicitly, the streak **resets to 0** when any of these
happen:

1. an order expires;
2. a dish is served **out of order** — i.e. it does not match the *oldest* live order;
3. a dish not on the current menu is served.

And increments only on a serve that matches the oldest live order. This is the rule most
Overcooked clones get wrong: serving the second ticket while the first is still waiting is a
**legal, scoring serve that breaks the combo**. Score it, then reset `tipStreak`.

Tip applied on a clean serve: `min(TIP_MAX, TIP_BASE * (tipStreak - 1))`, so the first serve
of a streak pays base score only.

---

## Recipe scores (`src/sim/recipes.ts`)

Keep all three soups at **score: 20**. Confidence **high** — 1-1 serves only onion soup, has
one pot and 2:30, and puts 3 stars at 60 points; 1-2's 1P 3★ is 80 and 1-3's is 100. Every
world-1 soup threshold is a clean multiple of 20. See `oc1-recipes.md`.

---

## Per-level values the level JSON needs

Star thresholds are in `oc1-levels.md`. For 1-1/1-2/1-3, the schema's `orders` block has no
wiki source at all — these are estimates that make the star thresholds achievable:

| Level | `timeLimitSec` | `timerStartsOnFirstServe` | `plates` | `orders` | `stars` |
|---|---|---|---|---|---|
| 1-1 | 150 | **true** | `{mode:'sink', count:2}` | `{initial:1, intervalSec:14, max:3, timeSec:60}` | `{"1":[10,40,60], "2":[10,40,60]}` |
| 1-2 | 240 | false | `{mode:'sink', count:2}` | `{initial:2, intervalSec:12, max:4, timeSec:60}` | `{"1":[20,60,80], "2":[20,60,150]}` |
| 1-3 | 240 | false | `{mode:'stack', count:3}` | `{initial:2, intervalSec:12, max:4, timeSec:60}` | `{"1":[40,80,100], "2":[?,?,200]}` |

Confidence: `timeLimitSec`, `timerStartsOnFirstServe`, `plates` and `stars` are **high**
(straight from the level infoboxes and star charts, except 1-3's 2P 1★/2★ which the wiki
never published). The whole `orders` block is **low** — the wiki says nothing about order
cadence, concurrency or timeout anywhere. Sanity check by playing: 1-1 should feel just
barely doable for 3 stars with two players.

---

## Constants worth adding (additive, none exist yet)

| Proposed constant | Value | Source | Confidence |
|---|---|---|---|
| `FALL_PENALTY_SEC` | 5 | Stated identically on [2-1](https://overcooked.fandom.com/wiki/2-1_(Overcooked!)), [3-1](https://overcooked.fandom.com/wiki/3-1_(Overcooked!)), [3-3](https://overcooked.fandom.com/wiki/3-3_(Overcooked!)), [3-4](https://overcooked.fandom.com/wiki/3-4_(Overcooked!)) | **high** — only needed if world 2/3 levels are ever built |
| `TRASH_RESPAWN_SEC` | 5 | [Trash Bin](https://overcooked.fandom.com/wiki/Trash_Bin): cookware trashed by a conveyor "respawn after 5 seconds in the place where they were initially found" | **high** — only needed with conveyors |
| `CHOP_TIME_SOLO_MULT` | 1.5 | [Chopping](https://overcooked.fandom.com/wiki/Chopping): "Chopping is slower in Singleplayer Mode in all *Overcooked!* games" — no number given | low; the multiplier is an estimate, the fact is not |
| `DOUBLE_CHOP_MULT` | 2.0 | [Chopping](https://overcooked.fandom.com/wiki/Chopping): "If two Chefs chop at the same time, the chopping will become faster" — no number given | low; out of scope for the first playable, but note it if a second chef can ever join a board |

---

## Rules the constants file cannot express, but the sim must honour

From `oc1-mechanics.md`, the OC1-specific behaviours most likely to be missed:

1. **A burner rejects a plate, an unchopped ingredient, or a fire extinguisher** — the chef
   is physically pushed away. ([Burner](https://overcooked.fandom.com/wiki/Burner))
2. **A plate cannot be put back on a sink once picked up**, and in OC1 you cannot plate food
   onto a plate that is sitting on a sink. ([Sink](https://overcooked.fandom.com/wiki/Sink),
   [Plate](https://overcooked.fandom.com/wiki/Plate))
3. **Pot → plate and plate → pot both work.** Pouring a pot onto a plate and scooping a pot
   with a plate are both real OC1 actions. ([1-1](https://overcooked.fandom.com/wiki/1-1_(Overcooked!)),
   [3-2](https://overcooked.fandom.com/wiki/3-2_(Overcooked!)))
4. **Pots can be carried off burners**, ingredients loaded elsewhere, and put back.
   ([3-2](https://overcooked.fandom.com/wiki/3-2_(Overcooked!)),
   [5-6](https://overcooked.fandom.com/wiki/5-6_(Overcooked!)))
5. **A partly-filled pot on a lit burner still burns** — 1-2 tells you to take pots off the
   burner when you do not have a full soup cooking.
   ([1-2](https://overcooked.fandom.com/wiki/1-2_(Overcooked!)))
6. **Serving a clean plate with no food is allowed** and returns the plate dirty.
   ([Plate](https://overcooked.fandom.com/wiki/Plate))
7. **Plates and pots cannot be thrown in the trash.**
   ([Trash Bin](https://overcooked.fandom.com/wiki/Trash_Bin))
8. **In OC1 fire lives on stations only** — it never blocks a walkable tile. A burning stove
   cannot cook, but a burning counter can still be chopped at and taken from.
   ([Fire](https://overcooked.fandom.com/wiki/Fire))
