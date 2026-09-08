// ─── Level JSON hot reload ──────────────────────────────────────────────────
// src/levels/index.ts builds its map with import.meta.glob, so editing any level JSON
// invalidates that module. Accepting it here keeps the update from bubbling up to a
// full page reload: listeners rebuild the running level in place instead.
//
// The accepted module namespace is cached here because this module is not re-executed
// on an update, so its own `LEVELS` import would keep pointing at the old data.
// In a production build import.meta.hot is undefined and all of this is inert.
import { DEFAULT_LEVEL_ID, LEVELS, LEVEL_ORDER } from '../levels';
import type { LevelDef } from '../levels/schema';
import { log } from '../log';

export interface LevelsSnapshot {
  levels: Record<string, LevelDef>;
  order: string[];
}

type LevelsModule = { LEVELS?: Record<string, LevelDef>; LEVEL_ORDER?: string[] };

const listeners = new Set<(snapshot: LevelsSnapshot) => void>();
let snapshot: LevelsSnapshot = { levels: LEVELS, order: LEVEL_ORDER };

/** The levels as they stand right now, including any hot-reloaded edits. */
export function currentLevels(): LevelsSnapshot {
  return snapshot;
}

/** First level in play order. Scenes go through here so nothing else imports src/levels. */
export function defaultLevelId(): string {
  return snapshot.order[0] ?? DEFAULT_LEVEL_ID;
}

/** Calls back with the new levels whenever a level JSON changes. Returns a disposer. */
export function onLevelsHotReload(listener: (next: LevelsSnapshot) => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

// The dependency path must be a literal: Vite resolves it at transform time.
// This must stay the only module in the browser graph that imports '../levels',
// otherwise an update bubbles past it and Vite falls back to a full page reload.
if (import.meta.hot) {
  import.meta.hot.accept('../levels', (updated) => {
    const next = updated as LevelsModule | undefined;
    if (!next?.LEVELS || !next.LEVEL_ORDER) {
      log.warn('level hot reload delivered no levels; keeping the old ones');
      return;
    }
    snapshot = { levels: next.LEVELS, order: next.LEVEL_ORDER };
    log.info('levels hot reloaded:', snapshot.order.join(', '));
    for (const listener of listeners) listener(snapshot);
  });
}
