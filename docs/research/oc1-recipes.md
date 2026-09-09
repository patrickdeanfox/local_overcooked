# Overcooked! 1 — recipes

Source: the Overcooked wiki, fetched 2026-09-08. Ingredients and prep steps are taken from
the wiki's recipe-table templates (`Template:OnionSoup`, `Template:MeatBurger`, ...), which
are the tables printed on every level page.

**Scores are not on the wiki.** No page in the wiki gives a point value for any dish. The
values below are derived from star thresholds and marked with confidence. See
`oc1-mechanics.md` §7 for the derivation.

---

## The six OC1 recipe families

| Family | Variants | Cookware | First level | OC1 levels |
|---|---|---|---|---|
| Soup | onion, tomato, mushroom | Pot on a burner | 1-1 | 1-1, 1-2, 1-3, 1-5, 2-2, 3-2, 3-3, 4-2, 5-5, 5-6, 6-1, 6-2, 6-3, 6-4, Peckening |
| Burger | meat, lettuce, tomato+lettuce | Pan on a burner | 1-4 | 1-4, 1-6, 2-1, 2-3, 2-4, 4-3, 4-4, 6-4, Peckening |
| Fish and Chips | chips only, fish only, both | Frying basket in a deep fryer | 3-1 | 3-1, 3-3, 3-4, Peckening |
| Pizza | plain, pepperoni, mushroom | Oven | 4-1 | 4-1, 4-4, Peckening |
| Burrito | beef, chicken | Pot (rice) + pan (meat) | 5-1 | 5-1, 5-2, 5-3, 5-4 |
| Salad | lettuce, tomato+lettuce | none — chop and plate | Intro Apocalypse | Intro Apocalypse, 6-4, Peckening |

