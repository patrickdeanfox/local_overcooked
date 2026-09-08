import { describe, expect, it } from 'vitest';
import { Sim } from '../src/sim';
import { CHEF_HITBOX, MAX_PUSH_ESCAPE, SIM_DT } from '../src/sim/constants';
import {
  NO_INPUT,
  type Chef, type PlayerInput, type SimEvent, type SimState,
} from '../src/sim/types';
import { isWalkable, SOLID_TILES, type LevelDef } from '../src/levels/schema';

// ─── Fixture ────────────────────────────────────────────────────────────────
// A 13x8 kitchen split down the middle by the 1-6 earthquake seam: the 'G' column is
// walkable while the gate group is open and solid while it is closed. The counter at (5,4)
// blocks the near way out of the gate tile below it, so a chef caught there has to leave
// on the far side.
const GRID = [
  '#############',
  '#O....G....B#',
  '#R....G....S#',
  '#.....G....W#',
  '#....#G....D#',
  '#p....G....V#',
  '#X....G....E#',
  '#############',
];

const PERIOD = 4;
const OPEN = 2;

const BASE: LevelDef = {
  id: 'test-gates',
  name: 'test',
  game: 'custom',
  world: 1,
  index: 6,
  theme: 'test',
  timeLimitSec: 300,
  timerStartsOnFirstServe: false,
  recipes: ['onion_soup'],
  orders: { initial: 1, intervalSec: 1000, max: 4, timeSec: 120 },
  stars: { 1: [10, 40, 60], 2: [10, 40, 60] },
  plates: { mode: 'sink', count: 1 },
  grid: GRID,
  spawns: [{ x: 3, y: 3 }, { x: 3, y: 5 }],
  dynamics: [{ type: 'gate', group: '1', periodSec: PERIOD, openSec: OPEN }],
};

function makeLevel(patch: Partial<LevelDef> = {}): LevelDef {
  return { ...BASE, ...patch, grid: patch.grid ?? [...GRID] };
}

// ─── Helpers ────────────────────────────────────────────────────────────────
const HALF = CHEF_HITBOX / 2;
const TOUCH = 1e-6; // flush against a box does not count as inside it

function inp(patch: Partial<PlayerInput>): PlayerInput {
  return { ...NO_INPUT, ...patch };
}

