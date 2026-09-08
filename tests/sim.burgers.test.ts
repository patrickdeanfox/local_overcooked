import { describe, expect, it } from 'vitest';
import { Sim } from '../src/sim';
import { BURN_TIME, CHOP_TIME, PAN_COOK_TIME, SIM_DT } from '../src/sim/constants';
import { RECIPES } from '../src/sim/recipes';
import {
  FACING_VECTORS, NO_INPUT,
  type Chef, type Facing, type IngredientItem, type IngredientType, type PlateItem,
  type PlayerInput, type PotItem, type SimEvent, type SimState,
} from '../src/sim/types';
import { type LevelDef } from '../src/levels/schema';

// ─── Fixture ────────────────────────────────────────────────────────────────
// A 13x8 burger kitchen. Everything sits on the outer ring, reachable from the tile in
// front of it:
//   meat crate (1,1)   bun crate (1,2)   lettuce crate (1,3)  tomato crate (1,4)
//   plate counter (1,5) trash (1,6)      plate return (5,7)
//   board (11,1)       stove+pan (11,2)  sink (11,3)          drying (11,4)
//   serve (11,5)       extinguisher (11,6)
const GRID = [
  '#############',
  '#A.........B#',
  '#U.........F#',
  '#L.........W#',
  '#T.........D#',
  '#p.........V#',
  '#X.........E#',
  '#....R......#',
  '#############',
];

const BASE: LevelDef = {
  id: 'test-burgers',
  name: 'test',
  game: 'custom',
  world: 1,
  index: 4,
  theme: 'test',
  timeLimitSec: 300,
  timerStartsOnFirstServe: false,
  recipes: ['meat_burger'],
  orders: { initial: 1, intervalSec: 1000, max: 4, timeSec: 120 },
  stars: { 1: [10, 40, 60], 2: [10, 40, 60] },
  plates: { mode: 'sink', count: 1 },
  grid: GRID,
  spawns: [{ x: 5, y: 3 }, { x: 5, y: 4 }],
};

function makeLevel(patch: Partial<LevelDef> = {}): LevelDef {
  return { ...BASE, ...patch, grid: patch.grid ?? [...GRID] };
}

// ─── Helpers ────────────────────────────────────────────────────────────────
let testItemId = 9000;

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

/** Stands the chef on the tile in front of (tx, ty) and points it at the station. */
function faceTile(sim: Sim, index: number, tx: number, ty: number, facing: Facing): Chef {
  const v = FACING_VECTORS[facing];
  const chef = mutable(sim).chefs[index];
  chef.x = tx + 0.5 - v.dx;
  chef.y = ty + 0.5 - v.dy;
  chef.facing = facing;
  return chef;
}

/** One pickup press, which is the rising edge the sim reacts to. */
function tap(sim: Sim): SimEvent[] {
  return sim.step([inp({ pickupPressed: true })]);
}

function ingredient(type: IngredientType, opts: { chopped?: boolean; cooked?: boolean } = {}): IngredientItem {
  const item: IngredientItem = {
    kind: 'ingredient', id: testItemId++, type,
    chopped: opts.chopped ?? false, chopProgress: opts.chopped ? 1 : 0,
  };
  if (opts.cooked) item.cooked = true;
  return item;
}

function give(sim: Sim, index: number, item: IngredientItem | PlateItem | PotItem): void {
  mutable(sim).chefs[index].holding = item;
}

function cleanPlate(): PlateItem {
  return { kind: 'plate', id: testItemId++, dish: null, count: 1 };
}

function pan(contents: IngredientType[], state: PotItem['state']): PotItem {
  return {
    kind: 'pot', id: testItemId++, ware: 'pan', contents: [...contents], state,
    cookProgress: state === 'cooked' || state === 'burnt' ? 1 : 0,
    burnProgress: state === 'burnt' ? 1 : 0,
  };
}

function panOnStove(sim: Sim): PotItem {
  const item = sim.itemAt(11, 2);
  if (!item || item.kind !== 'pot') throw new Error('no pan on the stove');
  return item;
}

