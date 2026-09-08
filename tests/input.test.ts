import { describe, expect, it } from 'vitest';
import {
  ACTIONS, BINDINGS_VERSION, NO_PAD, PAD_BUTTON, STICK_DEADZONE,
  applyRadialDeadzone, axisEdge, createHeldState, createPlayerInput, copyHeldState,
  defaultGamepadBinding, defaultKeyboardBinding, defaultPlayerBindings,
  keyCodeLabel, labelForAction, mergeHeldState, padButtonLabel, padKindFromId,
  parseBindings, readGamepad, readKeyboard, readMenuInput, serialiseBindings, writePlayerInput,
  type PadSnapshot, type Vec2,
} from '../src/input/mapping';
import type { GameAction, PlayerBindings } from '../src/input/types';

// ─── Fixtures ───────────────────────────────────────────────────────────────
const XBOX_ID = 'Xbox 360 Controller (XInput STANDARD GAMEPAD)';
const PAD_BUTTON_COUNT = 17;

function fakePad(opts: { id?: string; axes?: number[]; pressed?: number[]; values?: Record<number, number> } = {}): PadSnapshot {
  const pressed = opts.pressed ?? [];
  const values = opts.values ?? {};
  const buttons = [];
  for (let i = 0; i < PAD_BUTTON_COUNT; i++) {
    buttons.push({ pressed: pressed.includes(i), value: values[i] ?? (pressed.includes(i) ? 1 : 0) });
  }
  return { index: 0, id: opts.id ?? XBOX_ID, axes: opts.axes ?? [0, 0, 0, 0], buttons };
}

function vec(): Vec2 { return { x: 0, y: 0 }; }

// ─── Deadzone ───────────────────────────────────────────────────────────────
describe('applyRadialDeadzone', () => {
  it('zeroes anything inside the deadzone', () => {
    const out = applyRadialDeadzone(0.2, 0.1, STICK_DEADZONE, vec());
    expect(out.x).toBe(0);
    expect(out.y).toBe(0);
  });

  it('is exactly zero on the deadzone boundary', () => {
    const out = applyRadialDeadzone(STICK_DEADZONE, 0, STICK_DEADZONE, vec());
    expect(out.x).toBe(0);
  });

  it('renormalises so full deflection is 1', () => {
    const out = applyRadialDeadzone(1, 0, STICK_DEADZONE, vec());
    expect(out.x).toBeCloseTo(1, 6);
    expect(out.y).toBe(0);
  });

  it('maps the midpoint of the live range to 0.5', () => {
    const out = applyRadialDeadzone(0.625, 0, STICK_DEADZONE, vec());
    expect(out.x).toBeCloseTo(0.5, 6);
  });

  it('keeps the sign and never exceeds magnitude 1 on diagonals', () => {
    const out = applyRadialDeadzone(-0.9, -0.9, STICK_DEADZONE, vec());
    expect(out.x).toBeLessThan(0);
    expect(out.y).toBeLessThan(0);
    expect(Math.hypot(out.x, out.y)).toBeLessThanOrEqual(1 + 1e-9);
    expect(Math.hypot(out.x, out.y)).toBeCloseTo(1, 6);
  });

  it('writes into the supplied vector rather than allocating', () => {
    const target = vec();
    expect(applyRadialDeadzone(1, 0, STICK_DEADZONE, target)).toBe(target);
  });
});

