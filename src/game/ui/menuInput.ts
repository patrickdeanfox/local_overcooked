// ─── Menu navigation input ──────────────────────────────────────────────────
// Menus are driven by two sources at once: the PlayerInput stream from the input
// manager (so a gamepad works) and raw keyboard keys (so the keyboard always works
// even when it is bound to a different player). Both produce rising edges only.
import Phaser from 'phaser';
import type { PlayerInput } from '../../sim/types';

const AXIS_DEADZONE = 0.5;

const NAV_KEYS: Readonly<Record<string, readonly string[]>> = {
  up: ['UP', 'W'],
  down: ['DOWN', 'S'],
  left: ['LEFT', 'A'],
  right: ['RIGHT', 'D'],
  confirm: ['ENTER', 'SPACE'],
  back: ['BACKSPACE'],
};

export interface MenuNav {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
  confirm: boolean;
  back: boolean;
}

export function emptyNav(): MenuNav {
  return { up: false, down: false, left: false, right: false, confirm: false, back: false };
}

export function mergeNav(a: MenuNav, b: MenuNav): MenuNav {
  return {
    up: a.up || b.up,
    down: a.down || b.down,
    left: a.left || b.left,
    right: a.right || b.right,
    confirm: a.confirm || b.confirm,
    back: a.back || b.back,
  };
}

function axisSign(value: number): number {
  if (value >= AXIS_DEADZONE) return 1;
  if (value <= -AXIS_DEADZONE) return -1;
  return 0;
}

// ─── PlayerInput → MenuNav ──────────────────────────────────────────────────
/** Turns the analogue sticks of every player into menu edges. */
export class MenuInput {
  private prevX: number[] = [];
  private prevY: number[] = [];

  poll(inputs: readonly PlayerInput[]): MenuNav {
    const nav = emptyNav();
    inputs.forEach((input, i) => {
      const x = axisSign(input.moveX);
      const y = axisSign(input.moveY);
      const wasX = this.prevX[i] ?? 0;
      const wasY = this.prevY[i] ?? 0;
      if (y < 0 && wasY >= 0) nav.up = true;
      if (y > 0 && wasY <= 0) nav.down = true;
      if (x < 0 && wasX >= 0) nav.left = true;
      if (x > 0 && wasX <= 0) nav.right = true;
      this.prevX[i] = x;
      this.prevY[i] = y;
      if (input.pickupPressed) nav.confirm = true;
      if (input.backPressed === true) nav.back = true;
    });
    return nav;
  }
}

// ─── Keyboard → MenuNav ─────────────────────────────────────────────────────
/**
 * Reads its own Key objects and tracks previous state itself; it never calls
 * JustDown, whose flag is consumed by whichever caller reads it first.
 */
export class KeyboardNav {
  private readonly keys = new Map<string, Phaser.Input.Keyboard.Key>();
  private readonly prev = new Map<string, boolean>();

  constructor(scene: Phaser.Scene) {
    const keyboard = scene.input.keyboard;
    if (!keyboard) return;
    for (const names of Object.values(NAV_KEYS)) {
      for (const name of names) this.keys.set(name, keyboard.addKey(name, true, false));
    }
  }

  poll(): MenuNav {
    const nav = emptyNav();
    nav.up = this.edgeAny(NAV_KEYS.up);
    nav.down = this.edgeAny(NAV_KEYS.down);
    nav.left = this.edgeAny(NAV_KEYS.left);
    nav.right = this.edgeAny(NAV_KEYS.right);
    nav.confirm = this.edgeAny(NAV_KEYS.confirm);
    nav.back = this.edgeAny(NAV_KEYS.back);
    return nav;
  }

  /** Key objects are owned by the KeyboardPlugin, which frees them on scene shutdown
   *  (and may share them with the input manager), so only local state is dropped here. */
  destroy(): void {
    this.keys.clear();
    this.prev.clear();
  }

  private edgeAny(names: readonly string[]): boolean {
    let edge = false;
    for (const name of names) {
      const down = this.keys.get(name)?.isDown ?? false;
      if (down && !(this.prev.get(name) ?? false)) edge = true;
      this.prev.set(name, down);
    }
    return edge;
  }
}
