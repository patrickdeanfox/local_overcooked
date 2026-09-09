import { describe, expect, it } from 'vitest';
import { Sim } from '../src/sim';
import {
  BURN_TIME, CHEF_RADIUS, CHEF_SPEED, CHOP_TIME, COOK_TIME, FIRE_SPREAD_TIME, ORDER_FAIL_PENALTY,
  PAN_COOK_TIME, PLATE_RETURN_DELAY, PLATE_STACK_RETURN_DELAY, SIM_DT, TIP_BASE, WASH_TIME,
} from '../src/sim/constants';
import { RECIPES } from '../src/sim/recipes';
import {
  NO_INPUT,
  type Chef, type Facing, type PlayerInput, type PotItem, type SimEvent, type SimState,
} from '../src/sim/types';
import { SOLID_TILES, type LevelDef } from '../src/levels/schema';

// ─── Fixtures ───────────────────────────────────────────────────────────────
// A compact 13x8 kitchen. Every station sits on the outer ring so a chef can reach it
// from the tile next to it:
//   crate onion (1,1)  board (11,1)   plateReturn (1,2)  stove+pot (11,2)
//   sink (11,3)        drying (11,4)  plate counter (1,5) serve (11,5)
//   trash (1,6)        extinguisher counter (11,6)
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
  id: 'test-kitchen',
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
  spawns: [{ x: 5, y: 3 }, { x: 5, y: 4 }],
};

function makeLevel(patch: Partial<LevelDef> = {}): LevelDef {
  return { ...BASE, ...patch, grid: patch.grid ?? [...GRID] };
}

function withRow(y: number, row: string): string[] {
  const grid = [...GRID];
  grid[y] = row;
  return grid;
}

// ─── Helpers ────────────────────────────────────────────────────────────────
function inp(patch: Partial<PlayerInput>): PlayerInput {
  return { ...NO_INPUT, ...patch };
}

function mutable(sim: Sim): SimState {
  return sim.getState() as SimState;
}

/** Teleports a chef; every test position is a legal, non-overlapping spot. */
function place(sim: Sim, index: number, x: number, y: number, facing: Facing): Chef {
  const chef = mutable(sim).chefs[index];
  chef.x = x;
  chef.y = y;
  chef.facing = facing;
  return chef;
}

