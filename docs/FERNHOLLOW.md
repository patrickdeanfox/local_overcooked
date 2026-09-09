# Fernhollow

**A cozy co-op cooking game.** Two foxes run a tea-and-preserves cottage at the edge of the woods.

Overcooked's structure, Stardew's warmth. No fail states, no screaming, everything smells like jam.

Filed 2026-09-09 as the second theme idea for roadmap item 13, next to the Potion Shop map in `docs/THEME.md`. Sections 1 to 7 are the design as written; section 8 is how it fits the clone as built.

---

## 1. Design Pillars

1. **Nothing is ever lost.** Mistakes cost time and charm, never progress.
2. **The workspace is yours.** Decoration, gardening, and regulars make the cottage feel lived-in.
3. **Two hands are better than four.** Built for two players first; four is an expansion, not the baseline.
4. **The pressure is opt-in.** Perfectionists find real challenge. Everyone else potters.

---

## 2. Noun Map — Overcooked → Fernhollow

### Actors & World

| Overcooked | Fernhollow |
|---|---|
| Chef | Fox (Hazel, Bramble, Sorrel, Pip) |
| Onion King | Grandmother Vix |
| Kevin (dog) | The counter cat, Biscuit |
| Kitchen | Cottage kitchen |
| Restaurant | Fernhollow Tea Rooms |
| Customer | Guest (named villager) |
| Ticket | Order card pinned to the board |
| Order board | Chalkboard by the door |
| World map | Valley map, walked season by season |

### Stations

| Overcooked | Fernhollow |
|---|---|
| Cutting board | Chopping block |
| Stove + pot | Jam pot over the hearth |
| Fryer | Bread oven |
| Oven | Pie oven |
| Rice cooker / steamer | Kettle stand |
| Mixer | Butter churn |
| Counter | Worktop |
| Ingredient crate | Pantry shelf / garden beds |
| Plate return | Crockery dresser |
| Sink | Wash basin at the pump |
| Serving window | The counter (or table service) |
| Bin / trash | Compost heap |
| Fire extinguisher | Damp cloth (for the over-steeped kettle) |

### Objects

| Overcooked | Fernhollow |
|---|---|
| Plate | Tea tray |
| Dirty plate | Used tray with crumbs |
| Pot | Jam pot |
| Pan | Skillet |
| Chopped ingredient | Prepped ingredient |
| Cooked ingredient | Simmered / baked ingredient |
| Burnt food | Bitter batch (over-steeped, scorched) |
| Finished dish | Plated order |

### Ingredients (seasonal)

| Season | Produce |
|---|---|
| Spring | Rhubarb, nettle, early strawberry, chive, egg |
| Summer | Blackcurrant, honey, mint, plum, cream |
| Autumn | Apple, chestnut, mushroom, blackberry, squash |
| Winter | Preserved fruit, root vegetables, dried herbs, stored nuts |

Staples available year-round: flour, butter, sugar, oats, tea leaves.

### Recipes

| Overcooked | Fernhollow |
|---|---|
| Soup (3 chopped + boil) | Pot of soup (3 prepped + simmer) |
| Burger (bun + patty + toppings) | Sandwich (bread + filling + garnish) |
| Pizza (dough + toppings + bake) | Tart (pastry + fruit + bake) |
| Pancakes (batter + griddle) | Scones (dough + oven + cream) |
| Salad (chop only) | Fruit plate (prep only, no heat) |
| Sushi (rice + fish) | Preserves (fruit + sugar + jam pot + jar) |
| Burrito (wrap + fillings) | Picnic basket (multiple items, one vessel) |
| — | Pot of tea (leaves + kettle + steep timer) |

### Hazards & Events

| Overcooked | Fernhollow |
|---|---|
| Kitchen fire | Over-steeped kettle → bitter, must be dumped |
| Burning smoke | Steam fogging the windows |
| Rats stealing food | Magpies snatching from the windowsill |
| Moving platforms | Stepping stones across the brook |
| Conveyor belt | The dumbwaiter to the cellar |
| Ice floor | Frosted flagstones (winter levels) |
| Portals | Fox dens (see mechanics) |
| Trucks / boats | The market cart, the riverside punt |

### Scoring & Meta