// ─── Rising edges ───────────────────────────────────────────────────────────
describe('writePlayerInput rising edges', () => {
  it('fires once on press, stays held, and re-fires after a release', () => {
    const held = createHeldState();
    const prev = createHeldState();
    const out = createPlayerInput();

    // frame 1: nothing
    writePlayerInput(held, prev, out);
    expect(out.pickupPressed).toBe(false);

    // frame 2: pickup goes down
    copyHeldState(held, prev);
    held.pickup = true;
    writePlayerInput(held, prev, out);
    expect(out.pickupPressed).toBe(true);

    // frame 3: still down
    copyHeldState(held, prev);
    writePlayerInput(held, prev, out);
    expect(out.pickupPressed).toBe(false);

    // frame 4: released
    copyHeldState(held, prev);
    held.pickup = false;
    writePlayerInput(held, prev, out);
    expect(out.pickupPressed).toBe(false);

    // frame 5: pressed again
    copyHeldState(held, prev);
    held.pickup = true;
    writePlayerInput(held, prev, out);
    expect(out.pickupPressed).toBe(true);
  });

  it('reports interact as both an edge and a hold', () => {
    const held = createHeldState();
    const prev = createHeldState();
    const out = createPlayerInput();
    held.interact = true;
    writePlayerInput(held, prev, out);
    expect(out.interactPressed).toBe(true);
    expect(out.interactHeld).toBe(true);
    copyHeldState(held, prev);
    writePlayerInput(held, prev, out);
    expect(out.interactPressed).toBe(false);
    expect(out.interactHeld).toBe(true);
  });

  it('tracks pause and back edges independently', () => {
    const held = createHeldState();
    const prev = createHeldState();
    const out = createPlayerInput();
    held.pause = true;
    held.back = true;
    writePlayerInput(held, prev, out);
    expect(out.pausePressed).toBe(true);
    expect(out.backPressed).toBe(true);
    copyHeldState(held, prev);
    held.back = false;
    writePlayerInput(held, prev, out);
    expect(out.pausePressed).toBe(false);
    expect(out.backPressed).toBe(false);
  });
});

// ─── Standard-mapping decode ────────────────────────────────────────────────
describe('readGamepad', () => {
  const binding = defaultGamepadBinding();

  it('decodes the default face buttons', () => {
    const held = createHeldState();
    readGamepad(fakePad({ pressed: [PAD_BUTTON.A] }), binding, held, vec());
    expect(held.pickup).toBe(true);
    expect(held.interact).toBe(false);

    readGamepad(fakePad({ pressed: [PAD_BUTTON.X] }), binding, held, vec());
    expect(held.interact).toBe(true);

    readGamepad(fakePad({ pressed: [PAD_BUTTON.START] }), binding, held, vec());
    expect(held.pause).toBe(true);

    readGamepad(fakePad({ pressed: [PAD_BUTTON.B] }), binding, held, vec());
    expect(held.back).toBe(true);
  });

  it('treats an analog button over the threshold as pressed', () => {
    const held = createHeldState();
    readGamepad(fakePad({ values: { [PAD_BUTTON.A]: 0.8 } }), binding, held, vec());
    expect(held.pickup).toBe(true);
    readGamepad(fakePad({ values: { [PAD_BUTTON.A]: 0.2 } }), binding, held, vec());
    expect(held.pickup).toBe(false);
  });

  it('reads the left stick through the deadzone', () => {
    const held = createHeldState();
    readGamepad(fakePad({ axes: [1, 0, 0, 0] }), binding, held, vec());
    expect(held.moveX).toBeCloseTo(1, 6);
    expect(held.moveY).toBe(0);

    readGamepad(fakePad({ axes: [0.1, -0.1, 0, 0] }), binding, held, vec());
    expect(held.moveX).toBe(0);
    expect(held.moveY).toBe(0);
  });

  it('lets the d-pad override the stick', () => {
    const held = createHeldState();
    readGamepad(fakePad({ axes: [1, 0, 0, 0], pressed: [PAD_BUTTON.DPAD_LEFT] }), binding, held, vec());
    expect(held.moveX).toBe(-1);
    expect(held.moveY).toBe(0);
    expect(held.left).toBe(true);
  });

  it('ignores the stick when useLeftStick is off', () => {
    const held = createHeldState();
    readGamepad(fakePad({ axes: [1, 0, 0, 0] }), { ...binding, useLeftStick: false }, held, vec());
    expect(held.moveX).toBe(0);
  });

  it('honours a remapped button', () => {
    const remapped = defaultGamepadBinding();
    remapped.buttons.pickup = [PAD_BUTTON.RB];
    const held = createHeldState();
    readGamepad(fakePad({ pressed: [PAD_BUTTON.A] }), remapped, held, vec());
    expect(held.pickup).toBe(false);
    readGamepad(fakePad({ pressed: [PAD_BUTTON.RB] }), remapped, held, vec());
    expect(held.pickup).toBe(true);
  });

  it('survives a pad with fewer buttons and axes than standard mapping', () => {
    const short: PadSnapshot = { index: 3, id: 'weird pad', axes: [], buttons: [{ pressed: false, value: 0 }] };
    const held = createHeldState();
    readGamepad(short, binding, held, vec());
    expect(held.moveX).toBe(0);
    expect(held.pickup).toBe(false);
  });
});

