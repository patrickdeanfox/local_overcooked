// ─── Controllers page ───────────────────────────────────────────────────────
// One column per player: a live view of the stick, d-pad, face buttons and keys, then a
// table. The Device row says which keyboard set or pad the player holds (left / right
// changes it; a pad another player holds is swapped, a keyboard set releases the pad).
// "Set up controls" walks through every action one press at a time. Selecting an action
// row adds the next key or button to it; the chop button clears it for the chosen device.
// Stick, d-pad and deadzone rows belong to the pad the player holds and are remembered by
// pad id. Everything is saved at once. Owned by the input arm.
import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH, MAX_PLAYERS, SCENE } from '../../config';
import { TEX } from '../../art/keys';
import {
  ACTIONS, ACTION_NAMES, DEADZONE_STEP, NO_PAD, PAD_BUTTON, STICK_DEADZONE,
  axisEdge, clampDeadzone, cloneGamepadBinding, createInputManager, createPlayerInput, keyCodeLabel, keyboardSetLabel,
  padButtonLabel, readMenuInput,
} from '../../input';
import type { CaptureResult, DeviceChoice, FullInputManager, GameAction, PadKind, PlayerInput } from '../../input';

// ─── Layout constants ───────────────────────────────────────────────────────
const PANEL_COUNT = MAX_PLAYERS;
const MARGIN_X = 32;
const PANEL_GAP = 16;
const PANEL_W = (GAME_WIDTH - MARGIN_X * 2 - PANEL_GAP) / PANEL_COUNT;
const PANEL_Y = 108;
const PANEL_H = 650;
const PANEL_RADIUS = 10;

const VIZ_CY = PANEL_Y + 118;
const STICK_CX = 82;
const STICK_R = 46;
const STICK_DOT_R = 9;
const DPAD_CX = 200;
const FACE_CX = 318;
const FACE_OFFSET = 32;
const FACE_R = 18;
const KEY_CX = 468;
const KEY_CY = PANEL_Y + 106;
const KEY_W = 30;
const KEY_H = 28;

const HEADER_Y = PANEL_Y + 192;
const LIST_TOP = PANEL_Y + 210;
const ROW_H = 30;
const COL_ACTION_X = 18;
const COL_KEY_X = 268;
const COL_PAD_X = 452;
const FOOTNOTE_Y = PANEL_Y + PANEL_H - 22;
const VALUE_MAX_CHARS = 34; // pad ids run long; the value column is about this wide

const COLOR = {
  panel: 0x241d1a,
  panelEdge: 0x4a3f38,
  panelEdgeActive: 0xffb347,
  device: 0x3a322c,
  deviceOn: 0x6ee06e,
  keyOn: 0x2e7d32,   // darker, so the white key label stays readable
  rowActive: 0x3d3128,
  rowCapture: 0x6b4a1f,
  stick: 0x4a3f38,
  stickDot: 0xffb347,
} as const;

const TEXT = {
  bright: '#f2e8dc',
  dim: '#9c8f82',
  accent: '#ffb347',
  dark: '#241d1a',
} as const;

const FONT = 'system-ui, "Segoe UI", Arial, sans-serif';
const INSECURE_WARNING_COLOR = '#ff7b6b';
const UNBOUND = '—';

const FIRST_RUN_STATUS = 'First time here? Choose "Set up controls" to walk through every button.';
const CLAIM_HINT = 'Press a button on an unassigned pad to give it to the highlighted player.';
const INSECURE_HINT = 'Gamepads are blocked on plain http from another device. Open the https:// address printed by npm start (accept the certificate warning once), or use the keyboard.';
const TOP_HINT = 'Move: WASD / arrows / stick     Choose: Space, Enter or A     Back: Esc or B     Left / right: switch player, or change a setting row';
const FOOTNOTE = 'Select a row to add a key or button · the chop button clears it for the chosen device · Esc cancels';

