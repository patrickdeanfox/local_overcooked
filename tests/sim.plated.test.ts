import { describe, expect, it } from 'vitest';
import { Sim } from '../src/sim';
import { CHOP_TIME, SIM_DT } from '../src/sim/constants';
import { RECIPES, dishMatchesRecipe, isPlatedComponent } from '../src/sim/recipes';
import {
  NO_INPUT, PLATED_INGREDIENTS,
  type Chef, type Facing, type PlayerInput, type SimEvent, type SimState,
} from '../src/sim/types';
import { validateLevel, type LevelDef } from '../src/levels/schema';

// ─── Fixture ────────────────────────────────────────────────────────────────
// A sashimi bar: fish and prawn crates on the left wall, a board and a stove on the right,
// plates on a counter, a serve hatch and a plate stack; no sink.
const GRID = [
  '#############',
  '#J.........B#',
  '#Ø.........S#',
  '#...........#',
  '#p.........P#',
  '#..........V#',
  '#X.........E#',
  '#############',
];

const BASE: LevelDef = {
  id: 'test-sashimi',
  name: 'test',
  game: 'custom',
  world: 1,
  index: 1,
  theme: 'test',
  timeLimitSec: 300,
  timerStartsOnFirstServe: false,
  recipes: ['fish_sashimi', 'prawn_sashimi'],
  orders: { initial: 0, intervalSec: 1000, max: 4, timeSec: 120 },
  stars: { 1: [10, 40, 60], 2: [10, 40, 60] },
  plates: { mode: 'stack', count: 2 },
  grid: GRID,
  spawns: [{ x: 5, y: 3 }, { x: 5, y: 4 }],
};

function makeLevel(patch: Partial<LevelDef> = {}): LevelDef {
  return { ...BASE, ...patch, grid: patch.grid ?? [...GRID] };
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
  return chef;
}

function stepFor(sim: Sim, seconds: number, a: PlayerInput = NO_INPUT): SimEvent[] {
  const out: SimEvent[] = [];
  const steps = Math.round(seconds / SIM_DT);
  for (let i = 0; i < steps; i++) for (const e of sim.step([a])) out.push(e);
  return out;
}

function tap(sim: Sim): SimEvent[] {
  return sim.step([inp({ pickupPressed: true })]);
}

function types(events: readonly SimEvent[]): string[] {
  return events.map((e) => e.type);
}

/** Crate → board → chopped, the chef ending in front of the board holding the chopped fish. */
function chopFrom(sim: Sim, crateX: number, crateY: number): void {
  place(sim, 0, crateX + 1.5, crateY + 0.5, 'left');
  tap(sim);
  place(sim, 0, 10.5, 1.5, 'right'); // the board at (11,1)
  tap(sim);
  stepFor(sim, CHOP_TIME + 0.1, inp({ interactHeld: true }));
  tap(sim);
}

// ─── Recipes ────────────────────────────────────────────────────────────────
describe('plated dishes', () => {
  it('sashimi is one chopped fish or prawn on a plate', () => {
    expect(RECIPES.fish_sashimi).toMatchObject({ dish: 'plated', ingredients: ['fish'], score: 20 });
    expect(RECIPES.prawn_sashimi).toMatchObject({ dish: 'plated', ingredients: ['prawn'], score: 20 });
    expect(PLATED_INGREDIENTS).toEqual(['fish', 'prawn']);
    expect(isPlatedComponent('fish')).toBe(true);
    expect(isPlatedComponent('onion')).toBe(false);
    expect(dishMatchesRecipe({ type: 'plated', ingredients: ['fish'] }, RECIPES.fish_sashimi)).toBe(true);
    expect(dishMatchesRecipe({ type: 'soup', ingredients: ['fish'] }, RECIPES.fish_sashimi)).toBe(false);
  });

  it('a level with sashimi needs crates and a board but no pot', () => {
    expect(validateLevel(makeLevel())).toEqual([]);
    const noBoard = makeLevel({ grid: GRID.map((row) => row.replace('B', '#')) });
    expect(validateLevel(noBoard).some((e) => e.includes('chopping board'))).toBe(true);
    const noStove = makeLevel({ grid: GRID.map((row) => row.replace('S', '#')) });
    expect(validateLevel(noStove)).toEqual([]);
  });

  it('a generic crate needs its ingredient from a stations override', () => {
    const generic = makeLevel({ grid: GRID.map((row) => row.replace('J', 'C')) });
    expect(validateLevel(generic).some((e) => e.includes('crate (1,1) has no ingredient'))).toBe(true);
    const overridden = makeLevel({ ...generic, stations: [{ x: 1, y: 1, ingredient: 'fish' }] });
    expect(validateLevel(overridden)).toEqual([]);
  });
});

