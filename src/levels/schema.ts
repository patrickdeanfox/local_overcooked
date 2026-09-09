// ─── Level definition contract ──────────────────────────────────────────────
// Levels are JSON files in src/levels/<game>/<name>.json matching LevelDef.
// Human-readable ASCII grid + fixed legend. See docs/LEVEL_SCHEMA.md.
import {
  CHOPPED_INGREDIENTS, FRIED_INGREDIENTS, SOUP_INGREDIENTS,
  type IngredientType, type Item, type ItemKind, type SimEventType, type Tile, type TileType, type Ware,
} from '../sim/types';
import { RECIPES, recipeDishType } from '../sim/recipes';

export interface LevelStars { 1: [number, number, number]; 2: [number, number, number]; } // 1-star, 2-star, 3-star score

export interface OrderSettings {
  initial: number;     // orders shown at level start
  intervalSec: number; // seconds between new orders (when below max)
  max: number;         // max concurrent orders
  timeSec: number;     // seconds each order stays before expiring
  first?: string[];    // recipes of the first tickets, in order, before the seed takes over; tutorials pin what the board shows
}

export interface PlateSettings {
  mode: 'sink' | 'stack'; // 'sink': dirty plates return and must be washed. 'stack': clean plates respawn on plateStack tiles.
  count: number;          // plates in play at start (placed via legend 'p' or on plateStack/drying tiles)
}

export interface StationOverride {
  x: number;
  y: number;
  type?: TileType;
  ingredient?: IngredientType;
  group?: string;
  stock?: number;  // crate, 86 system: this crate's size instead of eightySix.crateSize (also makes an exempt ingredient finite)
}

/** 86 system (docs/MECHANICS.md section 5). Only read while the eightySix mechanic is on. */
export interface EightySixSettings {
  crateSize?: number;        // items per crate; CRATE_SIZE when absent
  restockDelaySec?: number;  // seconds from a shortage to its delivery; RESTOCK_DELAY_SEC when absent
  exempt?: IngredientType[]; // ingredients whose crates never run out, on top of the automatic rule: an
                             // ingredient in every recipe of the level (its "bread") is exempt unless a crate override sets stock
  scripted?: { atSec: number; ingredient: IngredientType }[]; // shortages on a timer: the crates of the ingredient empty at atSec
}

export interface ItemPlacement { x: number; y: number; item: ItemKind; count?: number; ware?: Ware; }

// ─── Tutorials ──────────────────────────────────────────────────────────────
/** The five mechanics switches (docs/MECHANICS.md), named as Modifiers names them. */
export type MechanicKey = 'twoPlateCarry' | 'chopAssist' | 'tray' | 'passThroughShelf' | 'eightySix';
export const MECHANIC_KEYS: readonly MechanicKey[] = ['twoPlateCarry', 'chopAssist', 'tray', 'passThroughShelf', 'eightySix'];
/** Mechanics a level always plays with, whatever the Settings switches say. A tutorial kitchen needs its own. */
export type LevelMechanics = Partial<Record<MechanicKey, boolean>>;

/** A block of tiles: x..x+w-1 by y..y+h-1. */
export interface TileRect { x: number; y: number; w: number; h: number; }

/** What finishes a tutorial step. Checked against the SimState and that frame's events after every stepped frame. */
export type TutorialGoal =
  | { type: 'event'; event: SimEventType; count?: number }  // `count` (1) events of the type since the step began
  | { type: 'holding'; kind: ItemKind; count?: number; load?: number; zone?: TileRect } // a chef holds the item: exactly `count` plates in the stack, at least `load` items on the tray, standing inside `zone`
  | { type: 'tileItem'; x: number; y: number; w?: number; h?: number; kind: ItemKind } // an item of the kind rests on the tile, or on any tile of the w by h block
  | { type: 'stock'; x: number; y: number; max: number }        // the crate holds at most `max` items (0: it is 86'd)
  | { type: 'served'; count: number }                           // servedCount reaches `count`
  | { type: 'assisting' }                                       // a chef is the second pair of hands at a station
  | { type: 'wait'; sec: number };                              // sim seconds; for a step that only explains

