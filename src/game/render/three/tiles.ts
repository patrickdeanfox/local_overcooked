// ─── Tiles ──────────────────────────────────────────────────────────────────
// Builds the static kitchen: a ground plane per walkable tile (textured with the art
// module's floor and road tiles) and a model group per station. Each station reports the
// height of its working surface so items and progress bars sit on top of it. Sliders and
// gates keep handles so the renderer can move them every frame.
import type Phaser from 'phaser';
import * as THREE from 'three';
import { TEX } from '../../../art/keys';
import { PALETTE } from '../../../art/palette';
import type { ModelRole } from '../../../art/models';
import type { IngredientType, SimState, Tile, TileType } from '../../../sim/types';
import { modelInstance, modelSize } from './loader';

// ─── Constants ──────────────────────────────────────────────────────────────
const GROUND = { thickness: 0.001, roadTint: 0xffffff } as const;
const BACKDROP = { margin: 30, depth: -0.02, roughness: 1 } as const; // the outside world
const CHOP = { liftRad: 0.55, hz: 7, bob: 0.05 } as const;
const UP = new THREE.Vector3(0, 1, 0);

/** Per-theme dressing. Themes come from the level JSON (`theme`); unknown themes use `default`. */
interface ThemeDressing {
  backdropColor: number;
  floorColor: number | null;      // flat floor colour instead of the checker texture
  backWall: boolean;              // KayKit wall pieces behind the top row of stations
}
const THEMES: Readonly<Record<string, ThemeDressing>> = {
  default: { backdropColor: 0x3d322b, floorColor: null, backWall: false },
  'treacle-town': { backdropColor: 0x4b3d33, floorColor: null, backWall: true },
  'savoury-seas': { backdropColor: 0x2e6b8a, floorColor: 0xc99a63, backWall: false },
};
const WALL = { span: 2, height: 2, depth: 0.25, windowEvery: 3 } as const; // tiles, at the manifest scale
/** A road that reaches the grid edge continues as asphalt into the backdrop, with parked cars up the street. */
const STREET = {
  asphalt: 0x55565c,
  lift: 0.0005,
  cars: ['carSedan', 'carTaxi', 'carVan', 'carDelivery'] as const,
  firstCar: 1.6,          // tiles beyond the top edge
  carGap: 2.3,
  carsPerRun: 2,
  laneWobble: 0.18,       // sideways offset so the cars are not perfectly aligned
} as const;
/** Wall height in tiles, for the camera fit; 0 when the theme has no wall. */
export function themeSceneHeight(theme: string | undefined): number {
  return (THEMES[theme ?? 'default'] ?? THEMES.default).backWall ? WALL.height : 0;
}
const GATE = { height: 0.22, warnEmissive: 0.6 } as const;
const CRATE = { scale: 0.8, mushrooms: 3, mushroomRing: 0.17, mushroomTilt: 0.25 } as const;
const BOARD = { knifeOffset: new THREE.Vector3(0.36, 0, 0.1), knifeYaw: 0.35 } as const;
const DRYING = { rackOffset: new THREE.Vector3(0, 0, -0.28), itemOffset: new THREE.Vector3(0, 0, 0.12) } as const;
const CRATE_ROLE: Readonly<Record<IngredientType, ModelRole | null>> = {
  tomato: 'crateTomatoes', onion: 'crateOnions', lettuce: 'crateLettuce', bun: 'crateBuns', meat: 'crateSteak', mushroom: null,
};
const GROUND_TEXTURE: Readonly<Partial<Record<TileType, string>>> = {
  floor: TEX.tile('floor'), road: TEX.tile('road'), gate: TEX.tile('gate'), slider: TEX.tile('floor'),
  counter: TEX.tile('floor'), crate: TEX.tile('floor'), board: TEX.tile('floor'), stove: TEX.tile('floor'),
  sink: TEX.tile('floor'), drying: TEX.tile('floor'), plateReturn: TEX.tile('floor'), serve: TEX.tile('floor'),
  trash: TEX.tile('floor'), plateStack: TEX.tile('floor'),
};

export interface TileView {
  root: THREE.Group;              // the station (empty for ground-only tiles); moves with sliders
  surfaceY: number;               // height items rest at, in tiles
  itemOffset: THREE.Vector3;      // where the item slot sits relative to the tile centre
  solid: boolean;
}

interface GateView { slab: THREE.Mesh; material: THREE.MeshStandardMaterial; }

// ─── Helpers ────────────────────────────────────────────────────────────────

function groundTexture(phaserScene: Phaser.Scene, key: string, cache: Map<string, THREE.Texture>): THREE.Texture {
  const cached = cache.get(key);
  if (cached) return cached;
  const source = phaserScene.textures.get(key).getSourceImage() as HTMLCanvasElement;
  const texture = new THREE.CanvasTexture(source);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.LinearFilter;
  cache.set(key, texture);
  return texture;
}