// ─── The plate ──────────────────────────────────────────────────────────────
describe('plating sashimi', () => {
  it('chops a fish and lays it on a plate, which then serves as fish sashimi', () => {
    const sim = new Sim(makeLevel(), { players: 1, seed: 1 });
    mutable(sim).orders.push({ id: 900, recipeId: 'fish_sashimi', timeLeft: 60, timeTotal: 60 });
    chopFrom(sim, 1, 1);
    const chef = mutable(sim).chefs[0];
    expect(chef.holding).toMatchObject({ kind: 'ingredient', type: 'fish', chopped: true });

    place(sim, 0, 2.5, 4.5, 'left'); // the plate on the counter at (1,4)
    const events = tap(sim);
    expect(types(events)).toContain('plateAdd');
    expect(chef.holding).toBeNull();
    expect(sim.itemAt(1, 4)).toMatchObject({ kind: 'plate', dish: { type: 'plated', ingredients: ['fish'] } });

    tap(sim); // pick the plate up
    place(sim, 0, 10.5, 5.5, 'right'); // the serve hatch at (11,5)
    const served = tap(sim);
    expect(types(served)).toContain('serve');
    expect(sim.getState().score).toBe(20);
    expect(sim.getState().orders.length).toBe(0);
  });

  it('refuses a raw fish and keeps fish out of the pot', () => {
    const sim = new Sim(makeLevel(), { players: 1, seed: 1 });
    place(sim, 0, 2.5, 1.5, 'left');
    tap(sim); // raw fish in hand
    place(sim, 0, 2.5, 4.5, 'left');
    expect(types(tap(sim))).not.toContain('plateAdd');
    expect(sim.itemAt(1, 4)).toMatchObject({ kind: 'plate', dish: null });
    expect(mutable(sim).chefs[0].holding).toMatchObject({ type: 'fish', chopped: false });

    const chopped = mutable(sim).chefs[0].holding;
    if (chopped && chopped.kind === 'ingredient') chopped.chopped = true;
    place(sim, 0, 10.5, 2.5, 'right'); // the stove with a pot at (11,2)
    expect(types(tap(sim))).not.toContain('potAdd');
    expect(sim.itemAt(11, 2)).toMatchObject({ kind: 'pot', contents: [] });
  });

  it('a plate with a plated dish takes more plated pieces but no burger parts, and matches nothing until a recipe fits', () => {
    const sim = new Sim(makeLevel(), { players: 1, seed: 1 });
    mutable(sim).orders.push({ id: 901, recipeId: 'prawn_sashimi', timeLeft: 60, timeTotal: 60 });
    chopFrom(sim, 1, 1); // fish
    place(sim, 0, 2.5, 4.5, 'left');
    tap(sim);
    chopFrom(sim, 1, 2); // prawn
    place(sim, 0, 2.5, 4.5, 'left');
    expect(types(tap(sim))).toContain('plateAdd');
    expect(sim.itemAt(1, 4)).toMatchObject({ kind: 'plate', dish: { type: 'plated', ingredients: ['fish', 'prawn'] } });

    mutable(sim).chefs[0].holding = { kind: 'ingredient', id: 9300, type: 'bun', chopped: false, chopProgress: 0 };
    expect(types(tap(sim))).not.toContain('plateAdd');
    mutable(sim).chefs[0].holding = null;

    tap(sim); // the fish-and-prawn plate
    place(sim, 0, 10.5, 5.5, 'right');
    expect(types(tap(sim))).toContain('serveRejected'); // no recipe has both
    expect(sim.getState().orders.length).toBe(1);
  });

  it('a chopped prawn on a burger plate is refused', () => {
    const sim = new Sim(makeLevel(), { players: 1, seed: 1 });
    mutable(sim).chefs[0].holding = { kind: 'ingredient', id: 9301, type: 'prawn', chopped: true, chopProgress: 1 };
    const plate = sim.itemAt(1, 4);
    if (plate && plate.kind === 'plate') plate.dish = { type: 'burger', ingredients: ['bun'] };
    place(sim, 0, 2.5, 4.5, 'left');
    expect(types(tap(sim))).not.toContain('plateAdd');
    expect(sim.itemAt(1, 4)).toMatchObject({ dish: { type: 'burger', ingredients: ['bun'] } });
  });
});
