// ─── Item views ─────────────────────────────────────────────────────────────
// A small model group for every kind of item: ingredients in their raw, chopped and cooked
// forms, cookware with what is inside it, plates with soup or a stacked burger, dirty plate
// piles and the extinguisher. Views are rebuilt when an item's signature changes, so a
// frame usually allocates nothing.
import * as THREE from 'three';
import { BURGER_LAYERS, type BurgerLayer } from '../../../art/keys';
import { soupColor } from '../../../art/items';
import type { ModelRole } from '../../../art/models';
import { DISH_FAMILIES } from '../../../sim/recipes';
import type { Dish, IngredientType, Item, PotItem, Prep, TrayItem } from '../../../sim/types';
import { modelInstance, modelSize, tintObject } from './loader';

// ─── Constants ──────────────────────────────────────────────────────────────
const SOUP = { potRadius: 0.2, potLevel: 0.2, plateRadius: 0.17, plateLevel: 0.062, rawColor: 0xe9d6a8, segments: 24 } as const;
const PAN = { pattyOffsetZ: -0.12, pattyLift: 0.03 } as const;
/** The frying basket: a wire cage with a handle, its piece inside. Fried fish is the fish model in batter gold. */
const BASKET = {
  radius: 0.17, height: 0.14, wire: 0x9aa0a8, handle: 0x2a2a2e, handleLength: 0.26, segments: 12, pieceLift: 0.02,
} as const;
const FRIED_TINT = 0xd89a3a;
/** Cut chips before the fryer: a few pale sticks. */
const STICKS = { count: 5, length: 0.2, width: 0.035, spread: 0.06, color: 0xf3e2b0 } as const;
const BURNT_TINT = 0x4a3a30;
const DIRTY_TINT = 0xb9a88f;
const STACK = { maxShown: 5, plateGap: 0.045, dirtyGap: 0.05, burgerGap: 0.005 } as const;
const EXTINGUISHER = { radius: 0.075, height: 0.34, bodyColor: 0xd9342b, capColor: 0x2a2a2a, hoseColor: 0x1c1c1c, segments: 16 } as const;
/** The tray (docs/MECHANICS.md section 3): its load laid along it, smaller, the top item last. */
const TRAY = { spread: 0.2, itemScale: 0.62, lift: 0.004 } as const;

