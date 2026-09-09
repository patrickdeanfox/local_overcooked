// ─── Shared presentation palette ────────────────────────────────────────────
// Colours and fonts used by more than one presentation file. Anything used by a
// single file stays in that file's own constants block.
import type Phaser from 'phaser';

export const FONT_FAMILY = '"Trebuchet MS", "Segoe UI", system-ui, sans-serif';

/** Numeric colours, for Graphics fills and Rectangle game objects. */
export const COLOR = {
  bg: 0x1a1210,
  panel: 0x241a14,
  panelEdge: 0x6b4f36,
  barTrack: 0x120d0a,
  barGood: 0x7ac36a,
  barWarn: 0xffcc4d,
  barDanger: 0xe2564a,
  barWash: 0x6fc2e0,
  selection: 0x4a3524,
} as const;

/** CSS colours, for Text styles. */
export const TEXT_COLOR = {
  bright: '#f6ead8',
  dark: '#3a2a1c',   // on light surfaces such as the cream order card
  dim: '#b6a48c',
  accent: '#ffcc4d',
  danger: '#ff6a5a',
  good: '#8fe07a',
} as const;

/** Player 1 / player 2 identity colours. */
export const CHEF_COLORS: readonly number[] = [0x4a90e2, 0xe24a4a];
export const CHEF_TEXT_COLORS: readonly string[] = ['#7fb4f0', '#f08a80'];

export function textStyle(
  size: number,
  color: string = TEXT_COLOR.bright,
  extra: Partial<Phaser.Types.GameObjects.Text.TextStyle> = {},
): Phaser.Types.GameObjects.Text.TextStyle {
  return { fontFamily: FONT_FAMILY, fontSize: `${size}px`, color, ...extra };
}
