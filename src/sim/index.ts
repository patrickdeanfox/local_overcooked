// ─── Sim public surface ─────────────────────────────────────────────────────
// Overcooked 1 kitchen simulation. Pure TypeScript: no Phaser, no DOM, no Math.random,
// no Date. Same level + options + input sequence ⇒ byte-identical JSON state.
//
// Coordinates are tile units (see types.ts): x right, y down, chef x/y is the chef centre.
// SimState is plain data; presentation reads it every frame and never mutates it.
import type { LevelDef, OrderSettings } from '../levels/schema';
import { isWalkable, parseGrid, SOLID_TILES } from '../levels/schema';
import {
  ASSIST_RATE, BURN_TIME, CATCH_RADIUS, CHEF_HITBOX, CHEF_RADIUS, CHEF_SPEED, CHOP_TIME, COOK_TIME, CRATE_SIZE,
  DASH_BUMP_PUSH, DASH_COOLDOWN, DASH_SPEED, DASH_THROW_BONUS, DASH_THROW_WINDOW, DASH_TIME, EXTINGUISH_RATE,
  FALL_PENALTY_SEC, FIRE_SPREAD_TIME, MAX_PUSH_ESCAPE, MAX_SIMULTANEOUS_86, MOVE_DEADZONE, ORDER_FAIL_PENALTY,
  PAN_CAPACITY, PAN_COOK_TIME, PLATE_RETURN_DELAY, PLATE_STACK_RETURN_DELAY, POT_CAPACITY, REACH,
  RESTOCK_DELAY_SEC, RESTOCK_UNLOAD_SEC, SIM_DT, SPRAY_LATERAL_TOLERANCE, SPRAY_RANGE, THROW_OWN_CATCH_DISTANCE,
  THROW_RANGE, THROW_SPEED, TICK_EVENT_HZ, TIMER_WARNING_AT, TIP_BASE, TIP_MAX, TRAY_CAPACITY, TRAY_SPEED_SCALE,
  TRAY_WINDUP_SEC, TRAY_WOBBLE_SEC, TWO_PLATE_MAX, WASH_TIME,
} from './constants';
import { dishMatchesRecipe, isBurgerComponent, isPlatedComponent, RECIPES, recipeDishType, sortIngredients } from './recipes';
import { mulberry32, type Rng } from './rng';
import {
  CHOPPED_INGREDIENTS, FACING_VECTORS, FRIED_INGREDIENTS, INGREDIENT_TYPES, NO_INPUT, SOUP_INGREDIENTS,
  type Chef, type ChefAction, type Dish, type DirtyPlateItem, type FlyingItem, type IngredientItem, type IngredientType,
  type Item, type Order, type PlateItem, type PlayerInput, type PotItem, type Recipe, type Restock, type SimEvent,
  type SimState, type Modifiers, type SliderGroup, type Tile, type TrayItem, type TrayLoad, type Ware,
} from './types';

export * from './constants';
export * from './types';
export { dishMatchesRecipe, isBurgerComponent, isPlatedComponent, RECIPES, recipeDishType, recipeForDish, sortIngredients } from './recipes';
export { mulberry32 } from './rng';
export type { Rng } from './rng';

// ─── Local constants ────────────────────────────────────────────────────────
const HALF = CHEF_HITBOX / 2;          // chef half-width against solid tiles
const EPS = 1e-9;                      // keeps "touching" from counting as "overlapping"
const DEGENERATE = 1e-6;               // distance below which a push direction is picked arbitrarily
const TICK_INTERVAL = 1 / TICK_EVENT_HZ;
const NEIGHBOURS: readonly { dx: number; dy: number }[] = [
  { dx: 0, dy: -1 }, { dx: 1, dy: 0 }, { dx: 0, dy: 1 }, { dx: -1, dy: 0 },
];

export interface SimOptions {
  players: number;        // 1 or 2
  seed: number;           // deterministic order sequence
  modifiers?: Modifiers;  // difficulty scaling applied to the level's numbers at construction
}

/** The level's numbers after Modifiers, i.e. what this run actually uses. */
export interface EffectiveSettings {
  timeLimitSec: number;
  orders: OrderSettings;
  chefSpeed: number;
  cookTime: number;     // seconds for a full pot, COOK_TIME scaled
  panCookTime: number;  // seconds for a patty, PAN_COOK_TIME scaled
  burnTime: number;     // seconds from cooked to burnt, BURN_TIME scaled
  chopTime: number;     // seconds per ingredient, CHOP_TIME scaled
  washTime: number;     // seconds per plate, WASH_TIME scaled
  instantCooking: boolean;
  ordersNeverExpire: boolean;
  noBurning: boolean;
  // Mechanics (docs/MECHANICS.md), each on or off for the run.
  twoPlateCarry: boolean;
  chopAssist: boolean;
  tray: boolean;
  passThroughShelf: boolean;
  eightySix: boolean;
}

interface SliderSpec { group: string; axis: 'x' | 'y'; amplitude: number; periodSec: number; phase: number; }
interface SliderTile { x: number; y: number; group: string; }
/** One gate dynamic. x/y is a tile of the group, carried on the open/close events. */
interface GateSpec { group: string; periodSec: number; openFrac: number; phase: number; x: number; y: number; }
interface GateTile { index: number; x: number; y: number; group: string; }
interface PedLane {
  fromX: number; fromY: number; toX: number; toY: number;
  speed: number; intervalSec: number; timer: number;
}
/** A tray lift or set-down in its wind-up: what happens when the timer runs out, if still valid. */
interface Windup { kind: 'lift' | 'set'; tile: number; trayId: number; }

// ─── Pure helpers ───────────────────────────────────────────────────────────
function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

/** Tile types a chef body cannot enter. Sliders are solid too but move, so they are
 *  collided separately from the static grid. */
function isStaticSolid(type: Tile['type']): boolean {
  return SOLID_TILES.has(type) && type !== 'slider';
}

/** Counters a chef may set an item down on. Sliders are counters that move; the tray rack is a
 *  counter that starts with the tray. The shelf joins them only while its mechanic is on, so
 *  the Sim checks it through canPlaceOn(). */
function isPlaceableCounter(type: Tile['type']): boolean {
  return type === 'counter' || type === 'slider' || type === 'trayRack';
}

/** What a tray takes off a tile: an ingredient in any state, or a plate (one off a stack). */
function isTrayLoadable(item: Item): item is TrayLoad {
  return item.kind === 'ingredient' || item.kind === 'plate';
}

function isTray(item: Item | null): item is TrayItem {
  return item !== null && item.kind === 'tray';
}

/** Two-plate carry: a chef with a stack of clean plates in hand. */
function holdsTwoPlates(chef: Chef): boolean {
  return chef.holding !== null && chef.holding.kind === 'plate' && (chef.holding.count ?? 1) > 1;
}

/** Multiset intersection size of two ingredient lists: how much prep carries over between recipes. */
function sharedIngredients(a: readonly IngredientType[], b: readonly IngredientType[]): number {
  const rest = [...b];
  let n = 0;
  for (const ing of a) {
    const at = rest.indexOf(ing);
    if (at < 0) continue;
    rest.splice(at, 1);
    n += 1;
  }
  return n;
}

/** Ground a thrown item can come to rest on. Open gates count; the caller checks the gate. */
function isLandingFloor(type: Tile['type']): boolean {
  return type === 'floor' || type === 'road' || type === 'gate';
}

/** Ground a throw flies over without stopping: holes, and gates while closed. */
function isFlyOver(type: Tile['type']): boolean {
  return type === 'gap' || type === 'gate';
}

/** Only ingredients fly: never plates, cookware or the extinguisher (wiki, OC2 Throwing). */
function isThrowable(item: Item | null): item is IngredientItem {
  return item !== null && item.kind === 'ingredient';
}

function isFalling(chef: Chef): boolean {
  return chef.respawnIn !== undefined;
}

function isDashing(chef: Chef): boolean {
  return chef.dashTimeLeft !== undefined;
}

// ─── Cookware ───────────────────────────────────────────────────────────────
function wareOf(pot: PotItem): Ware {
  return pot.ware ?? 'pot';
}

function wareCapacity(pot: PotItem): number {
  return wareOf(pot) === 'pan' ? PAN_CAPACITY : POT_CAPACITY;
}

function wareCookTime(pot: PotItem, settings: EffectiveSettings): number {
  return wareOf(pot) === 'pan' ? settings.panCookTime : settings.cookTime;
}

/** A pot boils soup ingredients, a pan fries the chopped ones that come out cooked. Both
 *  refuse raw ingredients (wiki Burner: "an unchopped ingredient" is pushed away). */
function wareAccepts(pot: PotItem, item: IngredientItem): boolean {
  if (!item.chopped) return false;
  const list = wareOf(pot) === 'pan' ? FRIED_INGREDIENTS : SOUP_INGREDIENTS;
  return list.includes(item.type);
}

/** True when the ingredient has had all the prep its plate needs: sashimi fish and prawn
 *  chopped; burger buns raw, toppings chopped, meat cooked (so it can only come out of a pan). */
function readyForPlate(item: IngredientItem): boolean {
  if (isPlatedComponent(item.type)) return item.chopped;
  if (!isBurgerComponent(item.type)) return false;
  if (FRIED_INGREDIENTS.includes(item.type)) return item.cooked === true;
  if (CHOPPED_INGREDIENTS.includes(item.type)) return item.chopped;
  return true;
}

// ─── Difficulty ─────────────────────────────────────────────────────────────
/** Copies the level's numbers and scales them by the run's modifiers. The LevelDef itself is
 *  never touched: the same level object drives every difficulty. */
function effectiveSettings(level: LevelDef, mods: Modifiers | undefined): EffectiveSettings {
  const orders = level.orders;
  const forced = level.mechanics ?? {}; // a tutorial kitchen plays its mechanic whatever the switches say
  const max = Math.max(1, orders.max + (mods?.maxOrdersDelta ?? 0));
  return {
    timeLimitSec: level.timeLimitSec * (mods?.timeLimitScale ?? 1),
    orders: {
      initial: Math.min(max, Math.max(0, orders.initial + (mods?.initialOrdersDelta ?? 0))),
      intervalSec: orders.intervalSec * (mods?.orderIntervalScale ?? 1),
      max,
      timeSec: orders.timeSec * (mods?.orderTimeScale ?? 1),
    },
    chefSpeed: CHEF_SPEED * (mods?.chefSpeedScale ?? 1),
    cookTime: COOK_TIME * (mods?.cookTimeScale ?? 1),
    panCookTime: PAN_COOK_TIME * (mods?.cookTimeScale ?? 1),
    burnTime: BURN_TIME * (mods?.burnTimeScale ?? 1),
    chopTime: CHOP_TIME * (mods?.chopTimeScale ?? 1),
    washTime: WASH_TIME * (mods?.washTimeScale ?? 1),
    instantCooking: mods?.instantCooking === true,
    ordersNeverExpire: mods?.ordersNeverExpire === true,
    noBurning: mods?.noBurning === true,
    twoPlateCarry: mods?.twoPlateCarry === true || forced.twoPlateCarry === true,
    chopAssist: mods?.chopAssist === true || forced.chopAssist === true,
    tray: mods?.tray === true || forced.tray === true,
    passThroughShelf: mods?.passThroughShelf === true || forced.passThroughShelf === true,
    eightySix: mods?.eightySix === true || forced.eightySix === true,
  };
}

// ─── Sim ────────────────────────────────────────────────────────────────────
export class Sim {
  readonly level: LevelDef;

  private state: SimState;
  private rng: Rng;
  private settings: EffectiveSettings;

  // Id counters are per-Sim so two Sims with the same seed produce identical snapshots.
  private nextItemId = 1;
  private nextOrderId = 1;
  private nextPedId = 1;
  private nextFlightId = 1;
  private nextRestockId = 1;

  private orderTimer = 0;
  private warned = false;
  private stepCount = 0;