function topOf(object: THREE.Object3D): number {
  return new THREE.Box3().setFromObject(object).max.y;
}

const WALKABLE: ReadonlySet<TileType> = new Set<TileType>(['floor', 'road', 'gate']);
/** Neighbour directions in preference order: face the camera when there is a choice. */
const FRONT_CHOICES: readonly { dx: number; dy: number; yaw: number }[] = [
  { dx: 0, dy: 1, yaw: 0 },              // down (+z, towards the camera)
  { dx: 1, dy: 0, yaw: Math.PI / 2 },    // right (+x)
  { dx: -1, dy: 0, yaw: -Math.PI / 2 },  // left (-x)
  { dx: 0, dy: -1, yaw: Math.PI },       // up (-z)
];

/** Yaw that turns a station's front (its +z side) towards an adjacent walkable tile. */
function frontYaw(state: Readonly<SimState>, tile: Tile): number {
  for (const choice of FRONT_CHOICES) {
    const nx = tile.x + choice.dx;
    const ny = tile.y + choice.dy;
    if (nx < 0 || ny < 0 || nx >= state.width || ny >= state.height) continue;
    const neighbour = state.tiles[ny * state.width + nx];
    if (neighbour && WALKABLE.has(neighbour.type)) return choice.yaw;
  }
  return 0;
}

function place(model: THREE.Group, x: number, y: number, z: number): THREE.Group {
  model.position.set(x, y, z);
  return model;
}

/** Counter with something on top; the surface is the top of the topping. */
function counterWith(topping: ModelRole, offset: THREE.Vector3 = new THREE.Vector3()): { root: THREE.Group; surfaceY: number } {
  const root = new THREE.Group();
  const counter = modelInstance('counter');
  const counterTop = modelSize('counter').y;
  root.add(counter, place(modelInstance(topping), offset.x, counterTop, offset.z));
  return { root, surfaceY: topOf(root) };
}

function crateTile(ingredient: IngredientType): { root: THREE.Group; surfaceY: number } {
  const root = new THREE.Group();
  const counterTop = modelSize('counter').y;
  root.add(modelInstance('counter'));
  const role = CRATE_ROLE[ingredient];
  const crate = modelInstance(role ?? 'crate');
  crate.scale.setScalar(CRATE.scale);
  place(crate, 0, counterTop, 0);
  root.add(crate);
  if (role === null) {
    // No mushroom crate in the kit: a plain crate with a few mushrooms standing in it.
    const crateTop = counterTop + modelSize('crate').y * CRATE.scale;
    for (let i = 0; i < CRATE.mushrooms; i++) {
      const angle = (i / CRATE.mushrooms) * Math.PI * 2;
      const mushroom = modelInstance('mushroom');
      mushroom.scale.setScalar(CRATE.scale);
      mushroom.rotation.set(Math.cos(angle) * CRATE.mushroomTilt, angle, Math.sin(angle) * CRATE.mushroomTilt);
      place(mushroom, Math.cos(angle) * CRATE.mushroomRing, crateTop - 0.06, Math.sin(angle) * CRATE.mushroomRing);
      root.add(mushroom);
    }
  }
  return { root, surfaceY: topOf(root) };
}

function boardTile(): { root: THREE.Group; surfaceY: number; knife: THREE.Group } {
  const built = counterWith('cuttingBoard');
  const counterTop = modelSize('counter').y;
  const knife = modelInstance('knife');
  knife.rotation.set(-Math.PI / 2, 0, BOARD.knifeYaw);
  place(knife, BOARD.knifeOffset.x, counterTop + 0.02, BOARD.knifeOffset.z);
  built.root.add(knife);
  return { ...built, knife };
}

function backdrop(width: number, height: number, color: number): THREE.Mesh {
  const plane = new THREE.Mesh(
    new THREE.PlaneGeometry(width + BACKDROP.margin * 2, height + BACKDROP.margin * 2),
    new THREE.MeshStandardMaterial({ color, roughness: BACKDROP.roughness }),
  );
  plane.rotation.x = -Math.PI / 2;
  plane.position.set(width / 2, BACKDROP.depth, height / 2);
  plane.receiveShadow = true;
  return plane;
}

/** Contiguous column ranges of road tiles in one row: [first, last] inclusive. */
function roadRuns(state: Readonly<SimState>, row: number): [number, number][] {
  const runs: [number, number][] = [];
  for (let x = 0; x < state.width; x++) {
    const tile = state.tiles[row * state.width + x];
    if (!tile || tile.type !== 'road') continue;
    const last = runs[runs.length - 1];
    if (last && last[1] === x - 1) last[1] = x;
    else runs.push([x, x]);
  }
  return runs;
}

