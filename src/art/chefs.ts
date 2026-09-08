// ─── Chef textures ──────────────────────────────────────────────────────────
// 64x80, transparent, feet on the bottom edge so presentation can anchor a chef
// by its feet. Chef 0 wears a blue apron, chef 1 a red one; the apron colour is
// the only thing that changes between the two. Facing reads from the head:
// down = full face, up = back of the head with crossed apron straps, left/right
// = profile with one eye. The left texture is the right one mirrored.
import type Phaser from 'phaser';
import { CHEF_COUNT, FACINGS, TEX, TEXTURE_SIZES } from './keys';
import type { Facing } from '../sim/types';
import { PALETTE } from './palette';
import { fillCircle, fillEllipse, fillRound, line, strokeRound, makeTexture, withAlpha } from './draw';

// ─── Constants ──────────────────────────────────────────────────────────────

const W = TEXTURE_SIZES.chefW;   // 64
const H = TEXTURE_SIZES.chefH;   // 80

const HEAD_R = 13;
const HEAD_CY = 34;
const HAT_BAND = { y: 15, h: 10, halfW: 13 } as const;
const TORSO = { y: 46, h: 26, halfW: 16, r: 8 } as const;
const APRON = { y: 52, h: 21, halfW: 12, r: 5 } as const;
const LEG_Y = 69;
const SHOE_Y = 74;
const OUTLINE = PALETTE.chefHatShade;

interface ChefColors {
  apron: string;
  apronTrim: string;
}

const CHEF_COLORS: readonly ChefColors[] = [
  { apron: PALETTE.chef0Body, apronTrim: PALETTE.chef0Trim },
  { apron: PALETTE.chef1Body, apronTrim: PALETTE.chef1Trim },
];

// ─── Shared parts ───────────────────────────────────────────────────────────

/** Tall puffy chef hat; `cx` is the head centre, the band sits on the head. */
function drawHat(ctx: CanvasRenderingContext2D, cx: number): void {
  fillEllipse(ctx, cx, 11, 15, 9, PALETTE.chefHat);
  fillCircle(ctx, cx - 8, 10, 7, PALETTE.chefHat);
  fillCircle(ctx, cx + 8, 10, 7, PALETTE.chefHat);
  fillCircle(ctx, cx, 7.5, 7.5, PALETTE.chefHat);   // top of the hat, kept inside the canvas
  withAlpha(ctx, 0.5, () => {
    fillEllipse(ctx, cx + 6, 13, 8, 5, PALETTE.chefHatShade);
  });
  fillRound(ctx, cx - HAT_BAND.halfW, HAT_BAND.y, HAT_BAND.halfW * 2, HAT_BAND.h, 4, PALETTE.chefHat);
  strokeRound(ctx, cx - HAT_BAND.halfW, HAT_BAND.y, HAT_BAND.halfW * 2, HAT_BAND.h, 4, OUTLINE, 1.5);
  withAlpha(ctx, 0.6, () => fillRound(ctx, cx - HAT_BAND.halfW + 1, HAT_BAND.y + HAT_BAND.h - 4, HAT_BAND.halfW * 2 - 2, 3, 1.5, PALETTE.chefHatShade));
}

function drawShoes(ctx: CanvasRenderingContext2D, leftX: number, rightX: number): void {
  fillRound(ctx, leftX, SHOE_Y, 13, 5, 2.5, PALETTE.chefShoe);
  fillRound(ctx, rightX, SHOE_Y, 13, 5, 2.5, PALETTE.chefShoe);
}

function drawLegs(ctx: CanvasRenderingContext2D, leftX: number, rightX: number): void {
  fillRound(ctx, leftX, LEG_Y, 8, 7, 3, PALETTE.chefHatShade);
  fillRound(ctx, rightX, LEG_Y, 8, 7, 3, PALETTE.chefHatShade);
}

function drawHand(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  fillCircle(ctx, x, y, 5, PALETTE.chefSkin);
  withAlpha(ctx, 0.45, () => fillCircle(ctx, x + 1.5, y + 1.5, 3.5, PALETTE.chefSkinShade));
}

function drawArm(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
  fillRound(ctx, x, y, w, h, w / 2, PALETTE.chefHat);
  strokeRound(ctx, x, y, w, h, w / 2, OUTLINE, 1.5);
}

// ─── Facings ────────────────────────────────────────────────────────────────

