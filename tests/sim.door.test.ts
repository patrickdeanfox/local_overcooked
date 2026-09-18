import { describe, expect, it } from 'vitest';
import { Sim } from '../src/sim';
import { SIM_DT } from '../src/sim/constants';
import { NO_INPUT, type Chef, type PlayerInput, type SimState } from '../src/sim/types';
import { validateLevel, type LevelDef } from '../src/levels/schema';

// ─── Fixture ────────────────────────────────────────────────────────────────
// Two rooms joined by a door at (6,3); the pressure plate at (2,5) in the left room holds it open.
const GRID = [
  '#O####S######',
  '#.....#.....V',
  '#.....#.....#',
  '#.....G.....R',
  '#.....#.....W',
  '#.o...#.....D',
  '#p....#....B#',
  '#############',
];

function level(patch: Partial<LevelDef> = {}): LevelDef {
  return {
    id: 'test-door', name: 'test', game: 'custom', world: 1, index: 1, theme: 'test',
    timeLimitSec: 300, timerStartsOnFirstServe: false, recipes: ['onion_soup'],
    orders: { initial: 1, intervalSec: 1000, max: 4, timeSec: 120 },
    stars: { 1: [10, 40, 60], 2: [10, 40, 60] },
    plates: { mode: 'sink', count: 1 },
    grid: GRID, spawns: [{ x: 3, y: 2 }, { x: 9, y: 2 }],
    stations: [{ x: 2, y: 5, group: 'p' }, { x: 6, y: 3, group: 'd' }],
    dynamics: [{ type: 'door', group: 'd', plate: 'p' }],
    ...patch,
  };
}

function make(): Sim {
  return new Sim(level(), { players: 2, seed: 1 });
}

function inp(patch: Partial<PlayerInput>): PlayerInput {
  return { ...NO_INPUT, ...patch };
}

function mutable(sim: Sim): SimState {
  return sim.getState() as SimState;
}

function put(sim: Sim, index: number, x: number, y: number): Chef {
  const chef = mutable(sim).chefs[index];
  chef.x = x;
  chef.y = y;
  return chef;
}

function stepFor(sim: Sim, seconds: number, a: PlayerInput = NO_INPUT, b: PlayerInput = NO_INPUT): void {
  for (let i = 0; i < Math.round(seconds / SIM_DT); i++) sim.step([a, b]);
}

describe('pressure-plate doors', () => {
  it('validate, and name a real plate group', () => {
    expect(validateLevel(level())).toEqual([]);
    const bad = validateLevel(level({ dynamics: [{ type: 'door', group: 'd', plate: 'nope' }] }));
    expect(bad).toContain("door group 'd' names plate 'nope', which has no pressure plates");
  });

  it('start closed: a chef walking at the door is stopped', () => {
    const sim = make();
    expect(sim.gateOpen('d')).toBe(false);
    const chef = put(sim, 1, 8.5, 3.5);
    stepFor(sim, 1, NO_INPUT, inp({ moveX: -1 }));
    expect(chef.x).toBeGreaterThan(7);
  });

  it('open while a chef stands on the plate, and close when it steps off', () => {
    const sim = make();
    put(sim, 0, 2.5, 5.5);
    stepFor(sim, 0.1);
    expect(sim.gateOpen('d')).toBe(true);
    const chef = put(sim, 1, 8.5, 3.5);
    stepFor(sim, 1, NO_INPUT, inp({ moveX: -1 }));
    expect(chef.x).toBeLessThan(6);
    put(sim, 0, 4.5, 2.5);
    stepFor(sim, 0.1);
    expect(sim.gateOpen('d')).toBe(false);
  });

  it('never flash a timer warning', () => {
    const sim = make();
    stepFor(sim, 5);
    expect(sim.getState().gates?.[0].secondsToChange).toBeGreaterThan(100);
  });

  it('run deterministically', () => {
    const run = (): string => {
      const sim = make();
      for (let i = 0; i < 600; i++) sim.step([inp({ moveX: Math.sin(i / 30), moveY: Math.cos(i / 25) }), inp({ moveX: -1 })]);
      return JSON.stringify(sim.getState());
    };
    expect(run()).toBe(run());
  });
});
