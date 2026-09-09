# Mechanics additions

Five additions that slot into the existing verb set (pick up, drop, chop, wash, throw, dash) without new inputs or new player states. Each one is a switch on the Settings page (`Settings.mechanics`), off by default, so the shipped kitchens and their star thresholds are unchanged until a switch is on. Sections 1 to 8 are the design as specified on 2026-09-09; section 9 is how it maps onto the code.

## 1. Two-plate carry

A chef can hold two clean plates at once.

- The second plate can only be picked up from the clean plate dresser or return rack, not from an arbitrary counter. This prevents plate-hoovering across the kitchen.
- Plates place one at a time; the top plate goes down first.
- Cannot dash while holding two. This is the entire cost; no separate speed penalty.
- Cannot pick up a second plate if the first already has food on it.

Why: long-walk levels punish plate logistics disproportionately. This softens that without touching cook times.

Failure mode to watch: players hoarding both plates during a rush, starving the other chef. Mitigated by the dresser-only rule.

## 2. Chop assist

A second chef at the same prep station halves the remaining time on the current action.

- Applies to any timed prep station: cutting board, mixer, rolling pin, any future equivalent.
- Effect is on remaining time, not total; joining at 80% done still helps, just less.
- Does not stack beyond two chefs.
- Does not apply to passive cook stations (pot, pan, oven). Those are unattended by design and speeding them breaks burn timing.

Why: Overcooked has almost no reason for two chefs to occupy the same tile. This makes proximity a tactic instead of a collision.

Failure mode to watch: flattens split-kitchen levels where players are separated by design. Verify it does not trivialise the hardest existing stages.

## 3. The tray

Carry three items in one trip.

- The tray is a physical object living on a rack. Someone has to go get it.
- Holds 3 items of any type (raw, chopped, cooked, plated).
- Cannot dash while carrying.
- About 25% movement speed penalty.
- Wind-up on both pickup and put-down (about 0.5 s each): you commit to using it.
- Bumping a tray carrier makes items wobble; a second bump within the wobble window drops one item.

Why: a genuine speed/throughput trade-off. On short-route levels the tray is a trap; on long-route levels it is essential. Same object, opposite value, decided by level design.

Failure mode to watch: if the tray rack is too close to the ingredient crates, the tray becomes strictly correct and stops being a decision. Rack placement is a level-design lever, not a global constant.

## 4. Pass-through shelf

A waist-high gap in a wall. Items placed on it are reachable from both sides.

- Acts as a normal counter surface, accessible from two rooms.
- Not throwable-through. You place and the other chef takes. No physics.
- Holds one item at a time; a wide variant holds three.
- Chefs cannot pass through it.

Why: the cheapest possible level-design tool of the five. Turns a hard wall into a soft one, letting designers create near-split kitchens that are still cooperative.

Failure mode to watch: functionally overlaps with the tray (both reduce trips). Probably should not feature both prominently on the same layout.

## 5. The 86 system

Ingredients run out; orders rewrite around the shortage.

### 5.1 Core loop
- Every ingredient crate has a finite count, shown as a visible fill level (full, half, low, empty).
- Taking the last item empties the crate and posts a chalk "86" mark above it.
- All pending tickets requiring that ingredient rewrite in place to the nearest valid substitute.
- Restock arrives via a delivery crate at a door, on a timer.

### 5.2 Substitution rules
- Never void a ticket. If an ingredient is unavailable, the ticket substitutes. It does not disappear and it does not become impossible.
- Substitution targets the nearest valid ingredient in the same prep class (chopped to chopped, cooked to cooked) so prep already done stays relevant where possible.
- Grandfathering: partially built dishes using the now-86'd ingredient still serve correctly against the original ticket. You are never punished for work already completed.
- Cap simultaneous 86s at 2. Beyond that the board becomes unreadable noise.
- Ingredients that appear in every recipe on a level (the "bread" of that stage) are exempt or have much deeper crates.

### 5.3 Feedback
The core risk is a player building from muscle memory after a rewrite. Feedback must be loud: the rewritten ticket flashes for about 2 seconds; a distinct audio sting, different from the new-order sound; the changed ingredient icon animates the swap rather than hard-cutting; the 86 chalk mark persists above the empty crate until restock.

