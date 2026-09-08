import { describe, expect, it } from 'vitest';
import { Sim } from '../src/sim';
import { CHEF_HITBOX, CHEF_RADIUS, MAX_PUSH_ESCAPE, SIM_DT } from '../src/sim/constants';
import { NO_INPUT, type Chef, type Facing, type SimState } from '../src/sim/types';
import { SOLID_TILES, type LevelDef } from '../src/levels/schema';

// ─── Fixtures ───────────────────────────────────────────────────────────────
const HALF = CHEF_HITBOX / 2;
const TOUCH = 1e-6; // resting flush against a box is legal; only a real overlap is a bug

const BASE: LevelDef = {
  id: 'collision', name: 'collision', game: 'custom', world: 1, index: 1, theme: 'test',
  timeLimitSec: 300, timerStartsOnFirstServe: false,
  recipes: ['onion_soup'],
  orders: { initial: 0, intervalSec: 1000, max: 4, timeSec: 120 },
  stars: { 1: [10, 40, 60], 2: [10, 40, 60] },
  plates: { mode: 'stack', count: 1 },
  grid: [],
  spawns: [{ x: 2, y: 7 }, { x: 6, y: 7 }],
};

// 1-3 in miniature: one slider column at x=4 with a static counter under it at (4,6).
// Group '1' fills rows 1..3, group '2' rows 4..5. Both start a tile high (phase 0.75) and
// sweep down, so at full extension group '2' sits right on top of that counter.
const LANE_GRID = [
  '..........',
  '.#..1...PV',
  '.#..1...O#',
  '.#..1....#',
  '.#..2....#',
  '.#..2....#',
  '.#B.#...S#',
  '..........',
];
// The same column with the floor either side of (4,5) walled off: nowhere to dodge sideways.
const POCKET_GRID = [...LANE_GRID];
POCKET_GRID[5] = '.#.#2#...#';

function sliderLevel(grid: string[]): LevelDef {
  return {
    ...BASE,
    grid: [...grid],
    dynamics: [
      { type: 'sliders', group: '1', axis: 'y', amplitude: 1, periodSec: 6, phase: 0.75 },
      { type: 'sliders', group: '2', axis: 'y', amplitude: 1, periodSec: 6, phase: 0.75 },
    ],
  };
}

// 1-2 in miniature: a crosswalk down x=4 that dead-ends in the bottom-right corner of the
// kitchen, where a chef can be wedged between the counter at (5,5) and the grid edge. The
// counter at (5,3) gives the lane a second pinch point higher up.
const PED_LEVEL: LevelDef = {
  ...BASE,
  grid: [
    '##S#~###',
    '#...~..V',
    'D...~..#',
    'W...~#.#',
    '#...~..#',
    '#O.#~#O#',
  ],
  spawns: [{ x: 1, y: 1 }, { x: 2, y: 1 }],
  dynamics: [{
    type: 'pedestrians',
    lanes: [{ from: { x: 4, y: 0 }, to: { x: 4, y: 5 } }],
    intervalSec: 2, speed: 2.5, firstDelaySec: 0,
  }],
};

// ─── Helpers ────────────────────────────────────────────────────────────────
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

/** Static solid tiles the chef's hitbox is inside of, plus the grid edge. */
function tileOverlaps(sim: Sim, chef: Chef): string[] {
  const st = sim.getState();
  const hits: string[] = [];
  const minX = chef.x - HALF;
  const maxX = chef.x + HALF;
  const minY = chef.y - HALF;
  const maxY = chef.y + HALF;
  for (const t of st.tiles) {
    if (!SOLID_TILES.has(t.type) || t.type === 'slider') continue;
    if (maxX <= t.x + TOUCH || minX >= t.x + 1 - TOUCH) continue;
    if (maxY <= t.y + TOUCH || minY >= t.y + 1 - TOUCH) continue;
    hits.push(`${t.type} (${t.x},${t.y})`);
  }
  if (minX < -TOUCH || minY < -TOUCH || maxX > st.width + TOUCH || maxY > st.height + TOUCH) {
    hits.push(`off grid (${chef.x.toFixed(2)},${chef.y.toFixed(2)})`);
  }
  return hits;
}

/** Slider boxes, at their shifted position, the chef's hitbox is inside of. */
function sliderOverlaps(sim: Sim, chef: Chef): string[] {
  const st = sim.getState();
  const hits: string[] = [];
  for (const t of st.tiles) {
    if (t.type !== 'slider') continue;
    const off = sim.sliderOffset(t.group ?? '');
    const bx = t.x + off.x;
    const by = t.y + off.y;
    if (chef.x + HALF <= bx + TOUCH || chef.x - HALF >= bx + 1 - TOUCH) continue;
    if (chef.y + HALF <= by + TOUCH || chef.y - HALF >= by + 1 - TOUCH) continue;
    hits.push(`slider ${t.group} at (${bx.toFixed(2)},${by.toFixed(2)})`);
  }
  return hits;
}

