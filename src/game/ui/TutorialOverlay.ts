// ─── Tutorial overlay ───────────────────────────────────────────────────────
// Draws a TutorialRunner inside GameScene: the rules panel before play (the sim holds still,
// as under the pause menu), then a banner along the bottom with the current step and a
// pointer bobbing over the tile it names. The scene feeds it nav while the panel is up and
// the sim's state and events after every stepped frame.
import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../../config';
import type { HintAction } from '../../input/types';
import type { TutorialDef } from '../../levels/schema';
import type { SimEvent, SimState } from '../../sim/types';
import { getAudioBus } from '../audioBus';
import { fillLabels, TutorialRunner, type TutorialPhase } from '../tutorial';
import type { MenuNav } from './menuInput';
import { roundedPanel } from './panel';
import { COLOR, displayStyle, TEXT_COLOR, textStyle } from './theme';

// ─── Constants ──────────────────────────────────────────────────────────────
const PANEL = {
  dimAlpha: 0.7,
  width: 860,
  height: 480,
  alpha: 0.98,
  edgePx: 3,
  kickerY: -204,
  kickerFontPx: 14,
  titleY: -170,
  titleFontPx: 34,
  linesY: -118,
  lineFontPx: 19,
  lineGapPx: 12,
  lineWrapPx: 760,
  bulletX: -392,
  textX: -366,
  hintY: 204,
  hintFontPx: 15,
  depth: 1900,
} as const;

const BANNER = {
  y: GAME_HEIGHT - 100,
  width: 840,
  height: 92,
  alpha: 0.94,
  edgePx: 2,
  kickerX: -400,
  kickerY: -30,
  kickerFontPx: 13,
  textX: -400,
  textY: 8,
  textFontPx: 19,
  textWrapPx: 800,
  doneHoldMs: 800,     // the finished step lingers in green with its tick
  outroHoldMs: 6000,   // the closing line, then the banner goes
  depth: 1800,
} as const;

const POINTER = {
  lift: 2.0,     // world units above the tile's floor: clear of a chef standing in front of the station
  bobPx: 9,
  bobMs: 700,
  size: 14,
  edgePx: 2,
  depth: 1850,
} as const;

const DEFAULT_OUTRO = 'Tutorial done. Keep cooking: the clock is running now.';
const TICK = '✓';

export interface TutorialOverlayOptions {
  players: number;
  kicker: string;                                            // the small line over the title, e.g. 'Tutorial · The tray'
  labelFor: (action: HintAction) => string;                  // the player's own button names for the placeholders
  tileToScreen: (tx: number, ty: number, lift: number) => { x: number; y: number };
}

// ─── Overlay ────────────────────────────────────────────────────────────────
export class TutorialOverlay {
  private readonly runner: TutorialRunner;
  private readonly panel: Phaser.GameObjects.Container;
  private readonly banner: Phaser.GameObjects.Container;
  private readonly kicker: Phaser.GameObjects.Text;
  private readonly text: Phaser.GameObjects.Text;
  private readonly pointer: Phaser.GameObjects.Graphics;
  private flashMs = 0;   // > 0 while the finished step's text lingers
  private outroMs = 0;   // > 0 while the closing line shows
  private bobMs = 0;

  constructor(scene: Phaser.Scene, private readonly def: TutorialDef, private readonly opts: TutorialOverlayOptions) {
    this.runner = new TutorialRunner(def, opts.players);
    this.panel = this.buildPanel(scene);

    this.banner = scene.add.container(GAME_WIDTH / 2, BANNER.y).setDepth(BANNER.depth).setVisible(false);
    const box = roundedPanel(scene, BANNER.width, BANNER.height, { fill: COLOR.panel, alpha: BANNER.alpha, edge: COLOR.panelEdge, edgePx: BANNER.edgePx });
    this.kicker = scene.add.text(BANNER.kickerX, BANNER.kickerY, '', textStyle(BANNER.kickerFontPx, TEXT_COLOR.dim)).setOrigin(0, 0.5);
    this.text = scene.add
      .text(BANNER.textX, BANNER.textY, '', textStyle(BANNER.textFontPx, TEXT_COLOR.bright, { wordWrap: { width: BANNER.textWrapPx } }))
      .setOrigin(0, 0.5);
    this.banner.add([box, this.kicker, this.text]);

    this.pointer = scene.add.graphics().setDepth(POINTER.depth).setVisible(false);
    this.pointer.fillStyle(COLOR.barWarn, 1);
    this.pointer.lineStyle(POINTER.edgePx, COLOR.bg, 1);
    this.pointer.fillTriangle(-POINTER.size, -POINTER.size * 1.6, POINTER.size, -POINTER.size * 1.6, 0, 0);
    this.pointer.strokeTriangle(-POINTER.size, -POINTER.size * 1.6, POINTER.size, -POINTER.size * 1.6, 0, 0);
  }

  get phase(): TutorialPhase { return this.runner.phase; }
  /** The rules panel is up: the scene must not step the sim. */
  get isBlocking(): boolean { return this.runner.isBlocking; }
  /** The panel or a step is showing, so the HUD's own prep hint stays out of the way. */
  get isActive(): boolean { return this.runner.isActive; }

  describe(): { phase: TutorialPhase; step: number; of: number } { return this.runner.describe(); }

