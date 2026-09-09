// ─── Title scene ────────────────────────────────────────────────────────────
// Level select over the saved progress, the two settings changed most (players, difficulty
// preset), and the doors to the Chefs, Settings and Controllers pages. One cursor runs
// through the level rows and then the option rows; left / right edits the row it is on.
// Navigable with the keyboard and with any device the input manager reports.
import Phaser from 'phaser';
import { TEX } from '../../art/keys';
import { GAME_HEIGHT, GAME_WIDTH, MAX_PLAYERS, SCENE } from '../../config';
import { createInputManager } from '../../input';
import type { GameAction, InputManager } from '../../input/types';
import { log } from '../../log';
import { getAudioBus, installAudioGestureResume, installMuteToggle } from '../audioBus';
import { currentLevels, onLevelsHotReload } from '../levelHotReload';
import { isUnlocked, levelProgress, loadProgress, totalStars, unlockingStars, type Progress } from '../progress';
import {
  chefSummary, cyclePlayers, cyclePreset, DEFAULT_PRESET, loadSettings, presetName, presetSummary,
  saveSettings, settingsSummary, type Settings,
} from '../settings';
import { LevelList, type LevelEntry } from '../ui/LevelList';
import { MenuList, type MenuItemSpec } from '../ui/MenuList';
import { KeyboardNav, MenuInput, mergeNav } from '../ui/menuInput';
import { COLOR, TEXT_COLOR, textStyle } from '../ui/theme';
import type { GameSceneData } from '../types';

// ─── Constants ──────────────────────────────────────────────────────────────
const TITLE = {
  headingX: 40,
  headingY: 40,
  headingFontPx: 36,
  taglineY: 72,
  taglineFontPx: 14,
  starsX: GAME_WIDTH - 40,
  starsY: 44,
  starsFontPx: 24,
  starsIconGap: 10,
  starsNoteY: 72,
  starsNoteFontPx: 13,
  levelsY: 136,
  levelSpacing: 50,
  levelAreaPx: 300,     // rows are squeezed together rather than run off the screen
  levelGapPx: 96,       // from the last level row down to the settings block
  optionsMaxY: 496,     // however few levels there are, the settings stay above the hints
  statusGapPx: 44,      // the status line sits this far above the settings
  statusFontPx: 15,
  optionsSpacing: 40,
  optionsWidth: 620,
  optionsFontPx: 20,
  hintY: GAME_HEIGHT - 74,
  hintFontPx: 15,
  promptY: GAME_HEIGHT - 34,
  promptGap: 210,
  promptLabelGap: 22,
  promptFontPx: 14,
} as const;

const HEADING = 'LOCAL OVERCOOKED';
const TAGLINE = 'Two chefs, one kitchen, not enough time';

/** Option rows, in the order the cursor walks through them. */
const OPTION = { players: 0, difficulty: 1, chefs: 2, settings: 3, controllers: 4 } as const;

// Remembered between visits to the title within a session.
let selectedIndex = 0;

export class TitleScene extends Phaser.Scene {
  private inputMgr!: InputManager;
  private menuInput!: MenuInput;
  private keyboardNav!: KeyboardNav;
  private levelList: LevelList | null = null;
  private menu: MenuList | null = null;
  private statusText!: Phaser.GameObjects.Text;
  private hintText!: Phaser.GameObjects.Text;
  private settings!: Settings;
  private progress!: Progress;
  private readonly headerObjects: Phaser.GameObjects.GameObject[] = [];
  private readonly prompts: Phaser.GameObjects.GameObject[] = [];
  private readonly disposers: (() => void)[] = [];
  private index = 0;
  private optionsY: number = TITLE.optionsMaxY;
  private statusMessage = '';
  private ready = false;

  constructor() { super(SCENE.TITLE); }

