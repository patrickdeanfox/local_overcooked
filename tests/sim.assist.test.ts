import { describe, expect, it } from 'vitest';
import { Sim } from '../src/sim';
import { ASSIST_RATE, CHOP_TIME, SIM_DT } from '../src/sim/constants';
import {
  NO_INPUT,
  type Chef, type Facing, type IngredientItem, type PlayerInput, type SimEvent, type SimState,
} from '../src/sim/types';
import type { LevelDef } from '../src/levels/schema';

// ─── Fixture ────────────────────────────────────────────────────────────────
// A 13x8 kitchen with an island chopping board at (5,2), so one chef can stand above it facing
// down and another below it facing up: the same station from two sides.
const GRID = [
  '#############',
  '#O.........S#',
  '#....B......#',
  '#..........W#',
  '#..........D#',
  '#p.........V#',
  '#X.........E#',
  '#############',
];

const BASE: LevelDef = {
  id: 'test-assist',
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

const BOARD = 2 * 13 + 5;

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

function onionOnBoard(sim: Sim): IngredientItem {
  const item: IngredientItem = { kind: 'ingredient', id: 9001, type: 'onion', chopped: false, chopProgress: 0 };
  mutable(sim).tileItems[BOARD] = item;
  return item;
}

/** Both chefs at the island board: chef 0 above facing down, chef 1 below facing up. */
function bothAtBoard(sim: Sim): [Chef, Chef] {
  return [place(sim, 0, 5.5, 1.5, 'down'), place(sim, 1, 5.5, 3.5, 'up')];
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

const HOLD = inp({ interactHeld: true });

// ─── Off ────────────────────────────────────────────────────────────────────
describe('chop assist off', () => {
  it('a board is one chef\'s work: the second pair of hands adds nothing', () => {
    const sim = new Sim(makeLevel(), { players: 2, seed: 1 });
    const item = onionOnBoard(sim);
    const [a, b] = bothAtBoard(sim);
    stepFor(sim, CHOP_TIME / 2, HOLD, HOLD);
    expect(item.chopProgress).toBeCloseTo(0.5, 2);
    expect(item.chopped).toBe(false);
    expect(a.action).toBe('chopping');
    expect(b.action).not.toBe('chopping');
    expect(a.assisting).toBeUndefined();
    expect(b.assisting).toBeUndefined();
  });

  it('one chef alone chops in CHOP_TIME', () => {
    const sim = new Sim(makeLevel(), { players: 2, seed: 1 });
    const item = onionOnBoard(sim);
    bothAtBoard(sim);
    const events = stepFor(sim, CHOP_TIME + SIM_DT, HOLD, NO_INPUT);
    expect(item.chopped).toBe(true);
    expect(types(events)).toContain('chopDone');
  });
});

// ─── On ─────────────────────────────────────────────────────────────────────
describe('chop assist on', () => {
  const mods = { chopAssist: true };

  it('two chefs at the same board halve the time and the second is marked as assisting', () => {
    const sim = new Sim(makeLevel(), { players: 2, seed: 1, modifiers: mods });
    const item = onionOnBoard(sim);
    const [a, b] = bothAtBoard(sim);
    expect(ASSIST_RATE).toBe(2);
    const early = stepFor(sim, CHOP_TIME / ASSIST_RATE - 0.1, HOLD, HOLD);
    expect(item.chopped).toBe(false);
    expect(types(early)).not.toContain('chopDone');
    expect(a.action).toBe('chopping');
    expect(b.action).toBe('chopping');
    expect(a.assisting).toBeUndefined();
    expect(b.assisting).toBe(true);
    const late = stepFor(sim, 0.2, HOLD, HOLD);
    expect(item.chopped).toBe(true);
    expect(types(late)).toContain('chopDone');
  });

  it('acts on the remaining time: joining at 80% halves what is left', () => {
    const sim = new Sim(makeLevel(), { players: 2, seed: 1, modifiers: mods });
    const item = onionOnBoard(sim);
    bothAtBoard(sim);
    stepFor(sim, CHOP_TIME * 0.8, HOLD, NO_INPUT);
    expect(item.chopProgress).toBeCloseTo(0.8, 2);
    stepFor(sim, CHOP_TIME * 0.1 - SIM_DT, HOLD, HOLD);
    expect(item.chopped).toBe(false);
    stepFor(sim, 2 * SIM_DT, HOLD, HOLD);
    expect(item.chopped).toBe(true);
  });

  it('the assist mark clears the step the second chef lets go', () => {
    const sim = new Sim(makeLevel(), { players: 2, seed: 1, modifiers: mods });
    onionOnBoard(sim);
    const [, b] = bothAtBoard(sim);
    sim.step([HOLD, HOLD]);
    expect(b.assisting).toBe(true);
    sim.step([HOLD, NO_INPUT]);
    expect(b.assisting).toBeUndefined();
  });

  it('a chef alone is the normal rate', () => {
    const sim = new Sim(makeLevel(), { players: 2, seed: 1, modifiers: mods });
    const item = onionOnBoard(sim);
    bothAtBoard(sim);
    stepFor(sim, CHOP_TIME / 2, HOLD, NO_INPUT);
    expect(item.chopProgress).toBeCloseTo(0.5, 2);
  });

  it('replays identically for the same seed and inputs', () => {
    function run(seed: number): string {
      const sim = new Sim(makeLevel(), { players: 2, seed, modifiers: mods });
      onionOnBoard(sim);
      bothAtBoard(sim);
      for (let i = 0; i < 300; i++) {
        const a = inp({ interactHeld: i % 40 < 30, moveX: i > 200 ? 1 : 0 });
        const b = inp({ interactHeld: i % 50 < 35, pickupPressed: i % 97 === 0 });
        sim.step([a, b]);
      }
      return JSON.stringify(sim.getState());
    }
    expect(run(3)).toBe(run(3));
  });
});
