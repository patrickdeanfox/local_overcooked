# Overcooked! 2 — roadmap notes for this codebase

How I would add OC2 to `local_overcooked` after the OC1 first-playable lands. Every step below is
**additive** against the contracts in `CLAUDE.md`: new optional fields, new union members, new LEGEND
keys. Nothing renames or removes an existing member.

Read alongside `oc2-mechanics.md` (what the features are) and `oc2-recipes.md` (what the recipes need).

Effort scale: **S** ≈ half a day of agent work, **M** ≈ 1–2 days, **L** ≈ 3+ days or a dedicated agent.

---

## 0. TL;DR ordering

| # | Step | Effort | Unlocks |
|---|---|---|---|
| 1 | Multi-ingredient plates + a wider `IngredientType` | S | OC2 Tutorial, 1-1 |
| 2 | Generic crate char + `stations` ingredient overrides | S | every OC2 level's crates |
| 3 | Throwing | M | nothing new by itself; required by every split-kitchen level |
| 4 | Dashing | S | quality-of-life; required by 4-1, 4-3 |
| 5 | Cookware variants on the burner (pan, steamer, basket) | M | 1-2, 1-3, 2-1, 2-4, 5-2 |
| 6 | Per-ingredient prep chains in `Recipe` | L | Pasta, Burrito, Burger, Fast Food |
| 7 | Oven + Mixer as new tile types | M | Pizza, Pancake, Cake, Steamed Food, all Kevin levels |
| 8 | Conveyor belts and conveyor floors | M | 1-4, 4-1…4-6, 6-1, 6-3, 6-5, Kevin 6, Kevin 8 |
| 9 | Tip-combo scoring + 4th star | S | correct OC2 scoring everywhere |
| 10 | Portals | S | 3-2, 3-4, 5-4, 6-6 |
| 11 | Moving / sinking / steerable platforms | L | 1-5, 2-1…2-3, 3-5, 3-6, 5-1, 5-3, 5-5, 6-2, 6-5, Kevin 3, Kevin 7 |
| 12 | Floor fire | S | 1-6, 4-6, 5-2, 6-1, Kevin 4 |
| 13 | Wind, cars, rotators | M | 4-1, 4-4, 2-6, 3-3, Kevin 2, Kevin 5 |
| 14 | Level phases (dynamic levels) | L | 1-6, 3-6, 5-6, 6-6 |

---

## 1. Multi-ingredient plates and a wider ingredient set — **S**

OC1's model is "pot of three identical chopped things". OC2's simplest dishes are "chopped things put
straight on a plate". This is the smallest possible OC2 beachhead and it makes two levels playable.

**`src/sim/types.ts`**

```ts
// widen the union — additive
export type IngredientType =
  | 'onion' | 'tomato' | 'mushroom'                      // OC1
  | 'fish' | 'prawn' | 'rice' | 'nori' | 'cucumber'      // OC2 world 1
  | 'lettuce' | 'pasta' | 'beef' | 'chicken' | 'potato'
  | 'tortilla' | 'bun' | 'cheese' | 'dough' | 'pepperoni'
  | 'flour' | 'egg' | 'honey' | 'chocolate' | 'carrot';

// Dish gains a second shape; 'soup' keeps working untouched
export interface Dish {
  type: 'soup' | 'plated';   // 'plated': ingredients assembled directly on the plate
  ingredients: IngredientType[];
}
```

`INGREDIENT_TYPES` grows with it. `PlateItem` needs no change — `dish` already holds an ingredient list;
the sim just needs to allow adding a chopped ingredient to a plate that is not holding a soup.

**`src/levels/schema.ts`** — no change.

**`src/sim/recipes.ts`** — add `sashimi_fish`, `sashimi_prawn`, `salad_lettuce`, `salad_tomato`,
`salad_full`. Scores are estimates; see `oc2-recipes.md` §4.

Unlocks: **OC2 Tutorial** and **1-1**, both playable end-to-end with the schema exactly as it is today.

---

## 2. Generic crate char + `stations` ingredient overrides — **S**

The legend gives one char per crate ingredient (`O` `T` `M`). OC2 has 22 ingredients; single ASCII
characters run out and the grid stops being readable.

**`src/levels/schema.ts`**

```ts
export const LEGEND = Object.freeze({
  // …existing…
  'C': { type: 'crate' },   // ingredient MUST be set by a stations override
});
```

`StationOverride.ingredient` already exists, so a level writes `C` in the grid and one `stations` entry
per crate. `validateLevel()` gains one rule: every `crate` tile must end up with an `ingredient`.

