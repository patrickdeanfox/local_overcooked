// ─── Pure input mapping ─────────────────────────────────────────────────────
// No DOM, no Phaser, no browser globals: every function here is unit-testable and
// deterministic. src/input/index.ts wires the Gamepad API and the KeyboardEvent
// stream to these helpers; nothing else in the codebase should decode raw devices.

import type { PlayerInput } from '../sim/types';
import type { GameAction, GamepadBinding, HintAction, KeyboardBinding, PadKind, PlayerBindings } from './types';

// ─── Constants ──────────────────────────────────────────────────────────────
/** Bumped whenever the persisted binding shape changes. v1 payloads are migrated; older ones dropped. */
export const BINDINGS_VERSION = 2;
const BINDINGS_VERSION_V1 = 1;
/** Radial deadzone for the left stick, in stick units, for a pad that has not set its own. */
export const STICK_DEADZONE = 0.25;
/** The range a pad's own deadzone can be set to on the Controllers page, and one step of it. */
export const DEADZONE_MIN = 0;
export const DEADZONE_MAX = 0.8;
export const DEADZONE_STEP = 0.05;
export const AXIS_LEFT_X = 0;
export const AXIS_LEFT_Y = 1;
/** Analog buttons (triggers) count as pressed above this value. */
export const BUTTON_PRESS_THRESHOLD = 0.5;
/** Stick travel that counts as one menu step. */
export const MENU_AXIS_THRESHOLD = 0.5;
/** Sentinel for "this player has no gamepad" / "this binding is not bound to a pad". */
export const NO_PAD = -1;

/** Standard-mapping button indices (https://w3c.github.io/gamepad/#remapping). */
export const PAD_BUTTON = {
  A: 0, B: 1, X: 2, Y: 3,
  LB: 4, RB: 5, LT: 6, RT: 7,
  SELECT: 8, START: 9, L3: 10, R3: 11,
  DPAD_UP: 12, DPAD_DOWN: 13, DPAD_LEFT: 14, DPAD_RIGHT: 15,
  GUIDE: 16,
} as const;

/** Menu "back" is deliberately not remappable, so a bad remap can never trap a player. */
export const BACK_KEYS: readonly string[] = ['Backspace'];
export const BACK_BUTTONS: readonly number[] = [PAD_BUTTON.B];

/** Pad ids that use the PlayStation face-button names. */
export const PLAYSTATION_ID = /playstation|dualshock|dualsense|054c|wireless controller/i;
/**
 * Checked first: a DualShock 4 reports itself as plain "Wireless Controller" in Firefox,
 * but so does "Xbox Wireless Controller" in Chrome, and that one is not a PlayStation pad.
 */
export const XBOX_ID = /xbox|x-box|045e/i;

export const ACTIONS: readonly GameAction[] = ['up', 'down', 'left', 'right', 'pickup', 'interact', 'pause'];
export const ACTION_NAMES: Record<GameAction, string> = {
  up: 'Move up',
  down: 'Move down',
  left: 'Move left',
  right: 'Move right',
  pickup: 'Pick up / drop',
  interact: 'Chop / wash / spray',
  pause: 'Pause',
};

const DEFAULT_KEYS: readonly Record<GameAction, readonly string[]>[] = [
  { up: ['KeyW'], down: ['KeyS'], left: ['KeyA'], right: ['KeyD'], pickup: ['Space'], interact: ['ShiftLeft', 'ControlLeft'], pause: ['Escape'] },
  { up: ['ArrowUp'], down: ['ArrowDown'], left: ['ArrowLeft'], right: ['ArrowRight'], pickup: ['Enter'], interact: ['ShiftRight', 'ControlRight'], pause: ['Escape'] },
];

const DEFAULT_PAD_BUTTONS: Record<GameAction, readonly number[]> = {
  up: [PAD_BUTTON.DPAD_UP],
  down: [PAD_BUTTON.DPAD_DOWN],
  left: [PAD_BUTTON.DPAD_LEFT],
  right: [PAD_BUTTON.DPAD_RIGHT],
  pickup: [PAD_BUTTON.A],
  interact: [PAD_BUTTON.X],
  pause: [PAD_BUTTON.START],
};

