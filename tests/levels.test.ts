import { describe, expect, it } from 'vitest';
import { LEVELS, LEVEL_ORDER } from '../src/levels';
import { isWalkable, parseGrid, validateLevel } from '../src/levels/schema';
import type { LevelDef, ParsedGrid } from '../src/levels/schema';
import type { IngredientType, TileType } from '../src/sim/types';

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Tile types a chef must be able to stand next to for the level to be playable. */
const REQUIRED_ADJACENT: readonly TileType[] = ['crate', 'board', 'stove', 'serve', 'sink'];

function tileAt(p: ParsedGrid, x: number, y: number) {
  if (x < 0 || y < 0 || x >= p.width || y >= p.height) return null;
  return p.tiles[y * p.width + x];
}

function countType(p: ParsedGrid, type: TileType): number {
  return p.tiles.filter((t) => t.type === type).length;
}

function countCrate(p: ParsedGrid, ingredient: IngredientType): number {
  return p.tiles.filter((t) => t.type === 'crate' && t.ingredient === ingredient).length;
}

/** Flood fill over walkable tiles (road counts as walkable, sliders stay solid at rest). */
function reachableFrom(p: ParsedGrid, sx: number, sy: number): Set<number> {
  const seen = new Set<number>();
  const start = tileAt(p, sx, sy);
  if (!start || !isWalkable(start.type)) return seen;
  const queue: number[] = [sy * p.width + sx];
  seen.add(queue[0]);
  while (queue.length) {
    const i = queue.pop() as number;
    const x = i % p.width;
    const y = (i - x) / p.width;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const n = tileAt(p, x + dx, y + dy);
      if (!n || !isWalkable(n.type)) continue;
      const ni = (y + dy) * p.width + (x + dx);
      if (seen.has(ni)) continue;
      seen.add(ni);
      queue.push(ni);
    }
  }
  return seen;
}

/** Station tiles the flood fill never gets next to, as 'type (x,y)' strings. */
function unreachableStations(p: ParsedGrid, reached: Set<number>): string[] {
  const bad: string[] = [];
  for (const t of p.tiles) {
    if (!REQUIRED_ADJACENT.includes(t.type)) continue;
    const touched = ([[1, 0], [-1, 0], [0, 1], [0, -1]] as const).some(([dx, dy]) => {
      const n = tileAt(p, t.x + dx, t.y + dy);
      return !!n && isWalkable(n.type) && reached.has((t.y + dy) * p.width + (t.x + dx));
    });
    if (!touched) bad.push(`${t.type} (${t.x},${t.y})`);
  }
  return bad;
}

function level(id: string): LevelDef {
  const l = LEVELS[id];
  expect(l, `level ${id} is missing`).toBeTruthy();
  return l;
}

// ─── Generic validation (every level) ───────────────────────────────────────