This keeps grids legible (`C` reads as "a crate" at a glance) and scales to any ingredient count without
touching the legend again.

---

## 3. Throwing — **M**

The highest-value single mechanic. Every mid-campaign OC2 level's cooperation plan is "chop on one
side, throw to the other", and several levels (3-4, 3-5, 2-1) have gaps that *only* a throw crosses.

**`src/sim/types.ts`**

```ts
export interface PlayerInput {
  // …existing…
  throwPressed?: boolean;   // rising edge: throw the held item
}

export interface FlyingItem {
  id: number;
  item: Item;
  x: number; y: number;     // tile units, chef-style centre coords
  vx: number; vy: number;   // tiles per second
  thrower: number;          // chef index, so you cannot catch your own throw instantly
}

export interface SimState {
  // …existing…
  flying?: FlyingItem[];    // optional so OC1 snapshots stay byte-identical
}

// SimEventType gains: 'throw' | 'catch' | 'throwLand'
```

Rules to implement, all sourced in `oc2-mechanics.md` §2:

- Throwable: ingredients, cookware contents, assembled unplated food. **Not plates.**
- Direction = chef facing (support diagonals if the input layer gives them).
- Flight resolves against: a chef with free hands → catch; a cookware item that accepts the ingredient
  → goes in; a trash tile → destroyed; a free counter → lands on it; otherwise → floor.
- Solid walls stop it; a `void` tile that is a "gap" should let it pass (needs a distinction —
  see step 11).

**`src/sim/constants.ts`** — `THROW_SPEED`, `THROW_RANGE`, `CATCH_RADIUS`. All estimates; the wiki
gives no numbers. Start at `THROW_RANGE = 3.5` tiles.

---

## 4. Dashing — **S**

**`src/sim/types.ts`**

```ts
export type ChefAction = 'idle' | 'walking' | 'chopping' | 'washing' | 'extinguishing' | 'dashing';

export interface Chef {
  // …existing…
  dashCooldown?: number;   // seconds remaining; 0/undefined = ready
}

export interface PlayerInput {
  dashPressed?: boolean;
}
```

