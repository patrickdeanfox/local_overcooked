import type { LevelDef } from './schema';

export type { LevelDef } from './schema';
export { validateLevel, parseGrid, LEGEND } from './schema';

/** The order games appear in the level list: the campaigns first, then the clone's own kitchens.
 *  An explicit rank, because 'custom' sorts before 'oc1' alphabetically. */
const GAME_ORDER: readonly LevelDef['game'][] = ['oc1', 'oc2', 'custom'];
function gameRank(game: LevelDef['game']): number {
  const at = GAME_ORDER.indexOf(game);
  return at < 0 ? GAME_ORDER.length : at;
}

// Every JSON under src/levels/**/ is a level. Vite HMR keeps this map fresh; the presentation
// agent wires import.meta.hot to reload the running level when its file changes.
const modules = import.meta.glob<LevelDef>('./**/*.json', { eager: true, import: 'default' });

export const LEVELS: Record<string, LevelDef> = {};
for (const def of Object.values(modules)) LEVELS[def.id] = def;

export const LEVEL_ORDER: string[] = Object.values(LEVELS)
  .sort((a, b) => gameRank(a.game) - gameRank(b.game) || a.world - b.world || a.index - b.index)
  .map((l) => l.id);

export const DEFAULT_LEVEL_ID = LEVEL_ORDER[0] ?? 'oc1-1-1';