const XBOX_LABELS: Record<number, string | undefined> = {
  0: 'A', 1: 'B', 2: 'X', 3: 'Y', 4: 'LB', 5: 'RB', 6: 'LT', 7: 'RT',
  8: 'Back', 9: 'Start', 10: 'LS', 11: 'RS', 12: '↑', 13: '↓', 14: '←', 15: '→', 16: 'Guide',
};
const PLAYSTATION_LABELS: Record<number, string | undefined> = {
  0: 'Cross', 1: 'Circle', 2: 'Square', 3: 'Triangle', 4: 'L1', 5: 'R1', 6: 'L2', 7: 'R2',
  8: 'Share', 9: 'Options', 10: 'L3', 11: 'R3', 12: '↑', 13: '↓', 14: '←', 15: '→', 16: 'PS',
};

const KEY_LABELS: Record<string, string | undefined> = {
  Space: 'Space', Enter: 'Enter', NumpadEnter: 'Enter', Escape: 'Esc', Backspace: 'Bksp', Tab: 'Tab',
  ShiftLeft: 'Shift', ShiftRight: 'Shift', ControlLeft: 'Ctrl', ControlRight: 'Ctrl', AltLeft: 'Alt', AltRight: 'Alt',
  MetaLeft: 'Meta', MetaRight: 'Meta', CapsLock: 'Caps',
  ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→',
  Comma: ',', Period: '.', Slash: '/', Semicolon: ';', Quote: "'", Minus: '-', Equal: '=',
  BracketLeft: '[', BracketRight: ']', Backslash: '\\', Backquote: '`',
};

// ─── Device snapshots ───────────────────────────────────────────────────────
// Structural subset of the Gamepad API, so tests can hand in plain objects and a real
// Gamepad is assignable without a cast.
export interface PadButtonSnapshot { readonly pressed: boolean; readonly value: number; }
export interface PadSnapshot {
  readonly index: number;
  readonly id: string;
  readonly axes: readonly number[];
  readonly buttons: readonly PadButtonSnapshot[];
}

export interface Vec2 { x: number; y: number; }

/** Everything a device says this frame, before rising edges are worked out. */
export interface HeldState {
  moveX: number;
  moveY: number;
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
  pickup: boolean;
  interact: boolean;
  pause: boolean;
  back: boolean;
}

// ─── Defaults ───────────────────────────────────────────────────────────────
/** How many keyboard sets exist: one per player slot the defaults know about. */
export const KEYBOARD_SET_COUNT = DEFAULT_KEYS.length;

export function defaultKeyboardBinding(player: number): KeyboardBinding {
  const src = DEFAULT_KEYS[player % DEFAULT_KEYS.length];
  const keys = {} as Record<GameAction, string[]>;
  for (let i = 0; i < ACTIONS.length; i++) {
    const action = ACTIONS[i];
    keys[action] = src[action].slice();
  }
  return { kind: 'keyboard', keys };
}

export function defaultGamepadBinding(padIndex: number = NO_PAD): GamepadBinding {
  const buttons = {} as Record<GameAction, number[]>;
  for (let i = 0; i < ACTIONS.length; i++) {
    const action = ACTIONS[i];
    buttons[action] = DEFAULT_PAD_BUTTONS[action].slice();
  }
  return { kind: 'gamepad', padIndex, buttons, useLeftStick: true, useDpad: true };
}

export function defaultPlayerBindings(players: number): PlayerBindings[] {
  const out: PlayerBindings[] = [];
  for (let i = 0; i < players; i++) out.push({ keyboard: defaultKeyboardBinding(i), gamepad: defaultGamepadBinding() });
  return out;
}

// ─── The bindings store ─────────────────────────────────────────────────────
// What is persisted and what the manager holds. Keyboard sets are entities of their own
// (a player picks one, and two players never share one); pads are remembered by id so a
// reconnected pad keeps its map; the per-slot gamepad binding is the fallback for a pad
// the store has never seen. Pad assignment itself is per session and never stored.
export interface PlayerSlotBindings {
  keyboardSet: number;      // index into BindingsStore.keyboards
  gamepad: GamepadBinding;  // used for any pad without an entry in pads
}
export interface BindingsStore {
  keyboards: KeyboardBinding[];          // index = keyboard set
  players: PlayerSlotBindings[];         // index = player slot
  pads: Record<string, GamepadBinding>;  // by Gamepad.id
}

