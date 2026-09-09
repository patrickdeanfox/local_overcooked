import { describe, expect, it } from 'vitest';
import type Phaser from 'phaser';
import { ALL_TEXTURE_KEYS, TEX, TEXTURE_SIZES, generateTextures } from '../src/art';
import { PALETTE, PALETTE_INT, hexToInt } from '../src/art/palette';

// ─── Canvas / scene doubles ─────────────────────────────────────────────────
// There is no browser in the test run, so the drawing code runs against a
// recording stub. That still exercises every path in every draw function, which
// is what catches a bad shape call or a missing helper.

interface FakeTexture {
  key: string;
  width: number;
  height: number;
  ops: number;
}

function createMockContext(counter: { ops: number }): CanvasRenderingContext2D {
  const gradient = { addColorStop: (): void => {} };
  const state: Record<string, unknown> = {
    globalAlpha: 1, fillStyle: '#000000', strokeStyle: '#000000', lineWidth: 1,
    font: '', textAlign: 'center', textBaseline: 'middle', lineCap: 'butt', lineJoin: 'miter',
  };
  const handler: ProxyHandler<Record<string, unknown>> = {
    get(obj, prop) {
      if (prop === 'createLinearGradient' || prop === 'createRadialGradient') return () => gradient;
      if (prop === 'measureText') return () => ({ width: 10 });
      if (prop in obj) return obj[prop as string];
      return (): void => { counter.ops++; };
    },
    set(obj, prop, value) {
      obj[prop as string] = value;
      return true;
    },
  };
  return new Proxy(state, handler) as unknown as CanvasRenderingContext2D;
}

function createMockScene(): { scene: Phaser.Scene; made: Map<string, FakeTexture>; creates: number } {
  const made = new Map<string, FakeTexture>();
  const box = { creates: 0 };
  const textures = {
    exists: (key: string): boolean => made.has(key),
    createCanvas: (key: string, width: number, height: number) => {
      box.creates++;
      const counter = { ops: 0 };
      const record: FakeTexture = { key, width, height, ops: 0 };
      made.set(key, record);
      const ctx = createMockContext(counter);
      return {
        getContext: (): CanvasRenderingContext2D => ctx,
        refresh: (): void => { record.ops = counter.ops; },
      };
    },
  };
  const scene = { textures } as unknown as Phaser.Scene;
  return { scene, made, get creates(): number { return box.creates; } };
}

// ─── Key contract ───────────────────────────────────────────────────────────

describe('texture keys', () => {
  it('has no duplicates', () => {
    const keys = ALL_TEXTURE_KEYS();
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('covers the keys presentation looks up by helper', () => {
    const keys = ALL_TEXTURE_KEYS();
    expect(keys).toContain(TEX.chef(0, 'down'));
    expect(keys).toContain(TEX.crate('onion'));
    expect(keys).toContain(TEX.buttonPrompt('Cross'));
  });
});

// ─── Palette ────────────────────────────────────────────────────────────────

describe('palette', () => {
  it('has no duplicate names', () => {
    const names = Object.keys(PALETTE);
    expect(new Set(names).size).toBe(names.length);
  });

  it('is all 6-digit hex and mirrors into PALETTE_INT', () => {
    for (const [name, value] of Object.entries(PALETTE)) {
      expect(value, name).toMatch(/^#[0-9a-f]{6}$/);
      expect(PALETTE_INT[name as keyof typeof PALETTE]).toBe(hexToInt(value));
    }
  });
});

// ─── Generation ─────────────────────────────────────────────────────────────

describe('generateTextures', () => {
  it('creates every contract key at the contract size and draws into each one', () => {
    const { scene, made } = createMockScene();
    generateTextures(scene);

    for (const key of ALL_TEXTURE_KEYS()) {
      const tex = made.get(key);
      expect(tex, key).toBeDefined();
      expect(tex!.ops, key).toBeGreaterThan(0);
    }
    for (const [key, tex] of made) {
      if (key.startsWith('tile.')) expect([tex.width, tex.height], key).toEqual([TEXTURE_SIZES.tile, TEXTURE_SIZES.tile]);
      if (key.startsWith('chef.')) expect([tex.width, tex.height], key).toEqual([TEXTURE_SIZES.chefW, TEXTURE_SIZES.chefH]);
      if (key.startsWith('icon.')) expect([tex.width, tex.height], key).toEqual([TEXTURE_SIZES.icon, TEXTURE_SIZES.icon]);
      if (key.startsWith('item.')) expect([tex.width, tex.height], key).toEqual([TEXTURE_SIZES.item, TEXTURE_SIZES.item]);
    }
    expect(made.get(TEX.orderCard)!.width).toBe(TEXTURE_SIZES.orderCardW);
    expect(made.get(TEX.panel)!.height).toBe(TEXTURE_SIZES.panelH);
    expect([made.get(TEX.uiBackdrop)!.width, made.get(TEX.uiBackdrop)!.height]).toEqual([TEXTURE_SIZES.backdropW, TEXTURE_SIZES.backdropH]);
    expect(made.get(TEX.fire)!.width).toBe(TEXTURE_SIZES.fire);
  });

  it('is idempotent: a second run creates nothing new', () => {
    const mock = createMockScene();
    generateTextures(mock.scene);
    const afterFirst = mock.creates;
    generateTextures(mock.scene);
    expect(mock.creates).toBe(afterFirst);
    expect(afterFirst).toBe(ALL_TEXTURE_KEYS().length);
  });
});
