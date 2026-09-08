// ─── HUD icons, panels and button prompts ───────────────────────────────────
// Icons are 32 px and reuse the ingredient/plate shapes from items.ts so the HUD
// and the world always agree. Panels are plain backgrounds: presentation draws
// its own text and icons on top, so nothing here bakes in a label.
import type Phaser from 'phaser';
import { INGREDIENT_TYPES, SOUP_INGREDIENTS } from '../sim/types';
import { PROMPT_LABELS, TEX, TEXTURE_SIZES } from './keys';
import { PALETTE } from './palette';
import {
  drawText, fillCircle, fillEllipse, fillRound, line, makeTexture, radial,
  roundRectPath, starPath, strokeCircle, strokeRound, vGradient, withAlpha,
} from './draw';
import { drawIngredient, drawPlate, soupColor } from './items';

// ─── Constants ──────────────────────────────────────────────────────────────

const ICON = TEXTURE_SIZES.icon;          // 32
const ICON_C = ICON / 2;
const ICON_R = 11;                        // shape radius inside an icon
const CARD_W = TEXTURE_SIZES.orderCardW;  // 96
const CARD_H = TEXTURE_SIZES.orderCardH;  // 120
const CARD_HEADER_H = 22;
const PANEL_W = TEXTURE_SIZES.panelW;     // 256
const PANEL_H = TEXTURE_SIZES.panelH;     // 160
const PROMPT_W = TEXTURE_SIZES.promptW;   // 48
const PROMPT_H = TEXTURE_SIZES.promptH;   // 32
const PROMPT_R = 13;                      // face-button radius

const XBOX_COLORS: Record<string, string> = {
  A: PALETTE.xboxA, B: PALETTE.xboxB, X: PALETTE.xboxX, Y: PALETTE.xboxY,
};
/** Letters that need dark ink because their button is light. */
const DARK_LETTERS: readonly string[] = ['Y'];
const PS_COLORS: Record<string, string> = {
  Cross: PALETTE.psCross, Circle: PALETTE.psCircle, Square: PALETTE.psSquare, Triangle: PALETTE.psTriangle,
};

// ─── Icon shapes ────────────────────────────────────────────────────────────

/** White bowl with a blue band, filled with soup; used for the order icons. */
function drawSoupBowl(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, color: string): void {
  withAlpha(ctx, 0.5, () => {
    ctx.strokeStyle = PALETTE.smokeLight;
    ctx.lineWidth = Math.max(1, r * 0.13);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(cx - r * 0.3, cy - r * 0.5);
    ctx.quadraticCurveTo(cx - r * 0.55, cy - r * 0.9, cx - r * 0.25, cy - r * 1.2);
    ctx.moveTo(cx + r * 0.3, cy - r * 0.5);
    ctx.quadraticCurveTo(cx + r * 0.55, cy - r * 0.9, cx + r * 0.25, cy - r * 1.2);
    ctx.stroke();
    ctx.lineCap = 'butt';
  });

  ctx.beginPath();
  ctx.ellipse(cx, cy - r * 0.12, r, r * 0.95, 0, 0, Math.PI);
  ctx.closePath();
  ctx.fillStyle = PALETTE.plateWhite;
  ctx.fill();
  ctx.strokeStyle = PALETTE.plateShade;
  ctx.lineWidth = Math.max(1, r * 0.11);
  ctx.stroke();

  fillEllipse(ctx, cx, cy - r * 0.12, r, r * 0.3, PALETTE.plateWhite);
  fillEllipse(ctx, cx, cy - r * 0.1, r * 0.82, r * 0.22, color);
  withAlpha(ctx, 0.4, () => fillEllipse(ctx, cx - r * 0.3, cy - r * 0.16, r * 0.22, r * 0.07, '#ffffff'));
  withAlpha(ctx, 0.8, () => {
    ctx.beginPath();
    ctx.ellipse(cx, cy - r * 0.12, r * 0.84, r * 0.78, 0, Math.PI * 0.12, Math.PI * 0.88);
    ctx.strokeStyle = PALETTE.plateRim;
    ctx.lineWidth = Math.max(1.5, r * 0.16);
    ctx.stroke();
  });
}

