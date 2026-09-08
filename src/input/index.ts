// STUB: input agent replaces with gamepad + keyboard + persisted bindings.
import type Phaser from 'phaser';
import type { Binding, GameAction, InputManager, KeyboardBinding, PlayerInput } from './types';
export * from './types';

export const DEFAULT_KEYBOARD_BINDINGS: KeyboardBinding[] = [
  { kind: 'keyboard', keys: { up: ['KeyW'], down: ['KeyS'], left: ['KeyA'], right: ['KeyD'], pickup: ['Space'], interact: ['ShiftLeft', 'ControlLeft'], pause: ['Escape'] } },
  { kind: 'keyboard', keys: { up: ['ArrowUp'], down: ['ArrowDown'], left: ['ArrowLeft'], right: ['ArrowRight'], pickup: ['Enter'], interact: ['ShiftRight', 'ControlRight'], pause: ['Escape'] } },
];

export function createInputManager(_scene: Phaser.Scene, players: number): InputManager {
  const down = new Set<string>();
  const onDown = (e: KeyboardEvent): void => { down.add(e.code); };
  const onUp = (e: KeyboardEvent): void => { down.delete(e.code); };
  window.addEventListener('keydown', onDown);
  window.addEventListener('keyup', onUp);
  const bindings: Binding[] = DEFAULT_KEYBOARD_BINDINGS.slice(0, players);
  const prev: Record<number, { pickup: boolean; interact: boolean; pause: boolean }> = {};
  const held = (b: KeyboardBinding, a: GameAction): boolean => b.keys[a].some((k) => down.has(k));
  return {
    players,
    poll(): PlayerInput[] {
      return bindings.map((b, i) => {
        if (b.kind !== 'keyboard') throw new Error('stub supports keyboard only');
        const p = prev[i] ?? { pickup: false, interact: false, pause: false };
        const pickup = held(b, 'pickup'), interact = held(b, 'interact'), pause = held(b, 'pause');
        prev[i] = { pickup, interact, pause };
        return {
          moveX: (held(b, 'right') ? 1 : 0) - (held(b, 'left') ? 1 : 0),
          moveY: (held(b, 'down') ? 1 : 0) - (held(b, 'up') ? 1 : 0),
          pickupPressed: pickup && !p.pickup,
          interactPressed: interact && !p.interact,
          interactHeld: interact,
          pausePressed: pause && !p.pause,
          backPressed: false,
        };
      });
    },
    getBinding: (i) => bindings[i],
    setBinding: (i, b) => { bindings[i] = b; },
    labelFor: (i, a) => { const b = bindings[i]; return b.kind === 'keyboard' ? b.keys[a][0] : String(b.buttons[a][0]); },
    destroy: () => { window.removeEventListener('keydown', onDown); window.removeEventListener('keyup', onUp); },
  };
}
