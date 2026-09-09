// ─── Custom difficulty scene ────────────────────────────────────────────────
// One row per number the sim scales: level time, tickets, cadence, patience, cook, burn,
// chop and wash times, chef speed. Left / right steps a row; the line under the list says
// what the number comes to on the first level, computed by the real Sim so the preview and
// the game can never disagree. Opened from the Settings page; Esc, B or Back return there.
// The top row picks the difficulty preset, so Custom can be switched on without leaving.
import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH, MAX_PLAYERS, SCENE } from '../../config';
import { createInputManager, menuLabels } from '../../input';
import type { InputManager } from '../../input/types';
import { Sim, type EffectiveSettings } from '../../sim';
import type { LevelDef } from '../../levels/schema';
import { getAudioBus, installAudioGestureResume, installMuteToggle } from '../audioBus';
import { currentLevels, defaultLevelId } from '../levelHotReload';
import {
  CUSTOM_FIELDS, CUSTOM_PRESET, customModifiers, cyclePreset, DEFAULT_CUSTOM, formatCustomValue, loadSettings,
  presetName, saveSettings, stepCustom, type CustomFieldId, type CustomFieldSpec, type Settings,
} from '../settings';
import { MenuList, type MenuItemSpec } from '../ui/MenuList';
import { KeyboardNav, MenuInput, mergeNav } from '../ui/menuInput';
import { COLOR, TEXT_COLOR, textStyle } from '../ui/theme';

// ─── Constants ──────────────────────────────────────────────────────────────
const LAYOUT = {
  headingY: 56,
  headingFontPx: 40,
  menuY: 124,
  menuSpacing: 38,
  menuWidth: 760,
  menuFontPx: 21,
  descriptionGapPx: 40,   // below the last row
  descriptionFontPx: 16,
  descriptionLineGapPx: 24,
  hintY: GAME_HEIGHT - 44,
  hintFontPx: 15,
} as const;

const HEADING = 'CUSTOM DIFFICULTY';
/** The hint line in the first player's own labels (keys, or the pad's buttons). */
function hintLine(mgr: InputManager): string {
  const labels = menuLabels((action) => mgr.labelFor(0, action));
  return `${labels.choose} choose · ${labels.change} change · ${labels.back} back`;
}
const UNLOCK_NOTE = 'A custom run is saved but its stars never count toward unlocks';
const PREVIEW_PLAYERS = 1; // the preview Sim; the numbers shown do not depend on the player count
const PREVIEW_SEED = 0;

type RowId = 'preset' | CustomFieldId | 'reset' | 'back';
/** The rows, top to bottom. */
const ROWS: readonly RowId[] = ['preset', ...CUSTOM_FIELDS.map((field) => field.id), 'reset', 'back'];

// ─── Pure helpers ───────────────────────────────────────────────────────────
function seconds(value: number): string {
  return `${Math.round(value * 10) / 10} s`;
}

function clock(totalSeconds: number): string {
  const whole = Math.round(totalSeconds);
  const minutes = Math.floor(whole / 60);
  const rest = whole % 60;
  return `${minutes}:${rest < 10 ? '0' : ''}${rest}`;
}

function tickets(count: number): string {
  return `${count} ticket${count === 1 ? '' : 's'}`;
}