function plateAt(sim: Sim, x: number, y: number): PlateItem {
  const item = sim.itemAt(x, y);
  if (!item || item.kind !== 'plate') throw new Error(`no plate at (${x},${y})`);
  return item;
}

function heldPlate(sim: Sim, index: number): PlateItem {
  const held = mutable(sim).chefs[index].holding;
  if (!held || held.kind !== 'plate') throw new Error('the chef is not holding a plate');
  return held;
}

// ─── Frying pan ─────────────────────────────────────────────────────────────
describe('frying pan', () => {
  it('starts on the stove with ware "pan" and an empty capacity of one', () => {
    const sim = new Sim(makeLevel(), { players: 1, seed: 1 });
    const item = panOnStove(sim);
    expect(item.ware).toBe('pan');
    expect(item.contents).toEqual([]);
    expect(item.state).toBe('empty');
  });

  it('refuses raw meat, buns, and soup ingredients', () => {
    const sim = new Sim(makeLevel(), { players: 1, seed: 1 });
    faceTile(sim, 0, 11, 2, 'right');
    for (const item of [ingredient('meat'), ingredient('bun'), ingredient('bun', { chopped: true }),
      ingredient('onion', { chopped: true }), ingredient('lettuce', { chopped: true })]) {
      give(sim, 0, item);
      const events = tap(sim);
      expect(types(events)).not.toContain('potAdd');
      expect(panOnStove(sim).contents).toEqual([]);
      expect(mutable(sim).chefs[0].holding).toBe(item); // the refusal leaves it in hand
    }
  });

  it('takes one chopped patty and then refuses a second', () => {
    const sim = new Sim(makeLevel(), { players: 1, seed: 1 });
    faceTile(sim, 0, 11, 2, 'right');
    give(sim, 0, ingredient('meat', { chopped: true }));
    expect(types(tap(sim))).toContain('potAdd');
    expect(panOnStove(sim).contents).toEqual(['meat']);
    const second = ingredient('meat', { chopped: true });
    give(sim, 0, second);
    expect(types(tap(sim))).not.toContain('potAdd');
    expect(panOnStove(sim).contents).toEqual(['meat']);
    expect(mutable(sim).chefs[0].holding).toBe(second);
  });

  it('fries the patty in PAN_COOK_TIME and burns it BURN_TIME later', () => {
    const sim = new Sim(makeLevel(), { players: 1, seed: 1 });
    faceTile(sim, 0, 11, 2, 'right');
    give(sim, 0, ingredient('meat', { chopped: true }));
    expect(types(tap(sim))).toContain('cookStart'); // a pan on a stove lights the moment it is filled
    const item = panOnStove(sim);

    expect(types(stepFor(sim, PAN_COOK_TIME - 0.5))).not.toContain('cookDone');
    expect(item.state).toBe('cooking');

    expect(types(stepFor(sim, 1))).toContain('cookDone');
    expect(item.state).toBe('cooked');
    expect(item.cookProgress).toBe(1);

    const burning = stepFor(sim, BURN_TIME);
    expect(types(burning)).toContain('burnt');
    expect(types(burning)).toContain('fireStart');
    expect(item.state).toBe('burnt');
    expect(sim.fireAt(11, 2)).toBe(true);
  });

  it('holds its progress off the stove', () => {
    const sim = new Sim(makeLevel(), { players: 1, seed: 1 });
    faceTile(sim, 0, 11, 2, 'right');
    give(sim, 0, ingredient('meat', { chopped: true }));
    tap(sim);
    stepFor(sim, PAN_COOK_TIME / 3);
    tap(sim); // pick the pan back up
    const held = mutable(sim).chefs[0].holding;
    if (!held || held.kind !== 'pot') throw new Error('the chef is not holding the pan');
    const progress = held.cookProgress;
    expect(progress).toBeGreaterThan(0);
    stepFor(sim, 2);
    expect(held.cookProgress).toBe(progress);
  });

  it('loses a burnt patty in the trash and stays usable', () => {
    const sim = new Sim(makeLevel(), { players: 1, seed: 1 });
    const burnt = pan(['meat'], 'burnt');
    give(sim, 0, burnt);
    faceTile(sim, 0, 1, 6, 'left');
    expect(types(tap(sim))).toContain('trash');
    expect(burnt.contents).toEqual([]);
    expect(burnt.state).toBe('empty');
    expect(mutable(sim).chefs[0].holding).toBe(burnt);
  });
});

