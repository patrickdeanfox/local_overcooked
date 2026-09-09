import { describe, expect, it } from 'vitest';
import {
  ACTIONS, BINDINGS_VERSION, DEADZONE_MAX, DEADZONE_MIN, DEADZONE_STEP, KEYBOARD_SET_COUNT, LATER_ACTIONS, NO_PAD, PAD_BUTTON,
  STICK_DEADZONE,
  applyRadialDeadzone, axisEdge, clampDeadzone, clearEdgeLatch, cloneGamepadBinding, createEdgeLatch, createHeldState,
  createPlayerInput, copyHeldState,
  defaultBindingsStore, defaultGamepadBinding, defaultKeyboardBinding, defaultPlayerBindings,
  keyCodeLabel, keyboardSetLabel, labelForAction, latchEdges, menuLabels, mergeHeldState, padBindingFor, padButtonLabel,
  padKindFromId, parseBindings, readGamepad, readKeyboard, readMenuInput, serialiseBindings, swapKeyboardSets,
  writePlayerInput, writeStepInput,
  type BindingsStore, type PadSnapshot, type Vec2,
} from '../src/input/mapping';
import type { PlayerInput } from '../src/sim/types';
import type { GameAction, HintAction } from '../src/input/types';

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

  it('reports throw and dash as rising edges', () => {
    const held = createHeldState();
    const prev = createHeldState();
    const out = createPlayerInput();
    held.throw = true;
    held.dash = true;
    writePlayerInput(held, prev, out);
    expect(out.throwPressed).toBe(true);
    expect(out.dashPressed).toBe(true);
    copyHeldState(held, prev);
    writePlayerInput(held, prev, out);
    expect(out.throwPressed).toBe(false);
    expect(out.dashPressed).toBe(false);
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
    expect(held.dash).toBe(true); // B is menu back and the in-game dash at once

    readGamepad(fakePad({ pressed: [PAD_BUTTON.Y] }), binding, held, vec());
    expect(held.throw).toBe(true);
    expect(held.dash).toBe(false);
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

  it('uses the pad\'s own deadzone when it has one', () => {
    const held = createHeldState();
    readGamepad(fakePad({ axes: [0.4, 0, 0, 0] }), binding, held, vec());
    expect(held.moveX).toBeGreaterThan(0);               // past the default 0.25
    readGamepad(fakePad({ axes: [0.4, 0, 0, 0] }), { ...binding, deadzone: 0.5 }, held, vec());
    expect(held.moveX).toBe(0);                          // inside this pad's 0.5
    readGamepad(fakePad({ axes: [0.2, 0, 0, 0] }), { ...binding, deadzone: 0 }, held, vec());
    expect(held.moveX).toBeCloseTo(0.2, 6);              // no deadzone at all
  });

  it('clamps a deadzone to its range in whole steps', () => {
    expect(clampDeadzone(STICK_DEADZONE + DEADZONE_STEP)).toBeCloseTo(0.3, 9);
    expect(clampDeadzone(-1)).toBe(DEADZONE_MIN);
    expect(clampDeadzone(5)).toBe(DEADZONE_MAX);
    expect(clampDeadzone(0.26)).toBeCloseTo(0.25, 9);
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

  it('reads throw and dash from their keys', () => {
    const held = createHeldState();
    readKeyboard(defaultKeyboardBinding(0), (c) => c === 'KeyE', held);
    expect(held.throw).toBe(true);
    expect(held.dash).toBe(false);
    readKeyboard(defaultKeyboardBinding(0), (c) => c === 'KeyQ', held);
    expect(held.dash).toBe(true);
    readKeyboard(defaultKeyboardBinding(1), (c) => c === 'Slash', held);
    expect(held.throw).toBe(true);
    readKeyboard(defaultKeyboardBinding(1), (c) => c === 'Period', held);
    expect(held.dash).toBe(true);
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

  it('names the fixed menu-back button and an unbound action', () => {
    const keyboard = defaultKeyboardBinding(0);
    const gamepad = defaultGamepadBinding(0);
    expect(labelForAction('back', keyboard, null)).toBe('Bksp');
    expect(labelForAction('back', keyboard, { binding: gamepad, id: XBOX_ID })).toBe('B');
    expect(labelForAction('back', keyboard, { binding: gamepad, id: 'DualSense Wireless Controller' })).toBe('Circle');
    const bare = defaultKeyboardBinding(0);
    bare.keys.pickup = [];
    expect(labelForAction('pickup', bare, null)).toBe('—');
  });

  it('builds the words of a menu hint line for either device', () => {
    const keyboard = defaultKeyboardBinding(0);
    const onKeys = (action: HintAction): string => labelForAction(action, keyboard, null);
    expect(menuLabels(onKeys)).toEqual({ choose: 'W / S', change: 'A / D', select: 'Space', back: 'Esc or Bksp' });
    const pad = { binding: defaultGamepadBinding(0), id: 'DualSense Wireless Controller' };
    const onPad = (action: HintAction): string => labelForAction(action, keyboard, pad);
    expect(menuLabels(onPad)).toEqual({ choose: 'Stick', change: 'Stick', select: 'Cross', back: 'Options or Circle' });
    const dpadOnly = { binding: { ...defaultGamepadBinding(0), useLeftStick: false }, id: XBOX_ID };
    expect(menuLabels((action) => labelForAction(action, keyboard, dpadOnly)).choose).toBe('↑ / ↓');
  });

  it('names a keyboard set by its movement keys', () => {
    expect(keyboardSetLabel(0, defaultKeyboardBinding(0))).toBe('Keyboard set 1 (W A S D)');
    expect(keyboardSetLabel(1, defaultKeyboardBinding(1))).toBe('Keyboard set 2 (↑ ← ↓ →)');
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

// ─── Fixed-step edge latch ──────────────────────────────────────────────────
describe('edge latch', () => {
  const STEP = 1 / 60;

  /** Mirrors GameScene.runSim: latch the frame's edges, then feed whole fixed steps. */
  function loop() {
    const latch = createEdgeLatch();
    const out = createPlayerInput();
    let accumulator = 0;
    return function frame(input: PlayerInput, deltaSec: number): PlayerInput[] {
      accumulator += deltaSec;
      latchEdges(latch, input);
      const stepped: PlayerInput[] = [];
      while (accumulator >= STEP) {
        const first = stepped.length === 0;
        writeStepInput(input, latch, first, out);
        stepped.push({ ...out });
        if (first) clearEdgeLatch(latch);
        accumulator -= STEP;
      }
      return stepped;
    };
  }

  function press(): PlayerInput {
    const input = createPlayerInput();
    input.pickupPressed = true;
    input.interactPressed = true;
    input.interactHeld = true;
    input.throwPressed = true;
    input.dashPressed = true;
    return input;
  }

  it('keeps a press polled on a frame that runs no step', () => {
    const frame = loop();
    expect(frame(press(), STEP / 2)).toEqual([]); // short frame: nothing stepped
    const stepped = frame(createPlayerInput(), STEP / 2);
    expect(stepped.length).toBe(1);
    expect(stepped[0].pickupPressed).toBe(true);
    expect(stepped[0].interactPressed).toBe(true);
    expect(stepped[0].throwPressed).toBe(true);
    expect(stepped[0].dashPressed).toBe(true);
  });

  it('fires a press on the first sub-step only', () => {
    const frame = loop();
    const stepped = frame(press(), STEP * 3);
    expect(stepped.length).toBe(3);
    expect(stepped.map((s) => s.pickupPressed)).toEqual([true, false, false]);
    expect(stepped.map((s) => s.throwPressed)).toEqual([true, false, false]);
    expect(stepped.map((s) => s.dashPressed)).toEqual([true, false, false]);
    expect(stepped.map((s) => s.interactHeld)).toEqual([true, true, true]);
  });

  it('does not repeat a press on later frames', () => {
    const frame = loop();
    expect(frame(press(), STEP)[0].pickupPressed).toBe(true);
    expect(frame(createPlayerInput(), STEP)[0].pickupPressed).toBe(false);
  });

  it('takes movement and held state from the live poll, not the latch', () => {
    const latch = createEdgeLatch();
    const src = createPlayerInput();
    src.moveX = -0.5;
    src.moveY = 0.25;
    src.interactHeld = true;
    src.pausePressed = true;
    src.backPressed = true;
    const out = writeStepInput(src, latch, true, createPlayerInput());
    expect(out.moveX).toBe(-0.5);
    expect(out.moveY).toBe(0.25);
    expect(out.interactHeld).toBe(true);
    expect(out.pickupPressed).toBe(false); // nothing latched
    expect(out.pausePressed).toBe(false);  // menu edges never reach the sim
    expect(out.backPressed).toBe(false);
  });
});

// ─── The store ──────────────────────────────────────────────────────────────
describe('bindings store', () => {
  it('starts every player on their own keyboard set with no pads known', () => {
    const store = defaultBindingsStore(2);
    expect(store.keyboards.length).toBe(KEYBOARD_SET_COUNT);
    expect(store.players.map((p) => p.keyboardSet)).toEqual([0, 1]);
    expect(store.pads).toEqual({});
    expect(store.players[0].gamepad.padIndex).toBe(NO_PAD);
  });

  it('swaps keyboard sets so two players never share one', () => {
    const store = defaultBindingsStore(2);
    swapKeyboardSets(store, 0, 1);
    expect(store.players.map((p) => p.keyboardSet)).toEqual([1, 0]);
    swapKeyboardSets(store, 0, 1); // already held: nothing moves
    expect(store.players.map((p) => p.keyboardSet)).toEqual([1, 0]);
    swapKeyboardSets(store, 1, 7); // no such set
    expect(store.players.map((p) => p.keyboardSet)).toEqual([1, 0]);
  });

  it('gives a known pad its own map and an unknown pad the slot fallback', () => {
    const store = defaultBindingsStore(2);
    const own = defaultGamepadBinding();
    own.buttons.pickup = [PAD_BUTTON.Y];
    store.pads['DualSense Wireless Controller'] = own;
    expect(padBindingFor(store, 0, 'DualSense Wireless Controller')).toBe(own);
    expect(padBindingFor(store, 1, 'never seen')).toBe(store.players[1].gamepad);
  });

  it('clones a pad binding without its session pad index', () => {
    const binding = defaultGamepadBinding(3);
    binding.deadzone = 0.4;
    const copy = cloneGamepadBinding(binding);
    expect(copy.padIndex).toBe(NO_PAD);
    expect(copy.deadzone).toBe(0.4);
    expect(copy.buttons.up).not.toBe(binding.buttons.up);
    expect(cloneGamepadBinding(defaultGamepadBinding()).deadzone).toBeUndefined();
  });
});

// ─── Persistence ────────────────────────────────────────────────────────────
describe('bindings persistence', () => {
  it('round-trips the store through JSON', () => {
    const store = defaultBindingsStore(2);
    store.keyboards[0].keys.pickup = ['KeyF'];
    store.players[1].gamepad.buttons.interact = [PAD_BUTTON.Y];
    store.players[1].gamepad.useDpad = false;
    swapKeyboardSets(store, 0, 1);
    const pad = defaultGamepadBinding();
    pad.buttons.pickup = [PAD_BUTTON.RB, PAD_BUTTON.A];
    pad.deadzone = 0.35;
    store.pads['DualSense Wireless Controller'] = pad;

    const parsed = parseBindings(serialiseBindings(store), 2);
    expect(parsed).not.toBeNull();
    if (parsed === null) return;
    expect(parsed.keyboards[0].keys.pickup).toEqual(['KeyF']);
    expect(parsed.players.map((p) => p.keyboardSet)).toEqual([1, 0]);
    expect(parsed.players[1].gamepad.buttons.interact).toEqual([PAD_BUTTON.Y]);
    expect(parsed.players[1].gamepad.useDpad).toBe(false);
    expect(parsed.pads['DualSense Wireless Controller']).toMatchObject({ buttons: { pickup: [PAD_BUTTON.RB, PAD_BUTTON.A] }, deadzone: 0.35 });
    for (const action of ACTIONS) expect(parsed.keyboards[1].keys[action].length).toBeGreaterThan(0);
  });

  it('never persists the live pad assignment', () => {
    const store = defaultBindingsStore(2);
    store.players[0].gamepad.padIndex = 3;
    store.pads.x = defaultGamepadBinding(2);
    const parsed = parseBindings(serialiseBindings(store), 2);
    expect(parsed?.players[0].gamepad.padIndex).toBe(NO_PAD);
    expect(parsed?.pads.x.padIndex).toBe(NO_PAD);
  });

  it('returns fresh arrays, not references into the payload', () => {
    const json = serialiseBindings(defaultBindingsStore(2));
    const a = parseBindings(json, 2);
    const b = parseBindings(json, 2);
    expect(a?.keyboards[0].keys.up).not.toBe(b?.keyboards[0].keys.up);
  });

  it('keeps an action unbound on one device', () => {
    const store = defaultBindingsStore(2);
    store.keyboards[0].keys.pause = [];
    store.players[0].gamepad.buttons.interact = [];
    const parsed = parseBindings(serialiseBindings(store), 2);
    expect(parsed?.keyboards[0].keys.pause).toEqual([]);
    expect(parsed?.players[0].gamepad.buttons.interact).toEqual([]);
  });

  it('migrates a v1 payload: each keyboard becomes that player\'s set, pads stay unknown', () => {
    const v1 = defaultPlayerBindings(2);
    v1[0].keyboard.keys.pickup = ['KeyF'];
    v1[1].gamepad.buttons.pickup = [PAD_BUTTON.Y];
    const raw = JSON.stringify({ version: 1, players: v1 });
    const parsed = parseBindings(raw, 2);
    expect(parsed).not.toBeNull();
    if (parsed === null) return;
    expect(parsed.keyboards.length).toBe(2);
    expect(parsed.keyboards[0].keys.pickup).toEqual(['KeyF']);
    expect(parsed.players.map((p) => p.keyboardSet)).toEqual([0, 1]);
    expect(parsed.players[1].gamepad.buttons.pickup).toEqual([PAD_BUTTON.Y]);
    expect(parsed.pads).toEqual({});
    // and it comes back out as v2
    expect((JSON.parse(serialiseBindings(parsed)) as { version: number }).version).toBe(BINDINGS_VERSION);
  });

  it('rejects anything unusable and lets the caller fall back to defaults', () => {
    const payload = JSON.parse(serialiseBindings(defaultBindingsStore(2))) as BindingsStore & { version: number };

    expect(parseBindings(null, 2)).toBeNull();
    expect(parseBindings('', 2)).toBeNull();
    expect(parseBindings('not json at all', 2)).toBeNull();
    expect(parseBindings('[]', 2)).toBeNull();
    expect(parseBindings('"a string"', 2)).toBeNull();
    expect(parseBindings(JSON.stringify({ ...payload, version: BINDINGS_VERSION + 1 }), 2)).toBeNull();
    expect(parseBindings(JSON.stringify({ ...payload, version: undefined }), 2)).toBeNull();
    expect(parseBindings(JSON.stringify({ version: BINDINGS_VERSION }), 2)).toBeNull();
    // fewer players stored than asked for
    expect(parseBindings(JSON.stringify({ ...payload, players: [payload.players[0]] }), 2)).toBeNull();
    // no keyboard sets at all
    expect(parseBindings(JSON.stringify({ ...payload, keyboards: [] }), 2)).toBeNull();
    // pads must be an object
    expect(parseBindings(JSON.stringify({ ...payload, pads: [] }), 2)).toBeNull();
    // v1 with a broken player
    expect(parseBindings(JSON.stringify({ version: 1, players: [{}, {}] }), 2)).toBeNull();
  });

  it('fills throw and dash with their defaults in a map saved before they existed', () => {
    type Loose = { keyboards: { keys: Record<string, unknown> }[]; players: { gamepad: { buttons: Record<string, unknown> } }[] };
    const old = JSON.parse(serialiseBindings(defaultBindingsStore(2))) as Loose;
    for (const action of LATER_ACTIONS) {
      delete old.keyboards[0].keys[action];
      delete old.keyboards[1].keys[action];
      delete old.players[1].gamepad.buttons[action];
    }
    const parsed = parseBindings(JSON.stringify(old), 2);
    expect(parsed).not.toBeNull();
    if (parsed === null) return;
    expect(parsed.keyboards[0].keys.throw).toEqual(['KeyE']);
    expect(parsed.keyboards[1].keys.dash).toEqual(['Period']);
    expect(parsed.players[1].gamepad.buttons.throw).toEqual([PAD_BUTTON.Y]);
    expect(parsed.players[1].gamepad.buttons.dash).toEqual([PAD_BUTTON.B]);
    // and a v1 payload from before them
    const v1 = defaultPlayerBindings(2);
    delete (v1[0].keyboard.keys as Partial<Record<string, string[]>>).throw;
    delete (v1[0].gamepad.buttons as Partial<Record<string, number[]>>).dash;
    const migrated = parseBindings(JSON.stringify({ version: 1, players: v1 }), 2);
    expect(migrated?.keyboards[0].keys.throw).toEqual(['KeyE']);
    expect(migrated?.players[0].gamepad.buttons.dash).toEqual([PAD_BUTTON.B]);
  });

  it('rejects two players on one keyboard set or a set that does not exist', () => {
    const shared = JSON.parse(serialiseBindings(defaultBindingsStore(2))) as BindingsStore;
    shared.players[1].keyboardSet = 0;
    expect(parseBindings(JSON.stringify({ version: BINDINGS_VERSION, ...shared }), 2)).toBeNull();
    const missing = JSON.parse(serialiseBindings(defaultBindingsStore(2))) as BindingsStore;
    missing.players[1].keyboardSet = 5;
    expect(parseBindings(JSON.stringify({ version: BINDINGS_VERSION, ...missing }), 2)).toBeNull();
  });

  it('rejects a payload with a missing or malformed action', () => {
    type Loose = {
      version: number;
      keyboards: { keys: Record<string, unknown> }[];
      players: { keyboardSet: number; gamepad: { buttons: Record<string, unknown>; useDpad: unknown; deadzone?: unknown } }[];
      pads: Record<string, { buttons: Record<string, unknown> }>;
    };
    const fresh = (): Loose => JSON.parse(serialiseBindings(defaultBindingsStore(2))) as Loose;
    for (const action of ACTIONS) {
      if (LATER_ACTIONS.includes(action)) continue; // those get their defaults instead
      const bad = fresh();
      delete bad.keyboards[0].keys[action];
      expect(parseBindings(JSON.stringify(bad), 2)).toBeNull();
    }

    const wrongTypes = fresh();
    wrongTypes.keyboards[0].keys.pickup = 'Space';
    expect(parseBindings(JSON.stringify(wrongTypes), 2)).toBeNull();

    const badButton = fresh();
    badButton.players[1].gamepad.buttons.pickup = [1.5];
    expect(parseBindings(JSON.stringify(badButton), 2)).toBeNull();

    const negativeButton = fresh();
    negativeButton.players[1].gamepad.buttons.pickup = [-1];
    expect(parseBindings(JSON.stringify(negativeButton), 2)).toBeNull();

    const badFlag = fresh();
    badFlag.players[1].gamepad.useDpad = 'yes';
    expect(parseBindings(JSON.stringify(badFlag), 2)).toBeNull();

    const badDeadzone = fresh();
    badDeadzone.players[1].gamepad.deadzone = 2;
    expect(parseBindings(JSON.stringify(badDeadzone), 2)).toBeNull();

    const badPad = fresh();
    badPad.pads['some pad'] = { buttons: {} };
    expect(parseBindings(JSON.stringify(badPad), 2)).toBeNull();
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
    expect(p1.keys.throw).toEqual(['KeyE']);
    expect(p1.keys.dash).toEqual(['KeyQ']);
    const p2 = defaultKeyboardBinding(1);
    expect(p2.keys.up).toEqual(['ArrowUp']);
    expect(p2.keys.pickup).toEqual(['Enter']);
    expect(p2.keys.interact).toEqual(['ShiftRight', 'ControlRight']);
    expect(p2.keys.throw).toEqual(['Slash']);
    expect(p2.keys.dash).toEqual(['Period']);
    const pad = defaultGamepadBinding();
    expect(pad.buttons.pickup).toEqual([PAD_BUTTON.A]);
    expect(pad.buttons.interact).toEqual([PAD_BUTTON.X]);
    expect(pad.buttons.pause).toEqual([PAD_BUTTON.START]);
    expect(pad.buttons.throw).toEqual([PAD_BUTTON.Y]);
    expect(pad.buttons.dash).toEqual([PAD_BUTTON.B]);
    expect(ACTIONS.length).toBe(9);
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
