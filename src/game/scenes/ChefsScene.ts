// ─── Chefs scene ────────────────────────────────────────────────────────────
// The character picker: each player chooses a character, previewed live on the 3D stage with
// the same rigs and floor rings the kitchen uses. Opened from the title's Chefs row; Esc, B
// or Back return. Every change saves at once, and two players never share a character.
import Phaser from 'phaser';
import * as THREE from 'three';
import { CHEF_SKINS, type ChefSkin } from '../../art/models';
import { GAME_HEIGHT, GAME_WIDTH, MAX_PLAYERS, SCENE } from '../../config';
import { createInputManager, menuLabels } from '../../input';
import type { InputManager } from '../../input/types';
import { getAudioBus, installAudioGestureResume, installMuteToggle } from '../audioBus';
import { ChefRig } from '../render/three/chefs';
import { acquireStage, type Stage } from '../render/three/stage';
import { cycleChef, loadSettings, saveSettings, type Settings } from '../settings';
import { MenuList, type MenuItemSpec } from '../ui/MenuList';
import { KeyboardNav, MenuInput, mergeNav } from '../ui/menuInput';
import { TEXT_COLOR, textStyle } from '../ui/theme';

// ─── Constants ──────────────────────────────────────────────────────────────
const CHEFS = {
  headingY: 72,
  headingFontPx: 40,
  noteY: 118,
  noteFontPx: 16,
  menuY: 176,
  menuSpacing: 46,
  menuWidth: 560,
  menuFontPx: 22,
  hintY: GAME_HEIGHT - 56,
  hintFontPx: 15,
  maxFrameSec: 0.1,       // a stalled tab never fast-forwards the idle clip
} as const;

/** The preview: the chefs stand on a small dark floor, framed by the kitchen camera as if it
 *  were a tiny level. The box is taller than the chefs so they sit low, under the rows. */
const PREVIEW = {
  width: 3.6,             // tiles
  depth: 1.6,
  height: 2.8,
  chefGap: 1.5,           // tiles between the chefs
  chefZ: 1.0,
  floorInset: 0.15,
  floorColor: 0x2c2019,
  ringInner: 0.32,
  ringOuter: 0.44,
  ringSegments: 40,
  ringAlpha: 0.85,
  ringLift: 0.012,
} as const;

const HEADING = 'CHEFS';
const NOTE = 'Pick a character for each player. Two players never share one.';
/** The hint line in the first player's own labels (keys, or the pad's buttons). */
function hintLine(mgr: InputManager): string {
  const labels = menuLabels((action) => mgr.labelFor(0, action));
  return `${labels.choose} choose · ${labels.change} change character · ${labels.back} back · M mutes everything`;
}

// ─── Scene ──────────────────────────────────────────────────────────────────
export class ChefsScene extends Phaser.Scene {
  private inputMgr!: InputManager;
  private menuInput!: MenuInput;
  private keyboardNav!: KeyboardNav;
  private menu!: MenuList;
  private stage!: Stage;
  private settings!: Settings;
  private readonly rigs: (ChefRig | null)[] = [];
  private readonly rings: (THREE.Mesh | null)[] = [];
  private readonly disposers: (() => void)[] = [];
  private ready = false;

  constructor() { super(SCENE.CHEFS); }