  // Precomputed level geometry.
  private staticSolid: boolean[] = [];
  private sliderTiles: SliderTile[] = [];
  private sliderSpecs: SliderSpec[] = [];
  private gateTiles: GateTile[] = [];
  private gateSpecs: GateSpec[] = [];
  private pedLanes: PedLane[] = [];
  private pedTargets: Record<number, { x: number; y: number }> = {};
  private plateReturnTiles: number[] = [];
  private plateStackTiles: number[] = [];
  private crateTiles: number[] = [];
  private trayRackTiles: number[] = [];
  private deliveryTile = -1;
  // Tiles a chef can stand next to, so a fire on them can be sprayed. Same indexing as tiles.
  private fightable: boolean[] = [];
  // Chop assist: which step each station was last worked in and by how many chefs so far.
  private claimAt: number[] = [];
  private claimN: number[] = [];
  // 86 system: which scripted shortages have fired.
  private scriptedFired: boolean[] = [];

  // Per-chef scratch that does not belong in the snapshot.
  private prevActions: ChefAction[] = [];
  private prevProgress: number[] = [];
  private sprayTickAt: number[] = [];
  // Which dash (a per-chef counter) last bumped which chef, so one dash bumps each chef once.
  private dashCount: number[] = [];
  private bumpedAt: number[][] = [];
  // Clean plates waiting on a sink with no adjacent drying tile, keyed by sink tile index.
  private sinkClean: Record<number, number> = {};
  // The tray lift or set-down each chef is winding up, if any.
  private windups: (Windup | null)[] = [];
  // True while a tray's top item is being offered to a tile through handlePickup, so the
  // two-plate rule does not pull a second plate onto a tray plate.
  private offering = false;
  // Reused [minX, minY, ...] buffer of 1x1 solid boxes, so collision allocates nothing.
  private boxBuf: number[] = [];
  // Reused candidate list for fire spread.
  private spreadBuf: number[] = [];

  constructor(level: LevelDef, opts: SimOptions) {
    this.level = level;
    this.rng = mulberry32(opts.seed);
    this.settings = effectiveSettings(level, opts.modifiers);

    const parsed = parseGrid(level);
    // parseGrid ids come from a module-global counter shared by every Sim in the process.
    // Renumber from 1 so two Sims built from the same level and seed match exactly.
    for (const item of parsed.items) if (item) item.id = this.nextItemId++;
    // The tray is level content that only exists while its mechanic is on: off, the rack is bare.
    if (!this.settings.tray) {
      for (let i = 0; i < parsed.items.length; i++) if (isTray(parsed.items[i])) parsed.items[i] = null;
    }

    const playerCount = clamp(Math.floor(opts.players), 1, level.spawns.length || 1);
    const chefs: Chef[] = [];
    for (let i = 0; i < playerCount; i++) {
      const spawn = level.spawns[i] ?? { x: 0, y: 0 };
      chefs.push({
        index: i, x: spawn.x + 0.5, y: spawn.y + 0.5, facing: 'down',
        holding: null, action: 'idle', actionProgress: 0,
      });
      this.prevActions.push('idle');
      this.prevProgress.push(0);
      this.sprayTickAt.push(Number.NEGATIVE_INFINITY);
      this.dashCount.push(0);
      this.bumpedAt.push([]);
      this.windups.push(null);
    }

    this.state = {
      width: parsed.width,
      height: parsed.height,
      tiles: parsed.tiles,
      tileItems: parsed.items,
      chefs,
      fires: [],
      orders: [],
      pedestrians: [],
      sliders: [],
      score: 0,
      timeLeft: this.settings.timeLimitSec,
      phase: level.timerStartsOnFirstServe ? 'prep' : 'running',
      timerRunning: !level.timerStartsOnFirstServe,
      elapsed: 0,
      servedCount: 0,
      failedCount: 0,
      pendingPlateReturns: [],
      stars: 0,
      tipStreak: 0,
      seed: opts.seed,
    };

    this.indexLevel();
    this.setupStock();
    this.orderTimer = Math.max(this.settings.orders.intervalSec, SIM_DT);
    for (let i = 0; i < this.settings.orders.initial; i++) this.spawnOrder(null);
    this.recomputeStars();
    this.updateSliders();
    this.updateGates(null); // a group whose phase starts it closed is solid from step one
  }

  // ─── Setup ────────────────────────────────────────────────────────────────
  private indexLevel(): void {
    const st = this.state;
    for (let i = 0; i < st.tiles.length; i++) {
      const tile = st.tiles[i];
      this.staticSolid.push(isStaticSolid(tile.type));
      if (tile.type === 'slider') this.sliderTiles.push({ x: tile.x, y: tile.y, group: tile.group ?? '' });
      if (tile.type === 'gate') this.gateTiles.push({ index: i, x: tile.x, y: tile.y, group: tile.group ?? '' });
      if (tile.type === 'plateReturn') this.plateReturnTiles.push(i);
      if (tile.type === 'plateStack') this.plateStackTiles.push(i);
      if (tile.type === 'crate') this.crateTiles.push(i);
      if (tile.type === 'trayRack') this.trayRackTiles.push(i);
      if (tile.type === 'delivery' && this.deliveryTile < 0) this.deliveryTile = i;
      this.claimAt.push(-1);
      this.claimN.push(0);
    }
    for (let i = 0; i < st.tiles.length; i++) this.fightable.push(this.hasWalkableNeighbour(st.tiles[i]));
    for (const _ of this.level.eightySix?.scripted ?? []) this.scriptedFired.push(false);
    for (const dyn of this.level.dynamics ?? []) {
      if (dyn.type === 'sliders') {
        this.sliderSpecs.push({
          group: dyn.group, axis: dyn.axis, amplitude: dyn.amplitude,
          periodSec: Math.max(dyn.periodSec, SIM_DT), phase: dyn.phase ?? 0,
        });
        this.state.sliders.push({ id: dyn.group, offsetX: 0, offsetY: 0 });
      } else if (dyn.type === 'gate') {
        const first = this.gateTiles.find((t) => t.group === dyn.group);
        const periodSec = Math.max(dyn.periodSec, SIM_DT);
        this.gateSpecs.push({
          group: dyn.group, periodSec,
          openFrac: clamp(dyn.openSec / periodSec, 0, 1), phase: dyn.phase ?? 0,
          x: first ? first.x : 0, y: first ? first.y : 0,
        });
        (this.state.gates ??= []).push({ id: dyn.group, open: true, secondsToChange: 0 });
      } else if (dyn.type === 'pedestrians') {
        for (const lane of dyn.lanes) {
          this.pedLanes.push({
            fromX: lane.from.x, fromY: lane.from.y, toX: lane.to.x, toY: lane.to.y,
            speed: dyn.speed, intervalSec: Math.max(dyn.intervalSec, SIM_DT),
            timer: dyn.firstDelaySec ?? 0,
          });
        }
      }
    }
  }

  /** 86 system: gives every non-exempt crate its stock. Exempt are the level's `exempt` list and
   *  any ingredient every recipe needs (the level's "bread"), unless a stations override sets that
   *  crate's size, which parseGrid leaves in `capacity`. Off: crates keep no stock and never run out. */
  private setupStock(): void {
    if (!this.settings.eightySix) return;
    const cfg = this.level.eightySix;
    const exempt = new Set<IngredientType>(cfg?.exempt ?? []);
    const recipes: Recipe[] = [];
    for (const id of this.level.recipes) if (RECIPES[id]) recipes.push(RECIPES[id]);
    if (recipes.length > 0) {
      for (const ing of INGREDIENT_TYPES) if (recipes.every((r) => r.ingredients.includes(ing))) exempt.add(ing);
    }
    const size = cfg?.crateSize ?? CRATE_SIZE;
    for (const i of this.crateTiles) {
      const tile = this.state.tiles[i];
      if (tile.capacity === undefined) {
        if (!tile.ingredient || exempt.has(tile.ingredient)) continue;
        tile.capacity = size;
      }
      tile.stock = tile.capacity;
    }
  }

  // ─── Public queries ───────────────────────────────────────────────────────
  getState(): Readonly<SimState> { return this.state; }

  /** The level's numbers after the run's Modifiers: what the HUD and the timer actually use. */
  getEffectiveSettings(): Readonly<EffectiveSettings> { return this.settings; }

  /** Tile the chef would interact with right now (also drives the highlight), or null if the
   *  reach point is off the grid. Slider tiles are hit-tested at their shifted position but
   *  reported by their base tile, which is where their item lives. */
  getTargetTile(chefIndex: number): { x: number; y: number } | null {
    const chef = this.state.chefs[chefIndex];
    if (!chef) return null;
    const v = FACING_VECTORS[chef.facing];
    const px = chef.x + v.dx * (HALF + REACH);
    const py = chef.y + v.dy * (HALF + REACH);
    for (const s of this.sliderTiles) {
      const g = this.groupOffset(s.group);
      const bx = s.x + (g ? g.offsetX : 0);
      const by = s.y + (g ? g.offsetY : 0);
      if (px >= bx && px < bx + 1 && py >= by && py < by + 1) return { x: s.x, y: s.y };
    }
    const tx = Math.floor(px);
    const ty = Math.floor(py);
    if (tx < 0 || ty < 0 || tx >= this.state.width || ty >= this.state.height) return null;
    return { x: tx, y: ty };
  }

  /** Tile at (x, y), or null off grid. */
  tileAt(x: number, y: number): Tile | null {
    if (x < 0 || y < 0 || x >= this.state.width || y >= this.state.height) return null;
    return this.state.tiles[y * this.state.width + x];
  }

  /** Item resting on tile (x, y), or null. */
  itemAt(x: number, y: number): Item | null {
    if (x < 0 || y < 0 || x >= this.state.width || y >= this.state.height) return null;
    return this.state.tileItems[y * this.state.width + x];
  }

  /** True while tile (x, y) is burning. Burning tiles refuse every interaction but spray. */
  fireAt(x: number, y: number): boolean {
    for (const f of this.state.fires) if (f.x === x && f.y === y) return true;
    return false;
  }

  /** True while the gate group is open, so its tiles are walkable. Unknown groups read as
   *  open: a gate tile with no dynamic is plain floor. */
  gateOpen(group: string): boolean {
    const gates = this.state.gates;
    if (!gates) return true;
    for (const g of gates) if (g.id === group) return g.open;
    return true;
  }

  /** Current offset of a slider group, for drawing shifted tiles and the items on them. */
  sliderOffset(group: string): { x: number; y: number } {
    const g = this.groupOffset(group);
    return g ? { x: g.offsetX, y: g.offsetY } : { x: 0, y: 0 };
  }

  /** 86 system: true while every crate of the ingredient is empty. An ingredient with a crate that
   *  never runs out (no stock) is never out; one with no crate at all is not "out" either. */
  ingredientOut(type: IngredientType): boolean {
    let finite = false;
    for (const i of this.crateTiles) {
      const tile = this.state.tiles[i];
      if (tile.ingredient !== type) continue;
      if (tile.stock === undefined || tile.stock > 0) return false;
      finite = true;
    }
    return finite;
  }

  /** 86 system: the delivery waiting at the door (arrived, not yet unloaded), oldest first, or null. */
  deliveryDue(): Restock | null {
    const list = this.state.restocks;
    if (!list) return null;
    for (const r of list) if (r.arrivesIn <= 0) return r;
    return null;
  }

  /** Whether an item can be set down on this tile type: counters, sliders, the tray rack, and
   *  the shelf while its mechanic is on. */
  private canPlaceOn(type: Tile['type']): boolean {
    return isPlaceableCounter(type) || (type === 'shelf' && this.settings.passThroughShelf);
  }

  /** How many ingredients are out right now, for the MAX_SIMULTANEOUS_86 cap. */
  private outCount(): number {
    let n = 0;
    for (const ing of INGREDIENT_TYPES) if (this.ingredientOut(ing)) n += 1;
    return n;
  }

  /** Chop assist: the chef's rank at station `i` this step (1 = first pair of hands, 2 = second). */
  private claim(i: number): number {
    if (this.claimAt[i] !== this.stepCount) {
      this.claimAt[i] = this.stepCount;
      this.claimN[i] = 0;
    }
    this.claimN[i] += 1;
    return this.claimN[i];
  }

  /** Chop assist gate for a station: false when this chef's hands do not count. Off, one chef
   *  works a station; on, ASSIST_RATE chefs do and the later one is marked as assisting. */
  private handsCount(chef: Chef, i: number): boolean {
    const rank = this.claim(i);
    const max = this.settings.chopAssist ? ASSIST_RATE : 1;
    if (rank > max) return false;
    if (rank > 1) chef.assisting = true;
    return true;
  }

