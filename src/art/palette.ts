// ─── Palette ────────────────────────────────────────────────────────────────
// Named colours shared by the code-drawn textures and by presentation (HUD text,
// tints, particle colours). Values are CSS hex strings so they can be handed to a
// 2D canvas context or a Phaser text style directly; PALETTE_INT has the same
// names as 0xRRGGBB numbers for tints, Graphics fills and camera backgrounds.
//
// Style target: Overcooked 1 — warm woods, buttery counter tops, cream/teal floor.

export const PALETTE = {
  // ── Chefs ──
  chef0Body: '#2f6fd0',
  chef0Trim: '#1d4c95',
  chef1Body: '#d24236',
  chef1Trim: '#9b2a20',
  chefSkin: '#f2c9a0',
  chefSkinShade: '#d8a578',
  chefHat: '#fbfaf5',
  chefHatShade: '#ddd9ce',
  chefHair: '#4a3428',
  chefShoe: '#5b4a3a',
  chefEye: '#2b241e',

  // ── Floor and ground ──
  floorLight: '#efe3c8',
  floorDark: '#a8bfb4',
  floorGrout: '#cfc6ad',
  voidDark: '#14100e',
  voidEdge: '#221a17',
  roadAsphalt: '#6b6b6f',
  roadAsphaltDark: '#5a5a5e',
  roadLine: '#f3f0e6',
  // Earthquake seam: an open gate is cracked floor, a closed one is a risen stone ledge.
  gateCrack: '#3d3427',
  gateRubble: '#b3a689',
  ledgeTop: '#988f7c',
  ledgeTopHi: '#b3a993',
  ledgeFace: '#7c7466',
  ledgeFaceDark: '#575046',
  ledgeMortar: '#ddd5c2',

  // ── Wood and counters ──
  counterTop: '#f0c878',
  counterTopHi: '#f8dea4',
  counterEdge: '#c9883f',
  counterEdgeDark: '#a2662a',
  wood: '#b57a3c',
  woodDark: '#8a5626',
  woodLight: '#d29c5e',
  boardSurface: '#efe0bb',
  boardCut: '#c6ae7f',
  deckPlank: '#c49a63',
  deckPlankAlt: '#b58a54',
  deckSeam: '#8f6837',
  rope: '#dcb87a',
  ropeDark: '#b18e4f',

  // ── Metal and appliances ──
  metal: '#9aa3a9',
  metalDark: '#6f777d',
  metalLight: '#c6ced3',
  metalEdge: '#4d5459',
  stoveBody: '#b8392c',
  stoveBodyDark: '#8c261c',
  hob: '#2b2b2f',
  hobRing: '#d8452f',
  hobGlow: '#ff8a3d',
  sinkBasin: '#aab6bc',
  sinkWater: '#8fc4d8',
  serveGlow: '#5ec44f',
  serveGlowDark: '#2c6b2a',
  serveRecess: '#23331f',
  trashBody: '#3a3f3a',
  trashLid: '#4e9b45',
  trashLidDark: '#33702e',

  // ── Ingredients ──
  onion: '#e8c274',
  onionDark: '#c69a45',
  onionFlesh: '#faf3e0',
  tomato: '#e03b2c',
  tomatoDark: '#ac2a1e',
  tomatoFlesh: '#f6a99a',
  mushroom: '#a9754b',
  mushroomDark: '#7d5433',
  mushroomFlesh: '#f0e2cc',
  stemGreen: '#4e9b45',
  stemGreenDark: '#33702e',

  // ── Burger ingredients ──
  meatRaw: '#d9544a',
  meatRawDark: '#a5342d',
  meatRawLight: '#e8817a',
  meatFat: '#f7ded2',
  meatCooked: '#8c5733',
  meatCookedDark: '#5d3720',
  meatCookedLight: '#a97046',
  meatGrill: '#3b2015',
  meatChar: '#2a2320',
  bun: '#e6b167',
  bunDark: '#bd8340',
  bunLight: '#f5d097',
  bunCrumb: '#f4e3c2',
  sesame: '#fdf3dc',
  sesameShade: '#cfae79',
  lettuce: '#7ec850',
  lettuceDark: '#4b9231',
  lettuceLight: '#b8e58b',
  lettuceRib: '#eaf7d2',

  // ── Cooked food ──
  soupOnion: '#e8c24c',
  soupTomato: '#d9382c',
  soupMushroom: '#9a6b45',
  soupBurnt: '#231f1c',

  // ── Cookware ──
  potBody: '#8a9096',
  potDark: '#5c6167',
  potLight: '#b8bec3',
  panBody: '#3f3f46',
  panDark: '#232328',
  panLight: '#5f5f69',
  panSurface: '#2b2b30',
  panHandle: '#26222a',
  panHandleLight: '#453f49',
  plateWhite: '#f7f5ef',
  plateShade: '#d9d5ca',
  plateRim: '#4a7fc1',
  plateRimDark: '#315892',
  dirtyPlate: '#a9a496',
  dirtySmear: '#8a7a5c',

  // ── Effects and hazards ──
  extinguisher: '#d8362b',
  extinguisherDark: '#991f19',
  nozzleBlack: '#2a2a2e',
  fireDeep: '#e4451f',
  fireOuter: '#ff8a1e',
  fireInner: '#ffdf5a',
  smoke: '#9a9a9a',
  smokeLight: '#c8c8c8',
  mist: '#eef6ff',

  // ── UI ──
  uiCardBg: '#f5e9ce',
  uiCardBgAlt: '#e8d9b4',
  uiCardBorder: '#8a5a2b',
  uiCardHeader: '#4e9b45',
  uiPanelBg: '#2a2438',
  uiPanelBgAlt: '#3a3350',
  uiPanelBorder: '#e8dcc0',
  textDark: '#3a2b1c',
  textLight: '#fdf7e6',
  textMuted: '#b9ac95',
  hudGold: '#f2c14b',
  hudGoldDark: '#c2921f',
  star: '#f7c948',
  starEdge: '#c2921f',
  starEmpty: '#8d8d8d',
  danger: '#e0453a',
  success: '#5ec44f',

  // ── Button prompts ──
  xboxA: '#4caf50',
  xboxB: '#e53935',
  xboxX: '#1e88e5',
  xboxY: '#fdd835',
  psFace: '#2b2b33',
  psCross: '#6f9ae8',
  psCircle: '#e2574c',
  psSquare: '#e979b8',
  psTriangle: '#5ec44f',
  keycap: '#f2efe4',
  keycapEdge: '#b9b3a2',
  keycapText: '#3a3630',
} as const;

export type PaletteName = keyof typeof PALETTE;

// ─── Helpers ────────────────────────────────────────────────────────────────

/** '#rrggbb' → 0xrrggbb, for Phaser tints, Graphics fills and camera backgrounds. */
export function hexToInt(hex: string): number {
  return parseInt(hex.slice(1), 16);
}

/** Same names as PALETTE, values as 0xRRGGBB numbers. */
export const PALETTE_INT: Record<PaletteName, number> = (() => {
  const out = {} as Record<PaletteName, number>;
  for (const name of Object.keys(PALETTE) as PaletteName[]) out[name] = hexToInt(PALETTE[name]);
  return out;
})();
