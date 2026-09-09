import { describe, expect, it } from 'vitest';
import { Sim } from '../src/sim';
import { CRATE_SIZE, MAX_SIMULTANEOUS_86, RESTOCK_DELAY_SEC, RESTOCK_UNLOAD_SEC, SIM_DT } from '../src/sim/constants';
import { RECIPES } from '../src/sim/recipes';
import {
  NO_INPUT,
  type Chef, type Facing, type IngredientType, type Order, type PlayerInput, type SimEvent, type SimState,
} from '../src/sim/types';
import type { LevelDef } from '../src/levels/schema';

// ─── Fixtures ───────────────────────────────────────────────────────────────
// Soups: onion, tomato and mushroom crates down the left wall, an island delivery door at (5,4)
// with floor above and below it, the usual stations on the right.
const SOUP_GRID = [
  '#############',
  '#O.........B#',
  '#T.........S#',
  '#M.........W#',
  '#....d.....D#',
  '#p.........V#',
  '#X.........E#',
  '#############',
];
// The same kitchen with no delivery door: restocks arrive on their own.
const NO_DOOR_GRID = SOUP_GRID.map((row, y) => (y === 4 ? '#..........D#' : row));
// Burgers: bun, meat, lettuce and tomato crates, a pan on the stove.
const BURGER_GRID = [
  '#############',
  '#U.........B#',
  '#A.........F#',
  '#L.........W#',
  '#T.........D#',
  '#p.........V#',
  '#X.........E#',
  '#############',
];

const BASE: LevelDef = {
  id: 'test-86',
  name: 'test',
  game: 'custom',
  world: 1,
  index: 1,
  theme: 'test',
  timeLimitSec: 300,
  timerStartsOnFirstServe: false,
  recipes: ['onion_soup', 'tomato_soup', 'mushroom_soup'],
  orders: { initial: 0, intervalSec: 1000, max: 4, timeSec: 120 },
  stars: { 1: [10, 40, 60], 2: [10, 40, 60] },
  plates: { mode: 'sink', count: 1 },
  grid: SOUP_GRID,
  spawns: [{ x: 3, y: 3 }, { x: 9, y: 3 }],
};

const SIZE = 3; // crate size used by most tests, so a crate empties in three takes
const DELAY = 2; // restock delay in seconds

function makeLevel(patch: Partial<LevelDef> = {}): LevelDef {
  return { ...BASE, eightySix: { crateSize: SIZE, restockDelaySec: DELAY }, ...patch, grid: patch.grid ?? [...SOUP_GRID] };
}

