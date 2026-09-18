import { describe, expect, it } from 'vitest';
import { Sim } from '../src/sim';
import { FALL_PENALTY_SEC, SIM_DT } from '../src/sim/constants';
import { NO_INPUT, type Chef, type PlayerInput, type SimEvent, type SimState } from '../src/sim/types';
import { validateLevel, type Dynamic, type LevelDef } from '../src/levels/schema';

// ─── Fixtures ───────────────────────────────────────────────────────────────
// Two truck beds joined by a seam of hole gates on row 3 (columns 4-8), the road either side of it.
const TRUCKS = [
  '#SSS#ppp#####',
  'O.......V....',
  '#.......R....',
  '____GGGGG____',
  '....#.......X',
  '....#.......#',
  '....#.......B',
  '....#EWD#B###',
];
// A 3-wide river (columns 5-7) between two banks, floes drifting down it.
const RIVER = [
  '#O#S#___#p#B#',
  '#....___....V',
  '#....___....R',
  '#....___....W',
  '#....___....D',
  '#....___....#',
  '#....___....#',
  '#X#E#___#####',
];

const SEAM: Dynamic = { type: 'gate', group: '1', periodSec: 10, openSec: 5, closedAs: 'hole' };
const FLOES: Dynamic = { type: 'floes', x: 5, w: 3, dir: 'down', speed: 1, intervalSec: 6, lengths: [3, 2] };

function base(grid: string[], dynamics: Dynamic[], spawns: { x: number; y: number }[]): LevelDef {
  return {
    id: 'test-platforms', name: 'test', game: 'custom', world: 1, index: 1, theme: 'test',
    timeLimitSec: 300, timerStartsOnFirstServe: false, recipes: ['onion_soup'],
    orders: { initial: 1, intervalSec: 1000, max: 4, timeSec: 120 },
    stars: { 1: [10, 40, 60], 2: [10, 40, 60] },
    plates: { mode: 'sink', count: grid.join('').split('p').length - 1 },
    grid, spawns, dynamics,
  };
}

function trucks(patch: Partial<Dynamic> = {}): Sim {
  return new Sim(base(TRUCKS, [{ ...SEAM, ...patch } as Dynamic], [{ x: 6, y: 1 }, { x: 7, y: 5 }]), { players: 2, seed: 1 });
}

function river(patch: Partial<Dynamic> = {}): Sim {
  return new Sim(base(RIVER, [{ ...FLOES, ...patch } as Dynamic], [{ x: 2, y: 3 }, { x: 10, y: 3 }]), { players: 2, seed: 1 });
}

// ─── Helpers ────────────────────────────────────────────────────────────────
function inp(patch: Partial<PlayerInput>): PlayerInput {
  return { ...NO_INPUT, ...patch };
}

function mutable(sim: Sim): SimState {
  return sim.getState() as SimState;
}

function place(sim: Sim, x: number, y: number): Chef {
  const chef = mutable(sim).chefs[0];
  chef.x = x;
  chef.y = y;
  return chef;
}

function stepFor(sim: Sim, seconds: number, a: PlayerInput = NO_INPUT): SimEvent[] {
  const events: SimEvent[] = [];
  const steps = Math.round(seconds / SIM_DT);
  for (let i = 0; i < steps; i++) events.push(...sim.step([a, NO_INPUT]));
  return events;
}

