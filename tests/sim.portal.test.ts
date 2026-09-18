import { describe, expect, it } from 'vitest';
import { Sim } from '../src/sim';
import { SIM_DT } from '../src/sim/constants';
import { NO_INPUT, type Chef, type Facing, type PlayerInput, type SimEvent, type SimState } from '../src/sim/types';
import { validateLevel, type LevelDef } from '../src/levels/schema';

// ─── Fixture ────────────────────────────────────────────────────────────────
// Two rooms split by a rift (column 6); a portal pair joins (1,1) on the left to (11,6) on the right.
const GRID = [
  '#####OzS#####',
  '#@....z.....#',
  '#.....z.....V',
  '#.....z.....#',
  '#.....z.....W',
  '#.....z.....D',
  '#p....z....@R',
  '#####XzB#####',
];

function level(patch: Partial<LevelDef> = {}): LevelDef {
  return {
    id: 'test-portal', name: 'test', game: 'custom', world: 1, index: 1, theme: 'test',
    timeLimitSec: 300, timerStartsOnFirstServe: false, recipes: ['onion_soup'],
    orders: { initial: 1, intervalSec: 1000, max: 4, timeSec: 120 },
    stars: { 1: [10, 40, 60], 2: [10, 40, 60] },
    plates: { mode: 'sink', count: 1 },
    grid: GRID, spawns: [{ x: 3, y: 3 }, { x: 9, y: 3 }],
    stations: [{ x: 1, y: 1, group: 'a' }, { x: 11, y: 6, group: 'a' }],
    ...patch,
  };
}

function make(patch: Partial<LevelDef> = {}): Sim {
  return new Sim(level(patch), { players: 2, seed: 1 });
}

function inp(patch: Partial<PlayerInput>): PlayerInput {
  return { ...NO_INPUT, ...patch };
}

function mutable(sim: Sim): SimState {
  return sim.getState() as SimState;
}

function place(sim: Sim, x: number, y: number, facing: Facing): Chef {
  const chef = mutable(sim).chefs[0];
  chef.x = x;
  chef.y = y;
  chef.facing = facing;
  return chef;
}

function stepFor(sim: Sim, seconds: number, a: PlayerInput = NO_INPUT): SimEvent[] {
  const events: SimEvent[] = [];
  const steps = Math.round(seconds / SIM_DT);
  for (let i = 0; i < steps; i++) events.push(...sim.step([a, NO_INPUT]));
  return events;
}

describe('portals', () => {
  it('validate in pairs, and reject a lone or ungrouped portal', () => {
    expect(validateLevel(level())).toEqual([]);
    expect(validateLevel(level({ stations: [{ x: 1, y: 1, group: 'a' }] }))).toContain('portal (11,6) has no group: pair it with a stations override');
    expect(validateLevel(level({ stations: [{ x: 1, y: 1, group: 'a' }, { x: 11, y: 6, group: 'b' }] }))).toContain("portal group 'a' has 1 portals, not 2");
  });

  /** Walks chef 0 left until it comes out of a portal, then lets go of the stick. */
  function walkIntoPortal(sim: Sim): SimEvent[] {
    for (let i = 0; i < 60; i++) {
      const events = sim.step([inp({ moveX: -1 }), NO_INPUT]);
      if (events.some((e) => e.type === 'portal')) return events;
    }
    return [];
  }

  it('send a chef that steps on one out of the other', () => {
    const sim = make();
    const chef = place(sim, 2.5, 1.5, 'left');
    const events = walkIntoPortal(sim);
    expect(events.some((e) => e.type === 'portal' && e.chef === 0)).toBe(true);
    expect(chef.x).toBeCloseTo(11.5);
    expect(chef.y).toBeCloseTo(6.5);
  });

  it('do not bounce a chef straight back while it stands on the far portal', () => {
    const sim = make();
    const chef = place(sim, 2.5, 1.5, 'left');
    walkIntoPortal(sim);
    const events = stepFor(sim, 0.5);
    expect(events.some((e) => e.type === 'portal')).toBe(false);
    expect(Math.floor(chef.x)).toBe(11);
    // Step off and back on: through again.
    stepFor(sim, 0.2, inp({ moveX: -1 }));
    expect(Math.floor(chef.x)).toBe(10);
    const back = stepFor(sim, 0.2, inp({ moveX: 1 }));
    expect(back.some((e) => e.type === 'portal')).toBe(true);
    expect(Math.floor(chef.y)).toBe(1); // out on the left, at (1,1)
  });

  it('carry a thrown ingredient through', () => {
    const sim = make();
    const chef = place(sim, 3.5, 1.5, 'left');
    chef.holding = { kind: 'ingredient', id: 900, type: 'onion', chopped: false, chopProgress: 0 };
    sim.step([inp({ throwPressed: true }), NO_INPUT]);
    const events = stepFor(sim, 1);
    expect(events.some((e) => e.type === 'portal' && e.value !== undefined)).toBe(true);
    const st = mutable(sim);
    const at = st.tileItems.findIndex((item) => item?.id === 900);
    expect(at % st.width).toBeGreaterThan(6); // came down on the right of the rift
  });
});

describe('the rift', () => {
  it('stops a chef', () => {
    const sim = make();
    const chef = place(sim, 5.5, 3.5, 'right');
    stepFor(sim, 0.5, inp({ moveX: 1 }));
    expect(chef.x).toBeLessThan(6);
    expect(chef.respawnIn).toBeUndefined();
  });

  it('lets a throw fly over it', () => {
    const sim = make();
    const chef = place(sim, 4.5, 3.5, 'right');
    chef.holding = { kind: 'ingredient', id: 901, type: 'onion', chopped: false, chopProgress: 0 };
    sim.step([inp({ throwPressed: true }), NO_INPUT]);
    stepFor(sim, 1);
    const st = mutable(sim);
    const at = st.tileItems.findIndex((item) => item?.id === 901);
    expect(at % st.width).toBeGreaterThan(6);
  });

  it('never catches fire', () => {
    const sim = make();
    mutable(sim).fires.push({ x: 7, y: 0, health: 1, spreadTimer: 0.01 });
    stepFor(sim, 30);
    expect(sim.fireAt(6, 0)).toBe(false);
  });

  it('runs deterministically', () => {
    const run = (): string => {
      const sim = make();
      for (let i = 0; i < 600; i++) sim.step([inp({ moveX: Math.sin(i / 30), moveY: Math.cos(i / 25) }), NO_INPUT]);
      return JSON.stringify(sim.getState());
    };
    expect(run()).toBe(run());
  });
});