export function defaultBindingsStore(players: number): BindingsStore {
  const keyboards: KeyboardBinding[] = [];
  for (let i = 0; i < Math.max(players, KEYBOARD_SET_COUNT); i++) keyboards.push(defaultKeyboardBinding(i));
  const slots: PlayerSlotBindings[] = [];
  for (let i = 0; i < players; i++) slots.push({ keyboardSet: i % keyboards.length, gamepad: defaultGamepadBinding() });
  return { keyboards, players: slots, pads: {} };
}

/** The binding a pad uses on this slot: its own entry when the store knows the pad, else the slot's fallback. */
export function padBindingFor(store: BindingsStore, player: number, padId: string): GamepadBinding {
  return store.pads[padId] ?? store.players[player].gamepad;
}

/** Gives `player` keyboard set `set`. Whoever held it takes the player's old set, so sets stay distinct. */
export function swapKeyboardSets(store: BindingsStore, player: number, set: number): void {
  if (set < 0 || set >= store.keyboards.length) return;
  const slot = store.players[player];
  if (!slot || slot.keyboardSet === set) return;
  const previous = slot.keyboardSet;
  for (let i = 0; i < store.players.length; i++) {
    if (i !== player && store.players[i].keyboardSet === set) store.players[i].keyboardSet = previous;
  }
  slot.keyboardSet = set;
}

/** 'Keyboard set 1 (W A S D)': the set number and its movement keys, so a player knows which half they hold. */
export function keyboardSetLabel(set: number, binding: KeyboardBinding): string {
  const keys = [binding.keys.up[0], binding.keys.left[0], binding.keys.down[0], binding.keys.right[0]]
    .map((code) => (code === undefined ? '—' : keyCodeLabel(code)))
    .join(' ');
  return `Keyboard set ${set + 1} (${keys})`;
}

export function clampDeadzone(value: number): number {
  const clamped = Math.min(DEADZONE_MAX, Math.max(DEADZONE_MIN, value));
  return Math.round(clamped / DEADZONE_STEP) * DEADZONE_STEP;
}

// ─── Held state helpers ─────────────────────────────────────────────────────
export function createHeldState(): HeldState {
  return { moveX: 0, moveY: 0, up: false, down: false, left: false, right: false, pickup: false, interact: false, pause: false, back: false };
}

export function clearHeldState(h: HeldState): void {
  h.moveX = 0; h.moveY = 0;
  h.up = false; h.down = false; h.left = false; h.right = false;
  h.pickup = false; h.interact = false; h.pause = false; h.back = false;
}

export function copyHeldState(src: HeldState, dst: HeldState): void {
  dst.moveX = src.moveX; dst.moveY = src.moveY;
  dst.up = src.up; dst.down = src.down; dst.left = src.left; dst.right = src.right;
  dst.pickup = src.pickup; dst.interact = src.interact; dst.pause = src.pause; dst.back = src.back;
}

/** OR the buttons of `src` into `dst`; `dst` keeps its movement unless it is neutral. */
export function mergeHeldState(dst: HeldState, src: HeldState): void {
  dst.up = dst.up || src.up;
  dst.down = dst.down || src.down;
  dst.left = dst.left || src.left;
  dst.right = dst.right || src.right;
  dst.pickup = dst.pickup || src.pickup;
  dst.interact = dst.interact || src.interact;
  dst.pause = dst.pause || src.pause;
  dst.back = dst.back || src.back;
  if (dst.moveX === 0) dst.moveX = src.moveX;
  if (dst.moveY === 0) dst.moveY = src.moveY;
}

// ─── Stick maths ────────────────────────────────────────────────────────────
/**
 * Radial deadzone with re-normalisation: anything inside the deadzone reads as neutral,
 * anything outside is rescaled so the usable range is a full 0..1 and diagonals never
 * exceed magnitude 1. Writes into `out` so poll() allocates nothing.
 */
export function applyRadialDeadzone(x: number, y: number, deadzone: number, out: Vec2): Vec2 {
  const mag = Math.sqrt(x * x + y * y);
  if (mag <= deadzone || mag === 0) { out.x = 0; out.y = 0; return out; }
  const clamped = mag > 1 ? 1 : mag;
  const scale = ((clamped - deadzone) / (1 - deadzone)) / mag;
  out.x = x * scale;
  out.y = y * scale;
  return out;
}

// ─── Device decode ──────────────────────────────────────────────────────────
function anyKeyDown(codes: readonly string[], isDown: (code: string) => boolean): boolean {
  for (let i = 0; i < codes.length; i++) if (isDown(codes[i])) return true;
  return false;
}

