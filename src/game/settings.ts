// ─── Game settings ──────────────────────────────────────────────────────────
// Player count, difficulty preset, the custom difficulty numbers, seed mode, free play,
// assists, audio switches and the chefs' aprons, saved under STORAGE_KEYS.SETTINGS. Pure
// module: no Phaser, no scene state. The title, the Settings, Custom difficulty and Chefs
// pages edit it; GameScene reads it to build the Sim and the kitchen.
import { CHEF_SKINS, DEFAULT_CHEF_SKINS } from '../art/models';
import { MAX_PLAYERS, STORAGE_KEYS } from '../config';
import type { Modifiers } from '../sim/types';
import { asBoolean, asCount, asNumber, asRecord, browserStorage, readStored, writeStored, type StorageLike } from './storage';

// ─── Constants ──────────────────────────────────────────────────────────────
export const SETTINGS_VERSION = 1;

export type PresetId = 'relaxed' | 'normal' | 'hard' | 'chaos' | 'custom';
/** Easiest first, then custom. The order is the unlock ranking as well as the cycle order. */
export const PRESET_IDS: readonly PresetId[] = ['relaxed', 'normal', 'hard', 'chaos', 'custom'];
/** The preset whose modifiers come from Settings.custom instead of PRESETS. */
export const CUSTOM_PRESET: PresetId = 'custom';
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
  custom: { id: 'custom', name: 'Custom', modifiers: {} }, // placeholder: customModifiers() supplies the real ones
});

// ─── Custom difficulty ──────────────────────────────────────────────────────
// Every number the sim scales, editable one by one on the Custom difficulty page. Scales
// multiply the level's or the sim's number (1 = unchanged); deltas add tickets (0 = unchanged).
// A custom run is saved like any other but never counts toward unlocks.
export interface CustomDifficulty {
  timeLimitScale: number;
  initialOrdersDelta: number;
  maxOrdersDelta: number;
  orderIntervalScale: number;
  orderTimeScale: number;
  cookTimeScale: number;
  burnTimeScale: number;
  chopTimeScale: number;
  washTimeScale: number;
  chefSpeedScale: number;
}
export type CustomFieldId = keyof CustomDifficulty;

export interface CustomFieldSpec {
  id: CustomFieldId;
  name: string;          // row label
  kind: 'scale' | 'delta';
  min: number;
  max: number;
  step: number;          // one left / right press
}
/** The rows of the Custom difficulty page, top to bottom. */
export const CUSTOM_FIELDS: readonly CustomFieldSpec[] = Object.freeze([
  { id: 'timeLimitScale', name: 'Level time', kind: 'scale', min: 0.3, max: 3, step: 0.1 },
  { id: 'initialOrdersDelta', name: 'Tickets at start', kind: 'delta', min: -3, max: 4, step: 1 },
  { id: 'maxOrdersDelta', name: 'Extra tickets on screen', kind: 'delta', min: -3, max: 5, step: 1 },
  { id: 'orderIntervalScale', name: 'Seconds between tickets', kind: 'scale', min: 0.3, max: 3, step: 0.1 },
  { id: 'orderTimeScale', name: 'Ticket patience', kind: 'scale', min: 0.3, max: 3, step: 0.1 },
  { id: 'cookTimeScale', name: 'Cook time', kind: 'scale', min: 0.3, max: 3, step: 0.1 },
  { id: 'burnTimeScale', name: 'Burn time', kind: 'scale', min: 0.3, max: 3, step: 0.1 },
  { id: 'chopTimeScale', name: 'Chop time', kind: 'scale', min: 0.3, max: 3, step: 0.1 },
  { id: 'washTimeScale', name: 'Wash time', kind: 'scale', min: 0.3, max: 3, step: 0.1 },
  { id: 'chefSpeedScale', name: 'Chef speed', kind: 'scale', min: 0.5, max: 2, step: 0.1 },
]);
export const DEFAULT_CUSTOM: Readonly<CustomDifficulty> = Object.freeze({
  timeLimitScale: 1, initialOrdersDelta: 0, maxOrdersDelta: 0, orderIntervalScale: 1, orderTimeScale: 1,
  cookTimeScale: 1, burnTimeScale: 1, chopTimeScale: 1, washTimeScale: 1, chefSpeedScale: 1,
});
const CUSTOM_DECIMALS = 100; // values are kept to two decimals so stepping never drifts

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

