// ─── Game scene ─────────────────────────────────────────────────────────────
// Orchestration only: fixed-timestep sim stepping, input polling, audio, and one
// render pass per frame from a single getState() snapshot. Drawing lives in
// KitchenRenderer, the HUD in Hud, and the pause overlay in PauseMenu.
import Phaser from 'phaser';
import { sfxForEvent } from '../../audio';
import type { AudioBus } from '../../audio/types';
import { GAME_HEIGHT, GAME_WIDTH, MAX_PLAYERS, SCENE } from '../../config';
import {
  clearEdgeLatch, createEdgeLatch, createInputManager, createPlayerInput, latchEdges,
  writeStepInput, type EdgeLatch,
} from '../../input';
import type { InputManager } from '../../input/types';
import type { LevelDef } from '../../levels/schema';
import { log } from '../../log';
import { Sim, SIM_DT } from '../../sim';
import type { Modifiers, PlayerInput, SimEvent, SimState } from '../../sim/types';
import { getAudioBus, installAudioGestureResume, installMuteToggle } from '../audioBus';
import { buildFakeState } from '../debug/fakeState';
import { currentLevels, defaultLevelId, onLevelsHotReload, type LevelsSnapshot } from '../levelHotReload';
import { KitchenRenderer, type TilePos } from '../render/KitchenRenderer';
import { DebugOverlay } from '../ui/DebugOverlay';
import { Hud } from '../ui/Hud';
import { KeyboardNav, MenuInput, mergeNav } from '../ui/menuInput';
import { PauseMenu } from '../ui/PauseMenu';
import { DEFAULT_PRESET, isAssisted, loadSettings, presetModifiers, presetName, seedFor, type PresetId } from '../settings';
import { createEventRing, isPlayNotesOpen, setPlayNotesContext } from '../playnotes';
import { COLOR, TEXT_COLOR, textStyle } from '../ui/theme';
import type { GameSceneData, ResultsSceneData } from '../types';

export type { GameSceneData } from '../types';

// ─── Constants ──────────────────────────────────────────────────────────────
const LOOP = {
  maxFrameSec: 0.25,      // a long stall never turns into a burst of catch-up steps
  maxStepsPerFrame: 30,
} as const;

const END_FLASH = {
  holdMs: 1500,
  dimAlpha: 0.55,
  titleFontPx: 62,
  subtitleFontPx: 22,
  subtitleOffsetY: 58,
  popFrom: 0.6,
  popMs: 420,
  depth: 2500,
} as const;

const KEYS = {
  debug: 'keydown-F3',
  debugAlt: 'keydown-BACKTICK',
  escape: 'keydown-ESC',
  fakeState: 'F4',
} as const;

interface StepResult { steps: number; ms: number; }

// ─── Scene ──────────────────────────────────────────────────────────────────
export class GameScene extends Phaser.Scene {
  private sim!: Sim;
  private level!: LevelDef;
  private kitchen!: KitchenRenderer;
  private hud!: Hud;
  private debugOverlay!: DebugOverlay;
  private pauseMenu!: PauseMenu;
  private inputMgr!: InputManager;
  private menuInput!: MenuInput;
  private keyboardNav!: KeyboardNav;
  private audio!: AudioBus;
  private fakeKey: Phaser.Input.Keyboard.Key | null = null;
  private endFlash: Phaser.GameObjects.Container | null = null;
  private endTimer: Phaser.Time.TimerEvent | null = null;
  private fakeState: SimState | null = null;
  private readonly disposers: (() => void)[] = [];
  // Rising edges wait here until a fixed step takes them; the step inputs are reused so
  // the loop allocates nothing per frame.
  private readonly latches: EdgeLatch[] = [];
  private readonly stepInputs: PlayerInput[] = [];

  private levelId = '';
  private players = MAX_PLAYERS;
  private seed = 0;
  private modifiers: Modifiers = {};
  private preset: PresetId = DEFAULT_PRESET;
  private chefSkins: readonly number[] = [];
  private readonly recentEvents = createEventRing();
  private accumulator = 0;
  private ending = false;
  private escQueued = false;
  private ready = false;

  constructor() { super(SCENE.GAME); }

