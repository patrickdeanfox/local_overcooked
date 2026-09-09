import { describe, expect, it } from 'vitest';
import { MAX_PLAYERS, STORAGE_KEYS } from '../src/config';
import { CHEF_SKINS } from '../src/art/models';
import {
  assistSummary, chefSummary, countsTowardUnlock, CUSTOM_FIELDS, customModifiers, customSummary, cycleChef,
  cyclePlayers, cyclePreset, cycleSeedMode, dailySeed, DEFAULT_CUSTOM, defaultSettings, describeModifiers,
  difficultySummary, formatCustomValue, isAssisted, loadSettings, normaliseSeed, PRESETS, PRESET_IDS, presetModifiers,
  presetName, presetSummary, saveSettings, SEED_LIMIT, seedFor, SETTINGS_VERSION, settingsSummary, stepCustom,
  type CustomDifficulty, type Settings,
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
  it('exposes the four presets easiest first, then custom', () => {
    expect(PRESET_IDS).toEqual(['relaxed', 'normal', 'hard', 'chaos', 'custom']);
    expect(presetName('custom')).toBe('Custom');
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
    expect(cyclePreset('chaos', 1)).toBe('custom');
    expect(cyclePreset('custom', 1)).toBe('relaxed');
    expect(cyclePreset('relaxed', -1)).toBe('custom');
    expect(cycleSeedMode('random', 1)).toBe('daily');
    expect(cycleSeedMode('random', -1)).toBe('fixed');
    expect(cyclePlayers(MAX_PLAYERS, 1)).toBe(1);
    expect(cyclePlayers(1, -1)).toBe(MAX_PLAYERS);
  });
});