function asphaltStrip(run: [number, number], zFrom: number, zTo: number): THREE.Mesh {
  const width = run[1] - run[0] + 1;
  const strip = new THREE.Mesh(
    new THREE.PlaneGeometry(width, Math.abs(zTo - zFrom)),
    new THREE.MeshStandardMaterial({ color: STREET.asphalt, roughness: 1 }),
  );
  strip.rotation.x = -Math.PI / 2;
  strip.position.set(run[0] + width / 2, STREET.lift, (zFrom + zTo) / 2);
  strip.receiveShadow = true;
  return strip;
}

/** Asphalt off both ends of every edge road, and a few parked cars up the street beyond the top edge. */
function streetDressing(state: Readonly<SimState>): THREE.Group {
  const group = new THREE.Group();
  let carIndex = 0;
  for (const run of roadRuns(state, 0)) {
    group.add(asphaltStrip(run, -BACKDROP.margin, 0));
    const centre = (run[0] + run[1] + 1) / 2;
    for (let i = 0; i < STREET.carsPerRun; i++) {
      const car = modelInstance(STREET.cars[carIndex % STREET.cars.length]);
      const side = (i % 2 === 0 ? -1 : 1) * STREET.laneWobble;
      car.position.set(centre + side, 0, -(STREET.firstCar + i * STREET.carGap));
      car.rotation.y = i % 2 === 0 ? 0 : Math.PI; // one nose towards the kitchen, one away
      group.add(car);
      carIndex++;
    }
  }
  for (const run of roadRuns(state, state.height - 1)) {
    group.add(asphaltStrip(run, state.height, state.height + BACKDROP.margin));
  }
  return group;
}

const SOLID_FOR_WALL: ReadonlySet<TileType> = new Set<TileType>([
  'counter', 'crate', 'board', 'stove', 'sink', 'drying', 'plateReturn', 'serve', 'trash', 'plateStack',
]);

/** Wall pieces behind the top row, only where the tiles they cover are stations (never over a road or a gap). */
function backWall(state: Readonly<SimState>): THREE.Group {
  const group = new THREE.Group();
  const pieces = Math.ceil(state.width / WALL.span);
  const startX = (state.width - pieces * WALL.span) / 2;
  for (let i = 0; i < pieces; i++) {
    const x0 = startX + i * WALL.span;
    let covered = true;
    for (let dx = 0; dx < WALL.span; dx++) {
      const column = Math.floor(x0 + dx);
      const tile = column >= 0 && column < state.width ? state.tiles[column] : undefined;
      if (tile && !SOLID_FOR_WALL.has(tile.type)) covered = false;
    }
    if (!covered) continue;
    const piece = modelInstance(i % WALL.windowEvery === 1 ? 'wallWindow' : 'wall');
    piece.position.set(x0 + WALL.span / 2, 0, -WALL.depth / 2);
    group.add(piece);
  }
  return group;
}

function gateSlab(): GateView {
  const material = new THREE.MeshStandardMaterial({ color: new THREE.Color(PALETTE.ledgeTop), emissive: new THREE.Color(PALETTE.ledgeTopHi), emissiveIntensity: 0 });
  const slab = new THREE.Mesh(new THREE.BoxGeometry(1, GATE.height, 1), material);
  slab.position.y = GATE.height / 2;
  slab.castShadow = true;
  slab.receiveShadow = true;
  slab.visible = false;
  return { slab, material };
}

interface Station { root: THREE.Group; surfaceY: number; itemOffset: THREE.Vector3; solid: boolean; knife?: THREE.Group; }

function buildStation(tile: Tile): Station {
  const offset = new THREE.Vector3();
  switch (tile.type) {
    case 'counter': case 'plateStack': case 'plateReturn':
      return { root: modelInstance('counter'), surfaceY: modelSize('counter').y, itemOffset: offset, solid: true };
    case 'slider':
      return { root: modelInstance('counterAlt'), surfaceY: modelSize('counterAlt').y, itemOffset: offset, solid: true };
    case 'crate':
      return { ...crateTile(tile.ingredient ?? 'onion'), itemOffset: offset, solid: true };
    case 'board':
      return { ...boardTile(), itemOffset: offset, solid: true };
    case 'stove':
      return { root: modelInstance('stove'), surfaceY: modelSize('stove').y, itemOffset: offset, solid: true };
    case 'sink':
      return { root: modelInstance('sink'), surfaceY: modelSize('counter').y, itemOffset: offset, solid: true };
    case 'drying': {
      const built = counterWith('dishrack', DRYING.rackOffset);
      return { root: built.root, surfaceY: modelSize('counter').y, itemOffset: DRYING.itemOffset.clone(), solid: true };
    }
    case 'serve':
      return { root: modelInstance('serve'), surfaceY: modelSize('serve').y, itemOffset: offset, solid: true };
    case 'trash':
      return { root: modelInstance('trash'), surfaceY: modelSize('trash').y, itemOffset: offset, solid: true };
    default:
      return { root: new THREE.Group(), surfaceY: 0, itemOffset: offset, solid: false };
  }
}

