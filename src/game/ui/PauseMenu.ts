// ─── Pause overlay ──────────────────────────────────────────────────────────
// An overlay inside GameScene rather than a separate scene: the sim simply stops
// stepping while it is open.
import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../../config';
import { getAudioBus, setMusicEnabled, setSfxEnabled } from '../audioBus';
import { MenuList } from './MenuList';
import type { MenuNav } from './menuInput';
import { COLOR, TEXT_COLOR, textStyle } from './theme';

const PAUSE = {
  dimAlpha: 0.7,
  panelWidth: 460,
  panelHeight: 400,
  panelAlpha: 0.98,
  panelEdgePx: 3,
  titleOffsetY: -150,
  titleFontPx: 34,
  menuOffsetY: -66,
  menuSpacing: 46,
  hintOffsetY: 158,
  hintFontPx: 14,
  depth: 2000,
} as const;

export interface PauseActions {
  onResume: () => void;
  onRestart: () => void;
  onQuit: () => void;
}

export class PauseMenu {
  private readonly root: Phaser.GameObjects.Container;
  private readonly menu: MenuList;
  private open = false;

  constructor(scene: Phaser.Scene, actions: PauseActions) {
    const cx = GAME_WIDTH / 2;
    const cy = GAME_HEIGHT / 2;
    this.root = scene.add.container(0, 0).setDepth(PAUSE.depth).setVisible(false);

    const dim = scene.add.rectangle(cx, cy, GAME_WIDTH, GAME_HEIGHT, COLOR.bg, PAUSE.dimAlpha).setOrigin(0.5);
    const panel = scene.add
      .rectangle(cx, cy, PAUSE.panelWidth, PAUSE.panelHeight, COLOR.panel, PAUSE.panelAlpha)
      .setOrigin(0.5)
      .setStrokeStyle(PAUSE.panelEdgePx, COLOR.panelEdge);
    const title = scene.add
      .text(cx, cy + PAUSE.titleOffsetY, 'Paused', textStyle(PAUSE.titleFontPx, TEXT_COLOR.accent))
      .setOrigin(0.5);
    const hint = scene.add
      .text(cx, cy + PAUSE.hintOffsetY, 'Move to choose · Pickup to confirm · left / right toggles', textStyle(PAUSE.hintFontPx, TEXT_COLOR.dim))
      .setOrigin(0.5);
    this.root.add([dim, panel, title, hint]);

    const audio = getAudioBus();
    const toggleMusic = (): void => { setMusicEnabled(!audio.isMusicEnabled()); };
    const toggleSfx = (): void => { setSfxEnabled(!audio.isSfxEnabled()); };
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
    if (nav.confirm || nav.left || nav.right) this.menu.refresh(); // the audio rows show the new state
  }

  destroy(): void {
    this.menu.destroy();
    this.root.destroy(true);
  }
}
