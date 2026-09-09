# Theme noun map

The cooking vocabulary is the sim's domain model (roadmap item 13). This file is the map from every cooking noun and verb to its counterpart in the new theme. Fill the **New theme** column once, then the presentation reskin reads it for models, sounds and copy, and the vocabulary rename does one search-and-replace pass over the **Identifiers** column.

How to fill it in: the **Rule** column is what the sim does with the thing, so the counterpart has to make sense under that rule, not just look the part. A row marked **hard** has a rule with no obvious analogue outside a kitchen. If the theme has no honest counterpart for a hard row, that row is a mechanics change and needs a sim decision before more levels build on it. Keep the answers to one or two words; a dish name can be longer.

## Ingredients

Each ingredient has a processing path. The counterpart set needs the same shape: three kinds that go through the "boil three of one kind" path, one that is chopped then heated on its own, one carrier that needs no prep, two toppings, and two that go straight from chopping onto the carrier.

| Cooking | Rule | Identifiers | New theme |
|---|---|---|---|
| onion | chop, then three of one kind in a pot make a soup | `IngredientType 'onion'`, `SOUP_INGREDIENTS`, legend `O`, `crateOnions`, `onion`, `onionChopped` | |
| tomato | same path as onion; also a burger layer | `'tomato'`, legend `T`, `crateTomatoes`, `tomato*` roles, `BurgerLayer 'tomato'` | |
| mushroom | same path as onion | `'mushroom'`, legend `M`, `mushroom*` roles | |
| meat | chop, then one in a pan, comes out cooked, burns if left; a burger layer | `'meat'`, `FRIED_INGREDIENTS`, legend `A`, `crateSteak`, `meat*` roles, `BurgerLayer 'meat'`, `panMeat` | |
| bun | no prep; the burger's carrier; first thing on the plate | `'bun'`, legend `U`, `crateBuns`, `bun`, `bunTop`, `bunBottom`, `BurgerLayer 'bunBottom' / 'bunTop'` | |
| lettuce | chop, then a burger layer | `'lettuce'`, legend `L`, `crateLettuce`, `lettuce*` roles, `BurgerLayer 'lettuce'` | |
| fish | chop, then straight onto a plate as a one-ingredient dish | `'fish'`, `PLATED_INGREDIENTS`, legend `J`, `fish`, `fishChopped` | |
| prawn | same path as fish | `'prawn'`, legend `Ø`, `prawn`, `prawnChopped` | |
| raw / chopped / cooked | the three ingredient states | `IngredientItem.chopped`, `.cooked`, `TEX.ingredient(type, chopped)`, `TEX.ingredientCooked` | |

## Cookware and dishes

| Cooking | Rule | Identifiers | New theme |
|---|---|---|---|
| pot | holds up to three of one soup ingredient; cooks on a stove; burns after `BURN_TIME`; a burnt pot goes to the trash to reset | `Ware 'pot'`, `PotItem`, `POT_CAPACITY`, `COOK_TIME`, legend `S`, `pot` role, `TEX.pot`, `TEX.potSoup`, `TEX.potBurnt` | |
| pan | holds one fried ingredient; same cook and burn rules as the pot | `Ware 'pan'`, `PAN_CAPACITY`, `PAN_COOK_TIME`, legend `F`, `pan` role, `TEX.pan`, `TEX.panMeat` | |
| cooking / cooked / burnt **hard** | a timer that first completes the item and then ruins it; ruined cookware starts a fire | `PotState`, `BURN_TIME`, events `cookStart`, `cookDone`, `burnt`, sfx `sizzle`, `cookDone`, `burnAlarm`, `Modifiers.noBurning`, `instantCooking` | |
| soup | the pot's finished content, poured onto a plate | `DishType 'soup'`, event `potPour`, sfx `pour`, `TEX.plateSoup`, `iconSoup` | |
| burger | layers assembled on a plate in any order: bun, meat, optional lettuce and tomato | `DishType 'burger'`, `BURGER_LAYERS`, `TEX.burgerLayer`, `iconBurger`, event `plateAdd` | |
| plated dish | one chopped ingredient on a plate, no heat | `DishType 'plated'`, `PLATED_INGREDIENTS` | |
| recipe | a named ingredient list with a score | `Recipe`, `RECIPES`, `Recipe.name` (player-facing) | |
| onion soup, tomato soup, mushroom soup, burger, lettuce burger, salad burger, fish sashimi, prawn sashimi | the eight dish names players read on the order cards | `RECIPES[*].name` | |

## Carriers

| Cooking | Rule | Identifiers | New theme |
|---|---|---|---|
| plate | the only thing that can be served; takes soup, burger layers or a plated ingredient | `PlateItem`, `plate` role, `TEX.plate`, `iconPlate`, legend `P`, `p` | |
| dirty plate **hard** | comes back some seconds after a serve as a stack; must be washed before reuse | `DirtyPlateItem`, `PLATE_RETURN_DELAY`, `plateDirty` role, `TEX.dirtyPlate`, event `plateReturned`, sfx `plateReturn` | |
| clean plate stack | the no-sink variant: clean plates respawn at a stack after a delay | `PLATE_STACK_RETURN_DELAY`, `TileType 'plateStack'` | |
| extinguisher **hard** | a held tool that sprays at a fire in front of the chef | `ExtinguisherItem`, legend `E`, `TEX.extinguisher`, `TEX.spray`, `EXTINGUISH_RATE`, `SPRAY_RANGE`, event `spray`, sfx `spray` | |

## Stations

