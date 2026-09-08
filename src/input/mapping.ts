// ─── Pure input mapping ─────────────────────────────────────────────────────
// No DOM, no Phaser, no browser globals: every function here is unit-testable and
// deterministic. src/input/index.ts wires the Gamepad API and the KeyboardEvent
// stream to these helpers; nothing else in the codebase should decode raw devices.

import type { PlayerInput } from '../sim/types';
import type { GameAction, GamepadBinding, KeyboardBinding, PadKind, PlayerBindings } from './types';

// ─── Constants ──────────────────────────────────────────────────────────────
/** Bumped whenever the persisted binding shape changes; older payloads are dropped. */
export const BINDINGS_VERSION = 1;
/** Radial deadzone for the left stick, in stick units. */
export const STICK_DEADZONE = 0.25;
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

/** Kept for the original stub's consumers. Fresh objects; safe to mutate. */
export const DEFAULT_KEYBOARD_BINDINGS: KeyboardBinding[] = [defaultKeyboardBinding(0), defaultKeyboardBinding(1)];

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
    applyRadialDeadzone(typeof ax === 'number' ? ax : 0, typeof ay === 'number' ? ay : 0, STICK_DEADZONE, scratch);
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
 */
export function labelForAction(
  action: GameAction,
  keyboard: KeyboardBinding,
  pad: { binding: GamepadBinding; id: string } | null,
): string {
  if (pad !== null) {
    if (isMovement(action) && pad.binding.useLeftStick) return 'Stick';
    const button = pad.binding.buttons[action][0];
    return button === undefined ? '—' : padButtonLabel(button, padKindFromId(pad.id));
  }
  const code = keyboard.keys[action][0];
  return code === undefined ? '—' : keyCodeLabel(code);
}

// ─── Persistence ────────────────────────────────────────────────────────────
export interface StoredBindings {
  version: number;
  players: { keyboard: KeyboardBinding; gamepad: GamepadBinding }[];
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

export function serialiseBindings(players: readonly PlayerBindings[]): string {
  const payload: StoredBindings = {
    version: BINDINGS_VERSION,
    players: players.map((p) => ({
      keyboard: { kind: 'keyboard', keys: cloneKeys(p.keyboard.keys) },
      // Pad assignment is per-session, never persisted.
      gamepad: { kind: 'gamepad', padIndex: NO_PAD, buttons: cloneButtons(p.gamepad.buttons), useLeftStick: p.gamepad.useLeftStick, useDpad: p.gamepad.useDpad },
    })),
  };
  return JSON.stringify(payload);
}

function isCodeArray(v: unknown): v is string[] {
  if (!Array.isArray(v) || v.length === 0) return false;
  for (let i = 0; i < v.length; i++) {
    const item: unknown = v[i];
    if (typeof item !== 'string' || item.length === 0) return false;
  }
  return true;
}

function isButtonArray(v: unknown): v is number[] {
  if (!Array.isArray(v) || v.length === 0) return false;
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
  const src = asRecord(o.buttons);
  if (src === null) return null;
  const buttons = {} as Record<GameAction, number[]>;
  for (let i = 0; i < ACTIONS.length; i++) {
    const value = src[ACTIONS[i]];
    if (!isButtonArray(value)) return null;
    buttons[ACTIONS[i]] = value.slice();
  }
  return { kind: 'gamepad', padIndex: NO_PAD, buttons, useLeftStick: o.useLeftStick, useDpad: o.useDpad };
}

/**
 * Parses a persisted payload. Returns null for anything unusable — wrong version, wrong
 * shape, missing action, junk values — and the caller falls back to defaults.
 */
export function parseBindings(raw: string | null, players: number): PlayerBindings[] | null {
  if (typeof raw !== 'string' || raw.length === 0) return null;
  let decoded: unknown;
  try {
    decoded = JSON.parse(raw);
  } catch {
    return null;
  }
  const root = asRecord(decoded);
  if (root === null || root.version !== BINDINGS_VERSION) return null;
  const list = root.players;
  if (!Array.isArray(list) || list.length < players) return null;
  const out: PlayerBindings[] = [];
  for (let i = 0; i < players; i++) {
    const entry = asRecord(list[i]);
    if (entry === null) return null;
    const keyboard = validateKeyboardBinding(entry.keyboard);
    const gamepad = validateGamepadBinding(entry.gamepad);
    if (keyboard === null || gamepad === null) return null;
    out.push({ keyboard, gamepad });
  }
  return out;
}
