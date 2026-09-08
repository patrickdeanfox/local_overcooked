// ─── Input contract ─────────────────────────────────────────────────────────
import type { PlayerInput } from '../sim/types';
export type { PlayerInput } from '../sim/types';

export type GameAction = 'up' | 'down' | 'left' | 'right' | 'pickup' | 'interact' | 'pause';

export type DeviceKind = 'keyboard' | 'gamepad';

export interface KeyboardBinding { kind: 'keyboard'; keys: Record<GameAction, string[]>; }       // KeyboardEvent.code values
export interface GamepadBinding  { kind: 'gamepad'; padIndex: number; buttons: Record<GameAction, number[]>; useLeftStick: boolean; useDpad: boolean; }
export type Binding = KeyboardBinding | GamepadBinding;

export interface InputManager {
  readonly players: number;
  /**
   * Per-player input for this frame. Rising edges are computed inside the manager.
   * The array and the PlayerInput objects in it are reused every frame (poll() allocates
   * nothing): read them during the frame, never store them across frames.
   */
  poll(): PlayerInput[];
  /** The gamepad binding when the player has a pad, otherwise the keyboard binding. */
  getBinding(player: number): Binding;
  /** Replaces the keyboard or gamepad binding, whichever the argument is. */
  setBinding(player: number, binding: Binding): void;
  /** Human-readable label for the prompt icon, e.g. 'A', 'Cross', 'Space'. */
  labelFor(player: number, action: GameAction): string;
  destroy(): void;
}

// ─── Controller-setup surface ───────────────────────────────────────────────
// Additive: everything below is used by ControllerScene. Gameplay scenes only need
// InputManager above. createInputManager() returns FullInputManager.

/** Face-button naming family, chosen from the pad id. Unknown pads use Xbox names. */
export type PadKind = 'xbox' | 'playstation';

/** Keyboard and gamepad are bound separately, so a player can use either at any time. */
export interface PlayerBindings { keyboard: KeyboardBinding; gamepad: GamepadBinding; }

/** One connected pad and the slot it drives, if any. */
export interface PadInfo { index: number; id: string; kind: PadKind; player: number; }

/** Result of a "press the key or button you want" listen. */
export type CaptureResult =
  | { kind: 'keyboard'; code: string }
  | { kind: 'gamepad'; padIndex: number; button: number }
  | { kind: 'cancel' };

/** Live device state for the controller-test visualisation. Reused each frame. */
export interface RawPlayerState {
  padIndex: number;                     // NO_PAD when the player has no pad
  padId: string;                        // '' when the player has no pad
  padKind: PadKind;
  stickX: number;                       // left stick after deadzone, -1..1
  stickY: number;
  buttons: boolean[];                   // by gamepad button index; empty with no pad
  keysDown: Record<GameAction, boolean>;// bound keyboard keys currently held
}

export interface FullInputManager extends InputManager {
  getKeyboardBinding(player: number): KeyboardBinding;
  getGamepadBinding(player: number): GamepadBinding;
  setKeyboardBinding(player: number, binding: KeyboardBinding): void;
  setGamepadBinding(player: number, binding: GamepadBinding): void;
  /** Restores defaults for one player, or for everyone when player is omitted. */
  resetBindings(player?: number): void;
  /** Pad id, or 'Keyboard' when no pad drives this slot. */
  getDeviceName(player: number): string;
  /** Gamepad index driving this slot, or NO_PAD. */
  getPadIndex(player: number): number;
  getPadKind(player: number): PadKind;
  getRawState(player: number): Readonly<RawPlayerState>;
  /** Connected pads, newest state. Allocates: menu use only. */
  listPads(): PadInfo[];
  assignPad(padIndex: number, player: number): void;
  unassignPad(player: number): void;
  /** Index of an unassigned pad whose button was just pressed, else NO_PAD. Consumed. */
  pollPadClaim(): number;
  /** Suppresses normal input and listens for the next key or button. */
  startCapture(): void;
  isCapturing(): boolean;
  /** The captured key/button, once. Escape reports { kind: 'cancel' }. */
  pollCapture(): CaptureResult | null;
  cancelCapture(): void;
  /** Writes the current bindings to localStorage. */
  save(): void;
}