// ─── Audio ──────────────────────────────────────────────────────────────────
// Music and sound effects switch off on their own; the M key's master mute sits above both.
export interface AudioSettings {
  music: boolean;
  sfx: boolean;
}
export const DEFAULT_AUDIO: Readonly<AudioSettings> = Object.freeze({ music: true, sfx: true });

export interface Settings {
  players: number;      // 1..MAX_PLAYERS
  preset: PresetId;
  custom: CustomDifficulty; // the numbers behind the 'custom' preset
  seedMode: SeedMode;
  fixedSeed: number;    // used when seedMode is 'fixed'
  freePlay: boolean;    // ignores unlock thresholds
  assists: Assists;
  audio: AudioSettings;
  chefs: number[];      // character (CHEF_SKINS index) per player, index = player
}

export const DEFAULT_SETTINGS: Readonly<Settings> = Object.freeze({
  players: MAX_PLAYERS,
  preset: DEFAULT_PRESET,
  custom: DEFAULT_CUSTOM,
  seedMode: 'random' as SeedMode,
  fixedSeed: 1,
  freePlay: false,
  assists: NO_ASSISTS,
  audio: DEFAULT_AUDIO,
  chefs: [...DEFAULT_CHEF_SKINS],
});

// ─── Pure helpers ───────────────────────────────────────────────────────────
export function defaultSettings(): Settings {
  return {
    ...DEFAULT_SETTINGS,
    custom: { ...DEFAULT_CUSTOM },
    assists: { ...NO_ASSISTS },
    audio: { ...DEFAULT_AUDIO },
    chefs: [...DEFAULT_CHEF_SKINS],
  };
}

function asPreset(value: unknown): PresetId {
  return PRESET_IDS.includes(value as PresetId) ? (value as PresetId) : DEFAULT_SETTINGS.preset;
}