function drawClock(ctx: CanvasRenderingContext2D): void {
  fillRound(ctx, ICON_C - 3, 2, 6, 4, 2, PALETTE.metalDark);
  fillCircle(ctx, ICON_C, ICON_C + 1, 13, PALETTE.metalLight);
  fillCircle(ctx, ICON_C, ICON_C + 1, 10.5, PALETTE.textLight);
  strokeCircle(ctx, ICON_C, ICON_C + 1, 12, PALETTE.metalDark, 2);
  ctx.strokeStyle = PALETTE.textDark;
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(ICON_C, ICON_C + 1);
  ctx.lineTo(ICON_C, ICON_C - 6);
  ctx.moveTo(ICON_C, ICON_C + 1);
  ctx.lineTo(ICON_C + 5, ICON_C + 3);
  ctx.stroke();
  ctx.lineCap = 'butt';
  fillCircle(ctx, ICON_C, ICON_C + 1, 1.6, PALETTE.danger);
}

function drawCoin(ctx: CanvasRenderingContext2D): void {
  fillCircle(ctx, ICON_C, ICON_C, 14, PALETTE.hudGoldDark);
  ctx.beginPath();
  ctx.arc(ICON_C, ICON_C, 12.5, 0, Math.PI * 2);
  ctx.fillStyle = radial(ctx, ICON_C - 4, ICON_C - 4, 1, 18, [[0, '#ffe089'], [0.6, PALETTE.hudGold], [1, PALETTE.hudGoldDark]]);
  ctx.fill();
  strokeCircle(ctx, ICON_C, ICON_C, 8.5, PALETTE.hudGoldDark, 1.5);
  withAlpha(ctx, 0.75, () => {
    ctx.beginPath();
    ctx.arc(ICON_C, ICON_C, 10.5, Math.PI * 1.05, Math.PI * 1.5);
    ctx.strokeStyle = '#fff3c4';
    ctx.lineWidth = 2;
    ctx.stroke();
  });
}

function drawStar(ctx: CanvasRenderingContext2D, filled: boolean): void {
  starPath(ctx, ICON_C, ICON_C + 1, 14, 6);
  if (filled) {
    ctx.fillStyle = vGradient(ctx, 2, ICON - 2, [[0, '#ffe07a'], [0.55, PALETTE.star], [1, PALETTE.starEdge]]);
    ctx.fill();
    ctx.strokeStyle = PALETTE.starEdge;
  } else {
    withAlpha(ctx, 0.28, () => {
      ctx.fillStyle = '#000000';
      ctx.fill();
    });
    ctx.strokeStyle = PALETTE.starEmpty;
  }
  ctx.lineWidth = 2;
  ctx.stroke();
}

// ─── Panels ─────────────────────────────────────────────────────────────────

function drawOrderCard(ctx: CanvasRenderingContext2D): void {
  withAlpha(ctx, 0.18, () => fillRound(ctx, 3, 5, CARD_W - 6, CARD_H - 6, 9, '#000000'));
  fillRound(ctx, 2, 2, CARD_W - 4, CARD_H - 6, 9, PALETTE.uiCardBg);

  // Header strip, clipped to the card's rounded top.
  ctx.save();
  roundRectPath(ctx, 2, 2, CARD_W - 4, CARD_H - 6, 9);
  ctx.clip();
  ctx.fillStyle = vGradient(ctx, 2, 2 + CARD_HEADER_H, [[0, '#5fb254'], [1, PALETTE.uiCardHeader]]);
  ctx.fillRect(2, 2, CARD_W - 4, CARD_HEADER_H);
  withAlpha(ctx, 0.25, () => {
    ctx.fillStyle = '#000000';
    ctx.fillRect(2, 2 + CARD_HEADER_H - 3, CARD_W - 4, 3);
  });
  ctx.restore();

  // Recess where presentation stacks the recipe icons.
  fillRound(ctx, 9, CARD_HEADER_H + 8, CARD_W - 22, CARD_H - CARD_HEADER_H - 34, 6, PALETTE.uiCardBgAlt);
  withAlpha(ctx, 0.35, () => strokeRound(ctx, 9, CARD_HEADER_H + 8, CARD_W - 22, CARD_H - CARD_HEADER_H - 34, 6, PALETTE.uiCardBorder, 1.5));
  // Groove for the order timer bar.
  withAlpha(ctx, 0.3, () => fillRound(ctx, 9, CARD_H - 20, CARD_W - 22, 10, 5, PALETTE.uiCardBorder));

  strokeRound(ctx, 2, 2, CARD_W - 4, CARD_H - 6, 9, PALETTE.uiCardBorder, 3);
}