function stepFor(sim: Sim, seconds: number, a: PlayerInput = NO_INPUT, b?: PlayerInput): SimEvent[] {
  const out: SimEvent[] = [];
  const steps = Math.round(seconds / SIM_DT);
  for (let i = 0; i < steps; i++) {
    const events = b ? sim.step([a, b]) : sim.step([a]);
    for (const e of events) out.push(e);
  }
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

/** Puts a finished onion soup in the chef's hands, skipping the cooking loop. */
function giveSoupPlate(sim: Sim, index: number, ingredients: ('onion' | 'tomato' | 'mushroom')[]): void {
  mutable(sim).chefs[index].holding = {
    kind: 'plate', id: 9000 + index, count: 1,
    dish: { type: 'soup', ingredients },
  };
}

// ─── Movement ───────────────────────────────────────────────────────────────
describe('movement', () => {
  it('walks at CHEF_SPEED and stops flush against a wall', () => {
    const sim = new Sim(makeLevel(), { players: 1, seed: 1 });
    const chef = mutable(sim).chefs[0];
    stepFor(sim, 0.25, inp({ moveX: 1 }));
    expect(chef.x).toBeCloseTo(5.5 + 0.25 * 4.2, 4);
    stepFor(sim, 3, inp({ moveX: 1 }));
    expect(chef.x).toBeCloseTo(10.7, 6); // sink at x=11, chef half-width 0.3
    expect(chef.facing).toBe('right');
  });

  it('slides along a wall when only one axis is blocked', () => {
    const sim = new Sim(makeLevel(), { players: 1, seed: 1 });
    const chef = place(sim, 0, 10.5, 3.5, 'right');
    stepFor(sim, 1, inp({ moveX: 1, moveY: 1 }));
    expect(chef.x).toBeCloseTo(10.7, 6);   // blocked by the sink column
    expect(chef.y).toBeGreaterThan(5.5);   // still slid downwards
  });

  it('respects the analog deadzone and normalises long vectors', () => {
    const sim = new Sim(makeLevel(), { players: 1, seed: 1 });
    const chef = mutable(sim).chefs[0];
    stepFor(sim, 0.5, inp({ moveX: 0.1 }));
    expect(chef.x).toBeCloseTo(5.5, 6);
    expect(chef.action).toBe('idle');
    stepFor(sim, 0.25, inp({ moveX: 1, moveY: 1 }));
    expect(chef.x - 5.5).toBeCloseTo(0.25 * 4.2 * Math.SQRT1_2, 4);
  });

  it('pushes two overlapping chefs apart by half each', () => {
    const sim = new Sim(makeLevel(), { players: 2, seed: 1 });
    const a = place(sim, 0, 5.5, 3.5, 'down');
    const b = place(sim, 1, 5.5, 3.6, 'down');
    sim.step([NO_INPUT, NO_INPUT]);
    const gap = Math.hypot(b.x - a.x, b.y - a.y);
    expect(gap).toBeCloseTo(CHEF_RADIUS * 2, 6);
    expect(a.y).toBeCloseTo(3.5 - 0.3, 6); // symmetric: both gave way equally
    expect(b.y).toBeCloseTo(3.6 + 0.3, 6);
  });
});

// ─── Carrying ───────────────────────────────────────────────────────────────
describe('pick up and put down', () => {
  it('takes an onion from a crate and sets it down on a counter', () => {
    const sim = new Sim(makeLevel(), { players: 1, seed: 1 });
    const chef = place(sim, 0, 2.5, 1.5, 'left');
    expect(sim.getTargetTile(0)).toEqual({ x: 1, y: 1 });

    const grab = sim.step([inp({ pickupPressed: true })]);
    expect(types(grab)).toContain('pickup');
    expect(chef.holding).toMatchObject({ kind: 'ingredient', type: 'onion', chopped: false });

    place(sim, 0, 5.5, 1.5, 'up');
    const drop = sim.step([inp({ pickupPressed: true })]);
    expect(types(drop)).toContain('drop');
    expect(chef.holding).toBeNull();
    expect(sim.itemAt(5, 0)).toMatchObject({ kind: 'ingredient', type: 'onion' });
  });

  it('crates are an unlimited source', () => {
    const sim = new Sim(makeLevel(), { players: 1, seed: 1 });
    const chef = place(sim, 0, 2.5, 1.5, 'left');
    for (let i = 0; i < 3; i++) {
      sim.step([inp({ pickupPressed: true })]);
      expect(chef.holding).not.toBeNull();
      chef.holding = null;
    }
  });

  it('destroys an ingredient dropped on the trash', () => {
    const sim = new Sim(makeLevel(), { players: 1, seed: 1 });
    const chef = place(sim, 0, 2.5, 1.5, 'left');
    sim.step([inp({ pickupPressed: true })]);
    place(sim, 0, 2.5, 6.5, 'left');
    const events = sim.step([inp({ pickupPressed: true })]);
    expect(types(events)).toContain('trash');
    expect(chef.holding).toBeNull();
    expect(sim.itemAt(1, 6)).toBeNull();
  });

  it('takes one plate off a stack and leaves the rest', () => {
    const sim = new Sim(makeLevel(), { players: 1, seed: 1 });
    mutable(sim).tileItems[5 * 13 + 1] = { kind: 'plate', id: 500, dish: null, count: 3 };
    const chef = place(sim, 0, 2.5, 5.5, 'left');
    sim.step([inp({ pickupPressed: true })]);
    expect(chef.holding).toMatchObject({ kind: 'plate', dish: null });
    expect(sim.itemAt(1, 5)).toMatchObject({ kind: 'plate', count: 2 });
  });
});

// ─── Chopping ───────────────────────────────────────────────────────────────
describe('chopping', () => {
  it('completes after CHOP_TIME of held interact and keeps progress across a release', () => {
    const sim = new Sim(makeLevel(), { players: 1, seed: 1 });
    place(sim, 0, 2.5, 1.5, 'left');
    sim.step([inp({ pickupPressed: true })]);
    place(sim, 0, 10.5, 1.5, 'right');
    sim.step([inp({ pickupPressed: true })]);
    expect(sim.itemAt(11, 1)).toMatchObject({ kind: 'ingredient', chopped: false });

    const half = stepFor(sim, CHOP_TIME / 2, inp({ interactHeld: true }));
    expect(types(half)).toContain('chopTick');
    const onion = sim.itemAt(11, 1);
    expect(onion).toMatchObject({ kind: 'ingredient', chopped: false });
    const midway = onion && onion.kind === 'ingredient' ? onion.chopProgress : 0;
    expect(midway).toBeCloseTo(0.5, 2);

    stepFor(sim, 0.5); // let go: progress must survive on the item
    expect(sim.itemAt(11, 1)).toMatchObject({ chopProgress: midway, chopped: false });

    const rest = stepFor(sim, CHOP_TIME / 2 + 0.1, inp({ interactHeld: true }));
    expect(types(rest)).toContain('chopDone');
    expect(sim.itemAt(11, 1)).toMatchObject({ chopped: true, chopProgress: 1 });
  });

  it('locks the chef in place while chopping', () => {
    const sim = new Sim(makeLevel(), { players: 1, seed: 1 });
    place(sim, 0, 2.5, 1.5, 'left');
    sim.step([inp({ pickupPressed: true })]);
    const chef = place(sim, 0, 10.5, 1.5, 'right');
    sim.step([inp({ pickupPressed: true })]);

    sim.step([inp({ interactHeld: true })]); // first frame starts the chop
    expect(chef.action).toBe('chopping');
    stepFor(sim, 0.5, inp({ interactHeld: true, moveX: -1 }));
    expect(chef.x).toBeCloseTo(10.5, 6);
    expect(chef.action).toBe('chopping');

    stepFor(sim, 0.2, inp({ moveX: -1 })); // released: free to walk again
    expect(chef.x).toBeLessThan(10.5);
  });
});

// ─── The whole loop ─────────────────────────────────────────────────────────
/** Crate → board → chop → pot, once. */
function deliverChoppedOnion(sim: Sim): void {
  place(sim, 0, 2.5, 1.5, 'left');
  sim.step([inp({ pickupPressed: true })]);
  place(sim, 0, 10.5, 1.5, 'right');
  sim.step([inp({ pickupPressed: true })]);
  stepFor(sim, CHOP_TIME + 0.1, inp({ interactHeld: true }));
  sim.step([inp({ pickupPressed: true })]);
  place(sim, 0, 10.5, 2.5, 'right');
  sim.step([inp({ pickupPressed: true })]);
}

describe('onion soup, end to end', () => {
  it('chops three onions, cooks, plates, serves, and recycles the plate', () => {
    const sim = new Sim(makeLevel(), { players: 1, seed: 7 });
    const st = mutable(sim);
    expect(st.orders.length).toBe(1);
    expect(st.orders[0].recipeId).toBe('onion_soup');

    for (let i = 0; i < 3; i++) deliverChoppedOnion(sim);
    const pot = potOnStove(sim);
    expect(pot.contents).toEqual(['onion', 'onion', 'onion']);
    expect(pot.state).toBe('cooking');

    const cooking = stepFor(sim, COOK_TIME + 0.1);
    expect(types(cooking)).toContain('cookDone');
    expect(pot.state).toBe('cooked');

    // Fetch the clean plate from the counter and fill it at the stove.
    const chef = place(sim, 0, 2.5, 5.5, 'left');
    sim.step([inp({ pickupPressed: true })]);
    expect(chef.holding).toMatchObject({ kind: 'plate', dish: null });
    place(sim, 0, 10.5, 2.5, 'right');
    const pour = sim.step([inp({ pickupPressed: true })]);
    expect(types(pour)).toContain('potPour');
    expect(chef.holding).toMatchObject({ dish: { type: 'soup', ingredients: ['onion', 'onion', 'onion'] } });
    expect(pot.state).toBe('empty');
    expect(pot.contents).toEqual([]);

    // Serve.
    place(sim, 0, 10.5, 5.5, 'right');
    const served = sim.step([inp({ pickupPressed: true })]);
    const serve = served.find((e) => e.type === 'serve');
    expect(serve).toBeDefined();
    expect(serve?.value).toBe(RECIPES.onion_soup.score); // first serve of a streak pays base only
    expect(st.score).toBe(RECIPES.onion_soup.score);
    expect(st.servedCount).toBe(1);
    expect(st.tipStreak).toBe(1);
    expect(st.orders.length).toBe(0);
    expect(chef.holding).toBeNull();
    expect(st.stars).toBe(1);

    // The dirty plate comes back on the plate return.
    expect(st.pendingPlateReturns.length).toBe(1);
    const returned = stepFor(sim, PLATE_RETURN_DELAY + 0.1);
    expect(types(returned)).toContain('plateReturned');
    expect(sim.itemAt(1, 2)).toMatchObject({ kind: 'dirtyPlate', count: 1 });

    // Wash it: dirty stack → sink → clean plate on the drying rack.
    place(sim, 0, 2.5, 2.5, 'left');
    sim.step([inp({ pickupPressed: true })]);
    expect(chef.holding).toMatchObject({ kind: 'dirtyPlate', count: 1 });
    place(sim, 0, 10.5, 3.5, 'right');
    sim.step([inp({ pickupPressed: true })]);
    expect(sim.itemAt(11, 3)).toMatchObject({ kind: 'dirtyPlate', count: 1 });

    const washing = stepFor(sim, WASH_TIME + 0.1, inp({ interactHeld: true }));
    expect(types(washing)).toContain('washTick');
    expect(types(washing)).toContain('washDone');
    expect(sim.itemAt(11, 3)).toBeNull();
    expect(sim.itemAt(11, 4)).toMatchObject({ kind: 'plate', dish: null, count: 1 });
  });

  it('refuses raw ingredients and full pots', () => {
    const sim = new Sim(makeLevel(), { players: 1, seed: 1 });
    const chef = place(sim, 0, 2.5, 1.5, 'left');
    sim.step([inp({ pickupPressed: true })]);
    place(sim, 0, 10.5, 2.5, 'right');
    sim.step([inp({ pickupPressed: true })]);
    expect(chef.holding).not.toBeNull(); // raw onion stays in hand
    expect(potOnStove(sim).contents).toEqual([]);

    chef.holding = null;
    for (let i = 0; i < 4; i++) deliverChoppedOnion(sim);
    expect(potOnStove(sim).contents.length).toBe(3);
  });

  it('rescales cook progress when an ingredient joins a cooking pot', () => {
    const sim = new Sim(makeLevel(), { players: 1, seed: 1 });
    deliverChoppedOnion(sim);
    stepFor(sim, COOK_TIME / 2);
    const pot = potOnStove(sim);
    const before = pot.cookProgress;
    expect(before).toBeGreaterThan(0.4);
    deliverChoppedOnion(sim);
    expect(pot.contents.length).toBe(2);
    expect(pot.cookProgress).toBeGreaterThan(before / 2 - 0.05);
    expect(pot.cookProgress).toBeLessThan(before);
  });
});

// ─── Fire ───────────────────────────────────────────────────────────────────
describe('burning and fire', () => {
  it('burns a cooked pot left on the stove and sets it alight', () => {
    const sim = new Sim(makeLevel(), { players: 1, seed: 3 });
    const pot = potOnStove(sim);
    pot.contents.push('onion', 'onion', 'onion');
    const events = stepFor(sim, COOK_TIME + BURN_TIME + 0.2);
    expect(types(events)).toContain('burnt');
    expect(types(events)).toContain('fireStart');
    expect(pot.state).toBe('burnt');
    expect(pot.contents).toEqual(['onion', 'onion', 'onion']); // burnt food stays until trashed
    expect(sim.fireAt(11, 2)).toBe(true);
  });

  it('refuses interactions with a burning tile', () => {
    const sim = new Sim(makeLevel(), { players: 1, seed: 3 });
    mutable(sim).fires.push({ x: 1, y: 1, health: 1, spreadTimer: FIRE_SPREAD_TIME });
    const chef = place(sim, 0, 2.5, 1.5, 'left');
    sim.step([inp({ pickupPressed: true })]);
    expect(chef.holding).toBeNull();
  });

  it('spreads to a neighbouring solid tile every FIRE_SPREAD_TIME', () => {
    const sim = new Sim(makeLevel(), { players: 1, seed: 11 });
    const st = mutable(sim);
    st.fires.push({ x: 11, y: 2, health: 1, spreadTimer: FIRE_SPREAD_TIME });
    const events = stepFor(sim, FIRE_SPREAD_TIME + 0.1);
    expect(types(events)).toContain('fireSpread');
    expect(st.fires.length).toBe(2);
    const spread = st.fires[1];
    expect([`11,1`, `11,3`, `12,2`]).toContain(`${spread.x},${spread.y}`);
  });

  it('puts a fire out with the extinguisher', () => {
    const sim = new Sim(makeLevel(), { players: 1, seed: 3 });
    const st = mutable(sim);
    st.fires.push({ x: 11, y: 2, health: 1, spreadTimer: FIRE_SPREAD_TIME });

    const chef = place(sim, 0, 10.5, 6.5, 'right');
    sim.step([inp({ pickupPressed: true })]);
    expect(chef.holding).toMatchObject({ kind: 'extinguisher' });

    place(sim, 0, 10.5, 2.5, 'right');
    const events = stepFor(sim, 1.2, inp({ interactHeld: true }));
    expect(types(events)).toContain('spray');
    expect(types(events)).toContain('fireOut');
    expect(st.fires.length).toBe(0);
    expect(chef.action).toBe('extinguishing');
  });

  it('leaves fires out of spray range alone', () => {
    const sim = new Sim(makeLevel(), { players: 1, seed: 3 });
    const st = mutable(sim);
    st.fires.push({ x: 11, y: 2, health: 1, spreadTimer: FIRE_SPREAD_TIME });
    const chef = place(sim, 0, 10.5, 6.5, 'right');
    sim.step([inp({ pickupPressed: true })]);
    place(sim, 0, 10.5, 5.5, 'right'); // facing right, the fire is three tiles up
    stepFor(sim, 1, inp({ interactHeld: true }));
    expect(st.fires.length).toBe(1);
    expect(st.fires[0].health).toBe(1);
    expect(chef.holding).toMatchObject({ kind: 'extinguisher' });
  });

  it('stops cooking and burning while the stove is on fire, and resumes once it is out', () => {
    const sim = new Sim(makeLevel(), { players: 1, seed: 3 });
    const st = mutable(sim);
    const pot = potOnStove(sim);
    pot.contents.push('onion', 'onion', 'onion');
    st.fires.push({ x: 11, y: 2, health: 1, spreadTimer: FIRE_SPREAD_TIME });

    const events = stepFor(sim, COOK_TIME + BURN_TIME + 1);
    expect(pot.cookProgress).toBe(0);
    expect(pot.state).toBe('empty');
    expect(types(events)).not.toContain('cookStart');
    expect(types(events)).not.toContain('burnt');

    st.fires.length = 0;
    stepFor(sim, COOK_TIME + 0.1);
    expect(pot.state).toBe('cooked');
  });

  it('never spreads onto a tile no chef can stand next to', () => {
    // The board at (11,1) backs onto the wall at (11,0) and (12,1), neither of which has a
    // walkable neighbour: a fire there could never be sprayed and would re-light the
    // kitchen every FIRE_SPREAD_TIME for the rest of the level.
    const sim = new Sim(makeLevel(), { players: 1, seed: 5 });
    const st = mutable(sim);
    st.fires.push({ x: 11, y: 1, health: 1, spreadTimer: FIRE_SPREAD_TIME });
    stepFor(sim, FIRE_SPREAD_TIME * 12);
    expect(st.fires.length).toBeGreaterThan(1);
    for (const fire of st.fires) {
      const walkable = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => {
        const tile = sim.tileAt(fire.x + dx, fire.y + dy);
        return tile !== null && !SOLID_TILES.has(tile.type);
      });
      expect(walkable, `fire at ${fire.x},${fire.y} is unreachable`).toBe(true);
    }
  });

  it('never spreads onto the tile the extinguisher is resting on', () => {
    const sim = new Sim(makeLevel(), { players: 1, seed: 7 });
    const st = mutable(sim);
    expect(sim.itemAt(11, 6)).toMatchObject({ kind: 'extinguisher' });
    st.fires.push({ x: 11, y: 5, health: 1, spreadTimer: FIRE_SPREAD_TIME });
    stepFor(sim, FIRE_SPREAD_TIME * 12);
    expect(st.fires.length).toBeGreaterThan(1); // it did spread, just not onto the cure
    expect(sim.fireAt(11, 6)).toBe(false);
  });

  it('spreads onto that tile once the extinguisher has been taken off it', () => {
    const sim = new Sim(makeLevel(), { players: 1, seed: 7 });
    const st = mutable(sim);
    st.tileItems[6 * st.width + 11] = null;
    st.fires.push({ x: 11, y: 5, health: 1, spreadTimer: FIRE_SPREAD_TIME });
    stepFor(sim, FIRE_SPREAD_TIME * 12);
    expect(sim.fireAt(11, 6)).toBe(true);
  });
});

