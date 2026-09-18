import { describe, expect, it } from 'vitest';
import { Sim } from '../src/sim';
import { CONVEYOR_HOLD, CONVEYOR_SPEED, SIM_DT, TRASH_RESPAWN_SEC } from '../src/sim/constants';
import {
  NO_INPUT,
  type Chef, type Facing, type IngredientItem, type Item, type PlayerInput, type SimEvent, type SimState,
} from '../src/sim/types';
import { parseGrid, SOLID_TILES, validateLevel, type LevelDef } from '../src/levels/schema';

// ─── Fixture ────────────────────────────────────────────────────────────────
// A 13x8 kitchen split by a wall (column 6). Row 0 is a belt carrying east from the west room to
// the east room and on into a counter at (12,0); row 7 is a belt carrying west into a bin at (0,7).
const GRID = [
  '>>>>>>>>>>>>#',
  '#O...E#....V#',
  '#T....#....S#',
  '#A....#....W#',
  '#U....#....D#',
  '#p....#....R#',
  '#F....#....B#',
  'X<<<<<<<<<<<<',
];

const BASE: LevelDef = {
  id: 'test-belt',
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
  return chef;
}

function onion(id: number): IngredientItem {
  return { kind: 'ingredient', id, type: 'onion', chopped: false, chopProgress: 0 };
}

function put(sim: Sim, x: number, y: number, item: Item | null): void {
  const st = mutable(sim);
  st.tileItems[y * st.width + x] = item;
}

function stepFor(sim: Sim, seconds: number): SimEvent[] {
  const events: SimEvent[] = [];
  const steps = Math.round(seconds / SIM_DT);
  for (let i = 0; i < steps; i++) events.push(...sim.step([NO_INPUT, NO_INPUT]));
  return events;
}

function types(events: SimEvent[]): string[] {
  return events.map((e) => e.type);
}

/** Seconds for an item to ride n whole tiles. */
function tiles(n: number): number {
  return n / CONVEYOR_SPEED;
}

// ─── Legend and schema ──────────────────────────────────────────────────────
describe('conveyor legend', () => {
  it('parses the four arrows as solid belt tiles with a direction', () => {
    const p = parseGrid(makeLevel({ grid: ['>v<^'] }));
    expect(p.tiles.map((t) => [t.type, t.dir])).toEqual([
      ['conveyor', 'right'], ['conveyor', 'down'], ['conveyor', 'left'], ['conveyor', 'up'],
    ]);
    expect(SOLID_TILES.has('conveyor')).toBe(true);
  });

  it('validates the fixture', () => {
    expect(validateLevel(makeLevel())).toEqual([]);
  });

  it('reports beltProgress only on a level with belts', () => {
    expect(make().getState().beltProgress).toHaveLength(13 * 8);
    const plain = makeLevel({ grid: GRID.map((row) => row.replace(/[<>^v]/g, '#')) });
    expect(new Sim(plain, { players: 2, seed: 1 }).getState().beltProgress).toBeUndefined();
  });
});

// ─── Carrying ───────────────────────────────────────────────────────────────
describe('belt carrying', () => {
  it('carries an item one tile per 1/CONVEYOR_SPEED seconds', () => {
    const sim = make();
    put(sim, 2, 0, onion(900));
    stepFor(sim, tiles(3) + 0.05);
    expect(sim.itemAt(5, 0)?.id).toBe(900);
    expect(sim.itemAt(2, 0)).toBeNull();
  });

  it('hands off onto an empty counter at the end of the run', () => {
    const sim = make();
    put(sim, 10, 0, onion(901));
    stepFor(sim, tiles(3));
    expect(sim.itemAt(12, 0)?.id).toBe(901);
    stepFor(sim, 2);
    expect(sim.itemAt(12, 0)?.id).toBe(901); // a counter does not carry
  });

  it('holds an item at the seam while the next tile is taken, and resumes when it frees', () => {
    const sim = make();
    put(sim, 12, 0, onion(1));  // the end counter is full
    put(sim, 11, 0, onion(902));
    stepFor(sim, 2);
    expect(sim.itemAt(11, 0)?.id).toBe(902);
    expect(sim.getState().beltProgress?.[11]).toBeCloseTo(CONVEYOR_HOLD);
    put(sim, 12, 0, null);
    stepFor(sim, tiles(CONVEYOR_HOLD) + 0.05);
    expect(sim.itemAt(12, 0)?.id).toBe(902);
  });

  it('queues a line of items without merging them', () => {
    const sim = make();
    put(sim, 12, 0, onion(1));
    for (let x = 6; x <= 11; x++) put(sim, x, 0, onion(100 + x));
    stepFor(sim, 5);
    for (let x = 6; x <= 11; x++) expect(sim.itemAt(x, 0)?.id).toBe(100 + x);
  });

  it('lets a chef take an item off a belt and put one on', () => {
    const sim = make();
    put(sim, 3, 0, onion(903));
    place(sim, 0, 3.5, 1.5, 'up');
    sim.step([inp({ pickupPressed: true }), NO_INPUT]);
    expect(sim.getState().chefs[0].holding?.id).toBe(903);
    expect(sim.itemAt(3, 0)).toBeNull();
    sim.step([NO_INPUT, NO_INPUT]);
    sim.step([inp({ pickupPressed: true }), NO_INPUT]);
    expect(sim.itemAt(3, 0)?.id).toBe(903);
    expect(sim.getState().beltProgress?.[3]).toBeLessThan(0.1); // a new item starts at the tile centre
  });

  it('stands still while the belt tile is on fire', () => {
    const sim = make();
    put(sim, 3, 0, onion(904));
    mutable(sim).fires.push({ x: 3, y: 0, health: 1, spreadTimer: 1000 });
    stepFor(sim, 2);
    expect(sim.itemAt(3, 0)?.id).toBe(904);
  });
});