function drawChefDown(ctx: CanvasRenderingContext2D, c: ChefColors): void {
  const cx = W / 2;
  drawLegs(ctx, cx - 9, cx + 1);
  drawShoes(ctx, cx - 13, cx);

  // Neck, torso, apron.
  fillRound(ctx, cx - 4, 42, 8, 8, 3, PALETTE.chefSkinShade);
  fillRound(ctx, cx - TORSO.halfW, TORSO.y, TORSO.halfW * 2, TORSO.h, TORSO.r, PALETTE.chefHat);
  strokeRound(ctx, cx - TORSO.halfW, TORSO.y, TORSO.halfW * 2, TORSO.h, TORSO.r, OUTLINE, 1.5);
  fillRound(ctx, cx - 7, TORSO.y - 2, 14, 10, 3, c.apron);           // bib
  fillRound(ctx, cx - APRON.halfW, APRON.y, APRON.halfW * 2, APRON.h, APRON.r, c.apron);
  withAlpha(ctx, 0.5, () => fillRound(ctx, cx - APRON.halfW, APRON.y + APRON.h - 5, APRON.halfW * 2, 5, APRON.r, c.apronTrim));
  line(ctx, cx - 6, TORSO.y - 1, cx - 11, TORSO.y + 3, c.apron, 3);  // straps
  line(ctx, cx + 6, TORSO.y - 1, cx + 11, TORSO.y + 3, c.apron, 3);

  drawArm(ctx, cx - 21, 50, 9, 17);
  drawArm(ctx, cx + 12, 50, 9, 17);

  // Head.
  fillCircle(ctx, cx - HEAD_R + 1, HEAD_CY + 2, 3.5, PALETTE.chefSkinShade);
  fillCircle(ctx, cx + HEAD_R - 1, HEAD_CY + 2, 3.5, PALETTE.chefSkinShade);
  fillCircle(ctx, cx, HEAD_CY, HEAD_R, PALETTE.chefSkin);
  withAlpha(ctx, 0.35, () => fillEllipse(ctx, cx, HEAD_CY + 8, HEAD_R * 0.8, 4, PALETTE.chefSkinShade));
  // Fringe peeking out from under the hat.
  ctx.beginPath();
  ctx.arc(cx, HEAD_CY, HEAD_R, Math.PI * 1.12, Math.PI * 1.88);
  ctx.lineTo(cx, HEAD_CY - 4);
  ctx.closePath();
  ctx.fillStyle = PALETTE.chefHair;
  ctx.fill();

  fillCircle(ctx, cx - 5, HEAD_CY + 1, 2.6, PALETTE.chefEye);
  fillCircle(ctx, cx + 5, HEAD_CY + 1, 2.6, PALETTE.chefEye);
  withAlpha(ctx, 0.9, () => {
    fillCircle(ctx, cx - 4.2, HEAD_CY, 1, '#ffffff');
    fillCircle(ctx, cx + 5.8, HEAD_CY, 1, '#ffffff');
  });
  ctx.beginPath();
  ctx.arc(cx, HEAD_CY + 4, 4.5, Math.PI * 0.18, Math.PI * 0.82);
  ctx.strokeStyle = PALETTE.chefEye;
  ctx.lineWidth = 1.6;
  ctx.stroke();

  drawHat(ctx, cx);
  drawHand(ctx, cx - 10, 66);
  drawHand(ctx, cx + 10, 66);
}

function drawChefUp(ctx: CanvasRenderingContext2D, c: ChefColors): void {
  const cx = W / 2;
  drawLegs(ctx, cx - 9, cx + 1);
  drawShoes(ctx, cx - 13, cx);

  fillRound(ctx, cx - 4, 42, 8, 8, 3, PALETTE.chefSkinShade);
  fillRound(ctx, cx - TORSO.halfW, TORSO.y, TORSO.halfW * 2, TORSO.h, TORSO.r, PALETTE.chefHat);
  strokeRound(ctx, cx - TORSO.halfW, TORSO.y, TORSO.halfW * 2, TORSO.h, TORSO.r, OUTLINE, 1.5);

  // Apron seen from behind: crossed straps, waist band, bow.
  line(ctx, cx - 8, TORSO.y + 1, cx + 7, TORSO.y + 15, c.apron, 4);
  line(ctx, cx + 8, TORSO.y + 1, cx - 7, TORSO.y + 15, c.apron, 4);
  fillRound(ctx, cx - TORSO.halfW + 1, TORSO.y + 14, TORSO.halfW * 2 - 2, 9, 3, c.apron);
  withAlpha(ctx, 0.5, () => fillRound(ctx, cx - TORSO.halfW + 1, TORSO.y + 19, TORSO.halfW * 2 - 2, 4, 2, c.apronTrim));
  fillCircle(ctx, cx - 4, TORSO.y + 18, 3.5, c.apronTrim);
  fillCircle(ctx, cx + 4, TORSO.y + 18, 3.5, c.apronTrim);

  drawArm(ctx, cx - 21, 50, 9, 17);
  drawArm(ctx, cx + 12, 50, 9, 17);
  drawHand(ctx, cx - 17, 66);
  drawHand(ctx, cx + 17, 66);

  // Back of the head: all hair, no face.
  fillCircle(ctx, cx - HEAD_R + 1, HEAD_CY + 2, 3.5, PALETTE.chefSkinShade);
  fillCircle(ctx, cx + HEAD_R - 1, HEAD_CY + 2, 3.5, PALETTE.chefSkinShade);
  fillCircle(ctx, cx, HEAD_CY, HEAD_R, PALETTE.chefHair);
  withAlpha(ctx, 0.35, () => fillEllipse(ctx, cx - 4, HEAD_CY - 3, 6, 4, '#ffffff', -0.5));
  fillRound(ctx, cx - 5, HEAD_CY + 9, 10, 6, 3, PALETTE.chefSkinShade);

  drawHat(ctx, cx);
}

