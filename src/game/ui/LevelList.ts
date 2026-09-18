// ─── Level select list ──────────────────────────────────────────────────────
// One row per level: name, theme, the stars earned, the best score, and a lock with
// the star cost when it is not open yet. The title screen owns the cursor and calls
// setSelected(); the list itself is a dumb view over LevelEntry records. The selected
// row is a cream ticket in dark ink with a mustard tab; the ticket slides between rows.
// With `visibleRows` set, only that many rows show at a time and the window scrolls to keep
// the selected row in view, with a mark above and below while there are more rows that way.
import Phaser from 'phaser';
import { TEX } from '../../art/keys';
import { MAX_STARS } from '../progress';
import { paintPanel, roundedPanel } from './panel';
import { COLOR, displayStyle, TEXT_COLOR, textStyle } from './theme';

// ─── Constants ──────────────────────────────────────────────────────────────
const ROW = {
  spacing: 42,
  width: 560,
  height: 36,
  radius: 10,
  tabWidth: 6,        // the mustard strip down the ticket's left edge
  tabInset: 4,
  nameX: 24,          // from the row's left edge
  nameFontPx: 20,
  nameMaxPx: 150,     // a name wider than this (the custom kitchens' titles) is scaled down to fit before the theme column
  themeX: 196,
  themeFontPx: 13,
  starsX: 150,        // from the row's right edge, the middle star
  starGapPx: 26,
  starScale: 0.6,
  coinX: 72,          // from the right edge
  coinScale: 0.8,
  bestX: 56,
  metaFontPx: 15,
  lockX: 176,
  lockScale: 0.72,
  lockTextX: 156,
  lockFontPx: 13,
  slideMs: 130,
  slideEase: 'Cubic.easeOut',
  unselectedAlpha: 0.92,
  lockedAlpha: 0.55,
  moreFontPx: 12,     // the "more above / more below" marks of a scrolling list
  moreOffsetPx: 22,   // from the first and last visible rows
  scrollMargin: 1,    // rows kept in view beyond the selected one while scrolling
} as const;
const MORE = { above: '▲ more', below: '▼ more' } as const;

/** Ink on the cream ticket. */
const INK = { name: TEXT_COLOR.ink, theme: '#5f7078', meta: '#5f7078' } as const;

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
  visibleRows?: number; // show this many rows at a time and scroll; all of them when absent
}

interface RowView {
  root: Phaser.GameObjects.Container;
  name: Phaser.GameObjects.Text;
  theme: Phaser.GameObjects.Text;
  meta: Phaser.GameObjects.Text[]; // best score or the lock caption
}

// ─── List ───────────────────────────────────────────────────────────────────
export class LevelList {
  private readonly root: Phaser.GameObjects.Container;
  private readonly highlight: Phaser.GameObjects.Graphics;
  private readonly tab: Phaser.GameObjects.Rectangle;
  private readonly views: RowView[] = [];
  private readonly spacing: number;
  private readonly width: number;
  private slide: Phaser.Tweens.Tween | null = null;
  private index = -1;
  private readonly visibleRows: number;
  private top = 0; // the first visible row
  private readonly moreAbove: Phaser.GameObjects.Text;
  private readonly moreBelow: Phaser.GameObjects.Text;

  constructor(
    private readonly scene: Phaser.Scene,
    x: number,
    y: number,
    private readonly entries: readonly LevelEntry[],
    options: LevelListOptions = {},
  ) {
    this.spacing = options.spacing ?? ROW.spacing;
    this.width = options.width ?? ROW.width;
    this.visibleRows = Math.max(1, Math.min(options.visibleRows ?? entries.length, entries.length));

    this.root = scene.add.container(x, y);
    this.highlight = roundedPanel(scene, this.width, ROW.height, { fill: COLOR.cream, radius: ROW.radius }).setVisible(false);
    this.tab = scene.add
      .rectangle(-this.width / 2 + ROW.tabInset, 0, ROW.tabWidth, ROW.height - ROW.tabInset * 2, COLOR.accent)
      .setOrigin(0, 0.5)
      .setVisible(false);
    this.root.add([this.highlight, this.tab]);
    this.moreAbove = scene.add.text(0, -ROW.moreOffsetPx, MORE.above, textStyle(ROW.moreFontPx, TEXT_COLOR.dim)).setOrigin(0.5, 0.5);
    this.moreBelow = scene.add
      .text(0, (this.visibleRows - 1) * this.spacing + ROW.moreOffsetPx, MORE.below, textStyle(ROW.moreFontPx, TEXT_COLOR.dim))
      .setOrigin(0.5, 0.5);
    this.root.add([this.moreAbove, this.moreBelow]);

    this.entries.forEach((entry, i) => this.buildRow(scene, entry, i));
    this.refresh(false);
  }

  get container(): Phaser.GameObjects.Container { return this.root; }
  get length(): number { return this.entries.length; }
  /** Rows shown at once: the list's height is this many rows, whatever its length. */
  get shownRows(): number { return this.visibleRows; }

