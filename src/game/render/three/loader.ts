// ─── Model loader ───────────────────────────────────────────────────────────
// Loads every role in src/art/models.json once, normalises each model to tile units (see
// the manifest for the rules) and hands out instances. A model that fails to load becomes
// a plain box so the kitchen still renders and the error is visible in the log.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';
import { MODELS, MODEL_ROLES, type ModelRole, type ModelSpec } from '../../../art/models';
import { log } from '../../../log';

// ─── Constants ──────────────────────────────────────────────────────────────
const PLACEHOLDER = { size: 0.7, height: 0.5, color: 0xd04a9a } as const;

interface LoadedModel {
  root: THREE.Group;              // normalised: centred on X/Z, feet at y = 0
  clips: THREE.AnimationClip[];
  size: THREE.Vector3;            // bounding size in tiles after normalisation
  factor: number;                 // uniform scale applied to the file's units
  skinned: boolean;
}

const cache = new Map<ModelRole, LoadedModel>();
let loading: Promise<void> | null = null;

// ─── Helpers ────────────────────────────────────────────────────────────────

function assetUrl(url: string): string {
  return `${import.meta.env.BASE_URL}${url}`;
}

function scaleFactor(spec: ModelSpec, rawSize: THREE.Vector3): number {
  let factor = spec.scale ?? 1;
  if (spec.fit !== undefined) factor *= spec.fit / Math.max(rawSize.x, rawSize.z, 1e-6);
  if (spec.height !== undefined) factor *= spec.height / Math.max(rawSize.y, 1e-6);
  return factor;
}

/** Wraps the file's scene so the result is scaled, centred on X/Z and resting on y = 0. */
function normalise(scene: THREE.Group, spec: ModelSpec): { root: THREE.Group; size: THREE.Vector3; factor: number } {
  const raw = new THREE.Box3().setFromObject(scene);
  const rawSize = raw.getSize(new THREE.Vector3());
  const factor = scaleFactor(spec, rawSize);
  const centre = raw.getCenter(new THREE.Vector3());
  scene.scale.setScalar(factor);
  scene.position.set(-centre.x * factor, -raw.min.y * factor, -centre.z * factor);
  const root = new THREE.Group();
  root.add(scene);
  const size = new THREE.Box3().setFromObject(root).getSize(new THREE.Vector3());
  return { root, size, factor };
}

function prepareMeshes(root: THREE.Object3D): boolean {
  let skinned = false;
  root.traverse((obj) => {
    if (obj instanceof THREE.Mesh) {
      obj.castShadow = true;
      obj.receiveShadow = true;
      if (obj instanceof THREE.SkinnedMesh) {
        skinned = true;
        obj.frustumCulled = false; // the bind-pose bounds do not follow the animation
      }
    }
  });
  return skinned;
}

function placeholder(): LoadedModel {
  const geometry = new THREE.BoxGeometry(PLACEHOLDER.size, PLACEHOLDER.height, PLACEHOLDER.size);
  const material = new THREE.MeshStandardMaterial({ color: PLACEHOLDER.color });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.y = PLACEHOLDER.height / 2;
  mesh.castShadow = true;
  const root = new THREE.Group();
  root.add(mesh);
  return { root, clips: [], size: new THREE.Vector3(PLACEHOLDER.size, PLACEHOLDER.height, PLACEHOLDER.size), factor: 1, skinned: false };
}

async function load(loader: GLTFLoader, role: ModelRole): Promise<void> {
  const spec = MODELS[role];
  try {
    const gltf = await loader.loadAsync(assetUrl(spec.url));
    const skinned = prepareMeshes(gltf.scene);
    const { root, size, factor } = normalise(gltf.scene, spec);
    cache.set(role, { root, clips: gltf.animations, size, factor, skinned });
  } catch (err) {
    log.error(`models: failed to load ${role} from ${spec.url}`, err);
    cache.set(role, placeholder());
  }
}

// ─── Public API ─────────────────────────────────────────────────────────────

/** Loads every model in the manifest; safe to call more than once. */
export function loadAllModels(): Promise<void> {
  if (!loading) {
    const loader = new GLTFLoader();
    const started = performance.now();
    loading = Promise.all(MODEL_ROLES.map((role) => load(loader, role))).then(() => {
      log.info(`models: ${cache.size} loaded in ${Math.round(performance.now() - started)} ms`);
    });
  }
  return loading;
}

export function modelsReady(): boolean {
  return cache.size === MODEL_ROLES.length;
}

function record(role: ModelRole): LoadedModel {
  const found = cache.get(role);
  if (found) return found;
  log.warn(`models: ${role} requested before loading; using a placeholder`);
  const fallback = placeholder();
  cache.set(role, fallback);
  return fallback;
}

/** A fresh instance of the normalised model. Geometry and materials are shared. */
export function modelInstance(role: ModelRole): THREE.Group {
  const entry = record(role);
  return (entry.skinned ? cloneSkinned(entry.root) : entry.root.clone(true)) as THREE.Group;
}

export function modelClips(role: ModelRole): THREE.AnimationClip[] {
  return record(role).clips;
}

/** Bounding size of the normalised model, in tiles. */
export function modelSize(role: ModelRole): THREE.Vector3 {
  return record(role).size.clone();
}

/** Scale applied to the file's units, for placing things in a rig's bone space. */
export function modelScaleFactor(role: ModelRole): number {
  return record(role).factor;
}

/** Gives the object its own materials, multiplied by a colour (burnt food, dirty plates). */
export function tintObject(root: THREE.Object3D, color: THREE.ColorRepresentation): void {
  const tint = new THREE.Color(color);
  root.traverse((obj) => {
    if (!(obj instanceof THREE.Mesh)) return;
    const materials = Array.isArray(obj.material) ? obj.material : [obj.material];
    const tinted = materials.map((m) => {
      const copy = m.clone();
      if (copy instanceof THREE.MeshStandardMaterial) copy.color.multiply(tint);
      return copy;
    });
    obj.material = Array.isArray(obj.material) ? tinted : tinted[0];
  });
}
