// ─── Item and effect textures ───────────────────────────────────────────────
// Everything a chef can hold or that floats over a tile: ingredients, pots,
// plates, the extinguisher, fire, spray and smoke. All transparent, centred, and
// drawn from shape helpers that take a radius so the 40 px item sprites and the
// 32 px HUD icons share one set of shapes.
import type Phaser from 'phaser';
import { FRIED_INGREDIENTS, INGREDIENT_TYPES, SOUP_INGREDIENTS, type IngredientType } from '../sim/types';
import { BURGER_LAYERS, TEX, TEXTURE_SIZES, type BurgerLayer } from './keys';
import { PALETTE } from './palette';
import {
  drawText, fillCircle, fillEllipse, fillPolygon, fillRound, line, makeTexture, radial, roundRectPath,
  strokeEllipse, strokeRound, vGradient, withAlpha, type Point,
} from './draw';

// ─── Constants ──────────────────────────────────────────────────────────────

const ITEM = TEXTURE_SIZES.item;      // 40
const FX = TEXTURE_SIZES.fx;          // 40
const FIRE = TEXTURE_SIZES.fire;      // 64
const ITEM_R = 15;                    // shape radius inside a 40 px item sprite
// Mechanics spec (docs/MECHANICS.md) sprites, as fractions of the shape radius.
const TRAY = { w: 2.2, h: 1.7, rim: 0.16, corner: 0.22 } as const;
const BOX = { w: 1.9, h: 1.6, corner: 0.12, tape: 0.22 } as const;
const CHALK = { w: 2.1, h: 1.55, corner: 0.16, frame: 0.1, fontPx: 19 } as const;
const CHALK_BOARD = '#2f3b31';
const CHALK_BOARD_LIGHT = '#3d4a3f';
const CHALK_WHITE = '#f4f1e6';

const SOUP_COLORS: Record<IngredientType, string> = {
  onion: PALETTE.soupOnion,
  tomato: PALETTE.soupTomato,
  mushroom: PALETTE.soupMushroom,
  // Burger ingredients never become soup; colours only keep the table total.
  meat: PALETTE.meatCooked,
  bun: PALETTE.bun,
  lettuce: PALETTE.lettuce,
  fish: PALETTE.fishFlesh,
  prawn: PALETTE.prawn,
};

/** Sesame seeds on a bun dome: [dx, dy] as fractions of the shape radius. */
const SESAME_SEEDS: readonly Point[] = [
  [-0.5, -0.24], [-0.14, -0.5], [0.26, -0.38], [0.58, -0.06], [0.04, -0.14],
];
/** Mince flecks on a raw patty: [dx, dy, radius] as fractions of the shape radius. */
const MINCE_FLECKS: readonly (readonly [number, number, number])[] = [
  [-0.46, -0.06, 0.09], [-0.1, -0.16, 0.07], [0.3, -0.08, 0.08],
  [0.54, 0.06, 0.06], [-0.26, 0.1, 0.07], [0.1, 0.12, 0.06],
];

/** Extinguisher mist: [angle from straight up, distance, radius, alpha], all as fractions. */
const SPRAY_DROPS: readonly (readonly [number, number, number, number])[] = [
  [-0.55, 0.42, 0.05, 0.55], [-0.32, 0.30, 0.07, 0.75], [-0.12, 0.44, 0.06, 0.6],
  [0.06, 0.26, 0.08, 0.85], [0.24, 0.40, 0.055, 0.6], [0.46, 0.30, 0.05, 0.5],
  [-0.44, 0.18, 0.055, 0.8], [0.34, 0.17, 0.06, 0.8], [0.0, 0.10, 0.07, 0.9],
  [-0.2, 0.55, 0.04, 0.35], [0.18, 0.56, 0.045, 0.35],
];

/** Liquid colour of a cooked soup, also used for HUD soup icons and pot contents. */
export function soupColor(type: IngredientType): string {
  return SOUP_COLORS[type];
}

// ─── Ingredient shapes ──────────────────────────────────────────────────────

function drawOnionRaw(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number): void {
  // Sprout first so the bulb overlaps its base.
  ctx.strokeStyle = PALETTE.stemGreen;
  ctx.lineWidth = Math.max(1.5, r * 0.13);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(cx, cy - r * 0.55);
  ctx.quadraticCurveTo(cx - r * 0.2, cy - r * 1.0, cx - r * 0.45, cy - r * 1.15);
  ctx.moveTo(cx, cy - r * 0.55);
  ctx.quadraticCurveTo(cx + r * 0.18, cy - r * 1.0, cx + r * 0.38, cy - r * 1.05);
  ctx.stroke();
  ctx.lineCap = 'butt';

  const rx = r * 0.82;
  const ry = r * 0.86;
  ctx.beginPath();
  ctx.ellipse(cx, cy + r * 0.12, rx, ry, 0, 0, Math.PI * 2);
  ctx.fillStyle = radial(ctx, cx - r * 0.25, cy - r * 0.2, r * 0.1, r * 1.3, [
    [0, PALETTE.onionFlesh], [0.45, PALETTE.onion], [1, PALETTE.onionDark],
  ]);
  ctx.fill();
  ctx.strokeStyle = PALETTE.onionDark;
  ctx.lineWidth = Math.max(1, r * 0.1);
  ctx.stroke();

  // Papery layer lines.
  ctx.strokeStyle = PALETTE.onionDark;
  ctx.lineWidth = Math.max(1, r * 0.07);
  for (const bulge of [-r * 0.42, 0, r * 0.42]) {
    ctx.beginPath();
    ctx.moveTo(cx, cy - ry + r * 0.16);
    ctx.quadraticCurveTo(cx + bulge * 1.5, cy + r * 0.1, cx + bulge * 0.35, cy + ry * 0.98);
    ctx.stroke();
  }
  withAlpha(ctx, 0.5, () => fillEllipse(ctx, cx - r * 0.3, cy - r * 0.22, r * 0.2, r * 0.3, PALETTE.onionFlesh, -0.4));
}

function drawOnionChopped(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number): void {
  const slices: Point[] = [[cx - r * 0.46, cy + r * 0.3], [cx + r * 0.46, cy + r * 0.34], [cx + r * 0.02, cy - r * 0.4]];
  for (const [sx, sy] of slices) {
    fillEllipse(ctx, sx, sy, r * 0.46, r * 0.38, PALETTE.onionFlesh);
    strokeEllipse(ctx, sx, sy, r * 0.46, r * 0.38, PALETTE.onionDark, Math.max(1, r * 0.09));
    strokeEllipse(ctx, sx, sy, r * 0.26, r * 0.21, PALETTE.onionDark, Math.max(1, r * 0.06));
    strokeEllipse(ctx, sx, sy, r * 0.1, r * 0.08, PALETTE.onionDark, Math.max(1, r * 0.05));
  }
}

function drawTomatoRaw(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number): void {
  ctx.beginPath();
  ctx.ellipse(cx, cy + r * 0.1, r * 0.88, r * 0.8, 0, 0, Math.PI * 2);
  ctx.fillStyle = radial(ctx, cx - r * 0.28, cy - r * 0.2, r * 0.1, r * 1.25, [
    [0, '#f4675a'], [0.5, PALETTE.tomato], [1, PALETTE.tomatoDark],
  ]);
  ctx.fill();
  ctx.strokeStyle = PALETTE.tomatoDark;
  ctx.lineWidth = Math.max(1, r * 0.1);
  ctx.stroke();
  withAlpha(ctx, 0.55, () => fillEllipse(ctx, cx - r * 0.34, cy - r * 0.24, r * 0.18, r * 0.26, '#ffffff', -0.5));

  // Green calyx: five short leaves around a stub.
  for (let i = 0; i < 5; i++) {
    const a = -Math.PI / 2 + (i * Math.PI * 2) / 5;
    const tipX = cx + Math.cos(a) * r * 0.5;
    const tipY = cy - r * 0.55 + Math.sin(a) * r * 0.24;
    fillPolygon(ctx, [
      [cx, cy - r * 0.6],
      [tipX, tipY],
      [cx + Math.cos(a + 0.7) * r * 0.22, cy - r * 0.5 + Math.sin(a + 0.7) * r * 0.12],
    ], PALETTE.stemGreen);
  }
  fillRound(ctx, cx - r * 0.09, cy - r * 0.95, r * 0.18, r * 0.36, r * 0.09, PALETTE.stemGreenDark);
}

