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
const UP = new THREE.Vector3(0, 1, 0);
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

function boardTile(): { root: THREE.Group; surfaceY: number } {
  const built = counterWith('cuttingBoard');
  const counterTop = modelSize('counter').y;
  const knife = modelInstance('knife');
  knife.rotation.set(-Math.PI / 2, 0, BOARD.knifeYaw);
  place(knife, BOARD.knifeOffset.x, counterTop + 0.02, BOARD.knifeOffset.z);
  built.root.add(knife);
  return built;
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

function buildStation(tile: Tile): { root: THREE.Group; surfaceY: number; itemOffset: THREE.Vector3; solid: boolean } {
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
  private readonly root = new THREE.Group();
  private readonly textures = new Map<string, THREE.Texture>();

  constructor(phaserScene: Phaser.Scene, scene: THREE.Scene, state: Readonly<SimState>) {
    const groundGeometry = new THREE.PlaneGeometry(1, 1);
    state.tiles.forEach((tile, index) => {
      const cx = tile.x + 0.5;
      const cz = tile.y + 0.5;
      const textureKey = GROUND_TEXTURE[tile.type];
      if (textureKey) {
        const material = new THREE.MeshStandardMaterial({ map: groundTexture(phaserScene, textureKey, this.textures), color: GROUND.roadTint });
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

  dispose(): void {
    this.root.removeFromParent();
    for (const texture of this.textures.values()) texture.dispose();
    this.textures.clear();
  }
}