export function isPadButtonPressed(pad: PadSnapshot, index: number): boolean {
  const b = pad.buttons[index];
  if (b === undefined || b === null) return false;
  return b.pressed || b.value > BUTTON_PRESS_THRESHOLD;
}

function anyPadButtonPressed(pad: PadSnapshot, indices: readonly number[]): boolean {
  for (let i = 0; i < indices.length; i++) if (isPadButtonPressed(pad, indices[i])) return true;
  return false;
}

/** Reads one keyboard binding into `out`. `out` is cleared first. */
export function readKeyboard(binding: KeyboardBinding, isDown: (code: string) => boolean, out: HeldState): HeldState {
  clearHeldState(out);
  const keys = binding.keys;
  out.up = anyKeyDown(keys.up, isDown);
  out.down = anyKeyDown(keys.down, isDown);
  out.left = anyKeyDown(keys.left, isDown);
  out.right = anyKeyDown(keys.right, isDown);
  out.pickup = anyKeyDown(keys.pickup, isDown);
  out.interact = anyKeyDown(keys.interact, isDown);
  out.pause = anyKeyDown(keys.pause, isDown);
  out.back = anyKeyDown(BACK_KEYS, isDown);
  out.moveX = (out.right ? 1 : 0) - (out.left ? 1 : 0);
  out.moveY = (out.down ? 1 : 0) - (out.up ? 1 : 0);
  return out;
}

/** Reads one standard-mapping pad into `out`. `out` is cleared first. D-pad beats stick. */
export function readGamepad(pad: PadSnapshot, binding: GamepadBinding, out: HeldState, scratch: Vec2): HeldState {
  clearHeldState(out);
  const buttons = binding.buttons;
  out.up = anyPadButtonPressed(pad, buttons.up);
  out.down = anyPadButtonPressed(pad, buttons.down);
  out.left = anyPadButtonPressed(pad, buttons.left);
  out.right = anyPadButtonPressed(pad, buttons.right);
  out.pickup = anyPadButtonPressed(pad, buttons.pickup);
  out.interact = anyPadButtonPressed(pad, buttons.interact);
  out.pause = anyPadButtonPressed(pad, buttons.pause);
  out.back = anyPadButtonPressed(pad, BACK_BUTTONS);
  const dx = (out.right ? 1 : 0) - (out.left ? 1 : 0);
  const dy = (out.down ? 1 : 0) - (out.up ? 1 : 0);
  if (binding.useDpad && (dx !== 0 || dy !== 0)) {
    out.moveX = dx;
    out.moveY = dy;
  } else if (binding.useLeftStick) {
    const ax = pad.axes[AXIS_LEFT_X];
    const ay = pad.axes[AXIS_LEFT_Y];
    applyRadialDeadzone(typeof ax === 'number' ? ax : 0, typeof ay === 'number' ? ay : 0, binding.deadzone ?? STICK_DEADZONE, scratch);
    out.moveX = scratch.x;
    out.moveY = scratch.y;
  }
  return out;
}

// ─── Rising edges ───────────────────────────────────────────────────────────
export function createPlayerInput(): PlayerInput {
  return { moveX: 0, moveY: 0, pickupPressed: false, interactPressed: false, interactHeld: false, pausePressed: false, backPressed: false };
}

export function clearPlayerInput(out: PlayerInput): void {
  out.moveX = 0; out.moveY = 0;
  out.pickupPressed = false; out.interactPressed = false; out.interactHeld = false;
  out.pausePressed = false; out.backPressed = false;
}

/** Turns this frame's held state plus last frame's into a PlayerInput, in place. */
export function writePlayerInput(held: HeldState, prev: HeldState, out: PlayerInput): PlayerInput {
  out.moveX = held.moveX;
  out.moveY = held.moveY;
  out.pickupPressed = held.pickup && !prev.pickup;
  out.interactPressed = held.interact && !prev.interact;
  out.interactHeld = held.interact;
  out.pausePressed = held.pause && !prev.pause;
  out.backPressed = held.back && !prev.back;
  return out;
}

// ─── Fixed-step edge latch ──────────────────────────────────────────────────
// poll() reports a rising edge on exactly the frame it happened, but a fixed-timestep
// loop runs zero sim steps on any frame shorter than one step (every other frame at
// 120 Hz+, and any frame the browser shortens). Without a latch that press is polled,
// never handed to a step, and lost. The latch holds it until a step consumes it.

