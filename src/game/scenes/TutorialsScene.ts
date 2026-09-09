// ─── Tutorials scene ────────────────────────────────────────────────────────
// The tutorial kitchens (game: 'tutorial', one per mechanic in docs/MECHANICS.md), listed
// here rather than on the title so the level list there stays short. One cursor runs over
// the tutorial rows and then the Back row; the block under the list shows the selected
// tutorial's rules and the player's record on it. Choosing a row starts the kitchen.
import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH, MAX_PLAYERS, SCENE } from '../../config';
import { createInputManager, menuLabels } from '../../input';
import type { HintAction, InputManager } from '../../input/types';
import type { LevelDef } from '../../levels/schema';
import { getAudioBus, installAudioGestureResume, installMuteToggle } from '../audioBus';
import { currentLevels } from '../levelHotReload';
import { levelProgress, loadProgress, type Progress } from '../progress';
import { loadSettings, type Settings } from '../settings';
import { fillLabels } from '../tutorial';
import { LevelList, type LevelEntry } from '../ui/LevelList';
import { MenuList } from '../ui/MenuList';
import { KeyboardNav, MenuInput, mergeNav } from '../ui/menuInput';
import { COLOR, TEXT_COLOR, textStyle } from '../ui/theme';
import type { GameSceneData } from '../types';

// ─── Constants ──────────────────────────────────────────────────────────────
const PAGE = {
  headingX: 40,
  headingY: 40,
  headingFontPx: 36,
  taglineY: 72,
  taglineFontPx: 14,
  listY: 136,
  listSpacing: 50,
  backGapPx: 74,       // from the last tutorial row down to the Back row
  backWidth: 380,
  backFontPx: 22,
  rulesGapPx: 58,      // from the Back row down to the rules block
  rulesX: 190,
  rulesFontPx: 16,
  rulesWrapPx: 900,
  rulesLineSpacing: 6,
  recordGapPx: 16,
  recordFontPx: 15,
  hintY: GAME_HEIGHT - 74,
  hintFontPx: 15,
} as const;

const HEADING = 'TUTORIALS';
const TAGLINE = 'One short kitchen per mechanic. The clock waits for your first serve, so take your time.';
const NO_TUTORIALS = 'No tutorial kitchens found';
const UNLOCK_NOTE = 'Stars earned here are saved but never count toward unlocks';
const BULLET = '•';

// Remembered between visits within a session.
let selectedIndex = 0;

// ─── Scene ──────────────────────────────────────────────────────────────────
export class TutorialsScene extends Phaser.Scene {
  private inputMgr!: InputManager;
  private menuInput!: MenuInput;
  private keyboardNav!: KeyboardNav;
  private list: LevelList | null = null;
  private back!: MenuList;
  private rules!: Phaser.GameObjects.Text;
  private record!: Phaser.GameObjects.Text;
  private settings!: Settings;
  private progress!: Progress;
  private levels: LevelDef[] = [];
  private readonly disposers: (() => void)[] = [];
  private index = 0;
  private ready = false;

  constructor() { super(SCENE.TUTORIALS); }

