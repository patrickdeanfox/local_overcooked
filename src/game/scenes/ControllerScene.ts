import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH, SCENE } from '../../config';

// STUB: input agent replaces this with the live remap screen. Esc returns to title.
export class ControllerScene extends Phaser.Scene {
  constructor() { super(SCENE.CONTROLLER); }
  create(): void {
    this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2, 'Controller setup (stub)\nEsc: back', { fontSize: '28px', color: '#ffffff', align: 'center' }).setOrigin(0.5);
    this.input.keyboard?.once('keydown-ESC', () => this.scene.start(SCENE.TITLE));
  }
}