  // ─── Step ─────────────────────────────────────────────────────────────────
  step(inputs: readonly PlayerInput[], dt: number = SIM_DT): SimEvent[] {
    const events: SimEvent[] = [];
    const st = this.state;
    if (st.phase === 'ended') return events;

    st.elapsed += dt;
    this.stepCount += 1;
    this.updateSliders();
    this.updateGates(events);
    this.updatePedestrians(dt);

    for (let i = 0; i < st.chefs.length; i++) {
      const chef = st.chefs[i];
      const inp = inputs[i] ?? NO_INPUT;
      this.prevActions[i] = chef.action;
      this.prevProgress[i] = chef.actionProgress;
      delete chef.assisting;
      this.tickChefTimers(chef, i, dt, events);
      this.startDash(chef, i, inp, events);
      this.moveChef(chef, inp, dt);
      if (isDashing(chef)) this.dashBump(chef, i, events);
    }
    this.separateChefs();
    this.pushChefsFromPedestrians();
    this.pushChefsFromSliders();
    this.pushChefsFromGates();
    for (const chef of st.chefs) if (!isFalling(chef)) this.pushOutOfTiles(chef);
    this.checkFalls(events);

    for (let i = 0; i < st.chefs.length; i++) {
      this.updateChefActions(st.chefs[i], i, inputs[i] ?? NO_INPUT, dt, events);
    }
    this.updateFlying(dt, events);

    this.updateCooking(dt, events);
    this.updateFires(dt, events);
    this.updatePlateReturns(dt, events);
    this.updateRestocks(dt, events);
    this.updateScripted(events);
    this.updateOrders(dt, events);
    this.updateTimer(dt, events);
    return events;
  }

  // ─── Movement ─────────────────────────────────────────────────────────────
  /** Dash cooldown, the tray wobble window, the tray wind-up and the fall penalty count down
   *  here; a finished wind-up lifts or sets the tray, a fallen chef comes back at its spawn. */
  private tickChefTimers(chef: Chef, idx: number, dt: number, events: SimEvent[]): void {
    if (chef.dashCooldown !== undefined) {
      chef.dashCooldown -= dt;
      if (chef.dashCooldown <= 0) delete chef.dashCooldown;
    }
    if (chef.wobble !== undefined) {
      chef.wobble -= dt;
      if (chef.wobble <= 0) delete chef.wobble;
    }
    if (chef.windupLeft !== undefined) {
      chef.windupLeft -= dt;
      if (chef.windupLeft <= 0) {
        delete chef.windupLeft;
        this.finishWindup(chef, idx, events);
      }
    }
    if (chef.respawnIn !== undefined) {
      chef.respawnIn -= dt;
      if (chef.respawnIn <= 0) {
        delete chef.respawnIn;
        const spawn = this.level.spawns[idx] ?? { x: 0, y: 0 };
        chef.x = spawn.x + 0.5;
        chef.y = spawn.y + 0.5;
        chef.facing = 'down';
        chef.action = 'idle';
        chef.actionProgress = 0;
      }
    }
  }

  /** A dash starts on the rising edge when the chef is on the floor and off cooldown. It wins
   *  over a chop or wash in progress: the chef leaves the board. No dash while carrying two
   *  plates or the tray (docs/MECHANICS.md sections 1 and 3), nor mid wind-up. */
  private startDash(chef: Chef, idx: number, inp: PlayerInput, events: SimEvent[]): void {
    if (inp.dashPressed !== true || isFalling(chef) || isDashing(chef) || chef.dashCooldown !== undefined) return;
    if (holdsTwoPlates(chef) || isTray(chef.holding) || chef.windupLeft !== undefined) return;
    chef.dashTimeLeft = DASH_TIME;
    chef.dashCooldown = DASH_COOLDOWN;
    this.dashCount[idx] += 1;
    events.push({ type: 'dash', chef: idx, x: Math.floor(chef.x), y: Math.floor(chef.y) });
  }

  private moveChef(chef: Chef, inp: PlayerInput, dt: number): void {
    if (isFalling(chef)) { // in the hole: pinned until the respawn
      chef.action = 'falling';
      chef.actionProgress = 0;
      return;
    }
    if (chef.dashTimeLeft !== undefined) { // a dash ignores the stick and keeps its heading
      chef.action = 'dashing';
      chef.actionProgress = 0;
      const v = FACING_VECTORS[chef.facing];
      const dist = DASH_SPEED * Math.min(dt, chef.dashTimeLeft);
      if (v.dx !== 0) chef.x = this.resolveX(chef, chef.x + v.dx * dist);
      if (v.dy !== 0) chef.y = this.resolveY(chef, chef.y + v.dy * dist);
      chef.dashTimeLeft -= dt;
      if (chef.dashTimeLeft <= 0) delete chef.dashTimeLeft;
      return;
    }
    if (chef.windupLeft !== undefined) { // lifting or setting down the tray: committed until it lands
      chef.action = 'lifting';
      chef.actionProgress = 1 - chef.windupLeft / TRAY_WINDUP_SEC;
      return;
    }
    // Chopping, washing and unloading pin the chef until the action finishes or interact is released.
    const locked = (chef.action === 'chopping' || chef.action === 'washing' || chef.action === 'unloading') && inp.interactHeld;
    chef.action = 'idle';
    chef.actionProgress = 0;
    if (locked) return;

    let mx = inp.moveX;
    let my = inp.moveY;
    const len = Math.hypot(mx, my);
    if (len < MOVE_DEADZONE) return;
    if (len > 1) { mx /= len; my /= len; } // analog below full deflection, clamped above

    chef.facing = Math.abs(mx) > Math.abs(my) ? (mx > 0 ? 'right' : 'left') : (my > 0 ? 'down' : 'up');
    chef.action = 'walking';
    const dist = this.settings.chefSpeed * (isTray(chef.holding) ? TRAY_SPEED_SCALE : 1) * dt;
    if (mx !== 0) chef.x = this.resolveX(chef, chef.x + mx * dist);
    if (my !== 0) chef.y = this.resolveY(chef, chef.y + my * dist);
  }

  /** Fills boxBuf with the 1x1 solid boxes overlapping the given AABB and returns the entry
   *  count (two numbers per box: min x, min y). Allocation-free after the first few calls. */
  private collectSolidBoxes(minX: number, minY: number, maxX: number, maxY: number): number {
    const st = this.state;
    const buf = this.boxBuf;
    let n = 0;
    const x0 = Math.max(0, Math.floor(minX + EPS));
    const x1 = Math.min(st.width - 1, Math.floor(maxX - EPS));
    const y0 = Math.max(0, Math.floor(minY + EPS));
    const y1 = Math.min(st.height - 1, Math.floor(maxY - EPS));
    for (let ty = y0; ty <= y1; ty++) {
      const row = ty * st.width;
      for (let tx = x0; tx <= x1; tx++) {
        if (!this.staticSolid[row + tx]) continue;
        buf[n++] = tx;
        buf[n++] = ty;
      }
    }
    for (const s of this.sliderTiles) {
      const g = this.groupOffset(s.group);
      const bx = s.x + (g ? g.offsetX : 0);
      const by = s.y + (g ? g.offsetY : 0);
      if (maxX <= bx + EPS || minX >= bx + 1 - EPS) continue;
      if (maxY <= by + EPS || minY >= by + 1 - EPS) continue;
      buf[n++] = bx;
      buf[n++] = by;
    }
    return n;
  }

  private resolveX(chef: Chef, targetX: number): number {
    const st = this.state;
    let x = clamp(targetX, HALF, Math.max(HALF, st.width - HALF));
    if (x === chef.x) return x;
    const dir = x > chef.x ? 1 : -1;
    const lo = Math.min(chef.x, x) - HALF;
    const hi = Math.max(chef.x, x) + HALF;
    const n = this.collectSolidBoxes(lo, chef.y - HALF, hi, chef.y + HALF);
    const buf = this.boxBuf;
    for (let k = 0; k < n; k += 2) {
      const bx = buf[k];
      if (dir > 0) {
        if (chef.x + HALF > bx) continue; // level with or past the box: never clamp backwards
        if (x + HALF > bx) x = bx - HALF;
      } else {
        if (chef.x - HALF < bx + 1) continue;
        if (x - HALF < bx + 1) x = bx + 1 + HALF;
      }
    }
    return x;
  }

  private resolveY(chef: Chef, targetY: number): number {
    const st = this.state;
    let y = clamp(targetY, HALF, Math.max(HALF, st.height - HALF));
    if (y === chef.y) return y;
    const dir = y > chef.y ? 1 : -1;
    const lo = Math.min(chef.y, y) - HALF;
    const hi = Math.max(chef.y, y) + HALF;
    const n = this.collectSolidBoxes(chef.x - HALF, lo, chef.x + HALF, hi);
    const buf = this.boxBuf;
    for (let k = 0; k < n; k += 2) {
      const by = buf[k + 1];
      if (dir > 0) {
        if (chef.y + HALF > by) continue;
        if (y + HALF > by) y = by - HALF;
      } else {
        if (chef.y - HALF < by + 1) continue;
        if (y - HALF < by + 1) y = by + 1 + HALF;
      }
    }
    return y;
  }

  /** True when a chef standing here is on the grid and clear of every solid box: static
   *  tiles and slider tiles at their current offset. The pushes below pick their landing
   *  spots with this, so no shove can hand a chef to a wall. */
  private chefFits(x: number, y: number): boolean {
    const st = this.state;
    if (x < HALF - EPS || y < HALF - EPS) return false;
    if (x > st.width - HALF + EPS || y > st.height - HALF + EPS) return false;
    return this.collectSolidBoxes(x - HALF, y - HALF, x + HALF, y + HALF) === 0;
  }

  /** True when the chef box here is on the grid and clear of the static grid, closed gates
   *  included. Sliders are ignored: a chef may end up under a passing slider, never inside a
   *  counter. */
  private clearOfWalls(x: number, y: number): boolean {
    const st = this.state;
    if (x < HALF - EPS || y < HALF - EPS) return false;
    if (x > st.width - HALF + EPS || y > st.height - HALF + EPS) return false;
    const x0 = Math.max(0, Math.floor(x - HALF + EPS));
    const x1 = Math.min(st.width - 1, Math.floor(x + HALF - EPS));
    const y0 = Math.max(0, Math.floor(y - HALF + EPS));
    const y1 = Math.min(st.height - 1, Math.floor(y + HALF - EPS));
    for (let ty = y0; ty <= y1; ty++) {
      const row = ty * st.width;
      for (let tx = x0; tx <= x1; tx++) if (this.staticSolid[row + tx]) return false;
    }
    return true;
  }

  /** Moves the chef along one axis when the spot is clear and within a step's push budget of
   *  (fromX, fromY), which is where the chef stood before this push started. */
  private tryMoveX(chef: Chef, x: number, fromX: number, fromY: number): boolean {
    if (Math.hypot(x - fromX, chef.y - fromY) > MAX_PUSH_ESCAPE) return false;
    if (!this.chefFits(x, chef.y)) return false;
    chef.x = x;
    return true;
  }

  private tryMoveY(chef: Chef, y: number, fromX: number, fromY: number): boolean {
    if (Math.hypot(chef.x - fromX, y - fromY) > MAX_PUSH_ESCAPE) return false;
    if (!this.chefFits(chef.x, y)) return false;
    chef.y = y;
    return true;
  }

