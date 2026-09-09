// ─── Title scene ────────────────────────────────────────────────────────────
// Level select over the saved progress, the two settings changed most (players, difficulty
// preset), and the doors to the Tutorials, Chefs, Settings and Controllers pages. One cursor
// runs through the level rows and then the option rows; left / right edits the row it is on.
// Navigable with the keyboard and with any device the input manager reports.
//
// The screen is a sidebar of tickets over a living diorama: the selected kitchen is built on
// the 3D stage with the players' own chefs standing at their spawns, framed to the right of
// the sidebar, swaying slowly; a card in the corner carries its name and record.
import Phaser from 'phaser';
import { TEX } from '../../art/keys';
import { GAME_HEIGHT, GAME_WIDTH, MAX_PLAYERS, SCENE } from '../../config';
import { createInputManager, menuLabels } from '../../input';
import type { FullInputManager, HintAction } from '../../input/types';
import type { LevelDef } from '../../levels/schema';
import { log } from '../../log';
import { Sim } from '../../sim';
import type { SimState } from '../../sim/types';
import { getAudioBus, installAudioGestureResume, installMuteToggle } from '../audioBus';
import { currentLevels, onLevelsHotReload } from '../levelHotReload';
import { MAX_STARS, isUnlocked, levelProgress, loadProgress, totalStars, unlockingStars, type Progress } from '../progress';
import { KitchenRenderer, type TilePos } from '../render/KitchenRenderer';
import {
  chefSummary, cyclePlayers, cyclePreset, DEFAULT_PRESET, difficultySummary, loadSettings, presetModifiers, presetName,
  saveSettings, settingsSummary, type Settings,
} from '../settings';
import { LevelList, type LevelEntry } from '../ui/LevelList';
import { MenuList, type MenuItemSpec } from '../ui/MenuList';
import { KeyboardNav, MenuInput, mergeNav } from '../ui/menuInput';
import { installBackdrop, revealStagger, roundedPanel } from '../ui/panel';
import { COLOR, displayStyle, TEXT_COLOR, textStyle } from '../ui/theme';
import type { GameSceneData } from '../types';

// ─── Constants ──────────────────────────────────────────────────────────────
const TITLE = {
  // The sidebar: wordmark, the level tickets, the option rows, the hint.
  sidebarWidth: 620,
  sidebarAlpha: 0.94,
  sidebarEdgePx: 3,
  columnX: 320,         // centre of the sidebar's lists
  headingX: 40,
  headingY: 46,
  headingFontPx: 42,
  taglineY: 88,
  taglineFontPx: 13,
  taglineSpacing: 2,
  levelsY: 140,
  levelSpacing: 34,
  levelAreaPx: 380,     // rows are squeezed together rather than run off the sidebar
  levelWidth: 560,
  levelGapPx: 66,       // from the last level row down to the settings block
  optionsMaxY: 560,     // however few levels there are, the settings stay above the hint
  statusGapPx: 30,      // the status line sits this far above the settings
  statusFontPx: 14,
  optionsSpacing: 36,
  optionsWidth: 560,
  optionsFontPx: 19,
  hintY: GAME_HEIGHT - 28,
  hintFontPx: 13,
  // Over the diorama: the star header and the level card.
  starsX: GAME_WIDTH - 40,
  starsY: 44,
  starsFontPx: 26,
  starsIconGap: 10,
  starsNoteY: 72,
  starsNoteFontPx: 13,
  cardX: 950,
  cardY: 664,
  cardWidth: 580,
  cardHeight: 196,
  cardAlpha: 0.93,
  cardTextX: 686,       // left edge of the card's text
  cardNameY: 594,
  cardNameFontPx: 38,
  cardNameMaxPx: 380,
  cardThemeY: 626,
  cardThemeFontPx: 13,
  cardDescY: 642,       // the level's description, wrapped, top-aligned
  cardDescFontPx: 15,
  cardDescWrapPx: 524,
  cardDescLineSpacing: 3,
  cardRecordY: 740,
  cardRecordFontPx: 15,
  cardStarsX: 1170,     // the middle star
  cardStarsY: 598,
  cardStarGap: 44,
  cardStarScale: 1.15,
  promptY: GAME_HEIGHT - 26,
  promptX: 720,
  promptGap: 180,
  promptLabelGap: 22,
  promptFontPx: 13,
  revealDelayMs: 60,
} as const;

/** The diorama: the selected kitchen framed to the right of the sidebar, seen from the front-right. */
const DIORAMA = {
  band: { left: 650, top: 60, right: 1250, bottom: 545 },
  yawRad: -0.42,
  pitchDeg: 50,
  swayRad: 0.07,
  swaySec: 9,
  seed: 1,
  maxFrameSec: 0.1,     // a stalled tab never fast-forwards the idle clips
} as const;