Sources: [Soup](https://overcooked.fandom.com/wiki/Soup), [Burger](https://overcooked.fandom.com/wiki/Burger),
[Fish](https://overcooked.fandom.com/wiki/Fish), [Pizza](https://overcooked.fandom.com/wiki/Pizza),
[Burrito](https://overcooked.fandom.com/wiki/Burrito), [Salad](https://overcooked.fandom.com/wiki/Salad).

---

## Full variant table

`chop` = on a chopping board. `boil` = pot on a burner. `fry` = pan on a burner.
`deep fry` = frying basket in a deep fryer. `bake` = oven. `plate` = drop onto a plate.

| Recipe id | Display name | Ingredients (prep each) | Assembly | Score |
|---|---|---|---|---|
| `onion_soup` | Onion Soup | onion ×3 (chop) | all three into one pot → boil → pour onto plate | **20** (high) |
| `tomato_soup` | Tomato Soup | tomato ×3 (chop) | as above | **20** (high) |
| `mushroom_soup` | Mushroom Soup | mushroom ×3 (chop) | as above | **20** (high) |
| `meat_burger` | Burger | bun (no prep), beef (chop → fry) | plate bun + cooked patty | 20 (low) |
| `lettuce_burger` | Lettuce Burger | bun, lettuce (chop), beef (chop → fry) | plate all three | 25 (low) |
| `tomato_lettuce_burger` | Salad Burger | bun, lettuce (chop), tomato (chop), beef (chop → fry) | plate all four | 30 (low) |
| `chips` | Chips | potato (chop → deep fry) | plate the chips | 15 (low) |
| `fish` | Fried Fish | fish (chop → deep fry) | plate the fish | 15 (low) |
| `fish_and_chips` | Fish and Chips | fish (chop → deep fry), potato (chop → deep fry) | plate both | 25 (low) |
| `pizza` | Pizza | dough (chop = flatten), cheese (chop = shred), tomato (chop) | assemble on the dough, bake in the oven, plate | 25 (low) |
| `pepperoni_pizza` | Pepperoni Pizza | + pepperoni (chop) | as above | 30 (low) |
| `mushroom_pizza` | Mushroom Pizza | + mushroom (chop) | as above | 30 (low) |
| `beef_burrito` | Beef Burrito | tortilla (no prep), rice (boil), beef (chop → fry) | plate all three | 25 (low) |
| `chicken_burrito` | Chicken Burrito | tortilla (no prep), rice (boil), chicken (chop → fry) | plate all three | 25 (low) |
| `salad` | Salad | lettuce (chop) | plate | 15 (low) |
| `tomato_salad` | Tomato Salad | lettuce (chop), tomato (chop) | plate | 20 (low) |

Ingredient/prep rows come from the wiki templates listed above. **The `Score` column is
estimated, not sourced.** Confidence:

- **Soups: high.** 1-1 serves only onion soup, runs 2:30 with one pot, and puts 3 stars at
  60 points. 60/20 = 3 soups. 1-2's 1P 3-star is 80 (4 soups over 4:00) and 1-3's is 100
  (5 soups). Every world-1 soup threshold is a clean multiple of 20.
- **Everything else: low.** The pattern I applied is "20 for a three-ish-step base dish,
  +5 per optional extra ingredient, 15 for a dish with only one prep step". It reproduces
  1-4's 1P 3-star of 160 as 8 burgers over 4:00 in a 4-pan kitchen, which is plausible, but
  no wiki page confirms any of it.

---

## Prep-step details worth copying exactly

| Detail | Source |
|---|---|
| A soup is **three of the same chopped ingredient**. Mixed soups do not exist in OC1. | the three soup templates |
| **Buns and tortillas are never chopped.** | [Chopping Board](https://overcooked.fandom.com/wiki/Chopping_Board) no-chop list |
| Chopping fish **descales it and removes the tail**; chopping potato turns it into chips; chopping dough flattens it; chopping cheese shreds it. | [Fish](https://overcooked.fandom.com/wiki/Fish), [Level 3](https://overcooked.fandom.com/wiki/Level_3), [Level 4](https://overcooked.fandom.com/wiki/Level_4) |
| Beef and chicken are **chopped first, then fried** — two steps, and the fried patty can burn. | `Template:MeatBurger`, `Template:ChickenBurrito` |
| Rice is **boiled in a pot**, not chopped. | `Template:BeefBurrito` |
| Pizza is assembled **on the flattened dough** and then baked; it is not built on the plate. | [Level 4](https://overcooked.fandom.com/wiki/Level_4) |
| Fish and chips are deep-fried in a **frying basket** inside a deep fryer, one basket per item. | `Template:FishAndChips` |
| Salad has no cooking step at all — chop and plate. | `Template:Salad`, `Template:TomatoSalad` |
| Pizza levels use OC1's **large plates**; every other OC1 kitchen uses small plates. | [Plate](https://overcooked.fandom.com/wiki/Plate) |

---

## Scope for this clone

`src/sim/recipes.ts` currently defines the three soups only, which covers 1-1, 1-2 and 1-3 —
the whole of `docs/PLAN.md`'s first playable. **Keep score 20 for all three soups.** That
value is the one recipe number the wiki's star charts actually pin down.

If burgers are added later (1-4, 1-6), the sim needs a pan item, a two-stage prep chain
(chop → fry), and a plate that accepts multiple distinct ingredients — all three are new
mechanics, not new data.

---

## Appendix — recipes this file was missing (added 2026-09-08)

Everything above covers the six main-campaign families. Sweeping
[Category:Recipes](https://overcooked.fandom.com/wiki/Category:Recipes) and the 152
[Category:Recipe Tables](https://overcooked.fandom.com/wiki/Category:Recipe_Tables) templates
turned up two more Overcooked! families, both from the free **Festive Seasoning** update, plus a
handful of level and variant corrections. Every variant below is also in
`docs/research/catalog/recipes.json`, which carries the same chains machine-readably.

### A1. Stew — [wiki](https://overcooked.fandom.com/wiki/Stew)

First seen in Festive Seasoning 1-1. Chop everything, boil it in a pot, pour onto a plate — the
same machinery as Soup, but the ingredients are mixed rather than three of one kind, and the
combination set is much wider. Ingredients are beef, carrot, onion and potato.

| Recipe id | Ingredients | Chain |
|---|---|---|
| `stew_co` | carrot, onion | each → chop, all → boil |
| `stew_cp` | carrot, potato | as above |
| `stew_cco` | carrot ×2, onion | as above |
| `stew_ccp` | carrot ×2, potato | as above |
| `stew_cop` | carrot, onion, potato | as above |
| `stew_bbb` | beef ×3 | as above |
| `stew_bpp` | beef, potato ×2 | as above |
| `stew_bpo` | beef, potato, onion | as above |
| `stew_bocp` | beef, onion, carrot, potato | as above |
| `stew_oocp` | onion ×2, carrot, potato | as above |
| `stew_ppo` | potato ×2, onion | as above |

*All You Can Eat* streamlines the set: every remake stew includes a potato and never repeats an
ingredient — `stew_ayce_pc`, `stew_ayce_po`, `stew_ayce_pcb`, `stew_ayce_poc`, `stew_ayce_pob`,
`stew_ayce_pcob`.

### A2. Turkey Dinner — [wiki](https://overcooked.fandom.com/wiki/Turkey_Dinner)

First seen in Festive Seasoning 1-5, and the only OC1 recipe cooked with a **Flamethrower** rather
than a pot, pan, fryer or oven. Vegetables are chopped first; the turkey is roasted as it comes.

| Recipe id | Ingredients | Chain |
|---|---|---|
| `turkey_dinner` | turkey | turkey → roast |
| `turkey_dinner_carrot` | turkey, carrot | turkey → roast; carrot → chop → roast |
| `turkey_dinner_potato` | turkey, potato | turkey → roast; potato → chop → roast |
| `turkey_dinner_all` | turkey, potato, carrot | turkey → roast; both vegetables → chop → roast |
| `turkey_dinner_potatocarrot` | potato, carrot | both → chop → roast (no turkey at all) |

The wiki reuses the chicken icon for the turkey in these tables; the recipe page text is what
identifies it as turkey.

### A3. Corrections and additions to the tables above

- **Soup also appears in The Lost Morsel DLC**, in its levels 1-3 and 1-5
  ([Soup](https://overcooked.fandom.com/wiki/Soup) Appearances). The level list in §1 covers the main
  campaign only.
- **Cucumber & Tomato Salad is not an OC1 recipe.** The shared [Salad](https://overcooked.fandom.com/wiki/Salad)
  page lists it alongside the two OC1 variants, but cucumber is an Overcooked! 2 ingredient; OC1 has
  lettuce salad and tomato salad only.
- **Nuggets and Nuggets & Chips are not OC1 recipes either.** The shared
  [Fast Food](https://overcooked.fandom.com/wiki/Fast_Food) page lists all five variants; the
  Appearances section on that page confines OC1 to Fish and Chips (3-1, 3-3, 3-4, The Peckening).
- **Chicken Pizza and Olive Pizza are OC2**, not OC1; OC1's third pizza is the mushroom one.
- **Two recipe ids differ from `catalog/recipes.json`.** The catalog uses `fried_fish` where
  the table above uses `fish` (to keep the dish id distinct from the ingredient), and
  `lettuce_salad` where the table uses `salad` (to sit alongside `tomato_salad` and
  `cucumber_tomato_salad`). Everything else matches.

### A4. Recipes the wiki names but does not document

- **Curry** and **Tea** — listed on the [Recipe](https://overcooked.fandom.com/wiki/Recipe) page as
  additions in *All You Can Eat*. Neither has a wiki page, a recipe table, or an ingredient list.
- **Prawn Burger** — named in the hatnote on the [Burger](https://overcooked.fandom.com/wiki/Burger)
  page as a recipe from the *Ever Peckish Rises* DLC. No page, no table.

If any of these three is ever needed, it has to come from the game, not the wiki.
