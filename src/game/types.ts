// ─── Scene data contracts ───────────────────────────────────────────────────
// Payloads passed to scene.start(). Presentation-owned, kept in one place so the
// integrator and every scene agree on the shape.
import type { Modifiers } from '../sim/types';

export interface GameSceneData {
  levelId?: string;
  players?: number;
  seed?: number;          // absent = the scene picks one (settings decide random / daily / fixed)
  modifiers?: Modifiers;  // absent = the settings' difficulty preset
}

export interface ResultsSceneData {
  levelId: string;
  players: number;
  score: number;
  stars: number;
  servedCount: number;
  failedCount: number;
  thresholds: [number, number, number]; // 1-star, 2-star, 3-star score for this player count
  seed?: number;
  modifiers?: Modifiers;
}
