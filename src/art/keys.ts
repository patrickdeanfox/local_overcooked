// ─── Texture key contract ───────────────────────────────────────────────────
// Presentation looks textures up through TEX.*; the art module must generate every key
// that ALL_TEXTURE_KEYS() lists. Sizes are in native pixels at TILE = 64.
import { TILE } from '../config';
import {
  FRIED_INGREDIENTS, INGREDIENT_TYPES, SOUP_INGREDIENTS,
  type Facing, type IngredientType, type TileType,
} from '../sim/types';

export const TILE_TYPES: readonly TileType[] = [
  'void', 'floor', 'road', 'counter', 'crate', 'board', 'stove', 'sink', 'drying', 'plateReturn', 'serve', 'trash', 'plateStack', 'slider', 'gate',
];
export const FACINGS: readonly Facing[] = ['up', 'down', 'left', 'right'];
export const CHEF_COUNT = 2;

/** Layers of a plated burger, drawn bottom to top in this order. */
export type BurgerLayer = 'bunBottom' | 'meat' | 'lettuce' | 'tomato' | 'bunTop';
export const BURGER_LAYERS: readonly BurgerLayer[] = ['bunBottom', 'meat', 'lettuce', 'tomato', 'bunTop'];
export type PanContentState = 'raw' | 'cooked' | 'burnt';

export const TEX = {
  /** 64x64 tile. Crates use TEX.crate(ingredient) instead of TEX.tile('crate'). */
  tile: (type: TileType): string => `tile.${type}`,
  gateClosed: 'tile.gate.closed',  // 64x64 overlay/face for a closed gate tile (raised floor edge)
  crate: (ingredient: IngredientType): string => `tile.crate.${ingredient}`,
  /** ~40x40 item sprites drawn centred; raw vs chopped ingredient. */
  ingredient: (type: IngredientType, chopped: boolean): string => `item.${type}.${chopped ? 'chopped' : 'raw'}`,
  /** Fried ingredient after the pan (meat → cooked patty). */
  ingredientCooked: (type: IngredientType): string => `item.${type}.cooked`,
  pot: 'item.pot',
  potSoup: (ingredient: IngredientType): string => `item.pot.soup.${ingredient}`,
  potBurnt: 'item.pot.burnt',
  pan: 'item.pan',
  panMeat: (state: PanContentState): string => `item.pan.meat.${state}`,
  plate: 'item.plate',
  plateSoup: (ingredient: IngredientType): string => `item.plate.soup.${ingredient}`,
  /** 40x40 burger layer, drawn on top of TEX.plate and stacked BURGER_LAYER_STEP_PX apart. */
  burgerLayer: (layer: BurgerLayer): string => `item.burger.${layer}`,
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
  iconBurger: 'icon.burger',
  iconPlate: 'icon.plate',
  iconClock: 'icon.clock',
  iconCoin: 'icon.coin',
  iconStar: 'icon.star',
  iconStarEmpty: 'icon.star.empty',
  iconLock: 'icon.lock',
  orderCard: 'ui.orderCard',   // 96x120 panel background for one order
  panel: 'ui.panel',           // rounded panel background
  buttonPrompt: (label: string): string => `ui.prompt.${label}`, // see PROMPT_LABELS
} as const;

export const PROMPT_LABELS = ['A', 'B', 'X', 'Y', 'Cross', 'Circle', 'Square', 'Triangle', 'Space', 'Enter', 'Shift', 'Ctrl'] as const;
export const PAN_CONTENT_STATES: readonly PanContentState[] = ['raw', 'cooked', 'burnt'];

export function ALL_TEXTURE_KEYS(): string[] {
  const keys: string[] = [];
  for (const t of TILE_TYPES) if (t !== 'crate') keys.push(TEX.tile(t));
  keys.push(TEX.gateClosed);
  for (const i of INGREDIENT_TYPES) keys.push(TEX.crate(i), TEX.ingredient(i, false), TEX.ingredient(i, true), TEX.icon(i));
  for (const i of SOUP_INGREDIENTS) keys.push(TEX.potSoup(i), TEX.plateSoup(i), TEX.iconSoup(i));
  for (const i of FRIED_INGREDIENTS) keys.push(TEX.ingredientCooked(i));
  for (const s of PAN_CONTENT_STATES) keys.push(TEX.panMeat(s));
  for (const l of BURGER_LAYERS) keys.push(TEX.burgerLayer(l));
  keys.push(TEX.pot, TEX.potBurnt, TEX.pan, TEX.plate, TEX.dirtyPlate, TEX.extinguisher, TEX.fire, TEX.spray, TEX.smoke);
  for (let c = 0; c < CHEF_COUNT; c++) for (const f of FACINGS) keys.push(TEX.chef(c, f));
  keys.push(TEX.iconBurger, TEX.iconPlate, TEX.iconClock, TEX.iconCoin, TEX.iconStar, TEX.iconStarEmpty, TEX.iconLock, TEX.orderCard, TEX.panel);
  for (const l of PROMPT_LABELS) keys.push(TEX.buttonPrompt(l));
  return keys;
}

export const TEXTURE_SIZES = {
  tile: TILE, item: 40, chefW: TILE, chefH: 80, icon: 32, orderCardW: 96, orderCardH: 120,
  // Added by the art module (additive): sizes of the remaining generated textures.
  fire: TILE, fx: 40, panelW: 256, panelH: 160, promptW: 48, promptH: 32,
} as const;
/** Burger layers are item-sized (40x40) sprites with the layer centred; presentation stacks
 *  them on a plate, each BURGER_LAYER_STEP_PX above the previous one. */
export const BURGER_LAYER_STEP_PX = 5;