// ─── Hole gates: the seam between two trucks ────────────────────────────────
describe('hole gates', () => {
  it('validate, and report themselves as holes', () => {
    expect(validateLevel(base(TRUCKS, [SEAM], [{ x: 6, y: 1 }, { x: 7, y: 5 }]))).toEqual([]);
    expect(trucks().getState().gates).toEqual([{ id: '1', open: true, secondsToChange: expect.any(Number), hole: true }]);
  });

  it('let a chef walk across while open', () => {
    const sim = trucks();
    const chef = place(sim, 6.5, 2.5);
    stepFor(sim, 1, inp({ moveY: 1 }));
    expect(chef.y).toBeGreaterThan(4);
    expect(chef.respawnIn).toBeUndefined();
  });

  it('drop a chef standing on the seam when it opens into a hole, instead of shoving it off', () => {
    const sim = trucks();
    stepFor(sim, 4.5);
    const chef = place(sim, 6.5, 3.5);
    const events = stepFor(sim, 1);
    expect(events.some((e) => e.type === 'chefFell')).toBe(true);
    expect(chef.respawnIn).toBeGreaterThan(FALL_PENALTY_SEC - 1);
  });

  it('are never solid: a closed seam blocks no one, it drops them', () => {
    const sim = trucks();
    stepFor(sim, 6);
    expect(sim.gateOpen('1')).toBe(false);
    const chef = place(sim, 6.5, 2.5);
    stepFor(sim, 0.5, inp({ moveY: 1 }));
    expect(chef.respawnIn).toBeDefined();
  });

  it('leave wall gates as they were', () => {
    const sim = trucks({ closedAs: 'wall' } as Partial<Dynamic>);
    stepFor(sim, 6);
    const chef = place(sim, 6.5, 2.5);
    stepFor(sim, 0.5, inp({ moveY: 1 }));
    expect(chef.respawnIn).toBeUndefined();
    expect(chef.y).toBeLessThan(3);
  });
});

// ─── Floes ──────────────────────────────────────────────────────────────────
describe('floes', () => {
  it('validate, and reject a lane off the grid', () => {
    expect(validateLevel(base(RIVER, [FLOES], [{ x: 2, y: 3 }, { x: 10, y: 3 }]))).toEqual([]);
    const bad = validateLevel(base(RIVER, [{ ...FLOES, x: 12 } as Dynamic], [{ x: 2, y: 3 }, { x: 10, y: 3 }]));
    expect(bad).toContain('floes lane is off the grid');
  });

  it('enter at the top edge on the first step and drift down at their speed', () => {
    const sim = river();
    sim.step([NO_INPUT, NO_INPUT]);
    const floes = sim.getState().floes ?? [];
    expect(floes).toHaveLength(1);
    expect(floes[0]).toMatchObject({ x: 5, w: 3, h: 3 });
    const y0 = floes[0].y;
    stepFor(sim, 2);
    expect(floes[0].y).toBeCloseTo(y0 + 2, 1);
  });

  it('cycle their lengths and leave once past the far edge', () => {
    const sim = river();
    stepFor(sim, 6.1);
    expect((sim.getState().floes ?? []).map((f) => f.h)).toEqual([3, 2]);
    stepFor(sim, 12);
    expect((sim.getState().floes ?? []).every((f) => f.y < 8)).toBe(true);
  });

  it('carry a chef standing on one, who does not fall', () => {
    const sim = river();
    stepFor(sim, 4); // the first floe covers rows 0-1 by now
    const floe = (sim.getState().floes ?? [])[0];
    const chef = place(sim, 6.5, floe.y + 1.5);
    const y0 = chef.y;
    stepFor(sim, 1);
    expect(chef.respawnIn).toBeUndefined();
    expect(chef.y).toBeCloseTo(y0 + 1, 1);
  });

  it('drop a chef who steps off into the water', () => {
    const sim = river();
    stepFor(sim, 4);
    const chef = place(sim, 6.5, 7.5); // open water below the floe
    const events = stepFor(sim, 0.1);
    expect(events.some((e) => e.type === 'chefFell')).toBe(true);
    expect(chef.respawnIn).toBeDefined();
  });

  it('prefill the lane when asked', () => {
    const empty = river();
    expect(empty.getState().floes).toEqual([]);
    const full = river({ prefill: true } as Partial<Dynamic>);
    expect((full.getState().floes ?? []).length).toBeGreaterThan(0);
  });

  it('run deterministically', () => {
    const run = (): string => {
      const sim = river({ prefill: true } as Partial<Dynamic>);
      for (let i = 0; i < 600; i++) {
        sim.step([inp({ moveX: Math.sin(i / 40), moveY: Math.cos(i / 30) }), inp({ moveX: -Math.sin(i / 35) })]);
      }
      return JSON.stringify(sim.getState());
    };
    expect(run()).toBe(run());
  });
});
