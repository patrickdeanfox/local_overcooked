// ─── Debug overlay ──────────────────────────────────────────────────────────
// F3 or backtick. Off by default. Shows frame/sim timing, chef state, orders, the
// last events, and tile coordinates over the kitchen.
import Phaser from 'phaser';
import { TILE } from '../../config';
import { log } from '../../log';
import type { Item, SimEvent, SimState } from '../../sim/types';
import type { KitchenRenderer, TilePos } from '../render/KitchenRenderer';
import { FONT_FAMILY } from './theme';

const OVERLAY = {
  x: 12,
  y: 150,
  width: 470,
  paddingPx: 10,
  fontPx: 12,
  lineSpacingPx: 2,
  bgColor: 0x000000,
  bgAlpha: 0.62,
  color: '#9ef7a0',
  depth: 5000,
  maxEvents: 12,
} as const;

const GRID_LABEL = {
  fontPx: 9,
  color: '#ffffff',
  alpha: 0.55,
  offsetXPx: 3,
  offsetYPx: 2,
  lineColor: 0xffffff,
  lineAlpha: 0.18,
  lineWidthPx: 1,
} as const;

export interface DebugFrame {
  levelId: string;
  seed: number;      // the run's seed; SimState.seed wins when the sim reports one
  steps: number;
  stepMs: number;
  events: readonly SimEvent[];
  targets: readonly (TilePos | null)[];
  fake: boolean;
  paused: boolean;
}

// ─── Pure helpers ───────────────────────────────────────────────────────────
function describeItem(item: Item | null): string {
  if (!item) return '-';
  switch (item.kind) {
    case 'ingredient':
      return `${item.type}${item.chopped ? ':chopped' : `:raw(${item.chopProgress.toFixed(2)})`}`;
    case 'pot':
      return `pot[${item.contents.join(',')}] ${item.state} cook=${item.cookProgress.toFixed(2)} burn=${item.burnProgress.toFixed(2)}`;
    case 'plate':
      return item.dish ? `plate[${item.dish.ingredients.join(',')}]` : 'plate';
    case 'dirtyPlate':
      return `dirtyPlate x${item.count}`;
    case 'extinguisher':
      return 'extinguisher';
    case 'tray':
      return `tray[${item.items.map((load) => describeItem(load)).join(' | ')}]`;
  }
}

function describeEvent(event: SimEvent): string {
  const bits: string[] = [event.type];
  if (event.chef !== undefined) bits.push(`c${event.chef}`);
  if (event.x !== undefined && event.y !== undefined) bits.push(`@${event.x},${event.y}`);
  if (event.value !== undefined) bits.push(`=${event.value}`);
  return bits.join(' ');
}

// ─── Overlay ────────────────────────────────────────────────────────────────
export class DebugOverlay {
  private readonly root: Phaser.GameObjects.Container;
  private readonly background: Phaser.GameObjects.Rectangle;
  private readonly text: Phaser.GameObjects.Text;
  private readonly recentEvents: string[] = [];
  private gridLayer: Phaser.GameObjects.Container | null = null;
  private visible = false;

  constructor(private readonly scene: Phaser.Scene, private renderer: KitchenRenderer) {
    this.root = scene.add.container(0, 0).setDepth(OVERLAY.depth).setVisible(false);
    this.background = scene.add
      .rectangle(OVERLAY.x, OVERLAY.y, OVERLAY.width, 10, OVERLAY.bgColor, OVERLAY.bgAlpha)
      .setOrigin(0, 0);
    this.text = scene.add.text(OVERLAY.x + OVERLAY.paddingPx, OVERLAY.y + OVERLAY.paddingPx, '', {
      fontFamily: 'monospace',
      fontSize: `${OVERLAY.fontPx}px`,
      color: OVERLAY.color,
      lineSpacing: OVERLAY.lineSpacingPx,
    });
    this.root.add([this.background, this.text]);
  }

  get isVisible(): boolean { return this.visible; }

  toggle(): void {
    this.visible = !this.visible;
    this.root.setVisible(this.visible);
    if (this.visible && !this.gridLayer) this.buildGrid();
    this.gridLayer?.setVisible(this.visible);
    log.info('debug overlay', this.visible ? 'on' : 'off');
  }

  /** After a level hot reload the renderer is a new object; the grid follows it. */
  setRenderer(renderer: KitchenRenderer): void {
    this.renderer = renderer;
    this.gridLayer?.destroy(true);
    this.gridLayer = null;
    if (this.visible) this.buildGrid();
  }