function drawPanel(ctx: CanvasRenderingContext2D): void {
  withAlpha(ctx, 0.25, () => fillRound(ctx, 4, 7, PANEL_W - 8, PANEL_H - 10, 16, '#000000'));
  roundRectPath(ctx, 3, 3, PANEL_W - 6, PANEL_H - 10, 16);
  ctx.fillStyle = vGradient(ctx, 3, PANEL_H - 7, [[0, PALETTE.uiPanelBgAlt], [1, PALETTE.uiPanelBg]]);
  ctx.fill();
  strokeRound(ctx, 3, 3, PANEL_W - 6, PANEL_H - 10, 16, PALETTE.uiPanelBorder, 3);
  withAlpha(ctx, 0.25, () => strokeRound(ctx, 9, 9, PANEL_W - 18, PANEL_H - 22, 12, PALETTE.uiPanelBorder, 1.5));
  withAlpha(ctx, 0.12, () => fillRound(ctx, 10, 10, PANEL_W - 20, 26, 10, '#ffffff'));
}

// ─── Button prompts ─────────────────────────────────────────────────────────

function drawFaceButton(ctx: CanvasRenderingContext2D, cx: number, cy: number, fill: string): void {
  withAlpha(ctx, 0.3, () => fillCircle(ctx, cx, cy + 2, PROMPT_R, '#000000'));
  ctx.beginPath();
  ctx.arc(cx, cy, PROMPT_R, 0, Math.PI * 2);
  ctx.fillStyle = radial(ctx, cx - 4, cy - 5, 1, PROMPT_R * 1.6, [[0, '#ffffff'], [0.12, fill], [1, fill]]);
  ctx.fill();
  withAlpha(ctx, 0.35, () => strokeCircle(ctx, cx, cy, PROMPT_R - 1, '#000000', 2));
  withAlpha(ctx, 0.3, () => {
    ctx.beginPath();
    ctx.arc(cx, cy, PROMPT_R - 1.5, Math.PI * 1.12, Math.PI * 1.55);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.stroke();
  });
}

function drawPsShape(ctx: CanvasRenderingContext2D, label: string, cx: number, cy: number, color: string): void {
  ctx.strokeStyle = color;
  ctx.lineWidth = 2.6;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const s = 5.5;
  switch (label) {
    case 'Cross':
      ctx.beginPath();
      ctx.moveTo(cx - s, cy - s); ctx.lineTo(cx + s, cy + s);
      ctx.moveTo(cx + s, cy - s); ctx.lineTo(cx - s, cy + s);
      ctx.stroke();
      break;
    case 'Circle':
      strokeCircle(ctx, cx, cy, s + 0.5, color, 2.6);
      break;
    case 'Square':
      ctx.strokeRect(cx - s, cy - s, s * 2, s * 2);
      break;
    default: // Triangle
      ctx.beginPath();
      ctx.moveTo(cx, cy - s - 1);
      ctx.lineTo(cx + s + 1, cy + s);
      ctx.lineTo(cx - s - 1, cy + s);
      ctx.closePath();
      ctx.stroke();
      break;
  }
  ctx.lineCap = 'butt';
  ctx.lineJoin = 'miter';
}

function drawKeycap(ctx: CanvasRenderingContext2D, label: string): void {
  withAlpha(ctx, 0.3, () => fillRound(ctx, 2, 6, PROMPT_W - 4, PROMPT_H - 8, 6, '#000000'));
  fillRound(ctx, 2, 5, PROMPT_W - 4, PROMPT_H - 8, 6, PALETTE.keycapEdge);
  fillRound(ctx, 3, 3, PROMPT_W - 6, PROMPT_H - 9, 5, PALETTE.keycap);
  strokeRound(ctx, 3, 3, PROMPT_W - 6, PROMPT_H - 9, 5, PALETTE.keycapEdge, 1.5);
  withAlpha(ctx, 0.7, () => line(ctx, 7, 6, PROMPT_W - 7, 6, '#ffffff', 1.5));
  drawText(ctx, label, PROMPT_W / 2, PROMPT_H / 2 - 1, {
    size: label.length > 4 ? 11 : 13, color: PALETTE.keycapText, maxWidth: PROMPT_W - 12,
  });
}

