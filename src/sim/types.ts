// ─── Simulation contract ────────────────────────────────────────────────────
// Shared by sim, presentation, input, audio, and level authoring.
// Rule: ADDITIVE changes only (new optional fields, new union members). Never rename
// or remove without updating every consumer and saying so in the PR description.
//
// Coordinates: tile units, x right, y down, (0,0) is the top-left tile. Chef x/y is the
// chef's center, so a chef standing in the middle of tile (3,2) has x=3.5, y=2.5.

export type IngredientType = 'onion' | 'tomato' | 'mushroom' | 'meat' | 'bun' | 'lettuce' | 'fish' | 'prawn';
export const INGREDIENT_TYPES: readonly IngredientType[] = ['onion', 'tomato', 'mushroom', 'meat', 'bun', 'lettuce', 'fish', 'prawn'];
/** Ingredients that go in a pot and make soup. */
export const SOUP_INGREDIENTS: readonly IngredientType[] = ['onion', 'tomato', 'mushroom'];
/** Ingredients that need the chopping board before use (buns never do). */
export const CHOPPED_INGREDIENTS: readonly IngredientType[] = ['onion', 'tomato', 'mushroom', 'meat', 'lettuce', 'fish', 'prawn'];
/** Ingredients that go in a pan after chopping and come out cooked. */
export const FRIED_INGREDIENTS: readonly IngredientType[] = ['meat'];
/** Chopped ingredients that go straight onto a plate as a 'plated' dish (sashimi; salads later). */
export const PLATED_INGREDIENTS: readonly IngredientType[] = ['fish', 'prawn'];

export type Ware = 'pot' | 'pan'; // cookware that sits on a stove
/** 'plated': chopped ingredients assembled directly on the plate, no heat (Overcooked 2 sashimi, salad). */
export type DishType = 'soup' | 'burger' | 'plated';

export type TileType =
  | 'void'        // outside the kitchen; not walkable, nothing placed
  | 'floor'       // walkable
  | 'road'        // walkable floor that pedestrians also use (1-2 crosswalk)
  | 'counter'     // solid; holds one item
  | 'crate'       // solid; infinite source of tile.ingredient (pickup → new raw ingredient)
  | 'board'       // solid; chopping board: holds one ingredient, chop with interact (chef stays put)
  | 'stove'       // solid; burner: holds a pot and cooks it
  | 'sink'        // solid; wash dirty plates with interact; clean plates emerge on adjacent 'drying'
  | 'drying'      // solid; clean-plate output next to a sink (stackable plates)
  | 'plateReturn' // solid; dirty plates appear here some seconds after a serve
  | 'serve'       // solid; serving counter: drop a plated dish to serve it
  | 'trash'       // solid; destroys ingredients/soup dropped on it (plates and pots return empty)
  | 'plateStack'  // solid; 'stack' plate mode: clean plates respawn here after a serve
  | 'slider'      // solid counter that moves with its slider group (tile.group), 1-3 ship counters
  | 'gate'        // floor that is walkable only while its gate group (tile.group) is open, 1-6 earthquake seam
  | 'gap'         // a hole: no wall, a thrown item flies over it, a chef that steps on it falls and respawns at its spawn
  // Mechanics spec (docs/MECHANICS.md), each behind a Modifiers switch:
  | 'shelf'       // pass-through shelf: a hatch in a wall, a counter reachable from both sides; a throw stops at it. Solid wall while the mechanic is off
  | 'trayRack'    // counter that starts with the tray on it (legend 't'); a plain counter while the mechanic is off
  | 'delivery';   // delivery door: restock crates arrive here (86 system); solid, holds nothing, no interaction while the mechanic is off

export interface Tile {
  x: number;
  y: number;
  type: TileType;
  ingredient?: IngredientType; // crate only
  group?: string;              // slider and gate tiles
  stock?: number;              // crate, 86 system on: items left; 0 = empty ("86"). Absent = never runs out
  capacity?: number;           // crate: items a full crate holds (the fill level is stock / capacity)
}

export type Facing = 'up' | 'down' | 'left' | 'right';
export const FACING_VECTORS: Record<Facing, { dx: number; dy: number }> = {
  up: { dx: 0, dy: -1 }, down: { dx: 0, dy: 1 }, left: { dx: -1, dy: 0 }, right: { dx: 1, dy: 0 },
};

