import { describe, expect, it } from 'vitest';
import level from '../src/levels/oc1/1-1.json';
import { Sim } from '../src/sim';
import { NO_INPUT, type PlayerInput } from '../src/sim/types';
import { isWalkable, type LevelDef } from '../src/levels/schema';

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
  it('keeps both chefs on walkable tiles through ten seconds of mashing', () => {
    const sim = new Sim(level as LevelDef, { players: 2, seed: 99 });
    for (let i = 0; i < 600; i++) {
      sim.step([
        { ...NO_INPUT, moveX: Math.sin(i * 0.13), moveY: Math.cos(i * 0.09), pickupPressed: i % 19 === 0, interactHeld: i % 11 < 6 },
        { ...NO_INPUT, moveX: Math.cos(i * 0.05), moveY: Math.sin(i * 0.17), pickupPressed: i % 23 === 0, interactHeld: i % 13 < 7 },
      ]);
    }
    const st = sim.getState();
    for (const chef of st.chefs) {
      expect(chef.x).toBeGreaterThan(0);
      expect(chef.y).toBeGreaterThan(0);
      expect(chef.x).toBeLessThan(st.width);
      expect(chef.y).toBeLessThan(st.height);
      const tile = sim.tileAt(Math.floor(chef.x), Math.floor(chef.y));
      expect(tile !== null && isWalkable(tile.type)).toBe(true);
    }
  });
});
