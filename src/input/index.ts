// ─── Input manager ──────────────────────────────────────────────────────────
// Keyboard + Gamepad API, merged per player slot. Keyboard set i always drives slot i,
// so the game is playable with no pads at all; a pad assigned to slot i is OR-ed on top.
// All decoding lives in ./mapping (pure, unit-tested); this file only wires the DOM to it.

import type Phaser from 'phaser';
import { STORAGE_KEYS } from '../config';
import { log } from '../log';
import type { PlayerInput } from '../sim/types';
import type {
  Binding, CaptureResult, FullInputManager, GameAction, GamepadBinding, KeyboardBinding,
  PadInfo, PadKind, PlayerBindings, RawPlayerState,
} from './types';
import {
  ACTIONS, NO_PAD, STICK_DEADZONE,
  applyRadialDeadzone, clearHeldState, clearPlayerInput, copyHeldState, createHeldState,
  createPlayerInput, defaultKeyboardBinding, defaultGamepadBinding, defaultPlayerBindings,
  isPadButtonPressed, labelForAction, mergeHeldState, padKindFromId, parseBindings,
  readGamepad, readKeyboard, serialiseBindings, writePlayerInput,
  type HeldState, type Vec2,
} from './mapping';

export * from './types';
export * from './mapping';

// ─── Constants ──────────────────────────────────────────────────────────────
const NO_PLAYER = -1;
const KEYBOARD_DEVICE_NAME = 'Keyboard';

// ─── Internal state ─────────────────────────────────────────────────────────
interface PadRecord {
  index: number;
  id: string;
  kind: PadKind;
  player: number;      // NO_PLAYER when unassigned
  handled: boolean;    // false only until the auto-assign pass has seen it
  prevButtons: boolean[];
}

/** Slot i's live state, all pre-allocated so poll() never allocates. */
interface Slot {
  held: HeldState;
  prev: HeldState;
  out: PlayerInput;
  raw: RawPlayerState;
}

function createSlot(): Slot {
  const keysDown = {} as Record<GameAction, boolean>;
  for (let i = 0; i < ACTIONS.length; i++) keysDown[ACTIONS[i]] = false;
  return {
    held: createHeldState(),
    prev: createHeldState(),
    out: createPlayerInput(),
    raw: { padIndex: NO_PAD, padId: '', padKind: 'xbox', stickX: 0, stickY: 0, buttons: [], keysDown },
  };
}

// ─── Manager ────────────────────────────────────────────────────────────────
class BrowserInputManager implements FullInputManager {
  readonly players: number;

  private readonly bindings: PlayerBindings[];
  private readonly slots: Slot[];
  private readonly outputs: PlayerInput[];
  private readonly keysDown = new Set<string>();
  /**
   * Keys that went down since the last poll. A press shorter than one frame would
   * otherwise land and lift between two polls and be lost entirely, so a key counts as
   * held for the poll that follows its keydown even if it has already been released.
   */
  private readonly keysTapped = new Set<string>();
  /** Indexed by Gamepad.index. */
  private readonly padRecords: (PadRecord | null)[] = [];
  /** Gamepad.index per player slot, or NO_PAD. */
  private readonly playerPad: number[];
  private readonly padScratch: HeldState = createHeldState();
  private readonly vec: Vec2 = { x: 0, y: 0 };
  private readonly isKeyDown = (code: string): boolean => this.keysDown.has(code) || this.keysTapped.has(code);

  private livePads: (Gamepad | null)[] | null = null;
  private capturing = false;
  private captureResult: CaptureResult | null = null;
  private pendingClaim = NO_PAD;
  private destroyed = false;
  /**
   * Swallows rising edges for one frame. Set on the first poll and after a remap, so the
   * key or button that was just bound cannot immediately fire the action it was bound to.
   */
  private suppressEdges = true;

