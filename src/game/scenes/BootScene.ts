import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH, SCENE } from '../../config';
import { generateTextures } from '../../art';
import { log } from '../../log';
import { loadAllModels } from '../render/three/loader';
import { DISPLAY_FONT_FAMILY, FONT_FAMILY, textStyle } from '../ui/theme';

const LOADING = { fontPx: 24, text: 'Loading the kitchen…' } as const;
/** The self-hosted faces in index.html. Text is measured when it is created, so the title
 *  waits for them; a font that never arrives falls back after the timeout. */
const FONTS = {
  probes: [`400 20px ${FONT_FAMILY}`, `700 20px ${FONT_FAMILY}`, `400 20px ${DISPLAY_FONT_FAMILY}`],
  timeoutMs: 2500,
} as const;

async function loadFonts(): Promise<void> {
  if (typeof document === 'undefined' || !('fonts' in document)) return;
  const loads = FONTS.probes.map((probe) => document.fonts.load(probe));
  const timeout = new Promise<void>((resolve) => setTimeout(resolve, FONTS.timeoutMs));
  await Promise.race([Promise.all(loads).then(() => undefined), timeout]);
}

// Waits for the fonts, generates all code-drawn textures, loads the 3D models once, then
// hands off to the title.
export class BootScene extends Phaser.Scene {
  constructor() { super(SCENE.BOOT); }
  create(): void {
    this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2, LOADING.text, textStyle(LOADING.fontPx)).setOrigin(0.5);
    loadFonts()
      .catch((err: unknown) => log.warn('boot: font loading failed, using fallbacks', err))
      .then(() => {
        generateTextures(this);
        return loadAllModels();
      })
      .catch((err: unknown) => log.error('boot: model loading failed', err))
      .then(() => this.scene.start(SCENE.TITLE));
  }
}