  // ─── Input ────────────────────────────────────────────────────────────────
  /** Only while the panel is up: confirm starts the steps, back skips the walkthrough. */
  handleNav(nav: MenuNav): void {
    if (!this.runner.isBlocking) return;
    if (nav.confirm) {
      this.runner.start();
      this.panel.setVisible(false);
      getAudioBus().play('uiConfirm');
      if (this.runner.phase === 'done') this.showOutro();
      else this.showStep();
    } else if (nav.back) {
      this.runner.skip();
      this.panel.setVisible(false);
      getAudioBus().play('uiBack');
    }
  }

  /** After a stepped frame. A finished step lingers with a tick before the next one takes over. */
  observe(state: Readonly<SimState>, events: readonly SimEvent[], dtSec: number): void {
    const before = this.runner.current;
    const result = this.runner.observe(state, events, dtSec);
    if (!result) return;
    getAudioBus().play('uiConfirm');
    if (before) this.text.setText(`${TICK} ${fillLabels(before.text, this.opts.labelFor)}`).setColor(TEXT_COLOR.good);
    this.flashMs = BANNER.doneHoldMs;
    this.pointer.setVisible(false);
  }

  // ─── Per frame ────────────────────────────────────────────────────────────
  draw(deltaMs: number): void {
    if (this.flashMs > 0) {
      this.flashMs -= deltaMs;
      if (this.flashMs <= 0) {
        if (this.runner.phase === 'done') this.showOutro();
        else this.showStep();
      }
      return;
    }
    if (this.outroMs > 0) {
      this.outroMs -= deltaMs;
      if (this.outroMs <= 0) this.banner.setVisible(false);
      return;
    }
    const at = this.runner.current?.at;
    if (!at) {
      this.pointer.setVisible(false);
      return;
    }
    this.bobMs += deltaMs;
    const bob = Math.abs(Math.sin((this.bobMs / POINTER.bobMs) * Math.PI)) * POINTER.bobPx;
    const screen = this.opts.tileToScreen(at.x + 0.5, at.y + 0.5, POINTER.lift);
    this.pointer.setPosition(screen.x, screen.y - bob).setVisible(true);
  }

  destroy(): void {
    this.panel.destroy(true);
    this.banner.destroy(true);
    this.pointer.destroy();
  }

  // ─── Panels ───────────────────────────────────────────────────────────────
  private buildPanel(scene: Phaser.Scene): Phaser.GameObjects.Container {
    const cx = GAME_WIDTH / 2;
    const cy = GAME_HEIGHT / 2;
    const root = scene.add.container(0, 0).setDepth(PANEL.depth);
    const dim = scene.add.rectangle(cx, cy, GAME_WIDTH, GAME_HEIGHT, COLOR.bg, PANEL.dimAlpha).setOrigin(0.5);
    const box = roundedPanel(scene, PANEL.width, PANEL.height, { fill: COLOR.panel, alpha: PANEL.alpha, edge: COLOR.panelEdge, edgePx: PANEL.edgePx })
      .setPosition(cx, cy);
    const kicker = scene.add
      .text(cx, cy + PANEL.kickerY, this.opts.kicker.toUpperCase(), textStyle(PANEL.kickerFontPx, TEXT_COLOR.dim))
      .setOrigin(0.5);
    const title = scene.add.text(cx, cy + PANEL.titleY, this.def.title, displayStyle(PANEL.titleFontPx, TEXT_COLOR.accent)).setOrigin(0.5);
    root.add([dim, box, kicker, title]);
    let y = cy + PANEL.linesY;
    for (const line of this.def.intro) {
      const bullet = scene.add.text(cx + PANEL.bulletX, y, '•', textStyle(PANEL.lineFontPx, TEXT_COLOR.accent)).setOrigin(0, 0);
      const body = scene.add
        .text(cx + PANEL.textX, y, fillLabels(line, this.opts.labelFor), textStyle(PANEL.lineFontPx, TEXT_COLOR.bright, { wordWrap: { width: PANEL.lineWrapPx } }))
        .setOrigin(0, 0);
      root.add([bullet, body]);
      y += body.height + PANEL.lineGapPx;
    }
    const hint = scene.add
      .text(cx, cy + PANEL.hintY, `${this.opts.labelFor('pickup')} start · ${this.opts.labelFor('back')} skip the guide`, textStyle(PANEL.hintFontPx, TEXT_COLOR.dim))
      .setOrigin(0.5);
    root.add(hint);
    return root;
  }

  private showStep(): void {
    const step = this.runner.current;
    if (!step) return;
    this.banner.setVisible(true);
    this.kicker.setText(`STEP ${this.runner.stepNumber} OF ${this.runner.stepCount}`);
    this.text.setText(fillLabels(step.text, this.opts.labelFor)).setColor(TEXT_COLOR.bright);
  }

  private showOutro(): void {
    this.banner.setVisible(true);
    this.pointer.setVisible(false);
    this.kicker.setText('TUTORIAL DONE');
    this.text.setText(fillLabels(this.def.outro ?? DEFAULT_OUTRO, this.opts.labelFor)).setColor(TEXT_COLOR.accent);
    this.outroMs = BANNER.outroHoldMs;
  }
}