const INGREDIENT_ROLE: Readonly<Record<IngredientType, { raw: ModelRole; chopped: ModelRole; cooked?: ModelRole }>> = {
  onion: { raw: 'onion', chopped: 'onionChopped' },
  tomato: { raw: 'tomato', chopped: 'tomatoChopped' },
  mushroom: { raw: 'mushroom', chopped: 'mushroomChopped' },
  meat: { raw: 'meat', chopped: 'meatChopped', cooked: 'meatCooked' },
  bun: { raw: 'bun', chopped: 'bun' },
  lettuce: { raw: 'lettuce', chopped: 'lettuceChopped' },
  fish: { raw: 'fish', chopped: 'fishChopped', cooked: 'fish' }, // cooked: tinted batter gold by ingredientView
  prawn: { raw: 'prawn', chopped: 'prawnChopped' }, // the Food Kit has no prawn: a mussel stands in
  potato: { raw: 'potato', chopped: 'potato', cooked: 'chips' }, // no potato in the kit: a coconut; cut chips are drawn sticks
  cucumber: { raw: 'cucumber', chopped: 'tomatoSlice' },          // no cucumber in the kit: a green eggplant, and green tomato slices
  rice: { raw: 'riceBag', chopped: 'riceBag', cooked: 'riceCooked' },
  nori: { raw: 'riceBag', chopped: 'riceBag' },                   // drawn as a sheet, never this model
  tortilla: { raw: 'riceBag', chopped: 'riceBag' },               // drawn as a disc, never this model
  chicken: { raw: 'chicken', chopped: 'chickenChopped', cooked: 'chickenCooked' },
  cheese: { raw: 'cheese', chopped: 'cheeseChopped' },
  pasta: { raw: 'riceBag', chopped: 'riceBag' },                  // drawn as sticks or a nest, never this model
};
/** Kit models tinted to stand in for an ingredient the kit lacks. */
const INGREDIENT_TINT: Readonly<Partial<Record<IngredientType, { raw?: number; chopped?: number }>>> = {
  cucumber: { raw: 0x3f8f3a, chopped: 0xb9e08a },
  chicken: { chopped: 0xf1b9a6 },
};
/** Tortilla, pasta and the burrito: simple shapes the kit has no model for. */
const TORTILLA = { radius: 0.17, thickness: 0.014, color: 0xe8cf93, segments: 20 } as const;
const PASTA = { stickLength: 0.3, stickRadius: 0.006, sticks: 7, raw: 0xf2dd8a, cooked: 0xf0d27a, nestRadius: 0.13, nestTube: 0.035 } as const;
const BURRITO = { radius: 0.065, length: 0.28 } as const;
/** Sauce on a plate of pasta, by the pan piece. */
const SAUCE_COLOR: Readonly<Partial<Record<IngredientType, number>>> = {
  tomato: 0xc8331f, meat: 0x6e3b22, mushroom: 0x8a6444, fish: 0xf1a07f, prawn: 0xf2896b,
};
const CHEESE_LAYER = { size: 0.3, thickness: 0.02, color: 0xf6c945 } as const;
/** A sheet of nori: a thin dark-green square. */
const NORI = { size: 0.26, thickness: 0.012, color: 0x23382a } as const;
/** A finished roll of sushi: maki slices, one kind per filling, side by side. */
const MAKI = { spacing: 0.12 } as const;
const MAKI_ROLE: Readonly<Partial<Record<IngredientType, ModelRole>>> = { fish: 'makiSalmon', cucumber: 'makiVegetable' };
/** Plated (sashimi, salad) pieces sit on the plate in a small ring. */
const PLATED = { ring: 0.07, scale: 0.85 } as const;
const BURGER_LAYER_ROLE: Readonly<Record<Exclude<BurgerLayer, 'cheese'>, ModelRole>> = {
  bunBottom: 'bunBottom', meat: 'meatCooked', lettuce: 'lettuceSlice', tomato: 'tomatoSlice', bunTop: 'bunTop',
};
const BURGER_LAYER_INGREDIENT: Readonly<Record<BurgerLayer, IngredientType>> = {
  bunBottom: 'bun', meat: 'meat', cheese: 'cheese', lettuce: 'lettuce', tomato: 'tomato', bunTop: 'bun',
};

// ─── Signatures ─────────────────────────────────────────────────────────────

/** Changes whenever the item would look different. */
export function itemSignature(item: Item): string {
  switch (item.kind) {
    case 'ingredient':
      return `ingredient:${item.type}:${item.chopped ? 1 : 0}:${item.cooked ? 1 : 0}`;
    case 'pot':
      return `pot:${item.ware ?? 'pot'}:${item.state}:${item.contents.join(',')}:${cookBucket(item)}`;
    case 'plate':
      return `plate:${item.count ?? 1}:${dishSignature(item.dish)}`;
    case 'dirtyPlate':
      return `dirtyPlate:${item.count}`;
    case 'extinguisher':
      return 'extinguisher';
    case 'tray':
      return `tray:${item.items.map((load) => itemSignature(load)).join('|')}`;
  }
}

function dishSignature(dish: Dish | null): string {
  if (!dish) return '';
  return `${dish.type}:${dish.ingredients.join(',')}`;
}

/** Broth colour steps through a few stages while cooking so the view is not rebuilt every frame. */
function cookBucket(pot: PotItem): number {
  return pot.state === 'cooking' ? Math.floor(pot.cookProgress * 4) : 0;
}

// ─── Builders ───────────────────────────────────────────────────────────────

