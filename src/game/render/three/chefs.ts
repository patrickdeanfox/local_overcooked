// ─── Chef rigs ──────────────────────────────────────────────────────────────
// One animated Kenney character per chef or pedestrian: a skin texture, an optional toque,
// idle/run clips cross-faded by movement, and a yaw that turns smoothly towards the facing.
// The model faces +Z at rest, so "down" (towards the camera) is yaw 0.
import * as THREE from 'three';
import type { Facing } from '../../../sim/types';
import { modelClips, modelInstance, modelSize } from './loader';

// ─── Constants ──────────────────────────────────────────────────────────────
const YAW: Readonly<Record<Facing, number>> = { down: 0, up: Math.PI, right: Math.PI / 2, left: -Math.PI / 2 };
const RIG = {
  turnSpeedRad: 16,       // yaw approach speed, radians per second
  fadeSec: 0.12,          // idle <-> run cross-fade
  runTimeScale: 1.15,
  idleTimeScale: 0.9,
  heldY: 0.48,            // held item slot, fraction of the chef's height above the feet
  heldZ: 0.28,            // and in front of the body, same unit
} as const;
// Toque sizes are fractions of the head bone's length, so the hat follows the chef's scale.
// The Kenney head is 0.87 bone lengths wide and ends 1.06 bone lengths above the bone root.
const HAT = {
  color: 0xfaf6ee,
  bandColor: 0xe8e2d6,
  bandRadius: 0.47,
  bandHeight: 0.16,
  bandLift: 1.04,         // band centre along the bone: on the crown, overlapping its rounded top
  puffRadius: 0.5,
  puffHeight: 0.5,
  puffSink: 0.3,          // fraction of the puff's lower half tucked into the band
  segments: 18,
} as const;
const CLIP = { idle: 'idle', run: 'run' } as const;

const textureCache = new Map<string, THREE.Texture>();

// ─── Helpers ────────────────────────────────────────────────────────────────

function skinTexture(url: string): THREE.Texture {
  const cached = textureCache.get(url);
  if (cached) return cached;
  const texture = new THREE.TextureLoader().load(`${import.meta.env.BASE_URL}${url}`);
  texture.flipY = false;
  texture.colorSpace = THREE.SRGBColorSpace;
  textureCache.set(url, texture);
  return texture;
}

function applySkin(root: THREE.Object3D, url: string): void {
  const texture = skinTexture(url);
  root.traverse((obj) => {
    if (!(obj instanceof THREE.Mesh)) return;
    const materials = Array.isArray(obj.material) ? obj.material : [obj.material];
    const skinned = materials.map((m) => {
      const copy = m.clone();
      if (copy instanceof THREE.MeshStandardMaterial) {
        copy.map = texture;
        copy.color.set(0xffffff);
        copy.needsUpdate = true;
      }
      return copy;
    });
    obj.material = Array.isArray(obj.material) ? skinned : skinned[0];
  });
}

/** A toque parented to the head bone, sized from the bone's length. */
function addHat(root: THREE.Object3D): void {
  const head = root.getObjectByName('Head');
  const tail = root.getObjectByName('Head_end');
  if (!head || !tail) return;
  const length = tail.position.length();
  const band = new THREE.Mesh(
    new THREE.CylinderGeometry(HAT.bandRadius * length, HAT.bandRadius * length, HAT.bandHeight * length, HAT.segments),
    new THREE.MeshStandardMaterial({ color: HAT.bandColor }),
  );
  const puff = new THREE.Mesh(
    new THREE.SphereGeometry(HAT.puffRadius * length, HAT.segments, HAT.segments / 2),
    new THREE.MeshStandardMaterial({ color: HAT.color }),
  );
  puff.scale.y = HAT.puffHeight / (HAT.puffRadius * 2);
  band.position.y = HAT.bandLift * length;
  puff.position.y = band.position.y + (HAT.bandHeight / 2 + (HAT.puffHeight / 2) * (1 - HAT.puffSink)) * length;
  band.castShadow = true;
  puff.castShadow = true;
  head.add(band, puff);
}

function shortestArc(from: number, to: number): number {
  let delta = (to - from) % (Math.PI * 2);
  if (delta > Math.PI) delta -= Math.PI * 2;
  if (delta < -Math.PI) delta += Math.PI * 2;
  return delta;
}

// ─── Rig ────────────────────────────────────────────────────────────────────
export class ChefRig {
  readonly group = new THREE.Group();     // position and yaw in tile space
  readonly heldSlot = new THREE.Group();  // where a carried item hangs
  private readonly mixer: THREE.AnimationMixer;
  private readonly idle: THREE.AnimationAction | null;
  private readonly run: THREE.AnimationAction | null;
  private moving = false;
  private targetYaw = 0;

  constructor(skinUrl: string, withHat: boolean) {
    const model = modelInstance('chef');
    applySkin(model, skinUrl);
    if (withHat) addHat(model);
    this.group.add(model);
    const height = modelSize('chef').y;
    this.heldSlot.position.set(0, RIG.heldY * height, RIG.heldZ * height);
    this.group.add(this.heldSlot);

    this.mixer = new THREE.AnimationMixer(model);
    const clips = modelClips('chef');
    const idleClip = THREE.AnimationClip.findByName(clips, CLIP.idle);
    const runClip = THREE.AnimationClip.findByName(clips, CLIP.run);
    this.idle = idleClip ? this.mixer.clipAction(idleClip) : null;
    this.run = runClip ? this.mixer.clipAction(runClip) : null;
    if (this.idle) {
      this.idle.timeScale = RIG.idleTimeScale;
      this.idle.play();
    }
    if (this.run) {
      this.run.timeScale = RIG.runTimeScale;
      this.run.play();
      this.run.setEffectiveWeight(0);
    }
  }

  setPosition(x: number, z: number): void {
    this.group.position.set(x, 0, z);
  }

  setFacing(facing: Facing): void {
    this.targetYaw = YAW[facing];
  }

  /** Faces a movement direction directly (pedestrians). */
  setHeading(dx: number, dz: number): void {
    if (dx !== 0 || dz !== 0) this.targetYaw = Math.atan2(dx, dz);
  }

  setMoving(moving: boolean): void {
    if (moving === this.moving) return;
    this.moving = moving;
    const from = moving ? this.idle : this.run;
    const to = moving ? this.run : this.idle;
    if (from && to) {
      to.enabled = true;
      to.setEffectiveWeight(1);
      to.crossFadeFrom(from, RIG.fadeSec, true);
      from.setEffectiveWeight(0);
    }
  }

  update(dtSec: number): void {
    const delta = shortestArc(this.group.rotation.y, this.targetYaw);
    const step = Math.min(1, dtSec * RIG.turnSpeedRad);
    this.group.rotation.y += delta * step;
    this.mixer.update(dtSec);
  }

  dispose(): void {
    this.mixer.stopAllAction();
    this.group.removeFromParent();
  }
}
