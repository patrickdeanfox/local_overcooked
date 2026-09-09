// ─── Settings scene ─────────────────────────────────────────────────────────
// The settings page: seed, free play, the assists, the door to the Custom difficulty page and
// the audio switches, one row each with a line of explanation under the list. Opened from the
// title's Settings row; Esc, B or Back return. Every edit saves at once. Players, difficulty
// and the chefs stay on the title and the Chefs page, where they change most often.
import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH, MAX_PLAYERS, SCENE } from '../../config';
import { createInputManager } from '../../input';
import type { InputManager } from '../../input/types';
import { getAudioBus, installAudioGestureResume, installMuteToggle } from '../audioBus';
import {
  ASSIST_IDS, ASSIST_NAMES, CUSTOM_PRESET, customSummary, cycleSeedMode, dailySeed, loadSettings, saveSettings,
  SEED_LIMIT, type AssistId, type Settings,
} from '../settings';
import { MenuList, type MenuItemSpec } from '../ui/MenuList';
import { KeyboardNav, MenuInput, mergeNav } from '../ui/menuInput';
import { COLOR, TEXT_COLOR, textStyle } from '../ui/theme';

// ─── Constants ──────────────────────────────────────────────────────────────
const SETTINGS = {
  headingY: 72,
  headingFontPx: 40,
  menuY: 160,
  menuSpacing: 46,
  menuWidth: 720,
  menuFontPx: 22,
  descriptionGapPx: 44,   // below the last row
  descriptionFontPx: 16,
  hintY: GAME_HEIGHT - 56,
  hintFontPx: 15,
} as const;

const HEADING = 'SETTINGS';
const HINT = 'up / down choose · left / right change · Esc or B back · M mutes everything';
const ASSIST_NOTE = 'A run with any assist on is not saved and earns no stars';

type RowId = 'seedMode' | 'seedValue' | 'freePlay' | AssistId | 'customDifficulty' | 'music' | 'sfx' | 'back';
/** The rows, top to bottom. */
const ROWS: readonly RowId[] = ['seedMode', 'seedValue', 'freePlay', ...ASSIST_IDS, 'customDifficulty', 'music', 'sfx', 'back'];

const DESCRIPTIONS: Readonly<Record<RowId, string>> = Object.freeze({
  seedMode: 'Random deals new tickets every run, daily gives everyone the same run today, fixed replays a number',
  seedValue: 'Type digits to set the number; nudging or typing it switches the seed to fixed',
  freePlay: 'Every level open, whatever your stars',
  instantCooking: `Pots and pans are ready the moment they start cooking. ${ASSIST_NOTE}`,
  ordersNeverExpire: `Tickets keep their full timer, no expiry, no fail penalty. ${ASSIST_NOTE}`,
  noBurning: `Cooked food never burns, so stoves never catch fire. ${ASSIST_NOTE}`,
  customDifficulty: 'Set every timer and ticket number yourself; played when the difficulty is Custom',
  music: 'The background loop. Sound effects keep playing',
  sfx: 'Kitchen and menu sounds. The music keeps playing',
  back: '',
});

// ─── Scene ──────────────────────────────────────────────────────────────────
export class SettingsScene extends Phaser.Scene {
  private inputMgr!: InputManager;
  private menuInput!: MenuInput;
  private keyboardNav!: KeyboardNav;
  private menu!: MenuList;
  private description!: Phaser.GameObjects.Text;
  private settings!: Settings;
  private selected: RowId = ROWS[0]; // tracked here because labels read it while the list is still being built
  private readonly disposers: (() => void)[] = [];
  private ready = false;

  constructor() { super(SCENE.SETTINGS); }