// ─── Keyboard decode and merge ──────────────────────────────────────────────
describe('readKeyboard', () => {
  it('drives player 1 from WASD and player 2 from the arrows', () => {
    const held = createHeldState();
    readKeyboard(defaultKeyboardBinding(0), (c) => c === 'KeyD', held);
    expect(held.moveX).toBe(1);
    readKeyboard(defaultKeyboardBinding(1), (c) => c === 'ArrowUp', held);
    expect(held.moveY).toBe(-1);
  });

  it('binds Escape to pause for both players', () => {
    const held = createHeldState();
    for (const player of [0, 1]) {
      readKeyboard(defaultKeyboardBinding(player), (c) => c === 'Escape', held);
      expect(held.pause).toBe(true);
    }
  });

  it('merges a pad on top of the keyboard, keyboard movement winning', () => {
    const keyboard = createHeldState();
    const pad = createHeldState();
    readKeyboard(defaultKeyboardBinding(0), (c) => c === 'KeyA', keyboard);
    readGamepad(fakePad({ axes: [1, 0, 0, 0], pressed: [PAD_BUTTON.A] }), defaultGamepadBinding(), pad, vec());
    mergeHeldState(keyboard, pad);
    expect(keyboard.moveX).toBe(-1);   // keyboard wins
    expect(keyboard.pickup).toBe(true); // pad button still counts
  });

  it('takes pad movement when the keyboard is neutral', () => {
    const keyboard = createHeldState();
    const pad = createHeldState();
    readKeyboard(defaultKeyboardBinding(0), () => false, keyboard);
    readGamepad(fakePad({ axes: [0, 1, 0, 0] }), defaultGamepadBinding(), pad, vec());
    mergeHeldState(keyboard, pad);
    expect(keyboard.moveY).toBeCloseTo(1, 6);
  });
});

// ─── Labels ─────────────────────────────────────────────────────────────────
describe('label selection', () => {
  it('picks the pad family from the pad id', () => {
    expect(padKindFromId(XBOX_ID)).toBe('xbox');
    expect(padKindFromId('054c-09cc-Wireless Controller')).toBe('playstation');
    expect(padKindFromId('DualSense Wireless Controller')).toBe('playstation');
    expect(padKindFromId('Sony PlayStation DualShock 4')).toBe('playstation');
    expect(padKindFromId('8BitDo Pro 2')).toBe('xbox');
    // An Xbox pad also says "Wireless Controller"; the Xbox check has to win.
    expect(padKindFromId('Xbox Wireless Controller (STANDARD GAMEPAD Vendor: 045e)')).toBe('xbox');
  });

  it('names face buttons per family', () => {
    expect(padButtonLabel(PAD_BUTTON.A, 'xbox')).toBe('A');
    expect(padButtonLabel(PAD_BUTTON.X, 'xbox')).toBe('X');
    expect(padButtonLabel(PAD_BUTTON.B, 'xbox')).toBe('B');
    expect(padButtonLabel(PAD_BUTTON.Y, 'xbox')).toBe('Y');
    expect(padButtonLabel(PAD_BUTTON.A, 'playstation')).toBe('Cross');
    expect(padButtonLabel(PAD_BUTTON.X, 'playstation')).toBe('Square');
    expect(padButtonLabel(PAD_BUTTON.B, 'playstation')).toBe('Circle');
    expect(padButtonLabel(PAD_BUTTON.Y, 'playstation')).toBe('Triangle');
    expect(padButtonLabel(99, 'xbox')).toBe('B99');
  });

  it('turns key codes into readable names', () => {
    expect(keyCodeLabel('Space')).toBe('Space');
    expect(keyCodeLabel('Enter')).toBe('Enter');
    expect(keyCodeLabel('ShiftLeft')).toBe('Shift');
    expect(keyCodeLabel('ControlRight')).toBe('Ctrl');
    expect(keyCodeLabel('KeyW')).toBe('W');
    expect(keyCodeLabel('Digit4')).toBe('4');
    expect(keyCodeLabel('Numpad5')).toBe('Num 5');
    expect(keyCodeLabel('F13')).toBe('F13');
  });

  it('labels actions for the keyboard when no pad is assigned', () => {
    const keyboard = defaultKeyboardBinding(0);
    expect(labelForAction('pickup', keyboard, null)).toBe('Space');
    expect(labelForAction('interact', keyboard, null)).toBe('Shift');
    expect(labelForAction('up', keyboard, null)).toBe('W');
    expect(labelForAction('pickup', defaultKeyboardBinding(1), null)).toBe('Enter');
  });

  it('labels actions for the assigned pad, movement as Stick', () => {
    const keyboard = defaultKeyboardBinding(0);
    const gamepad = defaultGamepadBinding(0);
    expect(labelForAction('pickup', keyboard, { binding: gamepad, id: XBOX_ID })).toBe('A');
    expect(labelForAction('interact', keyboard, { binding: gamepad, id: XBOX_ID })).toBe('X');
    expect(labelForAction('pickup', keyboard, { binding: gamepad, id: 'DualSense Wireless Controller' })).toBe('Cross');
    expect(labelForAction('left', keyboard, { binding: gamepad, id: XBOX_ID })).toBe('Stick');
    expect(labelForAction('left', keyboard, { binding: { ...gamepad, useLeftStick: false }, id: XBOX_ID })).toBe('←');
  });
});

