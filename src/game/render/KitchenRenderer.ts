// ─── Kitchen renderer ───────────────────────────────────────────────────────
// Draws a SimState snapshot. Owns no game logic and never mutates the state it is
// given. Sprites are pooled in maps keyed by tile index / entity id, so a frame only
// updates textures, positions and visibility.
//
// Everything lives inside one container placed and scaled to fit the play area, so
// child coordinates are always native pixels (TILE = 64) regardless of level size.
import Phaser from 'phaser';
import { TEX } from '../../art/keys';
import { GAME_HEIGHT, GAME_WIDTH, TILE } from '../../config';
import {
  FACING_VECTORS,
  type Chef,
  type Item,
  type SimState,
  type Tile,
} from '../../sim/types';
import { CHEF_COLORS, COLOR } from '../ui/theme';

// ─── Constants ──────────────────────────────────────────────────────────────
const LAYOUT = {
  hudTopPx: 140,    // order cards
  hudBottomPx: 78,  // score / timer row
  marginXPx: 24,
  maxScale: 1,
} as const;

const CHEF_DRAW = {
  feetOffsetPx: 16,        // sprite bottom sits this far below the chef centre
  bobPx: 3,
  bobSpeedRad: 11,         // walk bob, radians per second
  heldLiftPx: 46,
  heldFacingOffsetPx: 16,
  heldScale: 0.85,
} as const;

const ITEM_DRAW = {
  liftPx: 6,               // items sit slightly above the tile centre
  badgeOffsetXPx: 15,
  badgeOffsetYPx: 12,
  badgeFontPx: 13,
} as const;

const PEDESTRIAN_DRAW = { tint: 0x9aa0a8, alpha: 0.95 } as const;

const HIGHLIGHT = { lineWidthPx: 3, alpha: 0.9, insetPx: 3, radiusPx: 6 } as const;

const BAR = {
  widthPx: 46,
  heightPx: 8,
  aboveTilePx: 34,
  borderPx: 2,
  trackAlpha: 0.85,
  flashSpeedRad: 9,
  flashMinAlpha: 0.35,
} as const;

const WARN_ICON = { widthPx: 16, heightPx: 14, aboveBarPx: 10 } as const;

const FIRE_FX = { flickerMs: 220, scaleFrom: 0.82, scaleTo: 1.14, alphaTo: 0.7 } as const;

const SPRAY_FX = {
  intervalSec: 0.05,
  lifeMs: 240,
  distancePx: 40,
  jitterPx: 12,
  scaleFrom: 0.6,
  scaleTo: 1.3,
} as const;

const BADGE_STYLE: Phaser.Types.GameObjects.Text.TextStyle = {
  fontFamily: 'monospace',
  fontSize: `${ITEM_DRAW.badgeFontPx}px`,
  color: '#ffffff',
  backgroundColor: '#00000099',
  padding: { x: 3, y: 1 },
};

export interface TilePos { x: number; y: number; }

// ─── Pure helpers ───────────────────────────────────────────────────────────
function tileTexture(tile: Tile): string {
  if (tile.type === 'crate') return TEX.crate(tile.ingredient ?? 'onion');
  return TEX.tile(tile.type);
}

/** Texture for an item resting on a tile or held by a chef. */
export function itemTexture(item: Item): string {
  switch (item.kind) {
    case 'ingredient':
      return TEX.ingredient(item.type, item.chopped);
    case 'pot':
      if (item.state === 'burnt') return TEX.potBurnt;
      return item.contents.length > 0 ? TEX.potSoup(item.contents[0]) : TEX.pot;
    case 'plate':
      return item.dish && item.dish.ingredients.length > 0 ? TEX.plateSoup(item.dish.ingredients[0]) : TEX.plate;
    case 'dirtyPlate':
      return TEX.dirtyPlate;
    case 'extinguisher':
      return TEX.extinguisher;
  }
}