function soupDisc(color: THREE.ColorRepresentation, radius: number, level: number): THREE.Mesh {
  const disc = new THREE.Mesh(
    new THREE.CircleGeometry(radius, SOUP.segments),
    new THREE.MeshStandardMaterial({ color, roughness: 0.35 }),
  );
  disc.rotation.x = -Math.PI / 2;
  disc.position.y = level;
  return disc;
}

function brothColor(pot: PotItem): THREE.Color {
  const soup = new THREE.Color(soupColor(pot.contents[0]));
  if (pot.state !== 'cooking') return soup;
  return new THREE.Color(SOUP.rawColor).lerp(soup, Math.min(1, cookBucket(pot) / 4));
}

function ingredientView(type: IngredientType, chopped: boolean, cooked: boolean): THREE.Group {
  if (type === 'potato' && chopped && !cooked) return rawChips();
  if (type === 'nori') return noriSheet();
  if (type === 'tortilla') return tortillaDisc();
  if (type === 'pasta') return cooked ? pastaNest() : pastaSticks();
  const roles = INGREDIENT_ROLE[type];
  const role = cooked && roles.cooked ? roles.cooked : chopped ? roles.chopped : roles.raw;
  const view = modelInstance(role);
  if (type === 'fish' && cooked) tintObject(view, FRIED_TINT);
  const tint = INGREDIENT_TINT[type];
  const colour = chopped ? tint?.chopped : tint?.raw;
  if (colour !== undefined && !cooked) tintObject(view, colour);
  return view;
}

/** The raw look of an ingredient, for the crates whose kit has no crate model of it. */
export function rawIngredientView(type: IngredientType): THREE.Group {
  return ingredientView(type, false, false);
}

/** A piece as it sits on a plate of the given family: raw, chopped, or out of its cookware. */
function pieceView(type: IngredientType, prep: Prep): THREE.Group {
  return ingredientView(type, prep !== 'raw', prep === 'pan' || prep === 'basket' || prep === 'boiled');
}

function tortillaDisc(): THREE.Group {
  const root = new THREE.Group();
  const disc = new THREE.Mesh(
    new THREE.CylinderGeometry(TORTILLA.radius, TORTILLA.radius, TORTILLA.thickness, TORTILLA.segments),
    new THREE.MeshStandardMaterial({ color: TORTILLA.color, roughness: 0.8 }),
  );
  disc.position.y = TORTILLA.thickness / 2;
  disc.castShadow = true;
  root.add(disc);
  return root;
}

function pastaSticks(): THREE.Group {
  const root = new THREE.Group();
  const material = new THREE.MeshStandardMaterial({ color: PASTA.raw, roughness: 0.6 });
  const geometry = new THREE.CylinderGeometry(PASTA.stickRadius, PASTA.stickRadius, PASTA.stickLength, 6);
  for (let i = 0; i < PASTA.sticks; i++) {
    const stick = new THREE.Mesh(geometry, material);
    stick.rotation.z = Math.PI / 2;
    stick.position.set(0, PASTA.stickRadius * (1 + (i % 2) * 2), (i - PASTA.sticks / 2) * PASTA.stickRadius * 2.4);
    stick.castShadow = true;
    root.add(stick);
  }
  return root;
}

function pastaNest(): THREE.Group {
  const root = new THREE.Group();
  const nest = new THREE.Mesh(
    new THREE.TorusGeometry(PASTA.nestRadius * 0.6, PASTA.nestTube, 8, 20),
    new THREE.MeshStandardMaterial({ color: PASTA.cooked, roughness: 0.5 }),
  );
  nest.rotation.x = -Math.PI / 2;
  nest.position.y = PASTA.nestTube;
  const middle = new THREE.Mesh(
    new THREE.CylinderGeometry(PASTA.nestRadius * 0.55, PASTA.nestRadius * 0.6, PASTA.nestTube * 1.6, 16),
    new THREE.MeshStandardMaterial({ color: PASTA.cooked, roughness: 0.5 }),
  );
  middle.position.y = PASTA.nestTube * 0.8;
  root.add(nest, middle);
  return root;
}