// ─── Pan to plate ───────────────────────────────────────────────────────────
describe('patty onto a plate', () => {
  it('scoops a cooked patty with a plate in hand', () => {
    const sim = new Sim(makeLevel(), { players: 1, seed: 1 });
    mutable(sim).tileItems[2 * 13 + 11] = pan(['meat'], 'cooked');
    give(sim, 0, cleanPlate());
    faceTile(sim, 0, 11, 2, 'right');
    expect(types(tap(sim))).toContain('plateAdd');
    expect(heldPlate(sim, 0).dish).toEqual({ type: 'burger', ingredients: ['meat'] });
    expect(panOnStove(sim).contents).toEqual([]);
    expect(panOnStove(sim).state).toBe('empty');
  });

  it('drops a cooked patty onto a plate resting on a counter', () => {
    const sim = new Sim(makeLevel(), { players: 1, seed: 1 });
    give(sim, 0, pan(['meat'], 'cooked'));
    faceTile(sim, 0, 1, 5, 'left');
    expect(types(tap(sim))).toContain('plateAdd');
    expect(plateAt(sim, 1, 5).dish).toEqual({ type: 'burger', ingredients: ['meat'] });
    const held = mutable(sim).chefs[0].holding;
    if (!held || held.kind !== 'pot') throw new Error('the pan left the chefs hands');
    expect(held.contents).toEqual([]);
  });

  it('refuses an uncooked pan', () => {
    const sim = new Sim(makeLevel(), { players: 1, seed: 1 });
    mutable(sim).tileItems[2 * 13 + 11] = pan(['meat'], 'cooking');
    give(sim, 0, cleanPlate());
    faceTile(sim, 0, 11, 2, 'right');
    expect(types(tap(sim))).not.toContain('plateAdd');
    expect(heldPlate(sim, 0).dish).toBeNull();
  });

  it('refuses a plate that already holds soup', () => {
    const sim = new Sim(makeLevel(), { players: 1, seed: 1 });
    mutable(sim).tileItems[2 * 13 + 11] = pan(['meat'], 'cooked');
    const plate = cleanPlate();
    plate.dish = { type: 'soup', ingredients: ['onion', 'onion', 'onion'] };
    give(sim, 0, plate);
    faceTile(sim, 0, 11, 2, 'right');
    expect(types(tap(sim))).not.toContain('plateAdd');
    expect(plate.dish.type).toBe('soup');
    expect(panOnStove(sim).contents).toEqual(['meat']);
  });
});