/** Stack size drawn as a badge, or 1 when the item is not a stack. */
function itemCount(item: Item): number {
  return item.kind === 'dirtyPlate' ? item.count : 1;
}

function fireKey(x: number, y: number): string {
  return `${x},${y}`;
}

// ─── Renderer ───────────────────────────────────────────────────────────────
export class KitchenRenderer {
  readonly container: Phaser.GameObjects.Container;

  private readonly tileLayer: Phaser.GameObjects.Container;
  private readonly highlightGfx: Phaser.GameObjects.Graphics;
  private readonly itemLayer: Phaser.GameObjects.Container;
  private readonly actorLayer: Phaser.GameObjects.Container;
  private readonly fxLayer: Phaser.GameObjects.Container;
  private readonly barsGfx: Phaser.GameObjects.Graphics;

  private readonly tileSprites: Phaser.GameObjects.Image[] = [];
  private readonly sliderTiles: number[] = [];
  private readonly sliderFloorSprites: Phaser.GameObjects.Image[] = [];
  private readonly itemSprites = new Map<number, Phaser.GameObjects.Image>();
  private readonly itemBadges = new Map<number, Phaser.GameObjects.Text>();
  private readonly chefSprites = new Map<number, Phaser.GameObjects.Image>();
  private readonly heldSprites = new Map<number, Phaser.GameObjects.Image>();
  private readonly pedSprites = new Map<number, Phaser.GameObjects.Image>();
  private readonly fireSprites = new Map<string, Phaser.GameObjects.Image>();
  private readonly fireTweens = new Map<string, Phaser.Tweens.Tween>();
  private readonly sprayTweens = new Set<Phaser.Tweens.Tween>();

  private readonly bobPhase: number[] = [];
  private readonly sprayTimer: number[] = [];
  private readonly sliderOffsets = new Map<string, { x: number; y: number }>();
  private gridW = 0;
  private gridH = 0;
  private elapsed = 0;
  private scaleFactor = 1;

  constructor(private readonly scene: Phaser.Scene, state: Readonly<SimState>) {
    this.container = scene.add.container(0, 0);
    this.tileLayer = scene.add.container(0, 0);
    this.highlightGfx = scene.add.graphics();
    this.itemLayer = scene.add.container(0, 0);
    this.actorLayer = scene.add.container(0, 0);
    this.fxLayer = scene.add.container(0, 0);
    this.barsGfx = scene.add.graphics();
    this.container.add([
      this.tileLayer,
      this.highlightGfx,
      this.itemLayer,
      this.actorLayer,
      this.fxLayer,
      this.barsGfx,
    ]);
    this.buildGrid(state);
  }

  /** Scale applied to the kitchen container, for callers that mix screen and tile space. */
  get scaleValue(): number { return this.scaleFactor; }

  /** Grid size the sprites were built for, in tiles. */
  get gridSize(): { width: number; height: number } { return { width: this.gridW, height: this.gridH }; }

  /** Screen position of a tile's top-left corner. */
  tileToScreen(tx: number, ty: number): TilePos {
    return {
      x: this.container.x + tx * TILE * this.scaleFactor,
      y: this.container.y + ty * TILE * this.scaleFactor,
    };
  }

  draw(state: Readonly<SimState>, targets: readonly (TilePos | null)[], dtSec: number): void {
    if (state.width !== this.gridW || state.height !== this.gridH) this.buildGrid(state);
    this.elapsed += dtSec;
    this.readSliderOffsets(state);
    this.drawTiles(state);
    this.drawTileItems(state);
    this.drawHighlights(state, targets);
    this.drawChefs(state, dtSec);
    this.drawPedestrians(state);
    this.drawFires(state);
    this.drawSpray(state, dtSec);
    this.actorLayer.sort('depth');
    this.drawBars(state, targets);
  }

