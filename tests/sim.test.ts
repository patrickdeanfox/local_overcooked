import { describe, expect, it } from 'vitest';
import level from '../src/levels/oc1/1-1.json';
import { Sim } from '../src/sim';
import { NO_INPUT, type PlayerInput } from '../src/sim/types';
import type { LevelDef } from '../src/levels/schema';

describe('Sim (contract smoke test)', () => {
  it('constructs from a level and places chefs on spawns', () => {
    const sim = new Sim(level as LevelDef, { players: 2, seed: 1 });
    const st = sim.getState();
    expect(st.chefs.length).toBe(2);
    expect(st.chefs[0].x).toBeCloseTo(level.spawns[0].x + 0.5);
  });
  it('moves a chef right when input says so', () => {
    const sim = new Sim(level as LevelDef, { players: 2, seed: 1 });
    const x0 = sim.getState().chefs[0].x;
    const input: PlayerInput = { ...NO_INPUT, moveX: 1 };
    for (let i = 0; i < 10; i++) sim.step([input, NO_INPUT]);
    expect(sim.getState().chefs[0].x).toBeGreaterThan(x0);
  });
});
