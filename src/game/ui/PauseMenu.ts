// ─── Pause overlay ──────────────────────────────────────────────────────────
// An overlay inside GameScene rather than a separate scene: the sim simply stops
// stepping while it is open. Besides the menu it shows the kitchen's own buttons and,
// on demand, the level's strategy (hidden until the Strategy row is switched on, so a
// pause never spoils the level by itself).
import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../../config';
import { getAudioBus, setMusicEnabled, setSfxEnabled } from '../audioBus';
import { MenuList } from './MenuList';
import type { MenuNav } from './menuInput';
import { paintPanel, roundedPanel } from './panel';
import { COLOR, displayStyle, TEXT_COLOR, textStyle } from './theme';

const PAUSE = {
  dimAlpha: 0.7,
  panelWidth: 460,
  panelHeight: 470,      // with the strategy hidden; it grows by the block when shown
  panelAlpha: 0.98,
  panelEdgePx: 3,
  titleOffsetY: -190,
  titleFontPx: 34,
  menuOffsetY: -112,
  menuSpacing: 44,
  strategyOffsetY: 150,  // top of the strategy block, under the last row
  strategyFontPx: 14,
  strategyWrapPx: 404,
  strategyLineSpacing: 3,
  strategyGapPx: 16,     // between the block and the controls line
  controlsOffsetY: 158,  // with the strategy hidden
  controlsFontPx: 15,
  hintGapPx: 26,         // the hint sits this far under the controls line
  hintFontPx: 14,
  depth: 2000,
} as const;

export interface PauseActions {
  onResume: () => void;
  onRestart: () => void;
  onQuit: () => void;
  hint?: string;     // the hint line in the player's own labels; a generic one when absent
  controls?: string; // the kitchen's own buttons (pick up, work, throw, dash), shown above the hint
  strategy?: string; // how to beat the level, behind the Strategy row
}

const DEFAULT_HINT = 'Move to choose · Pickup to confirm · left / right toggles';
const NO_STRATEGY = 'No strategy written for this kitchen yet';

export class PauseMenu {
  private readonly root: Phaser.GameObjects.Container;
  private readonly menu: MenuList;
  private readonly panel: Phaser.GameObjects.Graphics;
  private readonly strategyText: Phaser.GameObjects.Text;
  private readonly controlsText: Phaser.GameObjects.Text | null;
  private readonly hintText: Phaser.GameObjects.Text;
  private readonly cy: number;
  private open = false;
  private strategyShown = false;

  constructor(scene: Phaser.Scene, actions: PauseActions) {
    const cx = GAME_WIDTH / 2;
    const cy = GAME_HEIGHT / 2;
    this.cy = cy;
    this.root = scene.add.container(0, 0).setDepth(PAUSE.depth).setVisible(false);

    const dim = scene.add.rectangle(cx, cy, GAME_WIDTH, GAME_HEIGHT, COLOR.bg, PAUSE.dimAlpha).setOrigin(0.5);
    this.panel = roundedPanel(scene, PAUSE.panelWidth, PAUSE.panelHeight, {
      fill: COLOR.panel, alpha: PAUSE.panelAlpha, edge: COLOR.panelEdge, edgePx: PAUSE.panelEdgePx,
    }).setPosition(cx, cy);
    const title = scene.add
      .text(cx, cy + PAUSE.titleOffsetY, 'Paused', displayStyle(PAUSE.titleFontPx, TEXT_COLOR.accent))
      .setOrigin(0.5);
    this.strategyText = scene.add
      .text(cx, cy + PAUSE.strategyOffsetY, actions.strategy ?? NO_STRATEGY, textStyle(PAUSE.strategyFontPx, TEXT_COLOR.accent, {
        align: 'center', wordWrap: { width: PAUSE.strategyWrapPx },
      }))
      .setOrigin(0.5, 0)
      .setLineSpacing(PAUSE.strategyLineSpacing)
      .setVisible(false);
    this.controlsText = actions.controls
      ? scene.add.text(cx, cy + PAUSE.controlsOffsetY, actions.controls, textStyle(PAUSE.controlsFontPx, TEXT_COLOR.accent)).setOrigin(0.5)
      : null;
    this.hintText = scene.add
      .text(cx, cy + PAUSE.controlsOffsetY + PAUSE.hintGapPx, actions.hint ?? DEFAULT_HINT, textStyle(PAUSE.hintFontPx, TEXT_COLOR.dim))
      .setOrigin(0.5);
    this.root.add([dim, this.panel, title, this.strategyText, this.hintText]);
    if (this.controlsText) this.root.add(this.controlsText);

    const audio = getAudioBus();
    const toggleMusic = (): void => { setMusicEnabled(!audio.isMusicEnabled()); };
    const toggleSfx = (): void => { setSfxEnabled(!audio.isSfxEnabled()); };
    const toggleStrategy = (): void => { this.setStrategyShown(!this.strategyShown); };
    this.menu = new MenuList(
      scene,
      cx,
      cy + PAUSE.menuOffsetY,
      [
        { label: () => 'Resume', onSelect: actions.onResume },
        { label: () => 'Restart level', onSelect: actions.onRestart },
        { label: () => `Music: ${audio.isMusicEnabled() ? 'on' : 'off'}`, onSelect: toggleMusic, onLeft: toggleMusic, onRight: toggleMusic },
        { label: () => `Sound effects: ${audio.isSfxEnabled() ? 'on' : 'off'}`, onSelect: toggleSfx, onLeft: toggleSfx, onRight: toggleSfx },
        { label: () => 'Quit to title', onSelect: actions.onQuit },
        { label: () => `Strategy: ${this.strategyShown ? 'shown' : 'hidden'}`, onSelect: toggleStrategy, onLeft: toggleStrategy, onRight: toggleStrategy },
      ],
      { spacing: PAUSE.menuSpacing },
    );
    this.root.add(this.menu.container);
  }

  get isOpen(): boolean { return this.open; }

  toggle(): void {
    if (this.open) this.close();
    else this.show();
  }

  show(): void {
    if (this.open) return;
    this.open = true;
    this.menu.setIndex(0);
    this.root.setVisible(true);
    getAudioBus().play('uiConfirm');
  }

  close(): void {
    if (!this.open) return;
    this.open = false;
    this.root.setVisible(false);
    getAudioBus().play('uiBack');
  }

  update(nav: MenuNav): void {
    if (!this.open) return;
    this.menu.handle(nav);
    if (nav.confirm || nav.left || nav.right) this.menu.refresh(); // the audio and strategy rows show the new state
  }

  destroy(): void {
    this.menu.destroy();
    this.root.destroy(true);
  }

  // ─── Strategy block ───────────────────────────────────────────────────────
  /** Shows or hides the strategy; the panel grows by the block and the lines under it move down. */
  private setStrategyShown(shown: boolean): void {
    this.strategyShown = shown;
    this.strategyText.setVisible(shown);
    const extra = shown ? this.strategyText.height + PAUSE.strategyGapPx : 0;
    paintPanel(this.panel, PAUSE.panelWidth, PAUSE.panelHeight + extra, {
      fill: COLOR.panel, alpha: PAUSE.panelAlpha, edge: COLOR.panelEdge, edgePx: PAUSE.panelEdgePx,
    });
    this.panel.setY(this.cy + extra / 2);
    const controlsY = this.cy + PAUSE.controlsOffsetY + extra;
    this.controlsText?.setY(controlsY);
    this.hintText.setY(controlsY + PAUSE.hintGapPx);
  }
}