function drawTomatoChopped(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number): void {
  const wedges: readonly (readonly [number, number, number])[] = [
    [cx - r * 0.44, cy + r * 0.44, 0],
    [cx + r * 0.46, cy + r * 0.4, 0.25],
    [cx - r * 0.02, cy - r * 0.22, -0.2],
  ];
  for (const [wx, wy, rot] of wedges) {
    ctx.save();
    ctx.translate(wx, wy);
    ctx.rotate(rot);
    ctx.beginPath();
    ctx.ellipse(0, 0, r * 0.5, r * 0.5, 0, Math.PI, Math.PI * 2);
    ctx.closePath();
    ctx.fillStyle = PALETTE.tomato;
    ctx.fill();
    ctx.strokeStyle = PALETTE.tomatoDark;
    ctx.lineWidth = Math.max(1, r * 0.09);
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(0, 0, r * 0.3, r * 0.3, 0, Math.PI, Math.PI * 2);
    ctx.closePath();
    ctx.fillStyle = PALETTE.tomatoFlesh;
    ctx.fill();
    ctx.restore();
  }
}

function drawMushroomRaw(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number): void {
  // Stem, then cap on top of it.
  fillRound(ctx, cx - r * 0.26, cy - r * 0.1, r * 0.52, r * 0.82, r * 0.16, PALETTE.mushroomFlesh);
  strokeRound(ctx, cx - r * 0.26, cy - r * 0.1, r * 0.52, r * 0.82, r * 0.16, PALETTE.mushroomDark, Math.max(1, r * 0.08));

  ctx.beginPath();
  ctx.ellipse(cx, cy - r * 0.08, r * 0.9, r * 0.68, 0, Math.PI, Math.PI * 2);
  ctx.closePath();
  ctx.fillStyle = radial(ctx, cx - r * 0.3, cy - r * 0.5, r * 0.08, r * 1.2, [
    [0, '#c4915f'], [0.6, PALETTE.mushroom], [1, PALETTE.mushroomDark],
  ]);
  ctx.fill();
  ctx.strokeStyle = PALETTE.mushroomDark;
  ctx.lineWidth = Math.max(1, r * 0.1);
  ctx.stroke();
  withAlpha(ctx, 0.4, () => fillEllipse(ctx, cx - r * 0.35, cy - r * 0.4, r * 0.2, r * 0.12, '#ffffff', -0.35));
}

function drawMushroomSlice(ctx: CanvasRenderingContext2D, cx: number, cy: number, s: number): void {
  ctx.beginPath();
  ctx.moveTo(cx - s, cy + s * 0.1);
  ctx.quadraticCurveTo(cx - s, cy - s * 0.95, cx, cy - s * 0.95);
  ctx.quadraticCurveTo(cx + s, cy - s * 0.95, cx + s, cy + s * 0.1);
  ctx.lineTo(cx + s * 0.34, cy + s * 0.1);
  ctx.lineTo(cx + s * 0.34, cy + s * 0.95);
  ctx.lineTo(cx - s * 0.34, cy + s * 0.95);
  ctx.lineTo(cx - s * 0.34, cy + s * 0.1);
  ctx.closePath();
  ctx.fillStyle = PALETTE.mushroomFlesh;
  ctx.fill();
  ctx.strokeStyle = PALETTE.mushroomDark;
  ctx.lineWidth = Math.max(1, s * 0.22);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx - s, cy + s * 0.1);
  ctx.quadraticCurveTo(cx - s, cy - s * 0.95, cx, cy - s * 0.95);
  ctx.quadraticCurveTo(cx + s, cy - s * 0.95, cx + s, cy + s * 0.1);
  ctx.strokeStyle = PALETTE.mushroom;
  ctx.lineWidth = Math.max(1.5, s * 0.36);
  ctx.stroke();
}

function drawMushroomChopped(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number): void {
  drawMushroomSlice(ctx, cx - r * 0.44, cy + r * 0.36, r * 0.42);
  drawMushroomSlice(ctx, cx + r * 0.46, cy + r * 0.32, r * 0.42);
  drawMushroomSlice(ctx, cx + r * 0.02, cy - r * 0.42, r * 0.42);
}

type ShapeFn = (ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number) => void;

// ─── Burger ingredient shapes ───────────────────────────────────────────────

/** Ellipse with `lobes` scallops pushed out to `bump`x the radius: leaf frills. */
function ruffledPath(
  ctx: CanvasRenderingContext2D, cx: number, cy: number, rx: number, ry: number, lobes: number, bump: number,
): void {
  const step = (Math.PI * 2) / lobes;
  ctx.beginPath();
  for (let i = 0; i < lobes; i++) {
    const a0 = i * step;
    const a1 = a0 + step;
    const am = a0 + step / 2;
    if (i === 0) ctx.moveTo(cx + Math.cos(a0) * rx, cy + Math.sin(a0) * ry);
    ctx.quadraticCurveTo(
      cx + Math.cos(am) * rx * bump, cy + Math.sin(am) * ry * bump,
      cx + Math.cos(a1) * rx, cy + Math.sin(a1) * ry,
    );
  }
  ctx.closePath();
}

/** Outline of a raw steak: a soft, slightly lopsided slab of beef. */
function steakPath(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(cx - r * 0.84, cy - r * 0.22);
  ctx.quadraticCurveTo(cx - r * 0.72, cy - r * 0.82, cx - r * 0.04, cy - r * 0.76);
  ctx.quadraticCurveTo(cx + r * 0.6, cy - r * 0.72, cx + r * 0.84, cy - r * 0.26);
  ctx.quadraticCurveTo(cx + r * 1.0, cy + r * 0.16, cx + r * 0.46, cy + r * 0.62);
  ctx.quadraticCurveTo(cx - r * 0.06, cy + r * 0.9, cx - r * 0.58, cy + r * 0.6);
  ctx.quadraticCurveTo(cx - r * 0.96, cy + r * 0.32, cx - r * 0.84, cy - r * 0.22);
  ctx.closePath();
}

function drawMeatRaw(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number): void {
  steakPath(ctx, cx, cy, r);
  ctx.fillStyle = radial(ctx, cx - r * 0.3, cy - r * 0.3, r * 0.1, r * 1.4, [
    [0, PALETTE.meatRawLight], [0.5, PALETTE.meatRaw], [1, PALETTE.meatRawDark],
  ]);
  ctx.fill();

  // Fat cap hugging the top edge and fine marbling, both clipped inside the steak.
  ctx.save();
  steakPath(ctx, cx, cy, r);
  ctx.clip();
  ctx.strokeStyle = PALETTE.meatFat;
  ctx.lineWidth = Math.max(1.5, r * 0.22);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(cx - r * 0.84, cy - r * 0.22);
  ctx.quadraticCurveTo(cx - r * 0.72, cy - r * 0.82, cx - r * 0.04, cy - r * 0.76);
  ctx.quadraticCurveTo(cx + r * 0.6, cy - r * 0.72, cx + r * 0.84, cy - r * 0.26);
  ctx.stroke();
  withAlpha(ctx, 0.45, () => {
    ctx.lineWidth = Math.max(1, r * 0.06);
    ctx.beginPath();
    ctx.moveTo(cx - r * 0.44, cy + r * 0.34);
    ctx.quadraticCurveTo(cx - r * 0.24, cy + r * 0.16, cx - r * 0.02, cy + r * 0.36);
    ctx.moveTo(cx + r * 0.06, cy - r * 0.24);
    ctx.quadraticCurveTo(cx + r * 0.28, cy - r * 0.06, cx + r * 0.52, cy - r * 0.2);
    ctx.moveTo(cx + r * 0.18, cy + r * 0.24);
    ctx.quadraticCurveTo(cx + r * 0.4, cy + r * 0.36, cx + r * 0.62, cy + r * 0.2);
    ctx.stroke();
  });
  ctx.lineCap = 'butt';
  ctx.restore();

  steakPath(ctx, cx, cy, r);
  ctx.strokeStyle = PALETTE.meatRawDark;
  ctx.lineWidth = Math.max(1, r * 0.1);
  ctx.stroke();
  withAlpha(ctx, 0.4, () => fillEllipse(ctx, cx + r * 0.22, cy + r * 0.32, r * 0.24, r * 0.12, '#ffffff', -0.3));
}

