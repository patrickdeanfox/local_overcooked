# Theme noun map: Potion Shop

The cooking vocabulary is the sim's domain model (roadmap item 13). This file is the map from every cooking noun and verb to its counterpart in the Potion Shop theme, chosen on 2026-09-09: apprentices brewing draughts and elixirs in a guild workshop. The presentation reskin reads the **Potion Shop** column for models, sounds and copy; the vocabulary rename does one search-and-replace pass over the **Identifiers** column.

The **Rule** column is what the sim does with the thing, so the counterpart has to make sense under that rule, not just look the part. Rows marked **hard** have a rule with no obvious analogue outside a kitchen; every hard row has an answer in this theme, so the reskin is a straight one with no mechanics change. Entries marked **(proposed)** fill a row the theme's author left open and want a yes or a better word; **(derived)** follows from the author's rule for that family.

## Ingredients

Each ingredient has a processing path. The reagent set keeps the same shape: three kinds that go through the "brew three of one kind" path, one that is ground then heated on its own, one carrier that needs no prep, two garnishes, and two that go straight from grinding into a flask. Keep the reagent colours matched to the original ingredients: reading a recipe at a glance is the whole reason the recipes work. Cap base reagents at about ten.

| Cooking | Rule | Identifiers | Potion Shop |
|---|---|---|---|
| onion | chop, then three of one kind in a pot make a soup | `IngredientType 'onion'`, `SOUP_INGREDIENTS`, legend `O`, `crateOnions`, `onion`, `onionChopped` | mandrake root |
| tomato | same path as onion; also a burger layer | `'tomato'`, legend `T`, `crateTomatoes`, `tomato*` roles, `BurgerLayer 'tomato'` | bloodthorn berry |
| mushroom | same path as onion | `'mushroom'`, legend `M`, `mushroom*` roles | cave fungus |
| meat | chop, then one in a pan, comes out cooked, burns if left; a burger layer | `'meat'`, `FRIED_INGREDIENTS`, legend `A`, `crateSteak`, `meat*` roles, `BurgerLayer 'meat'`, `panMeat` | dragon liver |
| bun | no prep; the burger's carrier; first thing on the plate | `'bun'`, legend `U`, `crateBuns`, `bun`, `bunTop`, `bunBottom`, `BurgerLayer 'bunBottom' / 'bunTop'` | wax of the hive **(proposed)**: the elixir's "base"; the author's map names the layer but not the reagent, and hive wax is the one listed reagent with no other job until cheese lands |
| lettuce | chop, then a burger layer | `'lettuce'`, legend `L`, `crateLettuce`, `lettuce*` roles, `BurgerLayer 'lettuce'` | silverleaf |
| fish | chop, then straight onto a plate as a one-ingredient dish | `'fish'`, `PLATED_INGREDIENTS`, legend `J`, `fish`, `fishChopped` | newt |
| prawn | same path as fish | `'prawn'`, legend `Ø`, `prawn`, `prawnChopped` | bottled sprite |
| raw / chopped / cooked | the three ingredient states | `IngredientItem.chopped`, `.cooked`, `TEX.ingredient(type, chopped)`, `TEX.ingredientCooked` | raw / ground reagent / steeped reagent |

## Cookware and dishes