/** What one row comes to on the reference level, level default first. */
function preview(field: CustomFieldSpec, level: LevelDef, base: EffectiveSettings, now: EffectiveSettings): string {
  const on = `On ${level.name}`;
  switch (field.id) {
    case 'timeLimitScale':
      return `${on}: ${clock(base.timeLimitSec)} of level time becomes ${clock(now.timeLimitSec)}`;
    case 'initialOrdersDelta':
      return `${on}: ${tickets(base.orders.initial)} at the start becomes ${tickets(now.orders.initial)}`;
    case 'maxOrdersDelta':
      return `${on}: up to ${tickets(base.orders.max)} on screen becomes up to ${tickets(now.orders.max)}`;
    case 'orderIntervalScale':
      return `${on}: a new ticket every ${seconds(base.orders.intervalSec)} becomes every ${seconds(now.orders.intervalSec)}`;
    case 'orderTimeScale':
      return `${on}: a ticket waits ${seconds(base.orders.timeSec)} before it expires; this gives ${seconds(now.orders.timeSec)}`;
    case 'cookTimeScale':
      return `A full pot cooks in ${seconds(base.cookTime)} and a patty in ${seconds(base.panCookTime)}; `
        + `this gives ${seconds(now.cookTime)} and ${seconds(now.panCookTime)}`;
    case 'burnTimeScale':
      return `Cooked food burns after ${seconds(base.burnTime)} left on the stove; this gives ${seconds(now.burnTime)}`;
    case 'chopTimeScale':
      return `One ingredient chops in ${seconds(base.chopTime)}; this gives ${seconds(now.chopTime)}`;
    case 'washTimeScale':
      return `One plate washes in ${seconds(base.washTime)}; this gives ${seconds(now.washTime)}`;
    case 'chefSpeedScale':
      return `Chefs walk ${base.chefSpeed} tiles a second; this gives ${Math.round(now.chefSpeed * 100) / 100}`;
  }
}

// ─── Scene ──────────────────────────────────────────────────────────────────
export class CustomDifficultyScene extends Phaser.Scene {
  private inputMgr!: InputManager;
  private menuInput!: MenuInput;
  private keyboardNav!: KeyboardNav;
  private menu!: MenuList;
  private description!: Phaser.GameObjects.Text;
  private note!: Phaser.GameObjects.Text;
  private settings!: Settings;
  private level: LevelDef | null = null;
  private baseline: EffectiveSettings | null = null;
  private selected: RowId = ROWS[0];
  private readonly disposers: (() => void)[] = [];
  private ready = false;

  constructor() { super(SCENE.CUSTOM_DIFFICULTY); }