/** A plate of pasta: the nest, with a disc of sauce on top once there is one. */
function pastaDish(dish: Dish): THREE.Group | null {
  if (!dish.ingredients.includes('pasta')) return null;
  const root = pastaNest();
  const sauce = dish.ingredients.find((ing) => SAUCE_COLOR[ing] !== undefined);
  if (sauce) root.add(soupDisc(SAUCE_COLOR[sauce] ?? 0xc8331f, PASTA.nestRadius * 0.55, PASTA.nestTube * 1.8));
  return root;
}

/** A finished burrito (tortilla, rice and a filling): a rolled tortilla lying on the plate. */
function burritoDish(dish: Dish): THREE.Group | null {
  if (!dish.ingredients.includes('tortilla') || !dish.ingredients.includes('rice') || dish.ingredients.length < 3) return null;
  const root = new THREE.Group();
  const roll = new THREE.Mesh(
    new THREE.CylinderGeometry(BURRITO.radius, BURRITO.radius, BURRITO.length, 16),
    new THREE.MeshStandardMaterial({ color: TORTILLA.color, roughness: 0.8 }),
  );
  roll.rotation.z = Math.PI / 2;
  roll.position.y = BURRITO.radius;
  roll.castShadow = true;
  root.add(roll);
  return root;
}

function noriSheet(): THREE.Group {
  const root = new THREE.Group();
  const sheet = new THREE.Mesh(
    new THREE.BoxGeometry(NORI.size, NORI.thickness, NORI.size),
    new THREE.MeshStandardMaterial({ color: NORI.color, roughness: 0.6 }),
  );
  sheet.position.y = NORI.thickness / 2;
  sheet.castShadow = true;
  root.add(sheet);
  return root;
}

/** A finished sushi (nori, rice and at least one filling): a maki slice per filling. Anything less
 *  is still loose pieces. */
function makiView(dish: Dish): THREE.Group | null {
  if (!dish.ingredients.includes('nori') || !dish.ingredients.includes('rice')) return null;
  const fillings = dish.ingredients.filter((ing) => MAKI_ROLE[ing] !== undefined);
  if (fillings.length === 0) return null;
  const group = new THREE.Group();
  fillings.forEach((ing, i) => {
    const role = MAKI_ROLE[ing];
    if (!role) return;
    const slice = modelInstance(role);
    slice.position.x = (i - (fillings.length - 1) / 2) * MAKI.spacing;
    group.add(slice);
  });
  return group;
}

function rawChips(): THREE.Group {
  const root = new THREE.Group();
  const material = new THREE.MeshStandardMaterial({ color: STICKS.color, roughness: 0.8 });
  const geometry = new THREE.BoxGeometry(STICKS.length, STICKS.width, STICKS.width);
  for (let i = 0; i < STICKS.count; i++) {
    const stick = new THREE.Mesh(geometry, material);
    const angle = (i / STICKS.count) * Math.PI;
    stick.position.set(Math.cos(angle * 2) * STICKS.spread, STICKS.width / 2 + (i % 2) * STICKS.width, Math.sin(angle * 2) * STICKS.spread);
    stick.rotation.y = angle;
    stick.castShadow = true;
    root.add(stick);
  }
  return root;
}

/** The frying basket, and its piece raw, fried or burnt. */
function basketView(pot: PotItem): THREE.Group {
  const root = new THREE.Group();
  const cage = new THREE.Mesh(
    new THREE.CylinderGeometry(BASKET.radius, BASKET.radius * 0.85, BASKET.height, BASKET.segments, 1, true),
    new THREE.MeshStandardMaterial({ color: BASKET.wire, wireframe: true }),
  );
  cage.position.y = BASKET.height / 2;
  const handle = new THREE.Mesh(
    new THREE.BoxGeometry(BASKET.handleLength, 0.025, 0.025),
    new THREE.MeshStandardMaterial({ color: BASKET.handle }),
  );
  handle.position.set(BASKET.radius + BASKET.handleLength / 2, BASKET.height, 0);
  root.add(cage, handle);
  const type = pot.contents[0];
  if (!type) return root;
  const piece = ingredientView(type, true, pot.state === 'cooked' || pot.state === 'burnt');
  piece.position.y = BASKET.pieceLift;
  if (pot.state === 'burnt') tintObject(piece, BURNT_TINT);
  root.add(piece);
  return root;
}