export interface TutorialStep {
  text: string;                  // what to do; {pickup} {interact} {throw} {dash} become the player's own button labels
  goal: TutorialGoal;
  at?: { x: number; y: number }; // a tile the pointer hangs over
  minPlayers?: number;           // the step is skipped in a run with fewer players
}

/** A guided walkthrough at the start of a level: the rules on a panel first, then one step at a time. */
export interface TutorialDef {
  title: string;     // the panel heading, e.g. 'The tray'
  intro: string[];   // the rules, one line each; the same placeholders as the steps
  steps: TutorialStep[];
  outro?: string;    // the banner after the last step; a stock line when absent
}

export type Dynamic =
  | {
      type: 'pedestrians';   // 1-2 crosswalk: walkers cross on 'road' tiles and block chefs
      lanes: { from: { x: number; y: number }; to: { x: number; y: number } }[];
      intervalSec: number;   // seconds between spawns per lane
      speed: number;         // tiles per second
      firstDelaySec?: number;
    }
  | {
      type: 'sliders';       // 1-3 ship: 'slider' tiles of this group oscillate along an axis
      group: string;         // matches Tile.group ('1'..'4' from the legend)
      axis: 'x' | 'y';
      amplitude: number;     // tiles, peak offset from the drawn position
      periodSec: number;     // full back-and-forth cycle
      phase?: number;        // 0..1 cycle offset
    }
  | {
      type: 'gate';          // 1-6 earthquake: 'gate' tiles of this group are walkable only while open
      group: string;         // matches Tile.group ('G' legend tiles are group '1'; use stations for others)
      periodSec: number;     // full open+closed cycle
      openSec: number;       // seconds open per cycle
      phase?: number;        // 0..1 cycle offset; the cycle starts open
    };

export interface LevelDef {
  id: string;            // 'oc1-1-1'
  name: string;          // '1-1'
  game: 'oc1' | 'oc2' | 'custom' | 'tutorial'; // 'tutorial': listed on the Tutorials page, not the title
  world: number;
  index: number;
  theme: string;         // e.g. 'treacle-town', 'savoury-seas'
  description?: string;  // a sentence or two for the level card: the kitchen and what it throws at you, never how to beat it
  strategy?: string;     // how to beat it, from the wiki's Strategies where there is a page; shown only on demand
  source?: string;       // wiki URL the layout was transcribed from
  unlockStars?: number;  // total stars needed to unlock (wiki infobox); absent or 0 = always open
  timeLimitSec: number;
  timerStartsOnFirstServe: boolean;
  recipes: string[];     // ids into RECIPES
  orders: OrderSettings;
  stars: LevelStars;
  plates: PlateSettings;
  grid: string[];        // rows of equal length, chars from LEGEND
  spawns: { x: number; y: number }[]; // chef start tiles, index = player
  stations?: StationOverride[];
  items?: ItemPlacement[];
  dynamics?: Dynamic[];
  eightySix?: EightySixSettings; // 86 system tuning; the mechanic works without it using the constants
  mechanics?: LevelMechanics;    // switches this level always plays with, on top of the Settings
  tutorial?: TutorialDef;        // the guided walkthrough shown when the level starts
}

export interface LegendEntry { type: TileType; ingredient?: IngredientType; group?: string; item?: ItemKind; ware?: Ware; }