// ─── Custom difficulty ──────────────────────────────────────────────────────
describe('custom difficulty', () => {
  const changed: CustomDifficulty = { ...DEFAULT_CUSTOM, cookTimeScale: 1.5, initialOrdersDelta: 1 };

  it('lists one row per number, all at the level default', () => {
    expect(CUSTOM_FIELDS.map((f) => f.id).sort()).toEqual(Object.keys(DEFAULT_CUSTOM).sort());
    expect(new Set(CUSTOM_FIELDS.map((f) => f.id)).size).toBe(CUSTOM_FIELDS.length);
    expect(defaultSettings().custom).toEqual(DEFAULT_CUSTOM);
    expect(customModifiers(DEFAULT_CUSTOM)).toEqual({});
    expect(customSummary(DEFAULT_CUSTOM)).toBe('level defaults');
  });

  it('never counts toward unlocks, whatever the numbers', () => {
    expect(countsTowardUnlock('custom')).toBe(false);
    expect(countsTowardUnlock('normal')).toBe(true);
    expect(countsTowardUnlock('relaxed')).toBe(false);
  });

  it('steps a row by its step, clamps to its range and never drifts', () => {
    expect(stepCustom(DEFAULT_CUSTOM, 'cookTimeScale', 1).cookTimeScale).toBe(1.1);
    let custom = DEFAULT_CUSTOM;
    for (let i = 0; i < 3; i++) custom = stepCustom(custom, 'cookTimeScale', -1);
    expect(custom.cookTimeScale).toBe(0.7);
    expect(stepCustom({ ...DEFAULT_CUSTOM, chefSpeedScale: 2 }, 'chefSpeedScale', 1).chefSpeedScale).toBe(2);
    expect(stepCustom({ ...DEFAULT_CUSTOM, timeLimitScale: 0.3 }, 'timeLimitScale', -1).timeLimitScale).toBe(0.3);
    expect(stepCustom(DEFAULT_CUSTOM, 'initialOrdersDelta', -1).initialOrdersDelta).toBe(-1);
    expect(stepCustom({ ...DEFAULT_CUSTOM, initialOrdersDelta: -3 }, 'initialOrdersDelta', -1).initialOrdersDelta).toBe(-3);
    expect(stepCustom(DEFAULT_CUSTOM, 'washTimeScale', 0)).toEqual(DEFAULT_CUSTOM);
  });

  it('hands the sim only the rows that changed, plus the assists', () => {
    expect(customModifiers(changed)).toEqual({ cookTimeScale: 1.5, initialOrdersDelta: 1 });
    const settings: Settings = {
      ...defaultSettings(), preset: 'custom', custom: changed,
      assists: { instantCooking: false, ordersNeverExpire: true, noBurning: false },
    };
    expect(presetModifiers(settings)).toEqual({ cookTimeScale: 1.5, initialOrdersDelta: 1, ordersNeverExpire: true });
    expect(presetModifiers({ ...settings, preset: 'hard' })).toEqual({ ...PRESETS.hard.modifiers, ordersNeverExpire: true });
  });

  it('describes the new modifiers and the title row', () => {
    expect(describeModifiers({ initialOrdersDelta: 1, cookTimeScale: 1.5, burnTimeScale: 0.5, chopTimeScale: 2, washTimeScale: 0.5 }))
      .toBe('start tickets +1 · cook x1.5 · burn x0.5 · chop x2 · wash x0.5');
    expect(customSummary(changed)).toBe('2 numbers changed');
    expect(customSummary({ ...DEFAULT_CUSTOM, chopTimeScale: 0.5 })).toBe('1 number changed');
    expect(difficultySummary({ ...defaultSettings(), preset: 'custom', custom: changed })).toBe('2 numbers changed');
    expect(difficultySummary({ ...defaultSettings(), preset: 'hard' })).toBe(presetSummary('hard'));
    expect(formatCustomValue(CUSTOM_FIELDS[0], 1.5)).toBe('x1.5');
    expect(formatCustomValue(CUSTOM_FIELDS[1], 1)).toBe('+1');
    expect(formatCustomValue(CUSTOM_FIELDS[1], -2)).toBe('-2');
    expect(formatCustomValue(CUSTOM_FIELDS[1], 0)).toBe('0');
  });

  it('reads stored numbers clamped to their range and everything else as the default', () => {
    const storage = fakeStorage({
      [STORAGE_KEYS.SETTINGS]: JSON.stringify({
        version: SETTINGS_VERSION,
        preset: 'custom',
        custom: { cookTimeScale: 9, chefSpeedScale: 'fast', initialOrdersDelta: -1, burnTimeScale: 0.123 },
      }),
    });
    const loaded = loadSettings(storage);
    expect(loaded.preset).toBe('custom');
    expect(loaded.custom).toEqual({ ...DEFAULT_CUSTOM, cookTimeScale: 3, initialOrdersDelta: -1, burnTimeScale: 0.3 });
    expect(loadSettings(fakeStorage({ [STORAGE_KEYS.SETTINGS]: JSON.stringify({ version: SETTINGS_VERSION, custom: 'hard' }) })).custom)
      .toEqual(DEFAULT_CUSTOM);
    expect(loadSettings(fakeStorage({ [STORAGE_KEYS.SETTINGS]: JSON.stringify({ version: SETTINGS_VERSION }) })).custom)
      .toEqual(DEFAULT_CUSTOM);
  });
});