/** Steps the sim, returning the furthest a chef was moved in any single step. */
function stepWatching(sim: Sim, seconds: number, check: (step: number) => void): number {
  const chef = sim.getState().chefs[0];
  let worst = 0;
  const steps = Math.round(seconds / SIM_DT);
  for (let i = 0; i < steps; i++) {
    const fromX = chef.x;
    const fromY = chef.y;
    sim.step([NO_INPUT]);
    worst = Math.max(worst, Math.hypot(chef.x - fromX, chef.y - fromY));
    check(i);
  }
  return worst;
}

// ─── Sliders ────────────────────────────────────────────────────────────────
describe('slider pushes', () => {
  it('never parks a chef inside the counter the slider sweeps towards', () => {
    const sim = new Sim(sliderLevel(LANE_GRID), { players: 1, seed: 1 });
    const chef = place(sim, 0, 4.5, 5.5, 'down');
    expect(tileOverlaps(sim, chef)).toEqual([]); // the starting spot is legal

    const worst = stepWatching(sim, 6, (i) => {
      expect(tileOverlaps(sim, chef), `step ${i}`).toEqual([]);
      expect(sliderOverlaps(sim, chef), `step ${i}`).toEqual([]);
    });
    expect(worst).toBeLessThanOrEqual(MAX_PUSH_ESCAPE + TOUCH);
  });

  it('squeezes the chef sideways out of the lane rather than down into the counter', () => {
    const sim = new Sim(sliderLevel(LANE_GRID), { players: 1, seed: 1 });
    const chef = place(sim, 0, 4.5, 5.5, 'down');
    stepWatching(sim, 3, () => undefined);
    expect(chef.x).toBeCloseTo(4 - HALF, 6);             // stepped out to the left of the column
    expect(chef.y + HALF).toBeLessThanOrEqual(6 + TOUCH); // pressed onto the counter, never into it
    expect(chef.y).toBeGreaterThan(5.4);                  // and never carried up the lane
  });

  it('lets the slider pass rather than standing the chef in a counter when boxed in', () => {
    const sim = new Sim(sliderLevel(POCKET_GRID), { players: 1, seed: 1 });
    const chef = place(sim, 0, 4.5, 5.5, 'down');
    const worst = stepWatching(sim, 6, (i) => {
      expect(tileOverlaps(sim, chef), `step ${i}`).toEqual([]);
    });
    expect(worst).toBeLessThanOrEqual(MAX_PUSH_ESCAPE + TOUCH);
  });
});

// ─── Pedestrians ────────────────────────────────────────────────────────────
describe('pedestrian pushes', () => {
  it('nudges a chef a walker is standing on instead of launching it down the lane', () => {
    const sim = new Sim(PED_LEVEL, { players: 1, seed: 1 });
    const st = mutable(sim);
    const chef = place(sim, 0, 4.5, 3.5, 'down');
    // Sits exactly under the chef once the walker has taken its step.
    st.pedestrians.push({ id: 900, x: chef.x, y: chef.y - 2.5 * SIM_DT, vx: 0, vy: 2.5 });

    sim.step([NO_INPUT]);
    expect(Math.hypot(chef.x - 4.5, chef.y - 3.5)).toBeLessThanOrEqual(CHEF_RADIUS * 2 + TOUCH);
    expect(chef.y).toBeLessThan(3.5); // stepped back out of the way, not carried along
    expect(tileOverlaps(sim, chef)).toEqual([]);
  });

  it('separates a chef from a walker that is stopped on top of it', () => {
    const sim = new Sim(PED_LEVEL, { players: 1, seed: 1 });
    const st = mutable(sim);
    const chef = place(sim, 0, 4.5, 2.5, 'down');
    st.pedestrians.push({ id: 901, x: chef.x, y: chef.y, vx: 0, vy: 0 });

    sim.step([NO_INPUT]);
    const moved = Math.hypot(chef.x - 4.5, chef.y - 2.5);
    expect(moved).toBeLessThanOrEqual(CHEF_RADIUS * 2 + TOUCH);
    expect(moved).toBeGreaterThan(0);
    expect(tileOverlaps(sim, chef)).toEqual([]);
  });

  it('keeps a chef wedged in a corner out of the walls while walkers stream past', () => {
    const sim = new Sim(PED_LEVEL, { players: 1, seed: 1 });
    const chef = place(sim, 0, 4.7, 5.7, 'right'); // grid edge below, counter (5,5) to the right
    expect(tileOverlaps(sim, chef)).toEqual([]);

    const worst = stepWatching(sim, 8, (i) => {
      expect(tileOverlaps(sim, chef), `step ${i}`).toEqual([]);
    });
    expect(worst).toBeLessThanOrEqual(MAX_PUSH_ESCAPE + TOUCH);
  });

  it('never pushes a chef into the counter it is standing against', () => {
    const sim = new Sim(PED_LEVEL, { players: 1, seed: 1 });
    const st = mutable(sim);
    const chef = place(sim, 0, 4.7, 3.5, 'right'); // flush against the counter at (5,3)
    st.pedestrians.push({ id: 902, x: 4.65, y: 3.5, vx: 0, vy: 0 });

    sim.step([NO_INPUT]);
    expect(tileOverlaps(sim, chef)).toEqual([]);
    expect(chef.x + HALF).toBeLessThanOrEqual(5 + TOUCH);
  });
});
