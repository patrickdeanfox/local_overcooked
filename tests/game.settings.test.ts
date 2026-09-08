import { describe, expect, it } from 'vitest';
import { MAX_PLAYERS, STORAGE_KEYS } from '../src/config';
import {
  cyclePlayers, cyclePreset, cycleSeedMode, dailySeed, defaultSettings, describeModifiers,
  loadSettings, normaliseSeed, PRESETS, PRESET_IDS, presetModifiers, presetName, presetSummary,
  saveSettings, SEED_LIMIT, seedFor, SETTINGS_VERSION, type Settings,
} from '../src/game/settings';
import type { StorageLike } from '../src/game/storage';

// ─── Fake localStorage ──────────────────────────────────────────────────────
interface FakeStorage extends StorageLike {
  data: Map<string, string>;
}

function fakeStorage(initial: Record<string, string> = {}): FakeStorage {
  const data = new Map<string, string>(Object.entries(initial));
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => { data.set(key, value); },
  };
}

function throwingStorage(): StorageLike {
  return {
    getItem: () => { throw new Error('blocked'); },
    setItem: () => { throw new Error('quota'); },
  };
}

// ─── Presets ────────────────────────────────────────────────────────────────
describe('difficulty presets', () => {
  it('exposes the four presets easiest first', () => {
    expect(PRESET_IDS).toEqual(['relaxed', 'normal', 'hard', 'chaos']);
  });

  it('maps each preset to its modifiers', () => {
    expect(PRESETS.relaxed.modifiers).toEqual({ timeLimitScale: 1.25, orderIntervalScale: 1.3, orderTimeScale: 1.3 });
    expect(PRESETS.normal.modifiers).toEqual({});
    expect(PRESETS.hard.modifiers).toEqual({ orderIntervalScale: 0.8, orderTimeScale: 0.85, maxOrdersDelta: 1 });
    expect(PRESETS.chaos.modifiers).toEqual({ orderIntervalScale: 0.65, orderTimeScale: 0.75, maxOrdersDelta: 2, chefSpeedScale: 1.1 });
  });

  it('hands out a copy of the modifiers so callers cannot edit the preset', () => {
    const settings: Settings = { ...defaultSettings(), preset: 'hard' };
    const mods = presetModifiers(settings);
    mods.maxOrdersDelta = 99;
    expect(PRESETS.hard.modifiers.maxOrdersDelta).toBe(1);
  });

  it('describes what a preset changes', () => {
    expect(presetSummary('normal')).toBe('level defaults');
    expect(describeModifiers(PRESETS.hard.modifiers)).toBe('order gap x0.8 · patience x0.85 · tickets +1');
    expect(presetName('chaos')).toBe('Chaos');
  });

  it('cycles presets, seed modes and players with wrap-around', () => {
    expect(cyclePreset('normal', 1)).toBe('hard');
    expect(cyclePreset('chaos', 1)).toBe('relaxed');
    expect(cyclePreset('relaxed', -1)).toBe('chaos');
    expect(cycleSeedMode('random', 1)).toBe('daily');
    expect(cycleSeedMode('random', -1)).toBe('fixed');
    expect(cyclePlayers(MAX_PLAYERS, 1)).toBe(1);
    expect(cyclePlayers(1, -1)).toBe(MAX_PLAYERS);
  });
});

// ─── Seeds ──────────────────────────────────────────────────────────────────
describe('seedFor', () => {
  it('returns the pinned seed in fixed mode', () => {
    const settings: Settings = { ...defaultSettings(), seedMode: 'fixed', fixedSeed: 4242 };
    expect(seedFor(settings)).toBe(4242);
    expect(seedFor(settings)).toBe(4242);
  });

  it('derives the daily seed from the UTC date only', () => {
    const settings: Settings = { ...defaultSettings(), seedMode: 'daily' };
    const morning = new Date(Date.UTC(2026, 8, 8, 1, 30));
    const evening = new Date(Date.UTC(2026, 8, 8, 23, 45));
    const nextDay = new Date(Date.UTC(2026, 8, 9, 1, 30));
    expect(seedFor(settings, morning)).toBe(seedFor(settings, evening));
    expect(seedFor(settings, nextDay)).not.toBe(seedFor(settings, morning));
    expect(dailySeed(morning)).toBeGreaterThanOrEqual(0);
    expect(dailySeed(morning)).toBeLessThan(SEED_LIMIT);
  });

  it('rolls a fresh 32-bit seed each run in random mode', () => {
    const settings: Settings = { ...defaultSettings(), seedMode: 'random' };
    const seeds = new Set<number>();
    for (let i = 0; i < 40; i++) {
      const seed = seedFor(settings);
      expect(Number.isInteger(seed)).toBe(true);
      expect(seed).toBeGreaterThanOrEqual(0);
      expect(seed).toBeLessThan(SEED_LIMIT);
      seeds.add(seed);
    }
    expect(seeds.size).toBeGreaterThan(1);
  });

  it('normalises out-of-range seeds', () => {
    expect(normaliseSeed(-7)).toBe(7);
    expect(normaliseSeed(1.9)).toBe(1);
    expect(normaliseSeed(SEED_LIMIT + 5)).toBe(5);
    expect(normaliseSeed(Number.NaN)).toBe(defaultSettings().fixedSeed);
  });
});

// ─── Persistence ────────────────────────────────────────────────────────────
describe('settings persistence', () => {
  it('returns defaults when nothing is stored', () => {
    expect(loadSettings(fakeStorage())).toEqual(defaultSettings());
  });

  it('round-trips through storage', () => {
    const storage = fakeStorage();
    const settings: Settings = { players: 1, preset: 'chaos', seedMode: 'fixed', fixedSeed: 99, freePlay: true };
    expect(saveSettings(settings, storage)).toBe(true);
    expect(loadSettings(storage)).toEqual(settings);
  });

  it('ignores a different version', () => {
    const storage = fakeStorage({
      [STORAGE_KEYS.SETTINGS]: JSON.stringify({ version: SETTINGS_VERSION + 1, players: 1, preset: 'chaos' }),
    });
    expect(loadSettings(storage)).toEqual(defaultSettings());
  });

  it('falls back on unknown or malformed values', () => {
    const storage = fakeStorage({
      [STORAGE_KEYS.SETTINGS]: JSON.stringify({
        version: SETTINGS_VERSION,
        players: 17,
        preset: 'impossible',
        seedMode: 'lunar',
        fixedSeed: 'nope',
        freePlay: 'yes',
      }),
    });
    expect(loadSettings(storage)).toEqual({ ...defaultSettings(), players: MAX_PLAYERS });
  });

  it('survives unparseable JSON and a storage that throws', () => {
    expect(loadSettings(fakeStorage({ [STORAGE_KEYS.SETTINGS]: '{not json' }))).toEqual(defaultSettings());
    expect(loadSettings(throwingStorage())).toEqual(defaultSettings());
    expect(saveSettings(defaultSettings(), throwingStorage())).toBe(false);
    expect(loadSettings(null)).toEqual(defaultSettings());
    expect(saveSettings(defaultSettings(), null)).toBe(false);
  });
});
