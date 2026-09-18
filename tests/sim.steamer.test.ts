import { describe, expect, it } from 'vitest';
import { Sim } from '../src/sim';
import { BURN_TIME, MIX_TIME, SIM_DT, STEAM_TIME } from '../src/sim/constants';
import {
  NO_INPUT,
  type Chef, type Facing, type IngredientItem, type IngredientType, type PlateItem, type PlayerInput,
  type PotItem, type SimEvent, type SimState,
} from '../src/sim/types';
import { validateLevel, type LevelDef } from '../src/levels/schema';

// ─── Fixture ────────────────────────────────────────────────────────────────
// Flour, beef, carrot, prawn and fish crates, a board, a mixer with its bowl and a steamer along the top.
const GRID = [
  '#fAqØJBKZ####',
  '#...........V',
  '#...........#',
  '#...........R',
  '#...........#',
  '#...........#',
  '#p..........#',
  '#X##WD#######',
];

const BASE: LevelDef = {
  id: 'test-steamer', name: 'test', game: 'custom', world: 1, index: 1, theme: 'test',
  timeLimitSec: 300, timerStartsOnFirstServe: false,
  recipes: ['steamed_fish', 'steamed_beef', 'steamed_carrot', 'steamed_prawn'],
  orders: { initial: 1, intervalSec: 1000, max: 4, timeSec: 200 },
  stars: { 1: [10, 40, 60], 2: [10, 40, 60] },
  plates: { mode: 'sink', count: 1 },
  grid: GRID,
  spawns: [{ x: 6, y: 2 }, { x: 9, y: 4 }],
};

function make(): Sim {
  return new Sim({ ...BASE, grid: [...GRID] }, { players: 2, seed: 1 });
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

function ing(type: IngredientType, chopped: boolean, id = 900): IngredientItem {
  return { kind: 'ingredient', id, type, chopped, chopProgress: chopped ? 1 : 0 };
}

function tap(sim: Sim): SimEvent[] {
  const events = sim.step([inp({ pickupPressed: true }), NO_INPUT]);
  sim.step([NO_INPUT, NO_INPUT]);
  return events;
}

function stepFor(sim: Sim, seconds: number): SimEvent[] {
  const events: SimEvent[] = [];
  for (let i = 0; i < Math.round(seconds / SIM_DT); i++) events.push(...sim.step([NO_INPUT, NO_INPUT]));
  return events;
}

function ware(sim: Sim, x: number): PotItem {
  const item = sim.itemAt(x, 0);
  if (!item || item.kind !== 'pot') throw new Error('no cookware');
  return item;
}

/** Hands chef 0 each item in turn, facing the tile at (x, 0). */
function feed(sim: Sim, x: number, ...items: IngredientItem[]): void {
  place(sim, x + 0.5, 1.5, 'up');
  for (const item of items) {
    mutable(sim).chefs[0].holding = item;
    tap(sim);
  }
}

describe('mixer and steamer', () => {
  it('validates, and a mixed dumpling needs a mixer', () => {
    expect(validateLevel({ ...BASE })).toEqual([]);
    const errors = validateLevel({ ...BASE, grid: GRID.map((row) => row.replace('K', '#')) });
    expect(errors.some((e) => e.includes('needs a mixer'))).toBe(true);
  });

  it('takes raw flour and chopped fillings in the bowl, one of each, and no raw filling', () => {
    const sim = make();
    feed(sim, 7, ing('flour', false, 901), ing('meat', false, 902), ing('carrot', true, 903), ing('flour', false, 905), ing('carrot', true, 906));
    expect(ware(sim, 7).contents).toEqual(['flour', 'carrot']);
  });

  it('mixes in MIX_TIME, and a mixer run too long breaks for good without a fire', () => {
    const sim = make();
    feed(sim, 7, ing('flour', false, 901), ing('meat', true, 902));
    stepFor(sim, MIX_TIME + 0.1);
    expect(ware(sim, 7).state).toBe('cooked');
    const events = stepFor(sim, BURN_TIME);
    expect(events.some((e) => e.type === 'mixerBroke')).toBe(true);
    expect(sim.tileAt(7, 0)?.broken).toBe(true);
    expect(sim.getState().fires).toHaveLength(0);
    // A broken mixer mixes nothing again.
    const bowl = ware(sim, 7);
    bowl.contents = ['flour'];
    bowl.state = 'empty';
    bowl.cookProgress = 0;
    bowl.burnProgress = 0;
    stepFor(sim, MIX_TIME + 1);
    expect(bowl.state).toBe('empty');
  });

  it('pours a mixed bowl into an empty steamer, which steams it into dumplings for a plate', () => {
    const sim = make();
    feed(sim, 7, ing('flour', false, 901), ing('meat', true, 902));
    stepFor(sim, MIX_TIME + 0.1);
    const bowl = ware(sim, 7);
    place(sim, 7.5, 1.5, 'up');
    tap(sim); // lift the bowl
    expect(mutable(sim).chefs[0].holding?.id).toBe(bowl.id);
    place(sim, 8.5, 1.5, 'up');
    tap(sim); // pour into the steamer
    expect(ware(sim, 8).contents).toEqual(['flour', 'meat']);
    expect(bowl.contents).toEqual([]);
    stepFor(sim, STEAM_TIME + 0.1);
    expect(ware(sim, 8).state).toBe('cooked');
    const plate: PlateItem = { kind: 'plate', id: 960, dish: null };
    mutable(sim).chefs[0].holding = plate;
    tap(sim);
    expect(plate.dish).toEqual({ type: 'steamed', ingredients: ['flour', 'meat'] });
    const st = mutable(sim);
    st.orders.length = 0;
    st.orders.push({ id: 99, recipeId: 'steamed_beef', timeLeft: 100, timeTotal: 100 });
    place(sim, 11.5, 1.5, 'right');
    expect(tap(sim).find((e) => e.type === 'serve')?.value).toBe(60);
  });

  it('takes a chopped fish straight into the steamer, no mixer', () => {
    const sim = make();
    feed(sim, 8, ing('fish', true, 910));
    expect(ware(sim, 8).contents).toEqual(['fish']);
    stepFor(sim, STEAM_TIME + 0.1);
    expect(ware(sim, 8).state).toBe('cooked');
  });

  it('will not plate a raw mix, nor pour an unmixed one', () => {
    const sim = make();
    feed(sim, 7, ing('flour', false, 901));
    const bowl = ware(sim, 7);
    place(sim, 7.5, 1.5, 'up');
    tap(sim);
    place(sim, 8.5, 1.5, 'up');
    tap(sim);
    expect(ware(sim, 8).contents).toEqual([]);
    bowl.state = 'cooked';
    const plate: PlateItem = { kind: 'plate', id: 961, dish: null };
    mutable(sim).tileItems[6 * 13 + 1] = plate;
    place(sim, 1.5, 5.5, 'down');
    tap(sim);
    expect(plate.dish).toBeNull();
  });

  it('runs deterministically', () => {
    const run = (): string => {
      const sim = make();
      feed(sim, 7, ing('flour', false, 901), ing('meat', true, 902));
      for (let i = 0; i < 900; i++) sim.step([inp({ moveX: Math.sin(i / 30), moveY: Math.cos(i / 25) }), NO_INPUT]);
      return JSON.stringify(sim.getState());
    };
    expect(run()).toBe(run());
  });
});