/** Each number clamped to its row's range; anything else is that row's default. */
function asCustom(value: unknown): CustomDifficulty {
  const stored = asRecord(value);
  const out: CustomDifficulty = { ...DEFAULT_CUSTOM };
  for (const field of CUSTOM_FIELDS) {
    out[field.id] = clampCustom(field, asNumber(stored?.[field.id], DEFAULT_CUSTOM[field.id]));
  }
  return out;
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

function asAudio(value: unknown): AudioSettings {
  const stored = asRecord(value);
  return {
    music: asBoolean(stored?.music, DEFAULT_AUDIO.music),
    sfx: asBoolean(stored?.sfx, DEFAULT_AUDIO.sfx),
  };
}

/** One apron per player; anything that is not a known skin id falls back to that player's default. */
function asChefs(value: unknown): number[] {
  const stored: unknown[] = Array.isArray(value) ? value : [];
  return DEFAULT_CHEF_SKINS.map((fallback, player) => {
    const skin = stored[player];
    return typeof skin === 'number' && Number.isInteger(skin) && skin >= 0 && skin < CHEF_SKINS.length ? skin : fallback;
  });
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
  const base = settings.preset === CUSTOM_PRESET ? customModifiers(settings.custom) : presetOf(settings).modifiers;
  return { ...base, ...assistModifiers(settings.assists) };
}

// ─── Custom difficulty helpers ──────────────────────────────────────────────
function clampCustom(field: CustomFieldSpec, value: number): number {
  const clamped = Math.min(field.max, Math.max(field.min, value));
  return Math.round(clamped * CUSTOM_DECIMALS) / CUSTOM_DECIMALS;
}

/** One left / right press on a row: the value moves by the row's step and stays in range. */
export function stepCustom(custom: Readonly<CustomDifficulty>, id: CustomFieldId, delta: number): CustomDifficulty {
  const field = CUSTOM_FIELDS.find((f) => f.id === id);
  if (!field) return { ...custom };
  return { ...custom, [id]: clampCustom(field, custom[id] + delta * field.step) };
}

/** Only the numbers that differ from the level defaults, so an untouched row adds nothing. */
export function customModifiers(custom: Readonly<CustomDifficulty>): Modifiers {
  const mods: Modifiers = {};
  for (const field of CUSTOM_FIELDS) {
    if (custom[field.id] !== DEFAULT_CUSTOM[field.id]) mods[field.id] = custom[field.id];
  }
  return mods;
}

/** How a row shows its value: 'x1.5' for a scale, '+1' for a delta. */
export function formatCustomValue(field: CustomFieldSpec, value: number): string {
  if (field.kind === 'delta') return value > 0 ? `+${value}` : `${value}`;
  return `x${value}`;
}

/** 'level defaults', or how many rows were changed. */
export function customSummary(custom: Readonly<CustomDifficulty>): string {
  const changed = CUSTOM_FIELDS.filter((field) => custom[field.id] !== DEFAULT_CUSTOM[field.id]).length;
  if (changed === 0) return 'level defaults';
  return `${changed} number${changed === 1 ? '' : 's'} changed`;
}

/** The title's difficulty row: what the chosen preset changes, or the custom summary. */
export function difficultySummary(settings: Readonly<Settings>): string {
  return settings.preset === CUSTOM_PRESET ? customSummary(settings.custom) : presetSummary(settings.preset);
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

/** 'off', or the assists that are on. */
export function assistSummary(assists: Readonly<Assists>): string {
  const on = ASSIST_IDS.filter((id) => assists[id]).map((id) => ASSIST_NAMES[id].toLowerCase());
  return on.length > 0 ? on.join(' · ') : 'off';
}

/** The title's Settings row: whatever is not at its default, or 'defaults'. */
export function settingsSummary(settings: Readonly<Settings>): string {
  const parts: string[] = [];
  if (settings.seedMode === 'daily') parts.push('daily seed');
  if (settings.seedMode === 'fixed') parts.push(`seed ${settings.fixedSeed}`);
  if (settings.freePlay) parts.push('free play');
  const assists = ASSIST_IDS.filter((id) => settings.assists[id]).length;
  if (assists > 0) parts.push(`${assists} assist${assists === 1 ? '' : 's'}`);
  if (!settings.audio.music) parts.push('music off');
  if (!settings.audio.sfx) parts.push('sound off');
  return parts.length > 0 ? parts.join(' · ') : 'defaults';
}

/** The title's Chefs row: each player's character name. */
export function chefSummary(chefs: readonly number[]): string {
  return chefs.map((skin) => (CHEF_SKINS[skin] ?? CHEF_SKINS[0]).name).join(' · ');
}

/** The next character for one player, skipping the ones the other players are. */
export function cycleChef(chefs: readonly number[], player: number, delta: number): number[] {
  const taken = new Set(chefs.filter((_, i) => i !== player));
  let next = chefs[player] ?? DEFAULT_CHEF_SKINS[player] ?? 0;
  for (let i = 0; i < CHEF_SKINS.length; i++) {
    next = (next + delta + CHEF_SKINS.length) % CHEF_SKINS.length;
    if (!taken.has(next)) break;
  }
  const out = [...chefs];
  out[player] = next;
  return out;
}

/** Stars earned on this preset count toward unlocks: 'normal' and anything harder. A custom
 *  run never counts, whatever its numbers, which keeps the star ladder honest. */
export function countsTowardUnlock(preset: PresetId): boolean {
  if (preset === CUSTOM_PRESET) return false;
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
  if (modifiers.initialOrdersDelta !== undefined) parts.push(`start tickets ${modifiers.initialOrdersDelta >= 0 ? '+' : ''}${modifiers.initialOrdersDelta}`);
  if (modifiers.cookTimeScale !== undefined) parts.push(`cook x${modifiers.cookTimeScale}`);
  if (modifiers.burnTimeScale !== undefined) parts.push(`burn x${modifiers.burnTimeScale}`);
  if (modifiers.chopTimeScale !== undefined) parts.push(`chop x${modifiers.chopTimeScale}`);
  if (modifiers.washTimeScale !== undefined) parts.push(`wash x${modifiers.washTimeScale}`);
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
    custom: asCustom(stored.custom),
    seedMode: asSeedMode(stored.seedMode),
    fixedSeed: normaliseSeed(asCount(stored.fixedSeed, DEFAULT_SETTINGS.fixedSeed)),
    freePlay: asBoolean(stored.freePlay, DEFAULT_SETTINGS.freePlay),
    assists: asAssists(stored.assists),
    audio: asAudio(stored.audio),
    chefs: asChefs(stored.chefs),
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