  /** Shoves a chef out of any solid tile it ended up inside, along the shallowest axis.
   *  Runs after pedestrian and slider pushes so nothing can shove a chef into a wall. */
  private pushOutOfTiles(chef: Chef): void {
    const st = this.state;
    for (let iter = 0; iter < 2; iter++) {
      const n = this.collectSolidBoxes(chef.x - HALF, chef.y - HALF, chef.x + HALF, chef.y + HALF);
      if (n === 0) break;
      const buf = this.boxBuf;
      let bestPen = 0;
      let px = 0;
      let py = 0;
      for (let k = 0; k < n; k += 2) {
        const bx = buf[k];
        const by = buf[k + 1];
        const penL = chef.x + HALF - bx;
        const penR = bx + 1 - (chef.x - HALF);
        const penU = chef.y + HALF - by;
        const penD = by + 1 - (chef.y - HALF);
        if (penL <= 0 || penR <= 0 || penU <= 0 || penD <= 0) continue;
        const mx = penL < penR ? -penL : penR;
        const my = penU < penD ? -penU : penD;
        const ax = Math.abs(mx);
        const ay = Math.abs(my);
        const pen = ax <= ay ? ax : ay;
        if (pen > bestPen) {
          bestPen = pen;
          px = ax <= ay ? mx : 0;
          py = ax <= ay ? 0 : my;
        }
      }
      if (bestPen <= 0) break;
      chef.x += px;
      chef.y += py;
    }
    chef.x = clamp(chef.x, HALF, Math.max(HALF, st.width - HALF));
    chef.y = clamp(chef.y, HALF, Math.max(HALF, st.height - HALF));
  }

  /** A dashing chef that runs into another shoves it along the dash and knocks its item
   *  loose onto the floor (wiki Dash). Each dash bumps a given chef once. */
  private dashBump(dasher: Chef, idx: number, events: SimEvent[]): void {
    const st = this.state;
    const minDist = CHEF_RADIUS * 2;
    const v = FACING_VECTORS[dasher.facing];
    for (let b = 0; b < st.chefs.length; b++) {
      if (b === idx) continue;
      const other = st.chefs[b];
      if (isFalling(other)) continue;
      if (Math.hypot(other.x - dasher.x, other.y - dasher.y) >= minDist) continue;
      if (this.bumpedAt[idx][b] === this.dashCount[idx]) continue;
      this.bumpedAt[idx][b] = this.dashCount[idx];
      if (v.dx !== 0) other.x = this.resolveX(other, other.x + v.dx * DASH_BUMP_PUSH);
      if (v.dy !== 0) other.y = this.resolveY(other, other.y + v.dy * DASH_BUMP_PUSH);
      if (isTray(other.holding)) this.wobbleTray(other, events);
      else if (other.holding) this.dropLoose(other, events);
      events.push({ type: 'dashBump', chef: idx, x: Math.floor(other.x), y: Math.floor(other.y), value: b });
    }
  }

  /** A bumped tray carrier keeps the tray: the first bump starts the wobble window, a second
   *  bump inside it knocks the top item onto the floor (docs/MECHANICS.md section 3). */
  private wobbleTray(chef: Chef, events: SimEvent[]): void {
    const tray = chef.holding;
    if (!isTray(tray)) return;
    if (chef.wobble === undefined) {
      chef.wobble = TRAY_WOBBLE_SEC;
      events.push({ type: 'trayWobble', chef: chef.index, x: Math.floor(chef.x), y: Math.floor(chef.y) });
      return;
    }
    delete chef.wobble;
    const top = tray.items.pop();
    if (!top) return;
    const tx = Math.floor(chef.x);
    const ty = Math.floor(chef.y);
    const landed = this.landOnFloor(top, tx, ty);
    events.push({ type: 'drop', chef: chef.index, x: landed ? landed.x : tx, y: landed ? landed.y : ty });
  }

  /** What a bumped chef held lands on the floor under it, or the nearest free floor, or is lost. */
  private dropLoose(chef: Chef, events: SimEvent[]): void {
    const item = chef.holding;
    if (!item) return;
    chef.holding = null;
    const tx = Math.floor(chef.x);
    const ty = Math.floor(chef.y);
    const landed = this.landOnFloor(item, tx, ty);
    events.push({ type: 'drop', chef: chef.index, x: landed ? landed.x : tx, y: landed ? landed.y : ty });
  }

  /** A chef whose centre is over a gap falls in: what it held is gone, and it is out for
   *  FALL_PENALTY_SEC before coming back at its spawn. */
  private checkFalls(events: SimEvent[]): void {
    const st = this.state;
    for (const chef of st.chefs) {
      if (isFalling(chef)) continue;
      const tile = this.tileAt(Math.floor(chef.x), Math.floor(chef.y));
      if (!tile || tile.type !== 'gap') continue;
      if (isTray(chef.holding)) this.returnTray(chef.holding); // the one tray goes back to its rack, if free
      chef.holding = null;
      chef.respawnIn = FALL_PENALTY_SEC;
      chef.action = 'falling';
      chef.actionProgress = 0;
      delete chef.dashTimeLeft;
      delete chef.windupLeft;
      delete chef.wobble;
      this.windups[chef.index] = null;
      events.push({ type: 'chefFell', chef: chef.index, x: tile.x, y: tile.y });
    }
  }

  /** A tray lost in a hole reappears on the first empty tray rack; with none free it is gone. */
  private returnTray(tray: TrayItem): void {
    for (const i of this.trayRackTiles) {
      if (this.state.tileItems[i]) continue;
      this.state.tileItems[i] = tray;
      return;
    }
  }

  private separateChefs(): void {
    const chefs = this.state.chefs;
    const minDist = CHEF_RADIUS * 2;
    for (let a = 0; a < chefs.length; a++) {
      for (let b = a + 1; b < chefs.length; b++) {
        const ca = chefs[a];
        const cb = chefs[b];
        if (isFalling(ca) || isFalling(cb)) continue; // a chef in the hole is not in the way
        let dx = cb.x - ca.x;
        let dy = cb.y - ca.y;
        let d = Math.hypot(dx, dy);
        if (d >= minDist) continue;
        if (d < DEGENERATE) { dx = 1; dy = 0; d = 1; }
        const push = (minDist - d) / d / 2; // both chefs give way equally
        ca.x -= dx * push;
        ca.y -= dy * push;
        cb.x += dx * push;
        cb.y += dy * push;
      }
    }
  }

  private pushChefsFromPedestrians(): void {
    const minDist = CHEF_RADIUS * 2;
    for (const chef of this.state.chefs) {
      if (isFalling(chef)) continue;
      for (const p of this.state.pedestrians) {
        let dx = chef.x - p.x;
        let dy = chef.y - p.y;
        const d = Math.hypot(dx, dy);
        if (d >= minDist) continue;
        if (d < DEGENERATE) {
          // Walked right onto the chef: step back along the walker's heading, or to the right
          // when it is standing still, so the nudge stays small and deterministic.
          const len = Math.hypot(p.vx, p.vy);
          dx = len > DEGENERATE ? -p.vx / len : 1;
          dy = len > DEGENERATE ? -p.vy / len : 0;
        } else {
          dx /= d;
          dy /= d;
        }
        const push = minDist - d; // unit direction × how deep the overlap is; never more than minDist
        // One axis at a time, the same sweep walking uses: a blocked axis costs the chef that
        // part of the push and nothing more, so a shove along a wall still slides it clear and
        // a shove into a wall leaves the pedestrian overlapping instead of the chef in a counter.
        const wasX = chef.x;
        const wasY = chef.y;
        if (dx !== 0) chef.x = this.resolveX(chef, chef.x + dx * push);
        if (dy !== 0) chef.y = this.resolveY(chef, chef.y + dy * push);
        const rest = push - Math.hypot(chef.x - wasX, chef.y - wasY);
        if (rest <= EPS) continue;
        // The wall ate the push: step aside across the walker, whichever side is open.
        const sx = -dy * rest;
        const sy = dx * rest;
        if (this.chefFits(chef.x + sx, chef.y + sy)) {
          chef.x += sx;
          chef.y += sy;
        } else if (this.chefFits(chef.x - sx, chef.y - sy)) {
          chef.x -= sx;
          chef.y -= sy;
        }
      }
    }
  }

  private pushChefsFromSliders(): void {
    for (const chef of this.state.chefs) {
      if (isFalling(chef)) continue;
      const fromX = chef.x;
      const fromY = chef.y;
      for (const s of this.sliderTiles) {
        const g = this.groupOffset(s.group);
        const bx = s.x + (g ? g.offsetX : 0);
        const by = s.y + (g ? g.offsetY : 0);
        if (chef.x + HALF <= bx + EPS || chef.x - HALF >= bx + 1 - EPS) continue;
        if (chef.y + HALF <= by + EPS || chef.y - HALF >= by + 1 - EPS) continue;
        const spec = this.specForGroup(s.group);
        this.escapeBox(chef, bx, by, !spec || spec.axis === 'x', fromX, fromY);
      }
    }
  }

  /** A gate that just closed under a chef shoves it off, the same way a slider does. The
   *  preferred axis is the one with the shallower overlap, so the chef leaves by the near edge. */
  private pushChefsFromGates(): void {
    if (!this.state.gates) return;
    for (const chef of this.state.chefs) {
      if (isFalling(chef)) continue;
      const fromX = chef.x;
      const fromY = chef.y;
      for (const g of this.gateTiles) {
        if (this.gateOpen(g.group)) continue;
        const penX = Math.min(chef.x + HALF - g.x, g.x + 1 - (chef.x - HALF));
        const penY = Math.min(chef.y + HALF - g.y, g.y + 1 - (chef.y - HALF));
        if (penX <= EPS || penY <= EPS) continue;
        this.escapeBox(chef, g.x, g.y, penX <= penY, fromX, fromY);
      }
    }
  }

  /** Gets a chef out of a solid box that moved or closed over it (a slider sweeping past, a
   *  gate shutting). First choice is the near side along `alongX`; when that side is a wall,
   *  the grid edge or another solid, the chef is squeezed out across it instead (shorter way
   *  first) and only then rides out on the far side. Every candidate clears this box, so the
   *  chef never ends up in a counter, and none of them moves the chef more than
   *  MAX_PUSH_ESCAPE from where it started the step. */
  private escapeBox(chef: Chef, bx: number, by: number, alongX: boolean, fromX: number, fromY: number): void {
    // Ways out along the preferred axis, then sideways across it; nearest of each pair first.
    const aBase = alongX ? bx : by;
    const aPos = alongX ? chef.x : chef.y;
    const aLow = aPos - (aBase - HALF) <= aBase + 1 + HALF - aPos;
    const aNear = aLow ? aBase - HALF : aBase + 1 + HALF;
    const aFar = aLow ? aBase + 1 + HALF : aBase - HALF;
    const cBase = alongX ? by : bx;
    const cPos = alongX ? chef.y : chef.x;
    const cLow = cPos - (cBase - HALF) <= cBase + 1 + HALF - cPos;
    const cNear = cLow ? cBase - HALF : cBase + 1 + HALF;
    const cFar = cLow ? cBase + 1 + HALF : cBase - HALF;

    if (alongX) {
      if (this.tryMoveX(chef, aNear, fromX, fromY)) return; // shoved along the slider's travel
      if (this.tryMoveY(chef, cNear, fromX, fromY)) return; // squeezed out sideways
      if (this.tryMoveY(chef, cFar, fromX, fromY)) return;
      if (this.tryMoveX(chef, aFar, fromX, fromY)) return;  // rides out on the far side
    } else {
      if (this.tryMoveY(chef, aNear, fromX, fromY)) return;
      if (this.tryMoveX(chef, cNear, fromX, fromY)) return;
      if (this.tryMoveX(chef, cFar, fromX, fromY)) return;
      if (this.tryMoveY(chef, aFar, fromX, fromY)) return;
    }
    // Boxed in: leave the box the way that is not a wall, and if both are, stay put and let
    // the box sit over the chef. Standing in a counter is the one outcome ruled out.
    if (this.rideOut(chef, alongX, aFar, fromX, fromY)) return;
    this.rideOut(chef, alongX, aNear, fromX, fromY);
  }

  /** Last resort for a boxed-in chef: clears the box even though something else is in the
   *  way, as long as that spot is no wall and stays inside the step's push budget. */
  private rideOut(chef: Chef, alongX: boolean, value: number, fromX: number, fromY: number): boolean {
    const x = alongX ? value : chef.x;
    const y = alongX ? chef.y : value;
    if (Math.hypot(x - fromX, y - fromY) > MAX_PUSH_ESCAPE) return false;
    if (!this.clearOfWalls(x, y)) return false;
    chef.x = x;
    chef.y = y;
    return true;
  }