### 5.4 Restock
- A delivery crate spawns at a designated door on a timer.
- Unloading takes about 4 seconds and occupies both hands.
- Unloading can be chop-assisted (section 6).
- This is the new "washing dishes" role: unglamorous, mandatory, and the reason someone yells.

### 5.5 Why this earns its place
The order board is currently read once. After the first glance, tickets are static and players stop looking up. The 86 system makes the board live, which means someone has to be watching it: a soft information role without a new mechanic to perform.

## 6. Cross-mechanic interactions

| Pair | Interaction |
|---|---|
| Two-plate + 86 | Direct tension. Two-plate rewards committing to a route in advance; 86 punishes it. Needs playtesting before being called a feature. |
| Tray + 86 | Same tension, amplified. Three items pre-loaded for a ticket that just rewrote. Consider whether tray items can be swapped in place at a counter. |
| Tray + pass-through shelf | Functional overlap; both reduce trips. Avoid featuring both heavily on one layout. |
| Chop assist + restock | Assist applies to crate unloading. Two chefs unload in about 2 s. Gives the restock role a partner. |
| Chop assist + tray | No interaction. |
| Two-plate + tray | Mutually exclusive by hand occupancy. No rule needed. |
| Pass-through shelf + 86 | The shelf becomes the natural place to stage substitutable prep. Good synergy, no changes needed. |

## 7. Tuning reference

| Knob | Range | Notes |
|---|---|---|
| Tray movement penalty | 20 to 30% | Below 20% the tray is always correct |
| Tray wind-up | 0.4 to 0.6 s each way | The commitment cost |
| Chop assist multiplier | 2x remaining | Never 3x for three players |
| Crate size | 4 to 12 items | Small is frantic, large is background texture |
| Restock delay | 20 to 45 s | Shorter on levels with few crates |
| Max simultaneous 86s | 2 | Hard cap |
| Restock unload time | 4 s solo, 2 s assisted | Both hands occupied |
| Ticket rewrite flash | 2 s | Plus audio sting |

Per-level dials: crate size is the main difficulty lever for the 86 system (do not scale restock delay and crate size in the same direction on the same level); tray rack placement decides whether the tray is a tool or a trap; 86s can be play-driven or scripted (scripted for tutorial and early levels, play-driven for later ones and endless modes).

## 8. Open questions

- Does two-plate carry make plate-starvation levels trivial? Test against the existing hardest dish-pressure stages.
- Should tray items be swappable in place, or must the tray be emptied to change loadout?
- Does chop assist need a visual sync animation, or is a speed-up bar enough?
- Should the 86 chalk mark be readable from across the screen, or is the crate fill level sufficient? Probably both.
- Is there a case for a voluntary 86, a chef marking a crate as reserved? Adds communication depth but also an input.

Recommended prototype order: pass-through shelf, chop assist, two-plate carry, 86 system, tray.

## 9. How it maps onto the code

Contracts changed additively on 2026-09-09; every consumer is listed so an arm can find its work.

### Switches
`Modifiers` in `src/sim/types.ts` gained `twoPlateCarry?`, `chopAssist?`, `tray?`, `passThroughShelf?`, `eightySix?` (booleans). `Settings.mechanics` (`src/game/settings.ts`, `Mechanics`, `MECHANIC_IDS`, `MECHANIC_NAMES`, `NO_MECHANICS`) holds the player's choice; `presetModifiers()` merges `mechanicModifiers()` into the run's modifiers, so `GameScene` needs no change. `isAssisted()` ignores them: a run with mechanics on is saved and earns stars. `EffectiveSettings` carries the five flags so the renderer can read them through `sim.getEffectiveSettings()`.

Off means the kitchen as it shipped. Level content degrades to that: a `shelf` tile is a solid wall, a `trayRack` is an empty counter, crates never run out and the `delivery` tile is a solid tile that does nothing.