function on(level: LevelDef = makeLevel(), players = 1, seed = 1): Sim {
  return new Sim(level, { players, seed, modifiers: { eightySix: true } });
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

/** Chef 0 in front of the crate on the left wall at row y, facing it. */
function atCrate(sim: Sim, y: number): Chef {
  return place(sim, 0, 2.5, y + 0.5, 'left');
}

function crate(sim: Sim, y: number) {
  const tile = sim.tileAt(1, y);
  if (!tile || tile.type !== 'crate') throw new Error(`no crate at (1,${y})`);
  return tile;
}

function tap(sim: Sim, players = 1): SimEvent[] {
  const press = inp({ pickupPressed: true });
  return players === 2 ? sim.step([press, NO_INPUT]) : sim.step([press]);
}

/** Takes `times` items from the crate at row y, emptying the chef's hands between takes. */
function drain(sim: Sim, y: number, times: number, players = 1): SimEvent[] {
  atCrate(sim, y);
  const out: SimEvent[] = [];
  for (let k = 0; k < times; k++) {
    mutable(sim).chefs[0].holding = null;
    for (const e of tap(sim, players)) out.push(e);
  }
  mutable(sim).chefs[0].holding = null;
  return out;
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

function addOrder(sim: Sim, recipeId: string): Order {
  const order: Order = { id: 100 + mutable(sim).orders.length, recipeId, timeLeft: 120, timeTotal: 120 };
  mutable(sim).orders.push(order);
  return order;
}

function soupPlate(sim: Sim, ingredient: IngredientType): void {
  mutable(sim).chefs[0].holding = {
    kind: 'plate', id: 9000, count: 1,
    dish: { type: 'soup', ingredients: [ingredient, ingredient, ingredient] },
  };
}

const HOLD = inp({ interactHeld: true });

// ─── Off ────────────────────────────────────────────────────────────────────
describe('the 86 system off', () => {
  it('crates carry no stock and never run out', () => {
    const sim = new Sim(makeLevel(), { players: 1, seed: 1 });
    expect(crate(sim, 1).stock).toBeUndefined();
    expect(crate(sim, 1).capacity).toBeUndefined();
    const events = drain(sim, 1, 20);
    expect(types(events).filter((t) => t === 'pickup')).toHaveLength(20);
    expect(types(events)).not.toContain('crateEmpty');
    expect(sim.ingredientOut('onion')).toBe(false);
    expect(sim.getState().restocks).toBeUndefined();
  });
});

// ─── Stock ──────────────────────────────────────────────────────────────────
describe('crate stock', () => {
  it('every crate gets the level\'s size, or CRATE_SIZE without one', () => {
    const sim = on();
    for (const y of [1, 2, 3]) {
      expect(crate(sim, y).stock).toBe(SIZE);
      expect(crate(sim, y).capacity).toBe(SIZE);
    }
    const bare = on(makeLevel({ eightySix: undefined }));
    expect(crate(bare, 1).stock).toBe(CRATE_SIZE);
  });

  it('an ingredient in every recipe is exempt, and so is the level\'s exempt list', () => {
    const bread = on(makeLevel({ recipes: ['onion_soup'] }));
    expect(crate(bread, 1).stock).toBeUndefined();
    expect(crate(bread, 2).stock).toBe(SIZE);
    const listed = on(makeLevel({ eightySix: { crateSize: SIZE, exempt: ['tomato'] } }));
    expect(crate(listed, 1).stock).toBe(SIZE);
    expect(crate(listed, 2).stock).toBeUndefined();
  });

  it('a stock override sets that crate\'s size and beats the exemption', () => {
    const sim = on(makeLevel({ recipes: ['onion_soup'], stations: [{ x: 1, y: 1, stock: 2 }] }));
    expect(crate(sim, 1).stock).toBe(2);
    expect(crate(sim, 1).capacity).toBe(2);
  });

  it('the last item posts the 86 and the crate gives nothing more', () => {
    const sim = on();
    const events = drain(sim, 1, SIZE);
    expect(types(events).filter((t) => t === 'pickup')).toHaveLength(SIZE);
    expect(events.find((e) => e.type === 'crateEmpty')).toMatchObject({ x: 1, y: 1, chef: 0 });
    expect(crate(sim, 1).stock).toBe(0);
    expect(sim.ingredientOut('onion')).toBe(true);
    expect(sim.ingredientOut('tomato')).toBe(false);
    atCrate(sim, 1);
    expect(tap(sim)).toEqual([]);
    expect(mutable(sim).chefs[0].holding).toBeNull();
  });

  it('while MAX_SIMULTANEOUS_86 ingredients are out, no other crate hands over its last item', () => {
    const sim = on(makeLevel({ eightySix: { crateSize: 1, restockDelaySec: 1000 } }));
    expect(MAX_SIMULTANEOUS_86).toBe(2);
    drain(sim, 1, 1);
    drain(sim, 2, 1);
    expect(sim.ingredientOut('onion')).toBe(true);
    expect(sim.ingredientOut('tomato')).toBe(true);
    expect(drain(sim, 3, 1)).toEqual([]);
    expect(crate(sim, 3).stock).toBe(1);
    expect(sim.ingredientOut('mushroom')).toBe(false);
  });
});

// ─── Tickets ────────────────────────────────────────────────────────────────
describe('ticket rewrites', () => {
  it('a shortage rewrites every ticket that needs the ingredient to the nearest recipe and keeps the original', () => {
    const sim = on();
    const onionOrder = addOrder(sim, 'onion_soup');
    const mushroomOrder = addOrder(sim, 'mushroom_soup');
    const events = drain(sim, 1, SIZE);
    expect(events.filter((e) => e.type === 'orderRewritten')).toEqual([{ type: 'orderRewritten', value: onionOrder.id }]);
    expect(onionOrder.recipeId).toBe('tomato_soup'); // same dish type, nothing shared, earliest in the list
    expect(onionOrder.originalRecipeId).toBe('onion_soup');
    expect(onionOrder.rewrittenAt).toBeGreaterThan(0);
    expect(mushroomOrder.recipeId).toBe('mushroom_soup');
    expect(mushroomOrder.originalRecipeId).toBeUndefined();
    expect(mutable(sim).orders).toHaveLength(2); // never voided
  });

  it('prefers the substitute that shares the most prep', () => {
    const level = makeLevel({
      grid: [...BURGER_GRID],
      recipes: ['meat_burger', 'lettuce_burger', 'tomato_lettuce_burger'],
    });
    const sim = on(level);
    expect(crate(sim, 1).stock).toBeUndefined(); // bun and meat are in every burger
    expect(crate(sim, 2).stock).toBeUndefined();
    const order = addOrder(sim, 'tomato_lettuce_burger');
    drain(sim, 4, SIZE); // the tomato crate at (1,4)
    expect(order.recipeId).toBe('lettuce_burger'); // shares bun, lettuce, meat; the plain burger shares two
    expect(order.originalRecipeId).toBe('tomato_lettuce_burger');
  });

  it('a ticket with no substitute is left as it is', () => {
    const sim = on(makeLevel({ recipes: ['onion_soup'], stations: [{ x: 1, y: 1, stock: 1 }] }));
    const order = addOrder(sim, 'onion_soup');
    const events = drain(sim, 1, 1);
    expect(types(events)).toContain('crateEmpty');
    expect(types(events)).not.toContain('orderRewritten');
    expect(order.recipeId).toBe('onion_soup');
    expect(mutable(sim).orders).toHaveLength(1);
  });

  it('a dish built for the original recipe still serves the rewritten ticket', () => {
    const sim = on();
    const order = addOrder(sim, 'onion_soup');
    drain(sim, 1, SIZE);
    expect(order.recipeId).toBe('tomato_soup');
    soupPlate(sim, 'onion');
    place(sim, 0, 10.5, 5.5, 'right'); // the serve at (11,5)
    const events = tap(sim);
    expect(events.find((e) => e.type === 'serve')).toMatchObject({ value: RECIPES.onion_soup.score });
    expect(mutable(sim).orders).toHaveLength(0);

    const other = on();
    const ticket = addOrder(other, 'onion_soup');
    drain(other, 1, SIZE);
    soupPlate(other, 'tomato'); // the substitute serves too
    place(other, 0, 10.5, 5.5, 'right');
    expect(types(tap(other))).toContain('serve');
    expect(mutable(other).orders.find((o) => o.id === ticket.id)).toBeUndefined();
  });

  it('new tickets skip recipes that are out while there is a choice', () => {
    const sim = on(makeLevel({ orders: { initial: 0, intervalSec: 0.5, max: 12, timeSec: 120 }, eightySix: { crateSize: SIZE, restockDelaySec: 1000 } }));
    drain(sim, 1, SIZE);
    stepFor(sim, 6);
    const recipes = mutable(sim).orders.map((o) => o.recipeId);
    expect(recipes.length).toBeGreaterThan(5);
    expect(recipes).not.toContain('onion_soup');
    expect(new Set(recipes).size).toBe(2);
  });
});

// ─── Restocks ───────────────────────────────────────────────────────────────
describe('restocks', () => {
  it('a shortage queues a delivery; with no door it restocks by itself when due', () => {
    const sim = on(makeLevel({ grid: [...NO_DOOR_GRID] }));
    drain(sim, 1, SIZE);
    expect(sim.getState().restocks).toMatchObject([{ id: 1, ingredient: 'onion', unloaded: 0 }]);
    expect(sim.getState().restocks?.[0].arrivesIn).toBeCloseTo(DELAY - SIM_DT, 6); // queued mid-step, then counted down once
    const early = stepFor(sim, DELAY - 0.1);
    expect(types(early)).not.toContain('restocked');
    expect(crate(sim, 1).stock).toBe(0);
    const due = stepFor(sim, 0.2);
    expect(types(due)).toEqual(['restockDue', 'restocked']);
    expect(due[1]).toMatchObject({ x: 1, y: 1 });
    expect(crate(sim, 1).stock).toBe(SIZE);
    expect(sim.getState().restocks).toEqual([]);
    expect(sim.ingredientOut('onion')).toBe(false);
  });

  it('the delay is RESTOCK_DELAY_SEC when the level gives none', () => {
    const sim = on(makeLevel({ eightySix: { crateSize: SIZE } }));
    drain(sim, 1, SIZE);
    expect(sim.getState().restocks?.[0].arrivesIn).toBeCloseTo(RESTOCK_DELAY_SEC - SIM_DT, 6);
  });

  it('with a door the delivery waits there until a chef unloads it with held interact', () => {
    const sim = on();
    drain(sim, 1, SIZE);
    const arrival = stepFor(sim, DELAY + SIM_DT);
    expect(types(arrival)).toEqual(['restockDue']);
    expect(arrival[0]).toMatchObject({ x: 5, y: 4 });
    expect(crate(sim, 1).stock).toBe(0);
    expect(sim.deliveryDue()).toMatchObject({ ingredient: 'onion', arrivesIn: 0 });

    const chef = place(sim, 0, 5.5, 3.5, 'down'); // above the door, facing it
    const half = stepFor(sim, RESTOCK_UNLOAD_SEC / 2, HOLD);
    expect(chef.action).toBe('unloading');
    expect(chef.actionProgress).toBeCloseTo(0.5, 1);
    expect(types(half)).toContain('restockTick');
    expect(types(half)).not.toContain('restocked');
    const rest = stepFor(sim, RESTOCK_UNLOAD_SEC / 2 + SIM_DT, HOLD);
    expect(types(rest)).toContain('restocked');
    expect(rest.find((e) => e.type === 'restocked')).toMatchObject({ x: 5, y: 4 });
    expect(crate(sim, 1).stock).toBe(SIZE);
    expect(sim.deliveryDue()).toBeNull();
    expect(sim.getState().restocks).toEqual([]);
    expect(chef.action).toBe('idle');
  });

  it('nothing to unload before the delivery arrives, and the unloader is pinned like a chopper', () => {
    const sim = on();
    drain(sim, 1, SIZE);
    const chef = place(sim, 0, 5.5, 3.5, 'down');
    stepFor(sim, 0.5, HOLD);
    expect(chef.action).not.toBe('unloading');
    expect(sim.deliveryDue()).toBeNull();
    stepFor(sim, DELAY);
    sim.step([HOLD]);
    expect(chef.action).toBe('unloading');
    stepFor(sim, 0.5, inp({ interactHeld: true, moveX: 1 }));
    expect(chef.x).toBe(5.5);
  });

  it('a second chef at the door counts only with chop assist on', () => {
    function unloadTime(chopAssist: boolean): number {
      const sim = new Sim(makeLevel(), { players: 2, seed: 1, modifiers: { eightySix: true, chopAssist } });
      drain(sim, 1, SIZE, 2);
      stepFor(sim, DELAY + SIM_DT, NO_INPUT, NO_INPUT);
      place(sim, 0, 5.5, 3.5, 'down');
      place(sim, 1, 5.5, 5.5, 'up');
      let steps = 0;
      while (steps < 1000 && !sim.step([HOLD, HOLD]).some((e) => e.type === 'restocked')) steps += 1;
      return (steps + 1) * SIM_DT;
    }
    expect(unloadTime(false)).toBeCloseTo(RESTOCK_UNLOAD_SEC, 1);
    expect(unloadTime(true)).toBeCloseTo(RESTOCK_UNLOAD_SEC / 2, 1);
  });

  it('a scripted shortage empties the crates at its second, once', () => {
    const sim = on(makeLevel({ eightySix: { crateSize: SIZE, restockDelaySec: 1000, scripted: [{ atSec: 1, ingredient: 'tomato' }] } }));
    const before = stepFor(sim, 1 - SIM_DT);
    expect(types(before)).not.toContain('crateEmpty');
    const at = stepFor(sim, 2 * SIM_DT);
    expect(at.filter((e) => e.type === 'crateEmpty')).toEqual([{ type: 'crateEmpty', x: 1, y: 2 }]);
    expect(crate(sim, 2).stock).toBe(0);
    expect(sim.ingredientOut('tomato')).toBe(true);
    expect(sim.getState().restocks).toHaveLength(1);
    expect(types(stepFor(sim, 1))).not.toContain('crateEmpty');
  });

  it('a scripted shortage on an exempt ingredient gives its crate a size so the delivery can refill it', () => {
    const sim = on(makeLevel({ recipes: ['onion_soup'], eightySix: { crateSize: SIZE, restockDelaySec: DELAY, scripted: [{ atSec: 0.5, ingredient: 'onion' }] } }));
    expect(crate(sim, 1).stock).toBeUndefined();
    stepFor(sim, 0.5 + SIM_DT);
    expect(crate(sim, 1).stock).toBe(0);
    expect(crate(sim, 1).capacity).toBe(SIZE);
    stepFor(sim, DELAY + SIM_DT);
    place(sim, 0, 5.5, 3.5, 'down');
    stepFor(sim, RESTOCK_UNLOAD_SEC + SIM_DT, HOLD);
    expect(crate(sim, 1).stock).toBe(SIZE);
  });

  it('replays identically for the same seed and inputs', () => {
    function run(seed: number): string {
      const sim = on(makeLevel({ orders: { initial: 2, intervalSec: 3, max: 4, timeSec: 120 } }), 2, seed);
      drain(sim, 1, SIZE, 2);
      for (let i = 0; i < 400; i++) {
        const a = inp({ moveX: Math.sin(i * 0.1), moveY: Math.cos(i * 0.07), pickupPressed: i % 11 === 0, interactHeld: i % 29 < 12 });
        const b = inp({ moveX: -Math.sin(i * 0.12), moveY: Math.cos(i * 0.09), pickupPressed: i % 13 === 0, interactHeld: i % 31 < 15 });
        sim.step([a, b]);
      }
      return JSON.stringify(sim.getState());
    }
    expect(run(21)).toBe(run(21));
    expect(run(21)).not.toBe(run(22));
  });
});