  // ─── Chef actions ─────────────────────────────────────────────────────────
  private updateChefActions(chef: Chef, idx: number, inp: PlayerInput, dt: number, events: SimEvent[]): void {
    if (isFalling(chef) || chef.windupLeft !== undefined) return; // a wind-up commits the hands
    // Spraying needs no target tile and leaves the chef free to walk.
    if (chef.holding && chef.holding.kind === 'extinguisher' && inp.interactHeld) {
      this.spray(chef, idx, dt, events);
    }
    if (inp.throwPressed === true && isThrowable(chef.holding)) this.throwItem(chef, idx, events);
    const target = this.getTargetTile(idx);
    if (!target) return;
    if (this.fireAt(target.x, target.y)) return; // burning tiles refuse everything but spray
    if (inp.pickupPressed) this.handlePickup(chef, idx, target.x, target.y, events);
    if (inp.interactPressed) this.handleTrayInteract(chef, idx, target.x, target.y);
    if (!chef.holding && inp.interactHeld) this.handleWork(chef, idx, target.x, target.y, dt, events);
  }

  // ─── The tray ─────────────────────────────────────────────────────────────
  /** The work button on the tray: with empty hands facing a tray it starts the lift whatever the
   *  load; holding the tray and facing an empty counter it starts the set-down. */
  private handleTrayInteract(chef: Chef, idx: number, tx: number, ty: number): void {
    if (!this.settings.tray) return;
    const st = this.state;
    const i = ty * st.width + tx;
    const item = st.tileItems[i];
    if (!chef.holding) {
      if (isTray(item)) this.startWindup(chef, idx, 'lift', i, item);
      return;
    }
    if (isTray(chef.holding) && !item && this.canPlaceOn(st.tiles[i].type)) {
      this.startWindup(chef, idx, 'set', i, chef.holding);
    }
  }

  private startWindup(chef: Chef, idx: number, kind: Windup['kind'], tile: number, tray: TrayItem): void {
    if (chef.windupLeft !== undefined) return;
    chef.windupLeft = TRAY_WINDUP_SEC;
    chef.action = 'lifting';
    chef.actionProgress = 0;
    this.windups[idx] = { kind, tile, trayId: tray.id };
  }

  /** The wind-up ran out: lift the tray if it is still there and the hands are still free, or
   *  set it down if the tile is still an empty counter. Anything else and nothing happens. */
  private finishWindup(chef: Chef, idx: number, events: SimEvent[]): void {
    const pending = this.windups[idx];
    this.windups[idx] = null;
    if (!pending) return;
    const st = this.state;
    const tile = st.tiles[pending.tile];
    const item = st.tileItems[pending.tile];
    if (pending.kind === 'lift') {
      if (chef.holding || !isTray(item) || item.id !== pending.trayId) return;
      st.tileItems[pending.tile] = null;
      chef.holding = item;
      events.push({ type: 'trayLift', chef: idx, x: tile.x, y: tile.y });
      return;
    }
    const tray = chef.holding;
    if (!isTray(tray) || tray.id !== pending.trayId || item || !this.canPlaceOn(tile.type)) return;
    st.tileItems[pending.tile] = tray;
    chef.holding = null;
    events.push({ type: 'traySet', chef: idx, x: tile.x, y: tile.y });
  }

  /** The pick-up button while carrying the tray: load from a crate or off a tile, else offer the
   *  top item to the tile as if held (a counter or board takes it, a pot an accepted ingredient,
   *  a plate a ready part, the serve a dish, the bin anything, a rack a clean plate). An empty
   *  tray facing an empty counter starts the set-down. Never a tray on a tray. */
  private handleTrayPickup(chef: Chef, tray: TrayItem, idx: number, i: number, tx: number, ty: number, events: SimEvent[]): void {
    const st = this.state;
    const tile = st.tiles[i];
    const item = st.tileItems[i];
    const room = tray.items.length < TRAY_CAPACITY;
    if (tile.type === 'crate') {
      if (!room) return;
      const taken = this.takeFromCrate(tile, idx, events);
      if (!taken) return;
      tray.items.push(taken);
      events.push({ type: 'pickup', chef: idx, x: tx, y: ty });
      return;
    }
    if (isTray(item)) return;
    if (item && isTrayLoadable(item) && room && !this.fireAt(tx, ty)) {
      if (item.kind === 'plate' && (item.count ?? 1) > 1) {
        item.count = (item.count ?? 1) - 1; // one clean plate off the stack
        tray.items.push(this.newPlate());
      } else {
        tray.items.push(item);
        st.tileItems[i] = null;
      }
      events.push({ type: 'pickup', chef: idx, x: tx, y: ty });
      return;
    }
    if (tray.items.length > 0) {
      const top = tray.items[tray.items.length - 1];
      chef.holding = top;
      this.offering = true;
      this.handlePickup(chef, idx, tx, ty, events);
      this.offering = false;
      if (chef.holding === null) tray.items.pop(); // the tile took it
      chef.holding = tray;
      return;
    }
    if (!item && this.canPlaceOn(tile.type)) this.startWindup(chef, idx, 'set', i, tray);
  }

  private spray(chef: Chef, idx: number, dt: number, events: SimEvent[]): void {
    const st = this.state;
    chef.action = 'extinguishing';
    const v = FACING_VECTORS[chef.facing];
    for (let i = st.fires.length - 1; i >= 0; i--) {
      const f = st.fires[i];
      const rx = f.x + 0.5 - chef.x;
      const ry = f.y + 0.5 - chef.y;
      const along = rx * v.dx + ry * v.dy;
      if (along <= 0 || along > SPRAY_RANGE) continue;
      const lateral = Math.abs(rx * -v.dy + ry * v.dx);
      if (lateral > SPRAY_LATERAL_TOLERANCE) continue;
      f.health -= EXTINGUISH_RATE * dt;
      if (f.health <= 0) {
        st.fires.splice(i, 1);
        events.push({ type: 'fireOut', chef: idx, x: f.x, y: f.y });
      }
    }
    if (st.elapsed - this.sprayTickAt[idx] >= TICK_INTERVAL) {
      this.sprayTickAt[idx] = st.elapsed;
      events.push({ type: 'spray', chef: idx, x: chef.x, y: chef.y });
    }
  }

  // ─── Throwing ─────────────────────────────────────────────────────────────
  /** The held ingredient leaves along the chef's facing. A throw inside DASH_THROW_WINDOW of
   *  a dash flies DASH_THROW_BONUS times as far (wiki Dash). */
  private throwItem(chef: Chef, idx: number, events: SimEvent[]): void {
    const item = chef.holding;
    if (!isThrowable(item)) return;
    const v = FACING_VECTORS[chef.facing];
    const afterDash = chef.dashCooldown !== undefined && chef.dashCooldown > DASH_COOLDOWN - DASH_THROW_WINDOW;
    const flight: FlyingItem = {
      id: this.nextFlightId++,
      item,
      x: chef.x + v.dx * HALF,
      y: chef.y + v.dy * HALF,
      vx: v.dx * THROW_SPEED,
      vy: v.dy * THROW_SPEED,
      thrower: idx,
      rangeLeft: THROW_RANGE * (afterDash ? DASH_THROW_BONUS : 1),
      flown: 0,
      floorX: Math.floor(chef.x),
      floorY: Math.floor(chef.y),
    };
    chef.holding = null;
    (this.state.flying ??= []).push(flight);
    events.push({ type: 'throw', chef: idx, x: flight.floorX, y: flight.floorY, value: flight.id });
  }

  /** Flies every thrown item: it is caught by a chef with free hands, stops at the first
   *  station it reaches (into an accepting pot or pan, onto a free counter or board, into
   *  the bin, or it drops in front of anything else), crosses holes and closed gates, and
   *  falls where its range runs out. */
  private updateFlying(dt: number, events: SimEvent[]): void {
    const list = this.state.flying;
    if (!list || list.length === 0) return;
    for (let i = list.length - 1; i >= 0; i--) {
      const f = list[i];
      const step = Math.min(THROW_SPEED * dt, f.rangeLeft);
      f.x += (f.vx / THROW_SPEED) * step;
      f.y += (f.vy / THROW_SPEED) * step;
      f.flown += step;
      f.rangeLeft -= step;
      if (this.resolveFlight(f, events) || this.catchFlight(f, events)) {
        list.splice(i, 1);
        continue;
      }
      if (f.rangeLeft <= 0) {
        this.endFlight(f, Math.floor(f.x), Math.floor(f.y), events);
        list.splice(i, 1);
      }
    }
  }

  /** The tile the item is over now. Returns true when the flight ended there. */
  private resolveFlight(f: FlyingItem, events: SimEvent[]): boolean {
    const st = this.state;
    const tx = Math.floor(f.x);
    const ty = Math.floor(f.y);
    if (tx < 0 || ty < 0 || tx >= st.width || ty >= st.height) {
      this.endFlight(f, f.floorX, f.floorY, events); // the grid edge is a wall
      return true;
    }
    // A slider is a counter that moves: hit-test it where it is, but its item lives on its base tile.
    for (const s of this.sliderTiles) {
      const g = this.groupOffset(s.group);
      const bx = s.x + (g ? g.offsetX : 0);
      const by = s.y + (g ? g.offsetY : 0);
      if (f.x >= bx && f.x < bx + 1 && f.y >= by && f.y < by + 1) {
        this.landOnStation(f, s.y * st.width + s.x, events);
        return true;
      }
    }
    const index = ty * st.width + tx;
    const tile = st.tiles[index];
    if (tile.type === 'gate' && !this.gateOpen(tile.group ?? '')) return false; // closed: fly over
    if (isFlyOver(tile.type) && tile.type !== 'gate') return false;             // a hole: fly over
    if (isLandingFloor(tile.type)) {
      f.floorX = tx;
      f.floorY = ty;
      return false;
    }
    this.landOnStation(f, index, events);
    return true;
  }

  /** The item reached a station tile: into an accepting pot or pan, onto a free counter or
   *  board, into the bin, otherwise it drops on the floor it came from. */
  private landOnStation(f: FlyingItem, index: number, events: SimEvent[]): void {
    const st = this.state;
    const tile = st.tiles[index];
    const resting = st.tileItems[index];
    const item = f.item;
    if (tile.type === 'shelf') { // a hatch in a wall: the wall above it stops the throw, open or not
      this.endFlight(f, f.floorX, f.floorY, events);
      return;
    }
    if (tile.type === 'trash') {
      events.push({ type: 'throwLand', chef: f.thrower, x: tile.x, y: tile.y, value: f.id });
      events.push({ type: 'trash', chef: f.thrower, x: tile.x, y: tile.y });
      return;
    }
    if (item.kind === 'ingredient' && resting && resting.kind === 'pot' && !this.fireAt(tile.x, tile.y)
        && resting.state !== 'burnt' && resting.contents.length < wareCapacity(resting) && wareAccepts(resting, item)) {
      const before = resting.contents.length;
      resting.contents.push(item.type);
      if (before > 0 && resting.cookProgress > 0) resting.cookProgress *= before / resting.contents.length;
      if (resting.state === 'cooked') { resting.state = 'cooking'; resting.burnProgress = 0; }
      events.push({ type: 'throwLand', chef: f.thrower, x: tile.x, y: tile.y, value: f.id });
      events.push({ type: 'potAdd', chef: f.thrower, x: tile.x, y: tile.y });
      return;
    }
    if (!resting && (this.canPlaceOn(tile.type) || tile.type === 'board') && !this.fireAt(tile.x, tile.y)) {
      st.tileItems[index] = item;
      events.push({ type: 'throwLand', chef: f.thrower, x: tile.x, y: tile.y, value: f.id });
      return;
    }
    this.endFlight(f, f.floorX, f.floorY, events); // a wall, or a station that will not take it
  }

  /** A chef with free hands within CATCH_RADIUS takes the item out of the air. The thrower
   *  only gets it back once it has flown THROW_OWN_CATCH_DISTANCE. */
  private catchFlight(f: FlyingItem, events: SimEvent[]): boolean {
    for (const chef of this.state.chefs) {
      if (chef.holding || isFalling(chef)) continue;
      if (chef.index === f.thrower && f.flown < THROW_OWN_CATCH_DISTANCE) continue;
      if (Math.hypot(chef.x - f.x, chef.y - f.y) >= CATCH_RADIUS) continue;
      chef.holding = f.item;
      events.push({ type: 'catch', chef: chef.index, x: Math.floor(f.x), y: Math.floor(f.y), value: f.id });
      return true;
    }
    return false;
  }

