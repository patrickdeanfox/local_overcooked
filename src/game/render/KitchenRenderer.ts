// ─── Kitchen renderer ───────────────────────────────────────────────────────
// Draws a SimState snapshot as a 3D kitchen on the Three.js stage behind Phaser's
// transparent canvas, plus a thin Phaser overlay for the things that read best flat:
// progress bars, stack badges and the debug grid. Owns no game logic and never mutates
// the state it is given. Views are pooled by tile index / entity id, so a frame only
// updates positions and swaps a view when an item's look changes.
//
// World space: one tile is one unit, x runs right, z runs down the screen (tile y), y is up.
import Phaser from 'phaser';
import * as THREE from 'three';
import { TEX } from '../../art/keys';
import { CHEF_SKINS, PEDESTRIAN_SKIN_URLS, type ChefSkin } from '../../art/models';
import { TRAY_WOBBLE_SEC } from '../../sim/constants';
import { FACING_VECTORS, type Chef, type GateGroup, type Item, type SimState, type Tile } from '../../sim/types';
import { COLOR } from '../ui/theme';
import { ChefRig } from './three/chefs';
import { FxPool } from './three/fx';
import { buildItemView, itemSignature } from './three/items';
import { modelInstance } from './three/loader';
import { acquireStage, type Framing, type Stage } from './three/stage';
import { DEFAULT_TILE_FLAGS, TileSet, themeSceneHeight, type TileFlags } from './three/tiles';

// ─── Constants ──────────────────────────────────────────────────────────────
const HELD = { scale: 0.9 } as const;

const HIGHLIGHT = { inner: 0.3, outer: 0.42, segments: 40, alpha: 0.85, lift: 0.012 } as const;

const GATE_DRAW = { warnSec: 1.5, flashSpeedRad: 10, warnMaxAlpha: 0.9 } as const;

const BAR = {
  widthPx: 46,
  heightPx: 8,
  aboveSurface: 0.55,      // tiles above the working surface
  borderPx: 2,
  trackAlpha: 0.85,
  flashSpeedRad: 9,
  flashMinAlpha: 0.35,
} as const;

const WARN_ICON = { widthPx: 16, heightPx: 14, aboveBarPx: 10 } as const;

const BADGE = { lift: 0.42, fontPx: 13 } as const;

const SPRAY_FX = { intervalSec: 0.05, distance: 0.38 } as const;

const PEDESTRIAN = { moveEpsilon: 1e-4 } as const;

/** A thrown item arcs from hand height and comes down over its range. */
const FLIGHT = { lift: 0.45, arcHeight: 0.55, scale: 0.9 } as const;
const DASH_FX = { everySec: 0.05, behind: 0.2 } as const;
const FALL_FX = { puffs: 5 } as const;

// Mechanics spec (docs/MECHANICS.md)
const CHALK = { lift: 1.0, alpha: 0.95 } as const;                 // the "86" mark hung above an empty crate
const STOCK = { halfFraction: 0.5, lowFraction: 0.25 } as const;   // fill level colour steps on a crate's bar
const ASSIST_BADGE = { gapPx: 8, fontPx: 12, label: 'x2', lingerSec: 0.6 } as const; // the sim clears `assisting` the step the hands leave, so the badge fades out over lingerSec
const WOBBLE = { hz: 14, rad: 0.16 } as const;                     // held tray shake after a bump
const DELIVERY_CRATE = { scale: 0.7 } as const;

const BADGE_STYLE: Phaser.Types.GameObjects.Text.TextStyle = {
  fontFamily: 'monospace',
  fontSize: `${BADGE.fontPx}px`,
  color: '#ffffff',
  backgroundColor: '#00000099',
  padding: { x: 3, y: 1 },
};

export type { TileFlags } from './three/tiles';
export interface TilePos { x: number; y: number; }

interface ItemView { signature: string; view: THREE.Group; }

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Stack size drawn as a badge, or 1 when the item is not a stack. */
function itemCount(item: Item): number {
  if (item.kind === 'dirtyPlate') return item.count;
  if (item.kind === 'plate') return item.count ?? 1;
  return 1;
}

