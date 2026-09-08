// ─── Fake sim state ─────────────────────────────────────────────────────────
// A plausible SimState for eyeballing the renderer and HUD without the real sim:
// pots cooking and burning, chopped and raw ingredients, plate stacks, fires, orders
// with a card in the red. GameScene swaps it in while F4 is held.
//
// With a base state it decorates a copy of the live kitchen (same grid, so the
// renderer does not rebuild); without one it parses its own small debug kitchen.
import { parseGrid, type LevelDef } from '../../levels/schema';
import { RECIPES } from '../../sim/recipes';
import type {
  Chef,
  IngredientType,
  Item,
  Order,
  SimState,
  Tile,
  TileType,
} from '../../sim/types';

// ─── Constants ──────────────────────────────────────────────────────────────
const FAKE = {
  score: 340,
  timeLeft: 84,
  elapsed: 66,
  served: 5,
  failed: 1,
  tipStreak: 3,
  stars: 2,
  chopProgress: 0.45,
  cookProgress: 0.62,
  burnProgress: 0.72,
  dirtyStack: 3,
  plateReturnStack: 2,
  orderTimeTotal: 60,
  orderTimesLeft: [48, 26, 9],
  fireHealth: 1,
  idBase: 900_000,
  pedestrianSpeed: 1.4,
} as const;

const FAKE_INGREDIENTS: readonly IngredientType[] = ['onion', 'tomato', 'mushroom'];

const FAKE_LEVEL: LevelDef = {
  id: 'debug-fake',
  name: 'Fake Kitchen',
  game: 'custom',
  world: 0,
  index: 0,
  theme: 'debug',
  timeLimitSec: 180,
  timerStartsOnFirstServe: false,
  recipes: Object.keys(RECIPES),
  orders: { initial: 3, intervalSec: 20, max: 4, timeSec: FAKE.orderTimeTotal },
  stars: { 1: [10, 40, 60], 2: [10, 40, 60] },
  plates: { mode: 'sink', count: 2 },
  grid: [
    '##O#S##B#',
    '#.......E',
    'W.......#',
    'D.......X',
    'R.......p',
    '###VV####',
  ],
  spawns: [
    { x: 3, y: 2 },
    { x: 5, y: 3 },
  ],
};

// ─── Helpers ────────────────────────────────────────────────────────────────
function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function indicesOf(tiles: readonly Tile[], type: TileType): number[] {
  const found: number[] = [];
  tiles.forEach((tile, i) => { if (tile.type === type) found.push(i); });
  return found;
}

function spawnChefs(level: LevelDef): Chef[] {
  return level.spawns.slice(0, 2).map((spawn, index): Chef => ({
    index,
    x: spawn.x + 0.5,
    y: spawn.y + 0.5,
    facing: 'down',
    holding: null,
    action: 'idle',
    actionProgress: 0,
  }));
}