/** Thick disc seen at a shallow angle: the shared patty silhouette. */
function pattyBase(
  ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, top: string, side: string, edge: string,
): void {
  const rx = r * 0.9;
  const ry = r * 0.38;
  const h = r * 0.34;
  fillEllipse(ctx, cx, cy + h, rx, ry, side);
  ctx.fillStyle = side;
  ctx.fillRect(cx - rx, cy, rx * 2, h);
  fillEllipse(ctx, cx, cy, rx, ry, top);
  strokeEllipse(ctx, cx, cy, rx, ry, edge, Math.max(1, r * 0.08));
  // Outline down both sides so the disc reads as one solid piece.
  ctx.strokeStyle = edge;
  ctx.lineWidth = Math.max(1, r * 0.08);
  ctx.beginPath();
  ctx.moveTo(cx - rx, cy);
  ctx.lineTo(cx - rx, cy + h);
  ctx.moveTo(cx + rx, cy);
  ctx.lineTo(cx + rx, cy + h);
  ctx.stroke();
}

function drawMeatChopped(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number): void {
  pattyBase(ctx, cx, cy, r, PALETTE.meatRaw, PALETTE.meatRawDark, PALETTE.meatRawDark);
  // Minced texture on the top face.
  for (const [dx, dy, fr] of MINCE_FLECKS) {
    withAlpha(ctx, 0.35, () => fillEllipse(ctx, cx + dx * r, cy + dy * r, fr * r, fr * r * 0.6, PALETTE.meatFat));
  }
  withAlpha(ctx, 0.4, () => fillEllipse(ctx, cx - r * 0.26, cy - r * 0.16, r * 0.3, r * 0.11, PALETTE.meatRawLight));
}

/** Cooked patty: browned, with grill bars seared across the top face. */
export function drawMeatCooked(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number): void {
  pattyBase(ctx, cx, cy, r, PALETTE.meatCooked, PALETTE.meatCookedDark, PALETTE.meatGrill);
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(cx, cy, r * 0.9, r * 0.38, 0, 0, Math.PI * 2);
  ctx.clip();
  ctx.strokeStyle = PALETTE.meatGrill;
  ctx.lineWidth = Math.max(1.5, r * 0.14);
  ctx.lineCap = 'round';
  for (const dx of [-0.44, 0, 0.44]) {
    ctx.beginPath();
    ctx.moveTo(cx + dx * r - r * 0.2, cy - r * 0.42);
    ctx.lineTo(cx + dx * r + r * 0.2, cy + r * 0.42);
    ctx.stroke();
  }
  ctx.lineCap = 'butt';
  ctx.restore();
  withAlpha(ctx, 0.5, () => fillEllipse(ctx, cx - r * 0.3, cy - r * 0.18, r * 0.26, r * 0.09, PALETTE.meatCookedLight));
}

/** Charred patty: what a pan left on the stove too long is holding. */
function drawMeatBurnt(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number): void {
  pattyBase(ctx, cx, cy, r, PALETTE.meatChar, '#17130f', '#0d0b09');
  withAlpha(ctx, 0.4, () => {
    fillEllipse(ctx, cx - r * 0.3, cy - r * 0.1, r * 0.22, r * 0.1, PALETTE.smoke);
    fillEllipse(ctx, cx + r * 0.34, cy + r * 0.08, r * 0.16, r * 0.07, PALETTE.smoke);
  });
  withAlpha(ctx, 0.55, () => fillEllipse(ctx, cx + r * 0.04, cy + r * 0.02, r * 0.14, r * 0.06, PALETTE.fireDeep));
}

/** Sesame bun. Buns are never chopped, so the chopped variant draws this too. */
function drawBun(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number): void {
  // Cut base below the dome.
  fillRound(ctx, cx - r * 0.88, cy + r * 0.08, r * 1.76, r * 0.5, r * 0.2, PALETTE.bunDark);
  fillRound(ctx, cx - r * 0.88, cy + r * 0.04, r * 1.76, r * 0.42, r * 0.18, PALETTE.bun);
  withAlpha(ctx, 0.85, () => fillRound(ctx, cx - r * 0.84, cy + r * 0.02, r * 1.68, r * 0.16, r * 0.08, PALETTE.bunCrumb));

  // Dome.
  ctx.beginPath();
  ctx.ellipse(cx, cy + r * 0.12, r * 0.9, r * 0.84, 0, Math.PI, 0);
  ctx.closePath();
  ctx.fillStyle = radial(ctx, cx - r * 0.3, cy - r * 0.34, r * 0.08, r * 1.35, [
    [0, PALETTE.bunLight], [0.5, PALETTE.bun], [1, PALETTE.bunDark],
  ]);
  ctx.fill();
  ctx.strokeStyle = PALETTE.bunDark;
  ctx.lineWidth = Math.max(1, r * 0.09);
  ctx.stroke();

  // Sesame seeds, tilted to follow the curve of the dome.
  for (const [dx, dy] of SESAME_SEEDS) {
    fillEllipse(ctx, cx + dx * r, cy + dy * r + r * 0.03, r * 0.13, r * 0.065, PALETTE.sesameShade, dx * 0.7);
    withAlpha(ctx, 0.9, () => fillEllipse(ctx, cx + dx * r, cy + dy * r, r * 0.12, r * 0.058, PALETTE.sesame, dx * 0.7));
  }
  withAlpha(ctx, 0.4, () => fillEllipse(ctx, cx - r * 0.42, cy - r * 0.4, r * 0.22, r * 0.11, '#ffffff', -0.5));
}

function drawLettuceRaw(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number): void {
  ruffledPath(ctx, cx, cy + r * 0.04, r * 0.76, r * 0.76, 7, 1.3);
  ctx.fillStyle = radial(ctx, cx - r * 0.26, cy - r * 0.3, r * 0.08, r * 1.3, [
    [0, PALETTE.lettuceLight], [0.5, PALETTE.lettuce], [1, PALETTE.lettuceDark],
  ]);
  ctx.fill();
  ctx.strokeStyle = PALETTE.lettuceDark;
  ctx.lineWidth = Math.max(1, r * 0.09);
  ctx.stroke();

  // Folds of the outer leaves wrapping the head.
  ctx.save();
  ruffledPath(ctx, cx, cy + r * 0.04, r * 0.76, r * 0.76, 7, 1.3);
  ctx.clip();
  withAlpha(ctx, 0.75, () => {
    ctx.strokeStyle = PALETTE.lettuceDark;
    ctx.lineWidth = Math.max(1, r * 0.09);
    ctx.beginPath();
    ctx.moveTo(cx - r * 0.72, cy - r * 0.1);
    ctx.quadraticCurveTo(cx - r * 0.3, cy + r * 0.3, cx - r * 0.14, cy + r * 0.86);
    ctx.moveTo(cx + r * 0.74, cy - r * 0.16);
    ctx.quadraticCurveTo(cx + r * 0.3, cy + r * 0.24, cx + r * 0.24, cy + r * 0.86);
    ctx.moveTo(cx - r * 0.5, cy - r * 0.66);
    ctx.quadraticCurveTo(cx - r * 0.1, cy - r * 0.3, cx + r * 0.4, cy - r * 0.6);
    ctx.stroke();
  });
  withAlpha(ctx, 0.35, () => {
    ctx.strokeStyle = PALETTE.lettuceRib;
    ctx.lineWidth = Math.max(1, r * 0.09);
    ctx.beginPath();
    ctx.moveTo(cx - r * 0.16, cy - r * 0.3);
    ctx.quadraticCurveTo(cx - r * 0.3, cy + r * 0.2, cx - r * 0.16, cy + r * 0.68);
    ctx.stroke();
  });
  ctx.restore();
  withAlpha(ctx, 0.4, () => fillEllipse(ctx, cx - r * 0.3, cy - r * 0.4, r * 0.24, r * 0.14, '#ffffff', -0.45));
}