  create(): void {
    this.settings = loadSettings();
    this.progress = loadProgress();
    const { levels, order } = currentLevels();
    this.levels = order.map((id) => levels[id]).filter((l): l is LevelDef => l !== undefined && l.game === 'tutorial');

    this.cameras.main.setBackgroundColor(COLOR.bg);
    this.add.text(PAGE.headingX, PAGE.headingY, HEADING, textStyle(PAGE.headingFontPx, TEXT_COLOR.accent)).setOrigin(0, 0.5);
    this.add.text(PAGE.headingX, PAGE.taglineY, TAGLINE, textStyle(PAGE.taglineFontPx, TEXT_COLOR.dim)).setOrigin(0, 0.5);

    this.inputMgr = createInputManager(this, MAX_PLAYERS);
    this.menuInput = new MenuInput();
    this.keyboardNav = new KeyboardNav(this);
    this.disposers.push(installAudioGestureResume(this), installMuteToggle(this));
    getAudioBus().stopMusic();

    const entries: LevelEntry[] = this.levels.map((level) => {
      const saved = levelProgress(this.progress, level.id);
      return {
        id: level.id,
        name: level.name,
        theme: level.tutorial?.title ?? level.theme,
        stars: saved.stars,
        bestScore: saved.bestScore,
        locked: false,
        unlockStars: 0,
      };
    });
    if (entries.length > 0) this.list = new LevelList(this, GAME_WIDTH / 2, PAGE.listY, entries, { spacing: PAGE.listSpacing });
    else this.add.text(GAME_WIDTH / 2, PAGE.listY, NO_TUTORIALS, textStyle(PAGE.rulesFontPx, TEXT_COLOR.dim)).setOrigin(0.5);

    const backY = PAGE.listY + Math.max(0, entries.length - 1) * PAGE.listSpacing + PAGE.backGapPx;
    this.back = new MenuList(this, GAME_WIDTH / 2, backY, [{ label: () => 'Back', onSelect: () => this.goBack() }], {
      width: PAGE.backWidth,
      fontSize: PAGE.backFontPx,
    });
    const rulesY = backY + PAGE.rulesGapPx;
    this.rules = this.add
      .text(PAGE.rulesX, rulesY, '', textStyle(PAGE.rulesFontPx, TEXT_COLOR.bright, { wordWrap: { width: PAGE.rulesWrapPx } }))
      .setOrigin(0, 0)
      .setLineSpacing(PAGE.rulesLineSpacing);
    this.record = this.add.text(PAGE.rulesX, rulesY, '', textStyle(PAGE.recordFontPx, TEXT_COLOR.dim)).setOrigin(0, 0);

    const labels = menuLabels(this.labelFor);
    this.add
      .text(GAME_WIDTH / 2, PAGE.hintY, `${labels.choose} choose · ${labels.select} start · ${labels.back} back · M mute`, textStyle(PAGE.hintFontPx, TEXT_COLOR.dim))
      .setOrigin(0.5);

    this.index = Phaser.Math.Clamp(selectedIndex, 0, this.rowCount() - 1);
    this.refreshCursor();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.cleanup, this);
    this.ready = true;
  }

  override update(): void {
    if (!this.ready) return;
    const nav = mergeNav(this.menuInput.poll(this.inputMgr.poll()), this.keyboardNav.poll());
    if (nav.back) {
      this.goBack();
      return;
    }
    if (nav.up || nav.down) this.moveCursor(nav.down ? 1 : -1);
    if (this.onLevelRow()) {
      if (nav.confirm) this.startTutorial();
    } else {
      this.back.handle({ ...nav, up: false, down: false });
    }
    if (!this.ready) return;
    selectedIndex = this.index;
  }

  // ─── Rows ─────────────────────────────────────────────────────────────────
  private levelCount(): number { return this.levels.length; }
  private rowCount(): number { return this.levelCount() + 1; }
  private onLevelRow(): boolean { return this.index < this.levelCount(); }

  private moveCursor(delta: number): void {
    const count = this.rowCount();
    this.index = (this.index + delta + count) % count;
    getAudioBus().play('uiMove');
    this.refreshCursor();
  }

  private refreshCursor(): void {
    this.list?.setSelected(this.onLevelRow() ? this.index : -1);
    this.back.setFocused(!this.onLevelRow());
    this.back.setIndex(0);
    this.refreshRules();
  }

  /** The selected tutorial's rules and the player's record; nothing on the Back row. */
  private refreshRules(): void {
    const level = this.onLevelRow() ? this.levels[this.index] : undefined;
    const tutorial = level?.tutorial;
    if (!level || !tutorial) {
      this.rules.setText('');
      this.record.setText('');
      return;
    }
    this.rules.setText(tutorial.intro.map((line) => `${BULLET} ${fillLabels(line, this.labelFor)}`).join('\n'));
    const lines = [this.recordLine(level)];
    const needs = Math.max(1, ...tutorial.steps.map((step) => step.minPlayers ?? 1));
    if (needs > this.settings.players) lines.push(`Some steps need ${needs} players; with ${this.settings.players} you see the rules and skip them`);
    lines.push(UNLOCK_NOTE);
    this.record.setText(lines.join('\n'));
    this.record.setY(this.rules.y + this.rules.height + PAGE.recordGapPx);
  }

  private recordLine(level: LevelDef): string {
    const saved = levelProgress(this.progress, level.id);
    if (saved.plays === 0) return 'Never played';
    return `Best ${saved.bestScore} · ${saved.stars} stars · ${saved.plays} play${saved.plays === 1 ? '' : 's'}`;
  }

  // ─── Navigation ───────────────────────────────────────────────────────────
  private startTutorial(): void {
    const level = this.levels[this.index];
    if (!level) return;
    getAudioBus().play('uiConfirm');
    this.ready = false;
    this.scene.start(SCENE.GAME, { levelId: level.id, players: this.settings.players } satisfies GameSceneData);
  }

  private goBack(): void {
    getAudioBus().play('uiBack');
    this.ready = false;
    this.scene.start(SCENE.TITLE);
  }

  private readonly labelFor = (action: HintAction): string => this.inputMgr.labelFor(0, action);

  // ─── Teardown ─────────────────────────────────────────────────────────────
  private cleanup(): void {
    this.ready = false;
    for (const dispose of this.disposers) dispose();
    this.disposers.length = 0;
    this.list?.destroy();
    this.list = null;
    this.back?.destroy();
    this.keyboardNav?.destroy();
    this.inputMgr?.destroy();
  }
}
