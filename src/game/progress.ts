// ─── Saved progress ─────────────────────────────────────────────────────────
// Best score, stars and play count per level id, saved under STORAGE_KEYS.PROGRESS.
// Pure module: no Phaser, no scene state.
//
// Stars are kept per difficulty preset as well as overall, because a level cleared on
// an easier-than-designed preset must not open the next one: unlocks count only the
// presets that are 'normal' or harder (see countsTowardUnlock in settings.ts).
import { STORAGE_KEYS } from '../config';
import {
  countsTowardUnlock, DEFAULT_PRESET, PRESET_IDS,
  type PresetId, type Settings,
} from './settings';
import { asCount, asRecord, browserStorage, readStored, writeStored, type StorageLike } from './storage';

// ─── Constants ──────────────────────────────────────────────────────────────
export const PROGRESS_VERSION = 1;
export const MAX_STARS = 3;

export interface LevelProgress {
  bestScore: number;
  stars: number;                                  // best stars on any preset
  plays: number;
  starsByPreset: Partial<Record<PresetId, number>>; // best stars per preset
}

export interface Progress {
  version: number;
  levels: Record<string, LevelProgress>;
}

/** One finished run, as the results screen reports it. */
export interface RunResult {
  levelId: string;
  score: number;
  stars: number;
  preset: PresetId;
}

export interface RecordedRun {
  progress: Progress;
  newBest: boolean;   // beat the previous best score for this level
  newStars: boolean;  // more stars than this level had before
}

// ─── Pure helpers ───────────────────────────────────────────────────────────
export function emptyLevelProgress(): LevelProgress {
  return { bestScore: 0, stars: 0, plays: 0, starsByPreset: {} };
}

export function emptyProgress(): Progress {
  return { version: PROGRESS_VERSION, levels: {} };
}

function clampStars(value: unknown): number {
  return Math.min(asCount(value, 0), MAX_STARS);
}

function parseLevel(value: unknown): LevelProgress | null {
  const raw = asRecord(value);
  if (!raw) return null;
  const entry = emptyLevelProgress();
  entry.bestScore = asCount(raw.bestScore, 0);
  entry.stars = clampStars(raw.stars);
  entry.plays = asCount(raw.plays, 0);
  const byPreset = asRecord(raw.starsByPreset);
  if (byPreset) {
    for (const preset of PRESET_IDS) {
      if (byPreset[preset] === undefined) continue;
      entry.starsByPreset[preset] = clampStars(byPreset[preset]);
    }
  }
  // A save written before a preset was recorded still counts as the default preset.
  const best = Math.max(0, ...Object.values(entry.starsByPreset));
  if (entry.stars > best) entry.starsByPreset[DEFAULT_PRESET] = entry.stars;
  entry.stars = Math.max(entry.stars, best);
  return entry;
}

/** This level's saved progress, or an empty record when it has never been played. */
export function levelProgress(progress: Readonly<Progress>, levelId: string): LevelProgress {
  return progress.levels[levelId] ?? emptyLevelProgress();
}

/** Best stars for one level, counting only presets that count toward unlocks. */
export function levelUnlockStars(entry: Readonly<LevelProgress>): number {
  let best = 0;
  for (const preset of PRESET_IDS) {
    if (!countsTowardUnlock(preset)) continue;
    best = Math.max(best, entry.starsByPreset[preset] ?? 0);
  }
  return best;
}

/** Every star earned, on any preset. What the header shows. */
export function totalStars(progress: Readonly<Progress>): number {
  let total = 0;
  for (const entry of Object.values(progress.levels)) total += entry.stars;
  return total;
}

/** Stars that count toward unlocks: earned on 'normal' or harder. */
export function unlockingStars(progress: Readonly<Progress>): number {
  let total = 0;
  for (const entry of Object.values(progress.levels)) total += levelUnlockStars(entry);
  return total;
}

/** Free play opens everything; otherwise a level needs unlockStars counted from 'normal' up. */
export function isUnlocked(
  level: { unlockStars?: number },
  progress: Readonly<Progress>,
  settings: Readonly<Pick<Settings, 'freePlay'>>,
): boolean {
  if (settings.freePlay) return true;
  const needed = level.unlockStars ?? 0;
  if (needed <= 0) return true;
  return unlockingStars(progress) >= needed;
}

/** Folds a finished run into a new Progress. Never lowers a best score or a star count. */
export function recordRun(progress: Readonly<Progress>, run: RunResult): RecordedRun {
  const before = levelProgress(progress, run.levelId);
  const stars = Math.min(Math.max(Math.floor(run.stars), 0), MAX_STARS);
  const score = Math.max(Math.floor(run.score), 0);
  const preset = PRESET_IDS.includes(run.preset) ? run.preset : DEFAULT_PRESET;
  const entry: LevelProgress = {
    bestScore: Math.max(before.bestScore, score),
    stars: Math.max(before.stars, stars),
    plays: before.plays + 1,
    starsByPreset: { ...before.starsByPreset },
  };
  entry.starsByPreset[preset] = Math.max(entry.starsByPreset[preset] ?? 0, stars);
  return {
    progress: { version: PROGRESS_VERSION, levels: { ...progress.levels, [run.levelId]: entry } },
    newBest: score > before.bestScore,
    newStars: stars > before.stars,
  };
}

// ─── Persistence ────────────────────────────────────────────────────────────
export function loadProgress(storage: StorageLike | null = browserStorage()): Progress {
  const stored = readStored(STORAGE_KEYS.PROGRESS, storage);
  if (!stored || stored.version !== PROGRESS_VERSION) return emptyProgress();
  const levels = asRecord(stored.levels);
  if (!levels) return emptyProgress();
  const progress = emptyProgress();
  for (const [levelId, value] of Object.entries(levels)) {
    const entry = parseLevel(value);
    if (entry) progress.levels[levelId] = entry;
  }
  return progress;
}

export function saveProgress(progress: Readonly<Progress>, storage: StorageLike | null = browserStorage()): boolean {
  return writeStored(STORAGE_KEYS.PROGRESS, { version: PROGRESS_VERSION, levels: progress.levels }, storage);
}