  constructor(players: number) {
    this.players = players;
    this.bindings = this.loadBindings(players);
    this.slots = [];
    this.outputs = [];
    this.playerPad = [];
    for (let i = 0; i < players; i++) {
      const slot = createSlot();
      this.slots.push(slot);
      this.outputs.push(slot.out);
      this.playerPad.push(NO_PAD);
    }
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onBlur);
    window.addEventListener('gamepadconnected', this.onPadConnected);
    window.addEventListener('gamepaddisconnected', this.onPadDisconnected);
  }

  // ── Per-frame ─────────────────────────────────────────────────────────────
  poll(): PlayerInput[] {
    this.syncPads();
    this.autoAssignPads();
    for (let i = 0; i < this.players; i++) {
      const slot = this.slots[i];
      copyHeldState(slot.held, slot.prev);
      readKeyboard(this.bindings[i].keyboard, this.isKeyDown, slot.held);
      const pad = this.padForPlayer(i);
      if (pad !== null) {
        readGamepad(pad, this.bindings[i].gamepad, this.padScratch, this.vec);
        mergeHeldState(slot.held, this.padScratch);
      }
      if (this.suppressEdges) copyHeldState(slot.held, slot.prev);
      writePlayerInput(slot.held, slot.prev, slot.out);
      if (this.capturing) clearPlayerInput(slot.out);
      this.updateRaw(i, pad);
    }
    this.suppressEdges = false;
    if (this.keysTapped.size > 0) this.keysTapped.clear();
    return this.outputs;
  }

  private padForPlayer(player: number): Gamepad | null {
    const index = this.playerPad[player];
    if (index === NO_PAD || this.livePads === null) return null;
    const pad = this.livePads[index];
    return pad && pad.connected ? pad : null;
  }

  private updateRaw(player: number, pad: Gamepad | null): void {
    const raw = this.slots[player].raw;
    const record = this.recordForPlayer(player);
    raw.padIndex = record === null ? NO_PAD : record.index;
    raw.padId = record === null ? '' : record.id;
    raw.padKind = record === null ? 'xbox' : record.kind;
    if (pad !== null) {
      applyRadialDeadzone(pad.axes[0] ?? 0, pad.axes[1] ?? 0, STICK_DEADZONE, this.vec);
      raw.stickX = this.vec.x;
      raw.stickY = this.vec.y;
      const count = pad.buttons.length;
      if (raw.buttons.length !== count) raw.buttons.length = count;
      for (let b = 0; b < count; b++) raw.buttons[b] = isPadButtonPressed(pad, b);
    } else {
      raw.stickX = 0;
      raw.stickY = 0;
      if (raw.buttons.length !== 0) raw.buttons.length = 0;
    }
    const keys = this.bindings[player].keyboard.keys;
    for (let a = 0; a < ACTIONS.length; a++) {
      const action = ACTIONS[a];
      const codes = keys[action];
      let down = false;
      for (let c = 0; c < codes.length; c++) if (this.isKeyDown(codes[c])) { down = true; break; }
      raw.keysDown[action] = down;
    }
  }

  // ── Pad bookkeeping ───────────────────────────────────────────────────────
  private syncPads(): void {
    const pads = typeof navigator !== 'undefined' && typeof navigator.getGamepads === 'function'
      ? navigator.getGamepads()
      : null;
    this.livePads = pads;
    if (pads === null) return;
    for (let i = 0; i < pads.length; i++) {
      const pad = pads[i];
      const record = this.padRecords[i];
      if (pad && pad.connected) {
        if (!record || record.id !== pad.id) this.addPad(i, pad.id, pad.buttons.length);
        this.trackPadButtons(pad);
      } else if (record) {
        this.removePad(i);
      }
    }
    for (let i = pads.length; i < this.padRecords.length; i++) {
      if (this.padRecords[i]) this.removePad(i);
    }
  }

  /** Rising edges per pad button, used for remap capture and pad claiming. */
  private trackPadButtons(pad: Gamepad): void {
    const record = this.padRecords[pad.index];
    if (!record) return;
    const count = pad.buttons.length;
    if (record.prevButtons.length !== count) record.prevButtons.length = count;
    for (let b = 0; b < count; b++) {
      const pressed = isPadButtonPressed(pad, b);
      if (pressed && record.prevButtons[b] !== true) this.onPadButtonDown(record, b);
      record.prevButtons[b] = pressed;
    }
  }

  private onPadButtonDown(record: PadRecord, button: number): void {
    if (this.capturing) {
      if (this.captureResult === null) this.captureResult = { kind: 'gamepad', padIndex: record.index, button };
      return;
    }
    // `handled` is false only on the press that first revealed the pad to the browser;
    // that press belongs to auto-assignment, not to a claim.
    if (record.handled && record.player === NO_PLAYER && this.pendingClaim === NO_PAD) this.pendingClaim = record.index;
  }

  private addPad(index: number, id: string, buttonCount: number): void {
    if (this.padRecords[index]) this.removePad(index);
    const prevButtons: boolean[] = [];
    for (let b = 0; b < buttonCount; b++) prevButtons.push(false);
    this.padRecords[index] = { index, id, kind: padKindFromId(id), player: NO_PLAYER, handled: false, prevButtons };
    log.info('gamepad seen', index, id);
  }

  private removePad(index: number): void {
    const record = this.padRecords[index];
    if (!record) return;
    if (record.player !== NO_PLAYER) {
      this.playerPad[record.player] = NO_PAD;
      this.bindings[record.player].gamepad.padIndex = NO_PAD;
    }
    this.padRecords[index] = null;
    log.info('gamepad gone', index, record.id);
  }

  /** New pads fill the lowest free slot; a pad the player unassigned stays unassigned. */
  private autoAssignPads(): void {
    for (let i = 0; i < this.padRecords.length; i++) {
      const record = this.padRecords[i];
      if (!record || record.handled) continue;
      record.handled = true;
      const slot = this.firstSlotWithoutPad();
      if (slot !== NO_PLAYER) this.assignPad(record.index, slot);
    }
  }

  private firstSlotWithoutPad(): number {
    for (let i = 0; i < this.players; i++) if (this.playerPad[i] === NO_PAD) return i;
    return NO_PLAYER;
  }

  private recordForPlayer(player: number): PadRecord | null {
    const index = this.playerPad[player];
    if (index === NO_PAD) return null;
    return this.padRecords[index] ?? null;
  }

  assignPad(padIndex: number, player: number): void {
    if (player < 0 || player >= this.players) return;
    const record = this.padRecords[padIndex];
    if (!record) return;
    if (record.player !== NO_PLAYER) this.unassignPad(record.player);
    const previous = this.playerPad[player];
    if (previous !== NO_PAD) this.unassignPad(player);
    record.player = player;
    record.handled = true;
    this.playerPad[player] = padIndex;
    this.bindings[player].gamepad.padIndex = padIndex;
  }

  unassignPad(player: number): void {
    const index = this.playerPad[player];
    if (index === NO_PAD) return;
    const record = this.padRecords[index];
    if (record) {
      record.player = NO_PLAYER;
      record.handled = true;
    }
    this.playerPad[player] = NO_PAD;
    this.bindings[player].gamepad.padIndex = NO_PAD;
  }

  pollPadClaim(): number {
    const claim = this.pendingClaim;
    this.pendingClaim = NO_PAD;
    return claim;
  }

  listPads(): PadInfo[] {
    const out: PadInfo[] = [];
    for (let i = 0; i < this.padRecords.length; i++) {
      const record = this.padRecords[i];
      if (!record) continue;
      out.push({ index: record.index, id: record.id, kind: record.kind, player: record.player });
    }
    return out;
  }

  // ── Remap capture ─────────────────────────────────────────────────────────
  startCapture(): void {
    this.capturing = true;
    this.captureResult = null;
    this.pendingClaim = NO_PAD;
  }

  isCapturing(): boolean {
    return this.capturing;
  }

  pollCapture(): CaptureResult | null {
    const result = this.captureResult;
    if (result === null) return null;
    this.captureResult = null;
    this.capturing = false;
    this.suppressEdges = true;
    return result;
  }

  cancelCapture(): void {
    this.capturing = false;
    this.captureResult = null;
  }

  // ── Bindings ──────────────────────────────────────────────────────────────
  getBinding(player: number): Binding {
    return this.playerPad[player] === NO_PAD ? this.bindings[player].keyboard : this.bindings[player].gamepad;
  }

  setBinding(player: number, binding: Binding): void {
    if (binding.kind === 'keyboard') this.setKeyboardBinding(player, binding);
    else this.setGamepadBinding(player, binding);
  }

  getKeyboardBinding(player: number): KeyboardBinding {
    return this.bindings[player].keyboard;
  }

  getGamepadBinding(player: number): GamepadBinding {
    return this.bindings[player].gamepad;
  }

  setKeyboardBinding(player: number, binding: KeyboardBinding): void {
    if (player < 0 || player >= this.players) return;
    this.bindings[player].keyboard = binding;
  }

  setGamepadBinding(player: number, binding: GamepadBinding): void {
    if (player < 0 || player >= this.players) return;
    binding.padIndex = this.playerPad[player];
    this.bindings[player].gamepad = binding;
  }

  resetBindings(player?: number): void {
    const first = player === undefined ? 0 : player;
    const last = player === undefined ? this.players - 1 : player;
    for (let i = first; i <= last; i++) {
      if (i < 0 || i >= this.players) continue;
      this.bindings[i].keyboard = defaultKeyboardBinding(i);
      this.bindings[i].gamepad = defaultGamepadBinding(this.playerPad[i]);
    }
  }

  labelFor(player: number, action: GameAction): string {
    const record = this.recordForPlayer(player);
    const bindings = this.bindings[player];
    return labelForAction(action, bindings.keyboard, record === null ? null : { binding: bindings.gamepad, id: record.id });
  }

  getDeviceName(player: number): string {
    const record = this.recordForPlayer(player);
    return record === null ? KEYBOARD_DEVICE_NAME : record.id;
  }

  getPadIndex(player: number): number {
    return this.playerPad[player];
  }

  getPadKind(player: number): PadKind {
    const record = this.recordForPlayer(player);
    return record === null ? 'xbox' : record.kind;
  }

  getRawState(player: number): Readonly<RawPlayerState> {
    return this.slots[player].raw;
  }

  // ── Persistence ───────────────────────────────────────────────────────────
  private loadBindings(players: number): PlayerBindings[] {
    try {
      const parsed = parseBindings(window.localStorage.getItem(STORAGE_KEYS.BINDINGS), players);
      if (parsed !== null) return parsed;
      log.info('bindings: using defaults');
    } catch (err) {
      log.warn('bindings load failed', err);
    }
    return defaultPlayerBindings(players);
  }

  save(): void {
    try {
      window.localStorage.setItem(STORAGE_KEYS.BINDINGS, serialiseBindings(this.bindings));
    } catch (err) {
      log.warn('bindings save failed', err);
    }
  }

  // ── DOM listeners ─────────────────────────────────────────────────────────
  private readonly onKeyDown = (e: KeyboardEvent): void => {
    if (e.repeat) return;
    if (this.capturing && this.captureResult === null) {
      this.captureResult = e.code === 'Escape' ? { kind: 'cancel' } : { kind: 'keyboard', code: e.code };
    }
    this.keysDown.add(e.code);
    this.keysTapped.add(e.code);
  };

  private readonly onKeyUp = (e: KeyboardEvent): void => {
    this.keysDown.delete(e.code);
  };

  /** Losing focus mid-press would otherwise leave a key stuck down forever. */
  private readonly onBlur = (): void => {
    this.keysDown.clear();
    this.keysTapped.clear();
    for (let i = 0; i < this.slots.length; i++) clearHeldState(this.slots[i].held);
  };

  private readonly onPadConnected = (e: GamepadEvent): void => {
    this.addPad(e.gamepad.index, e.gamepad.id, e.gamepad.buttons.length);
  };

  private readonly onPadDisconnected = (e: GamepadEvent): void => {
    this.removePad(e.gamepad.index);
  };

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.onBlur);
    window.removeEventListener('gamepadconnected', this.onPadConnected);
    window.removeEventListener('gamepaddisconnected', this.onPadDisconnected);
    this.keysDown.clear();
    this.keysTapped.clear();
  }
}

// ─── Factory ────────────────────────────────────────────────────────────────
export function createInputManager(_scene: Phaser.Scene, players: number): FullInputManager {
  return new BrowserInputManager(players);
}
