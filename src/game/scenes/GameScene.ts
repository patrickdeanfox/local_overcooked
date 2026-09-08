import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH, SCENE, TILE } from '../../config';
import { Sim, SIM_DT } from '../../sim';
import type { PlayerInput } from '../../sim/types';
import { LEVELS, DEFAULT_LEVEL_ID } from '../../levels';
import { createInputManager, type InputManager } from '../../input';

export interface GameSceneData { levelId?: string; players?: number; }

// STUB renderer: presentation agent replaces this. Draws tiles and chefs from SimState every frame.
export class GameScene extends Phaser.Scene {
  private sim!: Sim;
  private inputMgr!: InputManager;
  private accumulator = 0;
  private gfx!: Phaser.GameObjects.Graphics;
  private originX = 0;
  private originY = 0;

  constructor() { super(SCENE.GAME); }

  create(data: GameSceneData): void {
    const level = LEVELS[data.levelId ?? DEFAULT_LEVEL_ID];
    this.sim = new Sim(level, { players: data.players ?? 2, seed: 1 });
    this.inputMgr = createInputManager(this, data.players ?? 2);
    const st = this.sim.getState();
    this.originX = Math.floor((GAME_WIDTH - st.width * TILE) / 2);
    this.originY = Math.floor((GAME_HEIGHT - st.height * TILE) / 2);
    this.gfx = this.add.graphics();
    this.input.keyboard?.once('keydown-ESC', () => { this.inputMgr.destroy(); this.scene.start(SCENE.TITLE); });
  }

  override update(_time: number, deltaMs: number): void {
    this.accumulator += Math.min(deltaMs / 1000, 0.25);
    const inputs: PlayerInput[] = this.inputMgr.poll();
    while (this.accumulator >= SIM_DT) {
      this.sim.step(inputs, SIM_DT);
      this.accumulator -= SIM_DT;
    }
    this.draw();
  }

  private draw(): void {
    const st = this.sim.getState();
    const g = this.gfx;
    g.clear();
    for (const t of st.tiles) {
      const color = t.type === 'floor' || t.type === 'road' ? 0x3b3b46 : t.type === 'void' ? 0x1a1210 : 0xc9a06a;
      g.fillStyle(color, 1);
      g.fillRect(this.originX + t.x * TILE + 1, this.originY + t.y * TILE + 1, TILE - 2, TILE - 2);
    }
    for (const c of st.chefs) {
      g.fillStyle(c.index === 0 ? 0x4a90e2 : 0xe24a4a, 1);
      g.fillCircle(this.originX + c.x * TILE, this.originY + c.y * TILE, TILE * 0.35);
    }
  }
}