function fireKey(x: number, y: number): string {
  return `${x},${y}`;
}

// ─── Renderer ───────────────────────────────────────────────────────────────
export class KitchenRenderer {
  /** Phaser overlay in screen pixels; the debug overlay adds its grid here. */
  readonly container: Phaser.GameObjects.Container;

  private readonly stage: Stage;
  private readonly barsGfx: Phaser.GameObjects.Graphics;
  private readonly badges = new Map<number, Phaser.GameObjects.Text>();
  private readonly fx: FxPool;
  private tiles: TileSet | null = null;

  private readonly tileItems = new Map<number, ItemView>();
  private readonly chefs = new Map<number, ChefRig>();
  private readonly held = new Map<number, ItemView>();
  private readonly flying = new Map<number, ItemView>();
  private readonly dashDustTimer: number[] = [];
  private readonly wasFalling: boolean[] = [];
  private readonly pedestrians = new Map<number, ChefRig>();
  private readonly highlights: THREE.Mesh[] = [];
  private readonly firePositions = new Map<string, THREE.Vector3>();
  private readonly choppingBoards = new Set<number>();
  private readonly steamPositions: THREE.Vector3[] = [];
  private readonly sprayTimer: number[] = [];
  private readonly sliderOffsets = new Map<string, { x: number; y: number }>();
  private readonly screen = { x: 0, y: 0 };
  // Mechanics spec: chalk marks by crate tile, one assist badge per chef, the crate waiting at the door.
  private readonly chalks = new Map<number, Phaser.GameObjects.Image>();
  private readonly assistBadges: Phaser.GameObjects.Text[] = [];
  private readonly assistLinger: number[] = []; // seconds of badge left per chef, and the tile it sits on
  private readonly assistTile: number[] = [];
  private deliveryView: THREE.Group | null = null;
  private deliveryIndex = -1;
  private gridW = 0;
  private gridH = 0;
  private elapsed = 0;

  /** `skins` is the apron (CHEF_SKINS index) each chef wears, by chef index; missing entries fall
   *  back to the default order. `flags` are the run's mechanics the static kitchen depends on.
   *  `framing` frames the kitchen somewhere other than the HUD band (a menu diorama). */
  constructor(
    private readonly scene: Phaser.Scene,
    state: Readonly<SimState>,
    private readonly theme?: string,
    private readonly skins: readonly number[] = [],
    private readonly flags: Readonly<TileFlags> = DEFAULT_TILE_FLAGS,
    private readonly framing: Readonly<Framing> = {},
  ) {
    this.stage = acquireStage(scene.game.canvas);
    this.stage.resetScene();
    this.container = scene.add.container(0, 0);
    this.barsGfx = scene.add.graphics();
    this.container.add(this.barsGfx);
    this.fx = new FxPool(scene, this.stage.scene);
    this.buildGrid(state);
  }

  /** The overlay is in screen pixels, so no scale applies. */
  get scaleValue(): number { return 1; }

  /** Grid size the kitchen was built for, in tiles. */
  get gridSize(): { width: number; height: number } { return { width: this.gridW, height: this.gridH }; }

  /** Turns the camera about the kitchen by `yawOffsetRad` from where the fit left it; draw() renders it. */
  orbit(yawOffsetRad: number): void {
    this.stage.orbit(yawOffsetRad);
  }

  /** Screen position of a tile coordinate, `lift` world units above the floor. */
  tileToScreen(tx: number, ty: number, lift = 0): TilePos {
    return this.stage.project(tx, lift, ty, { x: 0, y: 0 });
  }