function drawPrompt(ctx: CanvasRenderingContext2D, label: string): void {
  const cx = PROMPT_W / 2;
  const cy = PROMPT_H / 2;
  const xbox = XBOX_COLORS[label];
  if (xbox) {
    drawFaceButton(ctx, cx, cy, xbox);
    drawText(ctx, label, cx, cy + 0.5, {
      size: 15, color: DARK_LETTERS.includes(label) ? PALETTE.keycapText : PALETTE.textLight,
    });
    return;
  }
  const ps = PS_COLORS[label];
  if (ps) {
    drawFaceButton(ctx, cx, cy, PALETTE.psFace);
    drawPsShape(ctx, label, cx, cy, ps);
    return;
  }
  drawKeycap(ctx, label);
}

// ─── Texture generation ─────────────────────────────────────────────────────

export function generateUiTextures(scene: Phaser.Scene): void {
  for (const type of INGREDIENT_TYPES) {
    makeTexture(scene, TEX.icon(type), ICON, ICON, (ctx) => drawIngredient(ctx, type, false, ICON_C, ICON_C, ICON_R));
  }
  for (const type of SOUP_INGREDIENTS) {
    makeTexture(scene, TEX.iconSoup(type), ICON, ICON, (ctx) => drawSoupBowl(ctx, ICON_C, ICON_C + 2, ICON_R, soupColor(type)));
  }
  // PLACEHOLDERS until the art pass: burger icon and lock icon.
  makeTexture(scene, TEX.iconBurger, ICON, ICON, (ctx) => {
    ctx.fillStyle = '#e0b070';
    ctx.beginPath(); ctx.ellipse(ICON_C, ICON_C - 5, ICON_R * 0.9, ICON_R * 0.5, 0, Math.PI, 0); ctx.fill();
    ctx.fillStyle = '#7a4a34'; ctx.fillRect(ICON_C - ICON_R * 0.9, ICON_C - 2, ICON_R * 1.8, 5);
    ctx.fillStyle = '#7cc25a'; ctx.fillRect(ICON_C - ICON_R * 0.9, ICON_C + 3, ICON_R * 1.8, 3);
    ctx.fillStyle = '#e0b070'; ctx.fillRect(ICON_C - ICON_R * 0.9, ICON_C + 6, ICON_R * 1.8, 5);
  });
  makeTexture(scene, TEX.iconLock, ICON, ICON, (ctx) => {
    ctx.strokeStyle = '#c9bfae'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(ICON_C, ICON_C - 3, ICON_R * 0.45, Math.PI, 0); ctx.stroke();
    ctx.fillStyle = '#c9bfae'; ctx.fillRect(ICON_C - ICON_R * 0.6, ICON_C - 3, ICON_R * 1.2, ICON_R * 0.9);
  });
  makeTexture(scene, TEX.iconPlate, ICON, ICON, (ctx) => drawPlate(ctx, ICON_C, ICON_C, ICON_R + 1, null));
  makeTexture(scene, TEX.iconClock, ICON, ICON, drawClock);
  makeTexture(scene, TEX.iconCoin, ICON, ICON, drawCoin);
  makeTexture(scene, TEX.iconStar, ICON, ICON, (ctx) => drawStar(ctx, true));
  makeTexture(scene, TEX.iconStarEmpty, ICON, ICON, (ctx) => drawStar(ctx, false));

  makeTexture(scene, TEX.orderCard, CARD_W, CARD_H, drawOrderCard);
  makeTexture(scene, TEX.panel, PANEL_W, PANEL_H, drawPanel);

  for (const label of PROMPT_LABELS) {
    makeTexture(scene, TEX.buttonPrompt(label), PROMPT_W, PROMPT_H, (ctx) => drawPrompt(ctx, label));
  }
}
