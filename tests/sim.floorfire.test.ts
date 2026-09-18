import { describe, expect, it } from 'vitest';
import { Sim } from '../src/sim';
import { FLOOR_FIRE_CLEARANCE, SIM_DT } from '../src/sim/constants';
import { NO_INPUT, type Chef, type PlayerInput, type SimEvent, type SimState } from '../src/sim/types';
import { validateLevel, type Dynamic, type LevelDef } from '../src/levels/schema';

// ─── Fixture ────────────────────────────────────────────────────────────────
const GRID = [
  '#############',
  '#O.........B#',
  '#T.........S#',
  '#...........W',
  '#...........D',
  '#p.........V#',
  '#X.........E#',
  '#########R###',
];

const FIRES: Dynamic = { type: 'floorFires', intervalSec: 5, max: 2, firstDelaySec: 2 };

function make(dynamics: Dynamic[] = [FIRES], seed = 1): Sim {
  const level: LevelDef = {
    id: 'test-floorfire', name: 'test', game: 'custom', world: 1, index: 1, theme: 'test',
    timeLimitSec: 300, timerStartsOnFirstServe: false, recipes: ['onion_soup'],
    orders: { initial: 1, intervalSec: 1000, max: 4, timeSec: 120 },
    stars: { 1: [10, 40, 60], 2: [10, 40, 60] },
    plates: { mode: 'sink', count: 1 },
    grid: GRID, spawns: [{ x: 3, y: 3 }, { x: 9, y: 3 }], dynamics,
  };
  return new Sim(level, { players: 2, seed });
}

function inp(patch: Partial<PlayerInput>): PlayerInput {
  return { ...NO_INPUT, ...patch };
}

function stepFor(sim: Sim, seconds: number, a: PlayerInput = NO_INPUT): SimEvent[] {
  const events: SimEvent[] = [];
  const steps = Math.round(seconds / SIM_DT);
  for (let i = 0; i < steps; i++) events.push(...sim.step([a, NO_INPUT]));
  return events;
}

function floorFires(sim: Sim): { x: number; y: number }[] {
  const st = sim.getState();
  return st.fires.filter((f) => st.tiles[f.y * st.width + f.x].type === 'floor');
}

describe('floor fires', () => {
  it('validate, and reject a zero interval', () => {
    const level = make().level;
    expect(validateLevel(level)).toEqual([]);
    expect(validateLevel({ ...level, dynamics: [{ ...FIRES, intervalSec: 0 } as Dynamic] })).toContain('floorFires needs a positive intervalSec and max');
  });

  it('break out after firstDelaySec, one per interval, up to max', () => {
    const sim = make();
    stepFor(sim, 1.9);
    expect(floorFires(sim)).toHaveLength(0);
    const events = stepFor(sim, 0.2);
    expect(events.some((e) => e.type === 'fireStart')).toBe(true);
    expect(floorFires(sim)).toHaveLength(1);
    stepFor(sim, 5);
    expect(floorFires(sim)).toHaveLength(2);
    stepFor(sim, 5);
    expect(floorFires(sim)).toHaveLength(2);
  });

  it('never break out next to a chef', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const sim = make([FIRES], seed);
      stepFor(sim, 2.1);
      const [fire] = floorFires(sim);
      for (const chef of sim.getState().chefs) {
        expect(Math.hypot(chef.x - (fire.x + 0.5), chef.y - (fire.y + 0.5))).toBeGreaterThanOrEqual(FLOOR_FIRE_CLEARANCE);
      }
    }
  });

  it('block the tile until sprayed out, then let chefs through', () => {
    const sim = make();
    stepFor(sim, 2.1);
    const [fire] = floorFires(sim);
    const st = sim.getState() as SimState;
    const chef: Chef = st.chefs[0];
    // Stand on the open side of the fire, facing it, and walk at it: blocked.
    const fromLeft = sim.tileAt(fire.x - 1, fire.y)?.type === 'floor';
    const dir = fromLeft ? 1 : -1;
    chef.x = fire.x + 0.5 - dir * 1.2;
    chef.y = fire.y + 0.5;
    chef.facing = fromLeft ? 'right' : 'left';
    stepFor(sim, 0.5, inp({ moveX: dir }));
    expect(Math.abs(chef.x - (fire.x + 0.5))).toBeGreaterThanOrEqual(0.8 - 1e-6);
    // Spray it out.
    chef.holding = { kind: 'extinguisher', id: 999 };
    stepFor(sim, 2, inp({ interactHeld: true }));
    expect(floorFires(sim)).toHaveLength(0);
    chef.holding = null;
    stepFor(sim, 0.4, inp({ moveX: dir }));
    expect(dir * (chef.x - (fire.x + 0.5))).toBeGreaterThan(-0.2); // walked onto the tile it could not enter
  });

  it('run deterministically', () => {
    const run = (): string => {
      const sim = make();
      for (let i = 0; i < 1200; i++) sim.step([inp({ moveX: Math.sin(i / 40), moveY: Math.cos(i / 30) }), NO_INPUT]);
      return JSON.stringify(sim.getState());
    };
    expect(run()).toBe(run());
  });
});
