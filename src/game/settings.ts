// ─── Game settings ──────────────────────────────────────────────────────────
// Player count, difficulty preset, seed mode, free play and assists, saved under
// STORAGE_KEYS.SETTINGS. Pure module: no Phaser, no scene state. The title screen and
// the assists page edit it, GameScene reads it to build the Sim.
import { MAX_PLAYERS, STORAGE_KEYS } from '../config';
import type { Modifiers } from '../sim/types';
import { asBoolean, asCount, asRecord, browserStorage, readStored, writeStored, type StorageLike } from './storage';

// ─── Constants ──────────────────────────────────────────────────────────────
export const SETTINGS_VERSION = 1;

export type PresetId = 'relaxed' | 'normal' | 'hard' | 'chaos';
/** Easiest first. The order is the unlock ranking as well as the cycle order. */
export const PRESET_IDS: readonly PresetId[] = ['relaxed', 'normal', 'hard', 'chaos'];
/** The preset a level's star thresholds were tuned for. */
export const DEFAULT_PRESET: PresetId = 'normal';

export type SeedMode = 'random' | 'daily' | 'fixed';
export const SEED_MODES: readonly SeedMode[] = ['random', 'daily', 'fixed'];

export const SEED_LIMIT = 0x1_0000_0000; // seeds are 32-bit unsigned
const DAILY_SEED_MIX = 0x9e37_79b9;      // golden-ratio constant, for the date hash

export interface Preset {
  id: PresetId;
  name: string;
  modifiers: Modifiers;
}

export const PRESETS: Readonly<Record<PresetId, Preset>> = Object.freeze({
  relaxed: { id: 'relaxed', name: 'Relaxed', modifiers: { timeLimitScale: 1.25, orderIntervalScale: 1.3, orderTimeScale: 1.3 } },
  normal: { id: 'normal', name: 'Normal', modifiers: {} },
  hard: { id: 'hard', name: 'Hard', modifiers: { orderIntervalScale: 0.8, orderTimeScale: 0.85, maxOrdersDelta: 1 } },
  chaos: { id: 'chaos', name: 'Chaos', modifiers: { orderIntervalScale: 0.65, orderTimeScale: 0.75, maxOrdersDelta: 2, chefSpeedScale: 1.1 } },
});

// ─── Assists ────────────────────────────────────────────────────────────────
// Toggles that make a kitchen forgiving. Any assist on means the run is not saved and
// earns no stars, whatever the difficulty preset.
export interface Assists {
  instantCooking: boolean;    // pots and pans are ready the moment they start
  ordersNeverExpire: boolean; // tickets never time out
  noBurning: boolean;         // cooked food never burns, so stoves never catch fire
}
export type AssistId = keyof Assists;
/** The order the assists page lists them in. */
export const ASSIST_IDS: readonly AssistId[] = ['instantCooking', 'ordersNeverExpire', 'noBurning'];
export const ASSIST_NAMES: Readonly<Record<AssistId, string>> = Object.freeze({
  instantCooking: 'Instant cooking',
  ordersNeverExpire: 'Orders never expire',
  noBurning: 'No burning',
});
export const NO_ASSISTS: Readonly<Assists> = Object.freeze({ instantCooking: false, ordersNeverExpire: false, noBurning: false });

export interface Settings {
  players: number;      // 1..MAX_PLAYERS
  preset: PresetId;
  seedMode: SeedMode;
  fixedSeed: number;    // used when seedMode is 'fixed'
  freePlay: boolean;    // ignores unlock thresholds
  assists: Assists;
}

export const DEFAULT_SETTINGS: Readonly<Settings> = Object.freeze({
  players: MAX_PLAYERS,
  preset: DEFAULT_PRESET,
  seedMode: 'random' as SeedMode,
  fixedSeed: 1,
  freePlay: false,
  assists: NO_ASSISTS,
});

// ─── Pure helpers ───────────────────────────────────────────────────────────
export function defaultSettings(): Settings {
  return { ...DEFAULT_SETTINGS, assists: { ...NO_ASSISTS } };
}

function asPreset(value: unknown): PresetId {
  return PRESET_IDS.includes(value as PresetId) ? (value as PresetId) : DEFAULT_SETTINGS.preset;
}

function asSeedMode(value: unknown): SeedMode {
  return SEED_MODES.includes(value as SeedMode) ? (value as SeedMode) : DEFAULT_SETTINGS.seedMode;
}

function asAssists(value: unknown): Assists {
  const stored = asRecord(value);
  return {
    instantCooking: asBoolean(stored?.instantCooking, NO_ASSISTS.instantCooking),
    ordersNeverExpire: asBoolean(stored?.ordersNeverExpire, NO_ASSISTS.ordersNeverExpire),
    noBurning: asBoolean(stored?.noBurning, NO_ASSISTS.noBurning),
  };
}

/** Wraps any number into the 32-bit unsigned seed range. */
export function normaliseSeed(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_SETTINGS.fixedSeed;
  return Math.floor(Math.abs(value)) % SEED_LIMIT;
}

export function presetOf(settings: Readonly<Settings>): Preset {
  return PRESETS[settings.preset] ?? PRESETS[DEFAULT_PRESET];
}

export function presetName(preset: PresetId): string {
  return (PRESETS[preset] ?? PRESETS[DEFAULT_PRESET]).name;
}

/** The Sim modifiers for the chosen preset, plus whichever assists are switched on. */
export function presetModifiers(settings: Readonly<Settings>): Modifiers {
  return { ...presetOf(settings).modifiers, ...assistModifiers(settings.assists) };
}

