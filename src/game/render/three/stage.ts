// ─── Stage ──────────────────────────────────────────────────────────────────
// The WebGL canvas that sits behind Phaser's transparent canvas, with the Overcooked
// camera (a perspective camera looking down at the kitchen from the front) and the lights.
// One stage is created per page and reused across levels; each level gets a new scene.
import * as THREE from 'three';
import { GAME_HEIGHT, GAME_WIDTH } from '../../../config';
import { log } from '../../../log';

// ─── Constants ──────────────────────────────────────────────────────────────
const CAMERA = {
  fovDeg: 30,
  pitchDeg: 54,          // angle below horizontal
  near: 0.5,
  far: 80,
  marginNdc: 0.05,       // breathing room inside the usable band
  hudTopPx: 140,         // order cards (matches LAYOUT in the renderer)
  hudBottomPx: 78,       // score / timer row
  kitchenHeight: 1.25,   // tiles: counters, held items and hats all fit under this
  fitIterations: 18,
} as const;

const LIGHT = {
  sky: 0xfff3df,
  ground: 0x6b5140,
  hemisphere: 1.0,
  sun: 0xfff0d8,
  sunIntensity: 2.4,
  sunDirection: [-0.55, 1.0, 0.65] as const, // from the front-left, high
  sunDistance: 14,
  shadowMapPx: 2048,
  shadowBias: -0.00035,
  shadowNormalBias: 0.02,
  ambient: 0x8a7a70,
  ambientIntensity: 0.35,
} as const;

const MAX_PIXEL_RATIO = 2;

// ─── Stage ──────────────────────────────────────────────────────────────────
export class Stage {
  readonly canvas: HTMLCanvasElement;
  readonly renderer: THREE.WebGLRenderer;
  readonly scene: THREE.Scene;
  readonly camera: THREE.PerspectiveCamera;
  private readonly sun: THREE.DirectionalLight;
  private readonly hemisphere: THREE.HemisphereLight;
  private readonly ambient: THREE.AmbientLight;
  private readonly target = new THREE.Vector3();
  private cssWidth = 0;
  private cssHeight = 0;