export const LEGEND: Readonly<Record<string, LegendEntry>> = Object.freeze({
  ' ': { type: 'void' },
  '.': { type: 'floor' },
  '~': { type: 'road' },
  '#': { type: 'counter' },
  'O': { type: 'crate', ingredient: 'onion' },
  'T': { type: 'crate', ingredient: 'tomato' },
  'M': { type: 'crate', ingredient: 'mushroom' },
  'A': { type: 'crate', ingredient: 'meat' },
  'U': { type: 'crate', ingredient: 'bun' },
  'L': { type: 'crate', ingredient: 'lettuce' },
  'B': { type: 'board' },
  'S': { type: 'stove', item: 'pot', ware: 'pot' },
  'F': { type: 'stove', item: 'pot', ware: 'pan' },
  'W': { type: 'sink' },
  'D': { type: 'drying' },
  'R': { type: 'plateReturn' },
  'V': { type: 'serve' },
  'X': { type: 'trash' },
  'E': { type: 'counter', item: 'extinguisher' },
  'P': { type: 'plateStack', item: 'plate' },
  'p': { type: 'counter', item: 'plate' },
  '1': { type: 'slider', group: '1' },
  '2': { type: 'slider', group: '2' },
  '3': { type: 'slider', group: '3' },
  '4': { type: 'slider', group: '4' },
  'G': { type: 'gate', group: '1' },
  '_': { type: 'gap' },
  'J': { type: 'crate', ingredient: 'fish' },
  'Ø': { type: 'crate', ingredient: 'prawn' },
  'C': { type: 'crate' },  // ingredient set by a stations override; validateLevel insists
  // Mechanics spec (docs/MECHANICS.md). Lowercase, so the catalog's uppercase extension characters stay free.
  'h': { type: 'shelf' },                  // pass-through shelf (a hatch in a wall)
  't': { type: 'trayRack', item: 'tray' }, // tray rack, the tray on it; the sim removes the tray while the mechanic is off
  'd': { type: 'delivery' },               // delivery door for restocks
});

/** Tiles a chef body cannot enter. 'gate' is walkable while open, so it is not listed; the sim closes it.
 *  'gap' is not listed either: it has no wall, a chef walks straight in and falls. */
export const SOLID_TILES: ReadonlySet<TileType> = new Set<TileType>([
  'void', 'counter', 'crate', 'board', 'stove', 'sink', 'drying', 'plateReturn', 'serve', 'trash', 'plateStack', 'slider',
  'shelf', 'trayRack', 'delivery',
]);
/** Tiles a chef can stand on: not solid, and not a hole. Spawns and paths need this. */
export function isWalkable(type: TileType): boolean { return !SOLID_TILES.has(type) && type !== 'gap'; }

export interface ParsedGrid { width: number; height: number; tiles: Tile[]; items: (Item | null)[]; }

let nextItemId = 1;
export function makeItem(kind: ItemKind, count = 1, ware?: Ware): Item {
  const id = nextItemId++;
  switch (kind) {
    case 'ingredient': return { kind, id, type: 'onion', chopped: false, chopProgress: 0 };
    case 'pot': return ware === 'pan'
      ? { kind, id, ware: 'pan', contents: [], state: 'empty', cookProgress: 0, burnProgress: 0 }
      : { kind, id, contents: [], state: 'empty', cookProgress: 0, burnProgress: 0 };
    case 'plate': return { kind, id, dish: null };
    case 'dirtyPlate': return { kind, id, count };
    case 'extinguisher': return { kind, id };
    case 'tray': return { kind, id, items: [] };
  }
}

/** Expands the ASCII grid, legend, station overrides, and item placements into tiles + items. */
export function parseGrid(level: LevelDef): ParsedGrid {
  const height = level.grid.length;
  const width = height ? level.grid[0].length : 0;
  const tiles: Tile[] = [];
  const items: (Item | null)[] = [];
  for (let y = 0; y < height; y++) {
    const row = level.grid[y];
    for (let x = 0; x < width; x++) {
      const ch = row[x] ?? ' ';
      const entry = LEGEND[ch] ?? LEGEND[' '];
      const tile: Tile = { x, y, type: entry.type };
      if (entry.ingredient) tile.ingredient = entry.ingredient;
      if (entry.group) tile.group = entry.group;
      tiles.push(tile);
      items.push(entry.item ? makeItem(entry.item, 1, entry.ware) : null);
    }
  }
  for (const s of level.stations ?? []) {
    const t = tiles[s.y * width + s.x];
    if (!t) continue;
    if (s.type) t.type = s.type;
    if (s.ingredient) t.ingredient = s.ingredient;
    if (s.group) t.group = s.group;
    if (s.stock !== undefined) t.capacity = s.stock; // the sim turns capacity into stock when the 86 mechanic is on
  }
  for (const p of level.items ?? []) {
    const i = p.y * width + p.x;
    if (i < 0 || i >= items.length) continue;
    items[i] = makeItem(p.item, p.count, p.ware);
  }
  return { width, height, tiles, items };
}

