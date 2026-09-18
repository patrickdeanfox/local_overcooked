import { describe, expect, it } from 'vitest';
import { Sim } from '../src/sim';
import { BAKE_TIME, MIX_TIME, PAN_COOK_TIME, SIM_DT } from '../src/sim/constants';
import {
  NO_INPUT,
  type Chef, type Facing, type IngredientItem, type IngredientType, type PlateItem, type PlayerInput,
  type PotItem, type SimEvent, type SimState,
} from '../src/sim/types';
import { validateLevel, type LevelDef } from '../src/levels/schema';

// ─── Fixture ────────────────────────────────────────────────────────────────
// Flour, egg, honey and chocolate crates, a board, a mixer, a pan and an oven along the top.
const GRID = [
  '#f$ybBKFN####',
  '#...........V',
  '#...........#',
  '#...........R',
  '#...........#',
  '#...........#',
  '#p..........#',
  '#X##WD#######',
];

const BASE: LevelDef = {
  id: 'test-cake', name: 'test', game: 'custom', world: 1, index: 1, theme: 'test',
  timeLimitSec: 300, timerStartsOnFirstServe: false,
  recipes: ['pancake', 'chocolate_pancake', 'cake', 'chocolate_cake'],
  orders: { initial: 1, intervalSec: 1000, max: 4, timeSec: 200 },
  stars: { 1: [10, 40, 60], 2: [10, 40, 60] },
  plates: { mode: 'sink', count: 1 },
  grid: GRID,
  spawns: [{ x: 6, y: 2 }, { x: 9, y: 4 }],
};

function make(): Sim {
  return new Sim({ ...BASE, grid: [...GRID] }, { players: 2, seed: 1 });
}

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

function tap(sim: Sim): SimEvent[] {
  const events = sim.step([inp({ pickupPressed: true }), NO_INPUT]);
  sim.step([NO_INPUT, NO_INPUT]);
  return events;
}

function stepFor(sim: Sim, seconds: number): void {
  for (let i = 0; i < Math.round(seconds / SIM_DT); i++) sim.step([NO_INPUT, NO_INPUT]);
}

function at(sim: Sim, x: number): PotItem {
  const item = sim.itemAt(x, 0);
  if (!item || item.kind !== 'pot') throw new Error(`no cookware at ${x}`);
  return item;
}

/** Mixes the pieces in the bowl at (6,0) and returns to the chef facing it, bowl in hand. */
function mixAndLift(sim: Sim, ...items: IngredientItem[]): PotItem {
  place(sim, 6.5, 1.5, 'up');
  for (const item of items) {
    mutable(sim).chefs[0].holding = item;
    tap(sim);
  }
  stepFor(sim, MIX_TIME + 0.1);
  const bowl = at(sim, 6);
  tap(sim);
  return bowl;
}

describe('pancakes and cakes', () => {
  it('validate, and a cake needs an oven', () => {
    expect(validateLevel({ ...BASE })).toEqual([]);
    const errors = validateLevel({ ...BASE, grid: GRID.map((row) => row.replace('N', '#')) });
    expect(errors.some((e) => e.includes('needs an oven'))).toBe(true);
  });

  it('pours a flour and egg mix into a pan and fries a pancake', () => {
    const sim = make();
    const bowl = mixAndLift(sim, ing('flour', false, 901), ing('egg', false, 902), ing('chocolate', true, 903));
    place(sim, 7.5, 1.5, 'up');
    tap(sim);
    expect(at(sim, 7).contents).toEqual(['flour', 'egg', 'chocolate']);
    expect(bowl.contents).toEqual([]);
    stepFor(sim, PAN_COOK_TIME + 0.1);
    const plate: PlateItem = { kind: 'plate', id: 950, dish: null };
    mutable(sim).chefs[0].holding = plate;
    tap(sim);
    expect(plate.dish).toEqual({ type: 'pancake', ingredients: ['chocolate', 'egg', 'flour'] });
  });

  it('pours a cake mix onto an empty oven as a tin, bakes it, and slides the cake off whole', () => {
    const sim = make();
    mixAndLift(sim, ing('flour', false, 901), ing('egg', false, 902), ing('honey', true, 903));
    place(sim, 8.5, 1.5, 'up');
    tap(sim);
    const tin = at(sim, 8);
    expect(tin).toMatchObject({ ware: 'tin', contents: ['flour', 'egg', 'honey'] });
    stepFor(sim, BAKE_TIME + 0.1);
    expect(tin.state).toBe('cooked');
    mutable(sim).chefs[0].holding = { kind: 'plate', id: 951, dish: null };
    tap(sim);
    const plate = mutable(sim).chefs[0].holding;
    expect(plate?.kind === 'plate' && plate.dish).toEqual({ type: 'cake', ingredients: ['egg', 'flour', 'honey'] });
    expect(sim.itemAt(8, 0)).toBeNull();
    const st = mutable(sim);
    st.orders.length = 0;
    st.orders.push({ id: 99, recipeId: 'cake', timeLeft: 100, timeTotal: 100 });
    place(sim, 11.5, 1.5, 'right');
    expect(tap(sim).find((e) => e.type === 'serve')?.value).toBe(60);
  });

  it('never takes an ingredient straight into a tin', () => {
    const sim = make();
    mixAndLift(sim, ing('flour', false, 901), ing('egg', false, 902), ing('honey', true, 903));
    place(sim, 8.5, 1.5, 'up');
    tap(sim);
    mutable(sim).chefs[0].holding = ing('chocolate', true, 904);
    tap(sim);
    expect(at(sim, 8).contents).toEqual(['flour', 'egg', 'honey']);
  });

  it('runs deterministically', () => {
    const run = (): string => {
      const sim = make();
      mixAndLift(sim, ing('flour', false, 901), ing('egg', false, 902));
      for (let i = 0; i < 600; i++) sim.step([inp({ moveX: Math.sin(i / 30), moveY: Math.cos(i / 25) }), NO_INPUT]);
      return JSON.stringify(sim.getState());
    };
    expect(run()).toBe(run());
  });
});