  /** The flight is over at (tx, ty): the item lands on that floor tile or the nearest free
   *  one, or is lost over a hole, a closed gate or a full floor. */
  private endFlight(f: FlyingItem, tx: number, ty: number, events: SimEvent[]): void {
    const tile = this.tileAt(tx, ty);
    const overHole = !tile || !isLandingFloor(tile.type) || (tile.type === 'gate' && !this.gateOpen(tile.group ?? ''));
    const landed = overHole ? null : this.landOnFloor(f.item, tx, ty);
    events.push({ type: 'throwLand', chef: f.thrower, x: landed ? landed.x : tx, y: landed ? landed.y : ty, value: f.id });
  }

  /** Puts an item down on floor tile (tx, ty) if it is free, else on the first free floor
   *  neighbour. Returns where it landed, or null when it is lost. */
  private landOnFloor(item: Item, tx: number, ty: number): { x: number; y: number } | null {
    const st = this.state;
    const canRest = (x: number, y: number): boolean => {
      const tile = this.tileAt(x, y);
      if (!tile || !isLandingFloor(tile.type) || st.tileItems[y * st.width + x]) return false;
      return tile.type !== 'gate' || this.gateOpen(tile.group ?? '');
    };
    if (canRest(tx, ty)) {
      st.tileItems[ty * st.width + tx] = item;
      return { x: tx, y: ty };
    }
    for (const n of NEIGHBOURS) {
      const nx = tx + n.dx;
      const ny = ty + n.dy;
      if (!canRest(nx, ny)) continue;
      st.tileItems[ny * st.width + nx] = item;
      return { x: nx, y: ny };
    }
    return null;
  }

  /** Held interact with empty hands: chop on a board, wash at a sink. */
  private handleWork(chef: Chef, idx: number, tx: number, ty: number, dt: number, events: SimEvent[]): void {
    const st = this.state;
    const i = ty * st.width + tx;
    const tile = st.tiles[i];
    const item = st.tileItems[i];

    // wiki (Chopping Board): buns and tortillas are on the no-chop list, so a board holding
    // one just holds it.
    if (tile.type === 'board' && item && item.kind === 'ingredient' && !item.chopped
        && CHOPPED_INGREDIENTS.includes(item.type)) {
      if (!this.handsCount(chef, i)) return; // one chef per board, or two with chop assist
      const chopTime = this.settings.chopTime;
      const before = item.chopProgress;
      const after = Math.min(1, before + dt / chopTime);
      item.chopProgress = after; // progress lives on the item, so it survives letting go
      chef.action = 'chopping';
      chef.actionProgress = after;
      if (Math.floor(after * chopTime * TICK_EVENT_HZ) > Math.floor(before * chopTime * TICK_EVENT_HZ)) {
        events.push({ type: 'chopTick', chef: idx, x: tx, y: ty });
      }
      if (after >= 1) {
        item.chopped = true;
        chef.action = 'idle';
        chef.actionProgress = 0;
        events.push({ type: 'chopDone', chef: idx, x: tx, y: ty });
      }
      return;
    }

    if (tile.type === 'delivery' && this.settings.eightySix) {
      const restock = this.deliveryDue();
      if (!restock || !this.handsCount(chef, i)) return;
      const before = restock.unloaded;
      const after = Math.min(1, before + dt / RESTOCK_UNLOAD_SEC);
      restock.unloaded = after; // progress lives on the delivery, so a second chef adds to it
      chef.action = 'unloading';
      chef.actionProgress = after;
      if (Math.floor(after * RESTOCK_UNLOAD_SEC * TICK_EVENT_HZ) > Math.floor(before * RESTOCK_UNLOAD_SEC * TICK_EVENT_HZ)) {
        events.push({ type: 'restockTick', chef: idx, x: tx, y: ty });
      }
      if (after >= 1) {
        chef.action = 'idle';
        chef.actionProgress = 0;
        this.applyRestock(restock, tx, ty, events);
      }
      return;
    }

    if (tile.type === 'sink' && item && item.kind === 'dirtyPlate' && item.count > 0) {
      const washTime = this.settings.washTime;
      const before = this.prevActions[idx] === 'washing' ? this.prevProgress[idx] : 0;
      const after = before + dt / washTime;
      chef.action = 'washing';
      chef.actionProgress = Math.min(after, 1);
      if (Math.floor(Math.min(after, 1) * washTime * TICK_EVENT_HZ) > Math.floor(before * washTime * TICK_EVENT_HZ)) {
        events.push({ type: 'washTick', chef: idx, x: tx, y: ty });
      }
      if (after >= 1) {
        chef.actionProgress = 0; // straight on to the next plate in the stack
        item.count -= 1;
        events.push({ type: 'washDone', chef: idx, x: tx, y: ty });
        this.deliverCleanPlate(i, tx, ty);
      }
    }
  }

  /** One plate finished at the sink on tile index `i`: it goes to an adjacent drying rack, or
   *  waits and lands on the sink itself once the dirty stack is gone. */
  private deliverCleanPlate(i: number, sx: number, sy: number): void {
    const st = this.state;
    const dry = this.adjacentDrying(sx, sy);
    if (dry >= 0) {
      const cur = st.tileItems[dry];
      if (!cur) st.tileItems[dry] = this.newPlate();
      else if (cur.kind === 'plate' && cur.dish === null) cur.count = (cur.count ?? 1) + 1;
      // else the rack is blocked by something else and the plate is lost
    } else {
      this.sinkClean[i] = (this.sinkClean[i] ?? 0) + 1;
    }
    const stack = st.tileItems[i];
    if (stack && stack.kind === 'dirtyPlate' && stack.count <= 0) {
      const waiting = this.sinkClean[i] ?? 0;
      delete this.sinkClean[i];
      st.tileItems[i] = waiting > 0 ? this.newPlate(waiting) : null;
    }
  }

  /** True when some orthogonally adjacent tile is walkable, so a chef can reach this one.
   *  Sliders count as solid: they move, so nothing may depend on standing in their lane. */
  private hasWalkableNeighbour(tile: Tile): boolean {
    const st = this.state;
    for (const n of NEIGHBOURS) {
      const nx = tile.x + n.dx;
      const ny = tile.y + n.dy;
      if (nx < 0 || ny < 0 || nx >= st.width || ny >= st.height) continue;
      if (isWalkable(st.tiles[ny * st.width + nx].type)) return true;
    }
    return false;
  }

  private adjacentDrying(x: number, y: number): number {
    const st = this.state;
    for (const n of NEIGHBOURS) {
      const nx = x + n.dx;
      const ny = y + n.dy;
      if (nx < 0 || ny < 0 || nx >= st.width || ny >= st.height) continue;
      const i = ny * st.width + nx;
      if (st.tiles[i].type === 'drying') return i;
    }
    return -1;
  }

  // ─── Pick up / put down ───────────────────────────────────────────────────
  private handlePickup(chef: Chef, idx: number, tx: number, ty: number, events: SimEvent[]): void {
    const st = this.state;
    const i = ty * st.width + tx;
    const tile = st.tiles[i];
    const item = st.tileItems[i];
    const held = chef.holding;

    if (!held) {
      if (tile.type === 'crate') {
        const taken = this.takeFromCrate(tile, idx, events); // null when the 86 system has emptied it
        if (!taken) return;
        chef.holding = taken;
        events.push({ type: 'pickup', chef: idx, x: tx, y: ty });
        return;
      }
      if (!item) return;
      if (isTray(item)) { // the top item comes off; an empty tray is lifted
        const top = item.items.pop();
        if (top) {
          chef.holding = top;
          events.push({ type: 'pickup', chef: idx, x: tx, y: ty });
        } else if (this.settings.tray) {
          this.startWindup(chef, idx, 'lift', i, item);
        }
        return;
      }
      if (item.kind === 'plate' && (item.count ?? 1) > 1) {
        item.count = (item.count ?? 1) - 1; // take one plate off the stack
        chef.holding = this.newPlate();
      } else {
        chef.holding = item;
        st.tileItems[i] = null;
      }
      events.push({ type: 'pickup', chef: idx, x: tx, y: ty });
      return;
    }

    switch (held.kind) {
      case 'tray': {
        this.handleTrayPickup(chef, held, idx, i, tx, ty, events);
        return;
      }

      case 'ingredient': {
        if (tile.type === 'trash') {
          chef.holding = null;
          events.push({ type: 'trash', chef: idx, x: tx, y: ty });
          return;
        }
        if (item && item.kind === 'pot') {
          if (item.state === 'burnt' || item.contents.length >= wareCapacity(item)) return;
          if (!wareAccepts(item, held)) return;
          const before = item.contents.length;
          item.contents.push(held.type);
          // Keep the cooked fraction proportional when the pot gains an ingredient mid-cook.
          if (before > 0 && item.cookProgress > 0) item.cookProgress *= before / item.contents.length;
          // A finished soup that gains an ingredient is cooking again: the burn clock stops and resets.
          if (item.state === 'cooked') { item.state = 'cooking'; item.burnProgress = 0; }
          chef.holding = null;
          events.push({ type: 'potAdd', chef: idx, x: tx, y: ty });
          return;
        }
        // wiki (Plate): a plate resting on a sink refuses food.
        if (item && item.kind === 'plate' && tile.type !== 'sink') {
          if (!readyForPlate(held) || !this.addToPlate(item, held.type)) return;
          chef.holding = null;
          events.push({ type: 'plateAdd', chef: idx, x: tx, y: ty });
          return;
        }
        if (!item && (this.canPlaceOn(tile.type) || tile.type === 'board')) {
          this.place(chef, i, idx, tx, ty, events);
        }
        return;
      }

      case 'pot': {
        if (tile.type === 'trash') {
          if (held.contents.length > 0) {
            this.emptyPot(held); // the pot stays in hand, only the contents go
            events.push({ type: 'trash', chef: idx, x: tx, y: ty });
          }
          return;
        }
        // wiki (Plate): a plate resting on a sink refuses food, poured as well as plated.
        if (item && item.kind === 'plate' && tile.type !== 'sink'
            && held.state === 'cooked' && held.contents.length > 0) {
          this.emptyOnto(item, held, idx, tx, ty, events);
          return;
        }
        if (!item && (this.canPlaceOn(tile.type) || tile.type === 'stove')) {
          this.place(chef, i, idx, tx, ty, events);
        }
        return;
      }

      case 'plate': {
        if (tile.type === 'serve') {
          if (held.dish) this.serve(chef, idx, tx, ty, events);
          return;
        }
        if (tile.type === 'trash') {
          if (held.dish) {
            held.dish = null; // the plate survives, the food does not
            events.push({ type: 'trash', chef: idx, x: tx, y: ty });
          }
          return;
        }
        // wiki (3-2 Strategies): "you can use the plates to scoop up the food from the pot".
        if (item && item.kind === 'pot' && item.state === 'cooked' && item.contents.length > 0) {
          this.emptyOnto(held, item, idx, tx, ty, events);
          return;
        }
        // Burger assembly the other way round: the plate collects a prepped ingredient off a
        // counter or a board.
        if (item && item.kind === 'ingredient') {
          if (!this.canPlaceOn(tile.type) && tile.type !== 'board') return;
          if (!readyForPlate(item) || !this.addToPlate(held, item.type)) return;
          st.tileItems[i] = null;
          events.push({ type: 'plateAdd', chef: idx, x: tx, y: ty });
          return;
        }
        if (held.dish) {
          if (!item && this.canPlaceOn(tile.type)) this.place(chef, i, idx, tx, ty, events);
          return;
        }
        if (tile.type === 'plateStack' || tile.type === 'drying') {
          if (!item) this.placePlate(chef, held, i, idx, tx, ty, events);
          else if (item.kind === 'plate' && item.dish === null) this.stackAtRack(chef, held, item, i, idx, tx, ty, events);
          return;
        }
        if (!item && this.canPlaceOn(tile.type)) this.placePlate(chef, held, i, idx, tx, ty, events);
        return;
      }

      case 'dirtyPlate': {
        if (tile.type !== 'sink' && tile.type !== 'plateReturn' && !this.canPlaceOn(tile.type)) return;
        if (!item) this.place(chef, i, idx, tx, ty, events);
        else if (item.kind === 'dirtyPlate') {
          item.count += held.count;
          chef.holding = null;
          events.push({ type: 'drop', chef: idx, x: tx, y: ty });
        }
        return;
      }

      case 'extinguisher': {
        if (!item && this.canPlaceOn(tile.type)) this.place(chef, i, idx, tx, ty, events);
        return;
      }
    }
  }