// ─── Plates ─────────────────────────────────────────────────────────────────
describe('plate modes', () => {
  it("respawns a clean plate on the stack in 'stack' mode", () => {
    const level = makeLevel({
      grid: withRow(3, '#..........P#'),
      plates: { mode: 'stack', count: 1 },
    });
    const sim = new Sim(level, { players: 1, seed: 1 });
    const st = mutable(sim);
    expect(sim.itemAt(11, 3)).toMatchObject({ kind: 'plate' }); // legend 'P' seeds one

    place(sim, 0, 10.5, 5.5, 'right');
    giveSoupPlate(sim, 0, ['onion', 'onion', 'onion']);
    sim.step([inp({ pickupPressed: true })]);
    expect(st.pendingPlateReturns.length).toBe(1);
    expect(st.pendingPlateReturns[0]).toBeCloseTo(PLATE_STACK_RETURN_DELAY, 1);

    const events = stepFor(sim, PLATE_STACK_RETURN_DELAY + 0.1);
    expect(types(events)).toContain('plateReturned');
    expect(sim.itemAt(11, 3)).toMatchObject({ kind: 'plate', dish: null, count: 2 });
  });

  it('merges dirty stacks on the plate return', () => {
    const sim = new Sim(makeLevel(), { players: 1, seed: 1 });
    const st = mutable(sim);
    place(sim, 0, 10.5, 5.5, 'right');
    giveSoupPlate(sim, 0, ['onion', 'onion', 'onion']);
    sim.step([inp({ pickupPressed: true })]);
    giveSoupPlate(sim, 0, ['onion', 'onion', 'onion']);
    sim.step([inp({ pickupPressed: true })]);
    expect(st.pendingPlateReturns.length).toBe(2);
    stepFor(sim, PLATE_RETURN_DELAY + 0.2);
    expect(sim.itemAt(1, 2)).toMatchObject({ kind: 'dirtyPlate', count: 2 });
  });
});