function mutable(sim: Sim): SimState {
  return sim.getState() as SimState;
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

function place(sim: Sim, index: number, x: number, y: number): Chef {
  const chef = mutable(sim).chefs[index];
  chef.x = x;
  chef.y = y;
  return chef;
}

function gates(sim: Sim): { id: string; open: boolean; secondsToChange: number }[] {
  const list = sim.getState().gates;
  if (!list) throw new Error('the level has no gates');
  return list;
}

/** True when the chef box overlaps any tile it may not stand in, closed gates included. */
function insideSolid(sim: Sim, chef: Chef): boolean {
  const st = sim.getState();
  for (let y = 0; y < st.height; y++) {
    for (let x = 0; x < st.width; x++) {
      const tile = sim.tileAt(x, y);
      if (!tile) continue;
      const solid = SOLID_TILES.has(tile.type)
        || (tile.type === 'gate' && !sim.gateOpen(tile.group ?? ''));
      if (!solid) continue;
      if (chef.x + HALF <= x + TOUCH || chef.x - HALF >= x + 1 - TOUCH) continue;
      if (chef.y + HALF <= y + TOUCH || chef.y - HALF >= y + 1 - TOUCH) continue;
      return true;
    }
  }
  return false;
}

// ─── Cycle ──────────────────────────────────────────────────────────────────
describe('gate cycle', () => {
  it('starts open with the seconds to the next change', () => {
    const sim = new Sim(makeLevel(), { players: 1, seed: 1 });
    expect(gates(sim).length).toBe(1);
    expect(gates(sim)[0].id).toBe('1');
    expect(gates(sim)[0].open).toBe(true);
    expect(gates(sim)[0].secondsToChange).toBeCloseTo(OPEN, 6);
    expect(sim.gateOpen('1')).toBe(true);
  });

  it('closes after openSec and opens again at the end of the period', () => {
    const sim = new Sim(makeLevel(), { players: 1, seed: 1 });

    const early = stepFor(sim, OPEN - 0.2);
    expect(types(early)).not.toContain('gateClose');
    expect(gates(sim)[0].secondsToChange).toBeCloseTo(0.2, 4);

    const closing = stepFor(sim, 0.4);
    expect(types(closing)).toContain('gateClose');
    expect(sim.gateOpen('1')).toBe(false);
    expect(gates(sim)[0].open).toBe(false);
    expect(gates(sim)[0].secondsToChange).toBeCloseTo(PERIOD - OPEN - 0.2, 4);

    const opening = stepFor(sim, PERIOD - OPEN);
    expect(types(opening)).toContain('gateOpen');
    expect(sim.gateOpen('1')).toBe(true);
  });

  it('reports a gate tile of the group on the event', () => {
    const sim = new Sim(makeLevel(), { players: 1, seed: 1 });
    const closed = stepFor(sim, OPEN + 0.2).find((e) => e.type === 'gateClose');
    if (!closed) throw new Error('the gate never closed');
    const tile = sim.tileAt(closed.x ?? -1, closed.y ?? -1);
    expect(tile?.type).toBe('gate');
    expect(tile?.group).toBe('1');
  });

  it('starts closed when the phase says so', () => {
    const sim = new Sim(makeLevel({
      dynamics: [{ type: 'gate', group: '1', periodSec: PERIOD, openSec: OPEN, phase: 0.75 }],
    }), { players: 1, seed: 1 });
    expect(sim.gateOpen('1')).toBe(false);
    expect(gates(sim)[0].secondsToChange).toBeCloseTo(1, 6); // a quarter period left of the closed half
    expect(types(stepFor(sim, 1.2))).toContain('gateOpen');
  });

  it('reads an unknown group as open', () => {
    const sim = new Sim(makeLevel(), { players: 1, seed: 1 });
    expect(sim.gateOpen('nope')).toBe(true);
  });

  it('leaves levels without a gate dynamic with no gates array', () => {
    const sim = new Sim(makeLevel({ grid: GRID.map((r) => r.replace(/G/g, '.')), dynamics: [] }), { players: 1, seed: 1 });
    expect(sim.getState().gates).toBeUndefined();
    expect(sim.gateOpen('1')).toBe(true);
  });
});

// ─── Movement ───────────────────────────────────────────────────────────────
describe('gates and movement', () => {
  it('lets a chef cross while open and blocks it while closed', () => {
    const open = new Sim(makeLevel(), { players: 1, seed: 1 });
    const crossing = place(open, 0, 5.5, 3.5);
    stepFor(open, 1, inp({ moveX: 1 }));
    expect(crossing.x).toBeGreaterThan(7);

    const shut = new Sim(makeLevel(), { players: 1, seed: 1 });
    const blocked = place(shut, 0, 5.5, 3.5);
    stepFor(shut, OPEN + 0.2);          // wait for the seam to close
    expect(shut.gateOpen('1')).toBe(false);
    place(shut, 0, 5.5, 3.5);
    stepFor(shut, 1, inp({ moveX: 1 }));
    expect(blocked.x).toBeCloseTo(6 - HALF, 6);
    expect(insideSolid(shut, blocked)).toBe(false);
  });

  it('pushes a chef standing on a closing gate off it', () => {
    const sim = new Sim(makeLevel(), { players: 1, seed: 1 });
    const chef = place(sim, 0, 6.5, 3.5);
    stepFor(sim, OPEN - 0.1);
    place(sim, 0, 6.5, 3.5);            // still on the seam when it shuts
    stepFor(sim, 0.2);
    expect(sim.gateOpen('1')).toBe(false);
    expect(insideSolid(sim, chef)).toBe(false);
    expect(Math.hypot(chef.x - 6.5, chef.y - 3.5)).toBeLessThanOrEqual(MAX_PUSH_ESCAPE + 1e-9);
    expect(chef.x).toBeCloseTo(6 - HALF, 6); // out the near side, into the left half
  });

  it('squeezes a chef out the far side when the near side is a counter', () => {
    const sim = new Sim(makeLevel(), { players: 1, seed: 1 });
    const chef = place(sim, 0, 6.5, 4.5); // the counter at (5,4) blocks the way left
    stepFor(sim, OPEN - 0.1);
    place(sim, 0, 6.5, 4.5);
    stepFor(sim, 0.2);
    expect(sim.gateOpen('1')).toBe(false);
    expect(insideSolid(sim, chef)).toBe(false);
    expect(Math.hypot(chef.x - 6.5, chef.y - 4.5)).toBeLessThanOrEqual(MAX_PUSH_ESCAPE + 1e-9);
    expect(chef.x).toBeCloseTo(7 + HALF, 6); // out the far side, into the right half
  });

  it('never leaves a chef inside a solid over a full cycle of mashing', () => {
    const sim = new Sim(makeLevel(), { players: 2, seed: 5 });
    const st = mutable(sim);
    for (let i = 0; i < 900; i++) {
      sim.step([
        inp({ moveX: Math.sin(i * 0.21), moveY: Math.cos(i * 0.13) }),
        inp({ moveX: Math.cos(i * 0.07), moveY: Math.sin(i * 0.19) }),
      ]);
      for (const chef of st.chefs) {
        expect(insideSolid(sim, chef)).toBe(false);
        const tile = sim.tileAt(Math.floor(chef.x), Math.floor(chef.y));
        expect(tile !== null && isWalkable(tile.type)).toBe(true);
      }
    }
  });

  it('never rests an item on a gate tile', () => {
    const sim = new Sim(makeLevel(), { players: 1, seed: 1 });
    place(sim, 0, 5.5, 3.5);
    mutable(sim).chefs[0].facing = 'right';
    mutable(sim).chefs[0].holding = { kind: 'ingredient', id: 9001, type: 'onion', chopped: false, chopProgress: 0 };
    expect(sim.getTargetTile(0)).toEqual({ x: 6, y: 3 });
    const events = sim.step([inp({ pickupPressed: true })]);
    expect(types(events)).not.toContain('drop');
    expect(sim.itemAt(6, 3)).toBeNull();
    expect(mutable(sim).chefs[0].holding).not.toBeNull();
  });
});

// ─── Determinism ────────────────────────────────────────────────────────────
describe('determinism with burgers and gates', () => {
  const BUSY = makeLevel({
    grid: [
      '#############',
      '#A....G....B#',
      '#U....G....F#',
      '#L....G....W#',
      '#T....G....D#',
      '#p....G....V#',
      '#X....G....E#',
      '#############',
    ],
    recipes: ['meat_burger', 'lettuce_burger', 'tomato_lettuce_burger'],
    orders: { initial: 2, intervalSec: 3, max: 5, timeSec: 12 },
    dynamics: [{ type: 'gate', group: '1', periodSec: 5, openSec: 2, phase: 0.1 }],
  });

  function scriptedInput(i: number, chef: number): PlayerInput {
    const t = i + chef * 37;
    return {
      moveX: Math.sin(t * 0.11),
      moveY: Math.cos(t * 0.07),
      pickupPressed: t % 23 === 0,
      interactPressed: t % 17 === 0,
      interactHeld: t % 17 < 9,
    };
  }

  function run(seed: number): string {
    const sim = new Sim(BUSY, { players: 2, seed });
    for (let i = 0; i < 600; i++) sim.step([scriptedInput(i, 0), scriptedInput(i, 1)]);
    return JSON.stringify(sim.getState());
  }

  it('replays identically for the same seed and inputs', () => {
    expect(run(2468)).toBe(run(2468));
  });

  it('differs for a different seed', () => {
    expect(run(2468)).not.toBe(run(1357));
  });

  it('keeps the burger and gate state JSON-clean', () => {
    const sim = new Sim(BUSY, { players: 2, seed: 11 });
    for (let i = 0; i < 600; i++) sim.step([scriptedInput(i, 0), scriptedInput(i, 1)]);
    const json = JSON.stringify(sim.getState());
    expect(json).not.toContain('NaN');
    const revived = JSON.parse(json) as SimState;
    expect(revived.seed).toBe(11);
    expect(revived.gates?.length).toBe(1);
    expect(Number.isFinite(revived.gates?.[0].secondsToChange)).toBe(true);
  });
});
