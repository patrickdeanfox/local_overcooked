// ─── Art module ─────────────────────────────────────────────────────────────
// Every texture the game uses is drawn here with a 2D canvas context at boot —
// there are no image files. generateTextures() must produce every key in
// ALL_TEXTURE_KEYS() and is idempotent: keys that already exist are skipped, so
// a scene restart costs nothing.
//
// Layout convention: tiles are 64x64 with a fake 3/4 view (lit top face, ~10 px
// darker front edge), items are 40x40 centred and transparent, chefs are 64x80
// with their feet on the bottom edge, icons are 32x32.
import type Phaser from 'phaser';
import { log } from '../log';
import { ALL_TEXTURE_KEYS } from './keys';
import { generateTileTextures } from './tiles';
import { generateItemTextures } from './items';
import { generateChefTextures } from './chefs';
import { generateUiTextures } from './ui';

export * from './keys';
export { PALETTE, PALETTE_INT, hexToInt, type PaletteName } from './palette';
export { drawIngredient, drawPlate, drawPot, soupColor } from './items';
export { FONT_STACK } from './draw';

// ─── Timing ─────────────────────────────────────────────────────────────────

function nowMs(): number {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}

// ─── Entry point ────────────────────────────────────────────────────────────

/** Draw every texture in ALL_TEXTURE_KEYS() into the scene's texture manager. */
export function generateTextures(scene: Phaser.Scene): void {
  const startedAt = nowMs();

  generateTileTextures(scene);
  generateItemTextures(scene);
  generateChefTextures(scene);
  generateUiTextures(scene);

  const keys = ALL_TEXTURE_KEYS();
  const missing = keys.filter((key) => !scene.textures.exists(key));
  if (missing.length > 0) log.error('art: textures missing after generation', missing);
  log.info(`art: ${keys.length - missing.length}/${keys.length} textures in ${Math.round(nowMs() - startedAt)} ms`);
}
