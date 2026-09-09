// ─── Effects ────────────────────────────────────────────────────────────────
// Fire, smoke and extinguisher spray as camera-facing sprites. The sprite images are the
// code-drawn Phaser textures (TEX.fire, TEX.smoke, TEX.spray), so the art module still owns
// the look; this file only places and animates them.
import type Phaser from 'phaser';
import * as THREE from 'three';
import { TEX } from '../../../art/keys';

// ─── Constants ──────────────────────────────────────────────────────────────
const FIRE = {
  flames: 3,
  size: 0.62,             // tiles
  spread: 0.16,           // horizontal jitter of the extra flames
  lift: 0.18,             // above the surface
  flickerHz: 9,
  flickerAmount: 0.18,
  riseAmount: 0.05,
} as const;
const SMOKE = { size: 0.45, lift: 0.75, riseSpeed: 0.35, lifeSec: 1.1, everySec: 0.28, alpha: 0.55 } as const;
const SPRAY = { size: 0.42, lifeSec: 0.26, speed: 2.6, lift: 0.45, everySec: 0.05, jitter: 0.18, alpha: 0.9 } as const;
const STEAM = { size: 0.22, lift: 0.28, riseSpeed: 0.55, lifeSec: 0.9, everySec: 0.22, alpha: 0.35, color: 0xffffff, wobble: 0.12 } as const;
/** Floor dust behind a dashing chef and around one that fell: the smoke sprite, low and short-lived. */
const DUST = { size: 0.3, lift: 0.08, riseSpeed: 0.4, lifeSec: 0.4, alpha: 0.5, spread: 0.25 } as const;
const PUFF_GROWTH = 0.6; // puffs grow by this fraction over their life

interface Puff { sprite: THREE.Sprite; age: number; velocity: THREE.Vector3; life: number; size: number; alpha: number; }
interface Flame { root: THREE.Group; sprites: THREE.Sprite[]; phases: number[]; }

// ─── Helpers ────────────────────────────────────────────────────────────────

function spriteTexture(scene: Phaser.Scene, key: string): THREE.Texture {
  const source = scene.textures.get(key).getSourceImage() as HTMLCanvasElement;
  const texture = new THREE.CanvasTexture(source);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function makeSprite(texture: THREE.Texture, size: number, opacity: number): THREE.Sprite {
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true, opacity, depthWrite: false });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(size, size, 1);
  return sprite;
}

// ─── Pool ───────────────────────────────────────────────────────────────────
export class FxPool {
  private readonly fireTexture: THREE.Texture;
  private readonly smokeTexture: THREE.Texture;
  private readonly sprayTexture: THREE.Texture;
  private readonly flames = new Map<string, Flame>();
  private readonly puffs: Puff[] = [];
  private readonly steamSources: THREE.Vector3[] = [];
  private smokeClock = 0;
  private steamClock = 0;
  private elapsed = 0;

  constructor(phaserScene: Phaser.Scene, private readonly scene: THREE.Scene) {
    this.fireTexture = spriteTexture(phaserScene, TEX.fire);
    this.smokeTexture = spriteTexture(phaserScene, TEX.smoke);
    this.sprayTexture = spriteTexture(phaserScene, TEX.spray);
  }

  /** Keeps a flame burning at each key; keys not in `active` go out. */
  syncFires(active: ReadonlyMap<string, THREE.Vector3>): void {
    for (const [key, position] of active) {
      const flame = this.flames.get(key) ?? this.makeFlame(key);
      flame.root.position.copy(position);
    }
    for (const [key, flame] of this.flames) {
      if (active.has(key)) continue;
      this.scene.remove(flame.root);
      this.flames.delete(key);
    }
  }

  /** Pots that are cooking or done give off steam until the next call replaces the list. */
  setSteamSources(positions: readonly THREE.Vector3[]): void {
    this.steamSources.length = 0;
    for (const position of positions) this.steamSources.push(position.clone());
  }

  /** One dust puff at floor level, scattered a little around `origin`. */
  spawnDust(origin: THREE.Vector3): void {
    const sprite = makeSprite(this.smokeTexture, DUST.size, DUST.alpha);
    sprite.position.copy(origin);
    sprite.position.x += (Math.random() - 0.5) * DUST.spread;
    sprite.position.z += (Math.random() - 0.5) * DUST.spread;
    sprite.position.y += DUST.lift;
    this.scene.add(sprite);
    this.puffs.push({
      sprite, age: 0, life: DUST.lifeSec, size: DUST.size, alpha: DUST.alpha,
      velocity: new THREE.Vector3((Math.random() - 0.5) * DUST.spread, DUST.riseSpeed, (Math.random() - 0.5) * DUST.spread),
    });
  }