// ─── Orders, scoring, timer ─────────────────────────────────────────────────
describe('orders and scoring', () => {
  it('adds an order every intervalSec up to max', () => {
    const sim = new Sim(
      makeLevel({ orders: { initial: 1, intervalSec: 1, max: 3, timeSec: 120 } }),
      { players: 1, seed: 5 },
    );
    const st = mutable(sim);
    const first = stepFor(sim, 1.05);
    expect(types(first)).toContain('orderNew');
    expect(st.orders.length).toBe(2);
    stepFor(sim, 5);
    expect(st.orders.length).toBe(3); // capped at max
  });

  it('penalises an expired order and resets the tip streak', () => {
    const sim = new Sim(
      makeLevel({ orders: { initial: 2, intervalSec: 1000, max: 4, timeSec: 2 } }),
      { players: 1, seed: 5 },
    );
    const st = mutable(sim);
    place(sim, 0, 10.5, 5.5, 'right');
    giveSoupPlate(sim, 0, ['onion', 'onion', 'onion']);
    sim.step([inp({ pickupPressed: true })]);
    expect(st.score).toBe(RECIPES.onion_soup.score);
    expect(st.tipStreak).toBe(1);

    const events = stepFor(sim, 2.1);
    const expired = events.find((e) => e.type === 'orderExpired');
    expect(expired).toBeDefined();
    expect(expired?.value).toBe(2); // the second order, the one that was not served
    expect(st.orders.length).toBe(0);
    expect(st.score).toBe(RECIPES.onion_soup.score - ORDER_FAIL_PENALTY);
    expect(st.failedCount).toBe(1);
    expect(st.tipStreak).toBe(0);
  });

  it('breaks the tip streak on an out-of-order serve and on an off-menu dish', () => {
    // Two tickets of different soups; find a seed where the first two orders differ.
    let sim: Sim | null = null;
    for (let seed = 1; seed < 50 && !sim; seed++) {
      const candidate = new Sim(
        makeLevel({ recipes: ['onion_soup', 'tomato_soup'], orders: { initial: 2, intervalSec: 1000, max: 4, timeSec: 120 } }),
        { players: 1, seed },
      );
      const o = candidate.getState().orders;
      if (o.length === 2 && o[0].recipeId !== o[1].recipeId) sim = candidate;
    }
    expect(sim).not.toBeNull();
    if (!sim) return;
    const st = mutable(sim);
    place(sim, 0, 10.5, 5.5, 'right');
    // Build a streak of one in-order serve.
    const first = st.orders[0].recipeId === 'onion_soup' ? 'onion' : 'tomato';
    const second = st.orders[1].recipeId === 'onion_soup' ? 'onion' : 'tomato';
    giveSoupPlate(sim, 0, [first, first, first]);
    sim.step([inp({ pickupPressed: true })]);
    expect(st.tipStreak).toBe(1);
    // Now two tickets again (spawn one more by hand via a fresh in-order serve setup): serve the
    // SECOND ticket first → scores base only and resets the streak.
    st.orders.unshift({ id: 999, recipeId: first === 'onion' ? 'onion_soup' : 'tomato_soup', timeLeft: 120, timeTotal: 120 });
    const before = st.score;
    giveSoupPlate(sim, 0, [second, second, second]);
    const outOfOrder = sim.step([inp({ pickupPressed: true })]).find((e) => e.type === 'serve');
    expect(outOfOrder?.value).toBe(RECIPES.onion_soup.score); // base only, no tip
    expect(st.score - before).toBe(RECIPES.onion_soup.score);
    expect(st.tipStreak).toBe(0);
    // Off-menu dish: accepted for 0 points, streak stays broken.
    st.tipStreak = 2;
    giveSoupPlate(sim, 0, ['mushroom', 'mushroom', 'mushroom']);
    const rejected = sim.step([inp({ pickupPressed: true })]).find((e) => e.type === 'serveRejected');
    expect(rejected).toBeDefined();
    expect(st.tipStreak).toBe(0);
  });

  it('grows the tip with the streak and matches the oldest order', () => {
    const sim = new Sim(
      makeLevel({ orders: { initial: 3, intervalSec: 1000, max: 4, timeSec: 120 } }),
      { players: 1, seed: 5 },
    );
    const st = mutable(sim);
    place(sim, 0, 10.5, 5.5, 'right');
    for (let i = 0; i < 3; i++) {
      giveSoupPlate(sim, 0, ['onion', 'onion', 'onion']);
      sim.step([inp({ pickupPressed: true })]);
    }
    expect(st.tipStreak).toBe(3);
    expect(st.score).toBe(3 * RECIPES.onion_soup.score + TIP_BASE * (0 + 1 + 2)); // tips 0, 2, 4
    expect(st.orders.length).toBe(0);
  });

  it('takes the plate but scores nothing for a dish nobody ordered', () => {
    const sim = new Sim(makeLevel(), { players: 1, seed: 5 });
    const st = mutable(sim);
    const chef = place(sim, 0, 10.5, 5.5, 'right');
    giveSoupPlate(sim, 0, ['mushroom', 'mushroom', 'mushroom']);
    const events = sim.step([inp({ pickupPressed: true })]);
    expect(types(events)).toContain('serveRejected');
    expect(types(events)).not.toContain('serve');
    expect(chef.holding).toBeNull();
    expect(st.score).toBe(0);
    expect(st.servedCount).toBe(0);
    expect(st.orders.length).toBe(1);
    expect(st.pendingPlateReturns.length).toBe(1);
  });
});