/** One torn leaf piece, ruffled edge and a pale rib. */
function drawLettucePiece(ctx: CanvasRenderingContext2D, cx: number, cy: number, s: number, rot: number): void {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(rot);
  ruffledPath(ctx, 0, 0, s, s * 0.5, 7, 1.5);
  ctx.fillStyle = vGradient(ctx, -s * 0.7, s * 0.7, [[0, PALETTE.lettuceLight], [1, PALETTE.lettuce]]);
  ctx.fill();
  ctx.strokeStyle = PALETTE.lettuceDark;
  ctx.lineWidth = Math.max(1, s * 0.22);
  ctx.stroke();
  withAlpha(ctx, 0.6, () => {
    ctx.strokeStyle = PALETTE.lettuceRib;
    ctx.lineWidth = Math.max(1, s * 0.15);
    ctx.beginPath();
    ctx.moveTo(-s * 0.66, s * 0.08);
    ctx.quadraticCurveTo(0, -s * 0.14, s * 0.68, s * 0.02);
    ctx.moveTo(-s * 0.24, -s * 0.26);
    ctx.quadraticCurveTo(-s * 0.1, -s * 0.04, -s * 0.28, s * 0.26);
    ctx.stroke();
  });
  ctx.restore();
}

function drawLettuceChopped(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number): void {
  drawLettucePiece(ctx, cx - r * 0.4, cy + r * 0.4, r * 0.55, 0.32);
  drawLettucePiece(ctx, cx + r * 0.44, cy + r * 0.3, r * 0.52, -0.4);
  drawLettucePiece(ctx, cx + r * 0.02, cy - r * 0.34, r * 0.58, 0.08);
}

// ─── Burger layers ──────────────────────────────────────────────────────────

/** One plated burger layer, centred on (cx, cy) as a slab a few pixels tall.
 *  Presentation stacks these BURGER_LAYER_STEP_PX apart on a plate. */
export function drawBurgerLayer(
  ctx: CanvasRenderingContext2D, layer: BurgerLayer, cx: number, cy: number, r: number,
): void {
  switch (layer) {
    case 'bunBottom': {
      fillRound(ctx, cx - r * 0.86, cy - r * 0.16, r * 1.72, r * 0.5, r * 0.2, PALETTE.bunDark);
      fillRound(ctx, cx - r * 0.86, cy - r * 0.2, r * 1.72, r * 0.44, r * 0.18, PALETTE.bun);
      withAlpha(ctx, 0.9, () => fillRound(ctx, cx - r * 0.82, cy - r * 0.22, r * 1.64, r * 0.17, r * 0.08, PALETTE.bunCrumb));
      withAlpha(ctx, 0.3, () => fillRound(ctx, cx - r * 0.8, cy + r * 0.18, r * 1.6, r * 0.1, r * 0.05, PALETTE.bunDark));
      break;
    }
    case 'meat': {
      fillRound(ctx, cx - r * 0.94, cy - r * 0.18, r * 1.88, r * 0.44, r * 0.2, PALETTE.meatCookedDark);
      fillEllipse(ctx, cx, cy - r * 0.14, r * 0.94, r * 0.2, PALETTE.meatCooked);
      ctx.save();
      ctx.beginPath();
      ctx.ellipse(cx, cy - r * 0.14, r * 0.94, r * 0.2, 0, 0, Math.PI * 2);
      ctx.clip();
      withAlpha(ctx, 0.8, () => {
        ctx.strokeStyle = PALETTE.meatGrill;
        ctx.lineWidth = Math.max(1.5, r * 0.12);
        for (const dx of [-0.4, 0.06, 0.5]) {
          ctx.beginPath();
          ctx.moveTo(cx + dx * r - r * 0.12, cy - r * 0.34);
          ctx.lineTo(cx + dx * r + r * 0.12, cy + r * 0.06);
          ctx.stroke();
        }
      });
      ctx.restore();
      withAlpha(ctx, 0.45, () => fillEllipse(ctx, cx - r * 0.34, cy - r * 0.22, r * 0.24, r * 0.06, PALETTE.meatCookedLight));
      break;
    }
    case 'lettuce': {
      ruffledPath(ctx, cx, cy, r * 0.92, r * 0.2, 9, 1.5);
      ctx.fillStyle = vGradient(ctx, cy - r * 0.3, cy + r * 0.3, [[0, PALETTE.lettuceLight], [1, PALETTE.lettuce]]);
      ctx.fill();
      ctx.strokeStyle = PALETTE.lettuceDark;
      ctx.lineWidth = Math.max(1, r * 0.08);
      ctx.stroke();
      withAlpha(ctx, 0.6, () => {
        ctx.strokeStyle = PALETTE.lettuceRib;
        ctx.lineWidth = Math.max(1, r * 0.08);
        ctx.beginPath();
        ctx.moveTo(cx - r * 0.7, cy - r * 0.04);
        ctx.quadraticCurveTo(cx, cy - r * 0.16, cx + r * 0.7, cy - r * 0.04);
        ctx.stroke();
      });
      break;
    }
    case 'tomato': {
      fillEllipse(ctx, cx, cy + r * 0.06, r * 0.84, r * 0.22, PALETTE.tomatoDark);
      fillEllipse(ctx, cx, cy - r * 0.04, r * 0.84, r * 0.22, PALETTE.tomato);
      withAlpha(ctx, 0.75, () => fillEllipse(ctx, cx, cy - r * 0.05, r * 0.5, r * 0.11, PALETTE.tomatoFlesh));
      withAlpha(ctx, 0.5, () => fillEllipse(ctx, cx - r * 0.36, cy - r * 0.1, r * 0.18, r * 0.05, '#ffffff'));
      break;
    }
    default: { // bunTop
      fillRound(ctx, cx - r * 0.9, cy + r * 0.04, r * 1.8, r * 0.2, r * 0.09, PALETTE.bunDark);
      ctx.beginPath();
      ctx.ellipse(cx, cy + r * 0.14, r * 0.9, r * 0.62, 0, Math.PI, 0);
      ctx.closePath();
      ctx.fillStyle = radial(ctx, cx - r * 0.3, cy - r * 0.2, r * 0.06, r * 1.2, [
        [0, PALETTE.bunLight], [0.5, PALETTE.bun], [1, PALETTE.bunDark],
      ]);
      ctx.fill();
      ctx.strokeStyle = PALETTE.bunDark;
      ctx.lineWidth = Math.max(1, r * 0.08);
      ctx.stroke();
      for (const [dx, dy] of SESAME_SEEDS) {
        const sy = cy + dy * r * 0.62 + r * 0.08;
        fillEllipse(ctx, cx + dx * r, sy + r * 0.02, r * 0.13, r * 0.06, PALETTE.sesameShade, dx * 0.7);
        fillEllipse(ctx, cx + dx * r, sy, r * 0.12, r * 0.055, PALETTE.sesame, dx * 0.7);
      }
      withAlpha(ctx, 0.35, () => fillEllipse(ctx, cx - r * 0.4, cy - r * 0.24, r * 0.2, r * 0.08, '#ffffff', -0.4));
      break;
    }
  }
}