// ─── Items ───────────────────────────────────────────────────────────────────
export interface IngredientItem {
  kind: 'ingredient';
  id: number;
  type: IngredientType;
  chopped: boolean;
  chopProgress: number; // 0..1 while on a board
  cooked?: boolean;     // fried ingredients (meat) after the pan; absent means raw
}
export type PotState = 'empty' | 'cooking' | 'cooked' | 'burnt';
/** Cookware on a stove. ware 'pot' (default) boils up to POT_CAPACITY soup ingredients;
 *  ware 'pan' fries exactly one chopped FRIED_INGREDIENTS item into a cooked one. */
export interface PotItem {
  kind: 'pot';
  id: number;
  ware?: Ware;                // absent means 'pot'
  contents: IngredientType[]; // max POT_CAPACITY (pot) or 1 (pan), all chopped
  state: PotState;
  cookProgress: number;   // 0..1, advances only while on a stove with contents
  burnProgress: number;   // 0..1 after cooked while still on the stove; 1 → burnt (+ fire)
}
/** What sits on a plate. 'soup' comes from pouring a pot; 'burger' is assembled from bun,
 *  cooked meat and chopped toppings, in any order; 'plated' is chopped PLATED_INGREDIENTS laid
 *  straight on the plate. ingredients sorted alphabetically. */
export interface Dish { type: DishType; ingredients: IngredientType[]; }
export interface PlateItem {
  kind: 'plate';
  id: number;
  dish: Dish | null;
  count?: number; // clean plates in this stack (drying racks, plate stacks); absent means 1
}
export interface DirtyPlateItem { kind: 'dirtyPlate'; id: number; count: number; } // a stack
export interface ExtinguisherItem { kind: 'extinguisher'; id: number; }
/** What a tray can carry: ingredients in any state and single plates, clean or with a dish. */
export type TrayLoad = IngredientItem | PlateItem;
/** The tray (docs/MECHANICS.md section 3): a physical object from the tray rack that carries up
 *  to TRAY_CAPACITY items. items[items.length - 1] is the top item, the one that loads and
 *  unloads first. A chef carrying it walks at TRAY_SPEED_SCALE, cannot dash or throw, and takes
 *  TRAY_WINDUP_SEC to lift or set it down. */
export interface TrayItem { kind: 'tray'; id: number; items: TrayLoad[]; }
export type Item = IngredientItem | PotItem | PlateItem | DirtyPlateItem | ExtinguisherItem | TrayItem;
export type ItemKind = Item['kind'];

// ─── Recipes and orders ─────────────────────────────────────────────────────
export interface Recipe {
  id: string;                    // e.g. 'onion_soup'
  name: string;                  // display name
  dish?: DishType;               // absent means 'soup'
  ingredients: IngredientType[]; // sorted alphabetically, matches Dish.ingredients
  score: number;                 // base points on serve (before tip)
}
export interface Order {
  id: number;
  recipeId: string;
  timeLeft: number;  // seconds until it expires
  timeTotal: number; // seconds it started with
  originalRecipeId?: string; // 86 system: what the ticket asked for before a shortage rewrote it; a dish matching it still serves
  rewrittenAt?: number;      // 86 system: SimState.elapsed when the ticket was last rewritten, for the HUD flash
}

// ─── Actors ──────────────────────────────────────────────────────────────────
export type ChefAction =
  | 'idle' | 'walking' | 'chopping' | 'washing' | 'extinguishing' | 'dashing' | 'falling'
  | 'lifting'    // tray wind-up: picking the tray up or setting it down, pinned for TRAY_WINDUP_SEC
  | 'unloading'; // 86 system: unloading a delivery at the door, both hands busy for RESTOCK_UNLOAD_SEC
