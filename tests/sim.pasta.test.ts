import { describe, expect, it } from 'vitest';
import { Sim } from '../src/sim';
import { CONVEYOR_FLOOR_SPEED, COOK_TIME, PAN_COOK_TIME, SIM_DT } from '../src/sim/constants';
import {
  NO_INPUT,
  type Chef, type Facing, type IngredientItem, type IngredientType, type Item, type PlateItem, type PlayerInput,
  type PotItem, type SimEvent, type SimState,
} from '../src/sim/types';
import { validateLevel, type Dynamic, type LevelDef } from '../src/levels/schema';

// ─── Fixture ────────────────────────────────────────────────────────────────
// A 13x8 kitchen: pasta, tomato, tortilla, rice, beef, chicken, cheese and bun crates along the top,
// a pot and a pan, two boards; a walkable belt on row 5; a counter of two boards that can slide.
const GRID = [
  '#aTrIAkHUSF##',
  '#...........V',
  '#...........#',
  '#.BB........R',
  '#...........#',
  '#»»»»»»»»»».#',
  '#...........#',
  '#p##WD#######',
];

const BASE: LevelDef = {
  id: 'test-pasta', name: 'test', game: 'custom', world: 1, index: 1, theme: 'test',
  timeLimitSec: 300, timerStartsOnFirstServe: false,
  recipes: ['tomato_pasta', 'beef_burrito', 'chicken_burrito', 'cheese_burger'],
  orders: { initial: 1, intervalSec: 1000, max: 4, timeSec: 200 },
  stars: { 1: [10, 40, 60], 2: [10, 40, 60] },
  plates: { mode: 'sink', count: 1 },
  grid: GRID,
  spawns: [{ x: 6, y: 2 }, { x: 9, y: 4 }],
};

function makeLevel(patch: Partial<LevelDef> = {}): LevelDef {
  return { ...BASE, ...patch, grid: patch.grid ?? [...GRID] };
}

function make(patch: Partial<LevelDef> = {}): Sim {
  return new Sim(makeLevel(patch), { players: 2, seed: 1 });
}

// ─── Helpers ────────────────────────────────────────────────────────────────
function inp(patch: Partial<PlayerInput>): PlayerInput {
  return { ...NO_INPUT, ...patch };
}

function mutable(sim: Sim): SimState {
  return sim.getState() as SimState;
}

function place(sim: Sim, x: number, y: number, facing: Facing): Chef {
  const chef = mutable(sim).chefs[0];
  chef.x = x;
  chef.y = y;
  chef.facing = facing;
  return chef;
}

function ing(type: IngredientType, chopped: boolean, id = 900): IngredientItem {
  return { kind: 'ingredient', id, type, chopped, chopProgress: chopped ? 1 : 0 };
}

function put(sim: Sim, x: number, y: number, item: Item | null): void {
  const st = mutable(sim);
  st.tileItems[y * st.width + x] = item;
}

function tap(sim: Sim): SimEvent[] {
  const events = sim.step([inp({ pickupPressed: true }), NO_INPUT]);
  sim.step([NO_INPUT, NO_INPUT]);
  return events;
}

function stepFor(sim: Sim, seconds: number, a: PlayerInput = NO_INPUT): void {
  const steps = Math.round(seconds / SIM_DT);
  for (let i = 0; i < steps; i++) sim.step([a, NO_INPUT]);
}

function ware(sim: Sim, x: number): PotItem {
  const item = sim.itemAt(x, 0);
  if (!item || item.kind !== 'pot') throw new Error('no cookware');
  return item;
}

function heldPlate(sim: Sim): PlateItem {
  const plate: PlateItem = { kind: 'plate', id: 950, dish: null };
  mutable(sim).chefs[0].holding = plate;
  return plate;
}

/** Puts a piece on the counter at (0,2) and scoops it onto the held plate. */
function scoop(sim: Sim, item: IngredientItem): void {
  put(sim, 0, 2, item);
  place(sim, 1.5, 2.5, 'left');
  tap(sim);
}