### Tiles, legend, items
| Thing | Sim type | Legend | Notes |
|---|---|---|---|
| Pass-through shelf | `TileType 'shelf'` | `h` | Solid. On: a placeable counter reachable from any adjacent floor tile; a thrown item stops at it and drops in front of it (never lands on it). Off: solid wall, no interaction. The wide variant is three adjacent `h` tiles. |
| Tray rack | `TileType 'trayRack'` | `t` | Solid, placeable counter. The legend puts a `tray` item on it; the sim removes that item at construction when the mechanic is off. |
| Delivery door | `TileType 'delivery'` | `d` | Solid, never a counter. At most one per level. On: deliveries appear here and are unloaded with held interact. A level with the 86 switch on but no door restocks by itself when the delivery is due. |
| Tray | `TrayItem { kind: 'tray', items: TrayLoad[] }` | (on the rack) | `TrayLoad` is an `IngredientItem` or a `PlateItem` with `count` 1. `items[items.length - 1]` is the top. |
| Crate stock | `Tile.stock?`, `Tile.capacity?` | | `stations[].stock` on a crate sets that crate's size (parsed into `capacity`). With the switch on the sim sets `stock = capacity ?? eightySix.crateSize ?? CRATE_SIZE` on every non-exempt crate; `stock === 0` is an 86. |
| 86 tuning | `LevelDef.eightySix?` | | `crateSize`, `restockDelaySec`, `exempt[]`, `scripted[] { atSec, ingredient }`. All optional; constants fill the gaps. |

Catalog extension characters (`docs/research/catalog/README.md`) are uppercase and stay reserved; the three new tiles use lowercase letters.

### Constants (`src/sim/constants.ts`)
`TWO_PLATE_MAX` 2, `ASSIST_RATE` 2, `TRAY_CAPACITY` 3, `TRAY_SPEED_SCALE` 0.75, `TRAY_WINDUP_SEC` 0.5, `TRAY_WOBBLE_SEC` 1.0, `CRATE_SIZE` 8, `RESTOCK_DELAY_SEC` 30, `RESTOCK_UNLOAD_SEC` 4, `MAX_SIMULTANEOUS_86` 2, `ORDER_REWRITE_FLASH_SEC` 2.

### Sim rules (`src/sim/index.ts`)
Two-plate carry: a chef holding one clean plate (`dish === null`, `count` 1) who presses pick-up on a `drying` or `plateStack` tile holding clean plates takes one more (`held.count` becomes 2, the rack loses one) instead of putting its plate down on the stack; with two in hand the same press puts one back. Placing a two-plate stack on any counter puts down one plate and keeps one. `addToPlate` and `emptyOnto` already refuse a plate whose `count` is not 1, so food cannot go on a two-stack until one plate is put down. `startDash` refuses while holding two plates or a tray. Off: the existing behaviour (a held clean plate joins the rack's stack).

Chop assist: progress on a board lives on the item, so two chefs holding interact at the same board already both add `dt / chopTime` each step. The switch makes that deliberate: on, the second chef's contribution counts (rate `ASSIST_RATE`, so remaining time halves) and it is marked `Chef.assisting`; a third does nothing. Off, the first chef to work a station in a step claims it and later chefs at the same tile that step stand idle, so a board is one chef's work. The same claim rule covers unloading a delivery. Sinks, pots and pans are untouched.

The tray: pick-up button (`pickupPressed`) with empty hands facing a tray: takes the top item, or starts the lift wind-up when the tray is empty. Interact (`interactPressed`) with empty hands facing a tray: starts the lift wind-up whatever the load. Holding the tray, pick-up facing a crate loads a new ingredient (stock permitting); facing a tile whose item is a `TrayLoad` loads it (one clean plate off a stack); otherwise, if the tray has items, the top item is offered to the tile exactly as if the chef held it (an empty counter or board takes it, a pot or pan takes an accepted ingredient, a plate on a counter takes a ready component, the serve takes a plated dish, the bin destroys it, a rack takes a clean plate); an empty tray facing an empty counter starts the set-down wind-up. Interact while holding the tray facing an empty placeable counter starts the set-down wind-up. The wind-up pins the chef as `lifting` for `TRAY_WINDUP_SEC` (`Chef.windupLeft`), then fires `trayLift` or `traySet`. A carrier walks at `TRAY_SPEED_SCALE`, cannot dash or throw. A dash bump on a carrier sets `Chef.wobble` (`trayWobble` event) instead of dropping the tray; a second bump inside the window drops the top item on the floor (`drop`). A carrier that falls into a gap: the tray and its load return to the first `trayRack` if it is free, else they are lost. Off: no tray is spawned; the rack is a counter.

Pass-through shelf: on, `shelf` behaves as `counter` for placing and taking; a flight that reaches it ends and the item drops on the last floor tile it crossed. Off, a shelf refuses every interaction and stops flights the same way. Either way it is in `SOLID_TILES`.

The 86 system: at construction, with the switch on, every crate whose ingredient is not exempt gets `stock` and `capacity`. Exempt: `eightySix.exempt`, plus any ingredient present in every recipe of the level, unless a `stations` override sets that crate's `stock`. Taking from a crate decrements `stock`; a crate at 0 gives nothing. Taking the last item fires `crateEmpty`; when no crate of that ingredient has stock left the ingredient is out: every pending order whose recipe needs it is rewritten to the substitute among `level.recipes` that needs no missing ingredient and shares the most ingredients (ties broken by the level's recipe order; same dish type preferred), keeping `originalRecipeId` (set once, on the first rewrite) and setting `rewrittenAt` (`orderRewritten` event, value = order id). No substitute: the ticket is left as it is. New orders skip recipes that need a missing ingredient when any other recipe is available. `serve()` accepts a dish matching either the current or the original recipe and scores the one matched. While `MAX_SIMULTANEOUS_86` ingredients are out, no other crate hands over its last item. Each shortage queues a `Restock` (`SimState.restocks`) with `arrivesIn = restockDelaySec`; when it arrives, `restockDue` fires and on a level with a `delivery` tile the crate waits there until a chef with empty hands holds interact facing the door (`unloading`, `RESTOCK_UNLOAD_SEC`, `restockTick`, chop-assistable), on a level without one it restocks at once. Restocking refills every crate of the ingredient to `capacity` (`restocked`). Rewritten tickets stay rewritten; the original still serves. `eightySix.scripted` entries empty the ingredient's crates at `atSec` through the same path.