  draw(state: Readonly<SimState>, targets: readonly (TilePos | null)[], dtSec: number): void {
    if (state.width !== this.gridW || state.height !== this.gridH) this.buildGrid(state);
    this.elapsed += dtSec;
    this.readSliderOffsets(state);
    this.drawSliders(state);
    this.drawGates(state);
    this.drawTileItems(state);
    this.drawDelivery(state);
    this.drawFlying(state);
    this.drawHighlights(state, targets);
    this.drawChopping(state, targets);
    this.drawChefs(state, dtSec);
    this.drawDashDust(state, dtSec);
    this.drawPedestrians(state, dtSec);
    this.drawFires(state);
    this.drawSteam(state);
    this.drawSpray(state, dtSec);
    this.fx.update(dtSec);
    this.stage.syncToPhaser();
    this.stage.render();
    this.drawBars(state, targets, dtSec);
    this.drawBadges(state);
    this.drawChalk(state);
  }

  destroy(): void {
    this.fx.dispose();
    this.tiles?.dispose();
    this.tiles = null;
    for (const view of this.tileItems.values()) view.view.removeFromParent();
    this.tileItems.clear();
    for (const rig of this.chefs.values()) rig.dispose();
    this.chefs.clear();
    this.held.clear();
    for (const view of this.flying.values()) view.view.removeFromParent();
    this.flying.clear();
    for (const rig of this.pedestrians.values()) rig.dispose();
    this.pedestrians.clear();
    for (const ring of this.highlights) ring.removeFromParent();
    this.highlights.length = 0;
    for (const badge of this.badges.values()) badge.destroy();
    this.badges.clear();
    for (const chalk of this.chalks.values()) chalk.destroy();
    this.chalks.clear();
    for (const badge of this.assistBadges) badge.destroy();
    this.assistBadges.length = 0;
    this.deliveryView?.removeFromParent();
    this.deliveryView = null;
    this.container.destroy(true);
    this.stage.resetScene();
    this.stage.hide();
  }

  // ─── Layout ───────────────────────────────────────────────────────────────
  private buildGrid(state: Readonly<SimState>): void {
    this.tiles?.dispose();
    for (const view of this.tileItems.values()) view.view.removeFromParent();
    this.tileItems.clear();
    for (const badge of this.badges.values()) badge.destroy();
    this.badges.clear();
    for (const chalk of this.chalks.values()) chalk.destroy();
    this.chalks.clear();
    this.deliveryView?.removeFromParent();
    this.deliveryView = null;
    this.deliveryIndex = state.tiles.findIndex((tile) => tile.type === 'delivery');
    this.gridW = state.width;
    this.gridH = state.height;
    this.tiles = new TileSet(this.scene, this.stage.scene, state, this.theme, this.flags);
    this.stage.fitToGrid(state.width, state.height, themeSceneHeight(this.theme), this.framing);
  }

  private readSliderOffsets(state: Readonly<SimState>): void {
    this.sliderOffsets.clear();
    for (const group of state.sliders) this.sliderOffsets.set(group.id, { x: group.offsetX, y: group.offsetY });
  }

  private offsetFor(tile: Tile): { x: number; y: number } {
    if (tile.type !== 'slider' || !tile.group) return { x: 0, y: 0 };
    return this.sliderOffsets.get(tile.group) ?? { x: 0, y: 0 };
  }

  /** World position of the item slot on a tile, following sliders. */
  private slotPosition(state: Readonly<SimState>, index: number, out: THREE.Vector3): THREE.Vector3 {
    const tile = state.tiles[index];
    const view = this.tiles?.views[index];
    const off = this.offsetFor(tile);
    const itemOffset = view?.itemOffset;
    out.set(
      tile.x + 0.5 + off.x + (itemOffset?.x ?? 0),
      view?.surfaceY ?? 0,
      tile.y + 0.5 + off.y + (itemOffset?.z ?? 0),
    );
    return out;
  }

  // ─── Layers ───────────────────────────────────────────────────────────────
  private drawSliders(state: Readonly<SimState>): void {
    if (!this.tiles) return;
    for (const index of this.tiles.sliderIndices) {
      const tile = state.tiles[index];
      if (!tile) continue;
      const off = this.offsetFor(tile);
      this.tiles.setSliderOffset(index, off.x, off.y, tile);
    }
  }