// ─── Builder ────────────────────────────────────────────────────────────────
export function buildFakeState(base?: Readonly<SimState>): SimState {
  const grid = base
    ? { width: base.width, height: base.height, tiles: cloneJson(base.tiles), items: cloneJson(base.tileItems) }
    : parseGrid(FAKE_LEVEL);

  const state: SimState = {
    width: grid.width,
    height: grid.height,
    tiles: grid.tiles,
    tileItems: grid.items,
    chefs: base ? cloneJson(base.chefs) : spawnChefs(FAKE_LEVEL),
    fires: [],
    orders: [],
    pedestrians: [],
    sliders: base ? cloneJson(base.sliders) : [],
    score: FAKE.score,
    timeLeft: FAKE.timeLeft,
    phase: 'running',
    timerRunning: true,
    elapsed: FAKE.elapsed,
    servedCount: FAKE.served,
    failedCount: FAKE.failed,
    pendingPlateReturns: [],
    stars: FAKE.stars,
    tipStreak: FAKE.tipStreak,
  };

  let nextId = FAKE.idBase;
  const id = (): number => ++nextId;

  const put = (index: number | undefined, item: Item): void => {
    if (index === undefined) return;
    state.tileItems[index] = item;
  };

  const ingredient = (type: IngredientType, chopped: boolean, chopProgress: number): Item => ({
    kind: 'ingredient', id: id(), type, chopped, chopProgress,
  });

  // Boards: one mid-chop, one finished.
  const boards = indicesOf(state.tiles, 'board');
  put(boards[0], ingredient(FAKE_INGREDIENTS[0], false, FAKE.chopProgress));
  put(boards[1], ingredient(FAKE_INGREDIENTS[1], true, 1));

  // Stoves: cooking, cooked-and-burning, burnt with a fire on top.
  const stoves = indicesOf(state.tiles, 'stove');
  const soup = (type: IngredientType): IngredientType[] => [type, type, type];
  put(stoves[0], { kind: 'pot', id: id(), contents: soup(FAKE_INGREDIENTS[0]), state: 'cooking', cookProgress: FAKE.cookProgress, burnProgress: 0 });
  put(stoves[1], { kind: 'pot', id: id(), contents: soup(FAKE_INGREDIENTS[1]), state: 'cooked', cookProgress: 1, burnProgress: FAKE.burnProgress });
  const burntIndex = stoves.length > 2 ? stoves[2] : stoves[0];
  if (stoves.length > 2) {
    put(burntIndex, { kind: 'pot', id: id(), contents: soup(FAKE_INGREDIENTS[2]), state: 'burnt', cookProgress: 1, burnProgress: 1 });
  }
  const burntTile = state.tiles[burntIndex];
  if (burntTile) state.fires.push({ x: burntTile.x, y: burntTile.y, health: FAKE.fireHealth });

  // Counters: a plated dish, a dirty stack, a spare extinguisher.
  const counters = indicesOf(state.tiles, 'counter').filter((i) => state.tileItems[i] === null);
  put(counters[0], { kind: 'plate', id: id(), dish: { type: 'soup', ingredients: soup(FAKE_INGREDIENTS[0]) } });
  put(counters[1], { kind: 'dirtyPlate', id: id(), count: FAKE.dirtyStack });
  put(counters[2], { kind: 'extinguisher', id: id() });
  if (counters.length > 3) {
    const spreadTile = state.tiles[counters[3]];
    if (spreadTile) state.fires.push({ x: spreadTile.x, y: spreadTile.y, health: FAKE.fireHealth });
  }

  put(indicesOf(state.tiles, 'plateReturn')[0], { kind: 'dirtyPlate', id: id(), count: FAKE.plateReturnStack });
  put(indicesOf(state.tiles, 'drying')[0], { kind: 'plate', id: id(), dish: null });

  // Chefs: one carrying a chopped ingredient, one spraying an extinguisher.
  const walker = state.chefs[0];
  if (walker) {
    walker.action = 'walking';
    walker.holding = ingredient(FAKE_INGREDIENTS[0], true, 1);
  }
  const sprayer = state.chefs[1];
  if (sprayer) {
    sprayer.action = 'extinguishing';
    sprayer.actionProgress = 0.5;
    sprayer.holding = { kind: 'extinguisher', id: id() };
  }

  // Orders: enough of them to fill the top of the HUD, the last one nearly expired.
  const recipeIds = Object.keys(RECIPES);
  state.orders = FAKE.orderTimesLeft.map((timeLeft, i): Order => ({
    id: id(),
    recipeId: recipeIds[i % recipeIds.length] ?? 'onion_soup',
    timeLeft,
    timeTotal: FAKE.orderTimeTotal,
  }));

  // One pedestrian, on a road tile when the level has any.
  const roads = indicesOf(state.tiles, 'road');
  const floors = indicesOf(state.tiles, 'floor');
  const walkTile = state.tiles[roads[0] ?? floors[0] ?? 0];
  if (walkTile) {
    state.pedestrians.push({ id: id(), x: walkTile.x + 0.5, y: walkTile.y + 0.5, vx: FAKE.pedestrianSpeed, vy: 0 });
  }

  return state;
}