  create(): void {
    this.settings = loadSettings();

    // Transparent: the preview draws on the 3D canvas behind this one; the page carries COLOR.bg.
    this.cameras.main.setBackgroundColor('rgba(0,0,0,0)');
    this.add.text(GAME_WIDTH / 2, CHEFS.headingY, HEADING, textStyle(CHEFS.headingFontPx, TEXT_COLOR.accent)).setOrigin(0.5);
    this.add.text(GAME_WIDTH / 2, CHEFS.noteY, NOTE, textStyle(CHEFS.noteFontPx, TEXT_COLOR.dim)).setOrigin(0.5);

    this.inputMgr = createInputManager(this, MAX_PLAYERS);
    this.add.text(GAME_WIDTH / 2, CHEFS.hintY, hintLine(this.inputMgr), textStyle(CHEFS.hintFontPx, TEXT_COLOR.dim)).setOrigin(0.5);
    this.menuInput = new MenuInput();
    this.keyboardNav = new KeyboardNav(this);
    this.disposers.push(installAudioGestureResume(this), installMuteToggle(this));
    getAudioBus().stopMusic();

    this.stage = acquireStage(this.game.canvas);
    this.stage.resetScene();
    this.stage.fitToGrid(PREVIEW.width, PREVIEW.depth, PREVIEW.height);
    this.buildFloor();
    for (let player = 0; player < MAX_PLAYERS; player++) this.buildChef(player);

    const items: MenuItemSpec[] = [];
    for (let player = 0; player < MAX_PLAYERS; player++) {
      items.push({
        label: () => `Player ${player + 1}: ${this.skinOf(player).name}`,
        onSelect: () => this.change(player, 1),
        onLeft: () => this.change(player, -1),
        onRight: () => this.change(player, 1),
      });
    }
    items.push({ label: () => 'Back', onSelect: () => this.back() });
    this.menu = new MenuList(this, GAME_WIDTH / 2, CHEFS.menuY, items, {
      spacing: CHEFS.menuSpacing,
      width: CHEFS.menuWidth,
      fontSize: CHEFS.menuFontPx,
    });

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.cleanup, this);
    this.ready = true;
  }

  override update(_time: number, deltaMs: number): void {
    if (!this.ready) return;
    const inputs = this.inputMgr.poll();
    const nav = mergeNav(this.menuInput.poll(inputs), this.keyboardNav.poll());
    this.menu.handle(nav);
    if (!this.ready) return; // Back was chosen from the list
    // Esc reaches menus as the pause action, so it leaves the page like the controllers screen.
    if (nav.back || inputs.some((input) => input.pausePressed === true)) {
      this.back();
      return;
    }
    const dt = Math.min(deltaMs / 1000, CHEFS.maxFrameSec);
    for (const rig of this.rigs) rig?.update(dt);
    this.stage.syncToPhaser();
    this.stage.render();
  }

  // ─── Preview ──────────────────────────────────────────────────────────────
  private skinOf(player: number): ChefSkin {
    return CHEF_SKINS[this.settings.chefs[player]] ?? CHEF_SKINS[0];
  }

  private chefX(player: number): number {
    return PREVIEW.width / 2 + (player - (MAX_PLAYERS - 1) / 2) * PREVIEW.chefGap;
  }

  private buildFloor(): void {
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(PREVIEW.width - PREVIEW.floorInset * 2, PREVIEW.depth - PREVIEW.floorInset * 2),
      new THREE.MeshStandardMaterial({ color: PREVIEW.floorColor }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(PREVIEW.width / 2, 0, PREVIEW.depth / 2);
    floor.receiveShadow = true;
    this.stage.scene.add(floor);
  }

  /** (Re)builds one player's chef and floor ring in the apron they wear now. */
  private buildChef(player: number): void {
    this.rigs[player]?.dispose();
    this.rings[player]?.removeFromParent();
    const skin = this.skinOf(player);
    const rig = new ChefRig(skin, true);
    rig.setPosition(this.chefX(player), PREVIEW.chefZ);
    rig.setFacing('down');
    this.stage.scene.add(rig.group);
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(PREVIEW.ringInner, PREVIEW.ringOuter, PREVIEW.ringSegments),
      new THREE.MeshBasicMaterial({ color: skin.color, transparent: true, opacity: PREVIEW.ringAlpha, depthWrite: false, side: THREE.DoubleSide }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(this.chefX(player), PREVIEW.ringLift, PREVIEW.chefZ);
    this.stage.scene.add(ring);
    this.rigs[player] = rig;
    this.rings[player] = ring;
  }

  private change(player: number, delta: number): void {
    this.settings.chefs = cycleChef(this.settings.chefs, player, delta);
    saveSettings(this.settings);
    this.buildChef(player);
    this.menu.refresh();
  }

  // ─── Leaving ──────────────────────────────────────────────────────────────
  private back(): void {
    getAudioBus().play('uiBack');
    this.ready = false;
    this.scene.start(SCENE.TITLE);
  }

  private cleanup(): void {
    for (const dispose of this.disposers) dispose();
    this.disposers.length = 0;
    for (const rig of this.rigs) rig?.dispose();
    this.rigs.length = 0;
    this.rings.length = 0;
    this.stage.resetScene();
    this.stage.hide();
    this.menu?.destroy();
    this.keyboardNav?.destroy();
    this.inputMgr?.destroy();
  }
}