// ─── Assembly ───────────────────────────────────────────────────────────────
describe('burger assembly', () => {
  /** Adds one prepped ingredient to the plate the chef is holding, from the counter at (1,5). */
  function addFromCounter(sim: Sim, item: IngredientItem): SimEvent[] {
    mutable(sim).tileItems[5 * 13 + 1] = item;
    faceTile(sim, 0, 1, 5, 'left');
    return tap(sim);
  }

  /** Adds one prepped ingredient held in hand to the plate on the counter at (1,5). */
  function addToCounterPlate(sim: Sim, item: IngredientItem): SimEvent[] {
    give(sim, 0, item);
    faceTile(sim, 0, 1, 5, 'left');
    return tap(sim);
  }

  it('accepts bun, patty, lettuce and tomato in any order', () => {
    const orders: IngredientType[][] = [
      ['bun', 'meat', 'lettuce', 'tomato'],
      ['tomato', 'lettuce', 'meat', 'bun'],
      ['meat', 'tomato', 'bun', 'lettuce'],
    ];
    for (const order of orders) {
      const sim = new Sim(makeLevel(), { players: 1, seed: 1 });
      mutable(sim).tileItems[5 * 13 + 1] = null;
      give(sim, 0, cleanPlate());
      for (const type of order) {
        const events = addFromCounter(sim, ingredient(type, { chopped: type !== 'bun', cooked: type === 'meat' }));
        expect(types(events)).toContain('plateAdd');
        expect(sim.itemAt(1, 5)).toBeNull(); // the counter item is consumed
      }
      expect(heldPlate(sim, 0).dish).toEqual({
        type: 'burger', ingredients: ['bun', 'lettuce', 'meat', 'tomato'],
      });
    }
  });

  it('assembles the same burger onto a plate sitting on a counter', () => {
    const sim = new Sim(makeLevel(), { players: 1, seed: 1 });
    for (const type of ['tomato', 'bun', 'meat', 'lettuce'] as IngredientType[]) {
      const events = addToCounterPlate(sim, ingredient(type, { chopped: type !== 'bun', cooked: type === 'meat' }));
      expect(types(events)).toContain('plateAdd');
      expect(mutable(sim).chefs[0].holding).toBeNull();
    }
    expect(plateAt(sim, 1, 5).dish).toEqual({
      type: 'burger', ingredients: ['bun', 'lettuce', 'meat', 'tomato'],
    });
  });

  it('refuses a duplicate ingredient', () => {
    const sim = new Sim(makeLevel(), { players: 1, seed: 1 });
    mutable(sim).tileItems[5 * 13 + 1] = null;
    give(sim, 0, cleanPlate());
    addFromCounter(sim, ingredient('bun'));
    const second = ingredient('bun');
    expect(types(addFromCounter(sim, second))).not.toContain('plateAdd');
    expect(sim.itemAt(1, 5)).toBe(second); // still on the counter
    expect(heldPlate(sim, 0).dish).toEqual({ type: 'burger', ingredients: ['bun'] });
  });

  it('refuses raw lettuce, raw tomato and raw meat', () => {
    const sim = new Sim(makeLevel(), { players: 1, seed: 1 });
    mutable(sim).tileItems[5 * 13 + 1] = null;
    give(sim, 0, cleanPlate());
    for (const type of ['lettuce', 'tomato', 'meat'] as IngredientType[]) {
      expect(types(addFromCounter(sim, ingredient(type)))).not.toContain('plateAdd');
    }
    // Chopped-but-raw meat is a patty that never saw the pan: still refused.
    expect(types(addFromCounter(sim, ingredient('meat', { chopped: true })))).not.toContain('plateAdd');
    expect(heldPlate(sim, 0).dish).toBeNull();
  });

  it('refuses an ingredient that is no part of a burger', () => {
    const sim = new Sim(makeLevel(), { players: 1, seed: 1 });
    give(sim, 0, cleanPlate());
    expect(types(addFromCounter(sim, ingredient('onion', { chopped: true })))).not.toContain('plateAdd');
    expect(types(addFromCounter(sim, ingredient('mushroom', { chopped: true })))).not.toContain('plateAdd');
    expect(heldPlate(sim, 0).dish).toBeNull();
  });

  it('refuses burger parts on a plate that holds soup, and soup on a plate that holds parts', () => {
    const sim = new Sim(makeLevel(), { players: 1, seed: 1 });
    const soupPlate = plateAt(sim, 1, 5);
    soupPlate.dish = { type: 'soup', ingredients: ['onion', 'onion', 'onion'] };
    expect(types(addToCounterPlate(sim, ingredient('bun')))).not.toContain('plateAdd');
    expect(soupPlate.dish).toEqual({ type: 'soup', ingredients: ['onion', 'onion', 'onion'] });

    // The other direction: a cooked soup pot cannot be poured onto a burger in progress.
    const burgerPlate = cleanPlate();
    burgerPlate.dish = { type: 'burger', ingredients: ['bun'] };
    mutable(sim).tileItems[5 * 13 + 1] = burgerPlate;
    const pot: PotItem = {
      kind: 'pot', id: testItemId++, contents: ['onion', 'onion', 'onion'],
      state: 'cooked', cookProgress: 1, burnProgress: 0,
    };
    give(sim, 0, pot);
    faceTile(sim, 0, 1, 5, 'left');
    expect(types(tap(sim))).not.toContain('potPour');
    expect(burgerPlate.dish).toEqual({ type: 'burger', ingredients: ['bun'] });
    expect(pot.contents).toEqual(['onion', 'onion', 'onion']);
  });

  it('refuses food on a plate resting on the sink', () => {
    const sim = new Sim(makeLevel(), { players: 1, seed: 1 });
    const plate = cleanPlate();
    mutable(sim).tileItems[3 * 13 + 11] = plate;
    give(sim, 0, ingredient('bun'));
    faceTile(sim, 0, 11, 3, 'right');
    expect(types(tap(sim))).not.toContain('plateAdd');
    expect(plate.dish).toBeNull();
  });

  it('refuses a poured soup and a fried patty on a plate resting on the sink', () => {
    const sim = new Sim(makeLevel(), { players: 1, seed: 1 });
    const plate = cleanPlate();
    mutable(sim).tileItems[3 * 13 + 11] = plate;
    faceTile(sim, 0, 11, 3, 'right');

    const cooked = pan(['meat'], 'cooked');
    give(sim, 0, cooked);
    expect(types(tap(sim))).not.toContain('plateAdd');
    expect(plate.dish).toBeNull();
    expect(cooked.contents).toEqual(['meat']);

    const pot: PotItem = {
      kind: 'pot', id: 8100, contents: ['onion', 'onion', 'onion'],
      state: 'cooked', cookProgress: 1, burnProgress: 0,
    };
    give(sim, 0, pot);
    expect(types(tap(sim))).not.toContain('potPour');
    expect(plate.dish).toBeNull();
    expect(pot.contents).toEqual(['onion', 'onion', 'onion']);
  });

  it('never builds on a plate stack', () => {
    const sim = new Sim(makeLevel(), { players: 1, seed: 1 });
    const stack = cleanPlate();
    stack.count = 3;
    mutable(sim).tileItems[5 * 13 + 1] = stack;
    give(sim, 0, ingredient('bun'));
    faceTile(sim, 0, 1, 5, 'left');
    expect(types(tap(sim))).not.toContain('plateAdd');
    expect(stack.dish).toBeNull();
    expect(stack.count).toBe(3);
  });

  it('empties a burger plate in the trash and keeps the plate', () => {
    const sim = new Sim(makeLevel(), { players: 1, seed: 1 });
    const plate = cleanPlate();
    plate.dish = { type: 'burger', ingredients: ['bun', 'meat'] };
    give(sim, 0, plate);
    faceTile(sim, 0, 1, 6, 'left');
    expect(types(tap(sim))).toContain('trash');
    expect(plate.dish).toBeNull();
    expect(mutable(sim).chefs[0].holding).toBe(plate);
  });

  it('never chops a bun', () => {
    const sim = new Sim(makeLevel(), { players: 1, seed: 1 });
    const bun = ingredient('bun');
    mutable(sim).tileItems[1 * 13 + 11] = bun;
    faceTile(sim, 0, 11, 1, 'right');
    const events = stepFor(sim, CHOP_TIME + 1, inp({ interactHeld: true }));
    expect(types(events)).not.toContain('chopDone');
    expect(bun.chopped).toBe(false);
    expect(bun.chopProgress).toBe(0);
  });
});