  create(): void {
    this.settings = loadSettings();
    this.level = currentLevels().levels[defaultLevelId()] ?? null;
    this.baseline = this.level ? new Sim(this.level, { players: PREVIEW_PLAYERS, seed: PREVIEW_SEED }).getEffectiveSettings() : null;

    this.cameras.main.setBackgroundColor(COLOR.bg);
    this.add.text(GAME_WIDTH / 2, LAYOUT.headingY, HEADING, textStyle(LAYOUT.headingFontPx, TEXT_COLOR.accent)).setOrigin(0.5);

    this.inputMgr = createInputManager(this, MAX_PLAYERS);
    this.add.text(GAME_WIDTH / 2, LAYOUT.hintY, hintLine(this.inputMgr), textStyle(LAYOUT.hintFontPx, TEXT_COLOR.dim)).setOrigin(0.5);
    this.menuInput = new MenuInput();
    this.keyboardNav = new KeyboardNav(this);
    this.disposers.push(installAudioGestureResume(this), installMuteToggle(this));
    getAudioBus().stopMusic();

    this.menu = new MenuList(this, GAME_WIDTH / 2, LAYOUT.menuY, ROWS.map((id) => this.item(id)), {
      spacing: LAYOUT.menuSpacing,
      width: LAYOUT.menuWidth,
      fontSize: LAYOUT.menuFontPx,
    });
    const descriptionY = LAYOUT.menuY + (ROWS.length - 1) * LAYOUT.menuSpacing + LAYOUT.descriptionGapPx;
    this.description = this.add
      .text(GAME_WIDTH / 2, descriptionY, '', textStyle(LAYOUT.descriptionFontPx, TEXT_COLOR.dim))
      .setOrigin(0.5);
    this.note = this.add
      .text(GAME_WIDTH / 2, descriptionY + LAYOUT.descriptionLineGapPx, '', textStyle(LAYOUT.descriptionFontPx, TEXT_COLOR.dim))
      .setOrigin(0.5);
    this.refreshDescription();

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.cleanup, this);
    this.ready = true;
  }

  override update(): void {
    if (!this.ready) return;
    const inputs = this.inputMgr.poll();
    const nav = mergeNav(this.menuInput.poll(inputs), this.keyboardNav.poll());
    this.menu.handle(nav);
    if (!this.ready) return; // Back was chosen from the list
    if (nav.back || inputs.some((input) => input.pausePressed === true)) {
      this.back();
      return;
    }
    if (nav.up || nav.down) {
      this.selected = ROWS[this.menu.selectedIndex] ?? 'back';
      this.refreshDescription();
    }
  }

  // ─── Rows ─────────────────────────────────────────────────────────────────
  private item(id: RowId): MenuItemSpec {
    switch (id) {
      case 'preset':
        return {
          label: () => `Difficulty: ${presetName(this.settings.preset)}`
            + `${this.settings.preset === CUSTOM_PRESET ? ' · these numbers are in use' : ' · pick Custom to use these numbers'}`,
          onSelect: () => this.changePreset(1),
          onLeft: () => this.changePreset(-1),
          onRight: () => this.changePreset(1),
        };
      case 'reset':
        return { label: () => 'Reset every number to the level defaults', onSelect: () => this.resetCustom() };
      case 'back':
        return { label: () => 'Back', onSelect: () => this.back() };
      default:
        return this.fieldRow(id);
    }
  }

  private fieldRow(id: CustomFieldId): MenuItemSpec {
    const field = CUSTOM_FIELDS.find((f) => f.id === id);
    if (!field) return { label: () => id };
    return {
      label: () => {
        const value = this.settings.custom[id];
        const tag = value === DEFAULT_CUSTOM[id] ? ' · level default' : '';
        return `${field.name}: ${formatCustomValue(field, value)}${tag}`;
      },
      onSelect: () => this.changeField(id, 1),
      onLeft: () => this.changeField(id, -1),
      onRight: () => this.changeField(id, 1),
    };
  }

  private changePreset(delta: number): void {
    this.settings.preset = cyclePreset(this.settings.preset, delta);
    this.applySettings();
  }

  private changeField(id: CustomFieldId, delta: number): void {
    this.settings.custom = stepCustom(this.settings.custom, id, delta);
    this.applySettings();
  }

  private resetCustom(): void {
    this.settings.custom = { ...DEFAULT_CUSTOM };
    this.applySettings();
  }

  /** Every edit goes through here: saved, then reflected in the labels and the preview. */
  private applySettings(): void {
    saveSettings(this.settings);
    this.menu.refresh();
    this.refreshDescription();
  }

  // ─── Preview ──────────────────────────────────────────────────────────────
  /** The selected row's explanation: the level default and what the row's value makes of it. */
  private refreshDescription(): void {
    this.description.setText(this.describe(this.selected));
    this.note.setText(this.selected === 'back' ? '' : UNLOCK_NOTE);
  }

  private describe(id: RowId): string {
    if (id === 'preset') {
      return this.settings.preset === CUSTOM_PRESET
        ? 'Every run uses the numbers below'
        : `Runs use the ${presetName(this.settings.preset)} preset; the numbers below wait until Custom is picked`;
    }
    if (id === 'reset' || id === 'back') return '';
    const field = CUSTOM_FIELDS.find((f) => f.id === id);
    if (!field || !this.level || !this.baseline) return '';
    const now = new Sim(this.level, {
      players: PREVIEW_PLAYERS,
      seed: PREVIEW_SEED,
      modifiers: customModifiers(this.settings.custom),
    }).getEffectiveSettings();
    return preview(field, this.level, this.baseline, now);
  }

  // ─── Leaving ──────────────────────────────────────────────────────────────
  private back(): void {
    getAudioBus().play('uiBack');
    this.ready = false;
    this.scene.start(SCENE.SETTINGS);
  }

  private cleanup(): void {
    for (const dispose of this.disposers) dispose();
    this.disposers.length = 0;
    this.menu?.destroy();
    this.keyboardNav?.destroy();
    this.inputMgr?.destroy();
  }
}