/** ASCII stand-ins used when the art module has not generated a prompt texture yet. */
const PAD_GLYPH: Record<string, string | undefined> = {
  A: 'A', B: 'B', X: 'X', Y: 'Y',
  Cross: 'X', Circle: 'O', Square: '[]', Triangle: '/\\',
};

// ─── Rows ───────────────────────────────────────────────────────────────────
type RowKind = 'device' | 'wizard' | 'action' | 'stick' | 'dpad' | 'deadzone' | 'reset';
interface RowSpec { kind: RowKind; action?: GameAction; }
/** The table, top to bottom. Setting rows take left / right for their value. */
const ROWS: readonly RowSpec[] = [
  { kind: 'device' },
  { kind: 'wizard' },
  ...ACTIONS.map((action): RowSpec => ({ kind: 'action', action })),
  { kind: 'stick' },
  { kind: 'dpad' },
  { kind: 'deadzone' },
  { kind: 'reset' },
];
const ROW_COUNT = ROWS.length;
const SETTING_ROWS: readonly RowKind[] = ['device', 'stick', 'dpad', 'deadzone'];

interface FaceSlot { button: number; dx: number; dy: number; }
const FACE_SLOTS: readonly FaceSlot[] = [
  { button: PAD_BUTTON.Y, dx: 0, dy: -FACE_OFFSET },
  { button: PAD_BUTTON.B, dx: FACE_OFFSET, dy: 0 },
  { button: PAD_BUTTON.A, dx: 0, dy: FACE_OFFSET },
  { button: PAD_BUTTON.X, dx: -FACE_OFFSET, dy: 0 },
];

interface DpadSlot { button: number; dx: number; dy: number; w: number; h: number; }
const DPAD_SLOTS: readonly DpadSlot[] = [
  { button: PAD_BUTTON.DPAD_UP, dx: -9, dy: -31, w: 18, h: 22 },
  { button: PAD_BUTTON.DPAD_DOWN, dx: -9, dy: 9, w: 18, h: 22 },
  { button: PAD_BUTTON.DPAD_LEFT, dx: -31, dy: -9, w: 22, h: 18 },
  { button: PAD_BUTTON.DPAD_RIGHT, dx: 9, dy: -9, w: 22, h: 18 },
];

interface KeySlot { action: GameAction; dx: number; dy: number; w: number; }
const KEY_SLOTS: readonly KeySlot[] = [
  { action: 'up', dx: 0, dy: -32, w: KEY_W },
  { action: 'left', dx: -34, dy: 0, w: KEY_W },
  { action: 'down', dx: 0, dy: 0, w: KEY_W },
  { action: 'right', dx: 34, dy: 0, w: KEY_W },
  { action: 'pickup', dx: 0, dy: 38, w: 104 },
  { action: 'interact', dx: 0, dy: 72, w: 104 },
];

/** The guided setup: one action at a time for one player. */
interface Wizard { player: number; step: number; }

// ─── Prompt badge ───────────────────────────────────────────────────────────
/** Uses TEX.buttonPrompt(label) when the art module has drawn it, plain text otherwise. */
class PromptBadge {
  private readonly image: Phaser.GameObjects.Image;
  private readonly text: Phaser.GameObjects.Text;
  private label = '';
  private pressed = false;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    this.image = scene.add.image(x, y, '__DEFAULT').setVisible(false);
    this.text = scene.add.text(x, y, '', { fontFamily: FONT, fontSize: '15px', color: TEXT.dark }).setOrigin(0.5);
  }

  setLabel(scene: Phaser.Scene, label: string): void {
    if (label === this.label) return;
    this.label = label;
    const key = TEX.buttonPrompt(label);
    if (scene.textures.exists(key)) {
      // Size it to the badge: the art contract does not fix the prompt texture size.
      this.image.setTexture(key).setDisplaySize(FACE_R * 2, FACE_R * 2).setVisible(true);
      this.text.setVisible(false);
      return;
    }
    this.image.setVisible(false);
    this.text.setText(PAD_GLYPH[label] ?? label).setVisible(true);
  }

  setPressed(pressed: boolean): void {
    if (pressed === this.pressed) return;
    this.pressed = pressed;
    this.image.setAlpha(pressed ? 1 : 0.75);
    this.text.setColor(pressed ? TEXT.dark : TEXT.bright);
  }
}

