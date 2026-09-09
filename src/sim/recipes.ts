import { PLATED_INGREDIENTS, type Dish, type DishType, type IngredientType, type Recipe } from './types';

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
  return type === 'bun' || type === 'meat' || type === 'lettuce' || type === 'tomato';
}

/** True when the ingredient, once chopped, is laid straight on a plate as a 'plated' dish. */
export function isPlatedComponent(type: IngredientType): boolean {
  return PLATED_INGREDIENTS.includes(type);
}
