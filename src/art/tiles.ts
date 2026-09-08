// ─── Tile textures ──────────────────────────────────────────────────────────
// 64x64 tiles in a fake 3/4 view: solid furniture is a block whose top face fills
// the tile down to y = TOP_H, with a darker front edge below it, so a row of
// counters reads as a chunky wooden bench. Ground tiles (floor, road, void) are
// flat. Tiles butt up against their neighbours, so nothing is rounded at the
// outer corners.
import type Phaser from 'phaser';
import { INGREDIENT_TYPES, type IngredientType, type TileType } from '../sim/types';
import { TEX, TEXTURE_SIZES, TILE_TYPES } from './keys';
import { PALETTE } from './palette';
import {
  fillCircle, fillEllipse, fillPolygon, fillRound, line, makeTexture, radial, roundRectPath,
  strokeEllipse, strokeRound, vGradient, withAlpha,
} from './draw';
import { drawIngredient } from './items';

// ─── Constants ──────────────────────────────────────────────────────────────

const T = TEXTURE_SIZES.tile;      // 64
const FRONT_H = 10;                // front edge of a solid block
const TOP_H = T - FRONT_H;         // 54
const TOP_CX = T / 2;
const TOP_CY = TOP_H / 2;          // 27, centre of the usable top face
const CHECKER = 16;                // floor check size
const INSET = 6;                   // usual inset of fixtures from the tile edge
const ZEBRA_Y = 15;
const ZEBRA_H = 34;
const GROOVE = 3;                  // width of the groove around an open gate slab
const LEDGE_TOP_H = T - 16;        // a risen gate ledge has a deeper front face than a counter
/** Zig-zag of the seam crack on an open gate tile, left edge to right edge. */
const CRACK_POINTS: readonly (readonly [number, number])[] = [
  [12, 27], [22, 36], [34, 28], [45, 37], [T, T / 2],
];
/** Rubble along that crack: [x, y, radius]. */
const RUBBLE: readonly (readonly [number, number, number])[] = [
  [17, 22, 1.8], [29, 41, 1.5], [41, 24, 1.6], [52, 40, 1.4],
];

interface BlockColors {
  top: string;
  topHi: string;
  edge: string;
  edgeDark: string;
}

const WOOD_BLOCK: BlockColors = {
  top: PALETTE.counterTop, topHi: PALETTE.counterTopHi, edge: PALETTE.counterEdge, edgeDark: PALETTE.counterEdgeDark,
};
const CRATE_BLOCK: BlockColors = {
  top: PALETTE.wood, topHi: PALETTE.woodLight, edge: PALETTE.woodDark, edgeDark: '#6f4319',
};
const STOVE_BLOCK: BlockColors = {
  top: PALETTE.stoveBody, topHi: '#d24a3a', edge: PALETTE.stoveBodyDark, edgeDark: '#6d1c14',
};
const METAL_BLOCK: BlockColors = {
  top: PALETTE.metal, topHi: PALETTE.metalLight, edge: PALETTE.metalDark, edgeDark: PALETTE.metalEdge,
};
const TRASH_BLOCK: BlockColors = {
  top: '#4a5049', topHi: '#5d6459', edge: PALETTE.trashBody, edgeDark: '#262a26',
};
const DECK_BLOCK: BlockColors = {
  top: PALETTE.deckPlank, topHi: '#d3aa74', edge: PALETTE.deckSeam, edgeDark: '#6d4f29',
};
const LEDGE_BLOCK: BlockColors = {
  top: PALETTE.ledgeTop, topHi: PALETTE.ledgeTopHi, edge: PALETTE.ledgeFace, edgeDark: PALETTE.ledgeFaceDark,
};

// ─── Shared block ───────────────────────────────────────────────────────────

/** Warm block with a lit top face and a darker front edge. */
function drawBlock(ctx: CanvasRenderingContext2D, c: BlockColors): void {
  ctx.fillStyle = vGradient(ctx, 0, TOP_H, [[0, c.topHi], [0.4, c.top], [1, c.top]]);
  ctx.fillRect(0, 0, T, TOP_H);

  ctx.fillStyle = vGradient(ctx, TOP_H, T, [[0, c.edge], [1, c.edgeDark]]);
  ctx.fillRect(0, TOP_H, T, FRONT_H);

  // Lip where the top face folds into the front edge.
  withAlpha(ctx, 0.35, () => line(ctx, 0, TOP_H + 0.5, T, TOP_H + 0.5, '#ffffff', 1));
  // Block seams so a run of counters still reads as separate blocks.
  withAlpha(ctx, 0.22, () => {
    line(ctx, 0.5, 0, 0.5, T, c.edgeDark, 1);
    line(ctx, T - 0.5, 0, T - 0.5, T, c.edgeDark, 1);
    line(ctx, 0, 0.5, T, 0.5, c.edgeDark, 1);
  });
}