// ─── Tile set ───────────────────────────────────────────────────────────────
export class TileSet {
  readonly views: TileView[] = [];
  readonly sliderIndices: number[] = [];
  readonly gateIndices: number[] = [];
  private readonly gates = new Map<number, GateView>();
  private readonly knives = new Map<number, THREE.Group>();
  private readonly root = new THREE.Group();
  private readonly textures = new Map<string, THREE.Texture>();

  constructor(phaserScene: Phaser.Scene, scene: THREE.Scene, state: Readonly<SimState>, theme?: string) {
    const dressing = THEMES[theme ?? 'default'] ?? THEMES.default;
    const groundGeometry = new THREE.PlaneGeometry(1, 1);
    this.root.add(backdrop(state.width, state.height, dressing.backdropColor));
    if (dressing.backWall) this.root.add(backWall(state));
    this.root.add(streetDressing(state));
    state.tiles.forEach((tile, index) => {
      const cx = tile.x + 0.5;
      const cz = tile.y + 0.5;
      const textureKey = GROUND_TEXTURE[tile.type];
      if (textureKey) {
        const flat = dressing.floorColor !== null && tile.type !== 'road' && tile.type !== 'gate';
        const material = flat
          ? new THREE.MeshStandardMaterial({ color: dressing.floorColor ?? 0xffffff, roughness: 0.9 })
          : new THREE.MeshStandardMaterial({ map: groundTexture(phaserScene, textureKey, this.textures), color: GROUND.roadTint });
        const ground = new THREE.Mesh(groundGeometry, material);
        ground.rotation.x = -Math.PI / 2;
        ground.position.set(cx, GROUND.thickness, cz);
        ground.receiveShadow = true;
        this.root.add(ground);
      }
      const station = buildStation(tile);
      station.root.position.set(cx, 0, cz);
      if (station.solid) {
        const yaw = frontYaw(state, tile);
        station.root.rotation.y = yaw;
        station.itemOffset.applyAxisAngle(UP, yaw);
      }
      this.root.add(station.root);
      if (station.knife) this.knives.set(index, station.knife);
      this.views.push({ root: station.root, surfaceY: station.surfaceY, itemOffset: station.itemOffset, solid: station.solid });
      if (tile.type === 'slider') this.sliderIndices.push(index);
      if (tile.type === 'gate') {
        const gate = gateSlab();
        gate.slab.position.set(cx, GATE.height / 2, cz);
        this.root.add(gate.slab);
        this.gates.set(index, gate);
        this.gateIndices.push(index);
      }
    });
    scene.add(this.root);
  }

  /** Moves a sliding counter to its current offset, in tiles. */
  setSliderOffset(index: number, offsetX: number, offsetZ: number, tile: Tile): void {
    const view = this.views[index];
    if (!view) return;
    view.root.position.set(tile.x + 0.5 + offsetX, 0, tile.y + 0.5 + offsetZ);
  }

  /** A closed gate shows its risen slab; an open one flashes before it closes. */
  setGate(index: number, closed: boolean, warnAlpha: number): void {
    const gate = this.gates.get(index);
    if (!gate) return;
    gate.slab.visible = closed || warnAlpha > 0;
    gate.slab.position.y = closed ? GATE.height / 2 : -GATE.height / 2 + GATE.height * warnAlpha * 0.35;
    gate.material.emissiveIntensity = closed ? 0 : warnAlpha * GATE.warnEmissive;
    this.views[index].surfaceY = closed ? GATE.height : 0;
  }

  /** Knives on the boards in `chopping` rise and fall; every other knife lies flat. */
  animateKnives(chopping: ReadonlySet<number>, elapsed: number): void {
    for (const [index, knife] of this.knives) {
      const active = chopping.has(index);
      const wave = active ? 0.5 + 0.5 * Math.sin(elapsed * CHOP.hz * Math.PI * 2) : 0;
      knife.rotation.x = -Math.PI / 2 + wave * CHOP.liftRad;
      knife.position.y = modelSize('counter').y + 0.02 + wave * CHOP.bob;
    }
  }

  dispose(): void {
    this.root.removeFromParent();
    for (const texture of this.textures.values()) texture.dispose();
    this.textures.clear();
  }
}