export interface EdgeLatch { pickup: boolean; interact: boolean; }

export function createEdgeLatch(): EdgeLatch {
  return { pickup: false, interact: false };
}

export function clearEdgeLatch(latch: EdgeLatch): void {
  latch.pickup = false;
  latch.interact = false;
}

/** ORs one poll's rising edges into the latch. */
export function latchEdges(latch: EdgeLatch, input: PlayerInput): EdgeLatch {
  latch.pickup = latch.pickup || input.pickupPressed;
  latch.interact = latch.interact || input.interactPressed;
  return latch;
}

/**
 * Writes one fixed step's input into `out`: movement and held state come from the live
 * poll, rising edges from the latch and only on the sub-step that consumes them, so a
 * press fires once per press rather than once per sub-step.
 */
export function writeStepInput(
  src: PlayerInput,
  latch: EdgeLatch,
  consumeEdges: boolean,
  out: PlayerInput,
): PlayerInput {
  out.moveX = src.moveX;
  out.moveY = src.moveY;
  out.interactHeld = src.interactHeld;
  out.pickupPressed = consumeEdges && latch.pickup;
  out.interactPressed = consumeEdges && latch.interact;
  out.pausePressed = false;
  out.backPressed = false;
  return out;
}

// ─── Menus ──────────────────────────────────────────────────────────────────
/** "Any player" input for menu screens: buttons OR-ed, movement from the first mover. */
export function readMenuInput(inputs: readonly PlayerInput[], out: PlayerInput = createPlayerInput()): PlayerInput {
  clearPlayerInput(out);
  for (let i = 0; i < inputs.length; i++) {
    const p = inputs[i];
    if (out.moveX === 0) out.moveX = p.moveX;
    if (out.moveY === 0) out.moveY = p.moveY;
    out.pickupPressed = out.pickupPressed || p.pickupPressed;
    out.interactPressed = out.interactPressed || p.interactPressed;
    out.interactHeld = out.interactHeld || p.interactHeld;
    out.pausePressed = out.pausePressed === true || p.pausePressed === true;
    out.backPressed = out.backPressed === true || p.backPressed === true;
  }
  return out;
}

/** One menu step per threshold crossing: -1, 0 or +1. */
export function axisEdge(prev: number, curr: number, threshold: number = MENU_AXIS_THRESHOLD): number {
  if (curr >= threshold && prev < threshold) return 1;
  if (curr <= -threshold && prev > -threshold) return -1;
  return 0;
}

// ─── Labels ─────────────────────────────────────────────────────────────────
export function padKindFromId(id: string): PadKind {
  if (XBOX_ID.test(id)) return 'xbox';
  return PLAYSTATION_ID.test(id) ? 'playstation' : 'xbox';
}

export function padButtonLabel(button: number, kind: PadKind): string {
  const table = kind === 'playstation' ? PLAYSTATION_LABELS : XBOX_LABELS;
  const label = table[button];
  return label === undefined ? `B${button}` : label;
}

export function keyCodeLabel(code: string): string {
  const direct = KEY_LABELS[code];
  if (direct !== undefined) return direct;
  if (code.length === 4 && code.startsWith('Key')) return code.slice(3);
  if (code.length === 6 && code.startsWith('Digit')) return code.slice(5);
  if (code.startsWith('Numpad')) return `Num ${code.slice(6)}`;
  return code;
}

function isMovement(action: GameAction): boolean {
  return action === 'up' || action === 'down' || action === 'left' || action === 'right';
}

/**
 * Prompt label for one action. A player with a pad gets pad labels (PlayStation names
 * when the pad id says so, Xbox names otherwise); a player on the keyboard gets key names.
 * 'back' names the fixed menu-back button, which is not a GameAction.
 */
export function labelForAction(
  action: HintAction,
  keyboard: KeyboardBinding,
  pad: { binding: GamepadBinding; id: string } | null,
): string {
  if (pad !== null) {
    const kind = padKindFromId(pad.id);
    if (action === 'back') return padButtonLabel(BACK_BUTTONS[0], kind);
    if (isMovement(action) && pad.binding.useLeftStick) return 'Stick';
    const button = pad.binding.buttons[action][0];
    return button === undefined ? '—' : padButtonLabel(button, kind);
  }
  if (action === 'back') return keyCodeLabel(BACK_KEYS[0]);
  const code = keyboard.keys[action][0];
  return code === undefined ? '—' : keyCodeLabel(code);
}