/** Soft drop shadow under a fixture sitting on the top face. */
function fixtureShadow(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  withAlpha(ctx, 0.16, () => fillRound(ctx, x + 1, y + 3, w, h, r, '#000000'));
}

// ─── Ground tiles ───────────────────────────────────────────────────────────

function drawFloor(ctx: CanvasRenderingContext2D): void {
  for (let gy = 0; gy < T / CHECKER; gy++) {
    for (let gx = 0; gx < T / CHECKER; gx++) {
      ctx.fillStyle = (gx + gy) % 2 === 0 ? PALETTE.floorLight : PALETTE.floorDark;
      ctx.fillRect(gx * CHECKER, gy * CHECKER, CHECKER, CHECKER);
    }
  }
  withAlpha(ctx, 0.35, () => {
    for (let i = 1; i < T / CHECKER; i++) {
      line(ctx, i * CHECKER, 0, i * CHECKER, T, PALETTE.floorGrout, 1);
      line(ctx, 0, i * CHECKER, T, i * CHECKER, PALETTE.floorGrout, 1);
    }
  });
  // Gentle sheen so a big floor is not perfectly flat.
  withAlpha(ctx, 0.12, () => {
    ctx.fillStyle = radial(ctx, T * 0.3, T * 0.25, 2, T, [[0, '#ffffff'], [1, 'rgba(255,255,255,0)']]);
    ctx.fillRect(0, 0, T, T);
  });
}

/** Deterministic speckle so asphalt is not a flat grey slab. */
function speckle(ctx: CanvasRenderingContext2D, count: number, color: string, alpha: number, seed: number): void {
  let s = seed;
  const next = (): number => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
  withAlpha(ctx, alpha, () => {
    ctx.fillStyle = color;
    for (let i = 0; i < count; i++) ctx.fillRect(Math.floor(next() * T), Math.floor(next() * T), 2, 2);
  });
}

function drawRoad(ctx: CanvasRenderingContext2D): void {
  ctx.fillStyle = vGradient(ctx, 0, T, [[0, PALETTE.roadAsphalt], [1, PALETTE.roadAsphaltDark]]);
  ctx.fillRect(0, 0, T, T);
  speckle(ctx, 40, '#ffffff', 0.06, 7);
  speckle(ctx, 40, '#000000', 0.08, 19);
  // One zebra bar per tile: stacked vertically they form the crossing.
  ctx.fillStyle = PALETTE.roadLine;
  ctx.fillRect(0, ZEBRA_Y, T, ZEBRA_H);
  withAlpha(ctx, 0.25, () => {
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, ZEBRA_Y + ZEBRA_H - 3, T, 3);
  });
}

function drawVoid(ctx: CanvasRenderingContext2D): void {
  ctx.fillStyle = PALETTE.voidDark;
  ctx.fillRect(0, 0, T, T);
  withAlpha(ctx, 0.5, () => {
    ctx.fillStyle = radial(ctx, TOP_CX, TOP_CX, T * 0.2, T * 0.8, [[0, PALETTE.voidEdge], [1, 'rgba(0,0,0,0)']]);
    ctx.fillRect(0, 0, T, T);
  });
}

/** Earthquake seam, open: floor that a chef can cross, ringed by the groove the
 *  slab rises through and split by a crack that lines up across neighbours. */
