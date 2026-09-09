// ─── Results scene ──────────────────────────────────────────────────────────
// Score against the level's star thresholds, the run's seed and difficulty, and what
// to do next. This is where a finished run is written into the saved progress.
import Phaser from 'phaser';
import { TEX } from '../../art/keys';
import { GAME_HEIGHT, GAME_WIDTH, MAX_PLAYERS, SCENE } from '../../config';
import { createInputManager, menuLabels } from '../../input';
import type { InputManager } from '../../input/types';
import { log } from '../../log';
import { getAudioBus, installAudioGestureResume, installMuteToggle } from '../audioBus';
import { currentLevels } from '../levelHotReload';
import { isUnlocked, levelCountsTowardUnlock, levelProgress, loadProgress, recordRun, saveProgress } from '../progress';
import { countsTowardUnlock, isAssisted, loadSettings, presetName } from '../settings';
import { MenuList, type MenuItemSpec } from '../ui/MenuList';
import { KeyboardNav, MenuInput, mergeNav } from '../ui/menuInput';
import { installBackdrop, roundedPanel } from '../ui/panel';
import { COLOR, displayStyle, TEXT_COLOR, textStyle } from '../ui/theme';
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
  newBestY: 472,
  newBestFontPx: 22,
  noteY: 502,
  noteFontPx: 14,
  menuY: 536,
  menuSpacing: 44,
  hintY: GAME_HEIGHT - 56,
  hintFontPx: 15,
  starCount: 3,
  // The reveal: stars pop in one after another, the score counts up, the stamp lands last.
  starPopDelayMs: 220,
  starPopGapMs: 260,
  starPopMs: 420,
  starPopFrom: 0.2,
  starOvershoot: 1.25,
  countMs: 900,
  countDelayMs: 300,
  stampWidth: 168,
  stampHeight: 40,
  stampAngle: -6,
  stampFontPx: 22,
  stampPopFrom: 1.8,
  stampPopMs: 320,
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
    const settings = loadSettings();
    const preset = result.preset ?? settings.preset;
    const assisted = isAssisted(result.modifiers);
    log.info('results', result.levelId, 'score', result.score, 'stars', result.stars, 'seed', result.seed, preset, assisted ? 'assisted' : '');

    // Save first: the unlock check for "Next level" reads the progress this run just made.
    // A run with an assist on is shown but never saved.
    const saving = result.levelId !== '' && !assisted;
    const before = loadProgress();
    const recorded = saving
      ? recordRun(before, { levelId: result.levelId, score: result.score, stars: result.stars, preset })
      : { progress: before, newBest: false, newStars: false };
    if (saving) saveProgress(recorded.progress);
    const best = levelProgress(recorded.progress, result.levelId).bestScore;

    this.cameras.main.setBackgroundColor(COLOR.bg);
    installBackdrop(this);
    this.add
      .text(GAME_WIDTH / 2, RESULTS.headingY, `${levelName} complete`, displayStyle(RESULTS.headingFontPx, TEXT_COLOR.accent))
      .setOrigin(0.5);
    this.add
      .text(
        GAME_WIDTH / 2,
        RESULTS.subheadingY,
        `${result.players} player${result.players === 1 ? '' : 's'} · ${presetName(preset)}` +
          `${result.seed === undefined ? '' : ` · seed ${result.seed}`}${assisted ? ' · assists on' : ''}`,
        textStyle(RESULTS.subheadingFontPx, TEXT_COLOR.dim),
      )
      .setOrigin(0.5);

    this.drawStars(result);
    this.drawScore(result, best);
    if (recorded.newBest) this.drawStamp('New best!');
    if (assisted) {
      this.add
        .text(
          GAME_WIDTH / 2,
          RESULTS.noteY,
          'Assists were on: this run is not saved and earns no stars',
          textStyle(RESULTS.noteFontPx, TEXT_COLOR.dim),
        )
        .setOrigin(0.5);
    } else if (!levelCountsTowardUnlock(result.levelId)) {
      this.add
        .text(
          GAME_WIDTH / 2,
          RESULTS.noteY,
          'Tutorial stars are saved but never count toward unlocks',
          textStyle(RESULTS.noteFontPx, TEXT_COLOR.dim),
        )
        .setOrigin(0.5);
    } else if (!countsTowardUnlock(preset)) {
      this.add
        .text(
          GAME_WIDTH / 2,
          RESULTS.noteY,
          `Stars earned on ${presetName(preset)} do not count toward unlocks`,
          textStyle(RESULTS.noteFontPx, TEXT_COLOR.dim),
        )
        .setOrigin(0.5);
    }

    this.inputMgr = createInputManager(this, MAX_PLAYERS);
    this.menuInput = new MenuInput();
    this.keyboardNav = new KeyboardNav(this);
    this.disposers.push(installAudioGestureResume(this), installMuteToggle(this));
    getAudioBus().stopMusic();

    // "Next" walks the tutorials among themselves and every other kitchen among the rest.
    const tutorial = levels[result.levelId]?.game === 'tutorial';
    const pool = order.filter((id) => (levels[id]?.game === 'tutorial') === tutorial);
    const index = pool.indexOf(result.levelId);
    const nextId = index >= 0 && index + 1 < pool.length ? pool[index + 1] : null;
    const nextWord = tutorial ? 'Next tutorial' : 'Next level';
    const items: MenuItemSpec[] = [
      { label: () => 'Retry (same seed)', onSelect: () => this.retry(result) },
    ];
    if (nextId) {
      const nextLevel = levels[nextId];
      const nextName = nextLevel?.name ?? nextId;
      // A locked next level stays on the menu as a dim label with nothing to select.
      if (nextLevel && !isUnlocked(nextLevel, recorded.progress, settings)) {
        items.push({ label: () => `${nextWord} (${nextName}) · needs ${nextLevel.unlockStars ?? 0} stars` });
      } else {
        items.push({ label: () => `${nextWord} (${nextName})`, onSelect: () => this.startNext(nextId, result.players) });
      }
    }
    if (tutorial) items.push({ label: () => 'Back to tutorials', onSelect: () => this.goToPage(SCENE.TUTORIALS) });
    items.push({ label: () => 'Back to title', onSelect: () => this.goToPage(SCENE.TITLE) });
    this.menu = new MenuList(this, GAME_WIDTH / 2, RESULTS.menuY, items, { spacing: RESULTS.menuSpacing });

    const labels = menuLabels((action) => this.inputMgr.labelFor(0, action));
    this.add
      .text(
        GAME_WIDTH / 2,
        RESULTS.hintY,
        `${labels.choose} choose · ${labels.select} select · M mute`,
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
  /** The three stars pop in one after another; an earned one overshoots, an empty one just settles. */
  private drawStars(result: ResultsSceneData): void {
    const totalWidth = (RESULTS.starCount - 1) * RESULTS.starGap;
    for (let i = 0; i < RESULTS.starCount; i++) {
      const x = GAME_WIDTH / 2 - totalWidth / 2 + i * RESULTS.starGap;
      const earned = i < result.stars;
      const star = this.add
        .image(x, RESULTS.starsY, earned ? TEX.iconStar : TEX.iconStarEmpty)
        .setOrigin(0.5)
        .setScale(RESULTS.starScale * RESULTS.starPopFrom)
        .setAlpha(0);
      this.tweens.add({
        targets: star,
        scale: RESULTS.starScale,
        alpha: 1,
        duration: RESULTS.starPopMs,
        delay: RESULTS.starPopDelayMs + i * RESULTS.starPopGapMs,
        ease: earned ? 'Back.easeOut' : 'Cubic.easeOut',
        easeParams: earned ? [RESULTS.starOvershoot * 2] : undefined,
      });
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

  /** The score counts up from nothing; the coin keeps its place left of the growing number. */
  private drawScore(result: ResultsSceneData, best: number): void {
    const text = this.add
      .text(GAME_WIDTH / 2, RESULTS.scoreY, '0', displayStyle(RESULTS.scoreFontPx))
      .setOrigin(0.5);
    const coin = this.add.image(text.x - text.displayWidth / 2 - RESULTS.scoreIconGap, RESULTS.scoreY, TEX.iconCoin).setOrigin(0.5);
    const counter = { value: 0 };
    this.tweens.add({
      targets: counter,
      value: result.score,
      duration: RESULTS.countMs,
      delay: RESULTS.countDelayMs,
      ease: 'Cubic.easeOut',
      onUpdate: () => {
        text.setText(String(Math.round(counter.value)));
        coin.setX(text.x - text.displayWidth / 2 - RESULTS.scoreIconGap);
      },
    });
    this.add
      .text(
        GAME_WIDTH / 2,
        RESULTS.countsY,
        `Served ${result.servedCount}   ·   Missed ${result.failedCount}   ·   Best ${best}`,
        textStyle(RESULTS.countsFontPx, TEXT_COLOR.dim),
      )
      .setOrigin(0.5);
  }

  /** A tilted mustard stamp that slams down after the stars. */
  private drawStamp(caption: string): void {
    const stamp = this.add.container(GAME_WIDTH / 2, RESULTS.newBestY).setAngle(RESULTS.stampAngle);
    const pill = roundedPanel(this, RESULTS.stampWidth, RESULTS.stampHeight, { fill: COLOR.accent, radius: RESULTS.stampHeight / 2 });
    const text = this.add.text(0, 0, caption, displayStyle(RESULTS.stampFontPx, TEXT_COLOR.ink)).setOrigin(0.5);
    stamp.add([pill, text]);
    stamp.setScale(RESULTS.stampPopFrom).setAlpha(0);
    this.tweens.add({
      targets: stamp,
      scale: 1,
      alpha: 1,
      duration: RESULTS.stampPopMs,
      delay: RESULTS.starPopDelayMs + RESULTS.starCount * RESULTS.starPopGapMs,
      ease: 'Back.easeOut',
    });
  }

  // ─── Navigation ───────────────────────────────────────────────────────────
  /** The same kitchen again: the seed and modifiers of the run that just ended. */
  private retry(result: ResultsSceneData): void {
    this.ready = false;
    this.scene.start(SCENE.GAME, {
      levelId: result.levelId,
      players: result.players,
      seed: result.seed,
      modifiers: result.modifiers,
      preset: result.preset,
    } satisfies GameSceneData);
  }

  /** The next level rolls a fresh seed from the settings, like starting from the title. */
  private startNext(levelId: string, players: number): void {
    this.ready = false;
    this.scene.start(SCENE.GAME, { levelId, players } satisfies GameSceneData);
  }

  private goToPage(key: string): void {
    this.ready = false;
    this.scene.start(key);
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