// ─── Panel widgets ──────────────────────────────────────────────────────────
interface RowTexts {
  name: Phaser.GameObjects.Text;
  key: Phaser.GameObjects.Text;
  pad: Phaser.GameObjects.Text;
}

interface Panel {
  title: Phaser.GameObjects.Text;
  rows: RowTexts[];
  keyLabels: Phaser.GameObjects.Text[];
  faces: PromptBadge[];
}

// ─── Scene ──────────────────────────────────────────────────────────────────
export class ControllerScene extends Phaser.Scene {
  private mgr!: FullInputManager;
  private gfx!: Phaser.GameObjects.Graphics;
  private panels: Panel[] = [];
  private status!: Phaser.GameObjects.Text;

  private column = 0;
  private row = 0;
  private prevMenuX = 0;
  private prevMenuY = 0;
  private capturingAction: GameAction | null = null;
  private wizard: Wizard | null = null;
  private labelsDirty = true;
  private deviceNames: string[] = [];
  private readonly menu: PlayerInput = createPlayerInput();

  constructor() { super(SCENE.CONTROLLER); }

  create(): void {
    this.mgr = createInputManager(this, PANEL_COUNT);
    this.column = 0;
    this.row = 0;
    this.capturingAction = null;
    this.wizard = null;
    this.labelsDirty = true;
    this.deviceNames = [];
    this.panels = [];

    this.gfx = this.add.graphics();

    this.add.text(GAME_WIDTH / 2, 32, 'CONTROLLERS', { fontFamily: FONT, fontSize: '30px', color: TEXT.bright }).setOrigin(0.5);
    this.add.text(GAME_WIDTH / 2, 62, TOP_HINT, { fontFamily: FONT, fontSize: '14px', color: TEXT.dim }).setOrigin(0.5);
    // Browsers block the Gamepad API on plain http from any address other than localhost.
    const insecure = typeof window !== 'undefined' && !window.isSecureContext;
    this.add.text(GAME_WIDTH / 2, 86, insecure ? INSECURE_HINT : CLAIM_HINT,
      { fontFamily: FONT, fontSize: '14px', color: insecure ? INSECURE_WARNING_COLOR : TEXT.dim }).setOrigin(0.5);

    for (let p = 0; p < PANEL_COUNT; p++) this.panels.push(this.buildPanel(p));

    this.status = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 22, '', { fontFamily: FONT, fontSize: '16px', color: TEXT.accent }).setOrigin(0.5);
    if (!this.mgr.hasSavedBindings()) this.status.setText(FIRST_RUN_STATUS);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.mgr.destroy());
  }

  // ── Construction ──────────────────────────────────────────────────────────
  private buildPanel(index: number): Panel {
    const px = panelX(index);
    const title = this.add.text(px + 18, PANEL_Y + 12, `PLAYER ${index + 1}`, { fontFamily: FONT, fontSize: '20px', color: TEXT.bright });

    this.add.text(px + COL_ACTION_X, HEADER_Y, 'ACTION', { fontFamily: FONT, fontSize: '12px', color: TEXT.dim });
    this.add.text(px + COL_KEY_X, HEADER_Y, 'KEYBOARD', { fontFamily: FONT, fontSize: '12px', color: TEXT.dim });
    this.add.text(px + COL_PAD_X, HEADER_Y, 'GAMEPAD', { fontFamily: FONT, fontSize: '12px', color: TEXT.dim });

    const rows: RowTexts[] = [];
    for (let r = 0; r < ROW_COUNT; r++) {
      const y = rowCenterY(r);
      rows.push({
        name: this.add.text(px + COL_ACTION_X, y, '', { fontFamily: FONT, fontSize: '15px', color: TEXT.bright }).setOrigin(0, 0.5),
        key: this.add.text(px + COL_KEY_X, y, '', { fontFamily: FONT, fontSize: '14px', color: TEXT.dim }).setOrigin(0, 0.5),
        pad: this.add.text(px + COL_PAD_X, y, '', { fontFamily: FONT, fontSize: '14px', color: TEXT.dim }).setOrigin(0, 0.5),
      });
    }

    const keyLabels: Phaser.GameObjects.Text[] = [];
    for (let k = 0; k < KEY_SLOTS.length; k++) {
      const slot = KEY_SLOTS[k];
      keyLabels.push(this.add.text(px + KEY_CX + slot.dx, KEY_CY + slot.dy, '', { fontFamily: FONT, fontSize: '13px', color: TEXT.bright }).setOrigin(0.5));
    }

    const faces: PromptBadge[] = [];
    for (let f = 0; f < FACE_SLOTS.length; f++) {
      const slot = FACE_SLOTS[f];
      faces.push(new PromptBadge(this, px + FACE_CX + slot.dx, VIZ_CY + slot.dy));
    }

    this.add.text(px + COL_ACTION_X, FOOTNOTE_Y, FOOTNOTE, { fontFamily: FONT, fontSize: '12px', color: TEXT.dim, wordWrap: { width: PANEL_W - 36 } });

    return { title, rows, keyLabels, faces };
  }

  // ── Frame ─────────────────────────────────────────────────────────────────
  override update(): void {
    const inputs = this.mgr.poll();
    if (this.mgr.isCapturing()) {
      const result = this.mgr.pollCapture();
      if (result !== null) this.applyCapture(result);
    } else {
      this.handleNavigation(inputs);
    }
    this.refreshLabels();
    this.draw();
  }

  private handleNavigation(inputs: PlayerInput[]): void {
    const menu = readMenuInput(inputs, this.menu);
    const stepY = axisEdge(this.prevMenuY, menu.moveY);
    const stepX = axisEdge(this.prevMenuX, menu.moveX);
    this.prevMenuY = menu.moveY;
    this.prevMenuX = menu.moveX;

    if (stepY !== 0) this.row = (this.row + stepY + ROW_COUNT) % ROW_COUNT;
    if (stepX !== 0) {
      if (SETTING_ROWS.includes(ROWS[this.row].kind)) this.changeSetting(stepX);
      else this.column = (this.column + stepX + PANEL_COUNT) % PANEL_COUNT;
    }

    const claim = this.mgr.pollPadClaim();
    if (claim !== NO_PAD) {
      this.mgr.assignPad(claim, this.column);
      this.mgr.save();
      this.labelsDirty = true;
      this.status.setText(`Pad ${claim} assigned to player ${this.column + 1}`);
    }

    if (menu.pickupPressed) this.activateRow();
    else if (menu.interactPressed) this.clearRow();
    if (menu.backPressed === true || menu.pausePressed === true) this.scene.start(SCENE.TITLE);
  }

  // ── Rows ──────────────────────────────────────────────────────────────────
  private activateRow(): void {
    const spec = ROWS[this.row];
    switch (spec.kind) {
      case 'device':
      case 'stick':
      case 'dpad':
      case 'deadzone':
        this.changeSetting(1);
        return;
      case 'wizard':
        this.startWizard(this.column);
        return;
      case 'reset':
        this.mgr.resetBindings(this.column);
        this.mgr.save();
        this.labelsDirty = true;
        this.status.setText(`Player ${this.column + 1} reset to defaults`);
        return;
      case 'action':
        if (spec.action === undefined) return;
        this.capturingAction = spec.action;
        this.mgr.startCapture();
        this.status.setText(`Press a key or button to add to "${ACTION_NAMES[spec.action]}" — Esc cancels`);
        return;
    }
  }

  /** The chop button on an action row empties it for the device the player holds. */
  private clearRow(): void {
    const spec = ROWS[this.row];
    if (spec.kind !== 'action' || spec.action === undefined) return;
    const player = this.column;
    const device = this.mgr.getDevice(player);
    if (device.kind === 'keyboard') {
      const current = this.mgr.getKeyboardBinding(player);
      this.mgr.setKeyboardBinding(player, { kind: 'keyboard', keys: { ...current.keys, [spec.action]: [] } });
    } else {
      const current = this.mgr.getGamepadBinding(player);
      this.mgr.setGamepadBinding(player, { ...cloneGamepadBinding(current, current.padIndex), buttons: { ...current.buttons, [spec.action]: [] } });
    }
    this.mgr.save();
    this.labelsDirty = true;
    this.status.setText(`"${ACTION_NAMES[spec.action]}" cleared on ${this.deviceLabel(player, device)} — select the row to add a new one`);
  }

  /** Left / right on a setting row. */
  private changeSetting(delta: number): void {
    const spec = ROWS[this.row];
    const player = this.column;
    switch (spec.kind) {
      case 'device':
        this.changeDevice(player, delta);
        break;
      case 'stick': {
        const current = this.mgr.getGamepadBinding(player);
        this.mgr.setGamepadBinding(player, { ...cloneGamepadBinding(current, current.padIndex), useLeftStick: !current.useLeftStick });
        this.status.setText(`Left stick ${current.useLeftStick ? 'off' : 'on'} for player ${player + 1}'s pad`);
        break;
      }
      case 'dpad': {
        const current = this.mgr.getGamepadBinding(player);
        this.mgr.setGamepadBinding(player, { ...cloneGamepadBinding(current, current.padIndex), useDpad: !current.useDpad });
        this.status.setText(`D-pad ${current.useDpad ? 'off' : 'on'} for player ${player + 1}'s pad`);
        break;
      }
      case 'deadzone': {
        const current = this.mgr.getGamepadBinding(player);
        const deadzone = clampDeadzone((current.deadzone ?? STICK_DEADZONE) + delta * DEADZONE_STEP);
        this.mgr.setGamepadBinding(player, { ...cloneGamepadBinding(current, current.padIndex), deadzone });
        this.status.setText(`Stick deadzone ${formatDeadzone(deadzone)} for player ${player + 1}'s pad`);
        break;
      }
      default:
        return;
    }
    this.mgr.save();
    this.labelsDirty = true;
  }

  /** Cycles through the keyboard sets and every connected pad. */
  private changeDevice(player: number, delta: number): void {
    const options = this.deviceOptions();
    const current = this.mgr.getDevice(player);
    let at = options.findIndex((option) => sameDevice(option, current));
    if (at < 0) at = 0;
    const next = options[(at + delta + options.length) % options.length];
    if (next.kind === 'keyboard') this.mgr.setKeyboardSet(player, next.set);
    else this.mgr.assignPad(next.padIndex, player);
    this.status.setText(`Player ${player + 1} now uses ${this.deviceLabel(player, this.mgr.getDevice(player))}`);
  }

  private deviceOptions(): DeviceChoice[] {
    const options: DeviceChoice[] = [];
    for (let set = 0; set < PANEL_COUNT; set++) options.push({ kind: 'keyboard', set });
    for (const pad of this.mgr.listPads()) options.push({ kind: 'gamepad', padIndex: pad.index });
    return options;
  }

  private deviceLabel(player: number, device: DeviceChoice): string {
    if (device.kind === 'keyboard') return keyboardSetLabel(device.set, this.mgr.getKeyboardBinding(player));
    const pad = this.mgr.listPads().find((info) => info.index === device.padIndex);
    return `Pad ${device.padIndex}: ${pad === undefined ? '?' : pad.id}`;
  }

  // ── Guided setup ──────────────────────────────────────────────────────────
  private startWizard(player: number): void {
    this.wizard = { player, step: 0 };
    this.column = player;
    this.beginWizardStep();
  }

  private beginWizardStep(): void {
    const wizard = this.wizard;
    if (wizard === null) return;
    if (wizard.step >= ACTIONS.length) {
      this.wizard = null;
      this.mgr.save();
      this.labelsDirty = true;
      this.status.setText(`Player ${wizard.player + 1} is set up`);
      return;
    }
    const action = ACTIONS[wizard.step];
    const device = this.mgr.getDevice(wizard.player);
    const what = device.kind === 'gamepad' ? 'button' : 'key';
    this.row = ROWS.findIndex((spec) => spec.kind === 'action' && spec.action === action);
    this.capturingAction = action;
    this.mgr.startCapture();
    this.status.setText(
      `Player ${wizard.player + 1}, press the ${what} for "${ACTION_NAMES[action]}" (${wizard.step + 1} of ${ACTIONS.length}) — Esc keeps ${this.currentLabel(wizard.player, action)}`,
    );
  }

  private currentLabel(player: number, action: GameAction): string {
    const device = this.mgr.getDevice(player);
    if (device.kind === 'keyboard') return joinKeyLabels(this.mgr.getKeyboardBinding(player).keys[action]);
    return joinPadLabels(this.mgr.getGamepadBinding(player).buttons[action], this.mgr.getPadKind(player));
  }

  // ── Capture ───────────────────────────────────────────────────────────────
  /** A row capture adds to the action; a wizard capture replaces it. Esc keeps what is there. */
  private applyCapture(result: CaptureResult): void {
    const action = this.capturingAction;
    this.capturingAction = null;
    const wizard = this.wizard;
    if (action === null || result.kind === 'cancel') {
      this.status.setText(wizard === null ? 'Cancelled' : 'Kept');
      this.advanceWizard();
      return;
    }
    const player = wizard === null ? this.column : wizard.player;
    const replace = wizard !== null;
    if (result.kind === 'keyboard') {
      const current = this.mgr.getKeyboardBinding(player);
      const list = replace ? [result.code] : addUnique(current.keys[action], result.code);
      this.mgr.setKeyboardBinding(player, { kind: 'keyboard', keys: { ...current.keys, [action]: list } });
      this.status.setText(`${ACTION_NAMES[action]} → ${joinKeyLabels(list)}`);
    } else {
      if (!this.padBelongsTo(result.padIndex, player)) {
        this.status.setText(`That pad belongs to another player — press player ${player + 1}'s pad or a key`);
        this.capturingAction = action;
        this.mgr.startCapture();
        return;
      }
      const current = this.mgr.getGamepadBinding(player);
      const list = replace ? [result.button] : addUnique(current.buttons[action], result.button);
      this.mgr.setGamepadBinding(player, { ...cloneGamepadBinding(current, current.padIndex), buttons: { ...current.buttons, [action]: list } });
      this.status.setText(`${ACTION_NAMES[action]} → ${joinPadLabels(list, this.mgr.getPadKind(player))}`);
    }
    this.mgr.save();
    this.labelsDirty = true;
    this.advanceWizard();
  }

  /** An unassigned pad pressed during a capture is claimed for the player; another player's pad is not. */
  private padBelongsTo(padIndex: number, player: number): boolean {
    if (this.mgr.getPadIndex(player) === padIndex) return true;
    const pad = this.mgr.listPads().find((info) => info.index === padIndex);
    if (pad === undefined || pad.player >= 0) return false;
    this.mgr.assignPad(padIndex, player);
    return true;
  }

  private advanceWizard(): void {
    if (this.wizard === null) return;
    this.wizard.step += 1;
    this.beginWizardStep();
  }

  // ── Text ──────────────────────────────────────────────────────────────────
  private refreshLabels(): void {
    for (let p = 0; p < PANEL_COUNT; p++) {
      const name = this.mgr.getDeviceName(p);
      if (this.deviceNames[p] !== name) {
        this.deviceNames[p] = name;
        this.labelsDirty = true;
      }
    }
    if (!this.labelsDirty) return;
    this.labelsDirty = false;

    for (let p = 0; p < PANEL_COUNT; p++) {
      const panel = this.panels[p];
      const kind = this.mgr.getPadKind(p);
      const keyboard = this.mgr.getKeyboardBinding(p);
      const gamepad = this.mgr.getGamepadBinding(p);
      const device = this.mgr.getDevice(p);
      const padNote = device.kind === 'gamepad' ? '' : ' · next pad';

      for (let r = 0; r < ROW_COUNT; r++) {
        const spec = ROWS[r];
        const row = panel.rows[r];
        row.pad.setText('');
        switch (spec.kind) {
          case 'device':
            row.name.setText('Device');
            row.key.setText(truncate(this.deviceLabel(p, device), VALUE_MAX_CHARS));
            break;
          case 'wizard':
            row.name.setText('Set up controls');
            row.key.setText('every action, one press at a time');
            break;
          case 'action':
            if (spec.action === undefined) break;
            row.name.setText(ACTION_NAMES[spec.action]);
            row.key.setText(joinKeyLabels(keyboard.keys[spec.action]));
            row.pad.setText(joinPadLabels(gamepad.buttons[spec.action], kind));
            break;
          case 'stick':
            row.name.setText('Left stick');
            row.key.setText(`${gamepad.useLeftStick ? 'on' : 'off'}${padNote}`);
            break;
          case 'dpad':
            row.name.setText('D-pad');
            row.key.setText(`${gamepad.useDpad ? 'on' : 'off'}${padNote}`);
            break;
          case 'deadzone':
            row.name.setText('Stick deadzone');
            row.key.setText(`${formatDeadzone(gamepad.deadzone ?? STICK_DEADZONE)}${padNote}`);
            break;
          case 'reset':
            row.name.setText('Reset to defaults');
            row.key.setText('');
            break;
        }
      }

      for (let k = 0; k < KEY_SLOTS.length; k++) {
        const code = keyboard.keys[KEY_SLOTS[k].action][0];
        panel.keyLabels[k].setText(code === undefined ? UNBOUND : keyCodeLabel(code));
      }
      for (let f = 0; f < FACE_SLOTS.length; f++) {
        panel.faces[f].setLabel(this, padButtonLabel(FACE_SLOTS[f].button, kind));
      }
    }
  }

  // ── Drawing ───────────────────────────────────────────────────────────────
  private draw(): void {
    const g = this.gfx;
    g.clear();
    for (let p = 0; p < PANEL_COUNT; p++) {
      const px = panelX(p);
      const active = p === this.column;
      g.fillStyle(COLOR.panel, 1);
      g.fillRoundedRect(px, PANEL_Y, PANEL_W, PANEL_H, PANEL_RADIUS);
      g.lineStyle(active ? 3 : 1, active ? COLOR.panelEdgeActive : COLOR.panelEdge, 1);
      g.strokeRoundedRect(px, PANEL_Y, PANEL_W, PANEL_H, PANEL_RADIUS);

      const raw = this.mgr.getRawState(p);
      this.drawStick(px, raw.stickX, raw.stickY, raw.padIndex !== NO_PAD);
      this.drawDpad(px, raw.buttons);
      this.drawFaces(p, px, raw.buttons);
      this.drawKeys(px, raw.keysDown);

      if (active) {
        const capturing = this.capturingAction !== null;
        g.fillStyle(capturing ? COLOR.rowCapture : COLOR.rowActive, 1);
        g.fillRoundedRect(px + 8, LIST_TOP + this.row * ROW_H + 2, PANEL_W - 16, ROW_H - 4, 6);
      }
    }
  }

  private drawStick(px: number, x: number, y: number, hasPad: boolean): void {
    const g = this.gfx;
    const cx = px + STICK_CX;
    g.lineStyle(2, COLOR.stick, 1);
    g.strokeCircle(cx, VIZ_CY, STICK_R);
    g.strokeCircle(cx, VIZ_CY, STICK_R * 0.25);
    g.lineStyle(1, COLOR.stick, 0.6);
    g.lineBetween(cx - STICK_R, VIZ_CY, cx + STICK_R, VIZ_CY);
    g.lineBetween(cx, VIZ_CY - STICK_R, cx, VIZ_CY + STICK_R);
    g.fillStyle(hasPad ? COLOR.stickDot : COLOR.device, 1);
    g.fillCircle(cx + x * (STICK_R - STICK_DOT_R), VIZ_CY + y * (STICK_R - STICK_DOT_R), STICK_DOT_R);
  }

  private drawDpad(px: number, buttons: readonly boolean[]): void {
    const g = this.gfx;
    const cx = px + DPAD_CX;
    for (let i = 0; i < DPAD_SLOTS.length; i++) {
      const slot = DPAD_SLOTS[i];
      g.fillStyle(buttons[slot.button] === true ? COLOR.deviceOn : COLOR.device, 1);
      g.fillRect(cx + slot.dx, VIZ_CY + slot.dy, slot.w, slot.h);
    }
    g.fillStyle(COLOR.device, 1);
    g.fillRect(cx - 9, VIZ_CY - 9, 18, 18);
  }

  private drawFaces(index: number, px: number, buttons: readonly boolean[]): void {
    const g = this.gfx;
    const cx = px + FACE_CX;
    const panel = this.panels[index];
    for (let i = 0; i < FACE_SLOTS.length; i++) {
      const slot = FACE_SLOTS[i];
      const pressed = buttons[slot.button] === true;
      g.fillStyle(pressed ? COLOR.deviceOn : COLOR.device, 1);
      g.fillCircle(cx + slot.dx, VIZ_CY + slot.dy, FACE_R);
      panel.faces[i].setPressed(pressed);
    }
  }

  private drawKeys(px: number, keysDown: Record<GameAction, boolean>): void {
    const g = this.gfx;
    const cx = px + KEY_CX;
    for (let i = 0; i < KEY_SLOTS.length; i++) {
      const slot = KEY_SLOTS[i];
      const down = keysDown[slot.action];
      g.fillStyle(down ? COLOR.keyOn : COLOR.device, 1);
      g.fillRoundedRect(cx + slot.dx - slot.w / 2, KEY_CY + slot.dy - KEY_H / 2, slot.w, KEY_H, 5);
    }
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────────
function panelX(index: number): number {
  return MARGIN_X + index * (PANEL_W + PANEL_GAP);
}

function rowCenterY(row: number): number {
  return LIST_TOP + row * ROW_H + ROW_H / 2;
}

function joinKeyLabels(codes: readonly string[]): string {
  if (codes.length === 0) return UNBOUND;
  let out = '';
  for (let i = 0; i < codes.length; i++) out += (i === 0 ? '' : ' / ') + keyCodeLabel(codes[i]);
  return out;
}

function joinPadLabels(buttons: readonly number[], kind: PadKind): string {
  if (buttons.length === 0) return UNBOUND;
  let out = '';
  for (let i = 0; i < buttons.length; i++) out += (i === 0 ? '' : ' / ') + padButtonLabel(buttons[i], kind);
  return out;
}

function addUnique<T>(list: readonly T[], item: T): T[] {
  return list.includes(item) ? list.slice() : [...list, item];
}

function sameDevice(a: DeviceChoice, b: DeviceChoice): boolean {
  if (a.kind === 'keyboard' && b.kind === 'keyboard') return a.set === b.set;
  if (a.kind === 'gamepad' && b.kind === 'gamepad') return a.padIndex === b.padIndex;
  return false;
}

function formatDeadzone(value: number): string {
  return value.toFixed(2);
}

function truncate(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max - 1)}…`;
}
