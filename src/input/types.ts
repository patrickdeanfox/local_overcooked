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
  /** Per-player input for this frame. Rising edges are computed inside the manager. */
  poll(): PlayerInput[];
  getBinding(player: number): Binding;
  setBinding(player: number, binding: Binding): void;
  /** Human-readable label for the prompt icon, e.g. 'A', 'Cross', 'Space'. */
  labelFor(player: number, action: GameAction): string;
  destroy(): void;
}