describe('timer and phases', () => {
  it('waits in prep, starts on the first serve, and ends with stars', () => {
    const sim = new Sim(
      makeLevel({ timerStartsOnFirstServe: true, timeLimitSec: 5 }),
      { players: 1, seed: 5 },
    );
    const st = mutable(sim);
    expect(st.phase).toBe('prep');
    expect(st.timerRunning).toBe(false);

    stepFor(sim, 1);
    expect(st.timeLeft).toBe(5);
    expect(st.orders[0].timeLeft).toBe(st.orders[0].timeTotal); // orders do not tick in prep

    place(sim, 0, 10.5, 5.5, 'right');
    giveSoupPlate(sim, 0, ['onion', 'onion', 'onion']);
    const started = sim.step([inp({ pickupPressed: true })]);
    expect(types(started)).toContain('timerStart');
    expect(st.phase).toBe('running');
    expect(st.timerRunning).toBe(true);

    expect(types(started)).toContain('timerWarning'); // 5s left is already inside the warning

    const ending = stepFor(sim, 5.1);
    const end = ending.find((e) => e.type === 'levelEnd');
    expect(end).toBeDefined();
    expect(end?.value).toBe(st.score);
    expect(st.phase).toBe('ended');
    expect(st.timeLeft).toBe(0);
    expect(st.stars).toBe(1); // 22 points clears the first threshold only

    const after = JSON.stringify(st);
    expect(sim.step([inp({ moveX: 1, pickupPressed: true })])).toEqual([]);
    expect(JSON.stringify(st)).toBe(after); // a finished level ignores everything
  });

  it("also starts the clock on a serve nobody ordered", () => {
    const sim = new Sim(
      makeLevel({ timerStartsOnFirstServe: true }),
      { players: 1, seed: 5 },
    );
    const st = mutable(sim);
    place(sim, 0, 10.5, 5.5, 'right');
    giveSoupPlate(sim, 0, ['tomato', 'tomato', 'tomato']);
    const events = sim.step([inp({ pickupPressed: true })]);
    expect(types(events)).toContain('serveRejected');
    expect(types(events)).toContain('timerStart');
    expect(st.timerRunning).toBe(true);
  });
});