/** Whole burger for the HUD: the same layers, stacked tight enough to read at 32 px. */
export function drawBurgerStack(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number): void {
  const step = r * 0.3;
  BURGER_LAYERS.forEach((layer, i) => {
    drawBurgerLayer(ctx, layer, cx, cy + r * 0.62 - i * step, r);
  });
}

// ─── Frying pan ─────────────────────────────────────────────────────────────

/** Black skillet seen from above, handle to the right; `content` sits in the well. */
export function drawPan(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, content: ShapeFn | null): void {
  const rimY = cy - r * 0.08;
  const rimRx = r * 0.84;
  const rimRy = rimRx * 0.66;
  const wallH = r * 0.2;

  // Handle, and the collar that bolts it to the pan.
  fillRound(ctx, cx + rimRx * 0.6, rimY - r * 0.14, r * 0.78, r * 0.28, r * 0.12, PALETTE.panHandle);
  withAlpha(ctx, 0.55, () => fillRound(ctx, cx + rimRx * 0.72, rimY - r * 0.11, r * 0.6, r * 0.08, r * 0.04, PALETTE.panHandleLight));
  fillRound(ctx, cx + rimRx * 0.52, rimY - r * 0.2, r * 0.34, r * 0.4, r * 0.1, PALETTE.panDark);

  // Body: rim ellipse over a short wall.
  fillEllipse(ctx, cx, rimY + wallH, rimRx, rimRy, PALETTE.panDark);
  ctx.fillStyle = vGradient(ctx, rimY, rimY + wallH + rimRy, [[0, PALETTE.panBody], [1, PALETTE.panDark]]);
  ctx.fillRect(cx - rimRx, rimY, rimRx * 2, wallH);
  fillEllipse(ctx, cx, rimY, rimRx, rimRy, PALETTE.panBody);
  fillEllipse(ctx, cx, rimY, rimRx * 0.85, rimRy * 0.8, PALETTE.panSurface);
  withAlpha(ctx, 0.18, () => {
    ctx.fillStyle = radial(ctx, cx - r * 0.25, rimY - r * 0.14, r * 0.05, r * 0.9, [[0, '#ffffff'], [1, 'rgba(255,255,255,0)']]);
    ctx.fillRect(cx - rimRx, rimY - rimRy, rimRx * 2, rimRy * 2);
  });

  if (content) content(ctx, cx, rimY + r * 0.04, r * 0.66);

  // Rim highlight last so the food never covers the lip.
  withAlpha(ctx, 0.55, () => {
    ctx.beginPath();
    ctx.ellipse(cx, rimY, rimRx * 0.93, rimRy * 0.9, 0, Math.PI * 1.02, Math.PI * 1.72);
    ctx.strokeStyle = PALETTE.panLight;
    ctx.lineWidth = Math.max(1, r * 0.09);
    ctx.stroke();
  });
}

const RAW_SHAPES: Record<IngredientType, ShapeFn> = {
  onion: drawOnionRaw, tomato: drawTomatoRaw, mushroom: drawMushroomRaw,
  meat: drawMeatRaw, bun: drawBun, lettuce: drawLettuceRaw, fish: drawFishRaw, prawn: drawPrawnRaw,
};
const CHOPPED_SHAPES: Record<IngredientType, ShapeFn> = {
  onion: drawOnionChopped, tomato: drawTomatoChopped, mushroom: drawMushroomChopped,
  meat: drawMeatChopped, bun: drawBun, lettuce: drawLettuceChopped, fish: drawFishChopped, prawn: drawPrawnChopped,
};
/** Fried ingredients after the pan; anything else falls back to its chopped shape. */
const COOKED_SHAPES: Partial<Record<IngredientType, ShapeFn>> = {
  meat: drawMeatCooked,
};

/** Shared by item sprites, HUD icons and the ingredient shown on a crate. */
export function drawIngredient(
  ctx: CanvasRenderingContext2D, type: IngredientType, chopped: boolean, cx: number, cy: number, r: number,
): void {
  (chopped ? CHOPPED_SHAPES : RAW_SHAPES)[type](ctx, cx, cy, r);
}

// ─── Seafood (Overcooked 2 sashimi) ─────────────────────────────────────────

/** A whole fish side-on: blue-grey body, pale belly, a tail fin and an eye. */
function drawFishRaw(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number): void {
  const bodyX = cx - r * 0.12;
  // Tail fin first so the body overlaps its root.
  fillPolygon(ctx, [
    [cx + r * 0.5, cy],
    [cx + r * 0.98, cy - r * 0.42],
    [cx + r * 0.98, cy + r * 0.42],
  ], PALETTE.fishDark);
  ctx.beginPath();
  ctx.ellipse(bodyX, cy, r * 0.7, r * 0.4, 0, 0, Math.PI * 2);
  ctx.fillStyle = vGradient(ctx, cy - r * 0.4, cy + r * 0.4, [[0, PALETTE.fish], [0.55, PALETTE.fish], [1, PALETTE.fishBelly]]);
  ctx.fill();
  ctx.strokeStyle = PALETTE.fishDark;
  ctx.lineWidth = Math.max(1, r * 0.09);
  ctx.stroke();
  // Dorsal fin and eye.
  fillPolygon(ctx, [[bodyX - r * 0.2, cy - r * 0.36], [bodyX + r * 0.05, cy - r * 0.62], [bodyX + r * 0.25, cy - r * 0.36]], PALETTE.fishDark);
  fillCircle(ctx, bodyX - r * 0.4, cy - r * 0.1, r * 0.08, PALETTE.chefEye);
}

/** Three salmon slices: pale orange with white fat lines. */
function drawFishChopped(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number): void {
  const slices: readonly (readonly [number, number, number])[] = [
    [cx - r * 0.5, cy + r * 0.3, -0.35],
    [cx + r * 0.05, cy - r * 0.05, -0.35],
    [cx + r * 0.55, cy - r * 0.42, -0.35],
  ];
  for (const [sx, sy, rot] of slices) {
    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate(rot);
    fillRound(ctx, -r * 0.42, -r * 0.24, r * 0.84, r * 0.48, r * 0.14, PALETTE.fishFlesh);
    strokeRound(ctx, -r * 0.42, -r * 0.24, r * 0.84, r * 0.48, r * 0.14, PALETTE.prawnDark, Math.max(1, r * 0.06));
    withAlpha(ctx, 0.8, () => {
      for (const dx of [-0.22, 0, 0.22]) {
        ctx.beginPath();
        ctx.moveTo(dx * r - r * 0.08, -r * 0.2);
        ctx.quadraticCurveTo(dx * r + r * 0.1, 0, dx * r - r * 0.08, r * 0.2);
        ctx.strokeStyle = PALETTE.fishFleshLight;
        ctx.lineWidth = Math.max(1, r * 0.07);
        ctx.stroke();
      }
    });
    ctx.restore();
  }
}

