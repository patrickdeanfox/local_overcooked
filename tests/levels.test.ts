import { describe, expect, it } from 'vitest';
import { LEVELS, LEVEL_ORDER } from '../src/levels';
import { validateLevel, parseGrid } from '../src/levels/schema';

describe('levels', () => {
  const levels = Object.values(LEVELS);
  it('finds at least one level', () => { expect(levels.length).toBeGreaterThan(0); });
  it('orders levels by game, world, index', () => {
    expect(LEVEL_ORDER.length).toBe(levels.length);
    expect(LEVEL_ORDER[0]).toBe('oc1-1-1');
  });
  for (const level of levels) {
    it(`${level.id} validates`, () => { expect(validateLevel(level)).toEqual([]); });
    it(`${level.id} parses to a rectangular grid`, () => {
      const p = parseGrid(level);
      expect(p.tiles.length).toBe(p.width * p.height);
      expect(p.items.length).toBe(p.tiles.length);
    });
  }
});
