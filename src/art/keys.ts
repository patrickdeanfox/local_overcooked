// ─── Texture key contract ───────────────────────────────────────────────────
// Presentation looks textures up through TEX.*; the art module must generate every key
// that ALL_TEXTURE_KEYS() lists. Sizes are in native pixels at TILE = 64.
import { TILE } from '../config';
import { INGREDIENT_TYPES, type Facing, type IngredientType, type TileType } from '../sim/types';

export const TILE_TYPES: readonly TileType[] = [
  'void', 'floor', 'road', 'counter', 'crate', 'board', 'stove', 'sink', 'drying', 'plateReturn', 'serve', 'trash', 'plateStack', 'slider',
];
export const FACINGS: readonly Facing[] = ['up', 'down', 'left', 'right'];
export const CHEF_COUNT = 2;

export const TEX = {
  /** 64x64 tile. Crates use TEX.crate(ingredient) instead of TEX.tile('crate'). */
  tile: (type: TileType): string => `tile.${type}`,
  crate: (ingredient: IngredientType): string => `tile.crate.${ingredient}`,
  /** ~40x40 item sprites drawn centred; raw vs chopped ingredient. */
  ingredient: (type: IngredientType, chopped: boolean): string => `item.${type}.${chopped ? 'chopped' : 'raw'}`,
  pot: 'item.pot',
  potSoup: (ingredient: IngredientType): string => `item.pot.soup.${ingredient}`,
  potBurnt: 'item.pot.burnt',
  plate: 'item.plate',
  plateSoup: (ingredient: IngredientType): string => `item.plate.soup.${ingredient}`,
  dirtyPlate: 'item.dirtyPlate',
  extinguisher: 'item.extinguisher',
  fire: 'fx.fire',           // 64x64, one frame; presentation animates scale/alpha
  spray: 'fx.spray',
  smoke: 'fx.smoke',
  /** 64x80 chef facing a direction; index 0 = blue, 1 = red. */
  chef: (index: number, facing: Facing): string => `chef.${index}.${facing}`,
  /** HUD icons ~32x32. */
  icon: (ingredient: IngredientType): string => `icon.${ingredient}`,
  iconSoup: (ingredient: IngredientType): string => `icon.soup.${ingredient}`,
  iconPlate: 'icon.plate',
  iconClock: 'icon.clock',
  iconCoin: 'icon.coin',
  iconStar: 'icon.star',
  iconStarEmpty: 'icon.star.empty',
  orderCard: 'ui.orderCard',   // 96x120 panel background for one order
  panel: 'ui.panel',           // rounded panel background
  buttonPrompt: (label: string): string => `ui.prompt.${label}`, // see PROMPT_LABELS
} as const;

export const PROMPT_LABELS = ['A', 'B', 'X', 'Y', 'Cross', 'Circle', 'Square', 'Triangle', 'Space', 'Enter', 'Shift', 'Ctrl'] as const;

export function ALL_TEXTURE_KEYS(): string[] {
  const keys: string[] = [];
  for (const t of TILE_TYPES) if (t !== 'crate') keys.push(TEX.tile(t));
  for (const i of INGREDIENT_TYPES) {
    keys.push(TEX.crate(i), TEX.ingredient(i, false), TEX.ingredient(i, true), TEX.potSoup(i), TEX.plateSoup(i), TEX.icon(i), TEX.iconSoup(i));
  }
  keys.push(TEX.pot, TEX.potBurnt, TEX.plate, TEX.dirtyPlate, TEX.extinguisher, TEX.fire, TEX.spray, TEX.smoke);
  for (let c = 0; c < CHEF_COUNT; c++) for (const f of FACINGS) keys.push(TEX.chef(c, f));
  keys.push(TEX.iconPlate, TEX.iconClock, TEX.iconCoin, TEX.iconStar, TEX.iconStarEmpty, TEX.orderCard, TEX.panel);
  for (const l of PROMPT_LABELS) keys.push(TEX.buttonPrompt(l));
  return keys;
}

export const TEXTURE_SIZES = { tile: TILE, item: 40, chefW: TILE, chefH: 80, icon: 32, orderCardW: 96, orderCardH: 120 } as const;
