import { describe, expect, it } from 'vitest';
import { Sim } from '../src/sim';
import { SIM_DT, TWO_PLATE_MAX } from '../src/sim/constants';
import {
  NO_INPUT,
  type Chef, type Facing, type PlateItem, type PlayerInput, type PotItem, type SimEvent, type SimState,
} from '../src/sim/types';
import type { LevelDef } from '../src/levels/schema';

// ─── Fixture ────────────────────────────────────────────────────────────────
// A plain 13x8 kitchen: onion crate and plate return on the left, board, stove with a pot, sink,
// drying rack, serve and extinguisher counter on the right wall, a plate on a counter at (1,5).
const GRID = [
  '#############',
  '#O.........B#',
  '#R.........S#',
  '#..........W#',
  '#..........D#',
  '#p.........V#',
  '#X.........E#',
  '#############',
];

const BASE: LevelDef = {
  id: 'test-twoplate',
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

const DRYING = 4 * 13 + 11;   // tile index of the drying rack (11,4)
const TOP_COUNTER = 0 * 13 + 5; // a bare counter on the top wall (5,0)

function makeLevel(patch: Partial<LevelDef> = {}): LevelDef {
  return { ...BASE, ...patch, grid: patch.grid ?? [...GRID] };
}

function on(players = 1, seed = 1): Sim {
  return new Sim(makeLevel(), { players, seed, modifiers: { twoPlateCarry: true } });
}

function off(players = 1, seed = 1): Sim {
  return new Sim(makeLevel(), { players, seed });
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

function cleanPlate(id: number, count?: number): PlateItem {
  const plate: PlateItem = { kind: 'plate', id, dish: null };
  if (count !== undefined) plate.count = count;
  return plate;
}

/** A stack of clean plates on the drying rack. */
function rackWith(sim: Sim, count: number): PlateItem {
  const plate = cleanPlate(9100, count);
  mutable(sim).tileItems[DRYING] = plate;
  return plate;
}

/** Chef 0 in front of the drying rack, facing it. */
function atRack(sim: Sim): Chef {
  return place(sim, 0, 10.5, 4.5, 'right');
}

function tap(sim: Sim): SimEvent[] {
  return sim.step([inp({ pickupPressed: true })]);
}

function stepFor(sim: Sim, seconds: number, a: PlayerInput = NO_INPUT): SimEvent[] {
  const out: SimEvent[] = [];
  const steps = Math.round(seconds / SIM_DT);
  for (let i = 0; i < steps; i++) for (const e of sim.step([a])) out.push(e);
  return out;
}

function types(events: readonly SimEvent[]): string[] {
  return events.map((e) => e.type);
}

function potOnStove(sim: Sim): PotItem {
  const item = sim.itemAt(11, 2);
  if (!item || item.kind !== 'pot') throw new Error('no pot on the stove');
  return item;
}

// ─── Off: the kitchen as it shipped ─────────────────────────────────────────
describe('two-plate carry off', () => {
  it('a held clean plate joins the rack stack', () => {
    const sim = off();
    const rack = rackWith(sim, 3);
    const chef = atRack(sim);
    chef.holding = cleanPlate(9001);
    const events = tap(sim);
    expect(types(events)).toEqual(['drop']);
    expect(chef.holding).toBeNull();
    expect(rack.count).toBe(4);
  });

  it('never creates a stack in hand', () => {
    const sim = off();
    rackWith(sim, 3);
    const chef = atRack(sim);
    tap(sim); // one plate off the rack
    expect(chef.holding).toMatchObject({ kind: 'plate', dish: null });
    expect((chef.holding as PlateItem).count ?? 1).toBe(1);
    tap(sim); // holding one, facing the rack: it goes back
    expect(chef.holding).toBeNull();
  });
});

// ─── On ─────────────────────────────────────────────────────────────────────
describe('two-plate carry on', () => {
  it('a second clean plate comes off the drying rack; at TWO_PLATE_MAX the press puts one back', () => {
    const sim = on();
    const rack = rackWith(sim, 3);
    const chef = atRack(sim);
    chef.holding = cleanPlate(9001);
    expect(types(tap(sim))).toEqual(['pickup']);
    expect((chef.holding as PlateItem).count).toBe(2);
    expect(rack.count).toBe(2);
    expect(TWO_PLATE_MAX).toBe(2);

    expect(types(tap(sim))).toEqual(['drop']); // two in hand: one goes back
    expect((chef.holding as PlateItem).count).toBeUndefined();
    expect(rack.count).toBe(3);
  });

  it('works from a plate stack and takes the last plate off a rack', () => {
    const level = makeLevel({ plates: { mode: 'stack', count: 1 }, stations: [{ x: 11, y: 4, type: 'plateStack' }] });
    const sim = new Sim(level, { players: 1, seed: 1, modifiers: { twoPlateCarry: true } });
    mutable(sim).tileItems[DRYING] = cleanPlate(9100); // a single plate, no count field
    const chef = atRack(sim);
    chef.holding = cleanPlate(9001);
    tap(sim);
    expect((chef.holding as PlateItem).count).toBe(2);
    expect(sim.itemAt(11, 4)).toBeNull();
  });

  it('not from a plain counter, and not with food on the plate in hand', () => {
    const sim = on();
    const chef = place(sim, 0, 2.5, 5.5, 'left'); // facing the plate on the counter at (1,5)
    chef.holding = cleanPlate(9001);
    expect(tap(sim)).toEqual([]);
    expect((chef.holding as PlateItem).count).toBeUndefined();
    expect(sim.itemAt(1, 5)).toMatchObject({ kind: 'plate' });

    rackWith(sim, 3);
    atRack(sim);
    chef.holding = { kind: 'plate', id: 9002, dish: { type: 'soup', ingredients: ['onion', 'onion', 'onion'] } };
    expect(tap(sim)).toEqual([]);
    expect((chef.holding as PlateItem).count).toBeUndefined();
    expect((sim.itemAt(11, 4) as PlateItem).count).toBe(3);
  });

  it('puts the plates down one at a time, top first', () => {
    const sim = on();
    const chef = place(sim, 0, 5.5, 1.5, 'up'); // facing the bare counter at (5,0)
    chef.holding = cleanPlate(9001, 2);
    expect(types(tap(sim))).toEqual(['drop']);
    expect(sim.itemAt(5, 0)).toMatchObject({ kind: 'plate', dish: null });
    expect((sim.itemAt(5, 0) as PlateItem).count ?? 1).toBe(1);
    expect(chef.holding).toMatchObject({ kind: 'plate', id: 9001 });
    expect((chef.holding as PlateItem).count).toBeUndefined();
    expect(tap(sim)).toEqual([]); // the counter is taken now
    expect(chef.holding).not.toBeNull();
    expect(mutable(sim).tileItems[TOP_COUNTER]).not.toBeNull();
  });

  it('no dash while holding two; the dash is back once one is down', () => {
    const sim = on();
    const chef = place(sim, 0, 5.5, 3.5, 'right');
    chef.holding = cleanPlate(9001, 2);
    expect(types(sim.step([inp({ dashPressed: true })]))).not.toContain('dash');
    expect(chef.dashCooldown).toBeUndefined();
    (chef.holding as PlateItem).count = undefined;
    delete (chef.holding as PlateItem).count;
    expect(types(sim.step([inp({ dashPressed: true })]))).toContain('dash');
  });

  it('food cannot go onto the pair until one plate is down', () => {
    const sim = on();
    const pot = potOnStove(sim);
    pot.contents.push('onion', 'onion', 'onion');
    pot.state = 'cooked';
    pot.cookProgress = 1;
    const chef = place(sim, 0, 10.5, 2.5, 'right'); // facing the stove at (11,2)
    chef.holding = cleanPlate(9001, 2);
    expect(types(tap(sim))).not.toContain('potPour');
    expect(pot.contents.length).toBe(3);
    expect((chef.holding as PlateItem).dish).toBeNull();
  });

  it('replays identically for the same seed and inputs', () => {
    function run(seed: number): string {
      const sim = on(2, seed);
      rackWith(sim, 4);
      for (let i = 0; i < 300; i++) {
        const t = i;
        const a = inp({ moveX: Math.sin(t * 0.13), moveY: Math.cos(t * 0.05), pickupPressed: t % 19 === 0, dashPressed: t % 41 === 0 });
        const b = inp({ moveX: Math.cos(t * 0.09), moveY: Math.sin(t * 0.11), pickupPressed: t % 13 === 0 });
        sim.step([a, b]);
      }
      return JSON.stringify(sim.getState());
    }
    expect(run(7)).toBe(run(7));
    expect(run(7)).not.toBe(run(8));
  });
});
