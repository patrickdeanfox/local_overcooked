import { describe, expect, it } from 'vitest';
import { LEVELS, LEVEL_ORDER } from '../src/levels';
import { isWalkable, parseGrid, validateLevel } from '../src/levels/schema';
import type { LevelDef, ParsedGrid } from '../src/levels/schema';
import { RECIPES } from '../src/sim/recipes';
import type { IngredientType, TileType, Ware } from '../src/sim/types';

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Tile types a chef must be able to stand next to for the level to be playable. The delivery
 *  door and the tray rack (docs/MECHANICS.md) join the list: a door nobody can reach never
 *  restocks, a rack nobody can reach never gives up its tray. */
const REQUIRED_ADJACENT: readonly TileType[] = ['crate', 'board', 'stove', 'serve', 'sink', 'delivery', 'trayRack'];

/** The four von Neumann neighbours, in the order the flood fills use them. */
const NEIGHBOURS = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const;

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

/**
 * Flood fill over walkable tiles. 'road' counts as walkable and sliders stay solid at rest.
 * 'gate' tiles (1-6's earthquake seam) are walkable while the gate is open, which is how
 * `isWalkable` reports them, so the default fill is the gate-open kitchen. Pass
 * `gatesClosed` to fill the kitchen at the moment the two halves are apart.
 */
function reachableFrom(p: ParsedGrid, sx: number, sy: number, gatesClosed = false): Set<number> {
  const open = (t: { type: TileType }) => isWalkable(t.type) && !(gatesClosed && t.type === 'gate');
  const seen = new Set<number>();
  const start = tileAt(p, sx, sy);
  if (!start || !open(start)) return seen;
  const queue: number[] = [sy * p.width + sx];
  seen.add(queue[0]);
  while (queue.length) {
    const i = queue.pop() as number;
    const x = i % p.width;
    const y = (i - x) / p.width;
    for (const [dx, dy] of NEIGHBOURS) {
      const n = tileAt(p, x + dx, y + dy);
      if (!n || !open(n)) continue;
      const ni = (y + dy) * p.width + (x + dx);
      if (seen.has(ni)) continue;
      seen.add(ni);
      queue.push(ni);
    }
  }
  return seen;
}

/** How many of a tile's four neighbours a chef can stand on. */
function walkableNeighbours(p: ParsedGrid, x: number, y: number): number {
  return NEIGHBOURS.filter(([dx, dy]) => {
    const n = tileAt(p, x + dx, y + dy);
    return !!n && isWalkable(n.type);
  }).length;
}

/** Stove tiles carrying the given cookware, as {x, y} pairs. */
function stovesWith(p: ParsedGrid, ware: Ware): { x: number; y: number }[] {
  return p.tiles.filter((t) => {
    if (t.type !== 'stove') return false;
    const item = p.items[t.y * p.width + t.x];
    return item?.kind === 'pot' && (item.ware ?? 'pot') === ware;
  }).map((t) => ({ x: t.x, y: t.y }));
}

/** True when the flood fill stands next to at least one tile of the type. */
function reachesType(p: ParsedGrid, reached: Set<number>, type: TileType): boolean {
  return p.tiles.some((t) => t.type === type && NEIGHBOURS.some(([dx, dy]) => {
    const n = tileAt(p, t.x + dx, t.y + dy);
    return !!n && isWalkable(n.type) && reached.has((t.y + dy) * p.width + (t.x + dx));
  }));
}