  entryAt(index: number): LevelEntry | null {
    return this.entries[index] ?? null;
  }

  /** -1 clears the highlight, for when the cursor is down in the settings rows. */
  setSelected(index: number): void {
    const scrolled = index >= 0 && this.scrollTo(index);
    const slide = this.index >= 0 && index >= 0 && index !== this.index && !scrolled;
    this.index = index;
    this.refresh(slide);
  }

  /** Moves the window so row `index` shows with a row of margin where there is one. True when it moved. */
  private scrollTo(index: number): boolean {
    const margin = Math.min(ROW.scrollMargin, Math.floor((this.visibleRows - 1) / 2));
    const maxTop = this.entries.length - this.visibleRows;
    let top = this.top;
    if (index - margin < top) top = index - margin;
    if (index + margin > top + this.visibleRows - 1) top = index + margin - this.visibleRows + 1;
    top = Phaser.Math.Clamp(top, 0, Math.max(0, maxTop));
    if (top === this.top) return false;
    this.top = top;
    return true;
  }

  destroy(): void {
    this.slide?.remove();
    this.slide = null;
    this.root.destroy(true);
    this.views.length = 0;
  }

  // ─── Rows ─────────────────────────────────────────────────────────────────
  private buildRow(scene: Phaser.Scene, entry: LevelEntry, i: number): void {
    const left = -this.width / 2;
    const right = this.width / 2;
    const row = scene.add.container(0, i * this.spacing);
    const name = scene.add.text(left + ROW.nameX, 0, entry.name, displayStyle(ROW.nameFontPx)).setOrigin(0, 0.5);
    if (name.width > ROW.nameMaxPx) name.setScale(ROW.nameMaxPx / name.width);
    const theme = scene.add.text(left + ROW.themeX, 0, entry.theme.toUpperCase(), textStyle(ROW.themeFontPx, TEXT_COLOR.dim)).setOrigin(0, 0.5);
    row.add([name, theme]);
    const meta: Phaser.GameObjects.Text[] = [];

    if (entry.locked) {
      const lock = scene.add.image(right - ROW.lockX, 0, TEX.iconLock).setOrigin(0.5, 0.5).setScale(ROW.lockScale);
      const need = scene.add
        .text(right - ROW.lockTextX, 0, `needs ${entry.unlockStars} stars`, textStyle(ROW.lockFontPx, TEXT_COLOR.dim))
        .setOrigin(0, 0.5);
      row.add([lock, need]);
      meta.push(need);
      name.setAlpha(ROW.lockedAlpha);
      theme.setAlpha(ROW.lockedAlpha);
    } else {
      for (let s = 0; s < MAX_STARS; s++) {
        const star = scene.add
          .image(right - ROW.starsX + (s - 1) * ROW.starGapPx, 0, s < entry.stars ? TEX.iconStar : TEX.iconStarEmpty)
          .setOrigin(0.5, 0.5)
          .setScale(ROW.starScale);
        row.add(star);
      }
      if (entry.bestScore > 0) {
        const coin = scene.add.image(right - ROW.coinX, 0, TEX.iconCoin).setOrigin(0.5, 0.5).setScale(ROW.coinScale);
        const best = scene.add
          .text(right - ROW.bestX, 0, String(entry.bestScore), textStyle(ROW.metaFontPx, TEXT_COLOR.dim))
          .setOrigin(0, 0.5);
        row.add([coin, best]);
        meta.push(best);
      }
    }
    this.root.add(row);
    this.views.push({ root: row, name, theme, meta });
  }

  private refresh(slide: boolean): void {
    this.entries.forEach((entry, i) => {
      const view = this.views[i];
      if (!view) return;
      const shown = i >= this.top && i < this.top + this.visibleRows;
      view.root.setVisible(shown);
      view.root.setY((i - this.top) * this.spacing);
      const selected = i === this.index;
      view.name.setColor(selected ? INK.name : entry.locked ? TEXT_COLOR.dim : TEXT_COLOR.bright);
      view.theme.setColor(selected ? INK.theme : TEXT_COLOR.dim);
      for (const text of view.meta) text.setColor(selected ? INK.meta : TEXT_COLOR.dim);
      view.root.setAlpha(selected || entry.locked ? 1 : ROW.unselectedAlpha);
    });
    this.moreAbove.setVisible(this.top > 0);
    this.moreBelow.setVisible(this.top + this.visibleRows < this.entries.length);
    const selected = this.index >= 0 && this.index < this.entries.length;
    const y = selected ? (this.index - this.top) * this.spacing : 0;
    paintPanel(this.highlight, this.width, ROW.height, { fill: COLOR.cream, radius: ROW.radius });
    this.slide?.remove();
    this.slide = null;
    if (slide) {
      this.slide = this.scene.tweens.add({ targets: [this.highlight, this.tab], y, duration: ROW.slideMs, ease: ROW.slideEase });
    } else {
      this.highlight.setPosition(0, y);
      this.tab.setY(y);
    }
    this.highlight.setVisible(selected);
    this.tab.setVisible(selected);
  }
}
