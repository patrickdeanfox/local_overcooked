// ─── Level definition contract ──────────────────────────────────────────────
// Levels are JSON files in src/levels/<game>/<name>.json matching LevelDef.
// Human-readable ASCII grid + fixed legend. See docs/LEVEL_SCHEMA.md.
import type { IngredientType, Item, ItemKind, Tile, TileType } from '../sim/types';

export interface LevelStars { 1: [number, number, number]; 2: [number, number, number]; } // 1-star, 2-star, 3-star score

export interface OrderSettings {
  initial: number;     // orders shown at level start
  intervalSec: number; // seconds between new orders (when below max)
  max: number;         // max concurrent orders
  timeSec: number;     // seconds each order stays before expiring
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
}

export interface ItemPlacement { x: number; y: number; item: ItemKind; count?: number; }

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
    };

export interface LevelDef {
  id: string;            // 'oc1-1-1'
  name: string;          // '1-1'
  game: 'oc1' | 'oc2' | 'custom';
  world: number;
  index: number;
  theme: string;         // e.g. 'treacle-town', 'savoury-seas'
  source?: string;       // wiki URL the layout was transcribed from
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
}

export interface LegendEntry { type: TileType; ingredient?: IngredientType; group?: string; item?: ItemKind; }

export const LEGEND: Readonly<Record<string, LegendEntry>> = Object.freeze({
  ' ': { type: 'void' },
  '.': { type: 'floor' },
  '~': { type: 'road' },
  '#': { type: 'counter' },
  'O': { type: 'crate', ingredient: 'onion' },
  'T': { type: 'crate', ingredient: 'tomato' },
  'M': { type: 'crate', ingredient: 'mushroom' },
  'B': { type: 'board' },
  'S': { type: 'stove', item: 'pot' },
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
});

export const SOLID_TILES: ReadonlySet<TileType> = new Set<TileType>([
  'void', 'counter', 'crate', 'board', 'stove', 'sink', 'drying', 'plateReturn', 'serve', 'trash', 'plateStack', 'slider',
]);
export function isWalkable(type: TileType): boolean { return !SOLID_TILES.has(type); }

export interface ParsedGrid { width: number; height: number; tiles: Tile[]; items: (Item | null)[]; }

let nextItemId = 1;
export function makeItem(kind: ItemKind, count = 1): Item {
  const id = nextItemId++;
  switch (kind) {
    case 'ingredient': return { kind, id, type: 'onion', chopped: false, chopProgress: 0 };
    case 'pot': return { kind, id, contents: [], state: 'empty', cookProgress: 0, burnProgress: 0 };
    case 'plate': return { kind, id, dish: null };
    case 'dirtyPlate': return { kind, id, count };
    case 'extinguisher': return { kind, id };
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
      items.push(entry.item ? makeItem(entry.item) : null);
    }
  }
  for (const s of level.stations ?? []) {
    const t = tiles[s.y * width + s.x];
    if (!t) continue;
    if (s.type) t.type = s.type;
    if (s.ingredient) t.ingredient = s.ingredient;
    if (s.group) t.group = s.group;
  }
  for (const p of level.items ?? []) {
    const i = p.y * width + p.x;
    if (i < 0 || i >= items.length) continue;
    items[i] = makeItem(p.item, p.count);
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
    else if (!isWalkable(t.type)) errors.push(`spawn (${s.x},${s.y}) is on a solid tile`);
  }
  const count = (type: TileType) => parsed.tiles.filter((t) => t.type === type).length;
  if (count('serve') === 0) errors.push('no serve tile');
  if (count('crate') === 0) errors.push('no crate tile');
  if (count('stove') === 0 && level.recipes.some((r) => r.endsWith('_soup'))) errors.push('soup recipe but no stove');
  if (level.plates.mode === 'sink' && (count('sink') === 0 || count('plateReturn') === 0)) errors.push("plates.mode 'sink' needs a sink and a plateReturn tile");
  if (level.plates.mode === 'stack' && count('plateStack') === 0) errors.push("plates.mode 'stack' needs a plateStack tile");
  if (!level.recipes?.length) errors.push('no recipes');
  if (!(level.timeLimitSec > 0)) errors.push('timeLimitSec must be > 0');
  for (const d of level.dynamics ?? []) {
    if (d.type === 'sliders' && !parsed.tiles.some((t) => t.type === 'slider' && t.group === d.group)) errors.push(`sliders group '${d.group}' has no slider tiles`);
    if (d.type === 'pedestrians' && count('road') === 0) errors.push('pedestrians need road tiles');
  }
  return errors;
}