  spawnSpray(origin: THREE.Vector3, direction: THREE.Vector3): void {
    const sprite = makeSprite(this.sprayTexture, SPRAY.size, SPRAY.alpha);
    const side = new THREE.Vector3(-direction.z, 0, direction.x).multiplyScalar((Math.random() - 0.5) * SPRAY.jitter);
    sprite.position.copy(origin).add(side);
    sprite.position.y += SPRAY.lift;
    this.scene.add(sprite);
    this.puffs.push({ sprite, age: 0, life: SPRAY.lifeSec, velocity: direction.clone().multiplyScalar(SPRAY.speed), size: SPRAY.size, alpha: SPRAY.alpha });
  }

  update(dtSec: number): void {
    this.elapsed += dtSec;
    for (const flame of this.flames.values()) {
      flame.sprites.forEach((sprite, i) => {
        const wave = Math.sin(this.elapsed * FIRE.flickerHz * Math.PI * 2 + flame.phases[i]);
        const size = FIRE.size * (1 + wave * FIRE.flickerAmount) * (i === 0 ? 1 : 0.7);
        sprite.scale.set(size, size, 1);
        sprite.position.y = FIRE.lift + size / 2 + wave * FIRE.riseAmount;
      });
    }
    this.smokeClock -= dtSec;
    if (this.smokeClock <= 0 && this.flames.size > 0) {
      this.smokeClock = SMOKE.everySec;
      for (const flame of this.flames.values()) this.spawnSmoke(flame.root.position);
    }
    this.steamClock -= dtSec;
    if (this.steamClock <= 0 && this.steamSources.length > 0) {
      this.steamClock = STEAM.everySec;
      for (const source of this.steamSources) this.spawnSteam(source);
    }
    for (let i = this.puffs.length - 1; i >= 0; i--) {
      const puff = this.puffs[i];
      puff.age += dtSec;
      if (puff.age >= puff.life) {
        this.scene.remove(puff.sprite);
        this.puffs.splice(i, 1);
        continue;
      }
      puff.sprite.position.addScaledVector(puff.velocity, dtSec);
      const t = puff.age / puff.life;
      puff.sprite.material.opacity = (1 - t) * puff.alpha;
      const size = puff.size * (1 + t * PUFF_GROWTH);
      puff.sprite.scale.set(size, size, 1);
    }
  }

  dispose(): void {
    for (const flame of this.flames.values()) this.scene.remove(flame.root);
    this.flames.clear();
    for (const puff of this.puffs) this.scene.remove(puff.sprite);
    this.puffs.length = 0;
    this.fireTexture.dispose();
    this.smokeTexture.dispose();
    this.sprayTexture.dispose();
  }

  private makeFlame(key: string): Flame {
    const root = new THREE.Group();
    const sprites: THREE.Sprite[] = [];
    const phases: number[] = [];
    for (let i = 0; i < FIRE.flames; i++) {
      const sprite = makeSprite(this.fireTexture, FIRE.size, 1);
      const angle = (i / FIRE.flames) * Math.PI * 2;
      sprite.position.set(i === 0 ? 0 : Math.cos(angle) * FIRE.spread, FIRE.lift, i === 0 ? 0 : Math.sin(angle) * FIRE.spread);
      root.add(sprite);
      sprites.push(sprite);
      phases.push(i * 2.1);
    }
    this.scene.add(root);
    const flame = { root, sprites, phases };
    this.flames.set(key, flame);
    return flame;
  }

  private spawnSteam(origin: THREE.Vector3): void {
    const sprite = makeSprite(this.smokeTexture, STEAM.size, STEAM.alpha);
    sprite.material.color.set(STEAM.color);
    sprite.position.copy(origin);
    sprite.position.y += STEAM.lift;
    sprite.position.x += (Math.random() - 0.5) * STEAM.wobble;
    this.scene.add(sprite);
    this.puffs.push({
      sprite, age: 0, life: STEAM.lifeSec, size: STEAM.size, alpha: STEAM.alpha,
      velocity: new THREE.Vector3((Math.random() - 0.5) * STEAM.wobble, STEAM.riseSpeed, 0),
    });
  }

  private spawnSmoke(origin: THREE.Vector3): void {
    const sprite = makeSprite(this.smokeTexture, SMOKE.size, SMOKE.alpha);
    sprite.position.copy(origin);
    sprite.position.y += SMOKE.lift;
    this.scene.add(sprite);
    this.puffs.push({
      sprite, age: 0, life: SMOKE.lifeSec, size: SMOKE.size, alpha: SMOKE.alpha,
      velocity: new THREE.Vector3((Math.random() - 0.5) * 0.2, SMOKE.riseSpeed, 0),
    });
  }
}