### Presentation (`src/game`)
Settings page rows for the five switches (after the assists, so the playtest scripts' cursor counts hold), each with a description line; `settingsSummary` already reports "n mechanics". HUD: a rewritten order card flashes for `ORDER_REWRITE_FLASH_SEC` and swaps its ingredient icons with a short animation; a chalk "86" (`TEX.chalk86`) over an empty crate; a fill level on every crate that has `stock`; the delivery crate (`deliveryCrate` role) at the door while a restock waits, with the unloading progress bar; a lift/set progress bar and an assist badge on the existing action bar; two plates drawn stacked in a chef's hands; the tray with its items stacked on it in hand and on counters; the `shelf` tile as a hatch in a wall (`shelf` role) or a plain wall when the switch is off (`TEX.shelfClosed` ground, `wall` role); the `trayRack` and `delivery` stations. `DebugOverlay` describes the tray and stock.

### Art and audio
Roles in `src/art/models.json`: `shelf`, `trayRack`, `delivery`, `deliveryCrate`, `tray`. Texture keys: `TEX.tray`, `TEX.deliveryCrate`, `TEX.shelfClosed`, `TEX.chalk86`, plus `TEX.tile()` for the three tiles. Sounds: `crateEmpty`, `orderRewritten` (distinct from `orderNew`), `restockDue`, `restockTick`, `restocked`, `trayLift`, `traySet`, `trayWobble`.

### Tutorials
One tutorial kitchen per mechanic under `src/levels/tutorial/` (`game: 'tutorial'`, reached from the Tutorials row on the title), each forcing its switch on through `LevelDef.mechanics` and carrying a `LevelDef.tutorial` walkthrough (rules panel, then steps with goals the sim state satisfies). The format is in `docs/LEVEL_SCHEMA.md`, the kitchens in `docs/LEVELS.md`, the runner in `src/game/tutorial.ts`.

### Levels
Existing levels keep their layouts; where one adopts a mechanic it does so with `stations` overrides or the `eightySix` block, so the grid text stays the transcription. New levels live under `src/levels/custom/`. `validateLevel` checks that `stock` overrides sit on crates, that `eightySix` names real crates and sane numbers, that there is at most one `delivery` tile, and that a tray only ever starts on a `trayRack`.