/** Station tiles the flood fill never gets next to, as 'type (x,y)' strings. */
function unreachableStations(p: ParsedGrid, reached: Set<number>): string[] {
  const bad: string[] = [];
  for (const t of p.tiles) {
    if (!REQUIRED_ADJACENT.includes(t.type)) continue;
    const touched = NEIGHBOURS.some(([dx, dy]) => {
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

  it('has the six Overcooked 1 world-1 levels', () => {
    expect(LEVEL_ORDER.slice(0, 6)).toEqual(['oc1-1-1', 'oc1-1-2', 'oc1-1-3', 'oc1-1-4', 'oc1-1-5', 'oc1-1-6']);
  });

  it('lists the games in campaign order: Overcooked 1, Overcooked 2, then the custom kitchens last', () => {
    const games = LEVEL_ORDER.map((id) => LEVELS[id].game);
    const firstOc2 = games.indexOf('oc2');
    const firstCustom = games.indexOf('custom');
    expect(firstOc2).toBeGreaterThan(0);
    expect(firstCustom).toBeGreaterThan(firstOc2);
    for (let i = 0; i < games.length; i++) {
      if (i < firstOc2) expect(games[i]).toBe('oc1');
      else if (i < firstCustom) expect(games[i]).toBe('oc2');
      else expect(games[i]).toBe('custom');
    }
  });

  it('gates count as walkable so a closed gate is the sim\'s job, not the grid\'s', () => {
    expect(isWalkable('gate')).toBe(true);
  });

  it('gates world 1 by a non-decreasing star total', () => {
    const world1 = LEVEL_ORDER.filter((id) => id.startsWith('oc1-1-')).map((id) => LEVELS[id]);
    const stars = world1.map((l) => l.unlockStars ?? 0);
    expect(stars).toEqual([0, 2, 4, 5, 6, 8]);
    for (let i = 1; i < stars.length; i++) expect(stars[i]).toBeGreaterThanOrEqual(stars[i - 1]);
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
      expect(l.theme.length).toBeGreaterThan(0);
      if (l.game === 'custom') {
        // The clone's own kitchens carry a title, not a world-index, and have no wiki page.
        expect(l.name.length).toBeGreaterThan(0);
        expect(l.source).toBeUndefined();
      } else {
        expect(l.name).toBe(`${l.world}-${l.index}`);
        expect(l.source).toMatch(/^https:\/\/overcooked\.fandom\.com\//);
      }
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

    it(`${l.id} reaches every station from the spawns together, and a serve and a crate from each`, () => {
      // A split kitchen (3-2) shares the work over a counter, so each chef needs a serve and the
      // crates, and the two reaches together must cover every station.
      const p = parseGrid(l);
      const union = new Set<number>();
      for (const s of l.spawns) {
        const reached = reachableFrom(p, s.x, s.y);
        for (const i of reached) union.add(i);
        expect(reachesType(p, reached, 'serve'), `no serve from spawn (${s.x},${s.y})`).toBe(true);
        expect(reachesType(p, reached, 'crate'), `no crate from spawn (${s.x},${s.y})`).toBe(true);
      }
      expect(unreachableStations(p, union)).toEqual([]);
    });

    it(`${l.id} keeps every extinguisher within reach of a walkable tile`, () => {
      const p = parseGrid(l);
      p.items.forEach((item, i) => {
        if (!item || item.kind !== 'extinguisher') return;
        const t = p.tiles[i];
        const reachable = ([[1, 0], [-1, 0], [0, 1], [0, -1]] as const)
          .some(([dx, dy]) => { const n = tileAt(p, t.x + dx, t.y + dy); return !!n && isWalkable(n.type); });
        expect(reachable, `extinguisher at (${t.x},${t.y}) has no walkable neighbour`).toBe(true);
      });
    });

    it(`${l.id} draws one plate per plates.count`, () => {
      const p = parseGrid(l);
      const plates = p.items.filter((i) => i && i.kind === 'plate').length;
      expect(plates).toBe(l.plates.count);
    });

    it(`${l.id} backs its recipes with crates`, () => {
      const p = parseGrid(l);
      for (const id of l.recipes) {
        const recipe = RECIPES[id];
        expect(recipe, `unknown recipe ${id}`).toBeTruthy();
        for (const ingredient of new Set(recipe.ingredients)) {
          expect(countCrate(p, ingredient), `${id} needs a ${ingredient} crate`).toBeGreaterThan(0);
        }
      }
    });

    it(`${l.id} has non-decreasing star thresholds`, () => {
      for (const players of ['1', '2'] as const) {
        const [a, b, c] = l.stars[players];
        expect(a).toBeLessThan(b);
        expect(b).toBeLessThan(c);
      }
    });

    // Mechanics tiles (docs/MECHANICS.md): what makes each one usable.
    it(`${l.id} gives every delivery door a walkable neighbour`, () => {
      const p = parseGrid(l);
      for (const t of p.tiles.filter((x) => x.type === 'delivery')) {
        expect(walkableNeighbours(p, t.x, t.y), `delivery (${t.x},${t.y}) has no walkable neighbour`).toBeGreaterThan(0);
      }
    });

    it(`${l.id} starts a tray on every tray rack`, () => {
      const p = parseGrid(l);
      for (const t of p.tiles.filter((x) => x.type === 'trayRack')) {
        expect(p.items[t.y * p.width + t.x]?.kind, `rack (${t.x},${t.y}) has no tray`).toBe('tray');
      }
      const trays = p.items.filter((i) => i && i.kind === 'tray').length;
      expect(trays).toBe(countType(p, 'trayRack'));
    });

    it(`${l.id} makes every shelf pass through: walkable tiles on two opposite sides`, () => {
      const p = parseGrid(l);
      for (const t of p.tiles.filter((x) => x.type === 'shelf')) {
        const open = (dx: number, dy: number) => { const n = tileAt(p, t.x + dx, t.y + dy); return !!n && isWalkable(n.type); };
        const across = (open(1, 0) && open(-1, 0)) || (open(0, 1) && open(0, -1));
        expect(across, `shelf (${t.x},${t.y}) is not open on two opposite sides`).toBe(true);
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

// ─── 1-4 Treacle Town burgers ───────────────────────────────────────────────
// Two sectors joined by one 1x3 corridor. Columns 5-7 are the dividing counter block;
// the corridor is the single row that is walkable across all three of them.

describe('oc1-1-4', () => {
  const l = level('oc1-1-4');
  const p = parseGrid(l);
  const DIVIDER_X = [5, 6, 7] as const;

  it('is the three burgers, four minutes, no prep time', () => {
    expect(new Set(l.recipes)).toEqual(new Set(['meat_burger', 'lettuce_burger', 'tomato_lettuce_burger']));
    expect(l.timerStartsOnFirstServe).toBe(false);
    expect(l.timeLimitSec).toBe(240);
    expect(l.unlockStars).toBe(5);
  });

  it('has four pans on burners and no pots', () => {
    expect(stovesWith(p, 'pan').length).toBe(4);
    expect(stovesWith(p, 'pot').length).toBe(0);
  });

  it('starts five clean plates, the most of any level', () => {
    expect(l.plates.mode).toBe('sink');
    expect(l.plates.count).toBe(5);
    expect(p.items.filter((i) => i && i.kind === 'plate').length).toBe(5);
  });

  it('has a crate for every burger ingredient', () => {
    expect(countCrate(p, 'meat')).toBe(1);
    expect(countCrate(p, 'bun')).toBe(1);
    expect(countCrate(p, 'lettuce')).toBe(1);
    expect(countCrate(p, 'tomato')).toBe(1);
    expect(countType(p, 'crate')).toBe(4);
  });

  it('washes plates and has boards, a bin and a serving counter', () => {
    expect(countType(p, 'sink')).toBe(1);
    expect(countType(p, 'drying')).toBe(1);
    expect(countType(p, 'plateReturn')).toBe(1);
    expect(countType(p, 'board')).toBe(2);
    expect(countType(p, 'trash')).toBe(1);
    expect(countType(p, 'serve')).toBe(2);
  });

  it('joins the two sectors through exactly one 3-tile corridor', () => {
    const openRows: number[] = [];
    for (let y = 0; y < p.height; y++) {
      const open = DIVIDER_X.filter((x) => isWalkable((tileAt(p, x, y) as { type: TileType }).type)).length;
      expect(open === 0 || open === DIVIDER_X.length, `row ${y} is half open across the divider`).toBe(true);
      if (open === DIVIDER_X.length) openRows.push(y);
    }
    expect(openRows.length, 'exactly one corridor row').toBe(1);
  });

  it('has no other way round the divider', () => {
    // Seal the corridor row on a throwaway copy and the two sectors must fall apart.
    const sealed = parseGrid(l);
    const corridorY = sealed.tiles.find((t) => t.type === 'floor' && DIVIDER_X.includes(t.x as 5 | 6 | 7))?.y as number;
    for (const x of DIVIDER_X) (tileAt(sealed, x, corridorY) as { type: TileType }).type = 'counter';
    const left = reachableFrom(sealed, l.spawns[0].x, l.spawns[0].y);
    expect(left.has(l.spawns[1].y * sealed.width + l.spawns[1].x)).toBe(false);
  });

  it('keeps the crates, sink, boards and bin left of the divider', () => {
    for (const t of p.tiles.filter((x) => ['crate', 'sink', 'drying', 'board', 'trash'].includes(x.type))) {
      expect(t.x, `${t.type} (${t.x},${t.y}) should be in the left sector`).toBeLessThan(DIVIDER_X[0]);
    }
    for (const t of p.tiles.filter((x) => ['stove', 'serve', 'plateReturn'].includes(x.type))) {
      expect(t.x, `${t.type} (${t.x},${t.y}) should be in the right sector`).toBeGreaterThan(DIVIDER_X[2]);
    }
  });

  it('has no dynamics', () => {
    expect(l.dynamics ?? []).toEqual([]);
  });

  it('takes deliveries at a door on the left wall under the crates, with six-item crates', () => {
    expect(tileAt(p, 0, 5)?.type).toBe('delivery');
    expect(countType(p, 'delivery')).toBe(1);
    expect(l.eightySix).toEqual({ crateSize: 6, restockDelaySec: 30 });
    // Bun and meat are in every burger, so the 86 system exempts them by itself; only lettuce and
    // tomato ever run out, and each shortage has a substitute recipe on the level.
    for (const id of l.recipes) expect(RECIPES[id].ingredients).toEqual(expect.arrayContaining(['bun', 'meat']));
  });
});

// ─── 1-5 the ring ───────────────────────────────────────────────────────────

describe('oc1-1-5', () => {
  const l = level('oc1-1-5');
  const p = parseGrid(l);

  it('is three soups, four minutes, no prep time', () => {
    expect(new Set(l.recipes)).toEqual(new Set(['onion_soup', 'tomato_soup', 'mushroom_soup']));
    expect(l.timerStartsOnFirstServe).toBe(false);
    expect(l.timeLimitSec).toBe(240);
    expect(l.unlockStars).toBe(6);
  });

  it('is a one-tile-wide corridor everywhere', () => {
    const floor = p.tiles.filter((t) => isWalkable(t.type));
    expect(floor.length).toBeGreaterThan(0);
    for (const t of floor) {
      expect(walkableNeighbours(p, t.x, t.y), `floor (${t.x},${t.y}) is wider than one tile`).toBeLessThanOrEqual(2);
    }
  });

  it('closes the ring: every floor tile is on one loop', () => {
    const floor = p.tiles.filter((t) => isWalkable(t.type));
    // A closed loop has no ends: every tile has exactly two walkable neighbours...
    for (const t of floor) expect(walkableNeighbours(p, t.x, t.y)).toBe(2);
    // ...and one fill covers all of it.
    const reached = reachableFrom(p, l.spawns[0].x, l.spawns[0].y);
    expect(reached.size).toBe(floor.length);
  });

  it('has three pots on burners and no pans', () => {
    expect(stovesWith(p, 'pot').length).toBe(3);
    expect(stovesWith(p, 'pan').length).toBe(0);
  });

  it('puts the crates upper-left, the boards lower-left, the pots lower-right, the sink upper-right', () => {
    const midX = (p.width - 1) / 2;
    const midY = (p.height - 1) / 2;
    for (const t of p.tiles.filter((x) => x.type === 'crate')) {
      expect(t.x).toBeLessThan(midX);
      expect(t.y).toBeLessThan(midY);
    }
    for (const t of p.tiles.filter((x) => x.type === 'board')) {
      expect(t.x).toBeLessThan(midX);
      expect(t.y).toBeGreaterThan(midY);
    }
    for (const t of p.tiles.filter((x) => x.type === 'stove')) {
      expect(t.x).toBeGreaterThan(midX);
      expect(t.y).toBeGreaterThan(midY);
    }
    for (const t of p.tiles.filter((x) => x.type === 'sink' || x.type === 'drying')) {
      expect(t.x).toBeGreaterThan(midX);
      expect(t.y).toBeLessThan(midY);
    }
  });

  it('starts three clean plates and washes them at a sink', () => {
    expect(l.plates.mode).toBe('sink');
    expect(l.plates.count).toBe(3);
    expect(countType(p, 'sink')).toBe(1);
    expect(countType(p, 'drying')).toBe(1);
    expect(countType(p, 'plateReturn')).toBe(1);
  });

  it('has no dynamics', () => {
    expect(l.dynamics ?? []).toEqual([]);
  });

  it('keeps the tray rack on the island\'s right face, halfway round from the crates', () => {
    const racks = p.tiles.filter((t) => t.type === 'trayRack');
    expect(racks.map((t) => [t.x, t.y])).toEqual([[11, 3]]);
    expect(p.items[3 * p.width + 11]?.kind).toBe('tray');
    // Not next to any crate: the spec's rule for a rack that is a decision rather than a default.
    for (const c of p.tiles.filter((t) => t.type === 'crate')) {
      expect(Math.abs(c.x - 11) + Math.abs(c.y - 3)).toBeGreaterThan(1);
    }
    // Still one closed ring: the rack replaced a counter, not a floor tile.
    for (const t of p.tiles.filter((x) => isWalkable(x.type))) expect(walkableNeighbours(p, t.x, t.y)).toBe(2);
  });

  it('takes deliveries beside the crates, with six-item crates', () => {
    expect(tileAt(p, 4, 0)?.type).toBe('delivery');
    expect(countType(p, 'delivery')).toBe(1);
    expect(l.eightySix).toEqual({ crateSize: 6, restockDelaySec: 30 });
  });
});

// ─── 1-6 the earthquake ─────────────────────────────────────────────────────

describe('oc1-1-6', () => {
  const l = level('oc1-1-6');
  const p = parseGrid(l);

  it('is the three burgers, four minutes, no prep time', () => {
    expect(new Set(l.recipes)).toEqual(new Set(['meat_burger', 'lettuce_burger', 'tomato_lettuce_burger']));
    expect(l.timerStartsOnFirstServe).toBe(false);
    expect(l.timeLimitSec).toBe(240);
    expect(l.unlockStars).toBe(8);
  });

  it('has one gate dynamic backed by a single column of gate tiles', () => {
    const gates = (l.dynamics ?? []).filter((d) => d.type === 'gate');
    expect(gates.length).toBe(1);
    const gate = gates[0];
    if (gate.type !== 'gate') throw new Error('not a gate');
    expect(gate.group).toBe('1');
    expect(gate.openSec).toBeGreaterThan(0);
    expect(gate.openSec).toBeLessThan(gate.periodSec);
    const tiles = p.tiles.filter((t) => t.type === 'gate');
    expect(tiles.length).toBeGreaterThan(0);
    for (const t of tiles) expect(t.group).toBe(gate.group);
    expect(new Set(tiles.map((t) => t.x)).size, 'the seam is one column').toBe(1);
  });

  it('splits the kitchen in two the moment the gate closes', () => {
    const seamX = (p.tiles.find((t) => t.type === 'gate') as { x: number }).x;
    const [left, right] = l.spawns;
    expect(left.x).toBeLessThan(seamX);
    expect(right.x).toBeGreaterThan(seamX);
    // Gate open: one kitchen.
    expect(reachableFrom(p, left.x, left.y).has(right.y * p.width + right.x)).toBe(true);
    // Gate closed: two kitchens, and neither can touch the other side's stations.
    const lowSide = reachableFrom(p, left.x, left.y, true);
    expect(lowSide.has(right.y * p.width + right.x)).toBe(false);
    for (const t of p.tiles) {
      if (!REQUIRED_ADJACENT.includes(t.type) || t.x < seamX) continue;
      const touched = NEIGHBOURS.some(([dx, dy]) => lowSide.has((t.y + dy) * p.width + (t.x + dx)));
      expect(touched, `${t.type} (${t.x},${t.y}) is still reachable across the closed seam`).toBe(false);
    }
  });

  it('has four pans, one on the low side and three on the high side', () => {
    const seamX = (p.tiles.find((t) => t.type === 'gate') as { x: number }).x;
    const pans = stovesWith(p, 'pan');
    expect(pans.length).toBe(4);
    expect(pans.filter((s) => s.x < seamX).length).toBe(1);
    expect(pans.filter((s) => s.x > seamX).length).toBe(3);
    expect(stovesWith(p, 'pot').length).toBe(0);
  });

  it('keeps the bun crate on the high side and the rest on the low side', () => {
    const seamX = (p.tiles.find((t) => t.type === 'gate') as { x: number }).x;
    const buns = p.tiles.filter((t) => t.type === 'crate' && t.ingredient === 'bun');
    expect(buns.length).toBe(1);
    expect(buns[0].x).toBeGreaterThan(seamX);
    for (const ingredient of ['meat', 'tomato', 'lettuce'] as const) {
      const crates = p.tiles.filter((t) => t.type === 'crate' && t.ingredient === ingredient);
      expect(crates.length, `one ${ingredient} crate`).toBe(1);
      expect(crates[0].x, `${ingredient} crate is on the low side`).toBeLessThan(seamX);
    }
    for (const t of p.tiles.filter((x) => ['sink', 'drying', 'board', 'trash'].includes(x.type))) {
      expect(t.x, `${t.type} (${t.x},${t.y}) is on the low side`).toBeLessThan(seamX);
    }
    for (const t of p.tiles.filter((x) => x.type === 'serve' || x.type === 'plateReturn')) {
      expect(t.x, `${t.type} (${t.x},${t.y}) is on the high side`).toBeGreaterThan(seamX);
    }
  });

  it('starts three clean plates, all on the high side', () => {
    const seamX = (p.tiles.find((t) => t.type === 'gate') as { x: number }).x;
    expect(l.plates.mode).toBe('sink');
    expect(l.plates.count).toBe(3);
    const plates = p.items
      .map((item, i) => ({ item, x: i % p.width }))
      .filter((e) => e.item && e.item.kind === 'plate');
    expect(plates.length).toBe(3);
    for (const e of plates) expect(e.x).toBeGreaterThan(seamX);
  });
});

// ─── Order tuning ───────────────────────────────────────────────────────────
// The numbers the QA playtest settled on. The reasoning, the measured seconds per soup
// they came from and the star arithmetic are in docs/LEVELS.md. They are asserted
// exactly so that changing them stays a deliberate act.

// ─── 3-2 Savoury Seas, the split deck ───────────────────────────────────────

describe('oc1-3-2', () => {
  const l = level('oc1-3-2');
  const p = parseGrid(l);

  it('is the three soups on a deck with clean plates and no sink', () => {
    expect(l.recipes).toEqual(['onion_soup', 'tomato_soup', 'mushroom_soup']);
    expect(l.plates).toEqual({ mode: 'stack', count: 3 });
    expect(countType(p, 'sink')).toBe(0);
    expect(countType(p, 'plateStack')).toBe(1);
    expect(tileAt(p, 5, 0)?.type).toBe('plateStack');
    expect(p.items[5]).toBeNull(); // the plate return starts empty; the three plates sit on the south counter
    expect(countType(p, 'serve')).toBe(2);
    expect(stovesWith(p, 'pot').length).toBe(4);
    expect(l.unlockStars).toBe(23);
  });

  it('splits the deck in two halves joined only over the divider counter', () => {
    const port = reachableFrom(p, 4, 5);
    const starboard = reachableFrom(p, 11, 5);
    for (const i of port) expect(starboard.has(i)).toBe(false);
    expect(reachesType(p, port, 'board')).toBe(true);
    expect(reachesType(p, starboard, 'board')).toBe(false);
    for (const crate of p.tiles.filter((t) => t.type === 'crate')) {
      expect(crate.x).toBe(7);
      expect(port.has(crate.y * p.width + 6)).toBe(true);
      expect(starboard.has(crate.y * p.width + 8)).toBe(true);
    }
    expect(reachesType(p, port, 'serve')).toBe(true);
    expect(reachesType(p, starboard, 'serve')).toBe(true);
    expect(reachesType(p, port, 'plateStack')).toBe(true);
    expect(reachesType(p, starboard, 'plateStack')).toBe(false);
  });

  it('keeps the two cargo grates as solid holes, not fall hazards', () => {
    for (const [x, y] of [[3, 1], [4, 1], [3, 2], [4, 2], [9, 4], [10, 4], [9, 5], [10, 5]]) {
      expect(tileAt(p, x, y)?.type, `(${x},${y})`).toBe('void');
    }
    expect(countType(p, 'gap')).toBe(0);
  });
});

// ─── Overcooked 2 1-1, Sushi City ───────────────────────────────────────────

describe('oc2-1-1', () => {
  const l = level('oc2-1-1');
  const p = parseGrid(l);

  it('is sashimi only, with prep time and four clean plates', () => {
    expect(l.recipes).toEqual(['fish_sashimi', 'prawn_sashimi']);
    expect(l.timerStartsOnFirstServe).toBe(true);
    expect(l.timeLimitSec).toBe(150);
    expect(l.unlockStars).toBe(1);
    expect(l.plates).toEqual({ mode: 'stack', count: 4 });
    expect(countType(p, 'sink')).toBe(0);
    expect(countType(p, 'stove')).toBe(0);
    expect(tileAt(p, 9, 2)?.type).toBe('plateStack');
    expect(p.items[2 * p.width + 9]).toBeNull(); // the return starts empty; the plates are on the islands
    expect(tileAt(p, 9, 1)?.type).toBe('serve');
  });

  it('keeps the crates on opposite walls and the boards in the bottom corners', () => {
    expect(tileAt(p, 0, 3)).toMatchObject({ type: 'crate', ingredient: 'fish' });
    expect(tileAt(p, 9, 3)).toMatchObject({ type: 'crate', ingredient: 'prawn' });
    expect(countCrate(p, 'fish')).toBe(1);
    expect(countCrate(p, 'prawn')).toBe(1);
    expect(p.tiles.filter((t) => t.type === 'board').map((t) => [t.x, t.y])).toEqual([[1, 7], [2, 7], [7, 7], [8, 7]]);
    expect(p.tiles.filter((t) => p.items[t.y * p.width + t.x]?.kind === 'plate').map((t) => [t.x, t.y]))
      .toEqual([[2, 3], [3, 3], [6, 3], [7, 3]]);
  });

  it('sorts after every Overcooked 1 level', () => {
    const at = LEVEL_ORDER.indexOf('oc2-1-1');
    for (const id of LEVEL_ORDER.filter((x) => LEVELS[x].game === 'oc1')) expect(LEVEL_ORDER.indexOf(id)).toBeLessThan(at);
  });

  it('takes deliveries at a door on the left wall, with six-item crates', () => {
    expect(tileAt(p, 0, 5)?.type).toBe('delivery');
    expect(countType(p, 'delivery')).toBe(1);
    expect(l.eightySix).toEqual({ crateSize: 6, restockDelaySec: 25 });
  });
});

// ─── The mechanics kitchens (docs/MECHANICS.md) ─────────────────────────────
// Three custom levels, one per layout-dependent mechanic. Each must also play with every
// mechanic off: a shelf becomes a wall, the rack a counter, the crates never run out.

describe('custom-1-1 Hatch Row', () => {
  const l = level('custom-1-1');
  const p = parseGrid(l);
  const WALL_X = 7;

  it('is three soups with prep on the left and cooking on the right', () => {
    expect(l.name).toBe('Hatch Row');
    expect(new Set(l.recipes)).toEqual(new Set(['onion_soup', 'tomato_soup', 'mushroom_soup']));
    expect(l.plates).toEqual({ mode: 'sink', count: 3 });
    for (const t of p.tiles.filter((x) => ['crate', 'board', 'trash'].includes(x.type))) expect(t.x).toBeLessThan(WALL_X);
    for (const t of p.tiles.filter((x) => ['stove', 'serve', 'sink', 'drying', 'plateReturn'].includes(x.type))) expect(t.x).toBeGreaterThan(WALL_X);
    expect(l.spawns[0].x).toBeLessThan(WALL_X);
    expect(l.spawns[1].x).toBeGreaterThan(WALL_X);
    expect(l.eightySix).toBeUndefined();
  });

  it('divides the rooms with a wall of three hatches and one floor gap at the bottom end', () => {
    const column = Array.from({ length: p.height }, (_, y) => tileAt(p, WALL_X, y)?.type);
    expect(column.filter((t) => t === 'shelf').length).toBe(3);
    expect(column.filter((t) => t === 'floor').length).toBe(1);
    expect(column[p.height - 2]).toBe('floor');
    for (let y = 1; y < p.height - 1; y++) expect(['shelf', 'void', 'floor']).toContain(column[y]);
    expect(p.tiles.filter((t) => t.type === 'shelf').map((t) => [t.x, t.y])).toEqual([[7, 2], [7, 3], [7, 4]]);
  });

  it('keeps the long way round when the hatches are walls', () => {
    // Every mechanic off turns the shelves solid; the gap must still join the rooms.
    const sealed = parseGrid(l);
    for (const t of sealed.tiles) if (t.type === 'shelf') t.type = 'void';
    const left = reachableFrom(sealed, l.spawns[0].x, l.spawns[0].y);
    expect(left.has(l.spawns[1].y * sealed.width + l.spawns[1].x)).toBe(true);
    expect(unreachableStations(sealed, left)).toEqual([]);
    // ...and the walk from a board to the nearest stove is long enough for the hatch to matter.
    const board = p.tiles.find((t) => t.type === 'board') as { x: number; y: number };
    const stove = p.tiles.find((t) => t.type === 'stove') as { x: number; y: number };
    expect(Math.abs(board.x - stove.x) + Math.abs(board.y - stove.y)).toBeGreaterThanOrEqual(10);
  });
});

describe('custom-1-2 Long Haul', () => {
  const l = level('custom-1-2');
  const p = parseGrid(l);

  it('is the three burgers in a two-tile corridor the full 16 tiles wide', () => {
    expect(l.name).toBe('Long Haul');
    expect(new Set(l.recipes)).toEqual(new Set(['meat_burger', 'lettuce_burger', 'tomato_lettuce_burger']));
    expect(p.width).toBe(16);
    const floorRows = new Set(p.tiles.filter((t) => isWalkable(t.type)).map((t) => t.y));
    expect(floorRows.size).toBe(2);
    for (const y of floorRows) expect(p.tiles.filter((t) => t.y === y && isWalkable(t.type)).length).toBe(14);
  });

  it('puts the crates and the door at the left end and the pans and the serve at the right', () => {
    for (const t of p.tiles.filter((x) => x.type === 'crate' || x.type === 'delivery')) expect(t.x).toBeLessThanOrEqual(5);
    expect(tileAt(p, 1, 0)?.type).toBe('delivery');
    expect(stovesWith(p, 'pan').length).toBe(2);
    for (const s of stovesWith(p, 'pan')) expect(s.x).toBeGreaterThanOrEqual(12);
    for (const t of p.tiles.filter((x) => x.type === 'serve' || x.type === 'plateReturn')) expect(t.x).toBe(15);
    const crateX = Math.max(...p.tiles.filter((t) => t.type === 'crate').map((t) => t.x));
    const panX = Math.min(...stovesWith(p, 'pan').map((s) => s.x));
    expect(panX - crateX).toBeGreaterThanOrEqual(7);
  });

  it('hangs the tray rack in the middle of the run, away from every crate', () => {
    const racks = p.tiles.filter((t) => t.type === 'trayRack');
    expect(racks.map((t) => [t.x, t.y])).toEqual([[8, 3]]);
    expect(p.items[3 * p.width + 8]?.kind).toBe('tray');
    for (const c of p.tiles.filter((t) => t.type === 'crate')) expect(Math.abs(c.x - 8) + Math.abs(c.y - 3)).toBeGreaterThan(2);
    expect(Math.abs(8 - (p.width - 1) / 2)).toBeLessThanOrEqual(1);
  });

  it('runs small crates with a quick restock', () => {
    expect(l.eightySix).toEqual({ crateSize: 5, restockDelaySec: 25 });
    expect(l.plates).toEqual({ mode: 'sink', count: 3 });
  });
});

describe('custom-1-3 Short Order', () => {
  const l = level('custom-1-3');
  const p = parseGrid(l);

  it('is three soups and fish sashimi in a compact room', () => {
    expect(l.name).toBe('Short Order');
    expect(new Set(l.recipes)).toEqual(new Set(['onion_soup', 'tomato_soup', 'mushroom_soup', 'fish_sashimi']));
    expect(p.width).toBeLessThanOrEqual(12);
    expect(countCrate(p, 'fish')).toBe(1);
    expect(stovesWith(p, 'pot').length).toBe(2);
    expect(l.plates).toEqual({ mode: 'sink', count: 3 });
  });

  it('scripts an onion shortage at 40 s and a fish shortage at 90 s, delivered through one door', () => {
    expect(l.eightySix).toEqual({
      crateSize: 4,
      restockDelaySec: 35,
      scripted: [{ atSec: 40, ingredient: 'onion' }, { atSec: 90, ingredient: 'fish' }],
    });
    expect(tileAt(p, 6, 0)?.type).toBe('delivery');
    expect(countType(p, 'delivery')).toBe(1);
    // Every scripted shortage has a substitute: no ingredient is in every recipe.
    for (const s of l.eightySix?.scripted ?? []) {
      expect(l.recipes.some((id) => !RECIPES[id].ingredients.includes(s.ingredient))).toBe(true);
    }
  });

  it('puts the drying rack across the room from the serve and the boards side by side', () => {
    const drying = p.tiles.find((t) => t.type === 'drying') as { x: number; y: number };
    const serve = p.tiles.filter((t) => t.type === 'serve');
    for (const v of serve) expect(Math.abs(v.x - drying.x)).toBeGreaterThanOrEqual(10);
    const boards = p.tiles.filter((t) => t.type === 'board').map((t) => [t.x, t.y]);
    expect(boards).toEqual([[3, 7], [4, 7]]);
  });
});

describe('order tuning', () => {
  const expected: Record<string, { initial: number; intervalSec: number; max: number; timeSec: number }> = {
    'oc1-1-1': { initial: 2, intervalSec: 18, max: 4, timeSec: 60 },
    'oc1-1-2': { initial: 2, intervalSec: 26, max: 4, timeSec: 90 },
    'oc1-1-3': { initial: 2, intervalSec: 20, max: 4, timeSec: 85 },
    // Burgers are a longer dish than soup, so the burger kitchens keep a longer ticket life
    // than the soup ones. 1-4's drip was measured down from 24 s to 20 s because at 24 s the
    // ticket supply, not the kitchen, capped the score short of three stars: see
    // "World 1 playtest" in docs/LEVELS.md.
    'oc1-1-4': { initial: 2, intervalSec: 20, max: 4, timeSec: 100 },
    'oc1-1-5': { initial: 2, intervalSec: 20, max: 4, timeSec: 85 },
    'oc1-1-6': { initial: 2, intervalSec: 24, max: 4, timeSec: 100 },
    // 3-2 is the 1-3 deck again with the same soups; the catalog's estimate, untested.
    'oc1-3-2': { initial: 2, intervalSec: 22, max: 4, timeSec: 95 },
    // Overcooked 2's first level: one chop per dish, so a quick drip; the catalog's estimate, untested.
    'oc2-1-1': { initial: 2, intervalSec: 18, max: 4, timeSec: 60 },
    // The mechanics kitchens (docs/MECHANICS.md): estimates from the nearest shipped level, untested.
    'custom-1-1': { initial: 2, intervalSec: 22, max: 4, timeSec: 90 },   // soups with a long walk, like 1-5
    'custom-1-2': { initial: 2, intervalSec: 24, max: 4, timeSec: 110 },  // burgers down a corridor, like 1-6's drip
    'custom-1-3': { initial: 2, intervalSec: 18, max: 4, timeSec: 80 },   // one-chop sashimi keeps the drip quick
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