/** Right-facing profile; the left texture is this one mirrored. */
function drawChefRight(ctx: CanvasRenderingContext2D, c: ChefColors): void {
  const cx = W / 2 + 1;
  const headCx = cx + 2;

  // Back arm and back leg go down first so the torso overlaps them.
  drawArm(ctx, cx - 14, 51, 9, 15);
  drawHand(ctx, cx - 10, 65);
  fillRound(ctx, cx - 7, LEG_Y, 8, 7, 3, PALETTE.chefHatShade);
  fillRound(ctx, cx - 10, SHOE_Y, 15, 5, 2.5, PALETTE.chefShoe);

  fillRound(ctx, headCx - 4, 42, 8, 8, 3, PALETTE.chefSkinShade);
  fillRound(ctx, cx - 13, TORSO.y, 26, TORSO.h, TORSO.r, PALETTE.chefHat);
  strokeRound(ctx, cx - 13, TORSO.y, 26, TORSO.h, TORSO.r, OUTLINE, 1.5);
  fillRound(ctx, cx - 4, TORSO.y - 2, 12, 9, 3, c.apron);
  fillRound(ctx, cx - 6, APRON.y, 19, APRON.h, APRON.r, c.apron);
  withAlpha(ctx, 0.5, () => fillRound(ctx, cx - 6, APRON.y + APRON.h - 5, 19, 5, APRON.r, c.apronTrim));
  line(ctx, cx - 5, TORSO.y + 2, cx + 9, TORSO.y + 12, c.apronTrim, 2);

  // Front leg and shoe.
  fillRound(ctx, cx + 1, LEG_Y, 8, 7, 3, PALETTE.chefHatShade);
  fillRound(ctx, cx - 2, SHOE_Y, 17, 5, 2.5, PALETTE.chefShoe);

  // Head in profile.
  fillCircle(ctx, headCx, HEAD_CY, HEAD_R, PALETTE.chefSkin);
  ctx.beginPath();
  ctx.arc(headCx, HEAD_CY, HEAD_R, Math.PI * 0.6, Math.PI * 1.62);
  ctx.closePath();
  ctx.fillStyle = PALETTE.chefHair;
  ctx.fill();
  fillCircle(ctx, headCx - 3, HEAD_CY + 3, 3.5, PALETTE.chefSkinShade);   // ear
  fillCircle(ctx, headCx + HEAD_R - 2, HEAD_CY + 2, 3, PALETTE.chefSkin); // nose
  fillCircle(ctx, headCx + 6, HEAD_CY + 1, 2.6, PALETTE.chefEye);
  withAlpha(ctx, 0.9, () => fillCircle(ctx, headCx + 6.8, HEAD_CY, 1, '#ffffff'));
  line(ctx, headCx + 4, HEAD_CY + 7, headCx + 9, HEAD_CY + 6, PALETTE.chefEye, 1.6);

  drawHat(ctx, headCx);

  // Front arm reaching forward with the hand ahead of the body.
  drawArm(ctx, cx + 5, 52, 9, 15);
  drawHand(ctx, cx + 12, 65);
}

// ─── Texture generation ─────────────────────────────────────────────────────

function drawChef(ctx: CanvasRenderingContext2D, index: number, facing: Facing): void {
  const c = CHEF_COLORS[index % CHEF_COLORS.length];
  if (facing === 'down') { drawChefDown(ctx, c); return; }
  if (facing === 'up') { drawChefUp(ctx, c); return; }
  if (facing === 'right') { drawChefRight(ctx, c); return; }
  ctx.translate(W, 0);
  ctx.scale(-1, 1);
  drawChefRight(ctx, c);
}

export function generateChefTextures(scene: Phaser.Scene): void {
  for (let index = 0; index < CHEF_COUNT; index++) {
    for (const facing of FACINGS) {
      makeTexture(scene, TEX.chef(index, facing), W, H, (ctx) => drawChef(ctx, index, facing));
    }
  }
}
