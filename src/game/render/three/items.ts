// ─── Item views ─────────────────────────────────────────────────────────────
// A small model group for every kind of item: ingredients in their raw, chopped and cooked
// forms, cookware with what is inside it, plates with soup or a stacked burger, dirty plate
// piles and the extinguisher. Views are rebuilt when an item's signature changes, so a
// frame usually allocates nothing.
import * as THREE from 'three';
import { BURGER_LAYERS, type BurgerLayer } from '../../../art/keys';
import { soupColor } from '../../../art/items';
import type { ModelRole } from '../../../art/models';
import type { Dish, IngredientType, Item, PotItem } from '../../../sim/types';
import { modelInstance, modelSize, tintObject } from './loader';

// ─── Constants ──────────────────────────────────────────────────────────────
const SOUP = { potRadius: 0.2, potLevel: 0.2, plateRadius: 0.17, plateLevel: 0.062, rawColor: 0xe9d6a8, segments: 24 } as const;
const PAN = { pattyOffsetZ: -0.12, pattyLift: 0.03 } as const;
const BURNT_TINT = 0x4a3a30;
const DIRTY_TINT = 0xb9a88f;
const STACK = { maxShown: 5, plateGap: 0.045, dirtyGap: 0.05, burgerGap: 0.005 } as const;
const EXTINGUISHER = { radius: 0.075, height: 0.34, bodyColor: 0xd9342b, capColor: 0x2a2a2a, hoseColor: 0x1c1c1c, segments: 16 } as const;

const INGREDIENT_ROLE: Readonly<Record<IngredientType, { raw: ModelRole; chopped: ModelRole; cooked?: ModelRole }>> = {
  onion: { raw: 'onion', chopped: 'onionChopped' },
  tomato: { raw: 'tomato', chopped: 'tomatoChopped' },
  mushroom: { raw: 'mushroom', chopped: 'mushroomChopped' },
  meat: { raw: 'meat', chopped: 'meatChopped', cooked: 'meatCooked' },
  bun: { raw: 'bun', chopped: 'bun' },
  lettuce: { raw: 'lettuce', chopped: 'lettuceChopped' },
  fish: { raw: 'fish', chopped: 'fishChopped' },
  prawn: { raw: 'prawn', chopped: 'prawnChopped' }, // the Food Kit has no prawn: a mussel stands in
};
/** Plated (sashimi, salad) pieces sit on the plate in a small ring. */
const PLATED = { ring: 0.07, scale: 0.85 } as const;
const BURGER_LAYER_ROLE: Readonly<Record<BurgerLayer, ModelRole>> = {
  bunBottom: 'bunBottom', meat: 'meatCooked', lettuce: 'lettuceSlice', tomato: 'tomatoSlice', bunTop: 'bunTop',
};
const BURGER_LAYER_INGREDIENT: Readonly<Record<BurgerLayer, IngredientType>> = {
  bunBottom: 'bun', meat: 'meat', lettuce: 'lettuce', tomato: 'tomato', bunTop: 'bun',
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
  const roles = INGREDIENT_ROLE[type];
  const role = cooked && roles.cooked ? roles.cooked : chopped ? roles.chopped : roles.raw;
  return modelInstance(role);
}

function potView(pot: PotItem): THREE.Group {
  const root = new THREE.Group();
  const pan = (pot.ware ?? 'pot') === 'pan';
  const ware = modelInstance(pan ? 'pan' : 'pot');
  root.add(ware);
  if (pot.contents.length === 0) return root;
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
    } else if (dish.type === 'plated') {
      const pieces = platedPieces(dish);
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
  dish.ingredients.forEach((ingredient, i) => {
    const piece = modelInstance(INGREDIENT_ROLE[ingredient].chopped);
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
  }
}
