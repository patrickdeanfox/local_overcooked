// ─── Top-level configuration ────────────────────────────────────────────────
// Presentation constants. Simulation tuning lives in src/sim/constants.ts.

export const DEBUG = true; // gates all console output (see src/log.ts)

export const GAME_WIDTH = 1280;
export const GAME_HEIGHT = 800;
export const TILE = 64; // pixels per tile at native resolution
export const MAX_PLAYERS = 2;

export const SCENE = {
  BOOT: 'Boot',
  TITLE: 'Title',
  CONTROLLER: 'Controller',
  ASSISTS: 'Assists',
  GAME: 'Game',
  RESULTS: 'Results',
} as const;

export const STORAGE_KEYS = {
  BINDINGS: 'local-overcooked.bindings.v1',
  MUTED: 'local-overcooked.muted.v1',
  PROGRESS: 'local-overcooked.progress.v1',  // best score and stars per level id
  SETTINGS: 'local-overcooked.settings.v1',  // players, difficulty preset, seed mode, free play, assists
} as const;