  /** Gate seams: a closed group shows its risen slab, and flashes before it shuts. */
  private drawGates(state: Readonly<SimState>): void {
    if (!this.tiles || this.tiles.gateIndices.length === 0) return;
    const flash = 0.5 + 0.5 * Math.sin(this.elapsed * GATE_DRAW.flashSpeedRad);
    for (const index of this.tiles.gateIndices) {
      const tile = state.tiles[index];
      if (!tile) continue;
      const group = this.gateGroup(state, tile.group);
      const closed = group ? !group.open : false;
      const warning = !closed && group !== null && group.secondsToChange <= GATE_DRAW.warnSec;
      this.tiles.setGate(index, closed, warning ? flash * GATE_DRAW.warnMaxAlpha : 0);
    }
  }

  /** A level without the gate dynamic reports no groups; its seams stay open. */
  private gateGroup(state: Readonly<SimState>, id: string | undefined): GateGroup | null {
    if (!state.gates || !id) return null;
    for (const group of state.gates) if (group.id === id) return group;
    return null;
  }

  private drawTileItems(state: Readonly<SimState>): void {
    const position = new THREE.Vector3();
    for (let i = 0; i < state.tileItems.length; i++) {
      const item = state.tileItems[i];
      const current = this.tileItems.get(i);
      if (!item) {
        if (current) current.view.visible = false;
        continue;
      }
      const view = this.viewFor(current, item, (built) => {
        this.stage.scene.add(built);
        this.tileItems.set(i, { signature: itemSignature(item), view: built });
      });
      view.position.copy(this.slotPosition(state, i, position));
      view.visible = true;
    }
  }

  /** The delivery crate sits at the door while a restock has arrived and waits to be unloaded. */
  private drawDelivery(state: Readonly<SimState>): void {
    if (this.deliveryIndex < 0) return;
    const waiting = (state.restocks ?? []).some((restock) => restock.arrivesIn <= 0);
    if (!waiting) {
      if (this.deliveryView) this.deliveryView.visible = false;
      return;
    }
    if (!this.deliveryView) {
      this.deliveryView = modelInstance('deliveryCrate');
      this.deliveryView.scale.setScalar(DELIVERY_CRATE.scale);
      this.stage.scene.add(this.deliveryView);
    }
    this.deliveryView.position.copy(this.slotPosition(state, this.deliveryIndex, new THREE.Vector3()));
    this.deliveryView.visible = true;
  }

  /** Thrown items, pooled by flight id: an arc from hand height back down over the range. */
  private drawFlying(state: Readonly<SimState>): void {
    const live = state.flying ?? [];
    for (const flight of live) {
      const view = this.viewFor(this.flying.get(flight.id), flight.item, (built) => {
        built.scale.setScalar(FLIGHT.scale);
        this.stage.scene.add(built);
        this.flying.set(flight.id, { signature: itemSignature(flight.item), view: built });
      });
      const total = flight.flown + flight.rangeLeft;
      const progress = total > 0 ? flight.flown / total : 1;
      view.position.set(flight.x, FLIGHT.lift + Math.sin(progress * Math.PI) * FLIGHT.arcHeight, flight.y);
      view.visible = true;
    }
    for (const [id, view] of this.flying) {
      if (live.some((flight) => flight.id === id)) continue;
      view.view.removeFromParent();
      this.flying.delete(id);
    }
  }

  /** Reuses the pooled view when the item still looks the same, otherwise builds a new one. */
  private viewFor(current: ItemView | undefined, item: Item, install: (built: THREE.Group) => void): THREE.Group {
    const signature = itemSignature(item);
    if (current && current.signature === signature) return current.view;
    current?.view.removeFromParent();
    const built = buildItemView(item);
    install(built);
    return built;
  }