  constructor(private readonly host: HTMLElement, private readonly phaserCanvas: HTMLCanvasElement) {
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'kitchen3d';
    Object.assign(this.canvas.style, { position: 'absolute', left: '0', top: '0', zIndex: '0', pointerEvents: 'none' });
    Object.assign(phaserCanvas.style, { position: 'relative', zIndex: '1' });
    if (getComputedStyle(host).position === 'static') host.style.position = 'relative';
    host.insertBefore(this.canvas, phaserCanvas);

    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO));
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(CAMERA.fovDeg, GAME_WIDTH / GAME_HEIGHT, CAMERA.near, CAMERA.far);

    this.hemisphere = new THREE.HemisphereLight(LIGHT.sky, LIGHT.ground, LIGHT.hemisphere);
    this.ambient = new THREE.AmbientLight(LIGHT.ambient, LIGHT.ambientIntensity);
    this.sun = new THREE.DirectionalLight(LIGHT.sun, LIGHT.sunIntensity);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(LIGHT.shadowMapPx, LIGHT.shadowMapPx);
    this.sun.shadow.bias = LIGHT.shadowBias;
    this.sun.shadow.normalBias = LIGHT.shadowNormalBias;
    this.scene.add(this.hemisphere, this.ambient, this.sun, this.sun.target);
    log.info('stage: WebGL renderer created');
  }

  /** Clears the level's objects, keeping the lights. */
  resetScene(): void {
    for (const child of [...this.scene.children]) {
      if (child === this.hemisphere || child === this.ambient || child === this.sun || child === this.sun.target) continue;
      this.scene.remove(child);
    }
  }

  show(): void { this.canvas.style.display = ''; }
  hide(): void { this.canvas.style.display = 'none'; }

  /** Places the camera so a `width` x `height` tile kitchen fills the band between the HUDs. */
  fitToGrid(width: number, height: number): void {
    const box = new THREE.Box3(new THREE.Vector3(0, 0, 0), new THREE.Vector3(width, CAMERA.kitchenHeight, height));
    this.target.copy(box.getCenter(new THREE.Vector3()));
    const pitch = THREE.MathUtils.degToRad(CAMERA.pitchDeg);
    const direction = new THREE.Vector3(0, Math.sin(pitch), Math.cos(pitch)); // from the target towards the camera
    const band = this.usableBand();

    let distance = Math.max(width, height) * 2;
    for (let i = 0; i < CAMERA.fitIterations; i++) {
      this.camera.position.copy(this.target).addScaledVector(direction, distance);
      this.camera.lookAt(this.target);
      this.camera.updateMatrixWorld();
      const bounds = this.projectedBounds(box);
      // Pan so the kitchen is centred in the band, then scale the distance by the overshoot.
      const panX = (bounds.min.x + bounds.max.x) / 2 - (band.minX + band.maxX) / 2;
      const panY = (bounds.min.y + bounds.max.y) / 2 - (band.minY + band.maxY) / 2;
      const halfHeight = distance * Math.tan(THREE.MathUtils.degToRad(CAMERA.fovDeg) / 2);
      const right = new THREE.Vector3().setFromMatrixColumn(this.camera.matrixWorld, 0);
      const up = new THREE.Vector3().setFromMatrixColumn(this.camera.matrixWorld, 1);
      this.target.addScaledVector(right, panX * halfHeight * this.camera.aspect).addScaledVector(up, panY * halfHeight);
      const overshoot = Math.max(
        (bounds.max.x - bounds.min.x) / (band.maxX - band.minX),
        (bounds.max.y - bounds.min.y) / (band.maxY - band.minY),
      );
      distance *= Math.sqrt(overshoot); // damped so the pan and zoom settle together
    }
    this.camera.position.copy(this.target).addScaledVector(direction, distance);
    this.camera.lookAt(this.target);
    this.camera.updateMatrixWorld();
    this.placeSun(box);
  }

  /** Copies Phaser's canvas placement so both canvases overlap exactly. */
  syncToPhaser(): void {
    const rect = this.phaserCanvas.getBoundingClientRect();
    const hostRect = this.host.getBoundingClientRect();
    const left = rect.left - hostRect.left;
    const top = rect.top - hostRect.top;
    this.canvas.style.left = `${left}px`;
    this.canvas.style.top = `${top}px`;
    if (rect.width !== this.cssWidth || rect.height !== this.cssHeight) {
      this.cssWidth = rect.width;
      this.cssHeight = rect.height;
      this.renderer.setSize(Math.max(1, Math.round(rect.width)), Math.max(1, Math.round(rect.height)), false);
      this.canvas.style.width = `${rect.width}px`;
      this.canvas.style.height = `${rect.height}px`;
    }
  }

  /** Screen position, in Phaser's logical pixels, of a world point. */
  project(x: number, y: number, z: number, out: { x: number; y: number }): { x: number; y: number } {
    const v = new THREE.Vector3(x, y, z).project(this.camera);
    out.x = ((v.x + 1) / 2) * GAME_WIDTH;
    out.y = ((1 - v.y) / 2) * GAME_HEIGHT;
    return out;
  }

  render(): void {
    this.renderer.render(this.scene, this.camera);
  }

  dispose(): void {
    this.renderer.dispose();
    this.canvas.remove();
  }

  // ─── Camera fit helpers ───────────────────────────────────────────────────
  private usableBand(): { minX: number; maxX: number; minY: number; maxY: number } {
    const m = CAMERA.marginNdc;
    return {
      minX: -1 + m,
      maxX: 1 - m,
      minY: -1 + (2 * CAMERA.hudBottomPx) / GAME_HEIGHT + m,
      maxY: 1 - (2 * CAMERA.hudTopPx) / GAME_HEIGHT - m,
    };
  }

  private projectedBounds(box: THREE.Box3): THREE.Box2 {
    const bounds = new THREE.Box2();
    const corner = new THREE.Vector3();
    for (let i = 0; i < 8; i++) {
      corner.set(i & 1 ? box.max.x : box.min.x, i & 2 ? box.max.y : box.min.y, i & 4 ? box.max.z : box.min.z);
      corner.project(this.camera);
      bounds.expandByPoint(new THREE.Vector2(corner.x, corner.y));
    }
    return bounds;
  }

  private placeSun(box: THREE.Box3): void {
    const centre = box.getCenter(new THREE.Vector3());
    const direction = new THREE.Vector3(...LIGHT.sunDirection).normalize();
    this.sun.position.copy(centre).addScaledVector(direction, LIGHT.sunDistance);
    this.sun.target.position.copy(centre);
    const radius = Math.max(box.max.x - box.min.x, box.max.z - box.min.z) * 0.8;
    const shadow = this.sun.shadow.camera;
    shadow.left = -radius;
    shadow.right = radius;
    shadow.top = radius;
    shadow.bottom = -radius;
    shadow.near = 1;
    shadow.far = LIGHT.sunDistance * 2.5;
    shadow.updateProjectionMatrix();
  }
}

// ─── Singleton ──────────────────────────────────────────────────────────────
let stage: Stage | null = null;

/** The page's stage, created on first use behind Phaser's canvas. */
export function acquireStage(phaserCanvas: HTMLCanvasElement): Stage {
  if (!stage) {
    const host = phaserCanvas.parentElement ?? document.body;
    stage = new Stage(host, phaserCanvas);
  }
  stage.show();
  return stage;
}
