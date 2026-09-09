import { describe, expect, it } from 'vitest';
import { Sim } from '../src/sim';
import { DASH_THROW_BONUS, DASH_TIME, SIM_DT, THROW_RANGE, THROW_SPEED } from '../src/sim/constants';
import {
  NO_INPUT,
  type Chef, type Facing, type IngredientItem, type Item, type PlayerInput, type SimEvent, type SimState,
} from '../src/sim/types';
import type { LevelDef } from '../src/levels/schema';

// ─── Fixture ────────────────────────────────────────────────────────────────
// A 13x8 kitchen with a two-tile hole down the middle (columns 7 and 8) and a floor bridge
// across it on row 3. Stations on the right wall: board (11,1), stove with a pot (11,2),
// sink (11,3), drying (11,4), serve (11,5), extinguisher counter (11,6).
const GRID = [
  '#############',
  '#O.....__..B#',
  '#R.....__..S#',
  '#..........W#',
  '#......__..D#',
  '#p.....__..V#',
  '#X.....__..E#',
  '#############',
];

const BASE: LevelDef = {
  id: 'test-throw',
  name: 'test',
  game: 'custom',
  world: 1,
  index: 1,
  theme: 'test',
  timeLimitSec: 300,
  timerStartsOnFirstServe: false,
  recipes: ['onion_soup'],
  orders: { initial: 1, intervalSec: 1000, max: 4, timeSec: 120 },
  stars: { 1: [10, 40, 60], 2: [10, 40, 60] },
  plates: { mode: 'sink', count: 1 },
  grid: GRID,
  spawns: [{ x: 3, y: 3 }, { x: 9, y: 3 }],
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

function onion(id: number, chopped = false): IngredientItem {
  return { kind: 'ingredient', id, type: 'onion', chopped, chopProgress: chopped ? 1 : 0 };
}

function give(sim: Sim, index: number, item: Item): void {
  mutable(sim).chefs[index].holding = item;
}

function stepFor(sim: Sim, seconds: number, a: PlayerInput = NO_INPUT, b?: PlayerInput): SimEvent[] {
  const out: SimEvent[] = [];
  const steps = Math.round(seconds / SIM_DT);
  for (let i = 0; i < steps; i++) {
    const events = b ? sim.step([a, b]) : sim.step([a]);
    for (const e of events) out.push(e);
  }
  return out;
}

function types(events: readonly SimEvent[]): string[] {
  return events.map((e) => e.type);
}

/** One throw press, then a second of flight. */
function throwAndSettle(sim: Sim, players = 1): SimEvent[] {
  const first = players === 2 ? sim.step([inp({ throwPressed: true }), NO_INPUT]) : sim.step([inp({ throwPressed: true })]);
  const rest = players === 2 ? stepFor(sim, 1, NO_INPUT, NO_INPUT) : stepFor(sim, 1);
  return [...first, ...rest];
}

function ingredientsOnTiles(sim: Sim): { x: number; y: number }[] {
  const st = sim.getState();
  const out: { x: number; y: number }[] = [];
  st.tileItems.forEach((item, i) => {
    if (item && item.kind === 'ingredient') out.push({ x: i % st.width, y: Math.floor(i / st.width) });
  });
  return out;
}

const FLIGHT_SECONDS = THROW_RANGE / THROW_SPEED;

// ─── Flight ─────────────────────────────────────────────────────────────────
describe('throwing', () => {
  it('flies the held ingredient the way the chef faces and drops it at THROW_RANGE', () => {
    const sim = new Sim(makeLevel(), { players: 1, seed: 1 });
    place(sim, 0, 3.5, 3.5, 'right');
    give(sim, 0, onion(9001));
    const first = sim.step([inp({ throwPressed: true })]);
    expect(types(first)).toContain('throw');
    expect(mutable(sim).chefs[0].holding).toBeNull();
    expect(sim.getState().flying?.length).toBe(1);

    const rest = stepFor(sim, FLIGHT_SECONDS + 0.1);
    expect(types(rest)).toContain('throwLand');
    expect(sim.getState().flying).toEqual([]);
    expect(sim.itemAt(7, 3)).toMatchObject({ kind: 'ingredient', id: 9001 }); // 3.8 + 3.5 = 7.3
    expect(rest.find((e) => e.type === 'throwLand')).toMatchObject({ x: 7, y: 3, chef: 0 });
  });

  it('crosses a hole and lands on the floor beyond it', () => {
    const sim = new Sim(makeLevel(), { players: 1, seed: 1 });
    place(sim, 0, 5.5, 1.5, 'right');
    give(sim, 0, onion(9002));
    sim.step([inp({ throwPressed: true })]);
    stepFor(sim, 0.15); // about 1.35 tiles in: over the hole and still flying
    expect(sim.getState().flying?.length).toBe(1);
    expect(sim.getState().flying?.[0].x).toBeGreaterThan(7);
    stepFor(sim, 1);
    expect(sim.itemAt(9, 1)).toMatchObject({ kind: 'ingredient', id: 9002 }); // 5.8 + 3.5 = 9.3
  });

  it('is lost when its range runs out over the hole', () => {
    const sim = new Sim(makeLevel(), { players: 1, seed: 1 });
    place(sim, 0, 4.5, 1.5, 'right');
    give(sim, 0, onion(9003));
    const events = throwAndSettle(sim); // 4.8 + 3.5 = 8.3: over the hole
    expect(types(events)).toContain('throwLand');
    expect(sim.getState().flying).toEqual([]);
    expect(ingredientsOnTiles(sim)).toEqual([]);
  });

  it('stops at a wall or a station that will not take it and drops on the floor in front', () => {
    const sim = new Sim(makeLevel(), { players: 1, seed: 1 });
    place(sim, 0, 9.5, 3.5, 'right'); // the sink at (11,3) refuses ingredients
    give(sim, 0, onion(9004));
    throwAndSettle(sim);
    expect(sim.itemAt(10, 3)).toMatchObject({ kind: 'ingredient', id: 9004 });
    expect(sim.itemAt(11, 3)).toBeNull();
  });

  it('lands on a free counter or board, and in front of an occupied one', () => {
    const sim = new Sim(makeLevel(), { players: 1, seed: 1 });
    place(sim, 0, 9.5, 1.5, 'right');
    give(sim, 0, onion(9005));
    throwAndSettle(sim);
    expect(sim.itemAt(11, 1)).toMatchObject({ kind: 'ingredient', id: 9005 }); // the board

    give(sim, 0, onion(9006));
    throwAndSettle(sim);
    expect(sim.itemAt(11, 1)).toMatchObject({ id: 9005 });
    expect(sim.itemAt(10, 1)).toMatchObject({ kind: 'ingredient', id: 9006 });
  });

  it('goes straight into a pot that accepts it and bounces off one that does not', () => {
    const sim = new Sim(makeLevel(), { players: 1, seed: 1 });
    place(sim, 0, 9.5, 2.5, 'right'); // the stove with a pot at (11,2)
    give(sim, 0, onion(9007, true));
    const events = throwAndSettle(sim);
    expect(types(events)).toEqual(expect.arrayContaining(['throw', 'throwLand', 'potAdd']));
    expect(sim.itemAt(11, 2)).toMatchObject({ kind: 'pot', contents: ['onion'] });
    expect(sim.itemAt(10, 2)).toBeNull();

    give(sim, 0, onion(9008, false)); // raw: the burner pushes it away (wiki Burner)
    const raw = throwAndSettle(sim);
    expect(types(raw)).not.toContain('potAdd');
    expect(sim.itemAt(11, 2)).toMatchObject({ contents: ['onion'] });
    expect(sim.itemAt(10, 2)).toMatchObject({ kind: 'ingredient', id: 9008 });
  });

  it('lands in the bin and is destroyed', () => {
    const sim = new Sim(makeLevel(), { players: 1, seed: 1 });
    place(sim, 0, 1.5, 5.5, 'down'); // the bin at (1,6)
    give(sim, 0, onion(9009));
    const events = throwAndSettle(sim);
    expect(types(events)).toContain('trash');
    expect(ingredientsOnTiles(sim)).toEqual([]);
  });
});

// ─── Catching ───────────────────────────────────────────────────────────────
describe('catching', () => {
  it('a chef with free hands catches a throw; full hands let it pass', () => {
    const sim = new Sim(makeLevel(), { players: 2, seed: 1 });
    place(sim, 0, 3.5, 3.5, 'right');
    place(sim, 1, 6.5, 3.5, 'left');
    give(sim, 0, onion(9010));
    const events = throwAndSettle(sim, 2);
    expect(types(events)).toContain('catch');
    expect(events.find((e) => e.type === 'catch')).toMatchObject({ chef: 1, value: 1 });
    expect(mutable(sim).chefs[1].holding).toMatchObject({ kind: 'ingredient', id: 9010 });
    expect(ingredientsOnTiles(sim)).toEqual([]);

    give(sim, 0, onion(9011));
    give(sim, 1, { kind: 'plate', id: 9500, dish: null });
    const passed = throwAndSettle(sim, 2);
    expect(types(passed)).not.toContain('catch');
    expect(sim.itemAt(7, 3)).toMatchObject({ kind: 'ingredient', id: 9011 });
  });

  it('the thrower cannot catch its own throw straight away', () => {
    const sim = new Sim(makeLevel(), { players: 1, seed: 1 });
    place(sim, 0, 3.5, 3.5, 'right');
    give(sim, 0, onion(9012));
    sim.step([inp({ throwPressed: true })]);
    sim.step([NO_INPUT]);
    expect(mutable(sim).chefs[0].holding).toBeNull();
    expect(sim.getState().flying?.length).toBe(1);
  });
});

// ─── What flies ─────────────────────────────────────────────────────────────
describe('throwable items', () => {
  it('never throws a plate, cookware or the extinguisher', () => {
    const sim = new Sim(makeLevel(), { players: 1, seed: 1 });
    place(sim, 0, 3.5, 3.5, 'right');
    const held: Item[] = [
      { kind: 'plate', id: 9600, dish: null },
      { kind: 'pot', id: 9601, contents: [], state: 'empty', cookProgress: 0, burnProgress: 0 },
      { kind: 'extinguisher', id: 9602 },
      { kind: 'dirtyPlate', id: 9603, count: 1 },
    ];
    for (const item of held) {
      give(sim, 0, item);
      const events = sim.step([inp({ throwPressed: true })]);
      expect(types(events)).not.toContain('throw');
      expect(mutable(sim).chefs[0].holding).toBe(item);
    }
    expect(sim.getState().flying).toBeUndefined();
  });

  it('flies DASH_THROW_BONUS times as far right after a dash', () => {
    const plain = new Sim(makeLevel(), { players: 1, seed: 1 });
    place(plain, 0, 4.26, 3.5, 'right');
    give(plain, 0, onion(9013));
    throwAndSettle(plain);
    expect(sim1Landing(plain)).toEqual({ x: 8, y: 3 }); // 4.56 + 3.5 = 8.06

    const dashed = new Sim(makeLevel(), { players: 1, seed: 1 });
    place(dashed, 0, 2.5, 3.5, 'right');
    give(dashed, 0, onion(9014));
    dashed.step([inp({ dashPressed: true })]);
    stepFor(dashed, DASH_TIME); // the dash ends at about x = 4.26, well inside the throw window
    throwAndSettle(dashed);
    const landing = sim1Landing(dashed);
    expect(landing.y).toBe(3);
    expect(landing.x).toBeGreaterThan(8);
    expect(landing.x).toBe(Math.floor(4.26 + 0.3 + THROW_RANGE * DASH_THROW_BONUS));
  });
});

function sim1Landing(sim: Sim): { x: number; y: number } {
  const tiles = ingredientsOnTiles(sim);
  expect(tiles.length).toBe(1);
  return tiles[0];
}