function drawGate(ctx: CanvasRenderingContext2D): void {
  drawFloor(ctx);
  // Groove around the slab, with a lit inner lip along the top.
  withAlpha(ctx, 0.5, () => {
    ctx.fillStyle = PALETTE.gateCrack;
    ctx.fillRect(0, 0, T, GROOVE);
    ctx.fillRect(0, T - GROOVE, T, GROOVE);
    ctx.fillRect(0, 0, GROOVE, T);
    ctx.fillRect(T - GROOVE, 0, GROOVE, T);
  });
  withAlpha(ctx, 0.45, () => {
    line(ctx, GROOVE, GROOVE + 0.5, T - GROOVE, GROOVE + 0.5, '#ffffff', 1);
    line(ctx, GROOVE + 0.5, GROOVE, GROOVE + 0.5, T - GROOVE, '#ffffff', 1);
  });
  // Crack across the middle: it enters and leaves at mid-height on both edges.
  withAlpha(ctx, 0.8, () => {
    ctx.strokeStyle = PALETTE.gateCrack;
    ctx.lineWidth = 1.6;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(0, T / 2);
    for (const [x, y] of CRACK_POINTS) ctx.lineTo(x, y);
    ctx.stroke();
  });
  withAlpha(ctx, 0.5, () => {
    ctx.strokeStyle = PALETTE.floorLight;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, T / 2 + 2);
    for (const [x, y] of CRACK_POINTS) ctx.lineTo(x, y + 2);
    ctx.stroke();
  });
  ctx.lineJoin = 'miter';
  // Rubble shaken loose along the seam.
  withAlpha(ctx, 0.75, () => {
    for (const [x, y, rr] of RUBBLE) fillCircle(ctx, x, y, rr, PALETTE.gateRubble);
  });
}

// ─── Furniture tiles ────────────────────────────────────────────────────────

function drawCounter(ctx: CanvasRenderingContext2D): void {
  drawBlock(ctx, WOOD_BLOCK);
  withAlpha(ctx, 0.18, () => {
    strokeRound(ctx, 4.5, 4.5, T - 9, TOP_H - 9, 4, PALETTE.counterEdgeDark, 1);
  });
  withAlpha(ctx, 0.3, () => line(ctx, 6, 8, T - 6, 8, '#ffffff', 1));
}

function drawCrate(ctx: CanvasRenderingContext2D, ingredient: IngredientType): void {
  drawBlock(ctx, CRATE_BLOCK);
  // Plank seams on the wooden box.
  withAlpha(ctx, 0.3, () => {
    line(ctx, 0, 18, T, 18, PALETTE.woodDark, 1);
    line(ctx, 0, 38, T, 38, PALETTE.woodDark, 1);
  });
  fixtureShadow(ctx, INSET, INSET, T - INSET * 2, TOP_H - INSET * 2, 6);
  fillRound(ctx, INSET, INSET - 1, T - INSET * 2, TOP_H - INSET * 2, 6, PALETTE.woodDark);
  strokeRound(ctx, INSET, INSET - 1, T - INSET * 2, TOP_H - INSET * 2, 6, '#6f4319', 2);
  fillCircle(ctx, TOP_CX, TOP_CY - 1, 17, PALETTE.metalLight);
  withAlpha(ctx, 0.35, () => fillCircle(ctx, TOP_CX, TOP_CY - 1, 17, PALETTE.floorDark));
  drawIngredient(ctx, ingredient, false, TOP_CX, TOP_CY - 1, 12);
}

function drawBoard(ctx: CanvasRenderingContext2D): void {
  drawCounter(ctx);
  fixtureShadow(ctx, 5, 7, T - 10, TOP_H - 14, 5);
  fillRound(ctx, 5, 6, T - 10, TOP_H - 14, 5, PALETTE.boardSurface);
  strokeRound(ctx, 5, 6, T - 10, TOP_H - 14, 5, PALETTE.boardCut, 1.5);
  withAlpha(ctx, 0.55, () => {
    line(ctx, 12, 16, 26, 16, PALETTE.boardCut, 1.5);
    line(ctx, 14, 24, 30, 24, PALETTE.boardCut, 1.5);
    line(ctx, 11, 33, 24, 33, PALETTE.boardCut, 1.5);
  });

  // Knife lying across the board.
  ctx.save();
  ctx.translate(38, 30);
  ctx.rotate(-0.62);
  fillPolygon(ctx, [[-20, -4], [12, -5], [14, 0], [12, 4], [-20, 3]], PALETTE.metalLight);
  fillPolygon(ctx, [[-20, 1], [12, 2], [12, 4], [-20, 3]], PALETTE.metal);
  fillRound(ctx, 12, -4, 16, 8, 3, PALETTE.woodDark);
  withAlpha(ctx, 0.5, () => line(ctx, -18, -2, 10, -3, '#ffffff', 1));
  ctx.restore();
}