/** The words a menu hint line uses, in the player's own labels. */
export interface MenuLabels {
  choose: string; // 'W / S', '↑ / ↓' or 'Stick'
  change: string; // 'A / D', '← / →' or 'Stick'
  select: string; // 'Space', 'Enter', 'A', 'Cross'
  back: string;   // 'Esc or Bksp', 'Start or B', 'Options or Circle'
}

/** One helper for every hint line, so the title, the pages, the pause menu and the results agree. */
export function menuLabels(labelFor: (action: HintAction) => string): MenuLabels {
  const up = labelFor('up');
  const down = labelFor('down');
  const left = labelFor('left');
  const right = labelFor('right');
  return {
    choose: up === 'Stick' && down === 'Stick' ? 'Stick' : `${up} / ${down}`,
    change: left === 'Stick' && right === 'Stick' ? 'Stick' : `${left} / ${right}`,
    select: labelFor('pickup'),
    back: `${labelFor('pause')} or ${labelFor('back')}`,
  };
}

// ─── Persistence ────────────────────────────────────────────────────────────
// v2: { version, keyboards[], players[{ keyboardSet, gamepad }], pads{ id: gamepad } }.
// v1 was { version, players[{ keyboard, gamepad }] } and is migrated on read: each player's
// keyboard becomes keyboard set i, their gamepad stays the slot fallback, no pads are known.
export interface StoredBindings {
  version: number;
  keyboards: KeyboardBinding[];
  players: PlayerSlotBindings[];
  pads: Record<string, GamepadBinding>;
}

function cloneKeys(keys: Record<GameAction, string[]>): Record<GameAction, string[]> {
  const out = {} as Record<GameAction, string[]>;
  for (let i = 0; i < ACTIONS.length; i++) out[ACTIONS[i]] = keys[ACTIONS[i]].slice();
  return out;
}

function cloneButtons(buttons: Record<GameAction, number[]>): Record<GameAction, number[]> {
  const out = {} as Record<GameAction, number[]>;
  for (let i = 0; i < ACTIONS.length; i++) out[ACTIONS[i]] = buttons[ACTIONS[i]].slice();
  return out;
}

export function cloneKeyboardBinding(binding: KeyboardBinding): KeyboardBinding {
  return { kind: 'keyboard', keys: cloneKeys(binding.keys) };
}

/** Pad assignment is per session, so the copy never carries a pad index. */
export function cloneGamepadBinding(binding: GamepadBinding, padIndex: number = NO_PAD): GamepadBinding {
  const out: GamepadBinding = {
    kind: 'gamepad', padIndex, buttons: cloneButtons(binding.buttons), useLeftStick: binding.useLeftStick, useDpad: binding.useDpad,
  };
  if (binding.deadzone !== undefined) out.deadzone = binding.deadzone;
  return out;
}

export function serialiseBindings(store: BindingsStore): string {
  const pads: Record<string, GamepadBinding> = {};
  for (const id of Object.keys(store.pads)) pads[id] = cloneGamepadBinding(store.pads[id]);
  const payload: StoredBindings = {
    version: BINDINGS_VERSION,
    keyboards: store.keyboards.map(cloneKeyboardBinding),
    players: store.players.map((p) => ({ keyboardSet: p.keyboardSet, gamepad: cloneGamepadBinding(p.gamepad) })),
    pads,
  };
  return JSON.stringify(payload);
}

/** A list of key codes. Empty is allowed: an action can be unbound on one device. */
function isCodeArray(v: unknown): v is string[] {
  if (!Array.isArray(v)) return false;
  for (let i = 0; i < v.length; i++) {
    const item: unknown = v[i];
    if (typeof item !== 'string' || item.length === 0) return false;
  }
  return true;
}

function isButtonArray(v: unknown): v is number[] {
  if (!Array.isArray(v)) return false;
  for (let i = 0; i < v.length; i++) {
    const item: unknown = v[i];
    if (typeof item !== 'number' || !Number.isInteger(item) || item < 0 || item > 31) return false;
  }
  return true;
}

