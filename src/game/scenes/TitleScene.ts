// ─── Title scene ────────────────────────────────────────────────────────────
// Level list, player count toggle and the controller screen. Navigable with the
// keyboard and with any device the input manager reports through PlayerInput.
import Phaser from 'phaser';
import { TEX } from '../../art/keys';
import { GAME_HEIGHT, GAME_WIDTH, MAX_PLAYERS, SCENE } from '../../config';
import { createInputManager } from '../../input';
import type { GameAction, InputManager } from '../../input/types';
import { log } from '../../log';
import { getAudioBus, installAudioGestureResume, installMuteToggle } from '../audioBus';
import { currentLevels, onLevelsHotReload } from '../levelHotReload';
import { MenuList, type MenuItemSpec } from '../ui/MenuList';
import { KeyboardNav, MenuInput, mergeNav } from '../ui/menuInput';
import { COLOR, TEXT_COLOR, textStyle } from '../ui/theme';
import type { GameSceneData } from '../types';

// ─── Constants ──────────────────────────────────────────────────────────────
const TITLE = {
  headingY: 132,
  headingFontPx: 62,
  taglineY: 186,
  taglineFontPx: 18,
  menuY: 300,
  menuSpacing: 44,
  menuWidth: 460,
  hintY: GAME_HEIGHT - 96,
  hintFontPx: 16,
  hintSpacing: 26,
  promptY: GAME_HEIGHT - 56,
  promptGap: 210,
  promptLabelGap: 22,
  promptFontPx: 14,
} as const;

const HEADING = 'LOCAL OVERCOOKED';
const TAGLINE = 'Two chefs, one kitchen, not enough time';

// Remembered between visits to the title within a session.
let selectedPlayers: number = MAX_PLAYERS;
let selectedIndex = 0;

export class TitleScene extends Phaser.Scene {
  private inputMgr!: InputManager;
  private menuInput!: MenuInput;
  private keyboardNav!: KeyboardNav;
  private menu: MenuList | null = null;
  private hintText!: Phaser.GameObjects.Text;
  private readonly prompts: Phaser.GameObjects.GameObject[] = [];
  private readonly disposers: (() => void)[] = [];
  private ready = false;

  constructor() { super(SCENE.TITLE); }

  create(): void {
    this.cameras.main.setBackgroundColor(COLOR.bg);
    this.add.text(GAME_WIDTH / 2, TITLE.headingY, HEADING, textStyle(TITLE.headingFontPx, TEXT_COLOR.accent)).setOrigin(0.5);
    this.add.text(GAME_WIDTH / 2, TITLE.taglineY, TAGLINE, textStyle(TITLE.taglineFontPx, TEXT_COLOR.dim)).setOrigin(0.5);
    this.hintText = this.add
      .text(GAME_WIDTH / 2, TITLE.hintY, '', textStyle(TITLE.hintFontPx, TEXT_COLOR.dim, { align: 'center' }))
      .setOrigin(0.5);

    this.inputMgr = createInputManager(this, MAX_PLAYERS);
    this.menuInput = new MenuInput();
    this.keyboardNav = new KeyboardNav(this);
    this.disposers.push(installAudioGestureResume(this), installMuteToggle(this));
    getAudioBus().stopMusic();

    this.buildMenu();
    this.buildPrompts();
    this.disposers.push(onLevelsHotReload(() => this.buildMenu()));
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.cleanup, this);
    this.ready = true;
  }

  override update(): void {
    if (!this.ready || !this.menu) return;
    const nav = mergeNav(this.menuInput.poll(this.inputMgr.poll()), this.keyboardNav.poll());
    this.menu.handle(nav);
    if (!this.ready) return;
    selectedIndex = this.menu.selectedIndex;
  }

  // ─── Menu ─────────────────────────────────────────────────────────────────
  private buildMenu(): void {
    const previous = this.menu?.selectedIndex ?? selectedIndex;
    this.menu?.destroy();
    const { levels, order } = currentLevels();
    const items: MenuItemSpec[] = order.map((levelId) => ({
      label: () => `${levels[levelId]?.name ?? levelId}   ${levels[levelId]?.theme ?? ''}`.trimEnd(),
      onSelect: () => this.startLevel(levelId),
    }));
    if (items.length === 0) log.warn('no levels found for the title menu');
    items.push({
      label: () => `Players: ${selectedPlayers}`,
      onSelect: () => this.togglePlayers(),
      onLeft: () => this.togglePlayers(),
      onRight: () => this.togglePlayers(),
    });
    items.push({ label: () => 'Controllers', onSelect: () => this.openControllers() });

    this.menu = new MenuList(this, GAME_WIDTH / 2, TITLE.menuY, items, {
      spacing: TITLE.menuSpacing,
      width: TITLE.menuWidth,
    });
    this.menu.setIndex(Phaser.Math.Clamp(previous, 0, items.length - 1));
    this.refreshHint();
  }

  private togglePlayers(): void {
    selectedPlayers = selectedPlayers >= MAX_PLAYERS ? 1 : selectedPlayers + 1;
  }

  private startLevel(levelId: string): void {
    this.ready = false;
    this.scene.start(SCENE.GAME, { levelId, players: selectedPlayers } satisfies GameSceneData);
  }

  private openControllers(): void {
    this.ready = false;
    this.scene.start(SCENE.CONTROLLER);
  }

  // ─── Prompts ──────────────────────────────────────────────────────────────
  private refreshHint(): void {
    this.hintText.setText(
      `${this.labelFor('up')} / ${this.labelFor('down')} choose · ` +
        `${this.labelFor('pickup')} select · ${this.labelFor('pause')} back · M mute`,
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
    this.menu?.destroy();
    this.menu = null;
    this.keyboardNav?.destroy();
    this.inputMgr?.destroy();
  }
}