  destroy(): void {
    for (const tween of this.fireTweens.values()) tween.remove();
    this.fireTweens.clear();
    for (const tween of this.sprayTweens) tween.remove();
    this.sprayTweens.clear();
    this.container.destroy(true);
    this.tileSprites.length = 0;
    this.sliderFloorSprites.length = 0;
    this.sliderTiles.length = 0;
    this.itemSprites.clear();
    this.itemBadges.clear();
    this.chefSprites.clear();
    this.heldSprites.clear();
    this.pedSprites.clear();
    this.fireSprites.clear();
  }

  // ─── Layout and grid ──────────────────────────────────────────────────────
  private buildGrid(state: Readonly<SimState>): void {
    for (const sprite of this.tileSprites) sprite.destroy();
    this.tileSprites.length = 0;
    for (const sprite of this.sliderFloorSprites) sprite.destroy();
    this.sliderFloorSprites.length = 0;
    this.sliderTiles.length = 0;
    for (const sprite of this.itemSprites.values()) sprite.destroy();
    this.itemSprites.clear();
    for (const badge of this.itemBadges.values()) badge.destroy();
    this.itemBadges.clear();

    this.gridW = state.width;
    this.gridH = state.height;
    this.layout(state);

    state.tiles.forEach((tile, i) => {
      if (tile.type === 'slider') {
        // Floor shows through where a moving counter has slid away from its resting tile.
        const floor = this.scene.add
          .image(tile.x * TILE, tile.y * TILE, TEX.tile('floor'))
          .setOrigin(0, 0)
          .setDisplaySize(TILE, TILE);
        this.tileLayer.add(floor);
        this.sliderFloorSprites.push(floor);
      }
      const sprite = this.scene.add
        .image(tile.x * TILE, tile.y * TILE, tileTexture(tile))
        .setOrigin(0, 0)
        .setDisplaySize(TILE, TILE);
      this.tileLayer.add(sprite);
      this.tileSprites.push(sprite);
      if (tile.type === 'slider') this.sliderTiles.push(i);
    });
    // Moving counters draw above every static tile they slide over.
    for (const i of this.sliderTiles) this.tileLayer.bringToTop(this.tileSprites[i]);
  }

  /** Centres the kitchen in the play area, scaling down when it does not fit. */
  private layout(state: Readonly<SimState>): void {
    const availW = GAME_WIDTH - LAYOUT.marginXPx * 2;
    const availH = GAME_HEIGHT - LAYOUT.hudTopPx - LAYOUT.hudBottomPx;
    const gridW = Math.max(1, state.width * TILE);
    const gridH = Math.max(1, state.height * TILE);
    this.scaleFactor = Math.min(LAYOUT.maxScale, availW / gridW, availH / gridH);
    this.container.setScale(this.scaleFactor);
    this.container.setPosition(
      Math.round(LAYOUT.marginXPx + (availW - gridW * this.scaleFactor) / 2),
      Math.round(LAYOUT.hudTopPx + (availH - gridH * this.scaleFactor) / 2),
    );
  }

  private readSliderOffsets(state: Readonly<SimState>): void {
    this.sliderOffsets.clear();
    for (const group of state.sliders) {
      this.sliderOffsets.set(group.id, { x: group.offsetX * TILE, y: group.offsetY * TILE });
    }
  }

  private offsetFor(tile: Tile): { x: number; y: number } {
    if (tile.type !== 'slider' || !tile.group) return { x: 0, y: 0 };
    return this.sliderOffsets.get(tile.group) ?? { x: 0, y: 0 };
  }

  // ─── Layers ───────────────────────────────────────────────────────────────
  private drawTiles(state: Readonly<SimState>): void {
    for (const i of this.sliderTiles) {
      const tile = state.tiles[i];
      const sprite = this.tileSprites[i];
      if (!tile || !sprite) continue;
      const off = this.offsetFor(tile);
      sprite.setPosition(tile.x * TILE + off.x, tile.y * TILE + off.y);
    }
  }