function asRecord(v: unknown): Record<string, unknown> | null {
  return typeof v === 'object' && v !== null && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

function validateKeyboardBinding(v: unknown): KeyboardBinding | null {
  const o = asRecord(v);
  if (o === null || o.kind !== 'keyboard') return null;
  const src = asRecord(o.keys);
  if (src === null) return null;
  const keys = {} as Record<GameAction, string[]>;
  for (let i = 0; i < ACTIONS.length; i++) {
    const value = src[ACTIONS[i]];
    if (!isCodeArray(value)) return null;
    keys[ACTIONS[i]] = value.slice();
  }
  return { kind: 'keyboard', keys };
}

function validateGamepadBinding(v: unknown): GamepadBinding | null {
  const o = asRecord(v);
  if (o === null || o.kind !== 'gamepad') return null;
  if (typeof o.useLeftStick !== 'boolean' || typeof o.useDpad !== 'boolean') return null;
  if (o.deadzone !== undefined && (typeof o.deadzone !== 'number' || !Number.isFinite(o.deadzone) || o.deadzone < DEADZONE_MIN || o.deadzone > DEADZONE_MAX)) return null;
  const src = asRecord(o.buttons);
  if (src === null) return null;
  const buttons = {} as Record<GameAction, number[]>;
  for (let i = 0; i < ACTIONS.length; i++) {
    const value = src[ACTIONS[i]];
    if (!isButtonArray(value)) return null;
    buttons[ACTIONS[i]] = value.slice();
  }
  const out: GamepadBinding = { kind: 'gamepad', padIndex: NO_PAD, buttons, useLeftStick: o.useLeftStick, useDpad: o.useDpad };
  if (typeof o.deadzone === 'number') out.deadzone = o.deadzone;
  return out;
}

/** v1: one keyboard and one gamepad per player, keyboard set i belonging to player i. */
function parseV1(root: Record<string, unknown>, players: number): BindingsStore | null {
  const list = root.players;
  if (!Array.isArray(list) || list.length < players) return null;
  const store: BindingsStore = { keyboards: [], players: [], pads: {} };
  for (let i = 0; i < players; i++) {
    const entry = asRecord(list[i]);
    if (entry === null) return null;
    const keyboard = validateKeyboardBinding(entry.keyboard);
    const gamepad = validateGamepadBinding(entry.gamepad);
    if (keyboard === null || gamepad === null) return null;
    store.keyboards.push(keyboard);
    store.players.push({ keyboardSet: i, gamepad });
  }
  return store;
}

function parseV2(root: Record<string, unknown>, players: number): BindingsStore | null {
  const keyboardsRaw = root.keyboards;
  const playersRaw = root.players;
  const padsRaw = asRecord(root.pads);
  if (!Array.isArray(keyboardsRaw) || keyboardsRaw.length === 0 || !Array.isArray(playersRaw) || playersRaw.length < players || padsRaw === null) return null;
  const store: BindingsStore = { keyboards: [], players: [], pads: {} };
  for (let i = 0; i < keyboardsRaw.length; i++) {
    const keyboard = validateKeyboardBinding(keyboardsRaw[i]);
    if (keyboard === null) return null;
    store.keyboards.push(keyboard);
  }
  const taken = new Set<number>();
  for (let i = 0; i < players; i++) {
    const entry = asRecord(playersRaw[i]);
    if (entry === null) return null;
    const set = entry.keyboardSet;
    const gamepad = validateGamepadBinding(entry.gamepad);
    if (typeof set !== 'number' || !Number.isInteger(set) || set < 0 || set >= store.keyboards.length || taken.has(set) || gamepad === null) return null;
    taken.add(set);
    store.players.push({ keyboardSet: set, gamepad });
  }
  for (const id of Object.keys(padsRaw)) {
    if (id.length === 0) return null;
    const gamepad = validateGamepadBinding(padsRaw[id]);
    if (gamepad === null) return null;
    store.pads[id] = gamepad;
  }
  return store;
}

/**
 * Parses a persisted payload into a store. A v1 payload is migrated; anything unusable
 * (older version, wrong shape, missing action, junk values, two players on one keyboard
 * set) returns null and the caller falls back to defaults.
 */
export function parseBindings(raw: string | null, players: number): BindingsStore | null {
  if (typeof raw !== 'string' || raw.length === 0) return null;
  let decoded: unknown;
  try {
    decoded = JSON.parse(raw);
  } catch {
    return null;
  }
  const root = asRecord(decoded);
  if (root === null) return null;
  if (root.version === BINDINGS_VERSION_V1) return parseV1(root, players);
  if (root.version !== BINDINGS_VERSION) return null;
  return parseV2(root, players);
}
