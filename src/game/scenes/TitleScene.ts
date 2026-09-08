import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH, SCENE } from '../../config';
import { LEVELS, DEFAULT_LEVEL_ID } from '../../levels';

// STUB: presentation agent replaces this. Space/Enter starts the default level; C opens controller setup.
export class TitleScene extends Phaser.Scene {
  constructor() { super(SCENE.TITLE); }
  create(): void {
    this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 40, 'LOCAL OVERCOOKED', { fontSize: '48px', color: '#ffffff' }).setOrigin(0.5);
    this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 30, `Space: play ${DEFAULT_LEVEL_ID}   C: controllers   (${Object.keys(LEVELS).length} levels)`, { fontSize: '20px', color: '#cccccc' }).setOrigin(0.5);
    this.input.keyboard?.once('keydown-SPACE', () => this.scene.start(SCENE.GAME, { levelId: DEFAULT_LEVEL_ID }));
    this.input.keyboard?.once('keydown-ENTER', () => this.scene.start(SCENE.GAME, { levelId: DEFAULT_LEVEL_ID }));
    this.input.keyboard?.once('keydown-C', () => this.scene.start(SCENE.CONTROLLER));
  }
}
