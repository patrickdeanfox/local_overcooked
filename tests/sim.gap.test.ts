import { describe, expect, it } from 'vitest';
import { Sim } from '../src/sim';
import { DASH_TIME, FALL_PENALTY_SEC, SIM_DT, THROW_RANGE } from '../src/sim/constants';
import {
  NO_INPUT,
  type Chef, type Facing, type IngredientItem, type PlayerInput, type SimEvent, type SimState,
} from '../src/sim/types';
import { isWalkable, parseGrid, SOLID_TILES, validateLevel, type LevelDef } from '../src/levels/schema';

// ─── Fixture ────────────────────────────────────────────────────────────────
// The throwing kitchen: a two-tile hole (columns 7 and 8) with a floor bridge on row 3.
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
  id: 'test-gap',
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

// ─── The tile ───────────────────────────────────────────────────────────────
describe('the gap tile', () => {
  it('is a hole, not a wall: not walkable, not solid', () => {
    expect(isWalkable('gap')).toBe(false);
    expect(SOLID_TILES.has('gap')).toBe(false);
    const parsed = parseGrid(makeLevel());
    expect(parsed.tiles[1 * 13 + 7].type).toBe('gap');
    expect(parsed.tiles[3 * 13 + 7].type).toBe('floor');
  });

  it('refuses a spawn on a gap', () => {
    const errors = validateLevel(makeLevel({ spawns: [{ x: 7, y: 1 }, { x: 9, y: 3 }] }));
    expect(errors.some((e) => e.includes('(7,1)') && e.includes('walkable'))).toBe(true);
    expect(validateLevel(makeLevel())).toEqual([]);
  });
});

// ─── Falling ────────────────────────────────────────────────────────────────
describe('falling', () => {
  it('a chef that walks onto a gap falls, loses what it held and comes back at its spawn after FALL_PENALTY_SEC', () => {
    const sim = new Sim(makeLevel(), { players: 1, seed: 1 });
    const chef = place(sim, 0, 6.4, 1.5, 'right');
    mutable(sim).chefs[0].holding = onion(9030);
    const events = stepFor(sim, 0.25, inp({ moveX: 1 }));
    expect(types(events)).toContain('chefFell');
    expect(events.find((e) => e.type === 'chefFell')).toMatchObject({ chef: 0, x: 7, y: 1 });
    expect(chef.action).toBe('falling');
    expect(chef.holding).toBeNull();
    expect(chef.respawnIn).toBeGreaterThan(FALL_PENALTY_SEC - 0.3);
    expect(sim.getState().tileItems.some((item) => item && item.kind === 'ingredient')).toBe(false);

    stepFor(sim, FALL_PENALTY_SEC + 0.1);
    expect(chef.respawnIn).toBeUndefined();
    expect(chef.action).toBe('idle');
    expect(chef.x).toBeCloseTo(3.5, 6);
    expect(chef.y).toBeCloseTo(3.5, 6);
  });

  it('pins a fallen chef and keeps it out of the other chef\'s way', () => {
    const sim = new Sim(makeLevel(), { players: 2, seed: 1 });
    const fallen = place(sim, 0, 7.2, 1.5, 'right');
    sim.step([NO_INPUT, NO_INPUT]);
    expect(fallen.action).toBe('falling');
    const other = place(sim, 1, 6.9, 1.5, 'left'); // right beside the hole, overlapping the fallen chef
    const x = fallen.x;
    stepFor(sim, 0.5, inp({ moveX: -1 }), NO_INPUT);
    expect(fallen.x).toBe(x);
    expect(other.x).toBeCloseTo(6.9, 6); // no separation push from a chef that is in the hole
    expect(other.action).toBe('idle');
  });

  it('a dash into a gap ends in the hole', () => {
    const sim = new Sim(makeLevel(), { players: 1, seed: 1 });
    const chef = place(sim, 0, 5.5, 1.5, 'right');
    const events = [...sim.step([inp({ dashPressed: true })]), ...stepFor(sim, DASH_TIME + 0.05)];
    expect(types(events)).toContain('chefFell');
    expect(chef.action).toBe('falling');
    expect(chef.dashTimeLeft).toBeUndefined();
  });
});

// ─── Gates ──────────────────────────────────────────────────────────────────
describe('throwing over a closed gate', () => {
  const GATE_GRID = [
    '#############',
    '#O....G....B#',
    '#R....G....S#',
    '#.....G....W#',
    '#.....G....D#',
    '#p....G....V#',
    '#X....G....E#',
    '#############',
  ];

  it('the item flies over the seam a chef cannot cross', () => {
    const level = makeLevel({
      grid: GATE_GRID,
      spawns: [{ x: 3, y: 3 }, { x: 9, y: 3 }],
      dynamics: [{ type: 'gate', group: '1', periodSec: 4, openSec: 2, phase: 0.5 }],
    });
    const sim = new Sim(level, { players: 1, seed: 1 });
    expect(sim.gateOpen('1')).toBe(false);
    const chef = place(sim, 0, 4.5, 3.5, 'right');
    mutable(sim).chefs[0].holding = onion(9031);
    sim.step([inp({ throwPressed: true })]);
    stepFor(sim, 1);
    expect(sim.itemAt(Math.floor(4.8 + THROW_RANGE), 3)).toMatchObject({ kind: 'ingredient', id: 9031 });
    expect(chef.x).toBeLessThan(6); // the chef itself is still on the left
  });
});
