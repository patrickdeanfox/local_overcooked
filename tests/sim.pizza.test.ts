import { describe, expect, it } from 'vitest';
import { Sim } from '../src/sim';
import { BAKE_TIME, CHOP_TIME, SIM_DT } from '../src/sim/constants';
import {
  NO_INPUT,
  type Chef, type Facing, type IngredientItem, type IngredientType, type Item, type PlateItem, type PlayerInput,
  type PotItem, type SimEvent, type SimState,
} from '../src/sim/types';
import { validateLevel, type LevelDef } from '../src/levels/schema';

// ─── Fixture ────────────────────────────────────────────────────────────────
// A 13x8 kitchen: dough, cheese, tomato and pepperoni crates, two boards and two ovens along the top.
const GRID = [
  '#&HTeBBNN####',
  '#...........V',
  '#...........#',
  '#...........R',
  '#...........#',
  '#...........#',
  '#p..........#',
  '#X##WD#######',
];

const BASE: LevelDef = {
  id: 'test-pizza', name: 'test', game: 'custom', world: 1, index: 1, theme: 'test',
  timeLimitSec: 300, timerStartsOnFirstServe: false,
  recipes: ['pizza', 'pepperoni_pizza'],
  orders: { initial: 1, intervalSec: 1000, max: 4, timeSec: 200 },
  stars: { 1: [10, 40, 60], 2: [10, 40, 60] },
  plates: { mode: 'sink', count: 1 },
  grid: GRID,
  spawns: [{ x: 6, y: 2 }, { x: 9, y: 4 }],
};

function make(patch: Partial<LevelDef> = {}): Sim {
  return new Sim({ ...BASE, ...patch, grid: patch.grid ?? [...GRID] }, { players: 2, seed: 1 });
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

function stepFor(sim: Sim, seconds: number, a: PlayerInput = NO_INPUT): SimEvent[] {
  const events: SimEvent[] = [];
  const steps = Math.round(seconds / SIM_DT);
  for (let i = 0; i < steps; i++) events.push(...sim.step([a, NO_INPUT]));
  return events;
}

/** Chops dough on the board at (5,0) and returns the pizza base it becomes. */
function chopBase(sim: Sim): PotItem {
  put(sim, 5, 0, ing('dough', false));
  place(sim, 5.5, 1.5, 'up');
  stepFor(sim, CHOP_TIME + 0.1, inp({ interactHeld: true }));
  const base = sim.itemAt(5, 0);
  if (!base || base.kind !== 'pot') throw new Error('no base');
  return base;
}

/** Tops the base at (5,0) with each chopped topping, from the chef's hands. */
function top(sim: Sim, ...toppings: IngredientType[]): void {
  place(sim, 5.5, 1.5, 'up');
  toppings.forEach((t, i) => {
    mutable(sim).chefs[0].holding = ing(t, true, 910 + i);
    tap(sim);
  });
}

// ─── Pizza ──────────────────────────────────────────────────────────────────
describe('pizza', () => {
  it('validates the fixture, and needs an oven', () => {
    expect(validateLevel({ ...BASE })).toEqual([]);
    const errors = validateLevel({ ...BASE, grid: GRID.map((row) => row.replace(/N/g, '#')) });
    expect(errors.some((e) => e.includes('needs an oven'))).toBe(true);
  });

  it('flattens chopped dough into an empty pizza base on the board', () => {
    const sim = make();
    const base = chopBase(sim);
    expect(base).toMatchObject({ ware: 'dough', contents: [], state: 'empty' });
  });

  it('takes chopped toppings once each, and nothing raw', () => {
    const sim = make();
    const base = chopBase(sim);
    top(sim, 'cheese', 'tomato', 'cheese');
    expect(base.contents).toEqual(['cheese', 'tomato']);
    mutable(sim).chefs[0].holding = ing('pepperoni', false, 920);
    tap(sim);
    expect(base.contents).toEqual(['cheese', 'tomato']);
  });

  it('bakes only in an oven, in BAKE_TIME', () => {
    const sim = make();
    const base = chopBase(sim);
    top(sim, 'cheese', 'tomato');
    stepFor(sim, BAKE_TIME + 1);
    expect(base.state).toBe('empty'); // on the board: not baking
    tap(sim); // pick it up
    place(sim, 7.5, 1.5, 'up');
    tap(sim); // onto the oven at (7,0)
    expect(sim.itemAt(7, 0)?.id).toBe(base.id);
    stepFor(sim, BAKE_TIME + 0.1);
    expect(base.state).toBe('cooked');
  });

  it('slides a baked pizza onto a plate whole and serves it', () => {
    const sim = make();
    const base = chopBase(sim);
    top(sim, 'cheese', 'tomato', 'pepperoni');
    base.state = 'cooked';
    base.cookProgress = 1;
    put(sim, 5, 0, null);
    put(sim, 7, 0, base);
    const plate: PlateItem = { kind: 'plate', id: 950, dish: null };
    mutable(sim).chefs[0].holding = plate;
    place(sim, 7.5, 1.5, 'up');
    tap(sim);
    expect(plate.dish).toEqual({ type: 'pizza', ingredients: ['cheese', 'dough', 'pepperoni', 'tomato'] });
    expect(sim.itemAt(7, 0)).toBeNull();
    const st = mutable(sim);
    st.orders.length = 0;
    st.orders.push({ id: 99, recipeId: 'pepperoni_pizza', timeLeft: 100, timeTotal: 100 });
    place(sim, 11.5, 1.5, 'right');
    expect(tap(sim).find((e) => e.type === 'serve')?.value).toBe(30);
  });

  it('puts a held baked pizza onto a plate on the counter', () => {
    const sim = make();
    const base = chopBase(sim);
    top(sim, 'cheese', 'tomato');
    base.state = 'cooked';
    base.cookProgress = 1;
    put(sim, 5, 0, null);
    const plate: PlateItem = { kind: 'plate', id: 951, dish: null };
    put(sim, 1, 5, plate);
    mutable(sim).chefs[0].holding = base;
    place(sim, 1.5, 4.5, 'down');
    tap(sim);
    expect(plate.dish?.type).toBe('pizza');
    expect(mutable(sim).chefs[0].holding).toBeNull();
  });

  it('burns in the oven and bins whole', () => {
    const sim = make();
    const base = chopBase(sim);
    top(sim, 'cheese', 'tomato');
    put(sim, 5, 0, null);
    put(sim, 7, 0, base);
    stepFor(sim, BAKE_TIME + 14);
    expect(base.state).toBe('burnt');
    expect(sim.fireAt(7, 0)).toBe(true);
    mutable(sim).fires.length = 0;
    put(sim, 7, 0, null);
    mutable(sim).chefs[0].holding = base;
    place(sim, 1.5, 6.5, 'down');
    tap(sim);
    expect(mutable(sim).chefs[0].holding).toBeNull();
  });

  it('runs deterministically', () => {
    const run = (): string => {
      const sim = make();
      chopBase(sim);
      for (let i = 0; i < 600; i++) sim.step([inp({ moveX: Math.sin(i / 30), moveY: Math.cos(i / 25), pickupPressed: i % 50 === 0 }), NO_INPUT]);
      return JSON.stringify(sim.getState());
    };
    expect(run()).toBe(run());
  });
});