  private drawTileItems(state: Readonly<SimState>): void {
    for (let i = 0; i < state.tileItems.length; i++) {
      const item = state.tileItems[i];
      const sprite = this.itemSprites.get(i);
      const badge = this.itemBadges.get(i);
      if (!item) {
        sprite?.setVisible(false);
        badge?.setVisible(false);
        continue;
      }
      const tile = state.tiles[i];
      const off = this.offsetFor(tile);
      const cx = tile.x * TILE + TILE / 2 + off.x;
      const cy = tile.y * TILE + TILE / 2 - ITEM_DRAW.liftPx + off.y;
      const view = sprite ?? this.makeItemSprite(i);
      view.setTexture(itemTexture(item));
      view.setPosition(cx, cy);
      view.setVisible(true);

      const count = itemCount(item);
      if (count > 1) {
        const label = badge ?? this.makeBadge(i);
        label.setText(`x${count}`);
        label.setPosition(cx + ITEM_DRAW.badgeOffsetXPx, cy + ITEM_DRAW.badgeOffsetYPx);
        label.setVisible(true);
      } else {
        badge?.setVisible(false);
      }
    }
  }

  private drawHighlights(state: Readonly<SimState>, targets: readonly (TilePos | null)[]): void {
    const g = this.highlightGfx;
    g.clear();
    state.chefs.forEach((chef, i) => {
      const target = targets[i];
      if (!target) return;
      const tile = state.tiles[target.y * state.width + target.x];
      if (!tile) return;
      const off = this.offsetFor(tile);
      const color = CHEF_COLORS[chef.index] ?? CHEF_COLORS[0];
      g.lineStyle(HIGHLIGHT.lineWidthPx, color, HIGHLIGHT.alpha);
      g.strokeRoundedRect(
        target.x * TILE + HIGHLIGHT.insetPx + off.x,
        target.y * TILE + HIGHLIGHT.insetPx + off.y,
        TILE - HIGHLIGHT.insetPx * 2,
        TILE - HIGHLIGHT.insetPx * 2,
        HIGHLIGHT.radiusPx,
      );
    });
  }

  private drawChefs(state: Readonly<SimState>, dtSec: number): void {
    const seen = new Set<number>();
    for (const chef of state.chefs) {
      seen.add(chef.index);
      const sprite = this.chefSprites.get(chef.index) ?? this.makeChefSprite(chef.index);
      const px = chef.x * TILE;
      const py = chef.y * TILE;
      const phase = (this.bobPhase[chef.index] ?? 0) + (chef.action === 'walking' ? dtSec * CHEF_DRAW.bobSpeedRad : 0);
      this.bobPhase[chef.index] = phase;
      const bob = chef.action === 'walking' ? -Math.abs(Math.sin(phase)) * CHEF_DRAW.bobPx : 0;
      sprite.setTexture(TEX.chef(chef.index, chef.facing));
      sprite.setPosition(px, py + CHEF_DRAW.feetOffsetPx + bob);
      sprite.setDepth(py);
      sprite.setVisible(true);
      this.drawHeldItem(chef, px, py + bob);
    }
    for (const [index, sprite] of this.chefSprites) {
      if (seen.has(index)) continue;
      sprite.setVisible(false);
      this.heldSprites.get(index)?.setVisible(false);
    }
  }

  private drawHeldItem(chef: Chef, px: number, py: number): void {
    const held = this.heldSprites.get(chef.index) ?? this.makeHeldSprite(chef.index);
    if (!chef.holding) {
      held.setVisible(false);
      return;
    }
    const facing = FACING_VECTORS[chef.facing];
    held.setTexture(itemTexture(chef.holding));
    held.setPosition(
      px + facing.dx * CHEF_DRAW.heldFacingOffsetPx,
      py - CHEF_DRAW.heldLiftPx + facing.dy * CHEF_DRAW.heldFacingOffsetPx,
    );
    held.setScale(CHEF_DRAW.heldScale);
    held.setDepth(py + 1);
    held.setVisible(true);
  }