export interface Chef {
  index: number;          // 0 = player 1, 1 = player 2
  x: number;              // center, tile units
  y: number;
  facing: Facing;
  holding: Item | null;
  action: ChefAction;
  actionProgress: number; // 0..1 for chopping/washing; 0 otherwise
  dashCooldown?: number;  // seconds until the next dash; absent = ready
  dashTimeLeft?: number;  // seconds of dash movement left; absent = not dashing
  respawnIn?: number;     // seconds until a fallen chef is back at its spawn; absent = on the floor
  assisting?: boolean;    // chop assist: true while this chef is the second pair of hands at a station this step
  windupLeft?: number;    // tray: seconds of lift / set-down wind-up left; absent = not winding up
  wobble?: number;        // tray: seconds left in the wobble window after a bump; a second bump inside it drops the top item
}
/** A thrown item in the air: straight flight until it is caught, hits something or runs out of range. */
export interface FlyingItem {
  id: number;
  item: Item;
  x: number;              // centre, tile units
  y: number;
  vx: number;             // tiles per second
  vy: number;
  thrower: number;        // chef index; it can catch its own throw back only after THROW_OWN_CATCH_DISTANCE
  rangeLeft: number;      // tiles still to fly before it drops
  flown: number;          // tiles flown so far
  floorX: number;         // the last floor tile it was over: where it drops when a wall stops it
  floorY: number;
}
// on tile (x,y); health 1 → 0 when out. spreadTimer counts down to the next spread.
export interface Fire { x: number; y: number; health: number; spreadTimer?: number; }
export interface Pedestrian { id: number; x: number; y: number; vx: number; vy: number; } // solid moving obstacle
export interface SliderGroup { id: string; offsetX: number; offsetY: number; }     // current tile offset
/** A gate group (1-6 earthquake seam): its 'gate' tiles are walkable only while open. */
export interface GateGroup { id: string; open: boolean; secondsToChange: number; }
/** 86 system: one restock on its way. It waits arrivesIn seconds, then sits at the delivery door
 *  until a chef unloads it (unloaded 0..1); on a level with no door it restocks by itself when
 *  it arrives. Unloading refills every crate of the ingredient. */
export interface Restock { id: number; ingredient: IngredientType; arrivesIn: number; unloaded: number; }

export type LevelPhase = 'prep' | 'running' | 'ended';

// ─── Difficulty modifiers ───────────────────────────────────────────────────
// Multiplied into the level's numbers when the Sim is built. All optional; 1 / 0 = unchanged.
export interface Modifiers {
  timeLimitScale?: number;     // 0.8 = 20% less time
  orderIntervalScale?: number; // 0.7 = orders arrive faster
  orderTimeScale?: number;     // 0.8 = orders expire sooner
  maxOrdersDelta?: number;     // +1 = one more concurrent ticket
  chefSpeedScale?: number;     // 1.15 = faster chefs
  // Custom difficulty (roadmap item 2). Scales multiply the constants in constants.ts.
  cookTimeScale?: number;      // 1.5 = pots and pans take half as long again to cook
  burnTimeScale?: number;      // 0.5 = cooked food burns in half the time
  chopTimeScale?: number;      // 0.5 = chopping takes half as long
  washTimeScale?: number;      // 2 = washing a plate takes twice as long
  initialOrdersDelta?: number; // +1 = one more ticket on screen at level start
  // Assists, all off by default. A run with any of them on is not saved and earns no stars.
  instantCooking?: boolean;    // pots and pans are ready the moment they start cooking
  ordersNeverExpire?: boolean; // tickets keep their full timer: no expiry, no fail penalty
  noBurning?: boolean;         // cooked food stays cooked, so stoves never start fires
  // Mechanics (docs/MECHANICS.md), all off by default; off means the kitchen plays as before.
  twoPlateCarry?: boolean;     // a second clean plate can be taken from a drying rack or plate stack; no dash with two
  chopAssist?: boolean;        // a second chef at the same board (or delivery) doubles the rate; off: one chef per station
  tray?: boolean;              // the tray rack starts with a tray; off: the rack is an empty counter
  passThroughShelf?: boolean;  // shelf tiles are counters reachable from both sides; off: solid wall
  eightySix?: boolean;         // crates run out, tickets rewrite, deliveries restock; off: crates never run out
}

