// ─── Level select list ──────────────────────────────────────────────────────
// One row per level: name, theme, the stars earned, the best score, and a lock with
// the star cost when it is not open yet. The title screen owns the cursor and calls
// setSelected(); the list itself is a dumb view over LevelEntry records.
import Phaser from 'phaser';
import { TEX } from '../../art/keys';
import { MAX_STARS } from '../progress';
import { COLOR, TEXT_COLOR, textStyle } from './theme';

// ─── Constants ──────────────────────────────────────────────────────────────
const ROW = {
  spacing: 50,
  width: 760,
  highlightHeight: 42,
  highlightAlpha: 0.9,
  highlightRadius: 8,
  nameX: -352,
  nameFontPx: 22,
  nameMaxPx: 150,   // a name wider than this (the custom kitchens' titles) is scaled down to fit before the theme column
  themeX: -190,
  themeFontPx: 14,
  starX: 92,
  starGapPx: 30,
  starScale: 0.62,
  coinX: 232,
  bestX: 262,
  metaFontPx: 16,
  lockX: 96,
  lockScale: 0.8,
  lockTextX: 120,
  lockFontPx: 15,
} as const;

export interface LevelEntry {
  id: string;
  name: string;
  theme: string;
  stars: number;
  bestScore: number;
  locked: boolean;
  unlockStars: number;
}

export interface LevelListOptions {
  spacing?: number;
  width?: number;
}

// ─── List ───────────────────────────────────────────────────────────────────
export class LevelList {
  private readonly root: Phaser.GameObjects.Container;
  private readonly highlight: Phaser.GameObjects.Rectangle;
  private readonly names: Phaser.GameObjects.Text[] = [];
  private readonly spacing: number;
  private index = -1;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    private readonly entries: readonly LevelEntry[],
    options: LevelListOptions = {},
  ) {
    this.spacing = options.spacing ?? ROW.spacing;
    const width = options.width ?? ROW.width;

    this.root = scene.add.container(x, y);
    this.highlight = scene.add
      .rectangle(0, 0, width, ROW.highlightHeight, COLOR.selection, ROW.highlightAlpha)
      .setOrigin(0.5, 0.5)
      .setVisible(false);
    this.root.add(this.highlight);

    this.entries.forEach((entry, i) => this.buildRow(scene, entry, i));
    this.refresh();
  }

  get container(): Phaser.GameObjects.Container { return this.root; }
  get length(): number { return this.entries.length; }

  entryAt(index: number): LevelEntry | null {
    return this.entries[index] ?? null;
  }

  /** -1 clears the highlight, for when the cursor is down in the settings rows. */
  setSelected(index: number): void {
    this.index = index;
    this.refresh();
  }

  destroy(): void {
    this.root.destroy(true);
    this.names.length = 0;
  }

  // ─── Rows ─────────────────────────────────────────────────────────────────
  private buildRow(scene: Phaser.Scene, entry: LevelEntry, i: number): void {
    const row = scene.add.container(0, i * this.spacing);
    const name = scene.add
      .text(ROW.nameX, 0, entry.name, textStyle(ROW.nameFontPx))
      .setOrigin(0, 0.5);
    if (name.width > ROW.nameMaxPx) name.setScale(ROW.nameMaxPx / name.width);
    const theme = scene.add
      .text(ROW.themeX, 0, entry.theme, textStyle(ROW.themeFontPx, TEXT_COLOR.dim))
      .setOrigin(0, 0.5);
    row.add([name, theme]);
    this.names.push(name);

    if (entry.locked) {
      const lock = scene.add.image(ROW.lockX, 0, TEX.iconLock).setOrigin(0.5, 0.5).setScale(ROW.lockScale);
      const need = scene.add
        .text(ROW.lockTextX, 0, `needs ${entry.unlockStars} stars`, textStyle(ROW.lockFontPx, TEXT_COLOR.dim))
        .setOrigin(0, 0.5);
      row.add([lock, need]);
      name.setColor(TEXT_COLOR.dim);
      theme.setAlpha(0.6);
    } else {
      for (let s = 0; s < MAX_STARS; s++) {
        const star = scene.add
          .image(ROW.starX + s * ROW.starGapPx, 0, s < entry.stars ? TEX.iconStar : TEX.iconStarEmpty)
          .setOrigin(0.5, 0.5)
          .setScale(ROW.starScale);
        row.add(star);
      }
      if (entry.bestScore > 0) {
        const coin = scene.add.image(ROW.coinX, 0, TEX.iconCoin).setOrigin(0.5, 0.5);
        const best = scene.add
          .text(ROW.bestX, 0, String(entry.bestScore), textStyle(ROW.metaFontPx, TEXT_COLOR.dim))
          .setOrigin(0, 0.5);
        row.add([coin, best]);
      }
    }
    this.root.add(row);
  }

  private refresh(): void {
    this.entries.forEach((entry, i) => {
      const name = this.names[i];
      if (!name) return;
      if (i === this.index) name.setColor(TEXT_COLOR.accent);
      else name.setColor(entry.locked ? TEXT_COLOR.dim : TEXT_COLOR.bright);
    });
    const selected = this.index >= 0 && this.index < this.entries.length;
    this.highlight.setVisible(selected);
    if (selected) this.highlight.setPosition(0, this.index * this.spacing);
  }
}