  private drawHighlights(state: Readonly<SimState>, targets: readonly (TilePos | null)[]): void {
    const position = new THREE.Vector3();
    state.chefs.forEach((chef, i) => {
      const ring = this.highlights[i] ?? this.makeHighlight(i, chef.index);
      const target = targets[i];
      if (!target) {
        ring.visible = false;
        return;
      }
      const index = target.y * state.width + target.x;
      if (!state.tiles[index]) {
        ring.visible = false;
        return;
      }
      const tile = state.tiles[index];
      const off = this.offsetFor(tile);
      const surface = this.tiles?.views[index]?.surfaceY ?? 0;
      position.set(tile.x + 0.5 + off.x, surface + HIGHLIGHT.lift, tile.y + 0.5 + off.y);
      ring.position.copy(position);
      ring.visible = true;
    });
  }

  /** Boards a chef is chopping on right now, so their knives move. */
  private drawChopping(state: Readonly<SimState>, targets: readonly (TilePos | null)[]): void {
    if (!this.tiles) return;
    this.choppingBoards.clear();
    state.chefs.forEach((chef, i) => {
      const target = targets[i];
      if (chef.action !== 'chopping' || !target) return;
      this.choppingBoards.add(target.y * state.width + target.x);
    });
    this.tiles.animateKnives(this.choppingBoards, this.elapsed);
  }

  private drawChefs(state: Readonly<SimState>, dtSec: number): void {
    const shown = new Set<number>();
    for (const chef of state.chefs) {
      const falling = chef.action === 'falling';
      // A chef in the hole is out of sight until it respawns; the fall itself is a burst of dust.
      if (falling && this.wasFalling[chef.index] !== true) {
        for (let i = 0; i < FALL_FX.puffs; i++) this.fx.spawnDust(new THREE.Vector3(chef.x, 0, chef.y));
      }
      this.wasFalling[chef.index] = falling;
      if (falling) continue;
      shown.add(chef.index);
      const rig = this.chefs.get(chef.index) ?? this.makeChef(chef.index);
      rig.setPosition(chef.x, chef.y);
      rig.setFacing(chef.facing);
      rig.setMoving(chef.action === 'walking' || chef.action === 'dashing');
      rig.setDashing(chef.action === 'dashing');
      rig.update(dtSec);
      this.drawHeldItem(chef, rig);
    }
    for (const [index, rig] of this.chefs) {
      rig.group.visible = shown.has(index);
    }
  }

  /** A trail of floor dust behind a dashing chef. */
  private drawDashDust(state: Readonly<SimState>, dtSec: number): void {
    for (const chef of state.chefs) {
      const timer = (this.dashDustTimer[chef.index] ?? 0) - dtSec;
      if (chef.action !== 'dashing') {
        this.dashDustTimer[chef.index] = 0;
        continue;
      }
      if (timer > 0) {
        this.dashDustTimer[chef.index] = timer;
        continue;
      }
      this.dashDustTimer[chef.index] = DASH_FX.everySec;
      const facing = FACING_VECTORS[chef.facing];
      this.fx.spawnDust(new THREE.Vector3(chef.x - facing.dx * DASH_FX.behind, 0, chef.y - facing.dy * DASH_FX.behind));
    }
  }

  private drawHeldItem(chef: Chef, rig: ChefRig): void {
    const current = this.held.get(chef.index);
    if (!chef.holding) {
      if (current) current.view.visible = false;
      return;
    }
    const item = chef.holding;
    const view = this.viewFor(current, item, (built) => {
      built.scale.setScalar(HELD.scale);
      rig.heldSlot.add(built);
      this.held.set(chef.index, { signature: itemSignature(item), view: built });
    });
    view.visible = true;
    // A bumped tray shakes for the rest of its wobble window, hardest right after the bump.
    const wobble = item.kind === 'tray' && chef.wobble !== undefined ? chef.wobble / TRAY_WOBBLE_SEC : 0;
    view.rotation.z = wobble > 0 ? Math.sin(this.elapsed * WOBBLE.hz * Math.PI * 2) * WOBBLE.rad * wobble : 0;
  }