// ─── Dynamics ───────────────────────────────────────────────────────────────
const PED_LEVEL = makeLevel({
  grid: withRow(3, '#~~~~~~~~~~W#'),
  dynamics: [{
    type: 'pedestrians',
    lanes: [{ from: { x: 1, y: 3 }, to: { x: 9, y: 3 } }],
    intervalSec: 1000,
    speed: 2,
    firstDelaySec: 0,
  }],
});

describe('pedestrians', () => {
  it('spawns on the lane, shoves chefs, and despawns on arrival', () => {
    const sim = new Sim(PED_LEVEL, { players: 1, seed: 1 });
    const st = mutable(sim);
    const chef = place(sim, 0, 4.5, 3.5, 'down');

    sim.step([NO_INPUT]);
    expect(st.pedestrians.length).toBe(1);
    expect(st.pedestrians[0].vx).toBeCloseTo(2, 6);

    stepFor(sim, 1.5);
    expect(chef.x).toBeGreaterThan(4.5); // pushed along, the pedestrian never yields
    expect(Math.hypot(chef.x - st.pedestrians[0].x, chef.y - st.pedestrians[0].y))
      .toBeGreaterThanOrEqual(CHEF_RADIUS * 2 - 1e-6);

    stepFor(sim, 4);
    expect(st.pedestrians.length).toBe(0);
  });

  it('never pushes a chef into a wall', () => {
    const sim = new Sim(PED_LEVEL, { players: 1, seed: 1 });
    const st = mutable(sim);
    const chef = place(sim, 0, 10.5, 3.5, 'right');
    stepFor(sim, 5);
    expect(chef.x).toBeLessThanOrEqual(10.7 + 1e-6);
    expect(st.width).toBe(13);
    // still standing on a walkable tile
    const tile = sim.tileAt(Math.floor(chef.x), Math.floor(chef.y));
    expect(tile && (tile.type === 'floor' || tile.type === 'road')).toBe(true);
  });
});

const SLIDER_LEVEL = makeLevel({
  grid: withRow(2, '#R...1.....S#'),
  dynamics: [{ type: 'sliders', group: '1', axis: 'x', amplitude: 1, periodSec: 4, phase: 0 }],
});

describe('sliders', () => {
  it('oscillates the group offset', () => {
    const sim = new Sim(SLIDER_LEVEL, { players: 1, seed: 1 });
    const st = mutable(sim);
    expect(st.sliders).toEqual([{ id: '1', offsetX: 0, offsetY: 0 }]);
    place(sim, 0, 9.5, 5.5, 'down'); // out of the way
    stepFor(sim, 1);
    expect(st.sliders[0].offsetX).toBeCloseTo(1, 3);
    stepFor(sim, 2);
    expect(st.sliders[0].offsetX).toBeCloseTo(-1, 3);
  });

  it('pushes a chef along its axis and targets at the shifted position', () => {
    const sim = new Sim(SLIDER_LEVEL, { players: 1, seed: 1 });
    const chef = place(sim, 0, 6.5, 2.5, 'left');
    stepFor(sim, 1);
    expect(chef.x).toBeGreaterThanOrEqual(7.3 - 1e-6); // shoved clear of the shifted counter
    expect(chef.y).toBeCloseTo(2.5, 6);

    place(sim, 0, 7.5, 2.5, 'left'); // reach point 6.6, inside the slider at offset +1
    expect(sim.getTargetTile(0)).toEqual({ x: 5, y: 2 }); // reported by base tile
  });

  it('holds items on the slider by its base tile', () => {
    const sim = new Sim(SLIDER_LEVEL, { players: 1, seed: 1 });
    const chef = place(sim, 0, 2.5, 1.5, 'left');
    sim.step([inp({ pickupPressed: true })]);
    place(sim, 0, 6.5, 2.5, 'left'); // reach point 5.6, the slider is still near its base
    sim.step([inp({ pickupPressed: true })]);
    expect(chef.holding).toBeNull();
    expect(sim.itemAt(5, 2)).toMatchObject({ kind: 'ingredient', type: 'onion' });
  });
});