  private drawPedestrians(state: Readonly<SimState>): void {
    const seen = new Set<number>();
    for (const ped of state.pedestrians) {
      seen.add(ped.id);
      const sprite = this.pedSprites.get(ped.id) ?? this.makePedSprite(ped.id);
      const py = ped.y * TILE;
      sprite.setPosition(ped.x * TILE, py + CHEF_DRAW.feetOffsetPx);
      sprite.setDepth(py);
      sprite.setVisible(true);
    }
    for (const [id, sprite] of this.pedSprites) {
      if (seen.has(id)) continue;
      sprite.destroy();
      this.pedSprites.delete(id);
    }
  }

  private drawFires(state: Readonly<SimState>): void {
    const seen = new Set<string>();
    for (const fire of state.fires) {
      const key = fireKey(fire.x, fire.y);
      seen.add(key);
      if (this.fireSprites.has(key)) continue;
      const sprite = this.scene.add
        .image(fire.x * TILE + TILE / 2, fire.y * TILE + TILE / 2, TEX.fire)
        .setOrigin(0.5, 0.5);
      this.fxLayer.add(sprite);
      this.fireSprites.set(key, sprite);
      this.fireTweens.set(
        key,
        this.scene.tweens.add({
          targets: sprite,
          scale: { from: FIRE_FX.scaleFrom, to: FIRE_FX.scaleTo },
          alpha: { from: 1, to: FIRE_FX.alphaTo },
          duration: FIRE_FX.flickerMs,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut',
        }),
      );
    }
    for (const [key, sprite] of this.fireSprites) {
      if (seen.has(key)) continue;
      this.fireTweens.get(key)?.remove();
      this.fireTweens.delete(key);
      sprite.destroy();
      this.fireSprites.delete(key);
    }
  }

  private drawSpray(state: Readonly<SimState>, dtSec: number): void {
    for (const chef of state.chefs) {
      const timer = (this.sprayTimer[chef.index] ?? 0) - dtSec;
      if (chef.action !== 'extinguishing') {
        this.sprayTimer[chef.index] = 0;
        continue;
      }
      if (timer > 0) {
        this.sprayTimer[chef.index] = timer;
        continue;
      }
      this.sprayTimer[chef.index] = SPRAY_FX.intervalSec;
      this.spawnSpray(chef);
    }
  }

  private spawnSpray(chef: Chef): void {
    const facing = FACING_VECTORS[chef.facing];
    const jitter = (Math.random() - 0.5) * SPRAY_FX.jitterPx;
    const sprite = this.scene.add
      .image(
        chef.x * TILE + facing.dx * SPRAY_FX.distancePx - facing.dy * jitter,
        chef.y * TILE + facing.dy * SPRAY_FX.distancePx - facing.dx * jitter,
        TEX.spray,
      )
      .setOrigin(0.5, 0.5)
      .setScale(SPRAY_FX.scaleFrom);
    this.fxLayer.add(sprite);
    const tween = this.scene.tweens.add({
      targets: sprite,
      scale: SPRAY_FX.scaleTo,
      alpha: 0,
      duration: SPRAY_FX.lifeMs,
      onComplete: () => {
        this.sprayTweens.delete(tween);
        sprite.destroy();
      },
    });
    this.sprayTweens.add(tween);
  }

