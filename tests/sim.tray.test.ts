import { describe, expect, it } from 'vitest';
import { Sim } from '../src/sim';
import {
  CHEF_SPEED, DASH_TIME, SIM_DT, TRAY_CAPACITY, TRAY_SPEED_SCALE, TRAY_WINDUP_SEC, TRAY_WOBBLE_SEC,
} from '../src/sim/constants';
import {
  NO_INPUT,
  type Chef, type Facing, type IngredientItem, type PlateItem, type PlayerInput, type PotItem, type SimEvent,
  type SimState, type TrayItem,
} from '../src/sim/types';
import type { LevelDef } from '../src/levels/schema';

// ─── Fixture ────────────────────────────────────────────────────────────────
// A 13x8 kitchen: onion and tomato crates and the tray rack on the left wall, a two-tile hole on
// row 4, board, stove with a pot, sink, drying rack, serve and extinguisher counter on the right.
const GRID = [
  '#############',
  '#O.........B#',
  '#T.........S#',
  '#t.........W#',
  '#....__....D#',
  '#p.........V#',
  '#X.........E#',
  '#############',
];

const BASE: LevelDef = {
  id: 'test-tray',
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

const RACK = 3 * 13 + 1;
const DRYING = 4 * 13 + 11;
const TOP_COUNTER = 5; // (5,0)

function makeLevel(patch: Partial<LevelDef> = {}): LevelDef {
  return { ...BASE, ...patch, grid: patch.grid ?? [...GRID] };
}

function on(players = 1, seed = 1): Sim {
  return new Sim(makeLevel(), { players, seed, modifiers: { tray: true } });
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

function onion(id: number, chopped = false): IngredientItem {
  return { kind: 'ingredient', id, type: 'onion', chopped, chopProgress: chopped ? 1 : 0 };
}

function cleanPlate(id: number, count?: number): PlateItem {
  const plate: PlateItem = { kind: 'plate', id, dish: null };
  if (count !== undefined) plate.count = count;
  return plate;
}

function trayOnRack(sim: Sim): TrayItem {
  const item = sim.itemAt(1, 3);
  if (!item || item.kind !== 'tray') throw new Error('no tray on the rack');
  return item;
}

/** Takes the tray off the rack and puts it in the chef's hands, skipping the wind-up. */
function giveTray(sim: Sim, index: number, items: TrayItem['items'] = []): TrayItem {
  const tray = trayOnRack(sim);
  mutable(sim).tileItems[RACK] = null;
  tray.items = items;
  mutable(sim).chefs[index].holding = tray;
  return tray;
}

function tap(sim: Sim, players = 1): SimEvent[] {
  const press = inp({ pickupPressed: true });
  return players === 2 ? sim.step([press, NO_INPUT]) : sim.step([press]);
}

function work(sim: Sim): SimEvent[] {
  return sim.step([inp({ interactPressed: true, interactHeld: true })]);
}

function stepFor(sim: Sim, seconds: number, a: PlayerInput = NO_INPUT, b?: PlayerInput): SimEvent[] {
  const out: SimEvent[] = [];
  const steps = Math.round(seconds / SIM_DT);
  for (let i = 0; i < steps; i++) for (const e of (b ? sim.step([a, b]) : sim.step([a]))) out.push(e);
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

// ─── Off ────────────────────────────────────────────────────────────────────
describe('the tray off', () => {
  it('the rack is a bare counter', () => {
    const sim = new Sim(makeLevel(), { players: 1, seed: 1 });
    expect(sim.itemAt(1, 3)).toBeNull();
    const chef = place(sim, 0, 2.5, 3.5, 'left');
    chef.holding = onion(9001);
    expect(types(tap(sim))).toEqual(['drop']);
    expect(sim.itemAt(1, 3)).toMatchObject({ kind: 'ingredient', id: 9001 });
  });
});

// ─── Lifting and setting down ───────────────────────────────────────────────
describe('lifting and setting down the tray', () => {
  it('the rack starts with an empty tray; pick-up on it winds up, pins the chef, then lifts', () => {
    const sim = on();
    expect(trayOnRack(sim).items).toEqual([]);
    const chef = place(sim, 0, 2.5, 3.5, 'left');
    expect(tap(sim)).toEqual([]); // the wind-up itself is silent
    expect(chef.action).toBe('lifting');
    expect(chef.windupLeft).toBeCloseTo(TRAY_WINDUP_SEC, 6);
    expect(chef.holding).toBeNull();
    const during = stepFor(sim, TRAY_WINDUP_SEC / 2, inp({ moveX: 1, moveY: 1 }));
    expect(during).toEqual([]);
    expect(chef.x).toBe(2.5); // committed: the stick does nothing
    expect(chef.action).toBe('lifting');
    expect(chef.actionProgress).toBeGreaterThan(0.4);
    const rest = stepFor(sim, TRAY_WINDUP_SEC / 2 + SIM_DT);
    expect(types(rest)).toEqual(['trayLift']);
    expect(chef.holding).toMatchObject({ kind: 'tray' });
    expect(chef.windupLeft).toBeUndefined();
    expect(sim.itemAt(1, 3)).toBeNull();
    expect(chef.action).toBe('idle');
  });

  it('the work button lifts a loaded tray; pick-up on a loaded tray takes the top item instead', () => {
    const sim = on();
    trayOnRack(sim).items.push(onion(9001), onion(9002));
    const chef = place(sim, 0, 2.5, 3.5, 'left');
    expect(types(tap(sim))).toEqual(['pickup']);
    expect(chef.holding).toMatchObject({ id: 9002 });
    expect(trayOnRack(sim).items.map((i) => i.id)).toEqual([9001]);
    chef.holding = null;
    work(sim);
    expect(chef.action).toBe('lifting');
    stepFor(sim, TRAY_WINDUP_SEC + SIM_DT);
    const lifted = mutable(sim).chefs[0].holding;
    expect(lifted).toMatchObject({ kind: 'tray' });
    expect((lifted as TrayItem).items.map((i) => i.id)).toEqual([9001]);
  });

  it('an empty tray goes down on an empty counter with the pick-up button, a loaded one with the work button', () => {
    const sim = on();
    const chef = place(sim, 0, 5.5, 1.5, 'up'); // facing the bare counter at (5,0)
    giveTray(sim, 0);
    tap(sim);
    expect(chef.action).toBe('lifting');
    const events = stepFor(sim, TRAY_WINDUP_SEC + SIM_DT);
    expect(types(events)).toEqual(['traySet']);
    expect(chef.holding).toBeNull();
    expect(sim.itemAt(5, 0)).toMatchObject({ kind: 'tray' });

    const tray = sim.itemAt(5, 0) as TrayItem;
    chef.holding = tray;
    mutable(sim).tileItems[TOP_COUNTER] = null;
    tray.items.push(onion(9001));
    work(sim);
    stepFor(sim, TRAY_WINDUP_SEC + SIM_DT);
    expect(chef.holding).toBeNull();
    expect((sim.itemAt(5, 0) as TrayItem).items.length).toBe(1);
  });

  it('a set-down that lost its counter does nothing', () => {
    const sim = on();
    const chef = place(sim, 0, 5.5, 1.5, 'up');
    const tray = giveTray(sim, 0);
    tap(sim);
    mutable(sim).tileItems[TOP_COUNTER] = onion(9001); // something lands there mid wind-up
    const events = stepFor(sim, TRAY_WINDUP_SEC + SIM_DT);
    expect(types(events)).toEqual([]);
    expect(chef.holding).toBe(tray);
  });
});

// ─── Loading and unloading ──────────────────────────────────────────────────
describe('loading and unloading the tray', () => {
  it('loads TRAY_CAPACITY ingredients from a crate and refuses the next', () => {
    const sim = on();
    place(sim, 0, 2.5, 1.5, 'left'); // facing the onion crate at (1,1)
    const tray = giveTray(sim, 0);
    for (let k = 0; k < TRAY_CAPACITY; k++) expect(types(tap(sim))).toEqual(['pickup']);
    expect(tray.items.length).toBe(TRAY_CAPACITY);
    expect(tray.items.every((i) => i.kind === 'ingredient' && i.type === 'onion')).toBe(true);
    expect(tap(sim)).toEqual([]);
    expect(tray.items.length).toBe(TRAY_CAPACITY);
  });

  it('loads an item off a counter and one clean plate off a stack', () => {
    const sim = on();
    place(sim, 0, 2.5, 5.5, 'left'); // the plate on the counter at (1,5)
    const tray = giveTray(sim, 0);
    expect(types(tap(sim))).toEqual(['pickup']);
    expect(tray.items).toHaveLength(1);
    expect(tray.items[0]).toMatchObject({ kind: 'plate' });
    expect(sim.itemAt(1, 5)).toBeNull();

    mutable(sim).tileItems[DRYING] = cleanPlate(9100, 3);
    place(sim, 0, 10.5, 4.5, 'right');
    tap(sim);
    expect(tray.items).toHaveLength(2);
    expect((tray.items[1] as PlateItem).count ?? 1).toBe(1);
    expect((sim.itemAt(11, 4) as PlateItem).count).toBe(2);
  });

  it('offers the top item to a pot, a counter, the bin and the serve as if held', () => {
    const sim = on();
    const pot = potOnStove(sim);
    place(sim, 0, 10.5, 2.5, 'right'); // the stove at (11,2)
    const tray = giveTray(sim, 0, [onion(9001), onion(9002, true)]);
    expect(types(tap(sim))).toContain('potAdd'); // the pot starts cooking the same step
    expect(pot.contents).toEqual(['onion']);
    expect(tray.items.map((i) => i.id)).toEqual([9001]);
    expect(mutable(sim).chefs[0].holding).toBe(tray);

    place(sim, 0, 5.5, 1.5, 'up'); // the bare counter at (5,0)
    expect(types(tap(sim))).toEqual(['drop']);
    expect(sim.itemAt(5, 0)).toMatchObject({ id: 9001 });
    expect(tray.items).toEqual([]);

    tray.items.push(onion(9003));
    place(sim, 0, 2.5, 6.5, 'left'); // the bin at (1,6)
    expect(types(tap(sim))).toEqual(['trash']);
    expect(tray.items).toEqual([]);

    tray.items.push({ kind: 'plate', id: 9004, dish: { type: 'soup', ingredients: ['onion', 'onion', 'onion'] } });
    place(sim, 0, 10.5, 5.5, 'right'); // the serve at (11,5); the level starts with one onion soup ticket
    expect(types(tap(sim))).toContain('serve');
    expect(tray.items).toEqual([]);
    expect(sim.getState().servedCount).toBe(1);
  });

  it('an item the tile will not take stays on the tray', () => {
    const sim = on();
    place(sim, 0, 10.5, 2.5, 'right');
    const tray = giveTray(sim, 0, [onion(9001)]); // raw: the pot refuses it
    expect(tap(sim)).toEqual([]);
    expect(tray.items.map((i) => i.id)).toEqual([9001]);
  });

  it('never puts a tray on a tray', () => {
    const sim = on();
    mutable(sim).tileItems[TOP_COUNTER] = { kind: 'tray', id: 8000, items: [] };
    place(sim, 0, 5.5, 1.5, 'up');
    const tray = giveTray(sim, 0, [onion(9001)]);
    expect(tap(sim)).toEqual([]);
    expect(tray.items).toHaveLength(1);
    expect((sim.itemAt(5, 0) as TrayItem).items).toEqual([]);
  });
});

// ─── Carrying ───────────────────────────────────────────────────────────────
describe('carrying the tray', () => {
  it('walks at TRAY_SPEED_SCALE of the chef speed', () => {
    const sim = on();
    const chef = place(sim, 0, 5.5, 5.5, 'right');
    giveTray(sim, 0);
    stepFor(sim, 0.25, inp({ moveX: 1 }));
    expect(chef.x).toBeCloseTo(5.5 + 0.25 * CHEF_SPEED * TRAY_SPEED_SCALE, 4);
  });

  it('cannot dash or throw', () => {
    const sim = on();
    const chef = place(sim, 0, 5.5, 5.5, 'right');
    giveTray(sim, 0, [onion(9001)]);
    expect(types(sim.step([inp({ dashPressed: true, throwPressed: true })]))).toEqual([]);
    expect(chef.dashCooldown).toBeUndefined();
    expect(sim.getState().flying).toBeUndefined();
  });

  it('a bump makes the load wobble; a second bump inside the window drops the top item', () => {
    const sim = on(2);
    place(sim, 0, 3.5, 3.5, 'right');
    const carrier = place(sim, 1, 4.9, 3.5, 'left');
    const tray = giveTray(sim, 1, [onion(9001), onion(9002)]);
    const first = [
      ...sim.step([inp({ dashPressed: true }), NO_INPUT]),
      ...stepFor(sim, DASH_TIME + 0.05, NO_INPUT, NO_INPUT),
    ];
    expect(types(first)).toContain('dashBump');
    expect(types(first)).toContain('trayWobble');
    expect(types(first)).not.toContain('drop');
    expect(carrier.holding).toBe(tray);
    expect(tray.items).toHaveLength(2);
    expect(carrier.wobble).toBeGreaterThan(0);

    const again = on(2);
    place(again, 0, 3.5, 3.5, 'right');
    const shaken = place(again, 1, 4.9, 3.5, 'left');
    const load = giveTray(again, 1, [onion(9001), onion(9002)]);
    shaken.wobble = TRAY_WOBBLE_SEC / 2;
    const second = [
      ...again.step([inp({ dashPressed: true }), NO_INPUT]),
      ...stepFor(again, DASH_TIME + 0.05, NO_INPUT, NO_INPUT),
    ];
    expect(types(second)).toContain('drop');
    expect(types(second)).not.toContain('trayWobble');
    expect(shaken.holding).toBe(load);
    expect(load.items.map((i) => i.id)).toEqual([9001]);
    expect(shaken.wobble).toBeUndefined();
    const dropped = again.getState().tileItems.findIndex((item) => item !== null && item.id === 9002);
    expect(Math.floor(dropped / 13)).toBe(3);
  });

  it('the wobble window closes after TRAY_WOBBLE_SEC', () => {
    const sim = on();
    const chef = place(sim, 0, 5.5, 5.5, 'right');
    giveTray(sim, 0);
    chef.wobble = TRAY_WOBBLE_SEC;
    stepFor(sim, TRAY_WOBBLE_SEC - SIM_DT);
    expect(chef.wobble).toBeGreaterThan(0);
    stepFor(sim, 2 * SIM_DT);
    expect(chef.wobble).toBeUndefined();
  });

  it('a carrier that falls into a hole hands the tray back to its rack', () => {
    const sim = on();
    const chef = place(sim, 0, 4.4, 4.5, 'right'); // the hole starts at x = 5
    const tray = giveTray(sim, 0, [onion(9001)]);
    const events = stepFor(sim, 0.4, inp({ moveX: 1 }));
    expect(types(events)).toContain('chefFell');
    expect(chef.holding).toBeNull();
    expect(sim.itemAt(1, 3)).toBe(tray);
    expect(tray.items.map((i) => i.id)).toEqual([9001]);
  });

  it('replays identically for the same seed and inputs', () => {
    function run(seed: number): string {
      const sim = on(2, seed);
      for (let i = 0; i < 400; i++) {
        const a = inp({ moveX: Math.sin(i * 0.1), moveY: Math.cos(i * 0.07), pickupPressed: i % 11 === 0, interactPressed: i % 29 === 0, interactHeld: i % 29 < 8, dashPressed: i % 61 === 0 });
        const b = inp({ moveX: -Math.sin(i * 0.12), moveY: Math.cos(i * 0.09), pickupPressed: i % 13 === 0, dashPressed: i % 47 === 0 });
        sim.step([a, b]);
      }
      return JSON.stringify(sim.getState());
    }
    expect(run(11)).toBe(run(11));
  });
});
