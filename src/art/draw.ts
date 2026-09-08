// ─── Canvas drawing helpers ─────────────────────────────────────────────────
// Every texture in this module is drawn into a Phaser CanvasTexture with the 2D
// context, so gradients, rounded shapes and text are all available. Nothing here
// touches pixels one at a time: generateTextures() has to stay well under 200 ms.
import type Phaser from 'phaser';
import { log } from '../log';

// ─── Constants ──────────────────────────────────────────────────────────────

export const FONT_STACK = 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';

export type Point = readonly [number, number];
export type GradientStop = readonly [offset: number, color: string];

export interface TextOptions {
  size: number;
  color: string;
  weight?: string;
  align?: CanvasTextAlign;
  baseline?: CanvasTextBaseline;
  maxWidth?: number;
}

// ─── Texture creation ───────────────────────────────────────────────────────

export type DrawFn = (ctx: CanvasRenderingContext2D, w: number, h: number) => void;

/**
 * Create one canvas-backed texture and run `draw` on its context. Idempotent:
 * an existing key is left untouched so a scene restart never redraws.
 */
export function makeTexture(scene: Phaser.Scene, key: string, w: number, h: number, draw: DrawFn): void {
  if (scene.textures.exists(key)) return;
  const tex = scene.textures.createCanvas(key, w, h);
  if (!tex) {
    log.warn('art: could not create canvas texture', key);
    return;
  }
  const ctx = tex.getContext();
  ctx.save();
  draw(ctx, w, h);
  ctx.restore();
  tex.refresh();
}

// ─── Paths ──────────────────────────────────────────────────────────────────

export function roundRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  const rad = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.lineTo(x + w - rad, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + rad);
  ctx.lineTo(x + w, y + h - rad);
  ctx.quadraticCurveTo(x + w, y + h, x + w - rad, y + h);
  ctx.lineTo(x + rad, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - rad);
  ctx.lineTo(x, y + rad);
  ctx.quadraticCurveTo(x, y, x + rad, y);
  ctx.closePath();
}

export function fillRound(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number, color: string): void {
  roundRectPath(ctx, x, y, w, h, r);
  ctx.fillStyle = color;
  ctx.fill();
}

export function strokeRound(
  ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number, color: string, lineWidth = 2,
): void {
  roundRectPath(ctx, x, y, w, h, r);
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.stroke();
}

export function fillCircle(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, color: string): void {
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
}

export function strokeCircle(
  ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, color: string, lineWidth = 2,
): void {
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.stroke();
}

export function fillEllipse(
  ctx: CanvasRenderingContext2D, cx: number, cy: number, rx: number, ry: number, color: string, rotation = 0,
): void {
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, rotation, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
}

export function strokeEllipse(
  ctx: CanvasRenderingContext2D, cx: number, cy: number, rx: number, ry: number, color: string, lineWidth = 2, rotation = 0,
): void {
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, rotation, 0, Math.PI * 2);
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.stroke();
}

export function polygonPath(ctx: CanvasRenderingContext2D, points: readonly Point[]): void {
  ctx.beginPath();
  points.forEach(([px, py], i) => (i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py)));
  ctx.closePath();
}

export function fillPolygon(ctx: CanvasRenderingContext2D, points: readonly Point[], color: string): void {
  polygonPath(ctx, points);
  ctx.fillStyle = color;
  ctx.fill();
}

export function strokePolygon(
  ctx: CanvasRenderingContext2D, points: readonly Point[], color: string, lineWidth = 2,
): void {
  polygonPath(ctx, points);
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.stroke();
}

/** Five-pointed star centred on (cx, cy). */
export function starPath(ctx: CanvasRenderingContext2D, cx: number, cy: number, outer: number, inner: number): void {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const px = cx + Math.cos(a) * r;
    const py = cy + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

export function line(
  ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, color: string, lineWidth = 1,
): void {
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1, y1);
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.stroke();
}

// ─── Fills ──────────────────────────────────────────────────────────────────

export function vGradient(
  ctx: CanvasRenderingContext2D, y0: number, y1: number, stops: readonly GradientStop[],
): CanvasGradient {
  const g = ctx.createLinearGradient(0, y0, 0, y1);
  for (const [offset, color] of stops) g.addColorStop(offset, color);
  return g;
}

export function radial(
  ctx: CanvasRenderingContext2D, cx: number, cy: number, r0: number, r1: number, stops: readonly GradientStop[],
): CanvasGradient {
  const g = ctx.createRadialGradient(cx, cy, r0, cx, cy, r1);
  for (const [offset, color] of stops) g.addColorStop(offset, color);
  return g;
}

/** Translucent fill without touching the caller's globalAlpha afterwards. */
export function withAlpha(ctx: CanvasRenderingContext2D, alpha: number, body: () => void): void {
  const prev = ctx.globalAlpha;
  ctx.globalAlpha = alpha;
  body();
  ctx.globalAlpha = prev;
}

// ─── Text ───────────────────────────────────────────────────────────────────

export function drawText(ctx: CanvasRenderingContext2D, str: string, x: number, y: number, o: TextOptions): void {
  ctx.font = `${o.weight ?? 'bold'} ${o.size}px ${FONT_STACK}`;
  ctx.textAlign = o.align ?? 'center';
  ctx.textBaseline = o.baseline ?? 'middle';
  ctx.fillStyle = o.color;
  if (o.maxWidth !== undefined) ctx.fillText(str, x, y, o.maxWidth);
  else ctx.fillText(str, x, y);
}