// ─── Menu helpers ───────────────────────────────────────────────────────────
describe('menu helpers', () => {
  it('merges every player into one menu input', () => {
    const p1 = createPlayerInput();
    const p2 = createPlayerInput();
    p2.moveY = -1;
    p2.pickupPressed = true;
    const menu = readMenuInput([p1, p2]);
    expect(menu.moveY).toBe(-1);
    expect(menu.pickupPressed).toBe(true);
    expect(menu.backPressed).toBe(false);
  });

  it('steps once per threshold crossing', () => {
    expect(axisEdge(0, 1)).toBe(1);
    expect(axisEdge(1, 1)).toBe(0);
    expect(axisEdge(0, -1)).toBe(-1);
    expect(axisEdge(-1, -1)).toBe(0);
    expect(axisEdge(0, 0.4)).toBe(0);
    expect(axisEdge(0.4, 0.6)).toBe(1);
    expect(axisEdge(1, 0)).toBe(0);
  });
});

// ─── Persistence ────────────────────────────────────────────────────────────
describe('bindings persistence', () => {
  it('round-trips through JSON', () => {
    const bindings = defaultPlayerBindings(2);
    bindings[0].keyboard.keys.pickup = ['KeyF'];
    bindings[1].gamepad.buttons.interact = [PAD_BUTTON.Y];
    bindings[1].gamepad.useDpad = false;

    const parsed = parseBindings(serialiseBindings(bindings), 2);
    expect(parsed).not.toBeNull();
    if (parsed === null) return;
    expect(parsed[0].keyboard.keys.pickup).toEqual(['KeyF']);
    expect(parsed[1].gamepad.buttons.interact).toEqual([PAD_BUTTON.Y]);
    expect(parsed[1].gamepad.useDpad).toBe(false);
    expect(parsed[0].keyboard.keys.up).toEqual(['KeyW']);
    for (const action of ACTIONS) expect(parsed[1].keyboard.keys[action].length).toBeGreaterThan(0);
  });

  it('never persists the live pad assignment', () => {
    const bindings = defaultPlayerBindings(2);
    bindings[0].gamepad.padIndex = 3;
    const parsed = parseBindings(serialiseBindings(bindings), 2);
    expect(parsed?.[0].gamepad.padIndex).toBe(NO_PAD);
  });

  it('returns fresh arrays, not references into the payload', () => {
    const bindings = defaultPlayerBindings(2);
    const json = serialiseBindings(bindings);
    const a = parseBindings(json, 2);
    const b = parseBindings(json, 2);
    expect(a?.[0].keyboard.keys.up).not.toBe(b?.[0].keyboard.keys.up);
  });

  it('rejects anything unusable and lets the caller fall back to defaults', () => {
    const good: PlayerBindings[] = defaultPlayerBindings(2);
    const json = serialiseBindings(good);
    const payload = JSON.parse(json) as { version: number; players: unknown[] };

    expect(parseBindings(null, 2)).toBeNull();
    expect(parseBindings('', 2)).toBeNull();
    expect(parseBindings('not json at all', 2)).toBeNull();
    expect(parseBindings('[]', 2)).toBeNull();
    expect(parseBindings('"a string"', 2)).toBeNull();
    expect(parseBindings(JSON.stringify({ version: BINDINGS_VERSION + 1, players: payload.players }), 2)).toBeNull();
    expect(parseBindings(JSON.stringify({ players: payload.players }), 2)).toBeNull();
    expect(parseBindings(JSON.stringify({ version: BINDINGS_VERSION }), 2)).toBeNull();
    // fewer players stored than asked for
    expect(parseBindings(JSON.stringify({ version: BINDINGS_VERSION, players: [payload.players[0]] }), 2)).toBeNull();
  });

  it('rejects a payload with a missing or malformed action', () => {
    for (const action of ACTIONS) {
      const bad = JSON.parse(serialiseBindings(defaultPlayerBindings(2))) as {
        version: number;
        players: { keyboard: { keys: Record<string, unknown> }; gamepad: { buttons: Record<string, unknown> } }[];
      };
      delete bad.players[0].keyboard.keys[action];
      expect(parseBindings(JSON.stringify(bad), 2)).toBeNull();
    }

    const wrongTypes = JSON.parse(serialiseBindings(defaultPlayerBindings(2))) as {
      players: { keyboard: { keys: Record<GameAction, unknown> }; gamepad: { buttons: Record<GameAction, unknown>; useDpad: unknown } }[];
      version: number;
    };
    wrongTypes.players[0].keyboard.keys.pickup = 'Space';
    expect(parseBindings(JSON.stringify(wrongTypes), 2)).toBeNull();

    const emptyArray = JSON.parse(serialiseBindings(defaultPlayerBindings(2))) as typeof wrongTypes;
    emptyArray.players[0].keyboard.keys.pickup = [];
    expect(parseBindings(JSON.stringify(emptyArray), 2)).toBeNull();

    const badButton = JSON.parse(serialiseBindings(defaultPlayerBindings(2))) as typeof wrongTypes;
    badButton.players[1].gamepad.buttons.pickup = [1.5];
    expect(parseBindings(JSON.stringify(badButton), 2)).toBeNull();

    const negativeButton = JSON.parse(serialiseBindings(defaultPlayerBindings(2))) as typeof wrongTypes;
    negativeButton.players[1].gamepad.buttons.pickup = [-1];
    expect(parseBindings(JSON.stringify(negativeButton), 2)).toBeNull();

    const badFlag = JSON.parse(serialiseBindings(defaultPlayerBindings(2))) as typeof wrongTypes;
    badFlag.players[1].gamepad.useDpad = 'yes';
    expect(parseBindings(JSON.stringify(badFlag), 2)).toBeNull();
  });
});

