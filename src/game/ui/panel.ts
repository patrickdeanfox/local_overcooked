// ─── Page furniture ─────────────────────────────────────────────────────────
// Rounded panels, the full-screen backdrop, page headings and the staggered reveal every
// menu page opens with. Shared so the pages agree; a page keeps its own layout numbers.
import Phaser from 'phaser';
import { TEX } from '../../art/keys';
import { COLOR, displayStyle, TEXT_COLOR, textStyle } from './theme';

// ─── Constants ──────────────────────────────────────────────────────────────
const PANEL = { radius: 14, edgePx: 2, edgeAlpha: 0.9 } as const;
const BACKDROP_DEPTH = -10;
const HEADING = { x: 40, y: 40, fontPx: 36, taglineY: 74, taglineFontPx: 14, ruleY: 92, ruleWidth: 72, ruleHeight: 4 } as const;
const REVEAL = { fromX: -28, ms: 320, gapMs: 38, ease: 'Cubic.easeOut' } as const;

export interface PanelOptions {
  fill?: number;
  alpha?: number;
  radius?: number;
  edge?: number;      // stroke colour; no stroke when absent
  edgePx?: number;
  edgeAlpha?: number;
}

// ─── Panels ─────────────────────────────────────────────────────────────────
/** A rounded panel drawn about its own origin, so it is positioned like a centred Rectangle. */
export function roundedPanel(scene: Phaser.Scene, width: number, height: number, options: PanelOptions = {}): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics();
  paintPanel(g, width, height, options);
  return g;
}

/** Redraws a panel made by roundedPanel, for a highlight whose size or colour changes. */
export function paintPanel(g: Phaser.GameObjects.Graphics, width: number, height: number, options: PanelOptions = {}): void {
  const radius = options.radius ?? PANEL.radius;
  g.clear();
  g.fillStyle(options.fill ?? COLOR.panel, options.alpha ?? 1);
  g.fillRoundedRect(-width / 2, -height / 2, width, height, radius);
  if (options.edge !== undefined) {
    g.lineStyle(options.edgePx ?? PANEL.edgePx, options.edge, options.edgeAlpha ?? PANEL.edgeAlpha);
    g.strokeRoundedRect(-width / 2, -height / 2, width, height, radius);
  }
}

// ─── Backdrop and headings ──────────────────────────────────────────────────
/** The enamel backdrop behind a menu page (the art module draws it); nothing when the texture is missing. */
export function installBackdrop(scene: Phaser.Scene): Phaser.GameObjects.Image | null {
  if (!scene.textures.exists(TEX.uiBackdrop)) return null;
  return scene.add.image(0, 0, TEX.uiBackdrop).setOrigin(0, 0).setDepth(BACKDROP_DEPTH);
}

/** A page's heading in the display face with its tagline and a short mustard rule under it. */
export function pageHeading(scene: Phaser.Scene, title: string, tagline = ''): Phaser.GameObjects.GameObject[] {
  const heading = scene.add.text(HEADING.x, HEADING.y, title, displayStyle(HEADING.fontPx, TEXT_COLOR.accent)).setOrigin(0, 0.5);
  const rule = scene.add.rectangle(HEADING.x, HEADING.ruleY, HEADING.ruleWidth, HEADING.ruleHeight, COLOR.tomato).setOrigin(0, 0.5);
  const objects: Phaser.GameObjects.GameObject[] = [heading, rule];
  if (tagline) objects.push(scene.add.text(HEADING.x, HEADING.taglineY, tagline, textStyle(HEADING.taglineFontPx, TEXT_COLOR.dim)).setOrigin(0, 0.5));
  return objects;
}

// ─── Motion ─────────────────────────────────────────────────────────────────
type Revealable = Phaser.GameObjects.GameObject & Phaser.GameObjects.Components.Transform & Phaser.GameObjects.Components.AlphaSingle;

/** Slides the objects in from the left one after another: the page-open moment. */
export function revealStagger(scene: Phaser.Scene, objects: readonly Revealable[], startDelayMs = 0): void {
  objects.forEach((object, i) => {
    const x = object.x;
    object.setAlpha(0);
    object.setX(x + REVEAL.fromX);
    scene.tweens.add({ targets: object, x, alpha: 1, duration: REVEAL.ms, delay: startDelayMs + i * REVEAL.gapMs, ease: REVEAL.ease });
  });
}
