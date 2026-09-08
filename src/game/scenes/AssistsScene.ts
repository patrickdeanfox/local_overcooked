// ─── Assists scene ──────────────────────────────────────────────────────────
// The settings page for the assists: toggles that make a kitchen forgiving. Opened from
// the title's Assists row; Esc / B returns. Every toggle saves at once, and GameScene folds
// the saved assists into the run's modifiers, so a run with any assist on is never saved.
import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH, MAX_PLAYERS, SCENE } from '../../config';
import { createInputManager } from '../../input';
import type { InputManager } from '../../input/types';
import { getAudioBus, installAudioGestureResume, installMuteToggle } from '../audioBus';
import { ASSIST_IDS, ASSIST_NAMES, loadSettings, saveSettings, type AssistId, type Settings } from '../settings';
import { MenuList, type MenuItemSpec } from '../ui/MenuList';
import { KeyboardNav, MenuInput, mergeNav } from '../ui/menuInput';
import { COLOR, TEXT_COLOR, textStyle } from '../ui/theme';

// ─── Constants ──────────────────────────────────────────────────────────────
const ASSISTS = {
  headingY: 96,
  headingFontPx: 44,
  noteY: 150,
  noteFontPx: 16,
  menuY: 300,
  menuSpacing: 52,
  menuWidth: 620,
  menuFontPx: 24,
  descriptionGapPx: 40,   // below the last row
  descriptionFontPx: 16,
  hintY: GAME_HEIGHT - 56,
  hintFontPx: 15,
} as const;

const HEADING = 'ASSISTS';
const NOTE = 'A run with any assist on is not saved and earns no stars';
const HINT = 'up / down choose · left / right or select toggle · Esc or B back · M mute';

const DESCRIPTIONS: Readonly<Record<AssistId, string>> = Object.freeze({
  instantCooking: 'Pots and pans are ready the moment they start cooking',
  ordersNeverExpire: 'Tickets keep their full timer: no expiry, no fail penalty',
  noBurning: 'Cooked food never burns, so stoves never catch fire',
});

// ─── Scene ──────────────────────────────────────────────────────────────────
export class AssistsScene extends Phaser.Scene {
  private inputMgr!: InputManager;
  private menuInput!: MenuInput;
  private keyboardNav!: KeyboardNav;
  private menu!: MenuList;
  private description!: Phaser.GameObjects.Text;
  private settings!: Settings;
  private readonly disposers: (() => void)[] = [];
  private ready = false;

  constructor() { super(SCENE.ASSISTS); }

  create(): void {
    this.settings = loadSettings();

    this.cameras.main.setBackgroundColor(COLOR.bg);
    this.add.text(GAME_WIDTH / 2, ASSISTS.headingY, HEADING, textStyle(ASSISTS.headingFontPx, TEXT_COLOR.accent)).setOrigin(0.5);
    this.add.text(GAME_WIDTH / 2, ASSISTS.noteY, NOTE, textStyle(ASSISTS.noteFontPx, TEXT_COLOR.dim)).setOrigin(0.5);
    this.add.text(GAME_WIDTH / 2, ASSISTS.hintY, HINT, textStyle(ASSISTS.hintFontPx, TEXT_COLOR.dim)).setOrigin(0.5);

    this.inputMgr = createInputManager(this, MAX_PLAYERS);
    this.menuInput = new MenuInput();
    this.keyboardNav = new KeyboardNav(this);
    this.disposers.push(installAudioGestureResume(this), installMuteToggle(this));
    getAudioBus().stopMusic();

    const items: MenuItemSpec[] = ASSIST_IDS.map((id) => ({
      label: () => `${ASSIST_NAMES[id]}: ${this.settings.assists[id] ? 'on' : 'off'}`,
      onSelect: () => this.toggle(id),
      onLeft: () => this.toggle(id),
      onRight: () => this.toggle(id),
    }));
    items.push({ label: () => 'Back', onSelect: () => this.back() });
    this.menu = new MenuList(this, GAME_WIDTH / 2, ASSISTS.menuY, items, {
      spacing: ASSISTS.menuSpacing,
      width: ASSISTS.menuWidth,
      fontSize: ASSISTS.menuFontPx,
    });
    const descriptionY = ASSISTS.menuY + (items.length - 1) * ASSISTS.menuSpacing + ASSISTS.descriptionGapPx;
    this.description = this.add
      .text(GAME_WIDTH / 2, descriptionY, '', textStyle(ASSISTS.descriptionFontPx, TEXT_COLOR.dim))
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
    // Esc reaches menus as the pause action, so it leaves the page like the controllers screen.
    if (nav.back || inputs.some((input) => input.pausePressed === true)) {
      this.back();
      return;
    }
    if (nav.up || nav.down) this.refreshDescription();
  }

  // ─── Rows ─────────────────────────────────────────────────────────────────
  private toggle(id: AssistId): void {
    this.settings.assists[id] = !this.settings.assists[id];
    saveSettings(this.settings);
    this.menu.refresh();
  }

  /** The selected assist's one-line explanation; blank on the Back row. */
  private refreshDescription(): void {
    const id = ASSIST_IDS[this.menu.selectedIndex];
    this.description.setText(id ? DESCRIPTIONS[id] : '');
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