const HEADING = { first: 'LOCAL ', second: 'OVERCOOKED' } as const;
const TAGLINE = 'TWO CHEFS  ·  ONE KITCHEN  ·  NOT ENOUGH TIME';
const FIRST_RUN_HINT = 'First time? Controllers walks you through every button';
const NEVER_PLAYED = 'Never played';
const STRATEGY_KICKER = 'HOW TO BEAT IT';
const NO_STRATEGY = 'No strategy written for this kitchen yet';

/** Option rows, in the order the cursor walks through them. */
const OPTION = { tutorials: 0, players: 1, difficulty: 2, chefs: 3, settings: 4, controllers: 5 } as const;
const TUTORIALS_NOTE = 'Learn the five mechanics one at a time; stars earned there never count toward unlocks';

// Remembered between visits to the title within a session.
let selectedIndex = 0;

export class TitleScene extends Phaser.Scene {
  private inputMgr!: FullInputManager;
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
  // The diorama and its card.
  private diorama: KitchenRenderer | null = null;
  private dioramaState: Readonly<SimState> | null = null;
  private dioramaId = '';
  private dioramaTargets: (TilePos | null)[] = [];
  private swayMs = 0;
  private cardName!: Phaser.GameObjects.Text;
  private cardTheme!: Phaser.GameObjects.Text;
  private cardDescription!: Phaser.GameObjects.Text;
  private cardRecord!: Phaser.GameObjects.Text;
  private readonly cardStars: Phaser.GameObjects.Image[] = [];
  private index = 0;
  private optionsY: number = TITLE.optionsMaxY;
  private statusMessage = '';
  private strategyShown = false; // the card shows the strategy instead of the description; off again on every move
  private ready = false;

  constructor() { super(SCENE.TITLE); }

  create(): void {
    this.settings = loadSettings();
    this.progress = loadProgress();

    // Transparent: the diorama draws on the 3D canvas behind this one; the sidebar covers its left.
    this.cameras.main.setBackgroundColor('rgba(0,0,0,0)');
    installBackdrop(this)?.setCrop(0, 0, TITLE.sidebarWidth, GAME_HEIGHT);
    this.add.rectangle(0, 0, TITLE.sidebarWidth, GAME_HEIGHT, COLOR.bg, TITLE.sidebarAlpha).setOrigin(0, 0).setDepth(-11);
    this.add.rectangle(TITLE.sidebarWidth, 0, TITLE.sidebarEdgePx, GAME_HEIGHT, COLOR.tomato).setOrigin(0, 0).setDepth(-9);

    const first = this.add.text(TITLE.headingX, TITLE.headingY, HEADING.first, displayStyle(TITLE.headingFontPx)).setOrigin(0, 0.5);
    const second = this.add
      .text(TITLE.headingX + first.displayWidth, TITLE.headingY, HEADING.second, displayStyle(TITLE.headingFontPx, TEXT_COLOR.accent))
      .setOrigin(0, 0.5);
    const tagline = this.add
      .text(TITLE.headingX, TITLE.taglineY, TAGLINE, textStyle(TITLE.taglineFontPx, TEXT_COLOR.dim, { letterSpacing: TITLE.taglineSpacing }))
      .setOrigin(0, 0.5);
    this.statusText = this.add
      .text(TITLE.columnX, TITLE.optionsMaxY, '', textStyle(TITLE.statusFontPx, TEXT_COLOR.dim))
      .setOrigin(0.5);
    this.hintText = this.add
      .text(TITLE.columnX, TITLE.hintY, '', textStyle(TITLE.hintFontPx, TEXT_COLOR.dim, { align: 'center' }))
      .setOrigin(0.5);

    this.inputMgr = createInputManager(this, MAX_PLAYERS);
    this.menuInput = new MenuInput();
    this.keyboardNav = new KeyboardNav(this);
    this.disposers.push(installAudioGestureResume(this), installMuteToggle(this));
    getAudioBus().stopMusic();

    this.buildCard();
    this.buildLevelList(); // lays out where the settings rows go, below the level rows
    this.buildOptions();
    this.index = Phaser.Math.Clamp(selectedIndex, 0, this.rowCount() - 1);
    this.refreshCursor();
    this.buildPrompts();
    this.disposers.push(onLevelsHotReload(() => this.buildLevelList()));
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.cleanup, this);
    this.ready = true;