| Overcooked | Fernhollow |
|---|---|
| Tips | Coin |
| 1–3 stars | 1–3 ribbons |
| Combo bonus | Regular's Usual bonus |
| Chef select screen | The fox family portrait |
| Unlockable chefs | Cousins who move into the valley |
| Cosmetics | Cottage furnishing, aprons, bunting |

---

## 3. Core Mechanics

### 3.1 The Shift

- A shift runs from opening bell to sunset — a **fixed real-time length**, roughly 4–6 minutes.
- Guests arrive over the shift. Orders appear on the chalkboard.
- The shift ends when the sun goes down. Whatever you finished is what you finished.

### 3.2 Orders Don't Expire

The single biggest departure from Overcooked.

- Guests wait indefinitely.
- Waiting guests move through visual states: alert → settled → dozing. A hedgehog who's waited a long time curls up and naps. It reads as endearing, not accusatory.
- **Patience affects the tip, not survival.** A dozing guest still gets served, still leaves happy, just pays less.
- No hard fail. No "restaurant closed down" screen. Ever.

### 3.3 The Bitter Batch (replacing fire)

- Leave the kettle or jam pot too long and it turns bitter — signalled by color shift and a soft hiss, not an alarm.
- Recovery: carry it to the compost heap, tip it out, start again.
- Cost is time and one ingredient. Nothing cascades. Nothing spreads.

### 3.4 Tail Carry

Foxes carry **two items**: one in the paws, one balanced on the tail.

- Tail item is slower to place (a small wind-up animation) but doubles effective trips.
- Pouncing or getting bumped while tail-carrying makes the item wobble; a second bump drops it.
- This is the main dexterity skill in the game and it looks charming when you're bad at it.

### 3.5 Dens

- Small burrow entrances connect distant corners of a level.
- Overcooked's portals, but you emerge with dirt on your nose and shake it off (0.4s recovery).
- Cannot be used while tail-carrying — forces a real choice between speed and load.

### 3.6 Pouncing

- The dash is a pounce: short hop, small arc, slight overshoot on landing.
- Lands in flour, jam, or a puddle → the fox is visibly stained for ~10 seconds. Purely cosmetic, purely delightful.
- Pouncing into a teammate makes both wobble. No damage, no dropped-everything punishment.

### 3.7 Guests and Regulars

- Guests are **named recurring villagers**, not anonymous tickets.
- Each regular has a Usual. Serving Badger his usual mushroom soup triggers a bonus and a line of dialogue.
- Some guests are time-locked: the owl only visits at dusk; the field mice only come in summer.
- Over a season you learn the regulars, which turns order-reading into recognition rather than parsing.

### 3.8 The Garden Phase

Between shifts, an **untimed** calm phase.

- Plant, water, harvest the garden beds that supply next shift's produce.
- Rearrange cottage furniture and station layout within limits.
- Talk to a villager who's stopped by.
- This is where the cozy lives. Protect it in tuning — it is the exhale.

### 3.9 Seasons

- Four seasons per year, each ~8–10 shifts.
- Season determines available produce, guest roster, and weather effects on levels.
- Season-end is a small event: a festival, a market day, a wedding. Higher volume, special recipes, no added punishment.

### 3.10 Scoring

Ribbons are awarded on **guests served happy**, weighted by:

- Orders completed
- Patience at time of service (dozing guests still count, worth less)
- Regular's Usual bonuses
- Cleanliness at close (crockery washed, compost emptied)

Speed is never scored directly. It only shows up as a side effect of serving more guests.

---

## 4. Levels

Levels are **places**, not escalating kitchens.

| Level | Gimmick |
|---|---|
| The Cottage | Tutorial layout, everything close |
| The Market Stall | Cramped, rain, tarp leaks onto one station |
| The Meadow Wedding | Long distances, table service, no counter |
| The Riverside Punt | Two boats, items passed across water |
| The Winter Cabin | Hearth must be fed logs or ovens cool |
| The Orchard | Ingredients picked live from trees, not the pantry |
| The Burrow Kitchen | Dens everywhere, dense tunnel routing |
| The Festival Green | Season finale, high volume, extra hands |

Difficulty comes from **terrain and weather**, never from conveyor belts or moving floors that fling you into a pit.

---

## 5. Two-Player Design

- Every level is sized for two. Four-player is a later widening, not the target.
- No level requires permanent splitting; the two foxes should be in sight of each other most of the time.
- **Shared carry:** a large item (the festival cauldron, the wedding cake) requires both foxes, moving at half speed. One set-piece per level, at most.
- Asymmetric roles emerge naturally (one gardens, one serves) but are never enforced.