  private place(chef: Chef, i: number, idx: number, tx: number, ty: number, events: SimEvent[]): void {
    this.state.tileItems[i] = chef.holding;
    chef.holding = null;
    events.push({ type: 'drop', chef: idx, x: tx, y: ty });
  }

  /** A clean plate goes down on an empty tile. Two-plate carry: the top plate of a held stack
   *  goes down first and the other stays in hand (docs/MECHANICS.md section 1). */
  private placePlate(chef: Chef, held: PlateItem, i: number, idx: number, tx: number, ty: number, events: SimEvent[]): void {
    const count = held.count ?? 1;
    if (count <= 1) {
      this.place(chef, i, idx, tx, ty, events);
      return;
    }
    this.state.tileItems[i] = this.newPlate();
    if (count - 1 > 1) held.count = count - 1;
    else delete held.count;
    events.push({ type: 'drop', chef: idx, x: tx, y: ty });
  }

  /** A held clean plate meets clean plates on a drying rack or plate stack. Two-plate carry on:
   *  one plate in hand takes a second off the rack, two in hand put one back. Off: the held
   *  plates join the rack's stack, as they always did. */
  private stackAtRack(chef: Chef, held: PlateItem, rack: PlateItem, i: number, idx: number, tx: number, ty: number, events: SimEvent[]): void {
    const st = this.state;
    const heldCount = held.count ?? 1;
    if (!this.settings.twoPlateCarry || this.offering) {
      rack.count = (rack.count ?? 1) + heldCount;
      chef.holding = null;
      events.push({ type: 'drop', chef: idx, x: tx, y: ty });
      return;
    }
    if (heldCount < TWO_PLATE_MAX) {
      if ((rack.count ?? 1) > 1) rack.count = (rack.count ?? 1) - 1;
      else st.tileItems[i] = null;
      held.count = heldCount + 1;
      events.push({ type: 'pickup', chef: idx, x: tx, y: ty });
      return;
    }
    rack.count = (rack.count ?? 1) + 1;
    if (heldCount - 1 > 1) held.count = heldCount - 1;
    else delete held.count;
    events.push({ type: 'drop', chef: idx, x: tx, y: ty });
  }

  // ─── The 86 system ────────────────────────────────────────────────────────
  /** A new ingredient out of a crate: always, when the crate has no stock; otherwise one off the
   *  count, null when the crate is empty or is keeping its last item because MAX_SIMULTANEOUS_86
   *  ingredients are already out. Emptying the crate posts the 86 and, when no crate of the
   *  ingredient is left with stock, runs the shortage. */
  private takeFromCrate(tile: Tile, idx: number, events: SimEvent[]): IngredientItem | null {
    const type = tile.ingredient ?? 'onion';
    if (tile.stock === undefined) return this.newIngredient(type);
    if (tile.stock <= 0) return null;
    if (tile.stock === 1 && this.outCount() >= MAX_SIMULTANEOUS_86) return null;
    tile.stock -= 1;
    const item = this.newIngredient(type);
    if (tile.stock === 0) {
      events.push({ type: 'crateEmpty', chef: idx, x: tile.x, y: tile.y });
      if (this.ingredientOut(type)) this.shortage(type, events);
    }
    return item;
  }

  /** An ingredient is out: every pending ticket that needs it is rewritten to the nearest recipe
   *  that does not (never voided; a ticket with no substitute is left as it is), and a delivery
   *  is queued. The first rewrite keeps the original recipe so a dish built for it still serves. */
  private shortage(type: IngredientType, events: SimEvent[]): void {
    const st = this.state;
    for (const order of st.orders) {
      const recipe = RECIPES[order.recipeId];
      if (!recipe || !recipe.ingredients.includes(type)) continue;
      const sub = this.substituteFor(recipe);
      if (!sub) continue;
      order.originalRecipeId ??= order.recipeId;
      order.recipeId = sub.id;
      order.rewrittenAt = st.elapsed;
      events.push({ type: 'orderRewritten', value: order.id });
    }
    (st.restocks ??= []).push({
      id: this.nextRestockId++,
      ingredient: type,
      arrivesIn: this.level.eightySix?.restockDelaySec ?? RESTOCK_DELAY_SEC,
      unloaded: 0,
    });
  }

  /** The level recipe that needs nothing that is out, preferring the same dish type, then the most
   *  shared ingredients (chopped stays chopped, cooked stays cooked), then the earliest in the list. */
  private substituteFor(recipe: Recipe): Recipe | null {
    const dish = recipeDishType(recipe);
    let best: Recipe | null = null;
    let bestSame = -1;
    let bestShared = -1;
    for (const id of this.level.recipes) {
      const r = RECIPES[id];
      if (!r || r.ingredients.some((ing) => this.ingredientOut(ing))) continue;
      const same = recipeDishType(r) === dish ? 1 : 0;
      const shared = sharedIngredients(r.ingredients, recipe.ingredients);
      if (same > bestSame || (same === bestSame && shared > bestShared)) {
        best = r;
        bestSame = same;
        bestShared = shared;
      }
    }
    return best;
  }

  /** The recipe a dish satisfies on this ticket: the current one, or the one it asked for before a
   *  shortage rewrote it (grandfathering), or null. */
  private recipeServed(dish: Dish, order: Order): Recipe | null {
    const current = RECIPES[order.recipeId];
    if (current && dishMatchesRecipe(dish, current)) return current;
    const original = order.originalRecipeId ? RECIPES[order.originalRecipeId] : undefined;
    if (original && dishMatchesRecipe(dish, original)) return original;
    return null;
  }

  /** Deliveries count down; one that arrives waits at the delivery door to be unloaded, or on a
   *  level without a door restocks by itself. */
  private updateRestocks(dt: number, events: SimEvent[]): void {
    const st = this.state;
    const list = st.restocks;
    if (!list || list.length === 0) return;
    for (let i = list.length - 1; i >= 0; i--) {
      const r = list[i];
      if (r.arrivesIn <= 0) continue; // waiting at the door
      r.arrivesIn -= dt;
      if (r.arrivesIn > 0) continue;
      r.arrivesIn = 0;
      if (this.deliveryTile >= 0) {
        const door = st.tiles[this.deliveryTile];
        events.push({ type: 'restockDue', x: door.x, y: door.y });
        continue;
      }
      const crate = this.firstCrateOf(r.ingredient);
      events.push({ type: 'restockDue', x: crate ? crate.x : 0, y: crate ? crate.y : 0 });
      this.applyRestock(r, crate ? crate.x : 0, crate ? crate.y : 0, events);
    }
  }

  /** Every crate of the delivery's ingredient is full again and the delivery is gone. */
  private applyRestock(restock: Restock, x: number, y: number, events: SimEvent[]): void {
    const st = this.state;
    for (const i of this.crateTiles) {
      const tile = st.tiles[i];
      if (tile.ingredient === restock.ingredient && tile.capacity !== undefined) tile.stock = tile.capacity;
    }
    const list = st.restocks;
    if (list) {
      const at = list.indexOf(restock);
      if (at >= 0) list.splice(at, 1);
    }
    events.push({ type: 'restocked', x, y });
  }

  /** Scripted shortages: at their second, every crate of the ingredient empties (a crate that had
   *  no stock gets the level's size so the delivery has something to refill). */
  private updateScripted(events: SimEvent[]): void {
    const scripted = this.level.eightySix?.scripted;
    if (!scripted || !this.settings.eightySix) return;
    const st = this.state;
    for (let k = 0; k < scripted.length; k++) {
      if (this.scriptedFired[k] || st.elapsed < scripted[k].atSec) continue;
      this.scriptedFired[k] = true;
      const type = scripted[k].ingredient;
      let emptied = false;
      for (const i of this.crateTiles) {
        const tile = st.tiles[i];
        if (tile.ingredient !== type) continue;
        tile.capacity ??= this.level.eightySix?.crateSize ?? CRATE_SIZE;
        if (tile.stock === 0) continue;
        tile.stock = 0;
        emptied = true;
        events.push({ type: 'crateEmpty', x: tile.x, y: tile.y });
      }
      if (emptied && this.ingredientOut(type)) this.shortage(type, events);
    }
  }

  private firstCrateOf(type: IngredientType): Tile | null {
    for (const i of this.crateTiles) if (this.state.tiles[i].ingredient === type) return this.state.tiles[i];
    return null;
  }

  /** Empties cooked cookware onto a plate: a pot pours a soup, a pan drops its patty on a
   *  plate that is empty or already holds burger parts. Refuses when the plate cannot take it,
   *  leaving both the plate and the cookware untouched. */
  private emptyOnto(plate: PlateItem, ware: PotItem, idx: number, tx: number, ty: number, events: SimEvent[]): void {
    if (wareOf(ware) === 'pan') {
      if (!this.addToPlate(plate, ware.contents[0])) return;
      this.emptyPot(ware);
      events.push({ type: 'plateAdd', chef: idx, x: tx, y: ty });
      return;
    }
    if (plate.dish !== null || (plate.count ?? 1) !== 1) return; // no soup on top of a burger
    plate.dish = { type: 'soup', ingredients: sortIngredients(ware.contents) };
    this.emptyPot(ware);
    events.push({ type: 'potPour', chef: idx, x: tx, y: ty });
  }

  /** Adds one component to a plate: a burger part (at most one of each) onto an empty or burger
   *  plate, a plated ingredient onto an empty or plated plate. Soup plates and plate stacks
   *  refuse everything. Returns false when nothing changed. */
  private addToPlate(plate: PlateItem, type: IngredientType): boolean {
    if ((plate.count ?? 1) !== 1) return false;
    const plated = isPlatedComponent(type);
    if (!plated && !isBurgerComponent(type)) return false;
    const dish = plate.dish;
    if (!dish) {
      plate.dish = { type: plated ? 'plated' : 'burger', ingredients: [type] };
      return true;
    }
    if (plated) {
      if (dish.type !== 'plated') return false;
    } else if (dish.type !== 'burger' || dish.ingredients.includes(type)) {
      return false;
    }
    dish.ingredients.push(type);
    dish.ingredients.sort(); // Dish.ingredients stays alphabetical, so recipe matching is a walk
    return true;
  }

  private emptyPot(pot: PotItem): void {
    pot.contents.length = 0;
    pot.state = 'empty';
    pot.cookProgress = 0;
    pot.burnProgress = 0;
  }

  // ─── Serving and scoring ──────────────────────────────────────────────────
  private serve(chef: Chef, idx: number, tx: number, ty: number, events: SimEvent[]): void {
    const st = this.state;
    const plate = chef.holding;
    if (!plate || plate.kind !== 'plate') return;
    const dish = plate.dish;
    chef.holding = null; // matched or not, the plate leaves the chef's hands

    let matched = -1;
    let recipe: Recipe | null = null;
    if (dish) {
      for (let i = 0; i < st.orders.length; i++) {
        recipe = this.recipeServed(dish, st.orders[i]); // the ticket, or what it asked for before a rewrite
        if (recipe) { matched = i; break; } // orders are oldest first
      }
    }
    if (matched >= 0) {
      // Combo rule (wiki: Combos): the tip streak only continues when the dish matches the
      // OLDEST live order. Serving a later ticket still scores, but breaks the streak.
      // Tip on an in-order serve is TIP_BASE per prior consecutive serve, so the first pays base only.
      st.orders.splice(matched, 1);
      const inOrder = matched === 0;
      const tip = inOrder ? Math.min(TIP_MAX, TIP_BASE * st.tipStreak) : 0;
      const points = (recipe ? recipe.score : 0) + tip;
      st.score += points;
      st.tipStreak = inOrder ? st.tipStreak + 1 : 0;
      st.servedCount += 1;
      this.recomputeStars();
      events.push({ type: 'serve', chef: idx, x: tx, y: ty, value: points });
    } else {
      st.tipStreak = 0; // an off-menu dish breaks the combo (wiki: Combos)
      events.push({ type: 'serveRejected', chef: idx, x: tx, y: ty, value: 0 });
    }

    st.pendingPlateReturns.push(
      this.level.plates.mode === 'stack' ? PLATE_STACK_RETURN_DELAY : PLATE_RETURN_DELAY,
    );
    if (st.phase === 'prep') { // the first serve, matched or not, starts the clock
      st.phase = 'running';
      st.timerRunning = true;
      events.push({ type: 'timerStart' });
    }
  }