function potView(pot: PotItem): THREE.Group {
  if (pot.ware === 'basket') return basketView(pot);
  const root = new THREE.Group();
  const pan = (pot.ware ?? 'pot') === 'pan';
  const ware = modelInstance(pan ? 'pan' : 'pot');
  root.add(ware);
  if (pot.contents.length === 0) return root;
  if (pan && pot.contents[0] !== 'meat') { // a sauce or a filling: the piece itself, browned once cooked
    const piece = ingredientView(pot.contents[0], true, pot.state === 'cooked' || pot.state === 'burnt');
    piece.position.set(0, PAN.pattyLift, PAN.pattyOffsetZ);
    if (pot.state === 'burnt') tintObject(piece, BURNT_TINT);
    root.add(piece);
    return root;
  }
  if (pan) {
    const patty = modelInstance(pot.state === 'cooking' ? 'meatChopped' : 'meatCooked');
    patty.position.set(0, PAN.pattyLift, PAN.pattyOffsetZ);
    if (pot.state === 'burnt') tintObject(patty, BURNT_TINT);
    root.add(patty);
    return root;
  }
  if (pot.state === 'burnt') {
    tintObject(ware, 0x8a8078);
    root.add(soupDisc(0x1e1a16, SOUP.potRadius, SOUP.potLevel));
    return root;
  }
  root.add(soupDisc(brothColor(pot), SOUP.potRadius, SOUP.potLevel));
  return root;
}

function burgerStack(dish: Dish): THREE.Group {
  const stack = new THREE.Group();
  let level = 0;
  for (const layer of BURGER_LAYERS) {
    if (!dish.ingredients.includes(BURGER_LAYER_INGREDIENT[layer])) continue;
    if (layer === 'cheese') {
      const slice = new THREE.Mesh(
        new THREE.BoxGeometry(CHEESE_LAYER.size, CHEESE_LAYER.thickness, CHEESE_LAYER.size),
        new THREE.MeshStandardMaterial({ color: CHEESE_LAYER.color, roughness: 0.5 }),
      );
      slice.rotation.y = Math.PI / 4;
      slice.position.y = level + CHEESE_LAYER.thickness / 2;
      stack.add(slice);
      level += CHEESE_LAYER.thickness + STACK.burgerGap;
      continue;
    }
    const part = modelInstance(BURGER_LAYER_ROLE[layer]);
    part.position.y = level;
    stack.add(part);
    level += modelSize(BURGER_LAYER_ROLE[layer]).y + STACK.burgerGap;
  }
  return stack;
}

function plateView(count: number, dish: Dish | null): THREE.Group {
  const root = new THREE.Group();
  const plateHeight = modelSize('plate').y;
  const shown = Math.min(STACK.maxShown, Math.max(1, count));
  for (let i = 0; i < shown; i++) {
    const plate = modelInstance('plate');
    plate.position.y = i * STACK.plateGap;
    root.add(plate);
  }
  const top = (shown - 1) * STACK.plateGap;
  if (dish && dish.ingredients.length > 0) {
    if (dish.type === 'burger') {
      const stack = burgerStack(dish);
      stack.position.y = top + plateHeight;
      root.add(stack);
    } else if (DISH_FAMILIES[dish.type]) {
      const whole = dish.type === 'sushi' ? makiView(dish) : dish.type === 'pasta' ? pastaDish(dish) : dish.type === 'burrito' ? burritoDish(dish) : null;
      const pieces = whole ?? platedPieces(dish);
      pieces.position.y = top + plateHeight;
      root.add(pieces);
    } else {
      root.add(soupDisc(soupColor(dish.ingredients[0]), SOUP.plateRadius, top + SOUP.plateLevel));
    }
  }
  return root;
}

