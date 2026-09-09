// ─── Simulation tuning ──────────────────────────────────────────────────────
// Defaults approximate Overcooked 1. The OC1 research doc (docs/research/) is the
// source of truth; update these numbers when it lands and note the source in a comment.

export const SIM_DT = 1 / 60;          // fixed step, seconds

export const CHEF_SPEED = 4.2;          // tiles per second
export const CHEF_RADIUS = 0.35;        // tiles, for chef-chef and chef-pedestrian collision
export const CHEF_HITBOX = 0.6;         // tiles, square side used against solid tiles
export const REACH = 0.6;               // tiles in front of the chef center to find the target tile

export const CHOP_TIME = 3.0;           // seconds of held interact per ingredient (wiki: "about three seconds", Chopping Board)
export const POT_CAPACITY = 3;
export const PAN_CAPACITY = 1;          // a pan fries one chopped patty at a time
export const COOK_TIME = 9;             // seconds on the stove for a full pot to be ready
export const PAN_COOK_TIME = COOK_TIME; // seconds on the stove for a patty to be ready (wiki: none; matched to the pot)
export const BURN_TIME = 13;            // seconds after cooked before the pot is burnt and ignites (wiki Burnt food: 5 + 5 + 3 s warning stages)
export const WASH_TIME = 2.0;           // seconds of held interact per dirty plate
export const PLATE_RETURN_DELAY = 6;    // seconds after a serve before the dirty plate comes back (wiki Plate: "after a few seconds")
export const PLATE_STACK_RETURN_DELAY = 6; // 'stack' mode: seconds before a clean plate respawns

export const FIRE_SPREAD_TIME = 6;      // seconds a fire burns before igniting a neighbouring counter
export const EXTINGUISH_RATE = 1.2;     // fire health removed per second of spraying
export const SPRAY_RANGE = 2;           // tiles in front of the chef the spray reaches

export const ORDER_FAIL_PENALTY = 10;   // points lost when an order expires
export const TIP_BASE = 2;              // tip added per consecutive on-time serve, capped by TIP_MAX
export const TIP_MAX = 8;
export const TIMER_WARNING_AT = 30;     // seconds left when the warning event fires

// ─── Throwing, dashing and falling (roadmap item 4) ─────────────────────────
// The wiki gives one number here (the dash cooldown); the rest are estimates from
// docs/research/oc2-roadmap-notes.md sections 3 and 4. Tune by play.
export const THROW_SPEED = 9;              // tiles per second a thrown item flies; a full throw takes about 0.4 s
export const THROW_RANGE = 3.5;            // tiles a throw travels before it drops
export const CATCH_RADIUS = 0.55;          // tiles between a flying item and a chef centre for a catch
export const THROW_OWN_CATCH_DISTANCE = 1; // tiles a throw must fly before its thrower can catch it back
export const DASH_SPEED = 11;              // tiles per second while dashing
export const DASH_TIME = 0.16;             // seconds a dash lasts, about 1.8 tiles
export const DASH_COOLDOWN = 0.6;          // seconds between dashes (wiki Dash: "just above half a second")
export const DASH_THROW_WINDOW = 0.3;      // seconds after a dash starts during which a throw flies further
export const DASH_THROW_BONUS = 1.5;       // range multiplier for a throw inside that window
export const DASH_BUMP_PUSH = 0.6;         // tiles a chef hit by a dash is shoved
export const FALL_PENALTY_SEC = 5;         // seconds a fallen chef is out before it respawns (wiki 2-1, 3-1, 3-3, 3-4)

// ─── Mechanics spec (docs/MECHANICS.md) ─────────────────────────────────────
// Numbers from the spec's tuning table (section 7); ranges given there, midpoints taken.
export const TWO_PLATE_MAX = 2;            // clean plates one chef can carry with two-plate carry on
export const ASSIST_RATE = 2;              // progress multiplier with a second chef at a board or delivery; never higher
export const TRAY_CAPACITY = 3;            // items a tray holds
export const TRAY_SPEED_SCALE = 0.75;      // chef speed while carrying the tray (spec: 20% to 30% slower)
export const TRAY_WINDUP_SEC = 0.5;        // lift and set-down wind-up, each (spec: 0.4 to 0.6 s)
export const TRAY_WOBBLE_SEC = 1.0;        // window after a bump in which a second bump drops the top item (spec gives none)
export const CRATE_SIZE = 8;               // items per crate when the level's eightySix block gives no crateSize (spec: 4 to 12)
export const RESTOCK_DELAY_SEC = 30;       // seconds from a crate emptying to its delivery arriving (spec: 20 to 45 s)
export const RESTOCK_UNLOAD_SEC = 4;       // seconds of held interact to unload a delivery alone (2 s with assist)
export const MAX_SIMULTANEOUS_86 = 2;      // while this many ingredients are out, no other crate gives up its last item
export const ORDER_REWRITE_FLASH_SEC = 2;  // how long the HUD flashes a rewritten ticket

// ─── Sim internals (added by the simulation agent) ──────────────────────────
export const MOVE_DEADZONE = 0.2;         // stick magnitude below which the chef stands still
export const TICK_EVENT_HZ = 4;           // max chopTick / washTick / spray events per second
export const SPRAY_LATERAL_TOLERANCE = 0.6; // tiles either side of the spray ray that still get hit
export const MAX_PUSH_ESCAPE = 1;         // tiles a slider or pedestrian push may shift a chef in one step
