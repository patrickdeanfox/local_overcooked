import { describe, expect, it } from 'vitest';
import { Sim } from '../src/sim';
import { CHEF_HITBOX, DASH_COOLDOWN, DASH_SPEED, DASH_TIME, SIM_DT } from '../src/sim/constants';
import {
  NO_INPUT,
  type Chef, type Facing, type IngredientItem, type PlayerInput, type SimEvent, type SimState,
} from '../src/sim/types';
import type { LevelDef } from '../src/levels/schema';

// ─── Fixture ────────────────────────────────────────────────────────────────
// The throwing kitchen: a two-tile hole down the middle with a floor bridge on row 3, so a
// dash has room to run and a wall (the sink at (11,3)) to run into.
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
  id: 'test-dash',
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
const HALF = CHEF_HITBOX / 2;

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

// ─── Dashing ────────────────────────────────────────────────────────────────
describe('dashing', () => {
  it('runs at DASH_SPEED along the facing for DASH_TIME, then stops', () => {
    const sim = new Sim(makeLevel(), { players: 1, seed: 1 });
    const chef = place(sim, 0, 3.5, 3.5, 'right');
    const first = sim.step([inp({ dashPressed: true })]);
    expect(types(first)).toContain('dash');
    expect(chef.action).toBe('dashing');
    expect(chef.x).toBeCloseTo(3.5 + DASH_SPEED * SIM_DT, 6);
    expect(chef.dashTimeLeft).toBeDefined();

    stepFor(sim, DASH_TIME + 0.05);
    expect(chef.x).toBeCloseTo(3.5 + DASH_SPEED * DASH_TIME, 4);
    expect(chef.action).toBe('idle');
    expect(chef.dashTimeLeft).toBeUndefined();

    const x = chef.x;
    stepFor(sim, 0.5);
    expect(chef.x).toBe(x); // nothing carries on once the dash is over
  });

  it('ignores the stick while dashing and keeps its heading', () => {
    const sim = new Sim(makeLevel(), { players: 1, seed: 1 });
    const chef = place(sim, 0, 3.5, 3.5, 'right');
    sim.step([inp({ dashPressed: true })]);
    stepFor(sim, DASH_TIME / 2, inp({ moveY: 1 }));
    expect(chef.y).toBeCloseTo(3.5, 6);
    expect(chef.facing).toBe('right');
  });

  it('is refused during the cooldown and allowed after it', () => {
    const sim = new Sim(makeLevel(), { players: 1, seed: 1 });
    const chef = place(sim, 0, 2.5, 3.5, 'right');
    sim.step([inp({ dashPressed: true })]);
    stepFor(sim, DASH_TIME + 0.05);
    expect(chef.dashCooldown).toBeDefined();

    const again = sim.step([inp({ dashPressed: true })]);
    expect(types(again)).not.toContain('dash');
    expect(chef.dashTimeLeft).toBeUndefined();

    stepFor(sim, DASH_COOLDOWN);
    expect(chef.dashCooldown).toBeUndefined();
    const third = sim.step([inp({ dashPressed: true })]);
    expect(types(third)).toContain('dash');
  });

  it('stops flush against a wall', () => {
    const sim = new Sim(makeLevel(), { players: 1, seed: 1 });
    const chef = place(sim, 0, 9.5, 3.5, 'right');
    sim.step([inp({ dashPressed: true })]);
    stepFor(sim, DASH_TIME + 0.05);
    expect(chef.x).toBeCloseTo(11 - HALF, 6); // the sink at (11,3)
  });

  it('bumps another chef along the dash and knocks its item onto the floor', () => {
    const sim = new Sim(makeLevel(), { players: 2, seed: 1 });
    const dasher = place(sim, 0, 3.5, 3.5, 'right');
    const other = place(sim, 1, 4.9, 3.5, 'left');
    mutable(sim).chefs[1].holding = onion(9020);
    const events = [
      ...sim.step([inp({ dashPressed: true }), NO_INPUT]),
      ...stepFor(sim, DASH_TIME + 0.05, NO_INPUT, NO_INPUT),
    ];
    const bump = events.find((e) => e.type === 'dashBump');
    expect(bump).toMatchObject({ chef: 0, value: 1 });
    expect(events.filter((e) => e.type === 'dashBump').length).toBe(1); // one bump per dash
    expect(other.holding).toBeNull();
    expect(other.x).toBeGreaterThan(4.9);
    const dropped = sim.getState().tileItems.findIndex((item) => item && item.kind === 'ingredient' && item.id === 9020);
    expect(dropped).toBeGreaterThanOrEqual(0);
    expect(Math.floor(dropped / 13)).toBe(3); // on the bridge row, where the bumped chef stood
    expect(dasher.x).toBeLessThan(other.x);
  });

  it('wins over a chop in progress', () => {
    const sim = new Sim(makeLevel(), { players: 1, seed: 1 });
    const chef = place(sim, 0, 10.5, 1.5, 'right');
    mutable(sim).chefs[0].holding = onion(9021);
    sim.step([inp({ pickupPressed: true })]); // onto the board at (11,1)
    stepFor(sim, 0.3, inp({ interactHeld: true }));
    expect(chef.action).toBe('chopping');
    chef.facing = 'left';
    sim.step([inp({ dashPressed: true, interactHeld: true })]);
    expect(chef.action).toBe('dashing');
    expect(chef.x).toBeLessThan(10.5);
  });
});