  private drawPedestrians(state: Readonly<SimState>, dtSec: number): void {
    const seen = new Set<number>();
    for (const ped of state.pedestrians) {
      seen.add(ped.id);
      const rig = this.pedestrians.get(ped.id) ?? this.makePedestrian(ped.id);
      rig.setPosition(ped.x, ped.y);
      rig.setHeading(ped.vx, ped.vy);
      rig.setMoving(Math.abs(ped.vx) + Math.abs(ped.vy) > PEDESTRIAN.moveEpsilon);
      rig.update(dtSec);
    }
    for (const [id, rig] of this.pedestrians) {
      if (seen.has(id)) continue;
      rig.dispose();
      this.pedestrians.delete(id);
    }
  }

  /** Steam rises from pots and pans that are cooking or done on a stove. */
  private drawSteam(state: Readonly<SimState>): void {
    this.steamPositions.length = 0;
    for (let i = 0; i < state.tileItems.length; i++) {
      const item = state.tileItems[i];
      if (!item || item.kind !== 'pot' || state.tiles[i].type !== 'stove') continue;
      if (item.state !== 'cooking' && item.state !== 'cooked') continue;
      this.steamPositions.push(this.slotPosition(state, i, new THREE.Vector3()));
    }
    this.fx.setSteamSources(this.steamPositions);
  }

  private drawFires(state: Readonly<SimState>): void {
    this.firePositions.clear();
    for (const fire of state.fires) {
      const index = fire.y * state.width + fire.x;
      const tile = state.tiles[index];
      const off = tile ? this.offsetFor(tile) : { x: 0, y: 0 };
      const surface = this.tiles?.views[index]?.surfaceY ?? 0;
      this.firePositions.set(fireKey(fire.x, fire.y), new THREE.Vector3(fire.x + 0.5 + off.x, surface, fire.y + 0.5 + off.y));
    }
    this.fx.syncFires(this.firePositions);
  }

  private drawSpray(state: Readonly<SimState>, dtSec: number): void {
    for (const chef of state.chefs) {
      const timer = (this.sprayTimer[chef.index] ?? 0) - dtSec;
      if (chef.action !== 'extinguishing') {
        this.sprayTimer[chef.index] = 0;
        continue;
      }
      if (timer > 0) {
        this.sprayTimer[chef.index] = timer;
        continue;
      }
      this.sprayTimer[chef.index] = SPRAY_FX.intervalSec;
      const facing = FACING_VECTORS[chef.facing];
      const origin = new THREE.Vector3(chef.x + facing.dx * SPRAY_FX.distance, 0, chef.y + facing.dy * SPRAY_FX.distance);
      this.fx.spawnSpray(origin, new THREE.Vector3(facing.dx, 0, facing.dy));
    }
  }