/** Returns a list of problems; empty means the level is valid. */
export function validateLevel(level: LevelDef): string[] {
  const errors: string[] = [];
  if (!level.id) errors.push('missing id');
  if (!level.grid?.length) errors.push('grid is empty');
  const width = level.grid?.[0]?.length ?? 0;
  level.grid?.forEach((row, y) => {
    if (row.length !== width) errors.push(`row ${y} has length ${row.length}, expected ${width}`);
    for (const ch of row) if (!(ch in LEGEND)) errors.push(`row ${y}: unknown legend char '${ch}'`);
  });
  if (!level.spawns || level.spawns.length < 2) errors.push('need at least 2 spawns');
  const parsed = parseGrid(level);
  for (const s of level.spawns ?? []) {
    const t = parsed.tiles[s.y * parsed.width + s.x];
    if (!t) errors.push(`spawn (${s.x},${s.y}) is off the grid`);
    else if (!isWalkable(t.type)) errors.push(`spawn (${s.x},${s.y}) is not on a walkable tile`);
  }
  const count = (type: TileType) => parsed.tiles.filter((t) => t.type === type).length;
  const crates = new Set(parsed.tiles.filter((t) => t.type === 'crate').map((t) => t.ingredient));
  const wares = new Set<Ware>();
  parsed.items.forEach((item, i) => {
    if (item?.kind === 'pot' && parsed.tiles[i].type === 'stove') wares.add(item.ware ?? 'pot');
  });
  for (const t of parsed.tiles) {
    if (t.type === 'crate' && !t.ingredient) errors.push(`crate (${t.x},${t.y}) has no ingredient: use a stations override`);
  }
  if (count('serve') === 0) errors.push('no serve tile');
  if (count('crate') === 0) errors.push('no crate tile');
  if (!level.recipes?.length) errors.push('no recipes');
  for (const id of level.recipes ?? []) {
    const recipe = RECIPES[id];
    if (!recipe) { errors.push(`unknown recipe '${id}'`); continue; }
    for (const ingredient of new Set(recipe.ingredients)) {
      if (!crates.has(ingredient)) errors.push(`recipe '${id}' needs a ${ingredient} crate`);
    }
    if (recipeDishType(recipe) === 'soup' && !wares.has('pot')) errors.push(`recipe '${id}' needs a stove with a pot`);
    if (recipe.ingredients.some((i) => FRIED_INGREDIENTS.includes(i)) && !wares.has('pan')) errors.push(`recipe '${id}' needs a stove with a pan`);
    if (recipe.ingredients.some((i) => CHOPPED_INGREDIENTS.includes(i)) && count('board') === 0) errors.push(`recipe '${id}' needs a chopping board`);
    if (recipeDishType(recipe) === 'soup' && recipe.ingredients.some((i) => !SOUP_INGREDIENTS.includes(i))) errors.push(`recipe '${id}' has a non-soup ingredient`);
  }
  if (level.plates.mode === 'sink' && (count('sink') === 0 || count('plateReturn') === 0)) errors.push("plates.mode 'sink' needs a sink and a plateReturn tile");
  if (level.plates.mode === 'stack' && count('plateStack') === 0) errors.push("plates.mode 'stack' needs a plateStack tile");
  if (!(level.timeLimitSec > 0)) errors.push('timeLimitSec must be > 0');
  if (level.unlockStars !== undefined && !(level.unlockStars >= 0)) errors.push('unlockStars must be >= 0');
  const gateGroups = new Set(parsed.tiles.filter((t) => t.type === 'gate').map((t) => t.group));
  for (const d of level.dynamics ?? []) {
    if (d.type === 'sliders' && !parsed.tiles.some((t) => t.type === 'slider' && t.group === d.group)) errors.push(`sliders group '${d.group}' has no slider tiles`);
    if (d.type === 'pedestrians' && count('road') === 0) errors.push('pedestrians need road tiles');
    if (d.type === 'gate') {
      if (!gateGroups.has(d.group)) errors.push(`gate group '${d.group}' has no gate tiles`);
      if (!(d.openSec > 0 && d.openSec < d.periodSec)) errors.push(`gate group '${d.group}': openSec must be within (0, periodSec)`);
      gateGroups.delete(d.group);
    }
  }
  for (const g of gateGroups) errors.push(`gate tiles of group '${g}' have no gate dynamic`);
  // Mechanics spec: crate sizes and scripted shortages must name real crates; the tray needs its rack.
  for (const s of level.stations ?? []) {
    if (s.stock === undefined) continue;
    const t = parsed.tiles[s.y * parsed.width + s.x];
    if (!t || t.type !== 'crate') errors.push(`stock override at (${s.x},${s.y}) is not on a crate`);
    else if (!(s.stock >= 1)) errors.push(`stock override at (${s.x},${s.y}) must be >= 1`);
  }
  const es = level.eightySix;
  if (es) {
    if (es.crateSize !== undefined && !(es.crateSize >= 1)) errors.push('eightySix.crateSize must be >= 1');
    if (es.restockDelaySec !== undefined && !(es.restockDelaySec > 0)) errors.push('eightySix.restockDelaySec must be > 0');
    for (const ingredient of es.exempt ?? []) {
      if (!crates.has(ingredient)) errors.push(`eightySix.exempt names ${ingredient}, which has no crate`);
    }
    for (const s of es.scripted ?? []) {
      if (!crates.has(s.ingredient)) errors.push(`eightySix.scripted names ${s.ingredient}, which has no crate`);
      if (!(s.atSec >= 0)) errors.push('eightySix.scripted atSec must be >= 0');
    }
  }
  if (count('delivery') > 1) errors.push('at most one delivery tile');
  parsed.items.forEach((item, i) => {
    if (item?.kind === 'tray' && parsed.tiles[i].type !== 'trayRack') errors.push(`tray at (${parsed.tiles[i].x},${parsed.tiles[i].y}) is not on a trayRack tile`);
  });
  // Tutorials: forced switches must be real, pinned tickets must be on the menu, goals and pointers on the grid.
  for (const key of Object.keys(level.mechanics ?? {})) {
    if (!MECHANIC_KEYS.includes(key as MechanicKey)) errors.push(`mechanics names unknown switch '${key}'`);
  }
  for (const id of level.orders?.first ?? []) {
    if (!level.recipes?.includes(id)) errors.push(`orders.first names '${id}', which is not on the menu`);
  }
  const tutorial = level.tutorial;
  if (tutorial) {
    if (!tutorial.title) errors.push('tutorial has no title');
    if (!tutorial.steps?.length) errors.push('tutorial has no steps');
    const onGrid = (x: number, y: number): boolean => x >= 0 && y >= 0 && x < parsed.width && y < parsed.height;
    tutorial.steps?.forEach((step, i) => {
      if (!step.text) errors.push(`tutorial step ${i} has no text`);
      if (step.at && !onGrid(step.at.x, step.at.y)) errors.push(`tutorial step ${i} points off the grid`);
      const goal = step.goal;
      if (!goal) { errors.push(`tutorial step ${i} has no goal`); return; }
      if (goal.type === 'tileItem' && !(onGrid(goal.x, goal.y) && onGrid(goal.x + (goal.w ?? 1) - 1, goal.y + (goal.h ?? 1) - 1))) errors.push(`tutorial step ${i} goal is off the grid`);
      if (goal.type === 'stock' && !onGrid(goal.x, goal.y)) errors.push(`tutorial step ${i} goal is off the grid`);
      if (goal.type === 'stock' && parsed.tiles[goal.y * parsed.width + goal.x]?.type !== 'crate') errors.push(`tutorial step ${i} stock goal is not on a crate`);
      if (goal.type === 'wait' && !(goal.sec > 0)) errors.push(`tutorial step ${i} wait must be > 0`);
      if (goal.type === 'served' && !(goal.count >= 1)) errors.push(`tutorial step ${i} served count must be >= 1`);
    });
  }
  return errors;
}