// ─── Belts into a bin ───────────────────────────────────────────────────────
describe('belt into a bin', () => {
  it('destroys an ingredient for good', () => {
    const sim = make();
    put(sim, 1, 7, onion(905));
    const events = stepFor(sim, tiles(1) + 0.05);
    expect(types(events)).toContain('trash');
    stepFor(sim, TRASH_RESPAWN_SEC + 1);
    expect(mutable(sim).tileItems.some((item) => item?.id === 905)).toBe(false);
  });

  it('sends a plate back clean to where it started after TRASH_RESPAWN_SEC', () => {
    const sim = make();
    const plate = sim.itemAt(1, 5);
    expect(plate?.kind).toBe('plate');
    if (plate?.kind !== 'plate') return;
    plate.dish = { type: 'soup', ingredients: ['onion', 'onion', 'onion'] };
    put(sim, 1, 5, null);
    put(sim, 1, 7, plate);
    stepFor(sim, tiles(1) + 0.05);
    expect(sim.itemAt(1, 5)).toBeNull();
    stepFor(sim, TRASH_RESPAWN_SEC - 0.2);
    expect(sim.itemAt(1, 5)).toBeNull();
    const events = stepFor(sim, 0.3);
    expect(types(events)).toContain('respawned');
    const back = sim.itemAt(1, 5);
    expect(back?.kind === 'plate' && back.dish === null).toBe(true);
  });

  it('brings a pan back empty to its burner, and waits while the burner is taken', () => {
    const sim = make();
    const pan = sim.itemAt(1, 6);
    expect(pan?.kind).toBe('pot');
    if (pan?.kind !== 'pot') return;
    pan.contents.push('meat');
    pan.state = 'cooking';
    put(sim, 1, 6, onion(1)); // something else on the burner
    put(sim, 1, 7, pan);
    stepFor(sim, tiles(1) + TRASH_RESPAWN_SEC + 0.2);
    expect(sim.itemAt(1, 6)?.id).toBe(1);
    put(sim, 1, 6, null);
    stepFor(sim, 0.1);
    const back = sim.itemAt(1, 6);
    expect(back?.kind === 'pot' && back.contents.length === 0 && back.state === 'empty').toBe(true);
  });
});

// ─── Determinism ────────────────────────────────────────────────────────────
describe('belt determinism', () => {
  function run(seed: number): string {
    const sim = new Sim(makeLevel(), { players: 2, seed });
    put(sim, 0, 0, onion(950));
    put(sim, 12, 7, onion(951));
    for (let i = 0; i < 600; i++) {
      const a = inp({ moveX: Math.sin(i / 30), moveY: Math.cos(i / 40), pickupPressed: i % 50 === 0 });
      const b = inp({ moveX: -Math.sin(i / 25), moveY: Math.cos(i / 35), pickupPressed: i % 70 === 0 });
      sim.step([a, b]);
    }
    return JSON.stringify(sim.getState());
  }

  it('produces identical snapshots for the same seed and inputs', () => {
    expect(run(7)).toBe(run(7));
  });
});