// ─── Difficulty modifiers ───────────────────────────────────────────────────
describe('modifiers and seed', () => {
  it('reports the level\'s own numbers when there are no modifiers', () => {
    const sim = new Sim(makeLevel(), { players: 1, seed: 3 });
    const eff = sim.getEffectiveSettings();
    expect(eff.timeLimitSec).toBe(BASE.timeLimitSec);
    expect(eff.orders).toEqual(BASE.orders);
    expect(eff.chefSpeed).toBe(CHEF_SPEED);
    expect(eff.cookTime).toBe(COOK_TIME);
    expect(eff.panCookTime).toBe(PAN_COOK_TIME);
    expect(eff.burnTime).toBe(BURN_TIME);
    expect(eff.chopTime).toBe(CHOP_TIME);
    expect(eff.washTime).toBe(WASH_TIME);
    expect(sim.getState().timeLeft).toBe(BASE.timeLimitSec);
  });

  it('scales cook time for pots and pans alike', () => {
    const sim = new Sim(makeLevel(), { players: 1, seed: 3, modifiers: { cookTimeScale: 2 } });
    expect(sim.getEffectiveSettings().cookTime).toBe(COOK_TIME * 2);
    expect(sim.getEffectiveSettings().panCookTime).toBe(PAN_COOK_TIME * 2);
    const pot = potOnStove(sim);
    pot.contents.push('onion', 'onion', 'onion');
    expect(types(stepFor(sim, COOK_TIME + 0.5))).not.toContain('cookDone');
    expect(pot.state).toBe('cooking');
    expect(types(stepFor(sim, COOK_TIME))).toContain('cookDone');
    expect(pot.state).toBe('cooked');
  });

  it('scales burn time', () => {
    const sim = new Sim(makeLevel(), { players: 1, seed: 3, modifiers: { burnTimeScale: 0.5 } });
    expect(sim.getEffectiveSettings().burnTime).toBe(BURN_TIME / 2);
    const pot = potOnStove(sim);
    pot.contents.push('onion', 'onion', 'onion');
    stepFor(sim, COOK_TIME + 0.1);
    expect(pot.state).toBe('cooked');
    expect(types(stepFor(sim, BURN_TIME / 4))).not.toContain('burnt');
    expect(types(stepFor(sim, BURN_TIME / 4 + 0.1))).toContain('burnt');
    expect(pot.state).toBe('burnt');
  });

  it('scales chop time', () => {
    const sim = new Sim(makeLevel(), { players: 1, seed: 1, modifiers: { chopTimeScale: 0.5 } });
    expect(sim.getEffectiveSettings().chopTime).toBe(CHOP_TIME / 2);
    place(sim, 0, 2.5, 1.5, 'left');
    sim.step([inp({ pickupPressed: true })]);
    place(sim, 0, 10.5, 1.5, 'right');
    sim.step([inp({ pickupPressed: true })]);
    const events = stepFor(sim, CHOP_TIME / 2 + 0.1, inp({ interactHeld: true }));
    expect(types(events)).toContain('chopTick');
    expect(types(events)).toContain('chopDone');
    expect(sim.itemAt(11, 1)).toMatchObject({ kind: 'ingredient', chopped: true });
  });

  it('scales wash time', () => {
    const sim = new Sim(makeLevel(), { players: 1, seed: 1, modifiers: { washTimeScale: 2 } });
    expect(sim.getEffectiveSettings().washTime).toBe(WASH_TIME * 2);
    mutable(sim).chefs[0].holding = { kind: 'dirtyPlate', id: 9100, count: 1 };
    place(sim, 0, 10.5, 3.5, 'right');
    sim.step([inp({ pickupPressed: true })]);
    expect(sim.itemAt(11, 3)).toMatchObject({ kind: 'dirtyPlate', count: 1 });
    expect(types(stepFor(sim, WASH_TIME + 0.1, inp({ interactHeld: true })))).not.toContain('washDone');
    expect(types(stepFor(sim, WASH_TIME, inp({ interactHeld: true })))).toContain('washDone');
    expect(sim.itemAt(11, 4)).toMatchObject({ kind: 'plate', dish: null, count: 1 });
  });

  it('shifts the starting ticket count, never below zero or above the cap', () => {
    const level = makeLevel({ orders: { initial: 1, intervalSec: 1000, max: 3, timeSec: 120 } });
    const more = new Sim(level, { players: 1, seed: 3, modifiers: { initialOrdersDelta: 1 } });
    expect(more.getEffectiveSettings().orders.initial).toBe(2);
    expect(more.getState().orders.length).toBe(2);

    const capped = new Sim(level, { players: 1, seed: 3, modifiers: { initialOrdersDelta: 5 } });
    expect(capped.getEffectiveSettings().orders.initial).toBe(3);
    expect(capped.getState().orders.length).toBe(3);

    const none = new Sim(level, { players: 1, seed: 3, modifiers: { initialOrdersDelta: -4 } });
    expect(none.getEffectiveSettings().orders.initial).toBe(0);
    expect(none.getState().orders.length).toBe(0);

    const raised = new Sim(level, { players: 1, seed: 3, modifiers: { initialOrdersDelta: 2, maxOrdersDelta: 1 } });
    expect(raised.getEffectiveSettings().orders).toMatchObject({ initial: 3, max: 4 });
  });

  it('scales the time limit', () => {
    const sim = new Sim(makeLevel(), { players: 1, seed: 3, modifiers: { timeLimitScale: 0.5 } });
    expect(sim.getEffectiveSettings().timeLimitSec).toBe(150);
    expect(sim.getState().timeLeft).toBe(150);
    stepFor(sim, 1);
    expect(sim.getState().timeLeft).toBeCloseTo(149, 6);
  });

  it('scales how long an order lives', () => {
    const sim = new Sim(makeLevel(), { players: 1, seed: 3, modifiers: { orderTimeScale: 0.25 } });
    expect(sim.getEffectiveSettings().orders.timeSec).toBe(30);
    expect(sim.getState().orders[0].timeTotal).toBe(30);
    expect(sim.getState().orders[0].timeLeft).toBe(30);
  });

  it('scales the gap between orders', () => {
    const level = makeLevel({ orders: { initial: 0, intervalSec: 10, max: 4, timeSec: 120 } });
    const sim = new Sim(level, { players: 1, seed: 3, modifiers: { orderIntervalScale: 0.5 } });
    expect(sim.getEffectiveSettings().orders.intervalSec).toBe(5);
    expect(types(stepFor(sim, 4.8))).not.toContain('orderNew');
    expect(types(stepFor(sim, 0.4))).toContain('orderNew');
  });

  it('shifts the concurrent order cap and never drops below one', () => {
    const level = makeLevel({ orders: { initial: 1, intervalSec: 0.5, max: 2, timeSec: 120 } });
    const more = new Sim(level, { players: 1, seed: 3, modifiers: { maxOrdersDelta: 2 } });
    expect(more.getEffectiveSettings().orders.max).toBe(4);
    stepFor(more, 6);
    expect(more.getState().orders.length).toBe(4);

    const fewer = new Sim(level, { players: 1, seed: 3, modifiers: { maxOrdersDelta: -5 } });
    expect(fewer.getEffectiveSettings().orders.max).toBe(1);
    stepFor(fewer, 6);
    expect(fewer.getState().orders.length).toBe(1);
  });

  it('scales chef speed', () => {
    const sim = new Sim(makeLevel(), { players: 1, seed: 3, modifiers: { chefSpeedScale: 1.5 } });
    expect(sim.getEffectiveSettings().chefSpeed).toBeCloseTo(CHEF_SPEED * 1.5, 6);
    const chef = mutable(sim).chefs[0];
    const x0 = chef.x;
    stepFor(sim, 0.25, inp({ moveX: 1 }));
    expect(chef.x - x0).toBeCloseTo(CHEF_SPEED * 1.5 * 0.25, 4);
  });

  it('never writes the scaled numbers back into the level', () => {
    const level = makeLevel();
    new Sim(level, {
      players: 1, seed: 3,
      modifiers: {
        timeLimitScale: 0.5, orderIntervalScale: 0.5, orderTimeScale: 0.5, maxOrdersDelta: 3, chefSpeedScale: 2,
        cookTimeScale: 2, burnTimeScale: 2, chopTimeScale: 2, washTimeScale: 2, initialOrdersDelta: 2,
      },
    });
    expect(level.timeLimitSec).toBe(BASE.timeLimitSec);
    expect(level.orders).toEqual(BASE.orders);
  });

  it('carries the run seed in the snapshot', () => {
    expect(new Sim(makeLevel(), { players: 1, seed: 4242 }).getState().seed).toBe(4242);
    expect(new Sim(makeLevel(), { players: 1, seed: 0 }).getState().seed).toBe(0);
  });
});