// ─── Snapshot ────────────────────────────────────────────────────────────────
// Plain data, JSON-serialisable. Presentation reads this every frame; never mutates it.
export interface SimState {
  width: number;
  height: number;
  tiles: Tile[];               // index = y * width + x
  tileItems: (Item | null)[];  // item resting on each tile, same indexing
  chefs: Chef[];
  fires: Fire[];
  orders: Order[];             // oldest first
  pedestrians: Pedestrian[];
  sliders: SliderGroup[];
  score: number;
  timeLeft: number;            // seconds
  phase: LevelPhase;
  timerRunning: boolean;       // false during 'prep' on levels where the timer starts at first serve
  elapsed: number;             // seconds since level start (including prep)
  servedCount: number;
  failedCount: number;
  pendingPlateReturns: number[]; // seconds until each dirty plate lands on the plate return
  stars: number;               // 0..3 from score vs level.stars for the player count
  tipStreak: number;           // consecutive successful serves (drives the tip bonus)
  gates?: GateGroup[];         // one per gate dynamic; absent on levels without gates
  seed?: number;               // the run's seed, for the results screen
  flying?: FlyingItem[];       // thrown items in the air; absent until the first throw
  restocks?: Restock[];        // 86 system: deliveries on their way or waiting at the door; absent until the first shortage
}

// ─── Input ───────────────────────────────────────────────────────────────────
export interface PlayerInput {
  moveX: number;           // -1..1
  moveY: number;           // -1..1
  pickupPressed: boolean;  // rising edge this step: pick up / put down
  interactPressed: boolean;// rising edge this step: chop / wash / spray
  interactHeld: boolean;   // held this step: chopping and washing continue while held
  pausePressed?: boolean;  // rising edge: Start / Options / Escape (menus and pause)
  backPressed?: boolean;   // rising edge: B / Circle / Backspace (menu back)
  throwPressed?: boolean;  // rising edge: throw the held ingredient the way the chef faces
  dashPressed?: boolean;   // rising edge: dash the way the chef faces
}
export const NO_INPUT: Readonly<PlayerInput> = Object.freeze({
  moveX: 0, moveY: 0, pickupPressed: false, interactPressed: false, interactHeld: false, pausePressed: false, backPressed: false,
  throwPressed: false, dashPressed: false,
});

// ─── Events ──────────────────────────────────────────────────────────────────
// Emitted by Sim.step() for audio, VFX, and HUD flashes. One per occurrence.
export type SimEventType =
  | 'pickup' | 'drop' | 'trash'
  | 'chopTick' | 'chopDone'
  | 'potAdd' | 'cookStart' | 'cookDone' | 'burnt'
  | 'potPour'
  | 'fireStart' | 'fireSpread' | 'fireOut' | 'spray'
  | 'washTick' | 'washDone' | 'plateReturned'
  | 'serve' | 'serveRejected'
  | 'orderNew' | 'orderExpired'
  | 'timerStart' | 'timerWarning' | 'levelEnd'
  | 'plateAdd'                     // an ingredient joined a plate (burger assembly)
  | 'gateOpen' | 'gateClose'       // 1-6 earthquake seam
  | 'throw' | 'catch' | 'throwLand' // value = the flight id; throwLand also fires when the item is lost
  | 'dash' | 'dashBump'            // dashBump: chef = the dasher, value = the chef it hit
  | 'chefFell'                     // a chef stepped on a gap; it respawns after FALL_PENALTY_SEC
  // Mechanics spec (docs/MECHANICS.md)
  | 'crateEmpty'                   // 86: the last item left crate (x, y); the chalk mark goes up
  | 'orderRewritten'               // 86: value = the order id whose recipe changed to a substitute
  | 'restockDue'                   // 86: a delivery arrived at the door (x, y), or restocked by itself on a level with no door
  | 'restockTick'                  // 86: unloading in progress at (x, y), rate limited like chopTick
  | 'restocked'                    // 86: the crates of an ingredient are full again; x, y = the door, or the first crate
  | 'trayLift' | 'traySet'         // tray: the wind-up finished and the tray is in hand / on tile (x, y)
  | 'trayWobble';                  // tray: a bump made the load wobble; the drop that a second bump causes is a plain 'drop'
export interface SimEvent {
  type: SimEventType;
  chef?: number;   // chef index that caused it, if any
  x?: number;      // tile of interest, if any
  y?: number;
  value?: number;  // score delta, order id, etc.
}
