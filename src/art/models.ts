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

/** A character a chef can be: a model role (the Kenney chef rig, or a Platformer Kit creature),
 *  an optional skin texture painted over the rig's materials, the model's idle / run clip names
 *  when they are not the chef rig's, and the colour of the floor ring under it (`textColor` is
 *  a lighter tint of it for labels). */
export interface ChefSkin {
  name: string;
  model: ModelRole;
  url?: string;
  clips?: { idle: string; run: string };
  color: number;
  textColor: string;
}

const CREATURE_CLIPS = { idle: 'idle', run: 'sprint' } as const;

/** The characters, in the order the Chefs page cycles through them. Index = skin id in settings.
 *  The aprons are painted by tools/make-chef-skins.py from the Kenney skater skin; the stock
 *  Kenney characters follow, then the five Platformer Kit creatures, which have no head bone
 *  and so wear no toque. */
export const CHEF_SKINS: readonly ChefSkin[] = [
  { name: 'Blue apron', model: 'chef', url: 'models/chef/skin_chef0.png', color: 0x4a90e2, textColor: '#7fb4f0' },
  { name: 'Red apron', model: 'chef', url: 'models/chef/skin_chef1.png', color: 0xe24a4a, textColor: '#f08a80' },
  { name: 'Green apron', model: 'chef', url: 'models/chef/skin_chef2.png', color: 0x4fb35a, textColor: '#8fe07a' },
  { name: 'Yellow apron', model: 'chef', url: 'models/chef/skin_chef3.png', color: 0xf0c419, textColor: '#ffd75e' },
  { name: 'Purple apron', model: 'chef', url: 'models/chef/skin_chef4.png', color: 0x9b5fd0, textColor: '#c9a3f0' },
  { name: 'Orange apron', model: 'chef', url: 'models/chef/skin_chef5.png', color: 0xf08a2e, textColor: '#ffb070' },
  { name: 'Skater', model: 'chef', url: 'models/chef/skaterMaleA.png', color: 0xef5c48, textColor: '#ff9a88' },
  { name: 'Skater girl', model: 'chef', url: 'models/chef/skaterFemaleA.png', color: 0x4fc98a, textColor: '#8fe0b4' },
  { name: 'Suit', model: 'chef', url: 'models/chef/criminalMaleA.png', color: 0xe8e8e8, textColor: '#f6f6f6' },
  { name: 'Cyborg', model: 'chef', url: 'models/chef/cyborgFemaleA.png', color: 0x8fb3c9, textColor: '#b8d4e6' },
  { name: 'Oozi', model: 'charOozi', clips: CREATURE_CLIPS, color: 0xd9a36e, textColor: '#f0c79a' },
  { name: 'Oobi', model: 'charOobi', clips: CREATURE_CLIPS, color: 0xa88bd6, textColor: '#cdb9ea' },
  { name: 'Oodi', model: 'charOodi', clips: CREATURE_CLIPS, color: 0xe88fa8, textColor: '#f6bccb' },
  { name: 'Ooli', model: 'charOoli', clips: CREATURE_CLIPS, color: 0xe8b040, textColor: '#f5d284' },
  { name: 'Oopi', model: 'charOopi', clips: CREATURE_CLIPS, color: 0x5fbf8a, textColor: '#9ddcb8' },
];
/** The character each player is until they pick another: blue apron, then red apron. */
export const DEFAULT_CHEF_SKINS: readonly number[] = [0, 1];
/** Skin textures on the chef rig, by the order above, for callers that only need textures. */
export const CHEF_SKIN_URLS: readonly string[] = CHEF_SKINS.flatMap((skin) => (skin.url ? [skin.url] : []));
/** Stock Kenney skins for pedestrians, cycled by pedestrian id. */
export const PEDESTRIAN_SKIN_URLS: readonly string[] = [
  'models/chef/criminalMaleA.png', 'models/chef/skaterFemaleA.png', 'models/chef/cyborgFemaleA.png',
];

export function modelUrl(role: ModelRole): string {
  return MODELS[role].url;
}
