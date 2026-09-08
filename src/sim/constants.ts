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
export const COOK_TIME = 9;             // seconds on the stove for a full pot to be ready
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

// ─── Sim internals (added by the simulation agent) ──────────────────────────
export const MOVE_DEADZONE = 0.2;         // stick magnitude below which the chef stands still
export const TICK_EVENT_HZ = 4;           // max chopTick / washTick / spray events per second
export const SPRAY_LATERAL_TOLERANCE = 0.6; // tiles either side of the spray ray that still get hit
export const MAX_PUSH_ESCAPE = 1;         // tiles a slider or pedestrian push may shift a chef in one step
