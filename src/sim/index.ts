// ─── Sim public surface ─────────────────────────────────────────────────────
// STUB: the sim agent replaces the class body. The constructor/step/getState signatures,
// the types module, constants, and recipes are the contract.
import type { LevelDef } from '../levels/schema';
import { parseGrid } from '../levels/schema';
import { CHEF_HITBOX, CHEF_SPEED, SIM_DT } from './constants';
import type { Facing, PlayerInput, SimEvent, SimState, Tile } from './types';

export { SIM_DT } from './constants';
export * from './types';
export { RECIPES } from './recipes';

export interface SimOptions {
  players: number; // 1 or 2
  seed: number;    // deterministic order sequence
}

const SOLID: ReadonlySet<Tile['type']> = new Set([
  'void', 'counter', 'crate', 'board', 'stove', 'sink', 'drying', 'plateReturn', 'serve', 'trash', 'plateStack', 'slider',
]);

export class Sim {
  readonly level: LevelDef;
  private state: SimState;

  constructor(level: LevelDef, opts: SimOptions) {
    this.level = level;
    const parsed = parseGrid(level);
    const chefs = level.spawns.slice(0, opts.players).map((s, i) => ({
      index: i, x: s.x + 0.5, y: s.y + 0.5, facing: 'down' as Facing, holding: null, action: 'idle' as const, actionProgress: 0,
    }));
    this.state = {
      width: parsed.width,
      height: parsed.height,
      tiles: parsed.tiles,
      tileItems: parsed.items,
      chefs,
      fires: [],
      orders: [],
      pedestrians: [],
      sliders: [],
      score: 0,
      timeLeft: level.timeLimitSec,
      phase: level.timerStartsOnFirstServe ? 'prep' : 'running',
      timerRunning: !level.timerStartsOnFirstServe,
      elapsed: 0,
      servedCount: 0,
      failedCount: 0,
      pendingPlateReturns: [],
      stars: 0,
      tipStreak: 0,
    };
  }

  getState(): Readonly<SimState> { return this.state; }

  step(inputs: readonly PlayerInput[], dt: number = SIM_DT): SimEvent[] {
    const events: SimEvent[] = [];
    const st = this.state;
    st.elapsed += dt;
    st.chefs.forEach((chef, i) => {
      const inp = inputs[i];
      if (!inp) return;
      const len = Math.hypot(inp.moveX, inp.moveY);
      if (len < 0.2) { chef.action = 'idle'; return; }
      const nx = inp.moveX / Math.max(1, len), ny = inp.moveY / Math.max(1, len);
      chef.facing = Math.abs(nx) > Math.abs(ny) ? (nx > 0 ? 'right' : 'left') : (ny > 0 ? 'down' : 'up');
      chef.action = 'walking';
      const half = CHEF_HITBOX / 2;
      const tryX = chef.x + nx * CHEF_SPEED * dt;
      if (this.free(tryX - half, chef.y - half) && this.free(tryX + half, chef.y - half) && this.free(tryX - half, chef.y + half) && this.free(tryX + half, chef.y + half)) chef.x = tryX;
      const tryY = chef.y + ny * CHEF_SPEED * dt;
      if (this.free(chef.x - half, tryY - half) && this.free(chef.x + half, tryY - half) && this.free(chef.x - half, tryY + half) && this.free(chef.x + half, tryY + half)) chef.y = tryY;
    });
    return events;
  }

  private free(x: number, y: number): boolean {
    const tx = Math.floor(x), ty = Math.floor(y);
    if (tx < 0 || ty < 0 || tx >= this.state.width || ty >= this.state.height) return false;
    return !SOLID.has(this.state.tiles[ty * this.state.width + tx].type);
  }
}
