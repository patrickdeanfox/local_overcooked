import Phaser from 'phaser';
import { SCENE } from '../../config';
import { generateTextures } from '../../art';

// Generates all code-drawn textures once, then hands off to the title.
export class BootScene extends Phaser.Scene {
  constructor() { super(SCENE.BOOT); }
  create(): void {
    generateTextures(this);
    this.scene.start(SCENE.TITLE);
  }
}