/** Cooks a piece in the pan (x 10) or pot (x 9) and scoops it onto the held plate. */
function cookAndScoop(sim: Sim, x: number, type: IngredientType, time: number): void {
  const w = ware(sim, x);
  w.contents.push(type);
  stepFor(sim, time + 0.1);
  place(sim, x + 0.5, 1.5, 'up');
  tap(sim);
}

// ─── Pasta and burritos ─────────────────────────────────────────────────────
describe('pasta, burritos and cheese burgers', () => {
  it('validates the fixture', () => {
    expect(validateLevel(makeLevel())).toEqual([]);
  });

  it('fries a chopped tomato in a pan and boils pasta whole in a pot', () => {
    const sim = make();
    place(sim, 10.5, 1.5, 'up');
    mutable(sim).chefs[0].holding = ing('tomato', true);
    tap(sim);
    expect(ware(sim, 10).contents).toEqual(['tomato']);
    place(sim, 9.5, 1.5, 'up');
    mutable(sim).chefs[0].holding = ing('pasta', false, 901);
    tap(sim);
    expect(ware(sim, 9).contents).toEqual(['pasta']);
  });

  it('assembles tomato pasta from boiled pasta and pan-fried tomato, and serves it', () => {
    const sim = make();
    const plate = heldPlate(sim);
    cookAndScoop(sim, 9, 'pasta', COOK_TIME);
    cookAndScoop(sim, 10, 'tomato', PAN_COOK_TIME);
    expect(plate.dish).toEqual({ type: 'pasta', ingredients: ['pasta', 'tomato'] });
    const st = mutable(sim);
    st.orders.length = 0;
    st.orders.push({ id: 99, recipeId: 'tomato_pasta', timeLeft: 100, timeTotal: 100 });
    place(sim, 11.5, 1.5, 'right');
    expect(tap(sim).find((e) => e.type === 'serve')?.value).toBe(60);
  });

  it('keeps a chopped (unfried) tomato off pasta', () => {
    const sim = make();
    const plate = heldPlate(sim);
    cookAndScoop(sim, 9, 'pasta', COOK_TIME);
    scoop(sim, ing('tomato', true, 910));
    expect(plate.dish).toEqual({ type: 'pasta', ingredients: ['pasta'] });
  });

  it('assembles a beef burrito from a raw tortilla, boiled rice and fried beef', () => {
    const sim = make();
    const plate = heldPlate(sim);
    scoop(sim, ing('tortilla', false, 920));
    cookAndScoop(sim, 9, 'rice', COOK_TIME);
    cookAndScoop(sim, 10, 'meat', PAN_COOK_TIME);
    expect(plate.dish).toEqual({ type: 'burrito', ingredients: ['meat', 'rice', 'tortilla'] });
  });

  it('moves a lone fried beef from burger to burrito when rice joins it', () => {
    const sim = make();
    const plate = heldPlate(sim);
    cookAndScoop(sim, 10, 'meat', PAN_COOK_TIME);
    expect(plate.dish?.type).toBe('burger'); // the menu's first family that takes it
    cookAndScoop(sim, 9, 'rice', COOK_TIME);
    expect(plate.dish).toEqual({ type: 'burrito', ingredients: ['meat', 'rice'] });
  });

  it('puts chopped cheese on a burger', () => {
    const sim = make();
    const plate = heldPlate(sim);
    scoop(sim, ing('bun', false, 930));
    scoop(sim, ing('cheese', true, 931));
    cookAndScoop(sim, 10, 'meat', PAN_COOK_TIME);
    expect(plate.dish).toEqual({ type: 'burger', ingredients: ['bun', 'cheese', 'meat'] });
  });

  it('deep-fries chicken into nuggets', () => {
    const sim = make({ recipes: ['nuggets'], grid: GRID.map((row) => row.replace('SF', 'YY')) });
    const basket = ware(sim, 9);
    basket.contents.push('chicken');
    stepFor(sim, PAN_COOK_TIME + 0.1);
    const plate = heldPlate(sim);
    place(sim, 9.5, 1.5, 'up');
    tap(sim);
    expect(plate.dish).toEqual({ type: 'fried', ingredients: ['chicken'] });
  });
});