  // ─── Overlay: progress bars and badges ────────────────────────────────────
  private drawBars(state: Readonly<SimState>, targets: readonly (TilePos | null)[], dtSec: number): void {
    const g = this.barsGfx;
    g.clear();
    // 86 system: unloading progress lives on the delivery, so the bar stays while the hands rest.
    const due = (state.restocks ?? []).find((restock) => restock.arrivesIn <= 0);
    for (let i = 0; i < state.tiles.length; i++) {
      const tile = state.tiles[i];
      const item = state.tileItems[i];
      // A crate with finite stock (86 system) shows its fill level; the chalk mark takes over at empty.
      if (tile.type === 'crate' && tile.stock !== undefined && tile.capacity !== undefined && tile.capacity > 0) {
        const fraction = tile.stock / tile.capacity;
        const color = fraction > STOCK.halfFraction ? COLOR.barGood : fraction > STOCK.lowFraction ? COLOR.barWarn : COLOR.barDanger;
        this.bar(state, i, fraction, color, 1);
      }
      if (tile.type === 'delivery' && due && due.unloaded > 0 && due.unloaded < 1) {
        this.bar(state, i, due.unloaded, COLOR.barGood, 1);
      }
      if (!item) continue;
      if (tile.type === 'board' && item.kind === 'ingredient' && item.chopProgress > 0 && item.chopProgress < 1) {
        this.bar(state, i, item.chopProgress, COLOR.barWarn, 1);
      }
      if (tile.type === 'stove' && item.kind === 'pot') {
        if (item.state === 'cooking') this.bar(state, i, item.cookProgress, COLOR.barGood, 1);
        else if (item.state === 'cooked') {
          const flash = BAR.flashMinAlpha + (1 - BAR.flashMinAlpha) * (0.5 + 0.5 * Math.sin(this.elapsed * BAR.flashSpeedRad));
          this.bar(state, i, item.burnProgress, COLOR.barDanger, flash);
          this.warningIcon(state, i, flash);
        }
      }
    }
    for (const chef of state.chefs) {
      const target = targets[chef.index];
      const index = target ? target.y * state.width + target.x : -1;
      const tile = index >= 0 ? state.tiles[index] : undefined;
      if (chef.action === 'washing' && tile && tile.type === 'sink') {
        this.bar(state, index, chef.actionProgress, COLOR.barWash, 1);
      } else if (chef.action === 'lifting' && tile) {
        this.bar(state, index, chef.actionProgress, COLOR.barWash, 1);    // tray wind-up, lifting or setting down
      }
      this.assistBadge(state, chef, tile ? index : -1, dtSec);
    }
  }

  /** "x2" beside the bar while this chef is the second pair of hands at a station (chop assist),
   *  held for ASSIST_BADGE.lingerSec after the hands leave so a short assist still reads. */
  private assistBadge(state: Readonly<SimState>, chef: Chef, index: number, dtSec: number): void {
    const badge = this.assistBadges[chef.index] ?? this.makeAssistBadge(chef.index);
    if (chef.assisting === true && index >= 0) {
      this.assistLinger[chef.index] = ASSIST_BADGE.lingerSec;
      this.assistTile[chef.index] = index;
    } else {
      this.assistLinger[chef.index] = Math.max(0, (this.assistLinger[chef.index] ?? 0) - dtSec);
    }
    const left = this.assistLinger[chef.index] ?? 0;
    const at = this.assistTile[chef.index] ?? -1;
    if (left <= 0 || at < 0 || !state.tiles[at]) {
      badge.setVisible(false);
      return;
    }
    const anchor = this.barAnchor(state, at);
    badge.setPosition(anchor.x + BAR.widthPx / 2 + BAR.borderPx + ASSIST_BADGE.gapPx, anchor.y);
    badge.setAlpha(Math.min(1, left / (ASSIST_BADGE.lingerSec / 2)));
    badge.setVisible(true);
  }

  /** Screen anchor above a tile's working surface. */
  private barAnchor(state: Readonly<SimState>, index: number): { x: number; y: number } {
    const position = this.slotPosition(state, index, new THREE.Vector3());
    return this.stage.project(position.x, position.y + BAR.aboveSurface, position.z, this.screen);
  }

  private bar(state: Readonly<SimState>, index: number, progress: number, color: number, alpha: number): void {
    const anchor = this.barAnchor(state, index);
    const x = anchor.x - BAR.widthPx / 2;
    const y = anchor.y - BAR.heightPx / 2;
    const g = this.barsGfx;
    g.fillStyle(COLOR.barTrack, BAR.trackAlpha * alpha);
    g.fillRect(x - BAR.borderPx, y - BAR.borderPx, BAR.widthPx + BAR.borderPx * 2, BAR.heightPx + BAR.borderPx * 2);
    g.fillStyle(color, alpha);
    g.fillRect(x, y, BAR.widthPx * Phaser.Math.Clamp(progress, 0, 1), BAR.heightPx);
  }

  private warningIcon(state: Readonly<SimState>, index: number, alpha: number): void {
    const anchor = this.barAnchor(state, index);
    const cx = anchor.x;
    const top = anchor.y - BAR.heightPx / 2 - WARN_ICON.aboveBarPx;
    const g = this.barsGfx;
    g.fillStyle(COLOR.barWarn, alpha);
    g.fillTriangle(cx, top - WARN_ICON.heightPx, cx - WARN_ICON.widthPx / 2, top, cx + WARN_ICON.widthPx / 2, top);
  }