function drawStove(ctx: CanvasRenderingContext2D): void {
  drawBlock(ctx, STOVE_BLOCK);
  fixtureShadow(ctx, 4, 4, T - 8, TOP_H - 8, 7);
  fillRound(ctx, 4, 3, T - 8, TOP_H - 8, 7, PALETTE.hob);
  strokeRound(ctx, 4, 3, T - 8, TOP_H - 8, 7, '#17171a', 2);
  withAlpha(ctx, 0.5, () => {
    ctx.fillStyle = radial(ctx, TOP_CX, TOP_CY - 2, 2, 24, [[0, PALETTE.hobGlow], [1, 'rgba(0,0,0,0)']]);
    ctx.fillRect(4, 3, T - 8, TOP_H - 8);
  });
  for (const r of [17, 10]) {
    ctx.beginPath();
    ctx.arc(TOP_CX, TOP_CY - 2, r, 0, Math.PI * 2);
    ctx.strokeStyle = PALETTE.hobRing;
    ctx.lineWidth = 3;
    ctx.stroke();
  }
  withAlpha(ctx, 0.6, () => fillCircle(ctx, TOP_CX, TOP_CY - 2, 3, PALETTE.hobGlow));
  withAlpha(ctx, 0.5, () => {
    for (const [dx, dy] of [[9, 8], [T - 9, 8], [9, TOP_H - 8], [T - 9, TOP_H - 8]] as const) {
      fillCircle(ctx, dx, dy, 1.6, PALETTE.metalDark);
    }
  });
}

function drawSink(ctx: CanvasRenderingContext2D): void {
  drawCounter(ctx);
  // Tap at the back.
  fillRound(ctx, 42, 4, 6, 14, 3, PALETTE.metalLight);
  fillRound(ctx, 26, 8, 20, 5, 2.5, PALETTE.metalLight);
  fillRound(ctx, 26, 11, 5, 6, 2, PALETTE.metal);
  strokeRound(ctx, 42, 4, 6, 14, 3, PALETTE.metalDark, 1);

  fixtureShadow(ctx, 6, 15, T - 12, TOP_H - 22, 6);
  fillRound(ctx, 6, 14, T - 12, TOP_H - 22, 6, PALETTE.metalDark);
  fillRound(ctx, 8, 16, T - 16, TOP_H - 26, 5, PALETTE.sinkBasin);
  withAlpha(ctx, 0.6, () => fillRound(ctx, 10, 18, T - 20, 6, 3, PALETTE.sinkWater));
  fillEllipse(ctx, TOP_CX, TOP_CY + 8, 5, 3.5, PALETTE.metalDark);
  withAlpha(ctx, 0.45, () => fillEllipse(ctx, TOP_CX - 8, TOP_CY + 4, 6, 3, '#ffffff'));
}

function drawDrying(ctx: CanvasRenderingContext2D): void {
  drawCounter(ctx);
  fixtureShadow(ctx, 6, 9, T - 12, TOP_H - 18, 4);
  fillRound(ctx, 6, 8, T - 12, TOP_H - 18, 4, PALETTE.metalDark);
  fillRound(ctx, 8, 10, T - 16, TOP_H - 22, 3, '#8b959b');
  ctx.strokeStyle = PALETTE.metalLight;
  ctx.lineWidth = 2;
  for (let x = 12; x < T - 10; x += 7) line(ctx, x, 11, x, TOP_H - 13, PALETTE.metalLight, 2);
  for (let y = 14; y < TOP_H - 13; y += 8) line(ctx, 9, y, T - 9, y, PALETTE.metal, 1.5);
  strokeRound(ctx, 6, 8, T - 12, TOP_H - 18, 4, PALETTE.metalEdge, 2);
}

function drawPlateReturn(ctx: CanvasRenderingContext2D): void {
  drawBlock(ctx, METAL_BLOCK);
  fillRound(ctx, 5, 5, T - 10, TOP_H - 12, 5, '#899298');
  strokeRound(ctx, 5, 5, T - 10, TOP_H - 12, 5, PALETTE.metalEdge, 2);
  // Return slot.
  fillRound(ctx, 11, 9, T - 22, 12, 4, '#33383d');
  withAlpha(ctx, 0.5, () => line(ctx, 11, 21, T - 11, 21, '#ffffff', 1));
  // Chevrons pointing into the slot.
  ctx.strokeStyle = PALETTE.metalLight;
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  for (const y of [40, 32]) {
    ctx.beginPath();
    ctx.moveTo(TOP_CX - 9, y - 6);
    ctx.lineTo(TOP_CX, y);
    ctx.lineTo(TOP_CX + 9, y - 6);
    ctx.stroke();
  }
  ctx.lineCap = 'butt';
  withAlpha(ctx, 0.55, () => {
    for (const [dx, dy] of [[9, 9], [T - 9, 9], [9, TOP_H - 10], [T - 9, TOP_H - 10]] as const) {
      fillCircle(ctx, dx, dy, 1.6, PALETTE.metalEdge);
    }
  });
}