  create(): void {
    this.settings = loadSettings();
    this.progress = loadProgress();

    this.cameras.main.setBackgroundColor(COLOR.bg);
    this.add.text(TITLE.headingX, TITLE.headingY, HEADING, textStyle(TITLE.headingFontPx, TEXT_COLOR.accent)).setOrigin(0, 0.5);
    this.add.text(TITLE.headingX, TITLE.taglineY, TAGLINE, textStyle(TITLE.taglineFontPx, TEXT_COLOR.dim)).setOrigin(0, 0.5);
    this.statusText = this.add
      .text(GAME_WIDTH / 2, TITLE.optionsMaxY, '', textStyle(TITLE.statusFontPx, TEXT_COLOR.dim))
      .setOrigin(0.5);
    this.hintText = this.add
      .text(GAME_WIDTH / 2, TITLE.hintY, '', textStyle(TITLE.hintFontPx, TEXT_COLOR.dim, { align: 'center' }))
      .setOrigin(0.5);

    this.inputMgr = createInputManager(this, MAX_PLAYERS);
    this.menuInput = new MenuInput();
    this.keyboardNav = new KeyboardNav(this);
    this.disposers.push(installAudioGestureResume(this), installMuteToggle(this));
    getAudioBus().stopMusic();

    this.buildLevelList(); // lays out where the settings rows go, below the level rows
    this.buildOptions();
    this.index = Phaser.Math.Clamp(selectedIndex, 0, this.rowCount() - 1);
    this.refreshCursor();
    this.buildPrompts();
    this.disposers.push(onLevelsHotReload(() => this.buildLevelList()));
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.cleanup, this);
    this.ready = true;
  }

  override update(): void {
    if (!this.ready || !this.menu) return;
    const nav = mergeNav(this.menuInput.poll(this.inputMgr.poll()), this.keyboardNav.poll());
    if (nav.up || nav.down) this.moveCursor(nav.down ? 1 : -1);
    if (!this.ready) return;
    if (this.onLevelRow()) {
      if (nav.confirm) this.chooseLevel();
    } else {
      this.menu.setIndex(this.index - this.levelCount());
      this.menu.handle({ ...nav, up: false, down: false });
    }
    if (!this.ready) return;
    selectedIndex = this.index;
  }

  // ─── Level rows ───────────────────────────────────────────────────────────
  private levelCount(): number { return this.levelList?.length ?? 0; }
  private rowCount(): number { return this.levelCount() + Object.keys(OPTION).length; }
  private onLevelRow(): boolean { return this.index < this.levelCount(); }

  private buildLevelList(): void {
    this.levelList?.destroy();
    const { levels, order } = currentLevels();
    if (order.length === 0) log.warn('no levels found for the title menu');
    const entries: LevelEntry[] = order.map((levelId) => {
      const level = levels[levelId];
      const saved = levelProgress(this.progress, levelId);
      return {
        id: levelId,
        name: level?.name ?? levelId,
        theme: level?.theme ?? '',
        stars: saved.stars,
        bestScore: saved.bestScore,
        locked: !isUnlocked(level ?? {}, this.progress, this.settings),
        unlockStars: level?.unlockStars ?? 0,
      };
    });
    const spacing = Math.min(TITLE.levelSpacing, TITLE.levelAreaPx / Math.max(1, entries.length));
    this.levelList = new LevelList(this, GAME_WIDTH / 2, TITLE.levelsY, entries, { spacing });
    // The settings follow the level rows, so a short list does not leave a hole.
    this.optionsY = Math.min(
      TITLE.levelsY + Math.max(0, entries.length - 1) * spacing + TITLE.levelGapPx,
      TITLE.optionsMaxY,
    );
    this.statusText.setY(this.optionsY - TITLE.statusGapPx);
    // The settings rows move with the list rather than being rebuilt: a rebuild from
    // inside a row's own callback would destroy the list that is mid-handle().
    this.menu?.container.setPosition(GAME_WIDTH / 2, this.optionsY);
    this.drawStarHeader();
    this.index = Phaser.Math.Clamp(this.index, 0, this.rowCount() - 1);
    this.refreshCursor();
  }

  /** Total stars top-right, with the count that actually opens levels when they differ. */
  private drawStarHeader(): void {
    for (const object of this.headerObjects) object.destroy();
    this.headerObjects.length = 0;
    const total = totalStars(this.progress);
    const counting = unlockingStars(this.progress);
    const text = this.add
      .text(TITLE.starsX, TITLE.starsY, String(total), textStyle(TITLE.starsFontPx, TEXT_COLOR.accent))
      .setOrigin(1, 0.5);
    const icon = this.add
      .image(TITLE.starsX - text.displayWidth - TITLE.starsIconGap, TITLE.starsY, TEX.iconStar)
      .setOrigin(1, 0.5);
    this.headerObjects.push(text, icon);
    if (counting === total) return;
    this.headerObjects.push(
      this.add
        .text(
          TITLE.starsX,
          TITLE.starsNoteY,
          `${counting} count toward unlocks`,
          textStyle(TITLE.starsNoteFontPx, TEXT_COLOR.dim),
        )
        .setOrigin(1, 0.5),
    );
  }

  private chooseLevel(): void {
    const entry = this.levelList?.entryAt(this.index);
    if (!entry) return;
    if (entry.locked) {
      getAudioBus().play('uiBack');
      this.statusMessage =
        `${entry.name} needs ${entry.unlockStars} stars, earned on ${presetName(DEFAULT_PRESET)} or harder`;
      this.refreshStatus();
      return;
    }
    getAudioBus().play('uiConfirm');
    this.ready = false;
    this.scene.start(SCENE.GAME, { levelId: entry.id, players: this.settings.players } satisfies GameSceneData);
  }

  // ─── Settings rows ────────────────────────────────────────────────────────
  private buildOptions(): void {
    this.menu?.destroy();
    const items: MenuItemSpec[] = [];
    items[OPTION.players] = {
      label: () => `Players: ${this.settings.players}`,
      onSelect: () => this.changePlayers(1),
      onLeft: () => this.changePlayers(-1),
      onRight: () => this.changePlayers(1),
    };
    items[OPTION.difficulty] = {
      label: () => `Difficulty: ${presetName(this.settings.preset)} · ${presetSummary(this.settings.preset)}`,
      onSelect: () => this.changePreset(1),
      onLeft: () => this.changePreset(-1),
      onRight: () => this.changePreset(1),
    };
    items[OPTION.chefs] = {
      label: () => `Chefs: ${chefSummary(this.settings.chefs)}`,
      onSelect: () => this.openPage(SCENE.CHEFS),
    };
    items[OPTION.settings] = {
      label: () => `Settings: ${settingsSummary(this.settings)}`,
      onSelect: () => this.openPage(SCENE.SETTINGS),
    };
    items[OPTION.controllers] = { label: () => 'Controllers', onSelect: () => this.openPage(SCENE.CONTROLLER) };

    this.menu = new MenuList(this, GAME_WIDTH / 2, this.optionsY, items, {
      spacing: TITLE.optionsSpacing,
      width: TITLE.optionsWidth,
      fontSize: TITLE.optionsFontPx,
    });
  }

  private changePlayers(delta: number): void {
    this.settings.players = cyclePlayers(this.settings.players, delta);
    this.applySettings();
  }

  private changePreset(delta: number): void {
    this.settings.preset = cyclePreset(this.settings.preset, delta);
    this.applySettings();
  }

  /** The Chefs, Settings and Controllers pages; each returns to a fresh title, which re-reads the settings. */
  private openPage(key: string): void {
    this.ready = false;
    this.scene.start(key);
  }

  /** Every settings edit goes through here: saved, then reflected in the labels. */
  private applySettings(): void {
    saveSettings(this.settings);
    this.menu?.refresh();
    this.refreshStatus();
  }

  // ─── Seed typing ──────────────────────────────────────────────────────────
  // ─── Cursor ───────────────────────────────────────────────────────────────
  private moveCursor(delta: number): void {
    const count = this.rowCount();
    if (count === 0) return;
    this.index = (this.index + delta + count) % count;
    this.statusMessage = '';
    getAudioBus().play('uiMove');
    this.refreshCursor();
  }

  private refreshCursor(): void {
    this.levelList?.setSelected(this.onLevelRow() ? this.index : -1);
    if (this.menu) {
      this.menu.setFocused(!this.onLevelRow());
      this.menu.setIndex(this.onLevelRow() ? 0 : this.index - this.levelCount());
    }
    this.refreshStatus();
    this.refreshHint();
  }

  private refreshStatus(): void {
    this.statusText.setText(this.statusMessage || this.statusForRow());
    this.statusText.setColor(this.statusMessage ? TEXT_COLOR.danger : TEXT_COLOR.dim);
  }

  private statusForRow(): string {
    const entry = this.levelList?.entryAt(this.index);
    if (!entry) return 'Left / right changes a setting';
    if (entry.locked) return `Locked · needs ${entry.unlockStars} stars from ${presetName(DEFAULT_PRESET)} or harder`;
    const saved = levelProgress(this.progress, entry.id);
    if (saved.plays === 0) return 'Never played';
    return `Best ${saved.bestScore} · ${saved.stars} stars · ${saved.plays} play${saved.plays === 1 ? '' : 's'}`;
  }

  // ─── Prompts ──────────────────────────────────────────────────────────────
  private refreshHint(): void {
    this.hintText.setText(
      `${this.labelFor('up')} / ${this.labelFor('down')} choose · left / right change · ` +
        `${this.labelFor('pickup')} select · M mute`,
    );
  }

  /** Draws the button-prompt art for confirm and back when the art module has it. */
  private buildPrompts(): void {
    const actions: { action: GameAction; caption: string }[] = [
      { action: 'pickup', caption: 'Select' },
      { action: 'pause', caption: 'Back' },
    ];
    actions.forEach(({ action, caption }, i) => {
      const label = this.labelFor(action);
      const key = TEX.buttonPrompt(label);
      if (!this.textures.exists(key)) return;
      const x = GAME_WIDTH / 2 + (i === 0 ? -TITLE.promptGap : TITLE.promptGap);
      const icon = this.add.image(x, TITLE.promptY, key).setOrigin(0.5);
      const text = this.add
        .text(x + TITLE.promptLabelGap, TITLE.promptY, caption, textStyle(TITLE.promptFontPx, TEXT_COLOR.dim))
        .setOrigin(0, 0.5);
      this.prompts.push(icon, text);
    });
  }

  private labelFor(action: GameAction): string {
    return this.inputMgr.labelFor(0, action);
  }

  // ─── Teardown ─────────────────────────────────────────────────────────────
  private cleanup(): void {
    this.ready = false;
    for (const dispose of this.disposers) dispose();
    this.disposers.length = 0;
    for (const prompt of this.prompts) prompt.destroy();
    this.prompts.length = 0;
    for (const object of this.headerObjects) object.destroy();
    this.headerObjects.length = 0;
    this.levelList?.destroy();
    this.levelList = null;
    this.menu?.destroy();
    this.menu = null;
    this.keyboardNav?.destroy();
    this.inputMgr?.destroy();
  }
}
