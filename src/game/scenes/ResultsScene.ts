// ─── Results scene ──────────────────────────────────────────────────────────
// Score against the level's star thresholds, plus what to do next.
import Phaser from 'phaser';
import { TEX } from '../../art/keys';
import { GAME_HEIGHT, GAME_WIDTH, MAX_PLAYERS, SCENE } from '../../config';
import { createInputManager } from '../../input';
import type { InputManager } from '../../input/types';
import { log } from '../../log';
import { getAudioBus, installAudioGestureResume, installMuteToggle } from '../audioBus';
import { currentLevels } from '../levelHotReload';
import { MenuList, type MenuItemSpec } from '../ui/MenuList';
import { KeyboardNav, MenuInput, mergeNav } from '../ui/menuInput';
import { COLOR, TEXT_COLOR, textStyle } from '../ui/theme';
import type { GameSceneData, ResultsSceneData } from '../types';

export type { ResultsSceneData } from '../types';

// ─── Constants ──────────────────────────────────────────────────────────────
const RESULTS = {
  headingY: 96,
  headingFontPx: 44,
  subheadingY: 142,
  subheadingFontPx: 18,
  starsY: 250,
  starGap: 150,
  starScale: 2.2,
  thresholdOffsetY: 62,
  thresholdFontPx: 16,
  scoreY: 372,
  scoreFontPx: 40,
  scoreIconGap: 34,
  countsY: 424,
  countsFontPx: 18,
  menuY: 512,
  menuSpacing: 44,
  hintY: GAME_HEIGHT - 56,
  hintFontPx: 15,
  starCount: 3,
} as const;

const FALLBACK: ResultsSceneData = {
  levelId: '',
  players: MAX_PLAYERS,
  score: 0,
  stars: 0,
  servedCount: 0,
  failedCount: 0,
  thresholds: [0, 0, 0],
};

export class ResultsScene extends Phaser.Scene {
  private inputMgr!: InputManager;
  private menuInput!: MenuInput;
  private keyboardNav!: KeyboardNav;
  private menu!: MenuList;
  private readonly disposers: (() => void)[] = [];
  private ready = false;

  constructor() { super(SCENE.RESULTS); }

  create(data: ResultsSceneData): void {
    const result: ResultsSceneData = { ...FALLBACK, ...data };
    const { levels, order } = currentLevels();
    const levelName = levels[result.levelId]?.name ?? result.levelId;
    log.info('results', result.levelId, 'score', result.score, 'stars', result.stars);

    this.cameras.main.setBackgroundColor(COLOR.bg);
    this.add
      .text(GAME_WIDTH / 2, RESULTS.headingY, `${levelName} complete`, textStyle(RESULTS.headingFontPx, TEXT_COLOR.accent))
      .setOrigin(0.5);
    this.add
      .text(
        GAME_WIDTH / 2,
        RESULTS.subheadingY,
        `${result.players} player${result.players === 1 ? '' : 's'}`,
        textStyle(RESULTS.subheadingFontPx, TEXT_COLOR.dim),
      )
      .setOrigin(0.5);

    this.drawStars(result);
    this.drawScore(result);

    this.inputMgr = createInputManager(this, MAX_PLAYERS);
    this.menuInput = new MenuInput();
    this.keyboardNav = new KeyboardNav(this);
    this.disposers.push(installAudioGestureResume(this), installMuteToggle(this));
    getAudioBus().stopMusic();

    const index = order.indexOf(result.levelId);
    const nextId = index >= 0 && index + 1 < order.length ? order[index + 1] : null;
    const items: MenuItemSpec[] = [
      { label: () => 'Retry', onSelect: () => this.startLevel(result.levelId, result.players) },
    ];
    if (nextId) {
      const nextName = levels[nextId]?.name ?? nextId;
      items.push({ label: () => `Next level (${nextName})`, onSelect: () => this.startLevel(nextId, result.players) });
    }
    items.push({ label: () => 'Back to title', onSelect: () => this.goToTitle() });
    this.menu = new MenuList(this, GAME_WIDTH / 2, RESULTS.menuY, items, { spacing: RESULTS.menuSpacing });

    this.add
      .text(
        GAME_WIDTH / 2,
        RESULTS.hintY,
        `${this.inputMgr.labelFor(0, 'pickup')} select · M mute`,
        textStyle(RESULTS.hintFontPx, TEXT_COLOR.dim),
      )
      .setOrigin(0.5);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.cleanup, this);
    this.ready = true;
  }

  override update(): void {
    if (!this.ready) return;
    const nav = mergeNav(this.menuInput.poll(this.inputMgr.poll()), this.keyboardNav.poll());
    this.menu.handle(nav);
  }

  // ─── Panels ───────────────────────────────────────────────────────────────
  private drawStars(result: ResultsSceneData): void {
    const totalWidth = (RESULTS.starCount - 1) * RESULTS.starGap;
    for (let i = 0; i < RESULTS.starCount; i++) {
      const x = GAME_WIDTH / 2 - totalWidth / 2 + i * RESULTS.starGap;
      const earned = i < result.stars;
      this.add
        .image(x, RESULTS.starsY, earned ? TEX.iconStar : TEX.iconStarEmpty)
        .setOrigin(0.5)
        .setScale(RESULTS.starScale);
      this.add
        .text(
          x,
          RESULTS.starsY + RESULTS.thresholdOffsetY,
          String(result.thresholds[i] ?? 0),
          textStyle(RESULTS.thresholdFontPx, earned ? TEXT_COLOR.good : TEXT_COLOR.dim),
        )
        .setOrigin(0.5);
    }
  }

  private drawScore(result: ResultsSceneData): void {
    const scoreText = String(result.score);
    const text = this.add
      .text(GAME_WIDTH / 2, RESULTS.scoreY, scoreText, textStyle(RESULTS.scoreFontPx))
      .setOrigin(0.5);
    this.add.image(text.x - text.displayWidth / 2 - RESULTS.scoreIconGap, RESULTS.scoreY, TEX.iconCoin).setOrigin(0.5);
    this.add
      .text(
        GAME_WIDTH / 2,
        RESULTS.countsY,
        `Served ${result.servedCount}   ·   Missed ${result.failedCount}`,
        textStyle(RESULTS.countsFontPx, TEXT_COLOR.dim),
      )
      .setOrigin(0.5);
  }

  // ─── Navigation ───────────────────────────────────────────────────────────
  private startLevel(levelId: string, players: number): void {
    this.ready = false;
    this.scene.start(SCENE.GAME, { levelId, players } satisfies GameSceneData);
  }

  private goToTitle(): void {
    this.ready = false;
    this.scene.start(SCENE.TITLE);
  }

  private cleanup(): void {
    this.ready = false;
    for (const dispose of this.disposers) dispose();
    this.disposers.length = 0;
    this.menu?.destroy();
    this.keyboardNav?.destroy();
    this.inputMgr?.destroy();
  }
}
