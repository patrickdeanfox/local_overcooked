// ─── Simulation contract ────────────────────────────────────────────────────
// Shared by sim, presentation, input, audio, and level authoring.
// Rule: ADDITIVE changes only (new optional fields, new union members). Never rename
// or remove without updating every consumer and saying so in the PR description.
//
// Coordinates: tile units, x right, y down, (0,0) is the top-left tile. Chef x/y is the
// chef's center, so a chef standing in the middle of tile (3,2) has x=3.5, y=2.5.

export type IngredientType = 'onion' | 'tomato' | 'mushroom' | 'meat' | 'bun' | 'lettuce';
export const INGREDIENT_TYPES: readonly IngredientType[] = ['onion', 'tomato', 'mushroom', 'meat', 'bun', 'lettuce'];
/** Ingredients that go in a pot and make soup. */
export const SOUP_INGREDIENTS: readonly IngredientType[] = ['onion', 'tomato', 'mushroom'];
/** Ingredients that need the chopping board before use (buns never do). */
export const CHOPPED_INGREDIENTS: readonly IngredientType[] = ['onion', 'tomato', 'mushroom', 'meat', 'lettuce'];
/** Ingredients that go in a pan after chopping and come out cooked. */
export const FRIED_INGREDIENTS: readonly IngredientType[] = ['meat'];

export type Ware = 'pot' | 'pan'; // cookware that sits on a stove
export type DishType = 'soup' | 'burger';

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
  | 'gap';        // a hole: no wall, a thrown item flies over it, a chef that steps on it falls and respawns at its spawn

export interface Tile {
  x: number;
  y: number;
  type: TileType;
  ingredient?: IngredientType; // crate only
  group?: string;              // slider and gate tiles
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
 *  cooked meat and chopped toppings, in any order. ingredients sorted alphabetically. */
export interface Dish { type: DishType; ingredients: IngredientType[]; }
export interface PlateItem {
  kind: 'plate';
  id: number;
  dish: Dish | null;
  count?: number; // clean plates in this stack (drying racks, plate stacks); absent means 1
}
export interface DirtyPlateItem { kind: 'dirtyPlate'; id: number; count: number; } // a stack
export interface ExtinguisherItem { kind: 'extinguisher'; id: number; }
export type Item = IngredientItem | PotItem | PlateItem | DirtyPlateItem | ExtinguisherItem;
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
}

// ─── Actors ──────────────────────────────────────────────────────────────────
export type ChefAction = 'idle' | 'walking' | 'chopping' | 'washing' | 'extinguishing' | 'dashing' | 'falling';
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
  | 'chefFell';                    // a chef stepped on a gap; it respawns after FALL_PENALTY_SEC
export interface SimEvent {
  type: SimEventType;
  chef?: number;   // chef index that caused it, if any
  x?: number;      // tile of interest, if any
  y?: number;
  value?: number;  // score delta, order id, etc.
}