// ─── Defaults ───────────────────────────────────────────────────────────────
describe('defaults', () => {
  it('gives every action a binding on both devices', () => {
    for (const player of [0, 1]) {
      const kb = defaultKeyboardBinding(player);
      const pad = defaultGamepadBinding();
      for (const action of ACTIONS) {
        expect(kb.keys[action].length).toBeGreaterThan(0);
        expect(pad.buttons[action].length).toBeGreaterThan(0);
      }
    }
  });

  it('matches the documented layout', () => {
    const p1 = defaultKeyboardBinding(0);
    expect(p1.keys.up).toEqual(['KeyW']);
    expect(p1.keys.pickup).toEqual(['Space']);
    expect(p1.keys.interact).toEqual(['ShiftLeft', 'ControlLeft']);
    const p2 = defaultKeyboardBinding(1);
    expect(p2.keys.up).toEqual(['ArrowUp']);
    expect(p2.keys.pickup).toEqual(['Enter']);
    expect(p2.keys.interact).toEqual(['ShiftRight', 'ControlRight']);
    const pad = defaultGamepadBinding();
    expect(pad.buttons.pickup).toEqual([PAD_BUTTON.A]);
    expect(pad.buttons.interact).toEqual([PAD_BUTTON.X]);
    expect(pad.buttons.pause).toEqual([PAD_BUTTON.START]);
    expect(pad.buttons.up).toEqual([PAD_BUTTON.DPAD_UP]);
    expect(pad.padIndex).toBe(NO_PAD);
  });

  it('hands out independent copies', () => {
    const a = defaultKeyboardBinding(0);
    const b = defaultKeyboardBinding(0);
    a.keys.up.push('KeyZ');
    expect(b.keys.up).toEqual(['KeyW']);
  });
});