/** Only the assists that are on, so untouched settings add nothing to a preset. */
export function assistModifiers(assists: Readonly<Assists>): Modifiers {
  const mods: Modifiers = {};
  if (assists.instantCooking) mods.instantCooking = true;
  if (assists.ordersNeverExpire) mods.ordersNeverExpire = true;
  if (assists.noBurning) mods.noBurning = true;
  return mods;
}

/** True when any assist is part of the run's modifiers: the run is not saved. */
export function isAssisted(modifiers: Readonly<Modifiers> | undefined): boolean {
  return modifiers?.instantCooking === true || modifiers?.ordersNeverExpire === true || modifiers?.noBurning === true;
}

/** The title row's summary: 'off', or the assists that are on. */
export function assistSummary(assists: Readonly<Assists>): string {
  const on = ASSIST_IDS.filter((id) => assists[id]).map((id) => ASSIST_NAMES[id].toLowerCase());
  return on.length > 0 ? on.join(' · ') : 'off';
}

/** Stars earned on this preset count toward unlocks: 'normal' and anything harder. */
export function countsTowardUnlock(preset: PresetId): boolean {
  const rank = PRESET_IDS.indexOf(preset);
  return rank >= PRESET_IDS.indexOf(DEFAULT_PRESET);
}

/** Human-readable list of what a preset changes, for the difficulty row. */
export function describeModifiers(modifiers: Readonly<Modifiers>): string {
  const parts: string[] = [];
  if (modifiers.timeLimitScale !== undefined) parts.push(`time x${modifiers.timeLimitScale}`);
  if (modifiers.orderIntervalScale !== undefined) parts.push(`order gap x${modifiers.orderIntervalScale}`);
  if (modifiers.orderTimeScale !== undefined) parts.push(`patience x${modifiers.orderTimeScale}`);
  if (modifiers.maxOrdersDelta !== undefined) parts.push(`tickets ${modifiers.maxOrdersDelta >= 0 ? '+' : ''}${modifiers.maxOrdersDelta}`);
  if (modifiers.chefSpeedScale !== undefined) parts.push(`chefs x${modifiers.chefSpeedScale}`);
  if (modifiers.instantCooking) parts.push('instant cooking');
  if (modifiers.ordersNeverExpire) parts.push('orders never expire');
  if (modifiers.noBurning) parts.push('no burning');
  return parts.length > 0 ? parts.join(' · ') : 'level defaults';
}

export function presetSummary(preset: PresetId): string {
  return describeModifiers((PRESETS[preset] ?? PRESETS[DEFAULT_PRESET]).modifiers);
}

// ─── Seeds ──────────────────────────────────────────────────────────────────
/** YYYYMMDD in UTC, so everyone rolls the same daily seed at the same moment. */
export function dailyKey(date: Date): number {
  return date.getUTCFullYear() * 10_000 + (date.getUTCMonth() + 1) * 100 + date.getUTCDate();
}

/** Deterministic 32-bit hash of the UTC date: the same orders everywhere, that day. */
export function dailySeed(date: Date): number {
  let h = Math.imul(dailyKey(date) ^ DAILY_SEED_MIX, DAILY_SEED_MIX);
  h ^= h >>> 15;
  h = Math.imul(h, 0x85eb_ca6b);
  h ^= h >>> 13;
  return h >>> 0;
}

export function randomSeed(): number {
  return Math.floor(Math.random() * SEED_LIMIT) >>> 0;
}

/** The seed for the next run: fresh, daily or the pinned one. */
export function seedFor(settings: Readonly<Settings>, now: Date = new Date()): number {
  switch (settings.seedMode) {
    case 'daily': return dailySeed(now);
    case 'fixed': return normaliseSeed(settings.fixedSeed);
    case 'random': return randomSeed();
  }
}

// ─── Persistence ────────────────────────────────────────────────────────────
export function loadSettings(storage: StorageLike | null = browserStorage()): Settings {
  const stored = readStored(STORAGE_KEYS.SETTINGS, storage);
  if (!stored || stored.version !== SETTINGS_VERSION) return defaultSettings();
  const players = asCount(stored.players, DEFAULT_SETTINGS.players);
  return {
    players: Math.min(Math.max(players, 1), MAX_PLAYERS),
    preset: asPreset(stored.preset),
    seedMode: asSeedMode(stored.seedMode),
    fixedSeed: normaliseSeed(asCount(stored.fixedSeed, DEFAULT_SETTINGS.fixedSeed)),
    freePlay: asBoolean(stored.freePlay, DEFAULT_SETTINGS.freePlay),
    assists: asAssists(stored.assists),
  };
}

export function saveSettings(settings: Readonly<Settings>, storage: StorageLike | null = browserStorage()): boolean {
  return writeStored(STORAGE_KEYS.SETTINGS, { version: SETTINGS_VERSION, ...settings }, storage);
}

// ─── Cycling, for the settings rows ─────────────────────────────────────────
function cycle<T>(values: readonly T[], current: T, delta: number): T {
  const at = values.indexOf(current);
  const next = ((at < 0 ? 0 : at) + delta + values.length) % values.length;
  return values[next];
}

export function cyclePreset(current: PresetId, delta: number): PresetId {
  return cycle(PRESET_IDS, current, delta);
}

export function cycleSeedMode(current: SeedMode, delta: number): SeedMode {
  return cycle(SEED_MODES, current, delta);
}

export function cyclePlayers(current: number, delta: number): number {
  const next = current + delta;
  if (next > MAX_PLAYERS) return 1;
  if (next < 1) return MAX_PLAYERS;
  return next;
}