function drawServe(ctx: CanvasRenderingContext2D): void {
  drawBlock(ctx, WOOD_BLOCK);
  fixtureShadow(ctx, 5, 5, T - 10, TOP_H - 11, 6);
  fillRound(ctx, 5, 4, T - 10, TOP_H - 11, 6, PALETTE.serveRecess);
  withAlpha(ctx, 0.85, () => {
    ctx.save();
    roundRectPath(ctx, 5, 4, T - 10, TOP_H - 11, 6);
    ctx.clip();
    ctx.fillStyle = radial(ctx, TOP_CX, 14, 2, 40, [[0, PALETTE.serveGlow], [1, 'rgba(0,0,0,0)']]);
    ctx.fillRect(5, 4, T - 10, TOP_H - 11);
    ctx.restore();
  });
  strokeRound(ctx, 5, 4, T - 10, TOP_H - 11, 6, PALETTE.serveGlowDark, 2);
  // Up arrow: food leaves the kitchen this way.
  fillPolygon(ctx, [[TOP_CX, 10], [TOP_CX + 13, 24], [TOP_CX + 6, 24], [TOP_CX + 6, 38], [TOP_CX - 6, 38], [TOP_CX - 6, 24], [TOP_CX - 13, 24]], PALETTE.textLight);
  withAlpha(ctx, 0.6, () => line(ctx, 8, 7, T - 8, 7, PALETTE.serveGlow, 2));
}

function drawTrash(ctx: CanvasRenderingContext2D): void {
  drawBlock(ctx, TRASH_BLOCK);
  fixtureShadow(ctx, 11, 12, T - 22, TOP_H - 18, 6);
  // Tapered bin body.
  fillPolygon(ctx, [[13, 14], [T - 13, 14], [T - 17, TOP_H - 4], [17, TOP_H - 4]], PALETTE.trashBody);
  withAlpha(ctx, 0.35, () => {
    line(ctx, 24, 18, 22, TOP_H - 6, '#000000', 2);
    line(ctx, 40, 18, 42, TOP_H - 6, '#000000', 2);
  });
  // Green lid with an open mouth.
  fillRound(ctx, 9, 6, T - 18, 14, 6, PALETTE.trashLid);
  strokeRound(ctx, 9, 6, T - 18, 14, 6, PALETTE.trashLidDark, 2);
  fillEllipse(ctx, TOP_CX, 14, 16, 6, '#1b2018');
  withAlpha(ctx, 0.45, () => fillEllipse(ctx, TOP_CX - 5, 12, 7, 2.5, '#ffffff'));
}

function drawPlateStack(ctx: CanvasRenderingContext2D): void {
  drawCounter(ctx);
  withAlpha(ctx, 0.35, () => fillEllipse(ctx, TOP_CX, TOP_CY + 2, 19, 13, PALETTE.plateWhite));
  strokeEllipse(ctx, TOP_CX, TOP_CY + 2, 19, 13, PALETTE.plateRim, 2);
  withAlpha(ctx, 0.5, () => strokeEllipse(ctx, TOP_CX, TOP_CY + 2, 12, 8, PALETTE.plateRimDark, 1.5));
}

function drawSlider(ctx: CanvasRenderingContext2D): void {
  drawBlock(ctx, DECK_BLOCK);
  // Deck planks running across the top face.
  withAlpha(ctx, 0.5, () => {
    for (const y of [13, 27, 41]) {
      line(ctx, 0, y, T, y, PALETTE.deckSeam, 1.5);
      line(ctx, 0, y + 1.5, T, y + 1.5, PALETTE.deckPlankAlt, 1);
    }
  });
  withAlpha(ctx, 0.25, () => {
    ctx.fillStyle = PALETTE.deckPlankAlt;
    ctx.fillRect(0, 14, T, 13);
    ctx.fillRect(0, 42, T, 12);
  });
  // Rope trim along the front edge.
  fillRound(ctx, 0, TOP_H + 1, T, FRONT_H - 2, 3, PALETTE.rope);
  ctx.strokeStyle = PALETTE.ropeDark;
  ctx.lineWidth = 1.5;
  for (let x = -6; x < T + 6; x += 6) {
    ctx.beginPath();
    ctx.moveTo(x, T - 2);
    ctx.lineTo(x + 5, TOP_H + 2);
    ctx.stroke();
  }
  withAlpha(ctx, 0.35, () => line(ctx, 0, TOP_H + 2, T, TOP_H + 2, '#ffffff', 1));
}