  create(): void {
    this.settings = loadSettings();

    this.cameras.main.setBackgroundColor(COLOR.bg);
    this.add.text(GAME_WIDTH / 2, SETTINGS.headingY, HEADING, textStyle(SETTINGS.headingFontPx, TEXT_COLOR.accent)).setOrigin(0.5);
    this.add.text(GAME_WIDTH / 2, SETTINGS.hintY, HINT, textStyle(SETTINGS.hintFontPx, TEXT_COLOR.dim)).setOrigin(0.5);

    this.inputMgr = createInputManager(this, MAX_PLAYERS);
    this.menuInput = new MenuInput();
    this.keyboardNav = new KeyboardNav(this);
    this.disposers.push(installAudioGestureResume(this), installMuteToggle(this));
    getAudioBus().stopMusic();

    this.menu = new MenuList(this, GAME_WIDTH / 2, SETTINGS.menuY, ROWS.map((id) => this.item(id)), {
      spacing: SETTINGS.menuSpacing,
      width: SETTINGS.menuWidth,
      fontSize: SETTINGS.menuFontPx,
    });
    const descriptionY = SETTINGS.menuY + (ROWS.length - 1) * SETTINGS.menuSpacing + SETTINGS.descriptionGapPx;
    this.description = this.add
      .text(GAME_WIDTH / 2, descriptionY, '', textStyle(SETTINGS.descriptionFontPx, TEXT_COLOR.dim))
      .setOrigin(0.5);
    this.refreshDescription();
    this.installSeedTyping();

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.cleanup, this);
    this.ready = true;
  }

  override update(): void {
    if (!this.ready) return;
    const inputs = this.inputMgr.poll();
    const nav = mergeNav(this.menuInput.poll(inputs), this.keyboardNav.poll());
    this.menu.handle(nav);
    if (!this.ready) return; // Back was chosen from the list
    // Esc reaches menus as the pause action, so it leaves the page like the controllers screen.
    if (nav.back || inputs.some((input) => input.pausePressed === true)) {
      this.back();
      return;
    }
    if (nav.up || nav.down) {
      this.selected = ROWS[this.menu.selectedIndex] ?? 'back';
      this.menu.refresh(); // the seed row's typing hint follows the cursor
      this.refreshDescription();
    }
  }

  // ─── Rows ─────────────────────────────────────────────────────────────────
  private item(id: RowId): MenuItemSpec {
    switch (id) {
      case 'seedMode':
        return {
          label: () => `Seed: ${this.seedModeLabel()}`,
          onSelect: () => this.changeSeedMode(1),
          onLeft: () => this.changeSeedMode(-1),
          onRight: () => this.changeSeedMode(1),
        };
      case 'seedValue':
        return {
          label: () => `Seed number: ${this.settings.fixedSeed}${this.onSeedRow() ? '  (type digits)' : ''}`,
          onSelect: () => this.changeFixedSeed(0),
          onLeft: () => this.changeFixedSeed(-1),
          onRight: () => this.changeFixedSeed(1),
        };
      case 'freePlay':
        return this.toggleRow(
          () => `Free play: ${this.settings.freePlay ? 'on · every level unlocked' : 'off'}`,
          () => { this.settings.freePlay = !this.settings.freePlay; },
        );
      case 'music':
        return this.toggleRow(
          () => `Music: ${this.settings.audio.music ? 'on' : 'off'}`,
          () => {
            this.settings.audio.music = !this.settings.audio.music;
            getAudioBus().setMusicEnabled(this.settings.audio.music);
          },
        );
      case 'sfx':
        return this.toggleRow(
          () => `Sound effects: ${this.settings.audio.sfx ? 'on' : 'off'}`,
          () => {
            this.settings.audio.sfx = !this.settings.audio.sfx;
            getAudioBus().setSfxEnabled(this.settings.audio.sfx);
          },
        );
      case 'customDifficulty':
        return {
          label: () => `Custom difficulty: ${customSummary(this.settings.custom)}`
            + `${this.settings.preset === CUSTOM_PRESET ? ' · in use' : ''}`,
          onSelect: () => this.openCustomDifficulty(),
        };
      case 'back':
        return { label: () => 'Back', onSelect: () => this.back() };
      default:
        return this.toggleRow(
          () => `${ASSIST_NAMES[id]}: ${this.settings.assists[id] ? 'on' : 'off'}`,
          () => { this.settings.assists[id] = !this.settings.assists[id]; },
        );
    }
  }

  /** A row that flips on select, left and right alike. */
  private toggleRow(label: () => string, flip: () => void): MenuItemSpec {
    const apply = (): void => {
      flip();
      this.applySettings();
    };
    return { label, onSelect: apply, onLeft: apply, onRight: apply };
  }

  private onSeedRow(): boolean {
    return this.selected === 'seedValue';
  }

  private seedModeLabel(): string {
    switch (this.settings.seedMode) {
      case 'random': return 'random · a new kitchen every run';
      case 'daily': return `daily · ${dailySeed(new Date())}`;
      case 'fixed': return `fixed · ${this.settings.fixedSeed}`;
    }
  }

  private changeSeedMode(delta: number): void {
    this.settings.seedMode = cycleSeedMode(this.settings.seedMode, delta);
    this.applySettings();
  }

  /** Nudging or typing the number pins the seed, which is the only mode that uses it. */
  private changeFixedSeed(delta: number): void {
    this.settings.fixedSeed = (this.settings.fixedSeed + delta + SEED_LIMIT) % SEED_LIMIT;
    this.settings.seedMode = 'fixed';
    this.applySettings();
  }

  /** Every edit goes through here: saved, then reflected in the labels. */
  private applySettings(): void {
    saveSettings(this.settings);
    this.menu.refresh();
  }

  /** The selected row's one-line explanation; blank on Back. */
  private refreshDescription(): void {
    this.description.setText(DESCRIPTIONS[this.selected]);
  }

  // ─── Seed typing ──────────────────────────────────────────────────────────
  /** While the seed number row is selected, digits type the number and Backspace deletes. */
  private installSeedTyping(): void {
    const keyboard = this.input.keyboard;
    if (!keyboard) return;
    const onKey = (event: KeyboardEvent): void => {
      if (!this.ready || !this.onSeedRow()) return;
      if (event.key >= '0' && event.key <= '9') {
        const next = this.settings.fixedSeed * 10 + Number(event.key);
        this.settings.fixedSeed = next >= SEED_LIMIT ? Number(event.key) : next;
      } else if (event.key === 'Backspace') {
        this.settings.fixedSeed = Math.floor(this.settings.fixedSeed / 10);
      } else {
        return;
      }
      this.settings.seedMode = 'fixed';
      this.applySettings();
    };
    keyboard.on(Phaser.Input.Keyboard.Events.ANY_KEY_DOWN, onKey);
    this.disposers.push(() => { keyboard.off(Phaser.Input.Keyboard.Events.ANY_KEY_DOWN, onKey); });
  }

  // ─── Leaving ──────────────────────────────────────────────────────────────
  private openCustomDifficulty(): void {
    this.ready = false;
    this.scene.start(SCENE.CUSTOM_DIFFICULTY);
  }

  private back(): void {
    getAudioBus().play('uiBack');
    this.ready = false;
    this.scene.start(SCENE.TITLE);
  }

  private cleanup(): void {
    for (const dispose of this.disposers) dispose();
    this.disposers.length = 0;
    this.menu?.destroy();
    this.keyboardNav?.destroy();
    this.inputMgr?.destroy();
  }
}
