import { describe, expect, it } from 'vitest';
import { STORAGE_KEYS } from '../src/config';
import {
  emptyProgress, isUnlocked, levelProgress, loadProgress, PROGRESS_VERSION, recordRun,
  saveProgress, totalStars, unlockingStars, type Progress,
} from '../src/game/progress';
import { defaultSettings, type PresetId } from '../src/game/settings';
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

function played(runs: readonly { levelId: string; score: number; stars: number; preset?: PresetId }[]): Progress {
  let progress = emptyProgress();
  for (const run of runs) {
    progress = recordRun(progress, { ...run, preset: run.preset ?? 'normal' }).progress;
  }
  return progress;
}

// ─── Recording runs ─────────────────────────────────────────────────────────
describe('recordRun', () => {
  it('starts from nothing', () => {
    const entry = levelProgress(emptyProgress(), 'oc1-1-1');
    expect(entry).toEqual({ bestScore: 0, stars: 0, plays: 0, starsByPreset: {} });
  });

  it('counts plays and keeps the best score and star count', () => {
    let progress = emptyProgress();
    let run = recordRun(progress, { levelId: 'oc1-1-1', score: 300, stars: 2, preset: 'normal' });
    expect(run.newBest).toBe(true);
    expect(run.newStars).toBe(true);
    progress = run.progress;

    run = recordRun(progress, { levelId: 'oc1-1-1', score: 120, stars: 1, preset: 'normal' });
    expect(run.newBest).toBe(false);
    expect(run.newStars).toBe(false);
    progress = run.progress;

    expect(levelProgress(progress, 'oc1-1-1')).toEqual({
      bestScore: 300, stars: 2, plays: 2, starsByPreset: { normal: 2 },
    });
  });

  it('does not mutate the progress it was given', () => {
    const before = emptyProgress();
    recordRun(before, { levelId: 'oc1-1-1', score: 300, stars: 3, preset: 'normal' });
    expect(before.levels).toEqual({});
  });

  it('remembers stars per preset', () => {
    const progress = played([
      { levelId: 'oc1-1-1', score: 400, stars: 3, preset: 'relaxed' },
      { levelId: 'oc1-1-1', score: 200, stars: 1, preset: 'hard' },
    ]);
    expect(levelProgress(progress, 'oc1-1-1').starsByPreset).toEqual({ relaxed: 3, hard: 1 });
    expect(levelProgress(progress, 'oc1-1-1').stars).toBe(3);
  });
});

// ─── Star totals ────────────────────────────────────────────────────────────
describe('star totals', () => {
  it('adds up the best stars of every level', () => {
    const progress = played([
      { levelId: 'oc1-1-1', score: 400, stars: 3 },
      { levelId: 'oc1-1-2', score: 200, stars: 2 },
    ]);
    expect(totalStars(progress)).toBe(5);
    expect(unlockingStars(progress)).toBe(5);
  });

  it('leaves stars earned on an easier preset out of the unlock total', () => {
    const progress = played([
      { levelId: 'oc1-1-1', score: 400, stars: 3, preset: 'relaxed' },
      { levelId: 'oc1-1-2', score: 400, stars: 3, preset: 'chaos' },
    ]);
    expect(totalStars(progress)).toBe(6);
    expect(unlockingStars(progress)).toBe(3);
  });

  it('saves a custom run but leaves its stars out of the unlock total', () => {
    const progress = played([
      { levelId: 'oc1-1-1', score: 400, stars: 3, preset: 'custom' },
      { levelId: 'oc1-1-2', score: 200, stars: 2, preset: 'normal' },
    ]);
    expect(levelProgress(progress, 'oc1-1-1')).toMatchObject({ bestScore: 400, stars: 3, plays: 1, starsByPreset: { custom: 3 } });
    expect(totalStars(progress)).toBe(5);
    expect(unlockingStars(progress)).toBe(2);
  });
});

// ─── Unlocking ──────────────────────────────────────────────────────────────
describe('isUnlocked', () => {
  const settings = defaultSettings();

  it('opens levels with no threshold', () => {
    expect(isUnlocked({}, emptyProgress(), settings)).toBe(true);
    expect(isUnlocked({ unlockStars: 0 }, emptyProgress(), settings)).toBe(true);
  });

  it('gates on stars that count toward unlocks', () => {
    const relaxed = played([{ levelId: 'oc1-1-1', score: 400, stars: 3, preset: 'relaxed' }]);
    const normal = played([{ levelId: 'oc1-1-1', score: 400, stars: 3, preset: 'normal' }]);
    expect(isUnlocked({ unlockStars: 3 }, relaxed, settings)).toBe(false);
    expect(isUnlocked({ unlockStars: 3 }, normal, settings)).toBe(true);
    expect(isUnlocked({ unlockStars: 4 }, normal, settings)).toBe(false);
  });

  it('opens everything in free play', () => {
    expect(isUnlocked({ unlockStars: 12 }, emptyProgress(), { ...settings, freePlay: true })).toBe(true);
  });
});

// ─── Persistence ────────────────────────────────────────────────────────────
describe('progress persistence', () => {
  it('returns empty progress when nothing is stored', () => {
    expect(loadProgress(fakeStorage())).toEqual(emptyProgress());
  });

  it('round-trips through storage', () => {
    const storage = fakeStorage();
    const progress = played([
      { levelId: 'oc1-1-1', score: 400, stars: 3 },
      { levelId: 'oc1-1-2', score: 120, stars: 1, preset: 'chaos' },
    ]);
    expect(saveProgress(progress, storage)).toBe(true);
    expect(loadProgress(storage)).toEqual(progress);
  });

  it('ignores a different version', () => {
    const storage = fakeStorage({
      [STORAGE_KEYS.PROGRESS]: JSON.stringify({ version: PROGRESS_VERSION + 1, levels: { 'oc1-1-1': { stars: 3 } } }),
    });
    expect(loadProgress(storage)).toEqual(emptyProgress());
  });

  it('repairs malformed level entries', () => {
    const storage = fakeStorage({
      [STORAGE_KEYS.PROGRESS]: JSON.stringify({
        version: PROGRESS_VERSION,
        levels: {
          'oc1-1-1': { bestScore: -40, stars: 9, plays: 'lots', starsByPreset: { nonsense: 3, hard: 2 } },
          'oc1-1-2': 'not an object',
        },
      }),
    });
    const progress = loadProgress(storage);
    expect(progress.levels['oc1-1-2']).toBeUndefined();
    expect(progress.levels['oc1-1-1']).toEqual({
      bestScore: 0, stars: 3, plays: 0, starsByPreset: { hard: 2, normal: 3 },
    });
  });

  it('survives unparseable JSON and a storage that throws', () => {
    expect(loadProgress(fakeStorage({ [STORAGE_KEYS.PROGRESS]: 'nope' }))).toEqual(emptyProgress());
    expect(loadProgress(throwingStorage())).toEqual(emptyProgress());
    expect(saveProgress(emptyProgress(), throwingStorage())).toBe(false);
    expect(loadProgress(null)).toEqual(emptyProgress());
    expect(saveProgress(emptyProgress(), null)).toBe(false);
  });
});