/** Each plated ingredient's chopped model, laid around the plate's centre. */
function platedPieces(dish: Dish): THREE.Group {
  const group = new THREE.Group();
  const count = dish.ingredients.length;
  const family = DISH_FAMILIES[dish.type];
  dish.ingredients.forEach((ingredient, i) => {
    const piece = pieceView(ingredient, family?.parts[ingredient] ?? 'chopped');
    piece.scale.setScalar(PLATED.scale);
    const angle = (i / count) * Math.PI * 2;
    const radius = count === 1 ? 0 : PLATED.ring;
    piece.position.set(Math.cos(angle) * radius, 0, Math.sin(angle) * radius);
    piece.rotation.y = angle;
    group.add(piece);
  });
  return group;
}

function dirtyPlateView(count: number): THREE.Group {
  const root = new THREE.Group();
  const shown = Math.min(STACK.maxShown, Math.max(1, count));
  for (let i = 0; i < shown; i++) {
    const plate = modelInstance('plateDirty');
    plate.position.y = i * STACK.dirtyGap;
    plate.rotation.y = i * 0.4;
    tintObject(plate, DIRTY_TINT);
    root.add(plate);
  }
  return root;
}

function extinguisherView(): THREE.Group {
  const root = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(EXTINGUISHER.radius, EXTINGUISHER.radius, EXTINGUISHER.height, EXTINGUISHER.segments),
    new THREE.MeshStandardMaterial({ color: EXTINGUISHER.bodyColor, roughness: 0.4 }),
  );
  body.position.y = EXTINGUISHER.height / 2;
  const cap = new THREE.Mesh(
    new THREE.CylinderGeometry(EXTINGUISHER.radius * 0.5, EXTINGUISHER.radius * 0.7, EXTINGUISHER.height * 0.18, EXTINGUISHER.segments),
    new THREE.MeshStandardMaterial({ color: EXTINGUISHER.capColor }),
  );
  cap.position.y = EXTINGUISHER.height + EXTINGUISHER.height * 0.09;
  const hose = new THREE.Mesh(
    new THREE.TorusGeometry(EXTINGUISHER.radius * 0.9, EXTINGUISHER.radius * 0.18, 8, 16, Math.PI),
    new THREE.MeshStandardMaterial({ color: EXTINGUISHER.hoseColor }),
  );
  hose.position.set(EXTINGUISHER.radius * 0.6, EXTINGUISHER.height * 0.75, 0);
  hose.rotation.z = Math.PI / 2;
  for (const mesh of [body, cap, hose]) mesh.castShadow = true;
  root.add(body, cap, hose);
  return root;
}

/** The tray with its load laid along it: one item centred, two or three spaced across. */
function trayView(tray: TrayItem): THREE.Group {
  const root = new THREE.Group();
  root.add(modelInstance('tray'));
  const top = modelSize('tray').y + TRAY.lift;
  const count = tray.items.length;
  tray.items.forEach((load, i) => {
    const view = buildItemView(load);
    view.scale.setScalar(TRAY.itemScale);
    view.position.set(count === 1 ? 0 : (i - (count - 1) / 2) * TRAY.spread, top, 0);
    root.add(view);
  });
  return root;
}

/** A fresh group for the item, resting on y = 0 and centred on the item slot. */
export function buildItemView(item: Item): THREE.Group {
  switch (item.kind) {
    case 'ingredient':
      return ingredientView(item.type, item.chopped, item.cooked === true);
    case 'pot':
      return potView(item);
    case 'plate':
      return plateView(item.count ?? 1, item.dish);
    case 'dirtyPlate':
      return dirtyPlateView(item.count);
    case 'extinguisher':
      return extinguisherView();
    case 'tray':
      return trayView(item);
  }
}
