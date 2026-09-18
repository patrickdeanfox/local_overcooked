import { describe, expect, it } from 'vitest';
import { Sim } from '../src/sim';
import { CONVEYOR_FLOOR_SPEED, COOK_TIME, SIM_DT } from '../src/sim/constants';
import {
  NO_INPUT,
  type Chef, type Facing, type IngredientItem, type IngredientType, type Item, type PlateItem, type PlayerInput,
  type PotItem, type SimEvent, type SimState,
} from '../src/sim/types';
import { validateLevel, type LevelDef } from '../src/levels/schema';

// ─── Fixture ────────────────────────────────────────────────────────────────
// A 13x8 kitchen: nori, rice, fish, cucumber, lettuce and tomato crates, two boards and two pots along
// the top; a walkable belt carrying right on row 5; serve and plate return on the right.
const GRID = [
  '#nIJcLTBBSS##',
  '#...........V',
  '#...........#',
  '#...........R',
  '#...........#',
  '#»»»»»»»»»».#',
  '#...........#',
  '#p##WD#######',
];

const BASE: LevelDef = {
  id: 'test-sushi',
  name: 'test',
  game: 'custom',
  world: 1,
  index: 1,
  theme: 'test',
  timeLimitSec: 300,
  timerStartsOnFirstServe: false,
  recipes: ['fish_sushi', 'cucumber_sushi', 'fish_cucumber_sushi', 'tomato_salad'],
  orders: { initial: 1, intervalSec: 1000, max: 4, timeSec: 200 },
  stars: { 1: [10, 40, 60], 2: [10, 40, 60] },
  plates: { mode: 'sink', count: 1 },
  grid: GRID,
  spawns: [{ x: 3, y: 2 }, { x: 9, y: 2 }],
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

function pot(sim: Sim, x: number): PotItem {
  const item = sim.itemAt(x, 0);
  if (!item || item.kind !== 'pot') throw new Error('no pot');
  return item;
}

/** A clean plate in chef 0's hands; pieces are scooped onto it from a counter. */
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

// ─── Rice ───────────────────────────────────────────────────────────────────
describe('rice in a pot', () => {
  it('validates the fixture, and needs a pot for a sushi menu', () => {
    expect(validateLevel(makeLevel())).toEqual([]);
    const noPot = validateLevel(makeLevel({ grid: GRID.map((row) => row.replace(/S/g, '#')) }));
    expect(noPot.some((e) => e.includes('needs a stove with a pot'))).toBe(true);
  });

  it('takes one raw portion of rice into an empty pot, and nothing after it', () => {
    const sim = make();
    place(sim, 9.5, 1.5, 'up');
    mutable(sim).chefs[0].holding = ing('rice', false);
    tap(sim);
    expect(pot(sim, 9).contents).toEqual(['rice']);
    mutable(sim).chefs[0].holding = ing('rice', false, 901);
    tap(sim);
    expect(pot(sim, 9).contents).toEqual(['rice']);
    mutable(sim).chefs[0].holding = ing('onion', true, 902);
    tap(sim);
    expect(pot(sim, 9).contents).toEqual(['rice']);
  });

  it('keeps rice out of a pot of soup', () => {
    const sim = make();
    pot(sim, 9).contents.push('onion');
    place(sim, 9.5, 1.5, 'up');
    mutable(sim).chefs[0].holding = ing('rice', false);
    tap(sim);
    expect(pot(sim, 9).contents).toEqual(['onion']);
  });

  it('boils in COOK_TIME and scoops onto a plate as boiled rice', () => {
    const sim = make();
    pot(sim, 9).contents.push('rice');
    stepFor(sim, COOK_TIME + 0.1);
    expect(pot(sim, 9).state).toBe('cooked');
    place(sim, 9.5, 1.5, 'up');
    const plate = heldPlate(sim);
    tap(sim);
    expect(plate.dish).toEqual({ type: 'sushi', ingredients: ['rice'] });
    expect(pot(sim, 9).contents).toEqual([]);
  });
});

// ─── Sushi and salad ────────────────────────────────────────────────────────
describe('sushi and salad on a plate', () => {
  it('assembles fish sushi from nori, boiled rice and chopped fish, and serves it', () => {
    const sim = make();
    pot(sim, 9).contents.push('rice');
    stepFor(sim, COOK_TIME + 0.1);
    const plate = heldPlate(sim);
    scoop(sim, ing('nori', false, 910));
    scoop(sim, ing('fish', true, 911));
    place(sim, 9.5, 1.5, 'up');
    tap(sim);
    expect(plate.dish).toEqual({ type: 'sushi', ingredients: ['fish', 'nori', 'rice'] });
    const st = mutable(sim);
    st.orders.length = 0;
    st.orders.push({ id: 99, recipeId: 'fish_sushi', timeLeft: 100, timeTotal: 100 });
    place(sim, 11.5, 1.5, 'right');
    const events = tap(sim);
    expect(events.find((e) => e.type === 'serve')?.value).toBe(40);
  });

  it('refuses raw rice and a whole fish on a sushi plate', () => {
    const sim = make();
    const plate = heldPlate(sim);
    scoop(sim, ing('nori', false, 910));
    scoop(sim, ing('rice', false, 911));
    scoop(sim, ing('fish', false, 912));
    expect(plate.dish).toEqual({ type: 'sushi', ingredients: ['nori'] });
  });

  it('starts chopped lettuce as a salad on a salad menu and takes tomato after it', () => {
    const sim = make();
    const plate = heldPlate(sim);
    scoop(sim, ing('lettuce', true, 920));
    scoop(sim, ing('tomato', true, 921));
    expect(plate.dish).toEqual({ type: 'salad', ingredients: ['lettuce', 'tomato'] });
  });

  it('starts chopped lettuce as a burger on a burger menu, and a bun keeps it one', () => {
    const sim = make({ recipes: ['lettuce_burger'], grid: GRID.map((row) => row.replace('nIJc', 'UAJF').replace('SS', 'SF')) });
    const plate = heldPlate(sim);
    scoop(sim, ing('lettuce', true, 930));
    expect(plate.dish?.type).toBe('burger');
    scoop(sim, ing('bun', false, 931));
    expect(plate.dish).toEqual({ type: 'burger', ingredients: ['bun', 'lettuce'] });
  });

  it('moves a plate to the family that fits: lettuce then cucumber is a salad even on a burger menu', () => {
    const sim = make({ recipes: ['lettuce_burger', 'cucumber_tomato_salad'], grid: GRID.map((row) => row.replace('nIJc', 'UAJc').replace('SS', 'SF')) });
    const plate = heldPlate(sim);
    scoop(sim, ing('lettuce', true, 940));
    expect(plate.dish?.type).toBe('burger');
    scoop(sim, ing('cucumber', true, 941));
    expect(plate.dish).toEqual({ type: 'salad', ingredients: ['cucumber', 'lettuce'] });
  });

  it('keeps a cucumber off a sashimi plate and fish off a salad', () => {
    const sim = make();
    const plate = heldPlate(sim);
    scoop(sim, ing('lettuce', true, 950));
    scoop(sim, ing('fish', true, 951));
    expect(plate.dish).toEqual({ type: 'salad', ingredients: ['lettuce'] });
  });

  it('allows one of each piece on a sushi plate', () => {
    const sim = make();
    const plate = heldPlate(sim);
    scoop(sim, ing('nori', false, 960));
    scoop(sim, ing('nori', false, 961));
    expect(plate.dish?.ingredients).toEqual(['nori']);
  });
});

// ─── Walkable belt ──────────────────────────────────────────────────────────
describe('walkable belt', () => {
  it('parses » as a walkable belt carrying right', () => {
    const sim = make();
    expect(sim.tileAt(3, 5)).toMatchObject({ type: 'conveyorFloor', dir: 'right' });
  });

  it('carries a chef standing on it', () => {
    const sim = make();
    const chef = place(sim, 3.5, 5.5, 'down');
    stepFor(sim, 1);
    expect(chef.x).toBeCloseTo(3.5 + CONVEYOR_FLOOR_SPEED, 1);
  });

  it('slows a chef walking against it and speeds one walking with it', () => {
    const against = make();
    const a = place(against, 8.5, 5.5, 'left');
    stepFor(against, 0.5, inp({ moveX: -1 }));
    const with_ = make();
    const b = place(with_, 2.5, 5.5, 'right');
    stepFor(with_, 0.5, inp({ moveX: 1 }));
    expect(8.5 - a.x).toBeLessThan(b.x - 2.5);
  });

  it('carries an item resting on it, and sets it down on the floor at the end', () => {
    const sim = make();
    put(sim, 8, 5, ing('fish', false, 970));
    stepFor(sim, 3 / CONVEYOR_FLOOR_SPEED + 0.2);
    expect(sim.itemAt(11, 5)?.id).toBe(970);
    stepFor(sim, 2);
    expect(sim.itemAt(11, 5)?.id).toBe(970);
  });

  it('runs deterministically', () => {
    const run = (): string => {
      const sim = make();
      put(sim, 2, 5, ing('fish', false, 980));
      for (let i = 0; i < 600; i++) {
        sim.step([inp({ moveX: Math.sin(i / 30), moveY: Math.cos(i / 25), pickupPressed: i % 60 === 0 }), inp({ moveY: Math.sin(i / 20) })]);
      }
      return JSON.stringify(sim.getState());
    };
    expect(run()).toBe(run());
  });
});
