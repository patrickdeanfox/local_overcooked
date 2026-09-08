import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH, SCENE } from '../../config';
import { generateTextures } from '../../art';
import { log } from '../../log';
import { loadAllModels } from '../render/three/loader';
import { textStyle } from '../ui/theme';

const LOADING = { fontPx: 24, text: 'Loading the kitchen…' } as const;

// Generates all code-drawn textures, loads the 3D models once, then hands off to the title.
export class BootScene extends Phaser.Scene {
  constructor() { super(SCENE.BOOT); }
  create(): void {
    generateTextures(this);
    this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2, LOADING.text, textStyle(LOADING.fontPx)).setOrigin(0.5);
    loadAllModels()
      .catch((err: unknown) => log.error('boot: model loading failed', err))
      .then(() => this.scene.start(SCENE.TITLE));
  }
}
