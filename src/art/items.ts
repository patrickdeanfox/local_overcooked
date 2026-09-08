// ─── Item and effect textures ───────────────────────────────────────────────
// Everything a chef can hold or that floats over a tile: ingredients, pots,
// plates, the extinguisher, fire, spray and smoke. All transparent, centred, and
// drawn from shape helpers that take a radius so the 40 px item sprites and the
// 32 px HUD icons share one set of shapes.
import type Phaser from 'phaser';
import { INGREDIENT_TYPES, type IngredientType } from '../sim/types';
import { TEX, TEXTURE_SIZES } from './keys';
import { PALETTE } from './palette';
import {
  fillCircle, fillEllipse, fillPolygon, fillRound, makeTexture, radial, roundRectPath,
  strokeEllipse, strokeRound, vGradient, withAlpha, type Point,
} from './draw';

// ─── Constants ──────────────────────────────────────────────────────────────

const ITEM = TEXTURE_SIZES.item;      // 40
const FX = TEXTURE_SIZES.fx;          // 40
const FIRE = TEXTURE_SIZES.fire;      // 64
const ITEM_R = 15;                    // shape radius inside a 40 px item sprite

const SOUP_COLORS: Record<IngredientType, string> = {
  onion: PALETTE.soupOnion,
  tomato: PALETTE.soupTomato,
  mushroom: PALETTE.soupMushroom,
};

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

const RAW_SHAPES: Record<IngredientType, ShapeFn> = {
  onion: drawOnionRaw, tomato: drawTomatoRaw, mushroom: drawMushroomRaw,
};
const CHOPPED_SHAPES: Record<IngredientType, ShapeFn> = {
  onion: drawOnionChopped, tomato: drawTomatoChopped, mushroom: drawMushroomChopped,
};

/** Shared by item sprites, HUD icons and the ingredient shown on a crate. */
export function drawIngredient(
  ctx: CanvasRenderingContext2D, type: IngredientType, chopped: boolean, cx: number, cy: number, r: number,
): void {
  (chopped ? CHOPPED_SHAPES : RAW_SHAPES)[type](ctx, cx, cy, r);
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
    makeTexture(scene, TEX.potSoup(type), ITEM, ITEM, (ctx) => drawPot(ctx, c, c, ITEM_R, soupColor(type)));
    makeTexture(scene, TEX.plateSoup(type), ITEM, ITEM, (ctx) => drawPlate(ctx, c, c, ITEM_R, soupColor(type)));
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