// ─── Serving ────────────────────────────────────────────────────────────────
describe('serving burgers', () => {
  function serveDish(recipeId: string, ingredients: IngredientType[]): { score: number; events: SimEvent[] } {
    const sim = new Sim(makeLevel({ recipes: [recipeId] }), { players: 1, seed: 1 });
    const plate = cleanPlate();
    plate.dish = { type: 'burger', ingredients };
    give(sim, 0, plate);
    faceTile(sim, 0, 11, 5, 'right');
    const events = tap(sim);
    return { score: sim.getState().score, events };
  }

  it('matches meat_burger, lettuce_burger and tomato_lettuce_burger and pays their score', () => {
    const meat = serveDish('meat_burger', ['bun', 'meat']);
    expect(types(meat.events)).toContain('serve');
    expect(meat.score).toBe(RECIPES.meat_burger.score);
    expect(meat.score).toBe(20);

    const lettuce = serveDish('lettuce_burger', ['bun', 'lettuce', 'meat']);
    expect(types(lettuce.events)).toContain('serve');
    expect(lettuce.score).toBe(25);

    const salad = serveDish('tomato_lettuce_burger', ['bun', 'lettuce', 'meat', 'tomato']);
    expect(types(salad.events)).toContain('serve');
    expect(salad.score).toBe(30);
  });

  it('rejects a burger with a part missing or one too many', () => {
    const short = serveDish('lettuce_burger', ['bun', 'meat']);
    expect(types(short.events)).toContain('serveRejected');
    expect(short.score).toBe(0);

    const long = serveDish('meat_burger', ['bun', 'lettuce', 'meat']);
    expect(types(long.events)).toContain('serveRejected');
    expect(long.score).toBe(0);
  });

  it('never matches a soup order with a burger of the same parts', () => {
    const sim = new Sim(makeLevel({ recipes: ['tomato_soup'] }), { players: 1, seed: 1 });
    const plate = cleanPlate();
    plate.dish = { type: 'burger', ingredients: ['tomato', 'tomato', 'tomato'] };
    give(sim, 0, plate);
    faceTile(sim, 0, 11, 5, 'right');
    expect(types(tap(sim))).toContain('serveRejected');
    expect(sim.getState().score).toBe(0);
  });
});

