import type { Dish, IngredientType, Recipe } from './types';

// Overcooked 1 soups: three chopped ingredients of one kind. Scores to be confirmed by research.
export const RECIPES: Record<string, Recipe> = {
  onion_soup:    { id: 'onion_soup',    name: 'Onion Soup',    ingredients: ['onion', 'onion', 'onion'],          score: 20 },
  tomato_soup:   { id: 'tomato_soup',   name: 'Tomato Soup',   ingredients: ['tomato', 'tomato', 'tomato'],       score: 20 },
  mushroom_soup: { id: 'mushroom_soup', name: 'Mushroom Soup', ingredients: ['mushroom', 'mushroom', 'mushroom'], score: 20 },
};

export function sortIngredients(list: readonly IngredientType[]): IngredientType[] {
  return [...list].sort();
}

export function dishMatchesRecipe(dish: Dish, recipe: Recipe): boolean {
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