| Cooking | Rule | Identifiers | New theme |
|---|---|---|---|
| kitchen | the level itself | `docs`, `README.md`, copy such as "Kitchen and menu sounds" | |
| counter | solid, holds one item | `TileType 'counter'`, legend `#`, `counter`, `counterAlt` roles | |
| crate | infinite source of one ingredient | `'crate'`, legend `O T M A U L J Ø C`, `crate*` roles, `TEX.crate` | |
| chopping board | holds one ingredient; interact repeatedly to chop; chef stays put | `'board'`, legend `B`, `cuttingBoard`, `knife` roles, `CHOP_TIME`, `ChefAction 'chopping'`, events `chopTick`, `chopDone`, sfx `chop`, `chopDone` | |
| stove | holds cookware and cooks it; the tile that can catch fire | `'stove'`, legend `S`, `F`, `stove`, `hood` roles, `Fire` | |
| sink **hard** | interact with a dirty stack to wash; clean plates emerge on the drying tile next to it | `'sink'`, legend `W`, `sink` role, `WASH_TIME`, `ChefAction 'washing'`, events `washTick`, `washDone`, sfx `wash`, `washDone` | |
| drying rack | the sink's output tile | `'drying'`, legend `D`, `dishrack` role | |
| plate return | where dirty plates reappear | `'plateReturn'`, legend `R` | |
| serving counter | drop a plated dish here to serve it; also where the order window is | `'serve'`, legend `V`, `serve`, `wallOrderWindow` roles, events `serve`, `serveRejected`, sfx `serve`, `serveBad` | |
| trash | destroys ingredients and contents; empties cookware; keeps plates | `'trash'`, legend `X`, `trash` role, event `trash`, sfx `trash` | |
| fridge, hood, wall, window | dressing only | `fridge`, `hood`, `wall`, `wallWindow` roles, `ThemeDressing` | |

## Chefs

| Cooking | Rule | Identifiers | New theme |
|---|---|---|---|
| chef | the player character; two of them | `Chef`, `CHEF_COUNT`, `CHEF_SPEED`, `TEX.chef`, `chef` role, `public/models/chef/`, `npm run chef`, `npm run skins`, copy "Chef speed", the Chefs page | |
| the 15 characters | the Chefs page skins; Kenney names today | `char*` roles in `models.json`, the Chefs page list | |
| toque | the hat sized from the head bone | `tools/export-chef.py`, `tools/make-chef-skins.py` | |
| chopping, washing, extinguishing | the three station actions with a progress bar | `ChefAction` | |
| walking, dashing, falling, throwing, catching | movement verbs; keep as they are unless the theme changes them | `ChefAction`, events `dash`, `dashBump`, `chefFell`, `throw`, `catch`, `throwLand` | |

## Hazards and dynamics

| Cooking | Rule | Identifiers | New theme |
|---|---|---|---|
| fire **hard** | starts on a burnt stove, spreads to neighbours on a timer, has health, blocks the tile, is put out by spraying | `Fire`, `FIRE_SPREAD_TIME`, events `fireStart`, `fireSpread`, `fireOut`, sfx `fire`, `fireOut`, `TEX.fire`, `TEX.smoke` | |
| steam | the cooking effect over a pot | `src/game/render/three/` effects | |
| pedestrians and cars | moving solid obstacles on road tiles; street dressing | `Pedestrian`, `TileType 'road'`, legend `~`, `car*` roles | |
| slider | a counter group that moves; the ship deck | `SliderGroup`, `TileType 'slider'`, legend `1` to `4` | |
| gate | a seam that opens and closes; the earthquake | `GateGroup`, `TileType 'gate'`, legend `G`, events `gateOpen`, `gateClose` | |
| gap | a hole; throw over it, fall in it | `TileType 'gap'`, legend `_`, `FALL_PENALTY_SEC` | |

## Orders and scoring

| Cooking | Rule | Identifiers | New theme |
|---|---|---|---|
| order, ticket | a requested recipe with a timer; several on screen | `Order`, `SimState.orders`, `maxOrdersDelta`, `initialOrdersDelta`, events `orderNew`, `orderExpired`, sfx `orderNew`, `orderFail`, the order cards | |
| tip | bonus for a fast serve and for combos | `TIP_BASE`, `TIP_MAX` | |
| score, stars, coins | level result and unlocks | `progress.ts`, the results page | |
| menu | the set of recipes a level serves | `LevelDef.recipes`, copy "Kitchen and menu sounds" | |

## Levels and themes

| Cooking | Rule | Identifiers | New theme |
|---|---|---|---|
| Overcooked 1 world 1 and 3-2, Overcooked 2 1-1 | the shipped layouts; ids and names players see | `src/levels/oc1/`, `src/levels/oc2/`, `LevelDef.id`, `.name` | |
| default, treacle-town, savoury-seas, sushi-city | per-level dressing: backdrop, floor, wall, props | `LevelDef.theme`, `ThemeDressing` in `tiles.ts` (item 6 makes this data) | |
| the game title | what the player launches | `README.md`, the title scene, `package.json` name, the desktop launcher | |

## Sounds with a kitchen character

Most sound names follow the rows above. These four are the ones a listener would place in a kitchen, so they need a new sound, not just a new name.

| Cooking | Identifiers | New theme |
|---|---|---|
| chop | `SfxName 'chop'`, `'chopDone'` | |
| sizzle | `'sizzle'` | |
| pour | `'pour'` | |
| wash | `'wash'`, `'washDone'` | |

## Left as they are

`void`, `floor`, `pickup`, `drop`, `timerStart`, `timerWarning`, `levelEnd`, the UI sounds, the input actions and the difficulty presets carry no theme.
