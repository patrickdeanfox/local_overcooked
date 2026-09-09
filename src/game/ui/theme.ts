// ─── Shared presentation palette ────────────────────────────────────────────
// Colours and fonts used by more than one presentation file. Anything used by a
// single file stays in that file's own constants block.
//
// The look is a diner pass: deep enamel teal under everything, cream ticket paper for
// what is selected or important, mustard for the accent and tomato red for danger. Two
// self-hosted faces (index.html): Titan One for headings and big numbers, Fredoka for
// menus, hints and the HUD.
import type Phaser from 'phaser';

export const FONT_FAMILY = '"Fredoka", "Trebuchet MS", "Segoe UI", system-ui, sans-serif';
export const DISPLAY_FONT_FAMILY = '"Titan One", "Fredoka", "Trebuchet MS", sans-serif';
/** Fredoka is a variable font; menus and the HUD sit at this weight. */
export const BODY_WEIGHT = '500';

/** Numeric colours, for Graphics fills and Rectangle game objects. */
export const COLOR = {
  bg: 0x0f2b30,        // deep enamel teal: the page and every menu
  panel: 0x16404a,
  panelEdge: 0x2f7a86,
  barTrack: 0x0a1c20,
  barGood: 0x7ee08a,
  barWarn: 0xffc542,
  barDanger: 0xff5a3c,
  barWash: 0x6fd3ea,
  selection: 0x20535d,
  cream: 0xfff1d6,     // ticket paper
  ink: 0x24303a,       // writing on the paper
  accent: 0xffc542,    // mustard
  tomato: 0xff5a3c,
} as const;

/** CSS colours, for Text styles. */
export const TEXT_COLOR = {
  bright: '#fff1d6',
  dark: '#24303a',   // on light surfaces such as the cream order card
  ink: '#24303a',
  dim: '#9cc2c6',
  accent: '#ffc542',
  danger: '#ff6a4f',
  good: '#8fe69a',
} as const;

/** Player 1 / player 2 identity colours. */
export const CHEF_COLORS: readonly number[] = [0x4a90e2, 0xe24a4a];
export const CHEF_TEXT_COLORS: readonly string[] = ['#7fb4f0', '#f08a80'];

export function textStyle(
  size: number,
  color: string = TEXT_COLOR.bright,
  extra: Partial<Phaser.Types.GameObjects.Text.TextStyle> = {},
): Phaser.Types.GameObjects.Text.TextStyle {
  return { fontFamily: FONT_FAMILY, fontStyle: BODY_WEIGHT, fontSize: `${size}px`, color, ...extra };
}

/** Headings, level names, scores: the display face. */
export function displayStyle(
  size: number,
  color: string = TEXT_COLOR.bright,
  extra: Partial<Phaser.Types.GameObjects.Text.TextStyle> = {},
): Phaser.Types.GameObjects.Text.TextStyle {
  return { fontFamily: DISPLAY_FONT_FAMILY, fontSize: `${size}px`, color, ...extra };
}