  update(state: Readonly<SimState>, frame: DebugFrame): void {
    for (const event of frame.events) {
      this.recentEvents.push(describeEvent(event));
      if (this.recentEvents.length > OVERLAY.maxEvents) this.recentEvents.shift();
    }
    if (!this.visible) return;

    const lines: string[] = [];
    lines.push(
      `fps ${this.scene.game.loop.actualFps.toFixed(1)}  steps ${frame.steps}  sim ${frame.stepMs.toFixed(2)}ms` +
        `${frame.fake ? '  [FAKE STATE]' : ''}${frame.paused ? '  [PAUSED]' : ''}`,
    );
    lines.push(
      `${frame.levelId}  seed ${state.seed ?? frame.seed}  phase ${state.phase}` +
        `${state.timerRunning ? '' : ' (timer held)'}  t ${state.timeLeft.toFixed(1)}  elapsed ${state.elapsed.toFixed(1)}`,
    );
    lines.push(
      `score ${state.score}  stars ${state.stars}  served ${state.servedCount}  failed ${state.failedCount}` +
        `  streak ${state.tipStreak}  fires ${state.fires.length}  peds ${state.pedestrians.length}`,
    );
    if (state.gates && state.gates.length > 0) {
      lines.push(
        `gates: ${state.gates.map((g) => `${g.id} ${g.open ? 'open' : 'shut'} ${g.secondsToChange.toFixed(1)}s`).join('  ')}`,
      );
    }
    state.chefs.forEach((chef, i) => {
      const target = frame.targets[i];
      lines.push(
        `chef${chef.index} ${chef.x.toFixed(2)},${chef.y.toFixed(2)} ${chef.facing} ${chef.action}` +
          ` p=${chef.actionProgress.toFixed(2)} hold=${describeItem(chef.holding)}` +
          ` tgt=${target ? `${target.x},${target.y}` : '-'}`,
      );
    });
    lines.push(
      state.orders.length === 0
        ? 'orders: none'
        : `orders: ${state.orders.map((o) => `#${o.id} ${o.recipeId}${o.originalRecipeId ? `(was ${o.originalRecipeId})` : ''} ${o.timeLeft.toFixed(1)}/${o.timeTotal}`).join('  ')}`,
    );
    const stocked = state.tiles.filter((t) => t.type === 'crate' && t.stock !== undefined);
    if (stocked.length > 0) {
      lines.push(`stock: ${stocked.map((t) => `${t.ingredient ?? '?'}@${t.x},${t.y} ${t.stock}/${t.capacity ?? '?'}`).join('  ')}`);
    }
    if (state.restocks && state.restocks.length > 0) {
      lines.push(`restocks: ${state.restocks.map((r) => `${r.ingredient} ${r.arrivesIn > 0 ? `in ${r.arrivesIn.toFixed(1)}s` : `unloading ${r.unloaded.toFixed(2)}`}`).join('  ')}`);
    }
    lines.push('events:');
    for (const entry of this.recentEvents) lines.push(`  ${entry}`);

    this.text.setText(lines);
    this.background.setSize(OVERLAY.width, this.text.height + OVERLAY.paddingPx * 2);
  }

  destroy(): void {
    this.gridLayer?.destroy(true);
    this.gridLayer = null;
    this.root.destroy(true);
  }

  // ─── Tile coordinates over the kitchen ────────────────────────────────────
  private buildGrid(): void {
    const layer = this.scene.add.container(0, 0);
    const graphics = this.scene.add.graphics();
    graphics.lineStyle(GRID_LABEL.lineWidthPx, GRID_LABEL.lineColor, GRID_LABEL.lineAlpha);
    const { width, height } = this.renderer.gridSize;
    // Each tile is a quad whose corners are projected through the kitchen camera.
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const corners = [
          this.renderer.tileToScreen(x, y), this.renderer.tileToScreen(x + 1, y),
          this.renderer.tileToScreen(x + 1, y + 1), this.renderer.tileToScreen(x, y + 1),
        ];
        graphics.strokePoints(corners.map((c) => new Phaser.Geom.Point(c.x, c.y)), true);
      }
    }
    layer.add(graphics);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const corner = this.renderer.tileToScreen(x, y);
        const label = this.scene.add
          .text(corner.x + GRID_LABEL.offsetXPx, corner.y + GRID_LABEL.offsetYPx, `${x},${y}`, {
            fontFamily: FONT_FAMILY,
            fontSize: `${GRID_LABEL.fontPx}px`,
            color: GRID_LABEL.color,
          })
          .setAlpha(GRID_LABEL.alpha);
        layer.add(label);
      }
    }
    this.renderer.container.add(layer);
    this.gridLayer = layer;
  }
}