  private drawBadges(state: Readonly<SimState>): void {
    const position = new THREE.Vector3();
    for (let i = 0; i < state.tileItems.length; i++) {
      const item = state.tileItems[i];
      const badge = this.badges.get(i);
      const count = item ? itemCount(item) : 1;
      if (!item || count <= 1) {
        badge?.setVisible(false);
        continue;
      }
      this.slotPosition(state, i, position);
      const anchor = this.stage.project(position.x, position.y + BADGE.lift, position.z, this.screen);
      const label = badge ?? this.makeBadge(i);
      label.setText(`x${count}`);
      label.setPosition(anchor.x, anchor.y);
      label.setVisible(true);
    }
  }

  /** The chalk "86" over every crate that has run dry; it stays until the restock. */
  private drawChalk(state: Readonly<SimState>): void {
    const position = new THREE.Vector3();
    for (let i = 0; i < state.tiles.length; i++) {
      const tile = state.tiles[i];
      const empty = tile.type === 'crate' && tile.stock === 0;
      const chalk = this.chalks.get(i);
      if (!empty) {
        chalk?.setVisible(false);
        continue;
      }
      this.slotPosition(state, i, position);
      const anchor = this.stage.project(position.x, position.y + CHALK.lift, position.z, this.screen);
      const mark = chalk ?? this.makeChalk(i);
      mark.setPosition(anchor.x, anchor.y);
      mark.setVisible(true);
    }
  }

  // ─── Pools ────────────────────────────────────────────────────────────────
  private skinFor(chefIndex: number): ChefSkin {
    return CHEF_SKINS[this.skins[chefIndex] ?? chefIndex] ?? CHEF_SKINS[chefIndex % CHEF_SKINS.length];
  }

  private makeHighlight(slot: number, chefIndex: number): THREE.Mesh {
    const color = this.skinFor(chefIndex).color;
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(HIGHLIGHT.inner, HIGHLIGHT.outer, HIGHLIGHT.segments),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: HIGHLIGHT.alpha, depthWrite: false, side: THREE.DoubleSide }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.visible = false;
    this.stage.scene.add(ring);
    this.highlights[slot] = ring;
    return ring;
  }

  private makeChef(index: number): ChefRig {
    const rig = new ChefRig(this.skinFor(index), true);
    this.stage.scene.add(rig.group);
    this.chefs.set(index, rig);
    return rig;
  }

  private makePedestrian(id: number): ChefRig {
    const rig = new ChefRig({ model: 'chef', url: PEDESTRIAN_SKIN_URLS[Math.abs(id) % PEDESTRIAN_SKIN_URLS.length] }, false);
    this.stage.scene.add(rig.group);
    this.pedestrians.set(id, rig);
    return rig;
  }

  private makeBadge(index: number): Phaser.GameObjects.Text {
    const badge = this.scene.add.text(0, 0, '', BADGE_STYLE).setOrigin(0.5, 0.5);
    this.container.add(badge);
    this.badges.set(index, badge);
    return badge;
  }

  private makeChalk(index: number): Phaser.GameObjects.Image {
    const chalk = this.scene.add.image(0, 0, TEX.chalk86).setOrigin(0.5, 1).setAlpha(CHALK.alpha);
    this.container.add(chalk);
    this.chalks.set(index, chalk);
    return chalk;
  }

  private makeAssistBadge(chefIndex: number): Phaser.GameObjects.Text {
    const badge = this.scene.add
      .text(0, 0, ASSIST_BADGE.label, { ...BADGE_STYLE, fontSize: `${ASSIST_BADGE.fontPx}px` })
      .setOrigin(0, 0.5)
      .setVisible(false);
    this.container.add(badge);
    this.assistBadges[chefIndex] = badge;
    return badge;
  }
}