    const reveal: (Phaser.GameObjects.Text | Phaser.GameObjects.Container)[] = [first, second, tagline];
    if (this.levelList) reveal.push(this.levelList.container);
    reveal.push(this.statusText);
    if (this.menu) reveal.push(this.menu.container);
    reveal.push(this.hintText);
    revealStagger(this, reveal, TITLE.revealDelayMs);
  }

  override update(_time: number, deltaMs: number): void {
    if (!this.ready || !this.menu) return;
    const inputs = this.inputMgr.poll();
    const nav = mergeNav(this.menuInput.poll(inputs), this.keyboardNav.poll());
    if (nav.up || nav.down) this.moveCursor(nav.down ? 1 : -1);
    if (!this.ready) return;
    if (this.onLevelRow()) {
      if (nav.confirm) this.chooseLevel();
      else if (inputs.some((input) => input.interactPressed)) this.toggleStrategy();
    } else {
      this.menu.setIndex(this.index - this.levelCount());
      this.menu.handle({ ...nav, up: false, down: false });
    }
    if (!this.ready) return;
    selectedIndex = this.index;
    this.drawDiorama(deltaMs);
  }

  // ─── Level rows ───────────────────────────────────────────────────────────
  private levelCount(): number { return this.levelList?.length ?? 0; }
  private rowCount(): number { return this.levelCount() + Object.keys(OPTION).length; }
  private onLevelRow(): boolean { return this.index < this.levelCount(); }

  private buildLevelList(): void {
    this.levelList?.destroy();
    const { levels, order } = currentLevels();
    if (order.length === 0) log.warn('no levels found for the title menu');
    // The tutorial kitchens have their own page, so the list here stays short.
    const listed = order.filter((levelId) => levels[levelId]?.game !== 'tutorial');
    const entries: LevelEntry[] = listed.map((levelId) => {
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
    this.levelList = new LevelList(this, TITLE.columnX, TITLE.levelsY, entries, { spacing, width: TITLE.levelWidth });
    // The settings follow the level rows, so a short list does not leave a hole.
    this.optionsY = Math.min(
      TITLE.levelsY + Math.max(0, entries.length - 1) * spacing + TITLE.levelGapPx,
      TITLE.optionsMaxY,
    );
    this.statusText.setY(this.optionsY - TITLE.statusGapPx);
    // The settings rows move with the list rather than being rebuilt: a rebuild from
    // inside a row's own callback would destroy the list that is mid-handle().
    this.menu?.container.setPosition(TITLE.columnX, this.optionsY);
    this.drawStarHeader();
    this.index = Phaser.Math.Clamp(this.index, 0, this.rowCount() - 1);
    this.dioramaId = ''; // a hot reload rebuilds the diorama for the same id
    this.refreshCursor();
  }

  /** Total stars top-right, with the count that actually opens levels when they differ. */
  private drawStarHeader(): void {
    for (const object of this.headerObjects) object.destroy();
    this.headerObjects.length = 0;
    const total = totalStars(this.progress);
    const counting = unlockingStars(this.progress);
    const text = this.add
      .text(TITLE.starsX, TITLE.starsY, String(total), displayStyle(TITLE.starsFontPx, TEXT_COLOR.accent))
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

  // ─── Diorama and card ─────────────────────────────────────────────────────
  /** The selected kitchen on the 3D stage, with the players' chefs at their spawns. */
  private buildDiorama(levelId: string, level: LevelDef | undefined): void {
    if (levelId === this.dioramaId) return;
    this.diorama?.destroy();
    this.diorama = null;
    this.dioramaState = null;
    this.dioramaId = levelId;
    if (!level) return;
    const sim = new Sim(level, { players: this.settings.players, seed: DIORAMA.seed, modifiers: presetModifiers(this.settings) });
    const state = sim.getState();
    this.diorama = new KitchenRenderer(this, state, level.theme, this.settings.chefs, { passThroughShelf: sim.getEffectiveSettings().passThroughShelf }, {
      band: DIORAMA.band, yawRad: DIORAMA.yawRad, pitchDeg: DIORAMA.pitchDeg,
    });
    this.diorama.container.setDepth(-8);
    this.dioramaState = state;
    this.dioramaTargets = state.chefs.map(() => null);
  }

  private drawDiorama(deltaMs: number): void {
    if (!this.diorama || !this.dioramaState) return;
    const dt = Math.min(deltaMs / 1000, DIORAMA.maxFrameSec);
    this.swayMs += deltaMs;
    this.diorama.orbit(Math.sin((this.swayMs / 1000 / DIORAMA.swaySec) * Math.PI * 2) * DIORAMA.swayRad);
    this.diorama.draw(this.dioramaState, this.dioramaTargets, dt);
  }

  private buildCard(): void {
    roundedPanel(this, TITLE.cardWidth, TITLE.cardHeight, { fill: COLOR.panel, alpha: TITLE.cardAlpha, edge: COLOR.panelEdge })
      .setPosition(TITLE.cardX, TITLE.cardY);
    this.cardName = this.add.text(TITLE.cardTextX, TITLE.cardNameY, '', displayStyle(TITLE.cardNameFontPx, TEXT_COLOR.accent)).setOrigin(0, 0.5);
    this.cardTheme = this.add.text(TITLE.cardTextX, TITLE.cardThemeY, '', textStyle(TITLE.cardThemeFontPx, TEXT_COLOR.dim)).setOrigin(0, 0.5);
    this.cardDescription = this.add
      .text(TITLE.cardTextX, TITLE.cardDescY, '', textStyle(TITLE.cardDescFontPx, TEXT_COLOR.bright, { wordWrap: { width: TITLE.cardDescWrapPx } }))
      .setOrigin(0, 0)
      .setLineSpacing(TITLE.cardDescLineSpacing);
    this.cardRecord = this.add.text(TITLE.cardTextX, TITLE.cardRecordY, '', textStyle(TITLE.cardRecordFontPx)).setOrigin(0, 0.5);
    for (let s = 0; s < MAX_STARS; s++) {
      this.cardStars.push(
        this.add.image(TITLE.cardStarsX + (s - 1) * TITLE.cardStarGap, TITLE.cardStarsY, TEX.iconStarEmpty).setScale(TITLE.cardStarScale),
      );
    }
  }

  /** The card and the diorama follow the level row under the cursor; option rows keep the last one. */
  private refreshCard(): void {
    const entry = this.onLevelRow() ? this.levelList?.entryAt(this.index) : null;
    if (!entry) return;
    const { levels } = currentLevels();
    this.buildDiorama(entry.id, levels[entry.id]);
    this.cardName.setText(entry.name).setScale(1);
    if (this.cardName.width > TITLE.cardNameMaxPx) this.cardName.setScale(TITLE.cardNameMaxPx / this.cardName.width);
    const level = levels[entry.id];
    if (this.strategyShown) {
      this.cardTheme.setText(STRATEGY_KICKER).setColor(TEXT_COLOR.accent);
      this.cardDescription.setText(level?.strategy ?? NO_STRATEGY).setColor(TEXT_COLOR.accent);
    } else {
      this.cardTheme.setText(entry.theme.toUpperCase()).setColor(TEXT_COLOR.dim);
      this.cardDescription.setText(level?.description ?? '').setColor(TEXT_COLOR.bright);
    }
    const saved = levelProgress(this.progress, entry.id);
    if (entry.locked) {
      this.cardRecord.setText(`Locked · needs ${entry.unlockStars} stars from ${presetName(DEFAULT_PRESET)} or harder`).setColor(TEXT_COLOR.dim);
    } else if (saved.plays === 0) {
      this.cardRecord.setText(NEVER_PLAYED).setColor(TEXT_COLOR.dim);
    } else {
      this.cardRecord.setText(`Best ${saved.bestScore} · ${saved.plays} play${saved.plays === 1 ? '' : 's'}`).setColor(TEXT_COLOR.bright);
    }
    this.cardStars.forEach((star, s) => star.setTexture(s < entry.stars && !entry.locked ? TEX.iconStar : TEX.iconStarEmpty));
  }

  // ─── Settings rows ────────────────────────────────────────────────────────
  private buildOptions(): void {
    this.menu?.destroy();
    const items: MenuItemSpec[] = [];
    items[OPTION.tutorials] = {
      label: () => `Tutorials: ${this.tutorialSummary()}`,
      onSelect: () => this.openPage(SCENE.TUTORIALS),
    };
    items[OPTION.players] = {
      label: () => `Players: ${this.settings.players}`,
      onSelect: () => this.changePlayers(1),
      onLeft: () => this.changePlayers(-1),
      onRight: () => this.changePlayers(1),
    };
    items[OPTION.difficulty] = {
      label: () => `Difficulty: ${presetName(this.settings.preset)} · ${difficultySummary(this.settings)}`,
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

    this.menu = new MenuList(this, TITLE.columnX, this.optionsY, items, {
      spacing: TITLE.optionsSpacing,
      width: TITLE.optionsWidth,
      fontSize: TITLE.optionsFontPx,
    });
  }

  /** How many tutorial kitchens there are and how many have been played. */
  private tutorialSummary(): string {
    const { levels, order } = currentLevels();
    const ids = order.filter((levelId) => levels[levelId]?.game === 'tutorial');
    const played = ids.filter((levelId) => levelProgress(this.progress, levelId).plays > 0).length;
    if (played === 0) return `${ids.length} short kitchens, one mechanic each`;
    return `${played} of ${ids.length} played`;
  }

  private changePlayers(delta: number): void {
    this.settings.players = cyclePlayers(this.settings.players, delta);
    this.applySettings();
    this.dioramaId = ''; // the diorama stands as many chefs as will play
    this.refreshCard();
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

  // ─── Cursor ───────────────────────────────────────────────────────────────
  private moveCursor(delta: number): void {
    const count = this.rowCount();
    if (count === 0) return;
    this.index = (this.index + delta + count) % count;
    this.statusMessage = '';
    this.strategyShown = false;
    getAudioBus().play('uiMove');
    this.refreshCursor();
  }

  /** The work button on a level row swaps the card's description for the strategy, and back. */
  private toggleStrategy(): void {
    this.strategyShown = !this.strategyShown;
    getAudioBus().play('uiMove');
    this.refreshCard();
  }

  private refreshCursor(): void {
    this.levelList?.setSelected(this.onLevelRow() ? this.index : -1);
    if (this.menu) {
      this.menu.setFocused(!this.onLevelRow());
      this.menu.setIndex(this.onLevelRow() ? 0 : this.index - this.levelCount());
    }
    this.refreshStatus();
    this.refreshHint();
    this.refreshCard();
  }

  private refreshStatus(): void {
    this.statusText.setText(this.statusMessage || this.statusForRow());
    this.statusText.setColor(this.statusMessage ? TEXT_COLOR.danger : TEXT_COLOR.dim);
  }

  private statusForRow(): string {
    const entry = this.levelList?.entryAt(this.index);
    if (!entry) {
      const option = this.index - this.levelCount();
      if (option === OPTION.tutorials) return TUTORIALS_NOTE;
      const onControllers = option === OPTION.controllers;
      return onControllers && !this.inputMgr.hasSavedBindings() ? FIRST_RUN_HINT : 'Left / right changes a setting';
    }
    if (entry.locked) return `Locked · needs ${entry.unlockStars} stars from ${presetName(DEFAULT_PRESET)} or harder`;
    const saved = levelProgress(this.progress, entry.id);
    if (saved.plays === 0) return NEVER_PLAYED;
    return `Best ${saved.bestScore} · ${saved.stars} stars · ${saved.plays} play${saved.plays === 1 ? '' : 's'}`;
  }

  // ─── Prompts ──────────────────────────────────────────────────────────────
  private refreshHint(): void {
    const labels = menuLabels(this.labelFor);
    this.hintText.setText(`${labels.choose} choose · ${labels.change} change · ${labels.select} select · ${this.labelFor('interact')} strategy · M mute`);
  }

  /** Draws the button-prompt art for confirm and back when the art module has it. */
  private buildPrompts(): void {
    const actions: { action: HintAction; caption: string }[] = [
      { action: 'pickup', caption: 'Select' },
      { action: 'interact', caption: 'Strategy' },
      { action: 'back', caption: 'Back' },
    ];
    actions.forEach(({ action, caption }, i) => {
      const label = this.labelFor(action);
      const key = TEX.buttonPrompt(label);
      if (!this.textures.exists(key)) return;
      const x = TITLE.promptX + i * TITLE.promptGap;
      const icon = this.add.image(x, TITLE.promptY, key).setOrigin(0.5);
      const text = this.add
        .text(x + TITLE.promptLabelGap, TITLE.promptY, caption, textStyle(TITLE.promptFontPx, TEXT_COLOR.dim))
        .setOrigin(0, 0.5);
      this.prompts.push(icon, text);
    });
  }

  private readonly labelFor = (action: HintAction): string => this.inputMgr.labelFor(0, action);

  // ─── Teardown ─────────────────────────────────────────────────────────────
  private cleanup(): void {
    this.ready = false;
    for (const dispose of this.disposers) dispose();
    this.disposers.length = 0;
    for (const prompt of this.prompts) prompt.destroy();
    this.prompts.length = 0;
    for (const object of this.headerObjects) object.destroy();
    this.headerObjects.length = 0;
    this.diorama?.destroy();
    this.diorama = null;
    this.dioramaState = null;
    this.dioramaId = '';
    this.cardStars.length = 0;
    this.levelList?.destroy();
    this.levelList = null;
    this.menu?.destroy();
    this.menu = null;
    this.keyboardNav?.destroy();
    this.inputMgr?.destroy();
  }
}
