// STUB: art+audio agent replaces with real code-drawn art. Must generate every key in ALL_TEXTURE_KEYS().
import type Phaser from 'phaser';
import { ALL_TEXTURE_KEYS, TEXTURE_SIZES } from './keys';
export * from './keys';

const STUB_COLORS: Record<string, number> = {
  'tile.void': 0x1a1210, 'tile.floor': 0x3b3b46, 'tile.road': 0x55555e, 'tile.counter': 0xc9a06a, 'tile.board': 0xe0c58c,
  'tile.stove': 0x444444, 'tile.sink': 0x8fb8c8, 'tile.drying': 0xa8c4d0, 'tile.plateReturn': 0x777777, 'tile.serve': 0x7ac36a,
  'tile.trash': 0x2e6b2e, 'tile.plateStack': 0xd8d8d8, 'tile.slider': 0x7f9a7f,
};

export function generateTextures(scene: Phaser.Scene): void {
  for (const key of ALL_TEXTURE_KEYS()) {
    if (scene.textures.exists(key)) continue;
    const isTile = key.startsWith('tile.');
    const isChef = key.startsWith('chef.');
    const w = isTile ? TEXTURE_SIZES.tile : isChef ? TEXTURE_SIZES.chefW : TEXTURE_SIZES.item;
    const h = isTile ? TEXTURE_SIZES.tile : isChef ? TEXTURE_SIZES.chefH : TEXTURE_SIZES.item;
    const g = scene.make.graphics({ x: 0, y: 0 }, false);
    g.fillStyle(STUB_COLORS[key] ?? (key.startsWith('tile.crate') ? 0xb07a3a : 0xff00ff), 1);
    g.fillRect(0, 0, w, h);
    g.generateTexture(key, w, h);
    g.destroy();
  }
}