| Cooking | Rule | Identifiers | Potion Shop |
|---|---|---|---|
| pot | holds up to three of one soup ingredient; cooks on a stove; burns after `BURN_TIME`; a burnt pot goes to the trash to reset | `Ware 'pot'`, `PotItem`, `POT_CAPACITY`, `COOK_TIME`, legend `S`, `pot` role, `TEX.pot`, `TEX.potSoup`, `TEX.potBurnt` | cauldron (the author's "cauldron insert"; the pot is the thing carried, so the short word goes here and the stove becomes the hearth below) |
| pan | holds one fried ingredient; same cook and burn rules as the pot | `Ware 'pan'`, `PAN_CAPACITY`, `PAN_COOK_TIME`, legend `F`, `pan` role, `TEX.pan`, `TEX.panMeat` | crucible dish |
| cooking / cooked / burnt **hard** | a timer that first completes the item and then ruins it; ruined cookware starts a fire | `PotState`, `BURN_TIME`, events `cookStart`, `cookDone`, `burnt`, sfx `sizzle`, `cookDone`, `burnAlarm`, `Modifiers.noBurning`, `instantCooking` | brewing / steeped / curdled batch; a curdled batch flares (see hazards) |
| soup | the pot's finished content, poured onto a plate | `DishType 'soup'`, event `potPour`, sfx `pour`, `TEX.plateSoup`, `iconSoup` | draught |
| burger | layers assembled on a plate in any order: bun, meat, optional lettuce and tomato | `DishType 'burger'`, `BURGER_LAYERS`, `TEX.burgerLayer`, `iconBurger`, event `plateAdd` | layered elixir: base (bun) + core (dragon liver) + garnish (silverleaf, bloodthorn) |
| plated dish | one chopped ingredient on a plate, no heat | `DishType 'plated'`, `PLATED_INGREDIENTS` | tincture (grind only, cold; the author's salad row, which is the same rule) |
| recipe | a named ingredient list with a score | `Recipe`, `RECIPES`, `Recipe.name` (player-facing) | formula **(proposed)** |
| onion soup, tomato soup, mushroom soup | the three draughts on the order cards | `RECIPES[*].name` | mandrake draught, bloodthorn draught, cave fungus draught **(derived)** |
| burger, lettuce burger, salad burger | the three elixirs | `RECIPES[*].name` | elixir, silverleaf elixir, garnished elixir **(derived; "garnished" for the lettuce and bloodthorn one wants a better word)** |
| fish sashimi, prawn sashimi | the two tinctures | `RECIPES[*].name` | newt tincture, sprite tincture **(derived)** |
| finished dish | anything a flask carries that matches an order | `Dish` | corked potion |

## Carriers

| Cooking | Rule | Identifiers | Potion Shop |
|---|---|---|---|
| plate | the only thing that can be served; takes soup, burger layers or a plated ingredient | `PlateItem`, `plate` role, `TEX.plate`, `iconPlate`, legend `P`, `p` | flask |
| dirty plate **hard** | comes back some seconds after a serve as a stack; must be washed before reuse | `DirtyPlateItem`, `PLATE_RETURN_DELAY`, `plateDirty` role, `TEX.dirtyPlate`, event `plateReturned`, sfx `plateReturn` | crusted flask; the crusted stack must read as clearly as the dirty-plate stack does in the original |
| clean plate stack | the no-sink variant: clean plates respawn at a stack after a delay | `PLATE_STACK_RETURN_DELAY`, `TileType 'plateStack'` | clean flask rack **(proposed)**: the author's "empty flask rack" is taken by the dirty return below |
| extinguisher **hard** | a held tool that sprays at a fire in front of the chef | `ExtinguisherItem`, legend `E`, `TEX.extinguisher`, `TEX.spray`, `EXTINGUISH_RATE`, `SPRAY_RANGE`, event `spray`, sfx `spray` | dousing charm (modelled as a frost jar); the action is dousing |

## Stations

| Cooking | Rule | Identifiers | Potion Shop |
|---|---|---|---|
| kitchen | the level itself | `docs`, `README.md`, copy such as "Kitchen and menu sounds" | workshop; the business is the apothecary |
| counter | solid, holds one item | `TileType 'counter'`, legend `#`, `counter`, `counterAlt` roles | workbench |
| crate | infinite source of one ingredient | `'crate'`, legend `O T M A U L J Ø C`, `crate*` roles, `TEX.crate` | reagent barrel |
| chopping board | holds one ingredient; interact repeatedly to chop; chef stays put | `'board'`, legend `B`, `cuttingBoard`, `knife` roles, `CHOP_TIME`, `ChefAction 'chopping'`, events `chopTick`, `chopDone`, sfx `chop`, `chopDone` | mortar and pestle; the action is grinding |
| stove | holds cookware and cooks it; the tile that can catch fire | `'stove'`, legend `S`, `F`, `stove`, `hood` roles, `Fire` | hearth **(proposed)**: one tile type holds either a cauldron or a crucible dish, so the burner needs its own word; the author's "stove + pot = cauldron" is the hearth with a cauldron on it |
| sink **hard** | interact with a dirty stack to wash; clean plates emerge on the drying tile next to it | `'sink'`, legend `W`, `sink` role, `WASH_TIME`, `ChefAction 'washing'`, events `washTick`, `washDone`, sfx `wash`, `washDone` | rinse basin; the action is rinsing |
| drying rack | the sink's output tile | `'drying'`, legend `D`, `dishrack` role | drip rack **(proposed)** |
| plate return | where dirty plates reappear | `'plateReturn'`, legend `R` | empty flask rack (the author's plate-return row) |
| serving counter | drop a plated dish here to serve it; also where the order window is | `'serve'`, legend `V`, `serve`, `wallOrderWindow` roles, events `serve`, `serveRejected`, sfx `serve`, `serveBad` | dispensary hatch; the person behind it is the patron |
| trash | destroys ingredients and contents; empties cookware; keeps plates | `'trash'`, legend `X`, `trash` role, event `trash`, sfx `trash` | sludge drain |
| fridge, hood, wall, window | dressing only | `fridge`, `hood`, `wall`, `wallWindow` roles, `ThemeDressing` | pick with item 6's dressing manifest |

## Apprentices

| Cooking | Rule | Identifiers | Potion Shop |
|---|---|---|---|
| chef | the player character; two of them | `Chef`, `CHEF_COUNT`, `CHEF_SPEED`, `TEX.chef`, `chef` role, `public/models/chef/`, `npm run chef`, `npm run skins`, copy "Chef speed", the Chefs page | apprentice |
| the 15 characters | the Chefs page skins; Kenney names today | `char*` roles in `models.json`, the Chefs page list | the apprentice roster; names with the character art |
| toque | the hat sized from the head bone | `tools/export-chef.py`, `tools/make-chef-skins.py` | decide with the character art |
| chopping, washing, extinguishing | the three station actions with a progress bar | `ChefAction` | grinding, rinsing, dousing |
| walking, dashing, falling, throwing, catching | movement verbs | `ChefAction`, events `dash`, `dashBump`, `chefFell`, `throw`, `catch`, `throwLand` | unchanged |

## Hazards and dynamics

| Cooking | Rule | Identifiers | Potion Shop |
|---|---|---|---|
| fire **hard** | starts on a burnt stove, spreads to neighbours on a timer, has health, blocks the tile, is put out by spraying | `Fire`, `FIRE_SPREAD_TIME`, events `fireStart`, `fireSpread`, `fireOut`, sfx `fire`, `fireOut`, `TEX.fire`, `TEX.smoke` | cauldron flare; it needs the same silhouette urgency as a kitchen fire, bright, animated, unmistakable from across the screen. Its smoke is noxious fumes |
| steam | the cooking effect over a pot | `src/game/render/three/` effects | unchanged; a cauldron steams |
| pedestrians and cars | moving solid obstacles on road tiles; street dressing | `Pedestrian`, `TileType 'road'`, legend `~`, `car*` roles | townsfolk **(proposed)** and the wagons of the travelling guild |
| slider | a counter group that moves; the ship deck | `SliderGroup`, `TileType 'slider'`, legend `1` to `4` | drifting stone slabs (the author's moving-platform row; the clone's slider is the same rule on counters) |
| gate | a seam that opens and closes; the earthquake | `GateGroup`, `TileType 'gate'`, legend `G`, events `gateOpen`, `gateClose` | rift **(proposed)** |
| gap | a hole; throw over it, fall in it | `TileType 'gap'`, legend `_`, `FALL_PENALTY_SEC` | chasm **(proposed)** |

## Orders and scoring

| Cooking | Rule | Identifiers | Potion Shop |
|---|---|---|---|
| order, ticket | a requested recipe with a timer; several on screen | `Order`, `SimState.orders`, `maxOrdersDelta`, `initialOrdersDelta`, events `orderNew`, `orderExpired`, sfx `orderNew`, `orderFail`, the order cards | prescription (the order slip); the row of cards is the requisition board |
| tip | bonus for a fast serve and for combos | `TIP_BASE`, `TIP_MAX` | coin; the combo bonus is the resonance bonus |
| score, stars | level result and unlocks | `progress.ts`, the results page | score; 1 to 3 wands |
| menu | the set of recipes a level serves | `LevelDef.recipes`, copy "Kitchen and menu sounds" | formulary **(proposed)** |

## Levels and themes

| Cooking | Rule | Identifiers | Potion Shop |
|---|---|---|---|
| Overcooked 1 world 1 and 3-2, Overcooked 2 1-1 | the shipped layouts; ids and names players see | `src/levels/oc1/`, `src/levels/oc2/`, `LevelDef.id`, `.name` | numbering unchanged; the level select is the guild map |
| default, treacle-town, savoury-seas, sushi-city | per-level dressing: backdrop, floor, wall, props | `LevelDef.theme`, `ThemeDressing` in `tiles.ts` (item 6 makes this data) | default is the workshop; the three districts are named with item 6 |
| the game title | what the player launches | `README.md`, the title scene, `package.json` name, the desktop launcher | not chosen yet |

## Sounds with a kitchen character

These four sounds need a new sound, not just a new name.

| Cooking | Identifiers | Potion Shop |
|---|---|---|
| chop | `SfxName 'chop'`, `'chopDone'` | grind (stone on stone) **(derived)** |
| sizzle | `'sizzle'` | bubble (a brewing cauldron) **(derived)** |
| pour | `'pour'` | decant **(derived)** |
| wash | `'wash'`, `'washDone'` | rinse **(derived)** |

## Not in the clone yet

The author's map covers stations, reagents, formulas and dynamics that roadmap item 5 has still to build. When one lands, take its name from here so it is named once. Two collisions to settle then: the fryer basket and the pan are both "crucible" (the pan is the crucible dish above, so the fryer wants another word), and the sushi rule (rice plus fish) is a new dish type, not the tincture.

| Cooking | Potion Shop | Roadmap |
|---|---|---|
| fryer and basket | crucible (collides with the crucible dish) | item 5 step 5 |
| oven | kiln | item 5 step 6 |
| rice cooker, steamer | alembic | item 5 step 9 |
| mixer | whisking rod, stirring stand | item 5 step 9 |
| conveyor belt | rune channel | item 5 step 3 |
| moving platforms, trucks, boats | drifting stone slabs; the wagon of the travelling guild | item 5 step 4 |
| ice floor | frost-slick floor | item 5 step 5 |
| portals | arcane gateways | item 5 step 10 |
| rats | imps | OC1 2-2 |
| rice | powdered bone | OC2 1-3 |
| dough, flour | ash clay | item 5 step 6 |
| cheese | wax of the hive (if the bun keeps it, cheese needs another) | item 5 step 6 |
| burrito | bound scroll-potion (vellum plus fills) | item 5 step 8 |
| pizza | sigil tablet (clay plus runes, fired) | item 5 step 6 |
| sushi | pearl capsule (bone paste plus newt) | OC2 1-3 |
| pancakes | salve (paste, kiln) | later |
| Onion King | guild archmage | story, none yet |
| Kevin | the familiar (raven or cat) | story, none yet |
| Onion Kingdom overworld, horde mode | guild map; bestiary siege mode | later |

## Left as they are

`void`, `floor`, `pickup`, `drop`, `timerStart`, `timerWarning`, `levelEnd`, the UI sounds, the input actions and the difficulty presets carry no theme.