/** One curled prawn: a thick arc for the body with segment lines and a fanned tail. */
function drawPrawnCurl(ctx: CanvasRenderingContext2D, cx: number, cy: number, s: number): void {
  ctx.beginPath();
  ctx.arc(cx, cy, s * 0.62, Math.PI * 0.95, Math.PI * 1.95);
  ctx.strokeStyle = PALETTE.prawnDark;
  ctx.lineWidth = s * 0.5;
  ctx.lineCap = 'round';
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx, cy, s * 0.62, Math.PI * 0.95, Math.PI * 1.95);
  ctx.strokeStyle = PALETTE.prawn;
  ctx.lineWidth = s * 0.36;
  ctx.stroke();
  withAlpha(ctx, 0.7, () => {
    for (const a of [1.15, 1.35, 1.55, 1.75]) {
      const ang = Math.PI * a;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(ang) * s * 0.46, cy + Math.sin(ang) * s * 0.46);
      ctx.lineTo(cx + Math.cos(ang) * s * 0.78, cy + Math.sin(ang) * s * 0.78);
      ctx.strokeStyle = PALETTE.prawnLight;
      ctx.lineWidth = Math.max(1, s * 0.06);
      ctx.stroke();
    }
  });
  // Tail fan at the arc's end.
  const tailAng = Math.PI * 1.95;
  const tx = cx + Math.cos(tailAng) * s * 0.62;
  const ty = cy + Math.sin(tailAng) * s * 0.62;
  fillPolygon(ctx, [[tx, ty], [tx + s * 0.34, ty - s * 0.22], [tx + s * 0.34, ty + s * 0.26]], PALETTE.prawnDark);
  ctx.lineCap = 'butt';
}

function drawPrawnRaw(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number): void {
  drawPrawnCurl(ctx, cx - r * 0.05, cy + r * 0.12, r * 0.95);
}

/** Two prawn pieces, peeled and halved. */
function drawPrawnChopped(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number): void {
  drawPrawnCurl(ctx, cx - r * 0.42, cy + r * 0.3, r * 0.55);
  drawPrawnCurl(ctx, cx + r * 0.4, cy - r * 0.2, r * 0.55);
}

// ─── Cookware ───────────────────────────────────────────────────────────────

/** Pot body seen slightly from above; `fill` is the liquid colour or null for empty. */
export function drawPot(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, fill: string | null): void {
  const rimY = cy - r * 0.32;
  const rimRx = r * 0.86;
  const rimRy = r * 0.26;

  // Handles.
  for (const side of [-1, 1]) {
    fillRound(ctx, cx + side * rimRx - (side < 0 ? r * 0.3 : 0), rimY - r * 0.02, r * 0.3, r * 0.2, r * 0.08, PALETTE.potDark);
  }

  // Body.
  ctx.beginPath();
  ctx.moveTo(cx - rimRx, rimY);
  ctx.lineTo(cx - r * 0.76, cy + r * 0.5);
  ctx.quadraticCurveTo(cx, cy + r * 0.86, cx + r * 0.76, cy + r * 0.5);
  ctx.lineTo(cx + rimRx, rimY);
  ctx.closePath();
  ctx.fillStyle = vGradient(ctx, rimY, cy + r * 0.8, [[0, PALETTE.potLight], [0.55, PALETTE.potBody], [1, PALETTE.potDark]]);
  ctx.fill();
  ctx.strokeStyle = PALETTE.potDark;
  ctx.lineWidth = Math.max(1, r * 0.08);
  ctx.stroke();

  // Rim and interior.
  fillEllipse(ctx, cx, rimY, rimRx, rimRy, PALETTE.potLight);
  fillEllipse(ctx, cx, rimY, rimRx * 0.82, rimRy * 0.74, PALETTE.potDark);
  if (fill) {
    fillEllipse(ctx, cx, rimY + r * 0.02, rimRx * 0.72, rimRy * 0.62, fill);
    withAlpha(ctx, 0.45, () => {
      fillEllipse(ctx, cx - r * 0.2, rimY, r * 0.11, r * 0.06, '#ffffff');
      fillEllipse(ctx, cx + r * 0.22, rimY + r * 0.04, r * 0.08, r * 0.045, '#ffffff');
    });
  }
  withAlpha(ctx, 0.35, () => {
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = Math.max(1, r * 0.1);
    ctx.beginPath();
    ctx.moveTo(cx - r * 0.5, rimY + r * 0.22);
    ctx.lineTo(cx - r * 0.42, cy + r * 0.42);
    ctx.stroke();
  });
}

/** Plate seen at a shallow angle; `soup` fills the well. */
export function drawPlate(
  ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, soup: string | null, dirty = false,
): void {
  const rx = r * 0.98;
  const ry = r * 0.74;
  const base = dirty ? PALETTE.dirtyPlate : PALETTE.plateWhite;
  const edge = dirty ? PALETTE.dirtySmear : PALETTE.plateShade;

  withAlpha(ctx, 0.16, () => fillEllipse(ctx, cx, cy + r * 0.26, rx, ry * 0.7, '#000000'));
  fillEllipse(ctx, cx, cy + r * 0.08, rx, ry, edge);
  fillEllipse(ctx, cx, cy, rx * 0.96, ry * 0.94, base);
  if (!dirty) strokeEllipse(ctx, cx, cy, rx * 0.78, ry * 0.72, PALETTE.plateRim, Math.max(1.5, r * 0.11));

  if (soup) {
    fillEllipse(ctx, cx, cy, rx * 0.6, ry * 0.56, soup);
    withAlpha(ctx, 0.35, () => fillEllipse(ctx, cx - r * 0.18, cy - r * 0.1, r * 0.16, r * 0.09, '#ffffff'));
    withAlpha(ctx, 0.25, () => fillEllipse(ctx, cx + r * 0.2, cy + r * 0.08, r * 0.1, r * 0.06, '#000000'));
  }
  if (dirty) {
    ctx.strokeStyle = PALETTE.dirtySmear;
    ctx.lineWidth = Math.max(1.5, r * 0.12);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(cx - r * 0.4, cy - r * 0.08);
    ctx.quadraticCurveTo(cx - r * 0.05, cy + r * 0.22, cx + r * 0.32, cy - r * 0.02);
    ctx.moveTo(cx - r * 0.1, cy - r * 0.3);
    ctx.quadraticCurveTo(cx + r * 0.12, cy - r * 0.18, cx + r * 0.36, cy - r * 0.26);
    ctx.stroke();
    ctx.lineCap = 'butt';
  } else {
    withAlpha(ctx, 0.6, () => {
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = Math.max(1, r * 0.08);
      ctx.beginPath();
      ctx.ellipse(cx, cy, rx * 0.88, ry * 0.84, 0, Math.PI * 1.05, Math.PI * 1.45);
      ctx.stroke();
    });
  }
}

// ─── Mechanics spec ─────────────────────────────────────────────────────────

/** Steel serving tray seen from above: a rounded rectangle with a raised rim and a handle
 *  notch at each short end. Empty; presentation stacks the load on top. */
export function drawTray(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number): void {
  const w = r * TRAY.w;
  const h = r * TRAY.h;
  const x = cx - w / 2;
  const y = cy - h / 2;
  const rim = r * TRAY.rim;
  withAlpha(ctx, 0.18, () => fillRound(ctx, x + 1, y + 3, w, h, r * TRAY.corner, '#000000'));
  fillRound(ctx, x, y, w, h, r * TRAY.corner, PALETTE.metalDark);
  ctx.fillStyle = vGradient(ctx, y + rim, y + h - rim, [[0, PALETTE.metalLight], [1, PALETTE.metal]]);
  roundRectPath(ctx, x + rim, y + rim, w - rim * 2, h - rim * 2, r * TRAY.corner * 0.7);
  ctx.fill();
  strokeRound(ctx, x, y, w, h, r * TRAY.corner, PALETTE.metalEdge, Math.max(1, r * 0.08));
  // Handle notches in the rim at the short ends.
  for (const side of [-1, 1]) {
    fillRound(ctx, cx + side * (w / 2 - rim * 1.6) - rim * 0.6, cy - h * 0.18, rim * 1.2, h * 0.36, rim * 0.5, PALETTE.metalEdge);
  }
  // Sheen across the bed.
  withAlpha(ctx, 0.35, () => line(ctx, x + w * 0.2, y + h * 0.3, x + w * 0.62, y + h * 0.3, '#ffffff', Math.max(1, r * 0.07)));
}