// ─── Determinism ────────────────────────────────────────────────────────────
describe('determinism', () => {
  const BUSY = makeLevel({
    grid: [
      '#############',
      '#O.........B#',
      '#R...1.....S#',
      '#~~~~~~~~~~W#',
      '#..........D#',
      '#p.........V#',
      '#X.........E#',
      '#############',
    ],
    orders: { initial: 2, intervalSec: 3, max: 5, timeSec: 12 },
    recipes: ['onion_soup', 'tomato_soup', 'mushroom_soup'],
    dynamics: [
      { type: 'sliders', group: '1', axis: 'x', amplitude: 1, periodSec: 4, phase: 0.25 },
      {
        type: 'pedestrians',
        lanes: [{ from: { x: 1, y: 3 }, to: { x: 10, y: 3 } }],
        intervalSec: 2.5, speed: 2.5, firstDelaySec: 0.5,
      },
    ],
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
    expect(run(1234)).toBe(run(1234));
  });

  it('differs for a different seed', () => {
    expect(run(1234)).not.toBe(run(9876));
  });

  it('keeps the state JSON-clean (no Maps, Sets, or NaN)', () => {
    const sim = new Sim(BUSY, { players: 2, seed: 42 });
    for (let i = 0; i < 600; i++) sim.step([scriptedInput(i, 0), scriptedInput(i, 1)]);
    const json = JSON.stringify(sim.getState());
    expect(json).not.toContain('NaN');
    const revived = JSON.parse(json) as SimState;
    expect(Number.isFinite(revived.chefs[0].x)).toBe(true);
    expect(Number.isFinite(revived.elapsed)).toBe(true);
    expect(revived.tiles.length).toBe(revived.width * revived.height);
  });

  it('steps a full kitchen well inside the frame budget', () => {
    const sim = new Sim(BUSY, { players: 2, seed: 7 });
    const runs = 5000;
    const started = performance.now();
    for (let i = 0; i < runs; i++) sim.step([scriptedInput(i, 0), scriptedInput(i, 1)]);
    const perStep = (performance.now() - started) / runs;
    expect(perStep).toBeLessThan(0.2);
  });
});

// ─── Assists ────────────────────────────────────────────────────────────────
describe('assists', () => {
  it('instant cooking finishes a pot the step it starts', () => {
    const sim = new Sim(makeLevel(), { players: 1, seed: 3, modifiers: { instantCooking: true } });
    const pot = potOnStove(sim);
    pot.contents.push('onion', 'onion', 'onion');
    const events = sim.step([NO_INPUT]);
    expect(types(events)).toEqual(expect.arrayContaining(['cookStart', 'cookDone']));
    expect(pot.state).toBe('cooked');
    expect(pot.cookProgress).toBe(1);
  });

  it('no burning keeps a cooked pot cooked and never lights the stove', () => {
    const sim = new Sim(makeLevel(), { players: 1, seed: 3, modifiers: { noBurning: true } });
    const pot = potOnStove(sim);
    pot.contents.push('onion', 'onion', 'onion');
    const events = stepFor(sim, COOK_TIME + BURN_TIME * 2);
    expect(types(events)).toContain('cookDone');
    expect(types(events)).not.toContain('burnt');
    expect(pot.state).toBe('cooked');
    expect(pot.burnProgress).toBe(0);
    expect(sim.fireAt(11, 2)).toBe(false);
  });

  it('orders never expire keeps every ticket at its full timer', () => {
    const sim = new Sim(
      makeLevel({ orders: { initial: 2, intervalSec: 1000, max: 4, timeSec: 2 } }),
      { players: 1, seed: 5, modifiers: { ordersNeverExpire: true } },
    );
    const st = mutable(sim);
    const events = stepFor(sim, 4);
    expect(types(events)).not.toContain('orderExpired');
    expect(st.orders.length).toBe(2);
    expect(st.orders.every((o) => o.timeLeft === o.timeTotal)).toBe(true);
    expect(st.failedCount).toBe(0);
  });

  it('are off unless the modifiers switch them on', () => {
    const sim = new Sim(makeLevel(), { players: 1, seed: 3, modifiers: { timeLimitScale: 1.25 } });
    const pot = potOnStove(sim);
    pot.contents.push('onion', 'onion', 'onion');
    const first = sim.step([NO_INPUT]);
    expect(types(first)).toContain('cookStart');
    expect(types(first)).not.toContain('cookDone');
    expect(pot.state).toBe('cooking');
  });
});
