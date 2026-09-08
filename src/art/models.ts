// ─── 3D model contract ──────────────────────────────────────────────────────
// Which glTF file plays which role in the 3D kitchen. `src/art/models.json` is the single
// source of truth: presentation loads `url` (relative to the site root), and
// `tools/sync-models.mjs` copies `src` (relative to assets/) plus its buffers and textures
// into public/. Add roles freely; never rename one without updating every consumer.
//
// Normalisation, applied once after loading, in this order:
//   scale   uniform multiplier (KayKit models are 2 units per tile, so 0.5)
//   fit     scale so the larger of the X/Z footprint equals this many tiles
//   height  scale so the model is this many tiles tall
// then the model is centred on X/Z and its lowest point is moved to y = 0.
import manifest from './models.json';

export interface ModelSpec {
  src?: string;
  url: string;
  scale?: number;
  fit?: number;
  height?: number;
}

export type ModelRole = keyof typeof manifest;
export const MODELS: Readonly<Record<ModelRole, ModelSpec>> = manifest;
export const MODEL_ROLES = Object.keys(manifest) as ModelRole[];

/** Chef skins painted by tools/make-chef-skins.py; index = chef index. */
export const CHEF_SKIN_URLS: readonly string[] = ['models/chef/skin_chef0.png', 'models/chef/skin_chef1.png'];
/** Stock Kenney skins for pedestrians, cycled by pedestrian id. */
export const PEDESTRIAN_SKIN_URLS: readonly string[] = [
  'models/chef/criminalMaleA.png', 'models/chef/skaterFemaleA.png', 'models/chef/cyborgFemaleA.png',
];

export function modelUrl(role: ModelRole): string {
  return MODELS[role].url;
}