/** Closed delivery box: a wooden crate seen from above, planks across the lid and a strap. */
export function drawDeliveryCrate(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number): void {
  const w = r * BOX.w;
  const h = r * BOX.h;
  const x = cx - w / 2;
  const y = cy - h / 2;
  withAlpha(ctx, 0.18, () => fillRound(ctx, x + 1, y + 3, w, h, r * BOX.corner, '#000000'));
  ctx.fillStyle = vGradient(ctx, y, y + h, [[0, PALETTE.woodLight], [1, PALETTE.wood]]);
  roundRectPath(ctx, x, y, w, h, r * BOX.corner);
  ctx.fill();
  strokeRound(ctx, x, y, w, h, r * BOX.corner, PALETTE.woodDark, Math.max(1, r * 0.09));
  // Lid planks.
  withAlpha(ctx, 0.55, () => {
    for (const f of [0.33, 0.66]) line(ctx, x + 1, y + h * f, x + w - 1, y + h * f, PALETTE.woodDark, 1);
  });
  // Strap around the middle, with its buckle.
  const tapeW = r * BOX.tape;
  fillRound(ctx, cx - tapeW / 2, y, tapeW, h, 0, PALETTE.metalDark);
  withAlpha(ctx, 0.5, () => line(ctx, cx - tapeW / 2 + 1, y, cx - tapeW / 2 + 1, y + h, PALETTE.metalLight, 1));
  fillRound(ctx, cx - tapeW * 0.7, cy - tapeW * 0.5, tapeW * 1.4, tapeW, 1, PALETTE.metalLight);
  // Corner nails.
  withAlpha(ctx, 0.6, () => {
    for (const [dx, dy] of [[x + 3, y + 3], [x + w - 3, y + 3], [x + 3, y + h - 3], [x + w - 3, y + h - 3]] as const) {
      fillCircle(ctx, dx, dy, Math.max(1, r * 0.07), PALETTE.woodDark);
    }
  });
}

/** Chalk "86" on a small hanging board: what a kitchen hangs over a crate that has run out. */
export function drawChalk86(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number): void {
  const w = r * CHALK.w;
  const h = r * CHALK.h;
  const x = cx - w / 2;
  const y = cy - h / 2 + r * 0.18; // the string above takes the rest of the sprite
  // String up to a nail.
  const nailY = y - r * 0.5;
  line(ctx, cx - w * 0.3, y, cx, nailY, PALETTE.rope, Math.max(1, r * 0.07));
  line(ctx, cx + w * 0.3, y, cx, nailY, PALETTE.rope, Math.max(1, r * 0.07));
  fillCircle(ctx, cx, nailY, r * 0.1, PALETTE.metalEdge);
  // Frame and board.
  withAlpha(ctx, 0.2, () => fillRound(ctx, x + 1, y + 2, w, h, r * CHALK.corner, '#000000'));
  fillRound(ctx, x, y, w, h, r * CHALK.corner, PALETTE.woodDark);
  const f = r * CHALK.frame;
  ctx.fillStyle = vGradient(ctx, y + f, y + h - f, [[0, CHALK_BOARD_LIGHT], [1, CHALK_BOARD]]);
  roundRectPath(ctx, x + f, y + f, w - f * 2, h - f * 2, r * CHALK.corner * 0.6);
  ctx.fill();
  // Chalk dust, then the figures twice with a hair of offset for a hand-written look.
  withAlpha(ctx, 0.12, () => fillEllipse(ctx, cx, cy + r * 0.2, w * 0.36, h * 0.28, CHALK_WHITE));
  const fontPx = CHALK.fontPx * (r / ITEM_R);
  withAlpha(ctx, 0.55, () => drawText(ctx, '86', cx + 0.6, y + h / 2 + 0.6, { size: fontPx, color: CHALK_WHITE, weight: 'bold' }));
  drawText(ctx, '86', cx, y + h / 2, { size: fontPx, color: CHALK_WHITE, weight: 'bold' });
  withAlpha(ctx, 0.7, () => line(ctx, cx - w * 0.3, y + h - f - r * 0.14, cx + w * 0.3, y + h - f - r * 0.14, CHALK_WHITE, Math.max(1, r * 0.07)));
}

// ─── Effects ────────────────────────────────────────────────────────────────

function drawSmokePuff(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, alpha: number): void {
  withAlpha(ctx, alpha, () => {
    fillCircle(ctx, cx - r * 0.45, cy + r * 0.2, r * 0.55, PALETTE.smoke);
    fillCircle(ctx, cx + r * 0.4, cy + r * 0.26, r * 0.48, PALETTE.smoke);
    fillCircle(ctx, cx, cy - r * 0.25, r * 0.62, PALETTE.smokeLight);
    fillCircle(ctx, cx + r * 0.05, cy + r * 0.15, r * 0.5, PALETTE.smokeLight);
  });
}

function drawFlame(ctx: CanvasRenderingContext2D, cx: number, baseY: number, w: number, h: number): void {
  const halfW = w / 2;
  ctx.beginPath();
  ctx.moveTo(cx - halfW, baseY);
  ctx.quadraticCurveTo(cx - halfW * 1.05, baseY - h * 0.5, cx - halfW * 0.3, baseY - h * 0.78);
  ctx.quadraticCurveTo(cx - halfW * 0.1, baseY - h * 0.95, cx + halfW * 0.05, baseY - h);
  ctx.quadraticCurveTo(cx + halfW * 0.2, baseY - h * 0.6, cx + halfW * 0.6, baseY - h * 0.66);
  ctx.quadraticCurveTo(cx + halfW * 1.08, baseY - h * 0.42, cx + halfW, baseY);
  ctx.closePath();
  ctx.fillStyle = vGradient(ctx, baseY - h, baseY, [[0, PALETTE.fireInner], [0.45, PALETTE.fireOuter], [1, PALETTE.fireDeep]]);
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(cx - halfW * 0.5, baseY);
  ctx.quadraticCurveTo(cx - halfW * 0.6, baseY - h * 0.4, cx - halfW * 0.05, baseY - h * 0.62);
  ctx.quadraticCurveTo(cx + halfW * 0.5, baseY - h * 0.36, cx + halfW * 0.48, baseY);
  ctx.closePath();
  ctx.fillStyle = vGradient(ctx, baseY - h * 0.62, baseY, [[0, '#fff6c2'], [1, PALETTE.fireInner]]);
  ctx.fill();
}

// ─── Texture generation ─────────────────────────────────────────────────────

function centred(size: number): number {
  return size / 2;
}

