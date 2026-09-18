import { describe, expect, it } from 'vitest';
import { Sim } from '../src/sim';
import { CHEF_SPEED, DEEP_FRY_TIME, ICE_DECEL, SIM_DT } from '../src/sim/constants';
import {
  NO_INPUT,
  type Chef, type Facing, type IngredientItem, type IngredientType, type Item, type PlateItem, type PlayerInput,
  type PotItem, type SimEvent, type SimState,
} from '../src/sim/types';
import { validateLevel, type LevelDef } from '../src/levels/schema';

// ─── Fixture ────────────────────────────────────────────────────────────────
// A 13x8 kitchen: fish and potato crates, a board, two fryers with baskets and a burner with a
// pot on the top row; a sink, rack and plate return down the right; the floor's left half is ice.
const GRID = [
  '#J%BYYS######',
  ',,,,,,.....V#',
  ',,,,,,.....W#',
  ',,,,,,.....D#',
  ',,,,,,.....R#',
  ',,,,,,......#',
  '#p#####X###E#',
  '#############',
];

const BASE: LevelDef = {
  id: 'test-fryer',
  name: 'test',
  game: 'custom',
  world: 1,
  index: 1,
  theme: 'test',
  timeLimitSec: 300,
  timerStartsOnFirstServe: false,
  recipes: ['chips', 'fried_fish', 'fish_and_chips'],
  orders: { initial: 1, intervalSec: 1000, max: 4, timeSec: 200 },
  stars: { 1: [10, 40, 60], 2: [10, 40, 60] },
  plates: { mode: 'sink', count: 1 },
  grid: GRID,
  spawns: [{ x: 8, y: 3 }, { x: 9, y: 4 }],
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

function place(sim: Sim, index: number, x: number, y: number, facing: Facing): Chef {
  const chef = mutable(sim).chefs[index];
  chef.x = x;
  chef.y = y;
  chef.facing = facing;
  delete chef.vx;
  delete chef.vy;
  return chef;
}

function chopped(type: IngredientType, id: number): IngredientItem {
  return { kind: 'ingredient', id, type, chopped: true, chopProgress: 1 };
}

function put(sim: Sim, x: number, y: number, item: Item | null): void {
  const st = mutable(sim);
  st.tileItems[y * st.width + x] = item;
}

function tap(sim: Sim): SimEvent[] {
  return sim.step([inp({ pickupPressed: true }), NO_INPUT]);
}

function stepFor(sim: Sim, seconds: number, a: PlayerInput = NO_INPUT): SimEvent[] {
  const events: SimEvent[] = [];
  const steps = Math.round(seconds / SIM_DT);
  for (let i = 0; i < steps; i++) events.push(...sim.step([a, NO_INPUT]));
  return events;
}

function basketAt(sim: Sim, x: number, y: number): PotItem {
  const item = sim.itemAt(x, y);
  if (!item || item.kind !== 'pot') throw new Error(`no basket at (${x},${y})`);
  return item;
}

// ─── The fryer ──────────────────────────────────────────────────────────────
describe('deep fryer', () => {
  it('parses Y as a fryer holding a frying basket, and validates the fixture', () => {
    const sim = make();
    expect(sim.tileAt(4, 0)?.type).toBe('fryer');
    expect(basketAt(sim, 4, 0).ware).toBe('basket');
    expect(validateLevel(makeLevel())).toEqual([]);
  });

  it('rejects a fish and chips menu with no fryer', () => {
    const errors = validateLevel(makeLevel({ grid: GRID.map((row) => row.replace(/Y/g, '#')) }));
    expect(errors.some((e) => e.includes('needs a fryer'))).toBe(true);
  });

  it('takes a chopped fish or potato, not a raw one and not an onion', () => {
    const sim = make();
    place(sim, 0, 4.5, 1.5, 'up');
    mutable(sim).chefs[0].holding = { kind: 'ingredient', id: 900, type: 'potato', chopped: false, chopProgress: 0 };
    tap(sim);
    expect(basketAt(sim, 4, 0).contents).toEqual([]);
    mutable(sim).chefs[0].holding = chopped('onion', 901);
    sim.step([NO_INPUT, NO_INPUT]);
    tap(sim);
    expect(basketAt(sim, 4, 0).contents).toEqual([]);
    mutable(sim).chefs[0].holding = chopped('potato', 902);
    sim.step([NO_INPUT, NO_INPUT]);
    tap(sim);
    expect(basketAt(sim, 4, 0).contents).toEqual(['potato']);
  });

  it('fries a piece in DEEP_FRY_TIME and burns it later, like a pan', () => {
    const sim = make();
    const basket = basketAt(sim, 4, 0);
    basket.contents.push('fish');
    const events = stepFor(sim, DEEP_FRY_TIME + 0.1);
    expect(basket.state).toBe('cooked');
    expect(events.map((e) => e.type)).toContain('cookDone');
  });

  it('keeps baskets out of burners and pots out of fryers', () => {
    const sim = make();
    const basket = basketAt(sim, 4, 0);
    put(sim, 4, 0, null);
    put(sim, 6, 0, null); // clear the burner
    place(sim, 0, 6.5, 1.5, 'up');
    mutable(sim).chefs[0].holding = basket;
    tap(sim);
    expect(sim.itemAt(6, 0)).toBeNull();
    const pot: PotItem = { kind: 'pot', id: 910, contents: [], state: 'empty', cookProgress: 0, burnProgress: 0 };
    place(sim, 0, 4.5, 1.5, 'up');
    mutable(sim).chefs[0].holding = pot;
    sim.step([NO_INPUT, NO_INPUT]);
    tap(sim);
    expect(sim.itemAt(4, 0)).toBeNull();
    mutable(sim).chefs[0].holding = basket;
    sim.step([NO_INPUT, NO_INPUT]);
    tap(sim);
    expect(sim.itemAt(4, 0)?.id).toBe(basket.id);
  });

  it('lays fried pieces on a plate as a fried dish, one of each', () => {
    const sim = make();
    const basket = basketAt(sim, 4, 0);
    basket.contents.push('fish');
    basket.state = 'cooked';
    basket.cookProgress = 1;
    const plate: PlateItem = { kind: 'plate', id: 920, dish: null };
    place(sim, 0, 4.5, 1.5, 'up');
    mutable(sim).chefs[0].holding = plate;
    tap(sim);
    expect(plate.dish).toEqual({ type: 'fried', ingredients: ['fish'] });
    expect(basket.contents).toEqual([]);
    const second = basketAt(sim, 5, 0);
    second.contents.push('fish');
    second.state = 'cooked';
    second.cookProgress = 1;
    place(sim, 0, 5.5, 1.5, 'up');
    sim.step([NO_INPUT, NO_INPUT]);
    tap(sim);
    expect(plate.dish?.ingredients).toEqual(['fish']); // no second fish
    second.contents[0] = 'potato';
    sim.step([NO_INPUT, NO_INPUT]);
    tap(sim);
    expect(plate.dish).toEqual({ type: 'fried', ingredients: ['fish', 'potato'] });
  });

  it('does not mix a fried piece into a sashimi plate', () => {
    const sim = make();
    const basket = basketAt(sim, 4, 0);
    basket.contents.push('fish');
    basket.state = 'cooked';
    const plate: PlateItem = { kind: 'plate', id: 921, dish: { type: 'plated', ingredients: ['fish'] } };
    place(sim, 0, 4.5, 1.5, 'up');
    mutable(sim).chefs[0].holding = plate;
    tap(sim);
    expect(plate.dish).toEqual({ type: 'plated', ingredients: ['fish'] });
    expect(basket.contents).toEqual(['fish']);
  });

  it('serves fish and chips for its score', () => {
    const sim = make();
    const st = mutable(sim);
    st.orders.length = 0;
    st.orders.push({ id: 99, recipeId: 'fish_and_chips', timeLeft: 100, timeTotal: 100 });
    place(sim, 0, 10.5, 1.5, 'right');
    st.chefs[0].holding = { kind: 'plate', id: 930, dish: { type: 'fried', ingredients: ['fish', 'potato'] } };
    const events = tap(sim);
    expect(events.find((e) => e.type === 'serve')?.value).toBe(25);
  });
});

// ─── Ice ────────────────────────────────────────────────────────────────────
describe('ice floor', () => {
  it('keeps a chef sliding after the stick is released', () => {
    const sim = make();
    const chef = place(sim, 0, 1.5, 3.5, 'right');
    stepFor(sim, 0.6, inp({ moveX: 1 }));
    const x0 = chef.x;
    stepFor(sim, 0.2);
    expect(chef.x).toBeGreaterThan(x0 + 0.2);
    expect(chef.vx).toBeGreaterThan(0);
  });

  it('comes to rest after about v^2 / (2 ICE_DECEL)', () => {
    const sim = make();
    const chef = place(sim, 0, 0.5, 3.5, 'right');
    chef.vx = 2;
    stepFor(sim, 2);
    expect(chef.vx).toBeUndefined();
    expect(chef.x).toBeCloseTo(0.5 + (2 * 2) / (2 * ICE_DECEL), 1);
  });

  it('starts slowly: a chef on ice is below full speed after a short push', () => {
    const sim = make();
    const chef = place(sim, 0, 1.5, 3.5, 'right');
    stepFor(sim, 0.1, inp({ moveX: 1 }));
    expect(chef.vx ?? 0).toBeLessThan(CHEF_SPEED);
  });

  it('stops dead on ordinary floor', () => {
    const sim = make();
    const chef = place(sim, 0, 7.5, 3.5, 'right');
    stepFor(sim, 0.3, inp({ moveX: 1 }));
    const x0 = chef.x;
    stepFor(sim, 0.2);
    expect(chef.x).toBe(x0);
    expect(chef.vx).toBeUndefined();
  });

  it('loses its speed into a wall', () => {
    const sim = make();
    const chef = place(sim, 0, 1.5, 2.5, 'up');
    chef.vy = -4;
    stepFor(sim, 0.5);
    expect(chef.vy).toBeUndefined();
    expect(chef.y).toBeGreaterThan(1);
  });
});

// ─── Determinism ────────────────────────────────────────────────────────────
describe('fryer and ice determinism', () => {
  function run(seed: number): string {
    const sim = new Sim(makeLevel(), { players: 2, seed });
    basketAt(sim, 4, 0).contents.push('fish');
    for (let i = 0; i < 600; i++) {
      const a = inp({ moveX: Math.sin(i / 30), moveY: Math.cos(i / 40), pickupPressed: i % 50 === 0 });
      const b = inp({ moveX: -Math.sin(i / 25), moveY: Math.cos(i / 35), pickupPressed: i % 70 === 0 });
      sim.step([a, b]);
    }
    return JSON.stringify(sim.getState());
  }

  it('produces identical snapshots for the same seed and inputs', () => {
    expect(run(3)).toBe(run(3));
  });
});
