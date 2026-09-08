# Overcooked! 2 — recipes (base campaign)

Every recipe variant that can be ordered in the OC2 main campaign (1-1 … 6-6) or the Kevin levels.
Ingredients and step order are transcribed from each recipe's `Template:*` recipe card on the wiki —
those cards show, per ingredient column, the exact chain of stations that ingredient passes through.

**On scores: the wiki gives no per-dish point value anywhere.** Not on the recipe pages, not on the
level pages, not in the achievement list. Every score in this document is marked accordingly. See §4
for the derivation I would use and what it is anchored on.

---

## 1. Station vocabulary

| Step | Station | Held in | Wiki |
|---|---|---|---|
| Chop | Chopping Board | — (ingredient sits on the board) | [Chopping Board](https://overcooked.fandom.com/wiki/Chopping_Board) |
| Boil | Pot on a Burner | Pot | [Pot](https://overcooked.fandom.com/wiki/Pot) |
| Fry | Pan on a Burner | Pan | [Pan](https://overcooked.fandom.com/wiki/Pan) |
| Deep fry | Frying Basket on a Deep Fryer | Frying Basket | [Deep Fryer](https://overcooked.fandom.com/wiki/Deep_Fryer) |
| Bake | Oven | — (in OC2 you can plate straight out of the oven) | [Oven](https://overcooked.fandom.com/wiki/Oven) |
| Mix | Mixer | Mixer bowl | [Mixer](https://overcooked.fandom.com/wiki/Mixer) |
| Steam | Steamer on a Burner | Steamer | [Steamer](https://overcooked.fandom.com/wiki/Steamer) |
| Plate | Plate | Plate | [Plate](https://overcooked.fandom.com/wiki/Plate) |

Ingredients that are **never chopped** in any recipe: bun, tortilla, nori, pasta, egg, flour.
([Chopping Board](https://overcooked.fandom.com/wiki/Chopping_Board))

---

## 2. Recipes

`→` is a step chain for one ingredient. `+` joins ingredients at the station or plate that follows.
"Plate" is always the last step and is omitted from the chains for brevity.

### 2.1 Sashimi — [wiki](https://overcooked.fandom.com/wiki/Sashimi)

Introduced 1-1. One ingredient, one step. The simplest dish in the game.

| Variant | Ingredients | Chain | Stations | Levels |
|---|---|---|---|---|
| Fish Sashimi | fish | fish → chop | board | 1-1, 4-1, 4-5, 6-6 |
| Prawn Sashimi | prawn | prawn → chop | board | 1-1, 1-3, 4-1, 6-6 |

### 2.2 Sushi — [wiki](https://overcooked.fandom.com/wiki/Sushi)

Introduced 1-2. Nori is never chopped or cooked; rice is boiled; fillings are chopped. All three
converge on the plate.

| Variant | Ingredients | Chain | Stations | Levels |
|---|---|---|---|---|
| Fish Sushi | nori, rice, fish | nori; rice → boil; fish → chop | pot, board | 1-2, 1-4, 1-6, 4-1, 4-5, 5-1, 6-6 |
| Cucumber Sushi | nori, rice, cucumber | nori; rice → boil; cucumber → chop | pot, board | 1-3, 1-4, 1-6, 4-1, 4-5, 5-1, 6-6 |
| Fish & Cucumber Sushi | nori, rice, fish, cucumber | nori; rice → boil; fish → chop; cucumber → chop | pot, board | 4-1, 4-5, 5-1 |

### 2.3 Salad — [wiki](https://overcooked.fandom.com/wiki/Salad)

Introduced in the tutorial. Chop-only; no heat at all.

| Variant | Ingredients | Chain | Stations | Levels |
|---|---|---|---|---|
| Lettuce Salad | lettuce | lettuce → chop | board | Tutorial, 1-6, 4-2 |
| Tomato Salad | lettuce, tomato | both → chop | board | Tutorial, 1-6, 4-2, 6-6 |
| Cucumber & Tomato Salad | lettuce, tomato, cucumber | all three → chop | board | Tutorial, 1-6, 6-6 |

### 2.4 Fast Food — [wiki](https://overcooked.fandom.com/wiki/Fast_Food)

Introduced 2-1. The only recipe family that uses the deep fryer, and the only one where every
ingredient runs the *same* two-step chain.

| Variant | Ingredients | Chain | Stations | Levels |
|---|---|---|---|---|
| Chips | potato | potato → chop → deep fry | board, fryer | 3-5, 4-2, 4-4 |
| Nuggets | chicken | chicken → chop → deep fry | board, fryer | 2-1, 3-5, 4-2, 4-4, 6-6 |
| Nuggets & Chips | chicken, potato | each → chop → deep fry | board, fryer | 2-1, 3-5, 4-2, 4-4, 6-6 |

### 2.5 Pasta — [wiki](https://overcooked.fandom.com/wiki/Pasta_(Recipe))

Introduced 1-5. Two parallel chains that never meet before the plate: pasta boils, the sauce
ingredient is chopped then fried.

| Variant | Ingredients | Chain | Stations | Levels |
|---|---|---|---|---|
| Tomato Pasta | pasta, tomato | pasta → boil; tomato → chop → fry | pot, board, pan | 1-5, 5-5, 5-6, 6-6 |
| Beef Pasta | pasta, beef | pasta → boil; beef → chop → fry | pot, board, pan | 2-2, 2-3, 5-5, 5-6 |
| Mushroom Pasta | pasta, mushroom | pasta → boil; mushroom → chop → fry | pot, board, pan | 2-3, 5-5, 5-6 |
| Fish & Prawn Pasta | pasta, fish, prawn | pasta → boil; fish → chop → fry; prawn → chop → fry | pot, board, pan ×2 | 2-2, 5-6 (phase 3 only), 6-6 |

### 2.6 Burrito — [wiki](https://overcooked.fandom.com/wiki/Burrito)

Introduced 2-4. Tortilla is raw, rice boils, the protein chops then fries — three chains of length
0, 1 and 2.

| Variant | Ingredients | Chain | Stations | Levels |
|---|---|---|---|---|
| Beef Burrito | tortilla, rice, beef | tortilla; rice → boil; beef → chop → fry | pot, board, pan | 2-4, 2-5, 3-6, 4-6, 5-3, 6-6 |
| Chicken Burrito | tortilla, rice, chicken | tortilla; rice → boil; chicken → chop → fry | pot, board, pan | 2-5, 3-6, 4-6, 5-3 |
| Mushroom Burrito | tortilla, rice, mushroom | tortilla; rice → boil; mushroom → chop → fry | pot, board, pan | 2-4, 4-6, 5-3, 6-6 |

### 2.7 Burger — [wiki](https://overcooked.fandom.com/wiki/Burger)

Introduced 2-6. Bun is raw; every garnish is chopped; the patty is chopped *then* fried.

| Variant | Ingredients | Chain | Stations | Levels |
|---|---|---|---|---|
| Meat Burger | bun, beef | bun; beef → chop → fry | board, pan | 2-6, 3-2, 3-4, 4-3, 5-1, 5-2, 6-4, 6-5 |
| Cheese Burger | bun, cheese, beef | bun; cheese → chop; beef → chop → fry | board, pan | 2-6, 3-2, 3-4, 4-3, 5-2, 6-5, 6-6 |
| Lettuce & Cheese Burger | bun, cheese, lettuce, beef | bun; cheese → chop; lettuce → chop; beef → chop → fry | board, pan | 3-2, 3-4, 4-3, 5-2, 6-4, 6-5, 6-6 |
| Tomato & Lettuce Burger | bun, lettuce, tomato, beef | bun; lettuce → chop; tomato → chop; beef → chop → fry | board, pan | 3-4, 5-2, 6-4, 6-6 |

### 2.8 Pizza — [wiki](https://overcooked.fandom.com/wiki/Pizza)

Introduced 3-1. The only family where every ingredient is chopped and then the *whole assembly* goes
through one shared station. The dough is the carrier, not the plate.

| Variant | Ingredients | Chain | Stations | Levels |
|---|---|---|---|---|
| Pizza | dough, cheese, tomato | all three → chop, assemble, → bake | board, oven | 3-1, 3-3, 6-4, 6-6 |
| Pepperoni Pizza | dough, cheese, tomato, pepperoni | all four → chop, assemble, → bake | board, oven | 3-3, 6-4, 6-6 |
| Chicken Pizza | dough, cheese, tomato, chicken | all four → chop, assemble, → bake | board, oven | 6-4 |

### 2.9 Pancake — [wiki](https://overcooked.fandom.com/wiki/Pancake)

Introduced 5-4. First family where ingredients are *combined in a machine* rather than on a plate.
Flour and egg go straight into the mixer unchopped.

| Variant | Ingredients | Chain | Stations | Levels |
|---|---|---|---|---|
| Pancake | flour, egg | flour + egg → mix → fry | mixer, pan | 5-4, 6-2, 6-3, 6-6 |
| Chocolate Pancake | flour, egg, chocolate | chocolate → chop; + flour + egg → mix → fry | board, mixer, pan | 5-4, 6-2, 6-3, 6-6 |

### 2.10 Cake — [wiki](https://overcooked.fandom.com/wiki/Cake)

Introduced 6-1. The longest chain in the base game: chop → mix → bake → plate. Honey is always
chopped; flour and egg never are.

| Variant | Ingredients | Chain | Stations | Levels |
|---|---|---|---|---|
| Cake | flour, egg, honey | honey → chop; + flour + egg → mix → bake | board, mixer, oven | 6-1, 6-2, 6-3 |
| Carrot Cake | flour, egg, honey, carrot | honey → chop; carrot → chop; + flour + egg → mix → bake | board, mixer, oven | 6-1, 6-2, 6-6 |
| Chocolate Cake | flour, egg, honey, chocolate | honey → chop; chocolate → chop; + flour + egg → mix → bake | board, mixer, oven | 6-1, 6-2, 6-3, 6-6 |

### 2.11 Steamed Food / dumplings — [wiki](https://overcooked.fandom.com/wiki/Steamed_Food)

Introduced Kevin 1; the only recipe in all eight Kevin levels. Note the fish variant is the odd one
out — it **skips the mixer entirely**, which is why every Kevin level has a fish crate on a different
side from the flour crate.

| Variant | Ingredients | Chain | Stations | Levels |
|---|---|---|---|---|
| Steamed Fish | fish | fish → chop → steam | board, steamer | Kevin 1–8 |
| Steamed Beef | flour, beef | beef → chop; + flour → mix → steam | board, mixer, steamer | Kevin 1–8, 6-6 |
| Steamed Carrot | flour, carrot | carrot → chop; + flour → mix → steam | board, mixer, steamer | Kevin 2–8, 6-6 |
| Steamed Prawn | flour, prawn | prawn → chop; + flour → mix → steam | board, mixer, steamer | Kevin 2–8 |

---

## 3. Ingredient index

| Ingredient | Chopped? | Cooked how | Appears in |
|---|---|---|---|
| bun | no | no | Burger |
| carrot | yes | mix → bake / mix → steam | Cake, Steamed Food |
| cheese | yes | bake (pizza) / raw (burger) | Burger, Pizza |
| chicken | yes | deep fry / fry / bake | Fast Food, Burrito, Pizza |
| chocolate | yes | mix → fry / mix → bake | Pancake, Cake |
| cucumber | yes | no | Sushi, Salad |
| dough | yes | bake | Pizza |
| egg | no | mix → fry / mix → bake | Pancake, Cake |
| fish | yes | raw / fry / steam | Sashimi, Sushi, Pasta, Steamed Food |
| flour | no | mix → fry / mix → bake / mix → steam | Pancake, Cake, Steamed Food |
| honey | yes | mix → bake | Cake |
| lettuce | yes | no | Salad, Burger |
| beef | yes | fry / mix → steam | Burger, Burrito, Pasta, Steamed Food |
| mushroom | yes | fry | Burrito, Pasta |
| nori | no | no | Sushi |
| pasta | no | boil | Pasta |
| pepperoni | yes | bake | Pizza |
| potato | yes | deep fry | Fast Food |
| prawn | yes | raw / fry / steam | Sashimi, Pasta, Steamed Food |
| rice | no | boil | Sushi, Burrito |
| tomato | yes | raw / fry / bake | Salad, Burger, Pasta, Pizza |
| tortilla | no | no | Burrito |

---

## 4. Scores — **wiki: none, estimate**

No wiki page in the Overcooked wiki states a per-dish point value for OC2. What the wiki *does* give:

1. Every star threshold in every level's Star Chart is a multiple of 20.
2. 1-1 (Fish or Prawn Sashimi only — one chop, no heat) has a **1★ threshold of 20 for all four
   player counts**. The tutorial (Lettuce Salad, one chop) is also 20. So the one-step dish is
   worth 20 and 20 is the unit.
3. 6-6 serves "two of each type of dish" across all 11 recipe families — about 22 dishes — and its
   3★ threshold is 1500 for every player count. That averages ~68 points per dish including tips,
   well above 20, so complex dishes must be worth more.
4. Tips are added on top of the base score and scale with the combo multiplier
   ([Combos](https://overcooked.fandom.com/wiki/Combos)); they are not separable from the star
   thresholds.

The estimate I would ship, until someone measures the real game: **base score = 20 points per prep
action a dish requires** (each chop, each boil/fry/deep-fry/steam, each mix, each bake — counting the
mixer and oven once for the whole batch, since they take the whole assembly).

| Recipe variant | Prep actions | Estimated base score |
|---|---|---|
| Lettuce Salad | 1 chop | 20 |
| Fish / Prawn Sashimi | 1 chop | 20 |
| Tomato Salad | 2 chops | 40 |
| Chips / Nuggets | 1 chop + 1 deep fry | 40 |
| Cucumber & Tomato Salad | 3 chops | 60 |
| Cucumber / Fish Sushi | 1 boil + 1 chop | 40 |
| Meat Burger | 1 chop + 1 fry | 40 |
| Fish & Cucumber Sushi | 1 boil + 2 chops | 60 |
| Tomato / Beef / Mushroom Pasta | 1 boil + 1 chop + 1 fry | 60 |
| Beef / Chicken / Mushroom Burrito | 1 boil + 1 chop + 1 fry | 60 |
| Cheese Burger | 2 chops + 1 fry | 60 |
| Pizza | 3 chops + 1 bake | 80 |
| Nuggets & Chips | 2 chops + 2 deep fries | 80 |
| Fish & Prawn Pasta | 1 boil + 2 chops + 2 fries | 100 |
| Lettuce & Cheese Burger | 3 chops + 1 fry | 80 |
| Tomato & Lettuce Burger | 3 chops + 1 fry | 80 |
| Pepperoni / Chicken Pizza | 4 chops + 1 bake | 100 |
| Pancake | 1 mix + 1 fry | 40 |
| Chocolate Pancake | 1 chop + 1 mix + 1 fry | 60 |
| Steamed Fish | 1 chop + 1 steam | 40 |
| Steamed Beef / Carrot / Prawn | 1 chop + 1 mix + 1 steam | 60 |
| Cake | 1 chop + 1 mix + 1 bake | 60 |
| Carrot / Chocolate Cake | 2 chops + 1 mix + 1 bake | 80 |

This is internally consistent, produces the 20-point floor the wiki confirms, and lands 6-6's average
in the 60–80 band that its 3★ threshold implies. It is still an estimate; label it as such in
`src/sim/recipes.ts` when it lands and replace it if anyone measures real values.

---

## 5. Open questions

1. Real per-dish base scores.
2. The tip formula: base tip, per-combo increment, cap, and whether the tip depends on how much time
   was left on the ticket.
3. Cooking durations per station (only chopping's ~3 s is on the wiki).
4. Mixer capacity — the cards imply 2–4 ingredients but no page states a limit. The Guillotine page
   states 2 for that DLC station, so per-station capacities do exist.
5. Whether the pizza assembly is a plate-like carrier item or a distinct item kind.
6. Whether a pot/pan/steamer/basket can be poured into a plate directly or must be carried to it (the
   Frying Basket page says baskets cannot pour into other cookware, implying the others can).