export function generateItemTextures(scene: Phaser.Scene): void {
  const c = centred(ITEM);

  for (const type of INGREDIENT_TYPES) {
    makeTexture(scene, TEX.ingredient(type, false), ITEM, ITEM, (ctx) => drawIngredient(ctx, type, false, c, c, ITEM_R));
    makeTexture(scene, TEX.ingredient(type, true), ITEM, ITEM, (ctx) => drawIngredient(ctx, type, true, c, c, ITEM_R));
  }
  for (const type of SOUP_INGREDIENTS) {
    makeTexture(scene, TEX.potSoup(type), ITEM, ITEM, (ctx) => drawPot(ctx, c, c, ITEM_R, soupColor(type)));
    makeTexture(scene, TEX.plateSoup(type), ITEM, ITEM, (ctx) => drawPlate(ctx, c, c, ITEM_R, soupColor(type)));
  }

  for (const type of FRIED_INGREDIENTS) {
    const shape = COOKED_SHAPES[type] ?? CHOPPED_SHAPES[type];
    makeTexture(scene, TEX.ingredientCooked(type), ITEM, ITEM, (ctx) => shape(ctx, c, c, ITEM_R));
  }
  makeTexture(scene, TEX.pan, ITEM, ITEM, (ctx) => drawPan(ctx, c, c, ITEM_R, null));
  makeTexture(scene, TEX.panMeat('raw'), ITEM, ITEM, (ctx) => drawPan(ctx, c, c, ITEM_R, drawMeatChopped));
  makeTexture(scene, TEX.panMeat('cooked'), ITEM, ITEM, (ctx) => drawPan(ctx, c, c, ITEM_R, drawMeatCooked));
  makeTexture(scene, TEX.panMeat('burnt'), ITEM, ITEM, (ctx) => {
    drawSmokePuff(ctx, c + ITEM_R * 0.2, c - ITEM_R * 0.92, ITEM_R * 0.5, 0.5);
    drawPan(ctx, c, c, ITEM_R, drawMeatBurnt);
  });
  for (const layer of BURGER_LAYERS) {
    makeTexture(scene, TEX.burgerLayer(layer), ITEM, ITEM, (ctx) => drawBurgerLayer(ctx, layer, c, c, ITEM_R));
  }

  makeTexture(scene, TEX.pot, ITEM, ITEM, (ctx) => drawPot(ctx, c, c, ITEM_R, null));
  makeTexture(scene, TEX.potBurnt, ITEM, ITEM, (ctx) => {
    drawSmokePuff(ctx, c + ITEM_R * 0.15, c - ITEM_R * 0.9, ITEM_R * 0.5, 0.5);
    drawPot(ctx, c, c, ITEM_R, PALETTE.soupBurnt);
    withAlpha(ctx, 0.55, () => {
      fillEllipse(ctx, c - ITEM_R * 0.15, c - ITEM_R * 0.3, ITEM_R * 0.2, ITEM_R * 0.1, '#4a4441');
      fillEllipse(ctx, c + ITEM_R * 0.25, c - ITEM_R * 0.26, ITEM_R * 0.14, ITEM_R * 0.08, '#4a4441');
    });
  });

  makeTexture(scene, TEX.plate, ITEM, ITEM, (ctx) => drawPlate(ctx, c, c, ITEM_R, null));
  makeTexture(scene, TEX.dirtyPlate, ITEM, ITEM, (ctx) => {
    withAlpha(ctx, 0.5, () => fillEllipse(ctx, c, c + ITEM_R * 0.34, ITEM_R * 0.94, ITEM_R * 0.7, PALETTE.dirtySmear));
    drawPlate(ctx, c, c + ITEM_R * 0.16, ITEM_R * 0.96, null, true);
    drawPlate(ctx, c, c - ITEM_R * 0.14, ITEM_R, null, true);
  });

  makeTexture(scene, TEX.extinguisher, ITEM, ITEM, (ctx) => {
    const bodyW = ITEM_R * 0.86;
    const bodyH = ITEM_R * 1.3;
    const x = c - bodyW / 2;
    const y = c - bodyH * 0.34;
    // Neck, then the nozzle horn hanging off it.
    fillRound(ctx, c - ITEM_R * 0.16, c - ITEM_R * 1.05, ITEM_R * 0.32, ITEM_R * 0.8, ITEM_R * 0.1, PALETTE.nozzleBlack);
    fillPolygon(ctx, [
      [c + ITEM_R * 0.08, c - ITEM_R * 0.92],
      [c + ITEM_R * 0.9, c - ITEM_R * 1.08],
      [c + ITEM_R * 0.9, c - ITEM_R * 0.5],
      [c + ITEM_R * 0.08, c - ITEM_R * 0.62],
    ], PALETTE.nozzleBlack);
    fillRound(ctx, c - ITEM_R * 0.3, c - ITEM_R * 1.12, ITEM_R * 0.6, ITEM_R * 0.22, ITEM_R * 0.08, PALETTE.nozzleBlack);
    // Cylinder.
    fillRound(ctx, x, y, bodyW, bodyH, ITEM_R * 0.28, PALETTE.extinguisher);
    ctx.save();
    roundRectPath(ctx, x, y, bodyW, bodyH, ITEM_R * 0.28);
    ctx.clip();
    ctx.fillStyle = vGradient(ctx, y, y + bodyH, [[0, '#ff6a5c'], [0.5, PALETTE.extinguisher], [1, PALETTE.extinguisherDark]]);
    ctx.fillRect(x, y, bodyW, bodyH);
    withAlpha(ctx, 0.9, () => ctx.fillRect(x, y + bodyH * 0.42, bodyW, bodyH * 0.16));
    ctx.fillStyle = PALETTE.textLight;
    withAlpha(ctx, 0.85, () => ctx.fillRect(x, y + bodyH * 0.44, bodyW, bodyH * 0.14));
    ctx.restore();
    strokeRound(ctx, x, y, bodyW, bodyH, ITEM_R * 0.28, PALETTE.extinguisherDark, 1.5);
    withAlpha(ctx, 0.45, () => fillRound(ctx, x + bodyW * 0.16, y + bodyH * 0.1, bodyW * 0.16, bodyH * 0.3, bodyW * 0.08, '#ffffff'));
  });

  // Mechanics spec (docs/MECHANICS.md).
  makeTexture(scene, TEX.tray, ITEM, ITEM, (ctx) => drawTray(ctx, c, c, ITEM_R));
  makeTexture(scene, TEX.deliveryCrate, ITEM, ITEM, (ctx) => drawDeliveryCrate(ctx, c, c, ITEM_R));
  makeTexture(scene, TEX.chalk86, FX, FX, (ctx) => drawChalk86(ctx, centred(FX), centred(FX), ITEM_R));

  makeTexture(scene, TEX.fire, FIRE, FIRE, (ctx) => {
    const fc = centred(FIRE);
    drawFlame(ctx, fc, FIRE - 6, FIRE * 0.62, FIRE * 0.86);
    withAlpha(ctx, 0.85, () => {
      drawFlame(ctx, fc - FIRE * 0.24, FIRE - 8, FIRE * 0.26, FIRE * 0.38);
      drawFlame(ctx, fc + FIRE * 0.26, FIRE - 7, FIRE * 0.22, FIRE * 0.32);
    });
    withAlpha(ctx, 0.7, () => {
      fillCircle(ctx, fc - FIRE * 0.2, FIRE * 0.16, 2.5, PALETTE.fireInner);
      fillCircle(ctx, fc + FIRE * 0.18, FIRE * 0.1, 2, PALETTE.fireInner);
    });
  });

  makeTexture(scene, TEX.spray, FX, FX, (ctx) => {
    const sc = centred(FX);
    const originY = sc + FX * 0.42;
    // Cone of droplets spreading up and out from the nozzle.
    for (const [spread, dist, size, alpha] of SPRAY_DROPS) {
      const a = -Math.PI / 2 + spread;
      withAlpha(ctx, alpha, () => {
        fillCircle(ctx, sc + Math.cos(a) * dist * FX, originY + Math.sin(a) * dist * FX, size * FX, PALETTE.mist);
      });
    }
    withAlpha(ctx, 0.22, () => {
      ctx.beginPath();
      ctx.moveTo(sc - FX * 0.05, originY);
      ctx.lineTo(sc - FX * 0.34, FX * 0.12);
      ctx.lineTo(sc + FX * 0.34, FX * 0.12);
      ctx.lineTo(sc + FX * 0.05, originY);
      ctx.closePath();
      ctx.fillStyle = PALETTE.mist;
      ctx.fill();
    });
  });

  makeTexture(scene, TEX.smoke, FX, FX, (ctx) => {
    drawSmokePuff(ctx, centred(FX), centred(FX), FX * 0.36, 0.7);
  });
}

// Re-exported so tiles.ts and ui.ts can reuse the effect shapes.
export { drawSmokePuff, drawFlame };