**`src/sim/constants.ts`** — `DASH_SPEED`, `DASH_TIME`, `DASH_COOLDOWN = 0.6` (the wiki says "just
above half a second"; that is the only real number OC2 gives for dashing).

Also implement: dash bumps other chefs and knocks a held item loose, and a dash-then-throw travels
further. Both are wiki-confirmed on the [Dash](https://overcooked.fandom.com/wiki/Dash) page.

---

## 5. Cookware variants on the burner — **M**

The wiki's [Burner](https://overcooked.fandom.com/wiki/Burner) page says a burner takes a pot, a pan or
a steamer. That maps perfectly onto the existing `stove` tile — no new tile type needed for three of
OC2's five cooking stations.

**`src/sim/types.ts`** — one optional field on `PotItem`:

```ts
export interface PotItem {
  kind: 'pot';
  ware?: 'pot' | 'pan' | 'steamer' | 'basket';  // default 'pot' → OC1 unchanged
  // …existing fields…
}
```

Adding a field beats adding a `CookwareItem` union member: it leaves every existing `item.kind === 'pot'`
check working, and the renderer only has to branch on `ware` for the sprite.

**`src/levels/schema.ts`** — new legend chars for pre-placed cookware, plus a `fryer` tile:

```ts
'S': { type: 'stove', item: 'pot' },     // existing
'Q': { type: 'stove', item: 'pan' },     // burner with a pan
'Y': { type: 'stove', item: 'steamer' }, // burner with a steamer
'F': { type: 'fryer', item: 'basket' },  // deep fryer + frying basket
```

`makeItem` gains a `ware` argument. `TileType` gains `'fryer'` and it joins `SOLID_TILES`.

The `basket` is worth keeping distinct from a pan because the wiki notes baskets cannot pour into other
cookware — that is a real behavioural difference, not a skin.

Unlocks (in combination with step 6): 1-2, 1-3 (pot/rice), 2-1 (fryer), 2-4 (pot + pan), 5-2 (pan).

---

## 6. Per-ingredient prep chains — **L**

This is the actual redesign. OC1: chop everything the same way, dump three into a pot. OC2: each
ingredient in a recipe has its own chain (`beef → chop → fry`, `rice → boil`, `bun → nothing`) and the
plate is the join. `oc2-recipes.md` §2 has every chain.

**`src/sim/types.ts`**

```ts
export type PrepStep = 'chop' | 'boil' | 'fry' | 'deepFry' | 'bake' | 'mix' | 'steam';

export interface IngredientItem {
  kind: 'ingredient';
  // …existing chopped/chopProgress stay, they are the OC1 fast path…
  prep?: PrepStep[];     // steps completed so far, in order
}
```

`chopped: true` and `prep: ['chop']` mean the same thing; keep both so OC1 code paths are untouched and
have the sim write both when it chops.

**`src/sim/recipes.ts`**

```ts
export interface Recipe {
  id: string;
  name: string;
  ingredients: IngredientType[];
  score: number;
  steps?: Partial<Record<IngredientType, PrepStep[]>>;  // required chain per ingredient
  assembleIn?: 'plate' | 'mixer' | 'dough';             // where the ingredients join
  finish?: PrepStep;                                    // step applied to the assembly (bake/steam/fry)
}
```

`dishMatchesRecipe` then compares *(ingredient, completed chain)* pairs instead of bare ingredient
multisets. That is the one function every OC2 recipe hangs off.

Three assembly shapes to support (`oc2-mechanics.md` §6):

- **plate** — Sashimi, Sushi, Salad, Fast Food, Pasta, Burrito, Burger.
- **mixer then a second appliance** — Pancake (mix → fry), Cake (mix → bake), Steamed Food (mix → steam).
- **dough as the carrier** — Pizza: chop all, assemble onto the dough, bake the assembly, plate it.

Pizza is the odd one and I would defer it: it needs a carrier item that is neither a plate nor cookware.

---

## 7. Oven and Mixer tiles — **M**

**`src/sim/types.ts`** — `TileType` gains `'oven' | 'mixer'`. Both are solid.

**`src/levels/schema.ts`**

```ts
'A': { type: 'oven' },    // bAke
'Z': { type: 'mixer' },
```

The mixer needs its own failure mode, which is *not* fire: leave contents in too long and the mixer
breaks permanently for the rest of the level
([Mixer](https://overcooked.fandom.com/wiki/Mixer)). Model it as a tile flag rather than a fire:

```ts
export interface Tile {
  // …existing…
  broken?: boolean;   // mixer only: overrun, unusable for the rest of the level
}
```

New `SimEventType` members: `'mixStart' | 'mixDone' | 'mixerBroke' | 'bakeStart' | 'bakeDone' | 'steamDone'`.

Unlocks: Pizza (3-1, 3-3), Pancake (5-4), Cake (6-1) and **all eight Kevin levels**, which use exactly
board + mixer + steamer and nothing else exotic.

---

## 8. Conveyor belts and conveyor floors — **M**

Two distinct mechanics on the wiki: a **Conveyor Belt** is a counter that moves items along it; a
**Conveyor Floor** is walkable ground that moves chefs.

**`src/sim/types.ts`** — `TileType` gains `'conveyor' | 'conveyorFloor'`. `Tile` gains:

```ts
export interface Tile {
  // …existing…
  dir?: Facing;      // conveyor direction
  speed?: number;    // tiles per second; the wiki says belt speed varies per level
}
```

**`src/levels/schema.ts`** — a new dynamic for button-flippable belts, mirroring the existing `sliders`
shape:

```ts
| {
    type: 'conveyors';
    group: string;            // matches Tile.group
    dir: Facing;
    speed: number;
    reverseEverySec?: number; // 4-3 flips every 30 s
    toggledBy?: string;       // button group; 4-5 and 6-3 flip belts with buttons
  }
```

Plus a `'button'` TileType with a `group`, and `PlayerInput.pickupPressed` doubling as the press
(that is how the real game does it —
[Button](https://overcooked.fandom.com/wiki/Button)).

The important rule: a belt that ends in a trash tile destroys anything on it, and destroyed cookware
and plates **respawn at their original tile after 5 seconds** keeping their clean/dirty state
([Trash Bin](https://overcooked.fandom.com/wiki/Trash_Bin)). `SimState.pendingPlateReturns` already
exists as a list of countdowns; generalise it to `pendingRespawns: { sec, x, y, item }[]` as a new
optional field.

---

## 9. Tip combo and the 4th star — **S**

OC2 changed the tip rule. OC1 tips are a streak of on-time serves. OC2 requires **serving the tickets
in the exact order they appear**; failing an order or serving an off-menu dish breaks the combo
([Combos](https://overcooked.fandom.com/wiki/Combos)).

**`src/levels/schema.ts`**

```ts
export interface OrderSettings {
  // …existing…
  strictOrder?: boolean;   // OC2: the combo only holds if you serve oldest-first
  sequence?: string[];     // 6-6 is fully scripted; also 1P preset orders
}

export interface LevelDef {
  // …existing…
  stars4?: { 1: number; 2: number; 3?: number; 4?: number };  // OC2's fourth star
  players?: { 3?: LevelStars[1]; 4?: LevelStars[1] };          // 3P/4P thresholds
}
```

**`src/sim/types.ts`** — `SimState.tipStreak` already exists and is the combo counter; add
`comboMultiplier?: number` if the HUD wants to show "×4" separately. `SimState.stars` becomes 0..4;
that is a value-range change, not a type change.

`oc2-levels.md` has 2P thresholds for all 44 levels; the wiki pages have 1P/3P/4P.

---

## 10. Portals — **S**

**`src/sim/types.ts`** — `TileType` gains `'portal'`; the pairing goes in the existing `Tile.group`
(two tiles sharing a group are linked). A chef stepping on one comes out at the other; **thrown items
also pass through** ([6-6](https://overcooked.fandom.com/wiki/6-6_(Overcooked!_2))), so the flying-item
step from §3 has to check portals too.

5-4's moving portal needs step 11; the fixed pairs in 3-2, 3-4 and 6-6 do not.

---

## 11. Moving, sinking and steerable platforms — **L**

The single biggest bucket of OC2 level tech, and where the current schema's tile grid gets stretched.
The existing `sliders` dynamic moves a *group of counters*; OC2 needs to move *regions of floor* that
chefs stand on.

Proposed additive `Dynamic` members:

```ts
| { type: 'platform'; group: string; path: { x: number; y: number }[]; periodSec: number; phase?: number }
| { type: 'sinking'; group: string; upSec: number; downSec: number; phase?: number }   // 6-2, 6-5
| { type: 'steerable'; group: string; control: { x: number; y: number }; axis: 'x' | 'y' | 'xy'; speed: number; bounds: … }  // 5-1, 5-3, 5-5, 6-4
| { type: 'rotator'; group: string; center: { x: number; y: number }; periodSec: number; steps: number }  // 2-6, Kevin 2
```

Each needs a `group` on the tiles it moves, which `Tile.group` already provides.

Two prerequisites the current schema lacks:

1. **Gap vs wall.** `void` is currently "outside the kitchen, solid". OC2 needs a `'gap'` tile: not
   walkable, but throwable-over and fall-into-and-respawn. Add `TileType 'gap'` and a
   `SimEvent 'chefFell'`; chefs respawn at their spawn tile
   ([5-6](https://overcooked.fandom.com/wiki/5-6_(Overcooked!_2))).
2. **Sub-tile tile positions.** Platforms move continuously, so tiles need a render offset. `SliderGroup`
   already carries `offsetX/offsetY` — reuse that structure for platform groups and the presentation
   layer gets it for free.

---

## 12. Floor fire — **S**

OC2's new hazard: flames that spawn on the *ground*, block chefs, expire on their own, and can be
extinguished early. Re-igniting on an existing flame resets its timer
([Fire](https://overcooked.fandom.com/wiki/Fire)).

**`src/sim/types.ts`**

```ts
export interface Fire {
  x: number; y: number; health: number;
  kind?: 'counter' | 'floor';   // default 'counter' → OC1 unchanged
  ttl?: number;                 // floor fire only: seconds until it goes out by itself
}
```

**`src/levels/schema.ts`**

```ts
| { type: 'floorFire'; intervalSec: number; durationSec: number; source?: { x: number; y: number }; region?: … }
```

1-6 and Kevin 4 shoot from a source point; 5-2, 6-1 and 4-6 spawn at random spots.

---

## 13. Wind, cars, rotators — **M**

- **Wind** (4-4, Kevin 5): lanes that push chefs *and* items; direction flips every ~13 s and opposing
  lanes always oppose. Shape it like the existing `pedestrians` dynamic (lanes + interval).
- **Cars** (4-1, Kevin 5): the existing `pedestrians` dynamic is already 90% of this — a moving solid
  that crosses `road` tiles. Cars differ in that they kill/stun rather than block, so add
  `lethal?: boolean` to the pedestrians dynamic and reuse it.
- **Rotators** (2-6, 3-3, Kevin 2): covered by the `rotator` dynamic in step 11.

Reusing `pedestrians` for cars is the single highest leverage line in this whole document — 4-1 and
Kevin 5 become mostly free.

---

## 14. Level phases (dynamic levels) — **L**

Four base levels change layout mid-run: 1-6 and 3-6 at 2:20 elapsed, 5-6 at 3:48 and 1:58 remaining,
6-6 when the burgers are delivered. Timings are in `oc2-mechanics.md` §7.

**`src/levels/schema.ts`**

```ts
export interface LevelPhaseDef {
  atSec?: number;          // elapsed seconds; mutually exclusive with `afterServed`
  afterServed?: number;    // 6-6 is progress-driven, not timed
  grid: string[];
  stations?: StationOverride[];
  items?: ItemPlacement[];
  recipes?: string[];      // 5-6 adds Fish & Prawn Pasta only in phase 3
  dynamics?: Dynamic[];
}

export interface LevelDef {
  // …existing…
  phases?: LevelPhaseDef[];
}
```

The hard part is not the schema, it is the sim: items sitting on a counter that vanishes need a defined
fate, and chefs standing on floor that becomes a gap need to be pushed or dropped. Do this last.

---

## 15. Cheapest OC2 levels to port with the schema as it stands today

Ranked by how little new machinery they need. "Today" means `LevelDef` exactly as it is in
`src/levels/schema.ts` right now: grid + legend + `sliders` + `pedestrians`.

| Rank | Level | Needs | Why it is cheap |
|---|---|---|---|
| 1 | **OC2 Tutorial (0-0)** | step 1 only | Salad = chop and plate. No sink, no obstacles, no cooking, 1:30. Flat rectangular room: two boards top-left/top-right, bin middle-left, three crates + two plates + plate return along the bottom. One small rectangular room. |
| 2 | **1-1** | step 1 only | Sashimi = one chop, one plate. No sink (plates return clean → `plates.mode: 'stack'`), no obstacles, prep-time timer (`timerStartsOnFirstServe: true`, already supported). Symmetric room, two crates, four boards in the bottom corners, four plates on two centre islands. |
| 3 | **1-3** | steps 1 + 5 (pot only) | Sashimi + Sushi. Adds boiled rice on a `stove` with a `pot` — the OC1 stove works unchanged, the only new thing is that boiled rice goes onto a plate instead of being a soup. Sink + plate return present, so `plates.mode: 'sink'` is exactly right. No dynamics at all. |
| 4 | **1-2** | steps 1 + 5 | Sushi, and its only obstacle is **pedestrians** — the dynamic the schema was already built for in OC1 1-2. Three crates in the middle, three boards top-left, one stove bottom-right, serve + return top-right, bin bottom-middle. `plates.mode: 'stack'`. |
| 5 | **1-5** | steps 1 + 5 + 6 | Pasta. Its "shifting platforms" reduce to two fixed rooms if you accept the balloons as static; the sliding three-board counter maps directly onto the existing `sliders` dynamic (`axis: 'y'`). Needs a pan for the sauce. |
| 6 | **2-5** | steps 1 + 5 + 6 | Burrito. The sliding crate counter is `sliders` with `axis: 'x'` — a one-line dynamic. Otherwise a plain left/right kitchen: pots + sink + boards left, serve + return + bin + pans right. |
| 7 | **5-2** | steps 1 + 5 + 6 (+ 12 for fires) | Burger. Two work stations around a ring corridor, no moving parts at all. Playable without floor fire; add fire later for fidelity. |
| 8 | **Kevin 4** | steps 1 + 5 + 6 + 7 | Steamed Food. A plain rectangle: return + three boards + serve on top, mirrored mixer/steamer columns left and right, five crates along the bottom. Once the mixer and steamer exist this is one of the most trivially griddable kitchens in the game — its only hazard is the central fireplace, which is floor fire (step 12) and can be omitted at first. |

Levels I would **not** attempt until steps 8–14 land: anything with conveyors (1-4, all of world 4,
6-1, 6-3, 6-5, Kevin 6, Kevin 8), portals (3-2, 3-4, 5-4), moving platforms (2-1, 2-2, 2-3, 3-5, 3-6,
5-1, 5-3, 5-5, 6-2, 6-5, Kevin 3, Kevin 7) or a phase change (1-6, 3-6, 5-6, 6-6).

---

## 16. Two decisions worth making early

1. **Player count.** OC2 is 1–4 players and every star chart is per player count. The current
   `LevelStars` is typed `{1: [...]; 2: [...]}`. If four players will ever matter, widen it now while it
   is cheap — the OC2 wiki data for 3P and 4P is already available on every level page.
2. **`void` vs `gap`.** Almost every OC2 kitchen has a hole you can throw over and fall into. Deciding
   that `void` stays "solid wall" and adding a separate `gap` tile is a one-line schema change today and
   an invasive one after twenty levels are written. Do it before step 3 (throwing), because throwing is
   the first feature that has to tell the two apart.
