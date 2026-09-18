import { PLATED_INGREDIENTS, type Dish, type DishType, type IngredientType, type Prep, type Recipe } from './types';

// ─── Dish families ──────────────────────────────────────────────────────────
/** A dish assembled on the plate: the pieces it takes, each in the one state it takes it in, and whether
 *  a piece may repeat (two fish on a sashimi plate). Soup is not here: it is poured from a pot. */
export interface DishFamily { parts: Partial<Record<IngredientType, Prep>>; repeats?: boolean; }
export const DISH_FAMILIES: Readonly<Partial<Record<DishType, DishFamily>>> = {
  burger: { parts: { bun: 'raw', meat: 'pan', lettuce: 'chopped', tomato: 'chopped' } },
  plated: { parts: { fish: 'chopped', prawn: 'chopped' }, repeats: true },
  fried: { parts: { fish: 'basket', potato: 'basket' } },
  sushi: { parts: { nori: 'raw', rice: 'boiled', fish: 'chopped', cucumber: 'chopped' } },
  salad: { parts: { lettuce: 'chopped', tomato: 'chopped', cucumber: 'chopped' } },
};
/** The order a plate tries the families in when a piece fits several (chopped lettuce: burger or salad);
 *  the Sim puts the level's own families first. */
export const ASSEMBLY_ORDER: readonly DishType[] = ['burger', 'plated', 'fried', 'sushi', 'salad'];

/** True when the family takes every piece in its state, each at most once unless the family repeats. */
export function familyFits(dish: DishType, pieces: readonly { type: IngredientType; prep: Prep }[]): boolean {
  const family = DISH_FAMILIES[dish];
  if (!family) return false;
  const seen = new Set<IngredientType>();
  for (const piece of pieces) {
    if (family.parts[piece.type] !== piece.prep) return false;
    if (seen.has(piece.type) && !family.repeats) return false;
    seen.add(piece.type);
  }
  return true;
}

// Overcooked 1 world 1 dishes. Soups: three chopped ingredients of one kind, boiled.
// Burgers: bun (no prep) + beef (chop → fry) + optional chopped lettuce / tomato, plated in
// any order. Scores per docs/research/oc1-recipes.md (soup high confidence, burgers estimated:
// 20 for the base dish, +5 per optional extra).
// Overcooked 2 world 1: sashimi is one chopped fish or prawn on a plate, no heat; 20 points is
// the one-step unit (docs/research/oc2-recipes.md section 4).
export const RECIPES: Record<string, Recipe> = {
  onion_soup:    { id: 'onion_soup',    name: 'Onion Soup',    ingredients: ['onion', 'onion', 'onion'],          score: 20 },
  tomato_soup:   { id: 'tomato_soup',   name: 'Tomato Soup',   ingredients: ['tomato', 'tomato', 'tomato'],       score: 20 },
  mushroom_soup: { id: 'mushroom_soup', name: 'Mushroom Soup', ingredients: ['mushroom', 'mushroom', 'mushroom'], score: 20 },
  meat_burger:           { id: 'meat_burger',           name: 'Burger',         dish: 'burger', ingredients: ['bun', 'meat'],                     score: 20 },
  lettuce_burger:        { id: 'lettuce_burger',        name: 'Lettuce Burger', dish: 'burger', ingredients: ['bun', 'lettuce', 'meat'],          score: 25 },
  tomato_lettuce_burger: { id: 'tomato_lettuce_burger', name: 'Salad Burger',   dish: 'burger', ingredients: ['bun', 'lettuce', 'meat', 'tomato'], score: 30 },
  fish_sashimi:  { id: 'fish_sashimi',  name: 'Fish Sashimi',  dish: 'plated', ingredients: ['fish'],  score: 20 },
  prawn_sashimi: { id: 'prawn_sashimi', name: 'Prawn Sashimi', dish: 'plated', ingredients: ['prawn'], score: 20 },
  // Overcooked 1 world 3: fish and potato chopped, deep-fried in a basket, laid on the plate.
  // Scores estimated in docs/research/oc1-recipes.md (15 for one piece, 25 for both).
  chips:          { id: 'chips',          name: 'Chips',          dish: 'fried', ingredients: ['potato'],         score: 15 },
  fried_fish:     { id: 'fried_fish',     name: 'Fried Fish',     dish: 'fried', ingredients: ['fish'],           score: 15 },
  fish_and_chips: { id: 'fish_and_chips', name: 'Fish and Chips', dish: 'fried', ingredients: ['fish', 'potato'], score: 25 },
  // Overcooked 2 world 1: sushi (nori, boiled rice, chopped fillings) and salad (chopped, no heat).
  // Scores follow docs/research/oc2-recipes.md section 4: 20 per prep step (estimate).
  fish_sushi:            { id: 'fish_sushi',            name: 'Fish Sushi',          dish: 'sushi', ingredients: ['fish', 'nori', 'rice'],             score: 40 },
  cucumber_sushi:        { id: 'cucumber_sushi',        name: 'Cucumber Sushi',      dish: 'sushi', ingredients: ['cucumber', 'nori', 'rice'],         score: 40 },
  fish_cucumber_sushi:   { id: 'fish_cucumber_sushi',   name: 'Fish Cucumber Sushi', dish: 'sushi', ingredients: ['cucumber', 'fish', 'nori', 'rice'], score: 60 },
  lettuce_salad:         { id: 'lettuce_salad',         name: 'Salad',               dish: 'salad', ingredients: ['lettuce'],                          score: 20 },
  tomato_salad:          { id: 'tomato_salad',          name: 'Tomato Salad',        dish: 'salad', ingredients: ['lettuce', 'tomato'],                score: 40 },
  cucumber_tomato_salad: { id: 'cucumber_tomato_salad', name: 'Cucumber Salad',      dish: 'salad', ingredients: ['cucumber', 'lettuce', 'tomato'],    score: 60 },
};

export function recipeDishType(recipe: Recipe): DishType {
  return recipe.dish ?? 'soup';
}

export function sortIngredients(list: readonly IngredientType[]): IngredientType[] {
  return [...list].sort();
}

export function dishMatchesRecipe(dish: Dish, recipe: Recipe): boolean {
  if (dish.type !== recipeDishType(recipe)) return false;
  if (dish.ingredients.length !== recipe.ingredients.length) return false;
  const a = sortIngredients(dish.ingredients);
  const b = sortIngredients(recipe.ingredients);
  return a.every((v, i) => v === b[i]);
}

export function recipeForDish(dish: Dish, recipeIds: readonly string[]): Recipe | null {
  for (const id of recipeIds) {
    const r = RECIPES[id];
    if (r && dishMatchesRecipe(dish, r)) return r;
  }
  return null;
}

/** True when the ingredient can be added to a burger plate (bun raw; toppings chopped; meat cooked). */
export function isBurgerComponent(type: IngredientType): boolean {
  return DISH_FAMILIES.burger?.parts[type] !== undefined;
}

/** True when the ingredient, once chopped, is laid straight on a plate as a 'plated' dish. */
export function isPlatedComponent(type: IngredientType): boolean {
  return PLATED_INGREDIENTS.includes(type);
}