  // ─── Lifecycle ────────────────────────────────────────────────────────────
  create(data: GameSceneData): void {
    const snapshot = currentLevels();
    const settings = loadSettings();
    this.levelId = data.levelId ?? defaultLevelId();
    this.players = Phaser.Math.Clamp(data.players ?? settings.players, 1, MAX_PLAYERS);
    // A retry hands the run's seed and modifiers back so it replays exactly.
    this.seed = data.seed ?? seedFor(settings);
    this.modifiers = data.modifiers ?? presetModifiers(settings);
    this.preset = data.preset ?? settings.preset;
    this.chefSkins = settings.chefs;
    const level = snapshot.levels[this.levelId];
    if (!level) {
      log.error('unknown level', this.levelId, '- returning to the title');
      this.scene.start(SCENE.TITLE);
      return;
    }

    // Transparent: the 3D kitchen draws on the canvas behind this one; the page carries COLOR.bg.
    this.cameras.main.setBackgroundColor('rgba(0,0,0,0)');
    this.buildLevel(level);

    this.inputMgr = createInputManager(this, this.players);
    this.menuInput = new MenuInput();
    this.keyboardNav = new KeyboardNav(this);

    this.audio = getAudioBus();
    this.disposers.push(installAudioGestureResume(this), installMuteToggle(this));
    this.audio.startMusic();

    this.pauseMenu = new PauseMenu(this, {
      onResume: () => this.pauseMenu.close(),
      onRestart: () => this.restartLevel(),
      onQuit: () => this.quitToTitle(),
    });
    this.debugOverlay = new DebugOverlay(this, this.kitchen);
    this.installKeys();
    this.disposers.push(onLevelsHotReload((next) => this.onLevelsChanged(next)));
    this.disposers.push(setPlayNotesContext(() => this.playNotesContext()));
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.cleanup, this);
    this.ready = true;
    log.info('level started', this.levelId, `${this.players}P`, 'seed', this.seed, this.preset);
  }

  /** What an F8 play note records about this run. */
  private playNotesContext(): Record<string, unknown> {
    const st = this.sim.getState();
    return {
      levelId: this.levelId,
      seed: this.seed,
      preset: this.preset,
      assisted: isAssisted(this.modifiers),
      players: this.players,
      phase: st.phase,
      elapsed: Number(st.elapsed.toFixed(1)),
      timeLeft: Number(st.timeLeft.toFixed(1)),
      score: st.score,
      orders: st.orders.map((o) => o.recipeId),
      chefs: st.chefs.map((c) => ({ x: Number(c.x.toFixed(2)), y: Number(c.y.toFixed(2)), holding: c.holding?.kind ?? null })),
      recentEvents: this.recentEvents.list(),
      paused: this.pauseMenu.isOpen,
    };
  }

  override update(_time: number, deltaMs: number): void {
    if (!this.ready) return;
    const inputs = this.inputMgr.poll();
    if (isPlayNotesOpen()) { // the reporter has the keyboard: hold the kitchen still
      this.render(this.sim.getState(), [], { steps: 0, ms: 0 }, deltaMs);
      return;
    }
    const nav = mergeNav(this.menuInput.poll(inputs), this.keyboardNav.poll());
    this.handlePauseEdge(inputs);

    const events: SimEvent[] = [];
    let stepped: StepResult = { steps: 0, ms: 0 };
    if (this.pauseMenu.isOpen) {
      this.pauseMenu.update(nav);
      if (!this.ready) return; // a menu choice may have started another scene
    } else if (!this.ending) {
      stepped = this.runSim(inputs, deltaMs, events);
      for (const event of events) {
        this.recentEvents.push(event.type);
        const sfx = sfxForEvent(event);
        if (sfx) this.audio.play(sfx);
      }
    }

    const live = this.sim.getState();
    this.checkLevelEnd(live);
    this.render(live, events, stepped, deltaMs);
  }

  // ─── Level construction ───────────────────────────────────────────────────
  private buildLevel(level: LevelDef): void {
    this.level = level;
    this.sim = new Sim(level, { players: this.players, seed: this.seed, modifiers: this.modifiers });
    // Dev-only hook for the headless playtest harness (tools/playtest.mjs): read sim state via window.__oc.
    if (import.meta.env.DEV) (globalThis as unknown as { __oc?: unknown }).__oc = { sim: this.sim, level, scene: this };
    this.kitchen = new KitchenRenderer(this, this.sim.getState(), level.theme, this.chefSkins);
    const meta = `seed ${this.seed} · ${presetName(this.preset)}${isAssisted(this.modifiers) ? ' · assists on' : ''}`;
    this.hud = new Hud(this, level.name, meta);
    this.accumulator = 0;
    this.ending = false;
    this.fakeState = null;
    for (const latch of this.latches) clearEdgeLatch(latch); // no press carries into a rebuild
  }

  private installKeys(): void {
    const keyboard = this.input.keyboard;
    if (!keyboard) return;
    const onDebug = (): void => this.debugOverlay.toggle();
    const onEscape = (): void => { this.escQueued = true; };
    keyboard.on(KEYS.debug, onDebug);
    keyboard.on(KEYS.debugAlt, onDebug);
    keyboard.on(KEYS.escape, onEscape);
    this.fakeKey = keyboard.addKey(KEYS.fakeState, true, false);
    this.disposers.push(() => {
      keyboard.off(KEYS.debug, onDebug);
      keyboard.off(KEYS.debugAlt, onDebug);
      keyboard.off(KEYS.escape, onEscape);
    });
  }

  // ─── Fixed timestep ───────────────────────────────────────────────────────
  /** Runs whole sim steps for this frame and reports how many, and how long they took. */
  private runSim(inputs: readonly PlayerInput[], deltaMs: number, events: SimEvent[]): StepResult {
    this.accumulator += Math.min(deltaMs / 1000, LOOP.maxFrameSec);
    // A frame shorter than one step runs no step at all, so this frame's edges are latched
    // and wait rather than being polled and thrown away.
    for (let i = 0; i < inputs.length; i++) latchEdges(this.latchFor(i), inputs[i]);
    const started = performance.now();
    let steps = 0;
    while (this.accumulator >= SIM_DT && steps < LOOP.maxStepsPerFrame) {
      const stepEvents = this.sim.step(this.buildStepInputs(inputs, steps === 0), SIM_DT);
      if (stepEvents.length > 0) events.push(...stepEvents);
      // Rising edges fire on the first sub-step only, never once per sub-step.
      if (steps === 0) for (const latch of this.latches) clearEdgeLatch(latch);
      this.accumulator -= SIM_DT;
      steps += 1;
    }
    if (steps >= LOOP.maxStepsPerFrame) this.accumulator = 0;
    return { steps, ms: performance.now() - started };
  }

  private latchFor(player: number): EdgeLatch {
    const latch = this.latches[player] ?? createEdgeLatch();
    this.latches[player] = latch;
    return latch;
  }

  private buildStepInputs(inputs: readonly PlayerInput[], consumeEdges: boolean): readonly PlayerInput[] {
    for (let i = 0; i < inputs.length; i++) {
      const out = this.stepInputs[i] ?? createPlayerInput();
      this.stepInputs[i] = out;
      writeStepInput(inputs[i], this.latchFor(i), consumeEdges, out);
    }
    this.stepInputs.length = inputs.length;
    return this.stepInputs;
  }

  // ─── Rendering ────────────────────────────────────────────────────────────
  private render(live: Readonly<SimState>, events: readonly SimEvent[], stepped: StepResult, deltaMs: number): void {
    const fake = this.fakeKey?.isDown === true;
    const state = fake ? this.fakeStateFor(live) : live;
    const targets: (TilePos | null)[] = state.chefs.map((_, i) =>
      i < live.chefs.length ? this.sim.getTargetTile(i) : null,
    );
    this.kitchen.draw(state, targets, deltaMs / 1000);
    this.hud.update(state, events, deltaMs);
    this.debugOverlay.update(state, {
      levelId: this.levelId,
      seed: this.seed,
      steps: stepped.steps,
      stepMs: stepped.ms,
      events,
      targets,
      fake,
      paused: this.pauseMenu.isOpen,
    });
  }

  private fakeStateFor(live: Readonly<SimState>): SimState {
    if (!this.fakeState) {
      this.fakeState = buildFakeState(live);
      log.info('showing fake state for renderer smoke test');
    }
    return this.fakeState;
  }

  // ─── Pause ────────────────────────────────────────────────────────────────
  private handlePauseEdge(inputs: readonly PlayerInput[]): void {
    const pressed = this.escQueued || inputs.some((input) => input.pausePressed === true);
    this.escQueued = false;
    if (!pressed || this.ending) return;
    this.pauseMenu.toggle();
  }

  private restartLevel(): void {
    this.ready = false;
    this.scene.start(SCENE.GAME, {
      levelId: this.levelId,
      players: this.players,
      seed: this.seed,
      modifiers: this.modifiers,
      preset: this.preset,
    } satisfies GameSceneData);
  }

  private quitToTitle(): void {
    this.ready = false;
    this.scene.start(SCENE.TITLE);
  }

  // ─── Level end ────────────────────────────────────────────────────────────
  private checkLevelEnd(state: Readonly<SimState>): void {
    if (this.ending || state.phase !== 'ended') return;
    this.ending = true;
    this.pauseMenu.close();
    this.audio.stopMusic();
    this.showEndFlash();
    this.endTimer = this.time.delayedCall(END_FLASH.holdMs, () => this.goToResults());
  }

  private showEndFlash(): void {
    const cx = GAME_WIDTH / 2;
    const cy = GAME_HEIGHT / 2;
    const dim = this.add.rectangle(cx, cy, GAME_WIDTH, GAME_HEIGHT, COLOR.bg, END_FLASH.dimAlpha).setOrigin(0.5);
    const title = this.add.text(cx, cy, "Time's up!", textStyle(END_FLASH.titleFontPx, TEXT_COLOR.accent)).setOrigin(0.5);
    const subtitle = this.add
      .text(cx, cy + END_FLASH.subtitleOffsetY, 'Counting up your tips…', textStyle(END_FLASH.subtitleFontPx, TEXT_COLOR.dim))
      .setOrigin(0.5);
    this.endFlash = this.add.container(0, 0, [dim, title, subtitle]).setDepth(END_FLASH.depth);
    this.tweens.add({
      targets: title,
      scale: { from: END_FLASH.popFrom, to: 1 },
      duration: END_FLASH.popMs,
      ease: 'Back.easeOut',
    });
  }

  private goToResults(): void {
    const state = this.sim.getState();
    const thresholds = this.players === 1 ? this.level.stars[1] : this.level.stars[2];
    this.ready = false;
    this.scene.start(SCENE.RESULTS, {
      levelId: this.levelId,
      players: this.players,
      score: state.score,
      stars: state.stars,
      servedCount: state.servedCount,
      failedCount: state.failedCount,
      thresholds,
      seed: this.seed,
      modifiers: this.modifiers,
      preset: this.preset,
    } satisfies ResultsSceneData);
  }

  // ─── Hot reload ───────────────────────────────────────────────────────────
  private onLevelsChanged(snapshot: LevelsSnapshot): void {
    const level = snapshot.levels[this.levelId];
    if (!level) {
      log.warn('hot reload: level', this.levelId, 'no longer exists');
      return;
    }
    log.info('hot reload: rebuilding', this.levelId);
    this.endTimer?.remove();
    this.endTimer = null;
    this.endFlash?.destroy(true);
    this.endFlash = null;
    this.pauseMenu.close();
    this.kitchen.destroy();
    this.hud.destroy();
    this.buildLevel(level);
    this.debugOverlay.setRenderer(this.kitchen);
  }

  // ─── Teardown ─────────────────────────────────────────────────────────────
  private cleanup(): void {
    this.ready = false;
    for (const dispose of this.disposers) dispose();
    this.disposers.length = 0;
    this.endTimer?.remove();
    this.endTimer = null;
    this.endFlash?.destroy(true);
    this.endFlash = null;
    this.audio?.stopMusic();
    this.inputMgr?.destroy();
    this.keyboardNav?.destroy();
    this.debugOverlay?.destroy();
    this.pauseMenu?.destroy();
    this.hud?.destroy();
    this.kitchen?.destroy();
    this.fakeState = null;
  }
}