  // ─── Progress bars ────────────────────────────────────────────────────────
  private drawBars(state: Readonly<SimState>, targets: readonly (TilePos | null)[]): void {
    const g = this.barsGfx;
    g.clear();
    for (let i = 0; i < state.tiles.length; i++) {
      const tile = state.tiles[i];
      const item = state.tileItems[i];
      if (!item) continue;
      if (tile.type === 'board' && item.kind === 'ingredient' && item.chopProgress > 0 && item.chopProgress < 1) {
        this.bar(tile, item.chopProgress, COLOR.barWarn, 1);
      }
      if (tile.type === 'stove' && item.kind === 'pot') {
        if (item.state === 'cooking') this.bar(tile, item.cookProgress, COLOR.barGood, 1);
        else if (item.state === 'cooked') {
          const flash = BAR.flashMinAlpha + (1 - BAR.flashMinAlpha) * (0.5 + 0.5 * Math.sin(this.elapsed * BAR.flashSpeedRad));
          this.bar(tile, item.burnProgress, COLOR.barDanger, flash);
          this.warningIcon(tile, flash);
        }
      }
    }
    for (const chef of state.chefs) {
      if (chef.action !== 'washing') continue;
      const target = targets[chef.index];
      if (!target) continue;
      const tile = state.tiles[target.y * state.width + target.x];
      if (!tile || tile.type !== 'sink') continue;
      this.bar(tile, chef.actionProgress, COLOR.barWash, 1);
    }
  }

  private bar(tile: Tile, progress: number, color: number, alpha: number): void {
    const off = this.offsetFor(tile);
    const x = tile.x * TILE + (TILE - BAR.widthPx) / 2 + off.x;
    const y = tile.y * TILE + TILE / 2 - BAR.aboveTilePx + off.y;
    const g = this.barsGfx;
    g.fillStyle(COLOR.barTrack, BAR.trackAlpha * alpha);
    g.fillRect(x - BAR.borderPx, y - BAR.borderPx, BAR.widthPx + BAR.borderPx * 2, BAR.heightPx + BAR.borderPx * 2);
    g.fillStyle(color, alpha);
    g.fillRect(x, y, BAR.widthPx * Phaser.Math.Clamp(progress, 0, 1), BAR.heightPx);
  }

  private warningIcon(tile: Tile, alpha: number): void {
    const off = this.offsetFor(tile);
    const cx = tile.x * TILE + TILE / 2 + off.x;
    const top = tile.y * TILE + TILE / 2 - BAR.aboveTilePx - WARN_ICON.aboveBarPx + off.y;
    const g = this.barsGfx;
    g.fillStyle(COLOR.barWarn, alpha);
    g.fillTriangle(cx, top - WARN_ICON.heightPx, cx - WARN_ICON.widthPx / 2, top, cx + WARN_ICON.widthPx / 2, top);
  }

  // ─── Sprite pools ─────────────────────────────────────────────────────────
  private makeItemSprite(index: number): Phaser.GameObjects.Image {
    const sprite = this.scene.add.image(0, 0, TEX.plate).setOrigin(0.5, 0.5);
    this.itemLayer.add(sprite);
    this.itemSprites.set(index, sprite);
    return sprite;
  }

  private makeBadge(index: number): Phaser.GameObjects.Text {
    const badge = this.scene.add.text(0, 0, '', BADGE_STYLE).setOrigin(0.5, 0.5);
    this.itemLayer.add(badge);
    this.itemBadges.set(index, badge);
    return badge;
  }

  private makeChefSprite(index: number): Phaser.GameObjects.Image {
    const sprite = this.scene.add.image(0, 0, TEX.chef(index, 'down')).setOrigin(0.5, 1);
    this.actorLayer.add(sprite);
    this.chefSprites.set(index, sprite);
    return sprite;
  }

  private makeHeldSprite(index: number): Phaser.GameObjects.Image {
    const sprite = this.scene.add.image(0, 0, TEX.plate).setOrigin(0.5, 0.5);
    this.actorLayer.add(sprite);
    this.heldSprites.set(index, sprite);
    return sprite;
  }

  private makePedSprite(id: number): Phaser.GameObjects.Image {
    const sprite = this.scene.add
      .image(0, 0, TEX.chef(0, 'down'))
      .setOrigin(0.5, 1)
      .setTint(PEDESTRIAN_DRAW.tint)
      .setAlpha(PEDESTRIAN_DRAW.alpha);
    this.actorLayer.add(sprite);
    this.pedSprites.set(id, sprite);
    return sprite;
  }
}