/** Earthquake seam, closed: the slab has risen into a stone ledge that blocks the
 *  tile. Presentation draws this over the gate tile, so it covers the whole tile. */
function drawGateClosed(ctx: CanvasRenderingContext2D): void {
  drawBlock(ctx, LEDGE_BLOCK);
  // A ledge stands taller than a counter, so its front face is deeper.
  ctx.fillStyle = vGradient(ctx, LEDGE_TOP_H, T, [[0, PALETTE.ledgeFace], [1, PALETTE.ledgeFaceDark]]);
  ctx.fillRect(0, LEDGE_TOP_H, T, T - LEDGE_TOP_H);
  withAlpha(ctx, 0.4, () => line(ctx, 0, LEDGE_TOP_H + 0.5, T, LEDGE_TOP_H + 0.5, '#ffffff', 1));
  // Rough rock rather than a flat slab.
  speckle(ctx, 34, '#ffffff', 0.12, 41);
  speckle(ctx, 34, '#000000', 0.12, 67);
  withAlpha(ctx, 0.4, () => {
    ctx.strokeStyle = PALETTE.ledgeFaceDark;
    ctx.lineWidth = 1.5;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(8, 6);
    ctx.lineTo(20, 18);
    ctx.lineTo(14, 30);
    ctx.lineTo(26, 44);
    ctx.moveTo(T - 10, 12);
    ctx.lineTo(T - 24, 22);
    ctx.lineTo(T - 18, 36);
    ctx.stroke();
    ctx.lineJoin = 'miter';
  });
  // Mortar courses on the front face, so the ledge reads as a wall of rock.
  withAlpha(ctx, 0.45, () => {
    line(ctx, 0, LEDGE_TOP_H + 8, T, LEDGE_TOP_H + 8, PALETTE.ledgeMortar, 1);
    for (const x of [14, 34, 52]) line(ctx, x, LEDGE_TOP_H + 1, x, LEDGE_TOP_H + 8, PALETTE.ledgeMortar, 1);
    for (const x of [24, 44]) line(ctx, x, LEDGE_TOP_H + 8, x, T, PALETTE.ledgeMortar, 1);
  });
  // Lit top lip and the shadow the risen ledge throws back over the tile above.
  withAlpha(ctx, 0.55, () => line(ctx, 0, 1.5, T, 1.5, PALETTE.ledgeTopHi, 3));
  withAlpha(ctx, 0.3, () => {
    ctx.fillStyle = vGradient(ctx, 0, 8, [[0, '#000000'], [1, 'rgba(0,0,0,0)']]);
    ctx.fillRect(0, 0, T, 8);
  });
}

// ─── Texture generation ─────────────────────────────────────────────────────

type TileDraw = (ctx: CanvasRenderingContext2D) => void;

const TILE_DRAWERS: Record<Exclude<TileType, 'crate'>, TileDraw> = {
  void: drawVoid,
  floor: drawFloor,
  road: drawRoad,
  counter: drawCounter,
  board: drawBoard,
  stove: drawStove,
  sink: drawSink,
  drying: drawDrying,
  plateReturn: drawPlateReturn,
  serve: drawServe,
  trash: drawTrash,
  plateStack: drawPlateStack,
  slider: drawSlider,
  gate: drawGate,
};

export function generateTileTextures(scene: Phaser.Scene): void {
  for (const type of TILE_TYPES) {
    if (type === 'crate') continue;
    const draw = TILE_DRAWERS[type];
    makeTexture(scene, TEX.tile(type), T, T, (ctx) => draw(ctx));
  }
  makeTexture(scene, TEX.gateClosed, T, T, (ctx) => drawGateClosed(ctx));
  for (const ingredient of INGREDIENT_TYPES) {
    makeTexture(scene, TEX.crate(ingredient), T, T, (ctx) => drawCrate(ctx, ingredient));
  }
}