// ─── End to end ─────────────────────────────────────────────────────────────
describe('meat burger, end to end', () => {
  it('chops beef, fries it, plates a bun and the patty, and serves', () => {
    const sim = new Sim(makeLevel(), { players: 1, seed: 1 });

    faceTile(sim, 0, 1, 1, 'left');       // meat crate
    tap(sim);
    faceTile(sim, 0, 11, 1, 'right');     // chopping board
    tap(sim);
    expect(types(stepFor(sim, CHOP_TIME + 0.2, inp({ interactHeld: true })))).toContain('chopDone');
    tap(sim);                             // take the chopped beef back
    faceTile(sim, 0, 11, 2, 'right');     // pan on the stove
    expect(types(tap(sim))).toContain('potAdd');
    expect(types(stepFor(sim, PAN_COOK_TIME + 0.2))).toContain('cookDone');

    faceTile(sim, 0, 1, 5, 'left');       // pick up the clean plate
    tap(sim);
    faceTile(sim, 0, 11, 2, 'right');     // scoop the patty out of the pan
    expect(types(tap(sim))).toContain('plateAdd');
    faceTile(sim, 0, 1, 5, 'left');       // park the plate back on its counter
    tap(sim);
    faceTile(sim, 0, 1, 2, 'left');       // bun crate
    tap(sim);
    faceTile(sim, 0, 1, 5, 'left');       // bun onto the plate
    expect(types(tap(sim))).toContain('plateAdd');
    expect(plateAt(sim, 1, 5).dish).toEqual({ type: 'burger', ingredients: ['bun', 'meat'] });

    tap(sim);                             // pick the finished burger up
    faceTile(sim, 0, 11, 5, 'right');     // serving counter
    const served = tap(sim);
    expect(types(served)).toContain('serve');
    expect(sim.getState().score).toBe(20);
    expect(sim.getState().servedCount).toBe(1);
  });
});