### Scaling to Four

- Widen rooms, add a second counter.
- Add two more garden beds.
- Guest arrival rate scales with player count.
- Shared-carry items get a four-fox variant that's genuinely faster.

---

## 6. Progression

- **Coin** buys cottage furnishings, aprons, new station upgrades (a second kettle, a bigger oven).
- **Ribbons** unlock new levels and new cousins joining the family.
- **Recipes** unlock through seasons and through guest requests, not a shop.
- Nothing is gated behind a perfect score. Three ribbons is a goal, never a requirement.

---

## 7. Known Risks

- **Stakes-free after ~5 hours.** No-fail design is gentle on couch co-op but risks drifting. The seasonal goals and regulars have to carry long-term motivation — prototype this early.
- **Garden phase pacing.** The calm phase between shifts may drag on repeat plays. Prototype it as skippable / collapsible.
- **Crowded market.** Cozy co-op is a busy category right now (Ooblets, Spirittea, Wanderstop, Little Kitty Big City). Worth a market scan before committing production budget.
- **Readability.** Cottagecore palettes are soft and low-contrast by nature, which fights Overcooked's read-it-from-across-the-screen clarity. Ingredient silhouettes and saturation need deliberate work.

---

## 8. Fit against the clone as built (added 2026-09-09)

Fernhollow is a theme plus a redesign, where Potion Shop (`docs/THEME.md`) is a theme alone. The noun map in section 2 reskins cleanly; sections 3 to 6 change the sim, the scoring, the level set and the meta. The split, against the code on 2026-09-09:

**Straight reskin, same rules.** Fox for chef, cottage kitchen, chopping block, jam pot over the hearth, worktop, pantry shelf, crockery dresser, wash basin, the counter as the serving tile, compost heap, tea tray and used tray, jam pot and skillet, prepped and simmered, bitter batch for burnt, pot of soup, sandwich for burger, fruit plate for the plated dish, coin, ribbons, the family portrait. Pouncing is the dash with a cosmetic stain (presentation only).

**Already in the sim as assists** (`Modifiers` in `src/sim/types.ts`): orders that never expire (`ordersNeverExpire`), no burning (`noBurning`), instant cooking. A run with an assist on is not saved and earns no stars, so a Fernhollow mode would promote these from assists to the mode's defaults with their own progress. Section 7's first risk can be prototyped today by playing world 1 with the assists on and asking whether it drifts.

**Mechanics changes, none built:**
- Patience scaling the tip instead of a fail (3.2): the order timer stays, the expiry branch pays less instead of penalising; guest states are presentation on `Order.timeLeft`.
- The bitter batch without spread (3.3): keep the burnt state, skip the fire start. One branch in the burn step; the extinguisher and fire code go unused in the mode.
- Tail carry (3.4): `Chef.holding` is one item. A second slot with a placement wind-up and a wobble-then-drop on bump is a sim change through pickup, drop, throw and every interaction that reads `holding`.
- Dens (3.5): portals, roadmap item 5 step 10; plus the no-tail-carry rule.
- Named guests and Usuals (3.7): `Order` gains a guest; the Usual bonus is a second streak beside the tip combo; time-locked guests need the order generator to read the clock and the season.
- Garden phase (3.8): the sim has a `prep` phase before the clock starts, and nothing else. Planting, harvest, furniture and dialogue are a new system outside the sim.
- Seasons (3.9), scoring on guests served happy and cleanliness at close (3.10), shared carry (5), coin as a currency for furnishings and station upgrades (6): all new.
- Preserves (fruit + sugar in the jam pot) needs mixed-ingredient pots; today a pot takes three of one kind. Pot of tea is the pot rule with one ingredient and a steep timer that goes bitter, so it is close.

**Levels.** Section 4 replaces the Overcooked catalog with eight designed places, so it drops roadmap item 5 (the remaining 66 levels) rather than reskinning it, and rules out conveyors and gaps. The Riverside Punt is the split deck the clone already has (OC1 3-2 plus throwing); the Winter Cabin's log-fed hearth and the Orchard's live picking are new station rules.

**Readability.** Section 7's last risk is the same constraint the Potion Shop map records: keep the produce colours as distinct as the original ingredients, and keep the used-tray stack a clear read.
