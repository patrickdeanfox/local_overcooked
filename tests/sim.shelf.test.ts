import { describe, expect, it } from 'vitest';
import { Sim } from '../src/sim';
import { CHEF_HITBOX, SIM_DT, THROW_RANGE, THROW_SPEED } from '../src/sim/constants';
import {
  NO_INPUT,
  type Chef, type Facing, type IngredientItem, type PlayerInput, type SimEvent, type SimState,
} from '../src/sim/types';
import { isWalkable, SOLID_TILES, type LevelDef } from '../src/levels/schema';

// ─── Fixture ────────────────────────────────────────────────────────────────
// A 13x8 kitchen split down column 6 by a run of pass-through shelves: crates, a plate and the
// bin on the left, the cooking and serving stations on the right.
const GRID = [
  '#############',
  '#O....h....B#',
  '#T....h....S#',
  '#.....h....W#',
  '#.....h....D#',
  '#p....h....V#',
  '#X....h....E#',
  '#############',
];

const BASE: LevelDef = {
  id: 'test-shelf',
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

const HALF = CHEF_HITBOX / 2;

function makeLevel(patch: Partial<LevelDef> = {}): LevelDef {
  return { ...BASE, ...patch, grid: patch.grid ?? [...GRID] };
}

function on(): Sim {
  return new Sim(makeLevel(), { players: 2, seed: 1, modifiers: { passThroughShelf: true } });
}

function off(): Sim {
  return new Sim(makeLevel(), { players: 2, seed: 1 });
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

function onion(id: number): IngredientItem {
  return { kind: 'ingredient', id, type: 'onion', chopped: false, chopProgress: 0 };
}

function tap(sim: Sim, chef: 0 | 1): SimEvent[] {
  const press = inp({ pickupPressed: true });
  return sim.step(chef === 0 ? [press, NO_INPUT] : [NO_INPUT, press]);
}

function stepFor(sim: Sim, seconds: number, a: PlayerInput = NO_INPUT, b: PlayerInput = NO_INPUT): SimEvent[] {
  const out: SimEvent[] = [];
  const steps = Math.round(seconds / SIM_DT);
  for (let i = 0; i < steps; i++) for (const e of sim.step([a, b])) out.push(e);
  return out;
}

function types(events: readonly SimEvent[]): string[] {
  return events.map((e) => e.type);
}

/** Chef 0 left of the shelf at (6,3) facing it, chef 1 right of it facing it. */
function bothAtShelf(sim: Sim): [Chef, Chef] {
  return [place(sim, 0, 5.5, 3.5, 'right'), place(sim, 1, 7.5, 3.5, 'left')];
}

// ─── The tile ───────────────────────────────────────────────────────────────
describe('the shelf tile', () => {
  it('is solid and not walkable, whichever way the switch is', () => {
    expect(SOLID_TILES.has('shelf')).toBe(true);
    expect(isWalkable('shelf')).toBe(false);
    for (const sim of [on(), off()]) {
      const chef = place(sim, 0, 5.5, 3.5, 'right');
      stepFor(sim, 1, inp({ moveX: 1 }));
      expect(chef.x).toBeCloseTo(6 - HALF, 6);
    }
  });
});

// ─── On ─────────────────────────────────────────────────────────────────────
describe('pass-through shelf on', () => {
  it('one chef places on it, the chef on the other side takes it', () => {
    const sim = on();
    const [left, right] = bothAtShelf(sim);
    left.holding = onion(9001);
    expect(types(tap(sim, 0))).toEqual(['drop']);
    expect(left.holding).toBeNull();
    expect(sim.itemAt(6, 3)).toMatchObject({ kind: 'ingredient', id: 9001 });
    expect(types(tap(sim, 1))).toEqual(['pickup']);
    expect(right.holding).toMatchObject({ kind: 'ingredient', id: 9001 });
    expect(sim.itemAt(6, 3)).toBeNull();
  });

  it('holds one item: a second placement is refused', () => {
    const sim = on();
    const [left] = bothAtShelf(sim);
    left.holding = onion(9001);
    tap(sim, 0);
    left.holding = onion(9002);
    expect(tap(sim, 0)).toEqual([]);
    expect(left.holding).toMatchObject({ id: 9002 });
  });
});

// ─── Off ────────────────────────────────────────────────────────────────────
describe('pass-through shelf off', () => {
  it('is a wall: nothing can be placed on it', () => {
    const sim = off();
    const [left] = bothAtShelf(sim);
    left.holding = onion(9001);
    expect(tap(sim, 0)).toEqual([]);
    expect(left.holding).toMatchObject({ id: 9001 });
    expect(sim.itemAt(6, 3)).toBeNull();
  });
});

// ─── Throws ─────────────────────────────────────────────────────────────────
describe('throws and the shelf', () => {
  it.each([['on', on], ['off', off]] as const)('%s: a throw stops at the shelf and drops on the floor in front of it', (_name, build) => {
    const sim = build();
    const thrower = place(sim, 0, 3.5, 3.5, 'right');
    place(sim, 1, 9.5, 5.5, 'left'); // out of the way
    thrower.holding = onion(9001);
    const events = [
      ...sim.step([inp({ throwPressed: true }), NO_INPUT]),
      ...stepFor(sim, THROW_RANGE / THROW_SPEED + 0.1),
    ];
    expect(types(events)).toContain('throw');
    const land = events.find((e) => e.type === 'throwLand');
    expect(land).toMatchObject({ x: 5, y: 3 });
    expect(sim.itemAt(5, 3)).toMatchObject({ kind: 'ingredient', id: 9001 });
    expect(sim.itemAt(6, 3)).toBeNull();
    expect(sim.getState().flying).toEqual([]);
  });

  it('replays identically for the same seed and inputs', () => {
    function run(seed: number): string {
      const sim = new Sim(makeLevel(), { players: 2, seed, modifiers: { passThroughShelf: true } });
      for (let i = 0; i < 300; i++) {
        const a = inp({ moveX: Math.sin(i * 0.1), moveY: Math.cos(i * 0.07), pickupPressed: i % 17 === 0, throwPressed: i % 53 === 0 });
        const b = inp({ moveX: -Math.sin(i * 0.1), moveY: Math.cos(i * 0.09), pickupPressed: i % 23 === 0 });
        sim.step([a, b]);
      }
      return JSON.stringify(sim.getState());
    }
    expect(run(5)).toBe(run(5));
  });
});