describe('levels', () => {
  const levels = Object.values(LEVELS);

  it('finds at least one level', () => { expect(levels.length).toBeGreaterThan(0); });

  it('orders levels by game, world, index', () => {
    expect(LEVEL_ORDER.length).toBe(levels.length);
    expect(LEVEL_ORDER[0]).toBe('oc1-1-1');
  });

  it('has the three Overcooked 1 world-1 levels', () => {
    expect(LEVEL_ORDER.slice(0, 3)).toEqual(['oc1-1-1', 'oc1-1-2', 'oc1-1-3']);
  });

  for (const l of levels) {
    it(`${l.id} validates`, () => { expect(validateLevel(l)).toEqual([]); });

    it(`${l.id} parses to a rectangular grid`, () => {
      const p = parseGrid(l);
      expect(p.tiles.length).toBe(p.width * p.height);
      expect(p.items.length).toBe(p.tiles.length);
    });

    it(`${l.id} fits the 16x10 tile budget`, () => {
      const p = parseGrid(l);
      expect(p.width).toBeLessThanOrEqual(16);
      expect(p.height).toBeLessThanOrEqual(10);
    });

    it(`${l.id} names itself consistently`, () => {
      expect(l.id).toBe(`${l.game}-${l.world}-${l.index}`);
      expect(l.name).toBe(`${l.world}-${l.index}`);
      expect(l.theme.length).toBeGreaterThan(0);
      expect(l.source).toMatch(/^https:\/\/overcooked\.fandom\.com\//);
    });

    it(`${l.id} has two spawns on distinct walkable tiles`, () => {
      const p = parseGrid(l);
      expect(l.spawns.length).toBe(2);
      const keys = new Set<string>();
      for (const s of l.spawns) {
        const t = tileAt(p, s.x, s.y);
        expect(t, `spawn (${s.x},${s.y}) off grid`).toBeTruthy();
        expect(isWalkable((t as { type: TileType }).type)).toBe(true);
        keys.add(`${s.x},${s.y}`);
      }
      expect(keys.size).toBe(2);
    });

    it(`${l.id} reaches every station from both spawns`, () => {
      const p = parseGrid(l);
      for (const s of l.spawns) {
        const reached = reachableFrom(p, s.x, s.y);
        expect(unreachableStations(p, reached), `from spawn (${s.x},${s.y})`).toEqual([]);
      }
    });

    it(`${l.id} draws one plate per plates.count`, () => {
      const p = parseGrid(l);
      const plates = p.items.filter((i) => i && i.kind === 'plate').length;
      expect(plates).toBe(l.plates.count);
    });

    it(`${l.id} backs its recipes with crates`, () => {
      const p = parseGrid(l);
      for (const id of l.recipes) {
        const ingredient = id.replace('_soup', '') as IngredientType;
        expect(countCrate(p, ingredient), `${id} needs a ${ingredient} crate`).toBeGreaterThan(0);
      }
    });

    it(`${l.id} has non-decreasing star thresholds`, () => {
      for (const players of ['1', '2'] as const) {
        const [a, b, c] = l.stars[players];
        expect(a).toBeLessThan(b);
        expect(b).toBeLessThan(c);
      }
    });
  }
});

// ─── 1-1 Treacle Town ───────────────────────────────────────────────────────

describe('oc1-1-1', () => {
  const l = level('oc1-1-1');
  const p = parseGrid(l);

  it('is onion soup only, with prep time', () => {
    expect(l.recipes).toEqual(['onion_soup']);
    expect(l.timerStartsOnFirstServe).toBe(true);
    expect(l.timeLimitSec).toBe(150);
  });

  it('has exactly one stove with a pot', () => {
    expect(countType(p, 'stove')).toBe(1);
    const stove = p.tiles.find((t) => t.type === 'stove');
    expect(stove).toBeTruthy();
    const item = p.items[(stove as { y: number }).y * p.width + (stove as { x: number }).x];
    expect(item?.kind).toBe('pot');
  });

  it('washes plates: sink, drying rack next to it, and a plate return', () => {
    expect(l.plates.mode).toBe('sink');
    expect(countType(p, 'sink')).toBe(1);
    expect(countType(p, 'plateReturn')).toBeGreaterThan(0);
    const sink = p.tiles.find((t) => t.type === 'sink') as { x: number; y: number };
    const touchesDrying = ([[1, 0], [-1, 0], [0, 1], [0, -1]] as const)
      .some(([dx, dy]) => tileAt(p, sink.x + dx, sink.y + dy)?.type === 'drying');
    expect(touchesDrying).toBe(true);
  });

  it('has a serving counter, an onion crate, chopping boards and a bin', () => {
    expect(countType(p, 'serve')).toBeGreaterThan(0);
    expect(countCrate(p, 'onion')).toBe(1);
    expect(countCrate(p, 'tomato')).toBe(0);
    expect(countCrate(p, 'mushroom')).toBe(0);
    expect(countType(p, 'board')).toBe(2);
    expect(countType(p, 'trash')).toBe(1);
  });

  it('starts two clean plates on counters and one extinguisher', () => {
    expect(l.plates.count).toBe(2);
    expect(p.items.filter((i) => i && i.kind === 'plate').length).toBe(2);
    expect(p.items.filter((i) => i && i.kind === 'extinguisher').length).toBe(1);
  });

  it('splits the room with a counter that must be walked around on the right', () => {
    const midRow = 3;
    const solid = p.tiles.filter((t) => t.y === midRow && !isWalkable(t.type)).length;
    expect(solid).toBe(p.width - 2); // only the two right-hand tiles are open
    expect(isWalkable((tileAt(p, p.width - 3, midRow) as { type: TileType }).type)).toBe(true);
    expect(isWalkable((tileAt(p, p.width - 2, midRow) as { type: TileType }).type)).toBe(true);
  });

  it('has no dynamics', () => {
    expect(l.dynamics ?? []).toEqual([]);
  });
});

// ─── 1-2 crosswalk ──────────────────────────────────────────────────────────

describe('oc1-1-2', () => {
  const l = level('oc1-1-2');
  const p = parseGrid(l);

  it('is onion and tomato soup, four minutes, no prep time', () => {
    expect(new Set(l.recipes)).toEqual(new Set(['onion_soup', 'tomato_soup']));
    expect(l.timerStartsOnFirstServe).toBe(false);
    expect(l.timeLimitSec).toBe(240);
  });

  it('has a crosswalk of road tiles spanning the full height', () => {
    const roads = p.tiles.filter((t) => t.type === 'road');
    expect(roads.length).toBeGreaterThan(0);
    const columns = new Set(roads.map((t) => t.x));
    for (const x of columns) {
      const inColumn = roads.filter((t) => t.x === x).length;
      expect(inColumn, `road column ${x} does not span the grid`).toBe(p.height);
    }
  });

  it('has pedestrians whose lane endpoints sit on road tiles', () => {
    const walkers = (l.dynamics ?? []).filter((d) => d.type === 'pedestrians');
    expect(walkers.length).toBeGreaterThan(0);
    let lanes = 0;
    for (const d of walkers) {
      if (d.type !== 'pedestrians') continue;
      expect(d.intervalSec).toBeGreaterThan(0);
      expect(d.speed).toBeGreaterThan(0);
      for (const lane of d.lanes) {
        lanes++;
        expect(tileAt(p, lane.from.x, lane.from.y)?.type, `lane from ${JSON.stringify(lane.from)}`).toBe('road');
        expect(tileAt(p, lane.to.x, lane.to.y)?.type, `lane to ${JSON.stringify(lane.to)}`).toBe('road');
        expect(lane.from.x).toBe(lane.to.x); // pedestrians cross vertically
        expect(lane.from.y).not.toBe(lane.to.y);
      }
    }
    expect(lanes).toBeGreaterThanOrEqual(2);
    // walkers head both ways across the crossing
    const down = walkers.some((d) => d.type === 'pedestrians' && d.lanes.some((n) => n.to.y > n.from.y));
    const up = walkers.some((d) => d.type === 'pedestrians' && d.lanes.some((n) => n.to.y < n.from.y));
    expect(down && up).toBe(true);
  });

  it('has two stoves on the left and both crates on the right', () => {
    const stoves = p.tiles.filter((t) => t.type === 'stove');
    expect(stoves.length).toBe(2);
    const roadX = p.tiles.filter((t) => t.type === 'road').map((t) => t.x);
    const crossingLeft = Math.min(...roadX);
    const crossingRight = Math.max(...roadX);
    for (const s of stoves) expect(s.x).toBeLessThan(crossingLeft);
    expect(countCrate(p, 'tomato')).toBe(1);
    expect(countCrate(p, 'onion')).toBe(1);
    for (const c of p.tiles.filter((t) => t.type === 'crate')) expect(c.x).toBeGreaterThan(crossingRight);
  });

  it('keeps the sink and boards left, the serve and plate return right', () => {
    const roadX = p.tiles.filter((t) => t.type === 'road').map((t) => t.x);
    const crossingLeft = Math.min(...roadX);
    const crossingRight = Math.max(...roadX);
    expect(l.plates.mode).toBe('sink');
    for (const t of p.tiles.filter((x) => x.type === 'sink' || x.type === 'board' || x.type === 'drying')) {
      expect(t.x).toBeLessThan(crossingLeft);
    }
    for (const t of p.tiles.filter((x) => x.type === 'serve' || x.type === 'plateReturn')) {
      expect(t.x).toBeGreaterThan(crossingRight);
    }
  });

  it('starts two clean plates, one bin and one extinguisher', () => {
    expect(l.plates.count).toBe(2);
    expect(p.items.filter((i) => i && i.kind === 'plate').length).toBe(2);
    expect(countType(p, 'trash')).toBe(1);
    expect(p.items.filter((i) => i && i.kind === 'extinguisher').length).toBe(1);
  });
});

// ─── 1-3 Savoury Seas ───────────────────────────────────────────────────────

describe('oc1-1-3', () => {
  const l = level('oc1-1-3');
  const p = parseGrid(l);

  it('is three soups, four minutes, no prep time', () => {
    expect(new Set(l.recipes)).toEqual(new Set(['onion_soup', 'tomato_soup', 'mushroom_soup']));
    expect(l.timerStartsOnFirstServe).toBe(false);
    expect(l.timeLimitSec).toBe(240);
  });

  it('has no sink: clean plates come off a stack', () => {
    expect(l.plates.mode).toBe('stack');
    expect(countType(p, 'sink')).toBe(0);
    expect(countType(p, 'drying')).toBe(0);
    expect(countType(p, 'plateReturn')).toBe(1);
    const stacks = p.tiles.filter((t) => t.type === 'plateStack');
    expect(stacks.length).toBe(3);
    expect(l.plates.count).toBe(stacks.length);
    for (const s of stacks) expect(p.items[s.y * p.width + s.x]?.kind).toBe('plate');
  });

  it('has one crate of each ingredient', () => {
    expect(countType(p, 'crate')).toBe(3);
    expect(countCrate(p, 'onion')).toBe(1);
    expect(countCrate(p, 'tomato')).toBe(1);
    expect(countCrate(p, 'mushroom')).toBe(1);
  });

  it('has two stoves, two boards, a bin and an extinguisher', () => {
    expect(countType(p, 'stove')).toBe(2);
    expect(countType(p, 'board')).toBe(2);
    expect(countType(p, 'trash')).toBe(1);
    expect(p.items.filter((i) => i && i.kind === 'extinguisher').length).toBe(1);
  });

  it('backs every sliders group with slider tiles in one column', () => {
    const groups = (l.dynamics ?? []).filter((d) => d.type === 'sliders');
    expect(groups.length).toBe(2);
    const sliderGroups = new Set(p.tiles.filter((t) => t.type === 'slider').map((t) => t.group));
    expect(sliderGroups.size).toBe(groups.length);
    for (const d of groups) {
      if (d.type !== 'sliders') continue;
      const tiles = p.tiles.filter((t) => t.type === 'slider' && t.group === d.group);
      expect(tiles.length, `group ${d.group} has no tiles`).toBeGreaterThan(0);
      expect(new Set(tiles.map((t) => t.x)).size).toBe(1); // one divider column
      expect(d.axis).toBe('y');
      expect(d.amplitude).toBeGreaterThan(0);
      expect(d.periodSec).toBeGreaterThan(0);
      expect(sliderGroups.has(d.group)).toBe(true);
    }
    // the two segments run in opposite phase
    const phases = groups.map((d) => (d.type === 'sliders' ? d.phase ?? 0 : 0));
    expect(Math.abs(phases[0] - phases[1])).toBeCloseTo(0.5, 5);
  });

  it('leaves the bottom open so chefs can walk around the divider', () => {
    const bottom = p.tiles.filter((t) => t.y === p.height - 1);
    expect(bottom.every((t) => isWalkable(t.type))).toBe(true);
    // the divider column itself is sealed from row 0 to the crate row
    const sliderX = (p.tiles.find((t) => t.type === 'slider') as { x: number }).x;
    for (let y = 0; y < p.height - 1; y++) {
      expect(isWalkable((tileAt(p, sliderX, y) as { type: TileType }).type), `divider open at y=${y}`).toBe(false);
    }
  });

  it('has no pedestrians', () => {
    expect((l.dynamics ?? []).some((d) => d.type === 'pedestrians')).toBe(false);
  });
});

// ─── Order tuning ───────────────────────────────────────────────────────────
// The numbers the QA playtest settled on. The reasoning, the measured seconds per soup
// they came from and the star arithmetic are in docs/LEVELS.md. They are asserted
// exactly so that changing them stays a deliberate act.

describe('order tuning', () => {
  const expected: Record<string, { initial: number; intervalSec: number; max: number; timeSec: number }> = {
    'oc1-1-1': { initial: 2, intervalSec: 18, max: 4, timeSec: 60 },
    'oc1-1-2': { initial: 2, intervalSec: 26, max: 4, timeSec: 90 },
    'oc1-1-3': { initial: 2, intervalSec: 20, max: 4, timeSec: 85 },
  };

  for (const [id, orders] of Object.entries(expected)) {
    it(`${id} keeps its playtested order settings`, () => {
      expect(level(id).orders).toEqual(orders);
    });
  }

  for (const l of Object.values(LEVELS)) {
    it(`${l.id} leaves a ticket up long enough to be cooked`, () => {
      // A ticket has to outlive more than one arrival interval, or the queue fills with
      // orders that expire before anyone can reach the pot.
      expect(l.orders.timeSec).toBeGreaterThan((3 * l.orders.intervalSec) / 2);
      expect(l.orders.initial).toBeGreaterThan(0);
      expect(l.orders.initial).toBeLessThanOrEqual(l.orders.max);
    });
  }
});
