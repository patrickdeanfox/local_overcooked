// ─── Vertical menu list ─────────────────────────────────────────────────────
// Shared by the title screen, the results screen and the pause overlay: a column of
// labels with a highlighted row, driven by MenuNav edges.
import Phaser from 'phaser';
import { getAudioBus } from '../audioBus';
import type { MenuNav } from './menuInput';
import { COLOR, TEXT_COLOR, textStyle } from './theme';

const LIST = {
  spacing: 42,
  fontSize: 24,
  width: 380,
  highlightHeight: 36,
  highlightAlpha: 0.9,
  highlightRadius: 8,
  cursor: '▸',
  cursorGap: 14,
} as const;

export interface MenuItemSpec {
  label: () => string;
  onSelect?: () => void;
  onLeft?: () => void;
  onRight?: () => void;
}

export interface MenuListOptions {
  spacing?: number;
  fontSize?: number;
  width?: number;
}

export class MenuList {
  private readonly root: Phaser.GameObjects.Container;
  private readonly highlight: Phaser.GameObjects.Rectangle;
  private readonly cursor: Phaser.GameObjects.Text;
  private readonly rows: Phaser.GameObjects.Text[] = [];
  private readonly spacing: number;
  private readonly width: number;
  private index = 0;
  private focused = true;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    private items: readonly MenuItemSpec[],
    options: MenuListOptions = {},
  ) {
    this.spacing = options.spacing ?? LIST.spacing;
    this.width = options.width ?? LIST.width;
    const fontSize = options.fontSize ?? LIST.fontSize;

    this.root = scene.add.container(x, y);
    this.highlight = scene.add
      .rectangle(0, 0, this.width, LIST.highlightHeight, COLOR.selection, LIST.highlightAlpha)
      .setOrigin(0.5, 0.5);
    this.root.add(this.highlight);
    this.cursor = scene.add.text(0, 0, LIST.cursor, textStyle(fontSize, TEXT_COLOR.accent)).setOrigin(1, 0.5);
    this.root.add(this.cursor);

    this.items.forEach((item, i) => {
      const text = scene.add.text(0, i * this.spacing, item.label(), textStyle(fontSize)).setOrigin(0.5, 0.5);
      this.rows.push(text);
      this.root.add(text);
    });
    this.refresh();
  }

  get container(): Phaser.GameObjects.Container { return this.root; }
  get selectedIndex(): number { return this.index; }

  /** Unfocused lists keep their labels but drop the cursor and the highlight. */
  setFocused(focused: boolean): void {
    if (this.focused === focused) return;
    this.focused = focused;
    this.refresh();
  }

  setIndex(index: number): void {
    if (this.items.length === 0) return;
    this.index = Phaser.Math.Clamp(index, 0, this.items.length - 1);
    this.refresh();
  }

  handle(nav: MenuNav): void {
    if (this.items.length === 0) return;
    const audio = getAudioBus();
    if (nav.up || nav.down) {
      const delta = nav.down ? 1 : -1;
      this.index = (this.index + delta + this.items.length) % this.items.length;
      audio.play('uiMove');
      this.refresh();
    }
    const current = this.items[this.index];
    if (nav.left && current.onLeft) {
      current.onLeft();
      audio.play('uiMove');
      this.refresh();
    }
    if (nav.right && current.onRight) {
      current.onRight();
      audio.play('uiMove');
      this.refresh();
    }
    if (nav.confirm && current.onSelect) {
      audio.play('uiConfirm');
      current.onSelect();
    }
  }

  /** Re-reads every label and moves the highlight to the selected row. */
  refresh(): void {
    this.items.forEach((item, i) => {
      const row = this.rows[i];
      if (!row) return;
      row.setText(item.label());
      row.setColor(i === this.index && this.focused ? TEXT_COLOR.accent : TEXT_COLOR.bright);
    });
    const y = this.index * this.spacing;
    this.highlight.setPosition(0, y);
    this.highlight.setVisible(this.focused && this.items.length > 0);
    this.cursor.setVisible(this.focused);
    const row = this.rows[this.index];
    this.cursor.setPosition(row ? row.x - row.displayWidth / 2 - LIST.cursorGap : -this.width / 2, y);
  }

  destroy(): void {
    this.root.destroy(true);
  }
}