// ─── Assists ────────────────────────────────────────────────────────────────
describe('assists', () => {
  it('default to off and add nothing to the preset modifiers', () => {
    expect(defaultSettings().assists).toEqual({ instantCooking: false, ordersNeverExpire: false, noBurning: false });
    expect(presetModifiers(defaultSettings())).toEqual({});
    expect(isAssisted(presetModifiers(defaultSettings()))).toBe(false);
    expect(isAssisted(undefined)).toBe(false);
  });

  it('fold the switched-on assists into the run modifiers', () => {
    const settings: Settings = {
      ...defaultSettings(),
      preset: 'hard',
      assists: { instantCooking: true, ordersNeverExpire: false, noBurning: true },
    };
    const mods = presetModifiers(settings);
    expect(mods).toEqual({ ...PRESETS.hard.modifiers, instantCooking: true, noBurning: true });
    expect(isAssisted(mods)).toBe(true);
    expect(describeModifiers(mods)).toBe('order gap x0.8 · patience x0.85 · tickets +1 · instant cooking · no burning');
  });

  it('summarise the title row', () => {
    expect(assistSummary(defaultSettings().assists)).toBe('off');
    expect(assistSummary({ instantCooking: false, ordersNeverExpire: true, noBurning: true })).toBe('orders never expire · no burning');
  });

  it('read partial or malformed stored assists as off', () => {
    const storage = fakeStorage({
      [STORAGE_KEYS.SETTINGS]: JSON.stringify({ version: SETTINGS_VERSION, assists: { noBurning: true, instantCooking: 'yes' } }),
    });
    expect(loadSettings(storage).assists).toEqual({ instantCooking: false, ordersNeverExpire: false, noBurning: true });
    expect(loadSettings(fakeStorage({ [STORAGE_KEYS.SETTINGS]: JSON.stringify({ version: SETTINGS_VERSION, assists: 'all' }) })).assists)
      .toEqual(defaultSettings().assists);
  });
});

// ─── Chefs and audio ────────────────────────────────────────────────────────
describe('chefs and audio', () => {
  it('default to blue and red aprons with everything audible', () => {
    expect(defaultSettings().chefs).toEqual([0, 1]);
    expect(defaultSettings().audio).toEqual({ music: true, sfx: true });
    expect(chefSummary(defaultSettings().chefs)).toBe('Blue apron · Red apron');
    expect(CHEF_SKINS.length).toBe(15);
  });

  it('cycle a player past the aprons the other player wears, wrapping around', () => {
    expect(cycleChef([0, 1], 0, 1)).toEqual([2, 1]);           // red is taken, so blue -> green
    expect(cycleChef([0, 1], 1, -1)).toEqual([0, CHEF_SKINS.length - 1]); // blue is taken, so red -> last
    expect(cycleChef([CHEF_SKINS.length - 1, 1], 0, 1)).toEqual([0, 1]);
    expect(cycleChef([0, 1], 0, 0)).toEqual([0, 1]);
  });

  it('summarise what the settings page changed', () => {
    expect(settingsSummary(defaultSettings())).toBe('defaults');
    const changed: Settings = {
      ...defaultSettings(),
      seedMode: 'fixed', fixedSeed: 77, freePlay: true,
      assists: { instantCooking: true, ordersNeverExpire: true, noBurning: false },
      audio: { music: false, sfx: true },
    };
    expect(settingsSummary(changed)).toBe('seed 77 · free play · 2 assists · music off');
    expect(settingsSummary({ ...defaultSettings(), seedMode: 'daily', audio: { music: true, sfx: false } })).toBe('daily seed · sound off');
  });

  it('read unknown apron ids and malformed audio as the defaults', () => {
    const storage = fakeStorage({
      [STORAGE_KEYS.SETTINGS]: JSON.stringify({ version: SETTINGS_VERSION, chefs: [99, 3, 5], audio: 'loud' }),
    });
    const loaded = loadSettings(storage);
    expect(loaded.chefs).toEqual([0, 3]);
    expect(loaded.audio).toEqual({ music: true, sfx: true });
    expect(loadSettings(fakeStorage({ [STORAGE_KEYS.SETTINGS]: JSON.stringify({ version: SETTINGS_VERSION, chefs: 'none' }) })).chefs)
      .toEqual([0, 1]);
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
    const settings: Settings = {
      players: 1, preset: 'chaos', custom: { ...DEFAULT_CUSTOM, washTimeScale: 0.5, maxOrdersDelta: 2 },
      seedMode: 'fixed', fixedSeed: 99, freePlay: true,
      assists: { instantCooking: true, ordersNeverExpire: false, noBurning: true },
      audio: { music: false, sfx: true },
      chefs: [4, 2],
    };
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