// ─── Sliding stations ───────────────────────────────────────────────────────
describe('stations riding a slider group', () => {
  const SLIDE: Dynamic = { type: 'sliders', group: 'b', axis: 'x', amplitude: 2, periodSec: 8 };
  const sliding = (): Sim => make({
    stations: [{ x: 2, y: 3, group: 'b' }, { x: 3, y: 3, group: 'b' }],
    dynamics: [SLIDE],
  });

  it('validates, and a group cannot be both a gate and a slider', () => {
    expect(validateLevel(makeLevel({ stations: [{ x: 2, y: 3, group: 'b' }], dynamics: [SLIDE] }))).toEqual([]);
    const both = validateLevel(makeLevel({
      grid: GRID.map((row, y) => (y === 6 ? '#G..........#' : row)),
      stations: [{ x: 2, y: 3, group: '1' }],
      dynamics: [{ ...SLIDE, group: '1' } as Dynamic, { type: 'gate', group: '1', periodSec: 10, openSec: 5 }],
    }));
    expect(both).toContain("group '1' is both a gate and a slider group");
  });

  it('moves a board with its group, and a chef chops on it where it is', () => {
    const sim = sliding();
    stepFor(sim, 2); // a quarter period: the boards are 2 tiles right, over (4,3) and (5,3)
    expect(sim.sliderOffset('b').x).toBeCloseTo(2, 1);
    put(sim, 2, 3, ing('onion', false, 940)); // an item lives on the board's own tile
    place(sim, 4.5, 2.5, 'down');
    expect(sim.getTargetTile(0)).toEqual({ x: 2, y: 3 });
    stepFor(sim, 0.5, inp({ interactHeld: true }));
    const item = sim.itemAt(2, 3);
    expect(item?.kind === 'ingredient' && item.chopProgress > 0).toBe(true);
  });

  it('is solid where it is, not where it started', () => {
    const sim = sliding();
    stepFor(sim, 2);
    const chef = place(sim, 2.5, 2.5, 'down');
    stepFor(sim, 0.4, inp({ moveY: 1 }));
    expect(chef.y).toBeGreaterThan(3.2); // walked through the empty base tile
  });
});

// ─── Belt reversal ──────────────────────────────────────────────────────────
describe('belt reversal', () => {
  const reversing = (): Sim => make({ dynamics: [{ type: 'beltReverse', periodSec: 5 }] });

  it('runs with the arrows, then against them after periodSec', () => {
    const sim = reversing();
    const chef = place(sim, 5.5, 5.5, 'down');
    stepFor(sim, 1);
    expect(chef.x).toBeCloseTo(5.5 + CONVEYOR_FLOOR_SPEED, 1);
    expect(sim.getState().beltsReversed).toBe(false);
    stepFor(sim, 4.2);
    expect(sim.getState().beltsReversed).toBe(true);
    place(sim, 5.5, 5.5, 'down'); // it rode off the end meanwhile; back on the belt
    stepFor(sim, 1);
    expect(chef.x).toBeCloseTo(5.5 - CONVEYOR_FLOOR_SPEED, 1);
  });

  it('carries items back the other way while reversed', () => {
    const sim = reversing();
    stepFor(sim, 5.1);
    put(sim, 6, 5, ing('fish', false, 960));
    stepFor(sim, 2 / CONVEYOR_FLOOR_SPEED + 0.2);
    expect(sim.itemAt(4, 5)?.id).toBe(960);
  });

  it('runs deterministically', () => {
    const run = (): string => {
      const sim = reversing();
      for (let i = 0; i < 900; i++) sim.step([inp({ moveX: Math.sin(i / 30), moveY: Math.cos(i / 25) }), NO_INPUT]);
      return JSON.stringify(sim.getState());
    };
    expect(run()).toBe(run());
  });
});
