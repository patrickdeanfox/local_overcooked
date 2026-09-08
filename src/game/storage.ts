// ─── Local storage helpers ──────────────────────────────────────────────────
// Versioned JSON blobs for the presentation's saved state (settings, progress).
// Every access is wrapped: a private window, a full quota or a hand-edited value
// must never take the game down, so a failed read is simply "nothing saved yet".
import { log } from '../log';

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/** The browser's localStorage, or null outside a browser (tests, SSR, blocked storage). */
export function browserStorage(): StorageLike | null {
  try {
    if (typeof globalThis === 'undefined') return null;
    const store = (globalThis as { localStorage?: StorageLike }).localStorage;
    return store ?? null;
  } catch (err) {
    log.warn('localStorage is not available', err);
    return null;
  }
}

/** Parsed object under `key`, or null when it is missing, unreadable or not an object. */
export function readStored(key: string, storage: StorageLike | null): Record<string, unknown> | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(key);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    return parsed as Record<string, unknown>;
  } catch (err) {
    log.warn('could not read', key, err);
    return null;
  }
}

/** Writes `value` as JSON. Returns false when the write failed. */
export function writeStored(key: string, value: unknown, storage: StorageLike | null): boolean {
  if (!storage) return false;
  try {
    storage.setItem(key, JSON.stringify(value));
    return true;
  } catch (err) {
    log.warn('could not save', key, err);
    return false;
  }
}

// ─── Validation helpers ─────────────────────────────────────────────────────
/** A finite number from unknown data, else the fallback. */
export function asNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/** A non-negative integer from unknown data, else the fallback. */
export function asCount(value: unknown, fallback: number): number {
  const n = asNumber(value, fallback);
  return n >= 0 ? Math.floor(n) : fallback;
}

export function asBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

export function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}