  private recomputeStars(): void {
    const st = this.state;
    const thresholds = this.level.stars ? this.level.stars[st.chefs.length >= 2 ? 2 : 1] : undefined;
    if (!thresholds) { st.stars = 0; return; }
    let stars = 0;
    for (const t of thresholds) if (st.score >= t) stars += 1;
    st.stars = Math.min(3, stars);
  }

  // ─── Cooking and fire ─────────────────────────────────────────────────────
  private updateCooking(dt: number, events: SimEvent[]): void {
    const st = this.state;
    for (let i = 0; i < st.tileItems.length; i++) {
      const item = st.tileItems[i];
      if (!item || item.kind !== 'pot') continue;
      const tile = st.tiles[i];
      if (tile.type !== 'stove') continue; // pots off the stove hold their progress
      if (item.state === 'burnt' || item.contents.length === 0) continue;
      // wiki (Fire): "Any cooking device affected by tabletop fire cannot cook food until
      // the fire is extinguished." The burn clock stops with it, so a fire that reaches a
      // second stove cannot force a second burnt pot the chefs are not allowed to rescue.
      if (this.fireAt(tile.x, tile.y)) continue;

      if (item.cookProgress < 1) {
        if (item.state !== 'cooking') {
          item.state = 'cooking';
          events.push({ type: 'cookStart', x: tile.x, y: tile.y });
        }
        item.cookProgress += this.settings.instantCooking ? 1 : dt / wareCookTime(item, this.settings);
        if (item.cookProgress >= 1) {
          item.cookProgress = 1;
          item.state = 'cooked';
          events.push({ type: 'cookDone', x: tile.x, y: tile.y });
        }
        continue;
      }

      if (this.settings.noBurning) continue; // assist: cooked food waits on the stove for good
      item.burnProgress += dt / this.settings.burnTime;
      if (item.burnProgress >= 1) {
        item.burnProgress = 1;
        item.state = 'burnt';
        events.push({ type: 'burnt', x: tile.x, y: tile.y });
        if (this.startFire(tile.x, tile.y)) events.push({ type: 'fireStart', x: tile.x, y: tile.y });
      }
    }
  }

  private startFire(x: number, y: number): boolean {
    if (this.fireAt(x, y)) return false;
    this.state.fires.push({ x, y, health: 1, spreadTimer: FIRE_SPREAD_TIME });
    return true;
  }

  private updateFires(dt: number, events: SimEvent[]): void {
    const st = this.state;
    const count = st.fires.length; // a fire lit by this loop does not spread again this step
    for (let i = 0; i < count; i++) {
      const f = st.fires[i];
      f.spreadTimer = (f.spreadTimer ?? FIRE_SPREAD_TIME) - dt;
      if (f.spreadTimer > 0) continue;
      f.spreadTimer += FIRE_SPREAD_TIME;
      let n = 0;
      for (const nb of NEIGHBOURS) {
        const nx = f.x + nb.dx;
        const ny = f.y + nb.dy;
        if (nx < 0 || ny < 0 || nx >= st.width || ny >= st.height) continue;
        const j = ny * st.width + nx;
        const type = st.tiles[j].type;
        if (type === 'void' || !SOLID_TILES.has(type)) continue;
        if (this.fireAt(nx, ny)) continue;
        // No chef can stand next to this tile, so a fire on it could never be sprayed and
        // would re-light its neighbours for the rest of the level. Wall corners and the
        // backs of counter runs are the usual cases.
        if (!this.fightable[j]) continue;
        // A burning tile refuses every interaction, and spraying is the only way to put a
        // fire out, so a fire on the extinguisher's tile would leave the level unwinnable.
        const blocking = st.tileItems[j];
        if (blocking && blocking.kind === 'extinguisher') continue;
        this.spreadBuf[n++] = j;
      }
      if (n === 0) continue;
      const pick = st.tiles[this.spreadBuf[this.rng.int(n)]];
      st.fires.push({ x: pick.x, y: pick.y, health: 1, spreadTimer: FIRE_SPREAD_TIME });
      events.push({ type: 'fireSpread', x: pick.x, y: pick.y });
    }
  }

  // ─── Plates, orders, timer ────────────────────────────────────────────────
  private updatePlateReturns(dt: number, events: SimEvent[]): void {
    const st = this.state;
    for (let i = st.pendingPlateReturns.length - 1; i >= 0; i--) {
      st.pendingPlateReturns[i] -= dt;
      if (st.pendingPlateReturns[i] > 0) continue;
      st.pendingPlateReturns.splice(i, 1);
      if (this.level.plates.mode === 'stack') this.returnCleanPlate(events);
      else this.returnDirtyPlate(events);
    }
  }

  private returnDirtyPlate(events: SimEvent[]): void {
    const st = this.state;
    const i = this.plateReturnTiles[0];
    if (i === undefined) return;
    const cur = st.tileItems[i];
    if (!cur) st.tileItems[i] = this.newDirtyPlate(1);
    else if (cur.kind === 'dirtyPlate') cur.count += 1;
    else return; // the return slot is blocked by something else
    events.push({ type: 'plateReturned', x: st.tiles[i].x, y: st.tiles[i].y });
  }

  private returnCleanPlate(events: SimEvent[]): void {
    const st = this.state;
    const i = this.plateStackTiles[0];
    if (i === undefined) return;
    const cur = st.tileItems[i];
    if (!cur) st.tileItems[i] = this.newPlate();
    else if (cur.kind === 'plate' && cur.dish === null) cur.count = (cur.count ?? 1) + 1;
    else return;
    events.push({ type: 'plateReturned', x: st.tiles[i].x, y: st.tiles[i].y });
  }

  private spawnOrder(events: SimEvent[] | null): void {
    let list = this.level.recipes;
    if (!list.length) return;
    if (this.settings.eightySix) { // 86: no new ticket for something that is out, while there is a choice
      const available = list.filter((id) => {
        const r = RECIPES[id];
        return !r || !r.ingredients.some((ing) => this.ingredientOut(ing));
      });
      if (available.length > 0) list = available;
    }
    const cfg = this.settings.orders;
    // A pinned first ticket (orders.first) takes its slot without a draw; the seed decides the rest.
    const pinned = this.level.orders.first?.[this.nextOrderId - 1];
    const order: Order = {
      id: this.nextOrderId++,
      recipeId: pinned !== undefined && list.includes(pinned) ? pinned : list[this.rng.int(list.length)],
      timeLeft: cfg.timeSec,
      timeTotal: cfg.timeSec,
    };
    this.state.orders.push(order);
    if (events) events.push({ type: 'orderNew', value: order.id });
  }

  private updateOrders(dt: number, events: SimEvent[]): void {
    const st = this.state;
    if (!st.timerRunning) return; // prep time: orders sit there and nothing new arrives
    const cfg = this.settings.orders;

    this.orderTimer -= dt;
    if (this.orderTimer <= 0) {
      if (st.orders.length < cfg.max) this.spawnOrder(events);
      this.orderTimer += Math.max(cfg.intervalSec, SIM_DT);
    }

    if (this.settings.ordersNeverExpire) return; // assist: tickets keep their full timer
    for (let i = st.orders.length - 1; i >= 0; i--) {
      const order = st.orders[i];
      order.timeLeft -= dt;
      if (order.timeLeft > 0) continue;
      st.orders.splice(i, 1);
      st.score = Math.max(0, st.score - ORDER_FAIL_PENALTY);
      st.failedCount += 1;
      st.tipStreak = 0;
      this.recomputeStars();
      events.push({ type: 'orderExpired', value: order.id });
    }
  }

  private updateTimer(dt: number, events: SimEvent[]): void {
    const st = this.state;
    if (!st.timerRunning) return;
    st.timeLeft -= dt;
    if (!this.warned && st.timeLeft <= TIMER_WARNING_AT) {
      this.warned = true;
      events.push({ type: 'timerWarning' });
    }
    if (st.timeLeft <= 0) {
      st.timeLeft = 0;
      st.phase = 'ended';
      st.timerRunning = false;
      events.push({ type: 'levelEnd', value: st.score });
    }
  }

  // ─── Dynamics ─────────────────────────────────────────────────────────────
  private updateSliders(): void {
    const st = this.state;
    for (let i = 0; i < this.sliderSpecs.length; i++) {
      const spec = this.sliderSpecs[i];
      const t = st.elapsed / spec.periodSec + spec.phase;
      const off = spec.amplitude * Math.sin(2 * Math.PI * t);
      const group = st.sliders[i];
      group.offsetX = spec.axis === 'x' ? off : 0;
      group.offsetY = spec.axis === 'y' ? off : 0;
    }
  }

  /** Runs the open/closed cycle of every gate group: open for openSec, closed for the rest of
   *  periodSec, shifted by phase, so phase 0 starts open. Closing a group makes its tiles part
   *  of the static solid grid, which is what movement, targeting and the pushes all read. */
  private updateGates(events: SimEvent[] | null): void {
    const gates = this.state.gates;
    if (!gates) return;
    for (let i = 0; i < this.gateSpecs.length; i++) {
      const spec = this.gateSpecs[i];
      const group = gates[i];
      let t = (this.state.elapsed / spec.periodSec + spec.phase) % 1;
      if (t < 0) t += 1;
      const open = t < spec.openFrac;
      group.secondsToChange = (open ? spec.openFrac - t : 1 - t) * spec.periodSec;
      if (open === group.open) continue;
      group.open = open;
      for (const g of this.gateTiles) if (g.group === spec.group) this.staticSolid[g.index] = !open;
      if (events) events.push({ type: open ? 'gateOpen' : 'gateClose', x: spec.x, y: spec.y });
    }
  }

  private updatePedestrians(dt: number): void {
    const st = this.state;
    for (const lane of this.pedLanes) {
      lane.timer -= dt;
      if (lane.timer > 0) continue;
      lane.timer += lane.intervalSec;
      const dx = lane.toX - lane.fromX;
      const dy = lane.toY - lane.fromY;
      const d = Math.hypot(dx, dy) || 1;
      const id = this.nextPedId++;
      st.pedestrians.push({
        id,
        x: lane.fromX + 0.5,
        y: lane.fromY + 0.5,
        vx: (dx / d) * lane.speed,
        vy: (dy / d) * lane.speed,
      });
      this.pedTargets[id] = { x: lane.toX + 0.5, y: lane.toY + 0.5 };
    }
    for (let i = st.pedestrians.length - 1; i >= 0; i--) {
      const p = st.pedestrians[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      const target = this.pedTargets[p.id];
      if (!target) continue;
      // Arrived once what is left of the lane stops pointing the way we are walking.
      if ((target.x - p.x) * p.vx + (target.y - p.y) * p.vy <= 0) {
        st.pedestrians.splice(i, 1);
        delete this.pedTargets[p.id];
      }
    }
  }

  private groupOffset(group: string): SliderGroup | null {
    for (const g of this.state.sliders) if (g.id === group) return g;
    return null;
  }

  private specForGroup(group: string): SliderSpec | null {
    for (const s of this.sliderSpecs) if (s.group === group) return s;
    return null;
  }

  // ─── Item factories (per-Sim ids) ─────────────────────────────────────────
  private newIngredient(type: IngredientType): IngredientItem {
    return { kind: 'ingredient', id: this.nextItemId++, type, chopped: false, chopProgress: 0 };
  }

  private newPlate(count = 1): PlateItem {
    return { kind: 'plate', id: this.nextItemId++, dish: null, count };
  }

  private newDirtyPlate(count: number): DirtyPlateItem {
    return { kind: 'dirtyPlate', id: this.nextItemId++, count };
  }
}
