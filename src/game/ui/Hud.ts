// ─── Heads-up display ───────────────────────────────────────────────────────
// Order cards across the top, score bottom-left, timer bottom-right, level name
// top-right. Screen space: it is not affected by the kitchen container's scale.
//
// Cards are diffed against SimState.orders every frame: ids that appear slide in, ids
// that vanish either flash red and drop (expired) or pop and fade (served).
import Phaser from 'phaser';
import { TEX } from '../../art/keys';
import { GAME_HEIGHT, GAME_WIDTH } from '../../config';
import { TIMER_WARNING_AT } from '../../sim/constants';
import { RECIPES } from '../../sim/recipes';
import type { IngredientType, Order, SimEvent, SimState } from '../../sim/types';
import { COLOR, TEXT_COLOR, textStyle } from './theme';

// ─── Constants ──────────────────────────────────────────────────────────────
const CARD = {
  x: 26,
  y: 14,
  gap: 8,
  width: 96,
  height: 120,
  iconY: 40,
  iconScale: 1.1,
  nameY: 78,
  nameFontPx: 13,
  nameWrapPx: 88,
  barY: 100,
  barWidth: 74,
  barHeight: 9,
  dangerFraction: 0.25,   // time bar turns red below this share of the order's time
  slideInPx: 48,
  slideInMs: 240,
  moveMs: 180,
  expireFlashMs: 110,
  expireFlashes: 5,
  expireDropPx: 170,
  expireDropMs: 420,
  servedRisePx: 44,
  servedRiseMs: 320,
  expireGraceSec: 0.75,   // a card gone with less time than this counts as expired
} as const;

const SCORE = {
  x: 26,
  y: GAME_HEIGHT - 42,
  iconGap: 12,          // gap between the coin and the number, whatever the art's icon size
  fontPx: 30,
  streakFontPx: 16,
  streakGap: 26,
  popupRisePx: 48,
  popupMs: 900,
  popupFontPx: 26,
} as const;

const TIMER = {
  x: GAME_WIDTH - 26,
  y: GAME_HEIGHT - 42,
  iconGap: 12,
  fontPx: 30,
  blinkMs: 380,
} as const;

const LEVEL_LABEL = { x: GAME_WIDTH - 26, y: 16, fontPx: 16 } as const;

const PREP_HINT = {
  y: GAME_HEIGHT - 96,
  fontPx: 20,
  pulseMs: 900,
  pulseMinAlpha: 0.45,
} as const;

const HUD_DEPTH = 1000;

// ─── Pure helpers ───────────────────────────────────────────────────────────
export function formatClock(seconds: number): string {
  const safe = Math.max(0, Math.ceil(seconds));
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function recipeName(recipeId: string): string {
  return RECIPES[recipeId]?.name ?? recipeId;
}

/** Soups are drawn with the icon of their first ingredient. */
function recipeIconKey(recipeId: string): string {
  const ingredients = RECIPES[recipeId]?.ingredients;
  const first: IngredientType | undefined = ingredients?.[0];
  return first ? TEX.iconSoup(first) : TEX.iconPlate;
}

interface OrderCard {
  id: number;
  root: Phaser.GameObjects.Container;
  icon: Phaser.GameObjects.Image;
  barFill: Phaser.GameObjects.Rectangle;
  slot: number;
  leaving: boolean;
  lastTimeLeft: number;
}

// ─── HUD ────────────────────────────────────────────────────────────────────
export class Hud {
  private readonly root: Phaser.GameObjects.Container;
  private readonly cards = new Map<number, OrderCard>();
  private readonly tweens = new Set<Phaser.Tweens.Tween>();
  private readonly scoreText: Phaser.GameObjects.Text;
  private readonly streakText: Phaser.GameObjects.Text;
  private readonly timerText: Phaser.GameObjects.Text;
  private readonly timerIcon: Phaser.GameObjects.Image;
  private readonly prepText: Phaser.GameObjects.Text;
  private readonly expiredIds = new Set<number>();
  private blinkMs = 0;
  private pulseMs = 0;

  constructor(private readonly scene: Phaser.Scene, levelName: string) {
    this.root = scene.add.container(0, 0).setDepth(HUD_DEPTH);

    const coin = scene.add.image(SCORE.x, SCORE.y, TEX.iconCoin).setOrigin(0, 0.5);
    this.scoreText = scene.add
      .text(SCORE.x + coin.displayWidth + SCORE.iconGap, SCORE.y, '0', textStyle(SCORE.fontPx))
      .setOrigin(0, 0.5);
    this.streakText = scene.add
      .text(SCORE.x, SCORE.y - SCORE.streakGap, '', textStyle(SCORE.streakFontPx, TEXT_COLOR.accent))
      .setOrigin(0, 0.5);

    this.timerIcon = scene.add.image(TIMER.x, TIMER.y, TEX.iconClock).setOrigin(1, 0.5);
    this.timerText = scene.add.text(TIMER.x, TIMER.y, '0:00', textStyle(TIMER.fontPx)).setOrigin(1, 0.5);

    const levelText = scene.add
      .text(LEVEL_LABEL.x, LEVEL_LABEL.y, levelName, textStyle(LEVEL_LABEL.fontPx, TEXT_COLOR.dim))
      .setOrigin(1, 0);

    this.prepText = scene.add
      .text(GAME_WIDTH / 2, PREP_HINT.y, 'Serve a dish to start the clock', textStyle(PREP_HINT.fontPx, TEXT_COLOR.accent))
      .setOrigin(0.5, 0.5)
      .setVisible(false);

    this.root.add([coin, this.scoreText, this.streakText, this.timerIcon, this.timerText, levelText, this.prepText]);
  }

  /** One call per frame: consumes this frame's events, then syncs to the snapshot. */
  update(state: Readonly<SimState>, events: readonly SimEvent[], deltaMs: number): void {
    this.handleEvents(events);
    this.syncCards(state);
    this.drawScore(state);
    this.drawTimer(state, deltaMs);
    this.drawPrepHint(state, deltaMs);
  }

  destroy(): void {
    for (const tween of this.tweens) tween.remove();
    this.tweens.clear();
    for (const card of this.cards.values()) card.root.destroy(true);
    this.cards.clear();
    this.root.destroy(true);
  }

  // ─── Events ───────────────────────────────────────────────────────────────
  private handleEvents(events: readonly SimEvent[]): void {
    for (const event of events) {
      if (event.type === 'serve' && typeof event.value === 'number') this.scorePopup(event.value);
      if (event.type === 'orderExpired' && typeof event.value === 'number') this.expiredIds.add(event.value);
    }
  }

  private scorePopup(amount: number): void {
    const sign = amount >= 0 ? '+' : '';
    const color = amount >= 0 ? TEXT_COLOR.good : TEXT_COLOR.danger;
    const popup = this.scene.add
      .text(SCORE.x + SCORE.iconGap, SCORE.y - SCORE.streakGap, `${sign}${amount}`, textStyle(SCORE.popupFontPx, color))
      .setOrigin(0, 0.5);
    this.root.add(popup);
    this.track(
      this.scene.tweens.add({
        targets: popup,
        y: popup.y - SCORE.popupRisePx,
        alpha: 0,
        duration: SCORE.popupMs,
        ease: 'Cubic.easeOut',
        onComplete: () => popup.destroy(),
      }),
    );
  }

  // ─── Order cards ──────────────────────────────────────────────────────────
  private syncCards(state: Readonly<SimState>): void {
    const live = new Set<number>();
    state.orders.forEach((order, slot) => {
      live.add(order.id);
      let card = this.cards.get(order.id);
      // An id that comes back while its old card is still animating out (order ids reused,
      // or the debug fake state swapping in) gets a fresh card; the old one finishes alone.
      if (card?.leaving) {
        this.cards.delete(order.id);
        card = undefined;
      }
      this.updateCard(card ?? this.createCard(order, slot), order, slot);
    });
    for (const card of this.cards.values()) {
      if (live.has(card.id) || card.leaving) continue;
      const expired = this.expiredIds.has(card.id) || card.lastTimeLeft <= CARD.expireGraceSec;
      this.expiredIds.delete(card.id);
      if (expired) this.expireCard(card);
      else this.serveCard(card);
    }
  }

  private slotX(slot: number): number {
    return CARD.x + slot * (CARD.width + CARD.gap);
  }

  private createCard(order: Order, slot: number): OrderCard {
    const scene = this.scene;
    const root = scene.add.container(this.slotX(slot), CARD.y - CARD.slideInPx).setAlpha(0);
    const background = scene.add.image(0, 0, TEX.orderCard).setOrigin(0, 0).setDisplaySize(CARD.width, CARD.height);
    const icon = scene.add.image(CARD.width / 2, CARD.iconY, recipeIconKey(order.recipeId)).setOrigin(0.5, 0.5).setScale(CARD.iconScale);
    const name = scene.add
      .text(CARD.width / 2, CARD.nameY, recipeName(order.recipeId), textStyle(CARD.nameFontPx, TEXT_COLOR.bright, {
        align: 'center',
        wordWrap: { width: CARD.nameWrapPx },
      }))
      .setOrigin(0.5, 0.5);
    const barTrack = scene.add
      .rectangle((CARD.width - CARD.barWidth) / 2, CARD.barY, CARD.barWidth, CARD.barHeight, COLOR.barTrack)
      .setOrigin(0, 0.5);
    const barFill = scene.add
      .rectangle((CARD.width - CARD.barWidth) / 2, CARD.barY, CARD.barWidth, CARD.barHeight, COLOR.barGood)
      .setOrigin(0, 0.5);
    root.add([background, icon, name, barTrack, barFill]);
    this.root.add(root);

    const card: OrderCard = { id: order.id, root, icon, barFill, slot, leaving: false, lastTimeLeft: order.timeLeft };
    this.cards.set(order.id, card);
    this.track(
      scene.tweens.add({
        targets: root,
        y: CARD.y,
        alpha: 1,
        duration: CARD.slideInMs,
        ease: 'Back.easeOut',
      }),
    );
    return card;
  }

  private updateCard(card: OrderCard, order: Order, slot: number): void {
    if (card.slot !== slot) {
      card.slot = slot;
      this.track(
        this.scene.tweens.add({ targets: card.root, x: this.slotX(slot), duration: CARD.moveMs, ease: 'Quad.easeOut' }),
      );
    }
    const total = order.timeTotal > 0 ? order.timeTotal : 1;
    const fraction = Phaser.Math.Clamp(order.timeLeft / total, 0, 1);
    card.barFill.setDisplaySize(Math.max(0, CARD.barWidth * fraction), CARD.barHeight);
    card.barFill.setFillStyle(fraction <= CARD.dangerFraction ? COLOR.barDanger : COLOR.barGood);
    card.icon.setTexture(recipeIconKey(order.recipeId));
    card.lastTimeLeft = order.timeLeft;
  }

  private expireCard(card: OrderCard): void {
    card.leaving = true;
    this.track(
      this.scene.tweens.add({
        targets: card.root,
        alpha: { from: 1, to: 0.25 },
        duration: CARD.expireFlashMs,
        yoyo: true,
        repeat: CARD.expireFlashes,
        onComplete: () => {
          this.track(
            this.scene.tweens.add({
              targets: card.root,
              y: CARD.y + CARD.expireDropPx,
              alpha: 0,
              duration: CARD.expireDropMs,
              ease: 'Quad.easeIn',
              onComplete: () => this.removeCard(card),
            }),
          );
        },
      }),
    );
    for (const child of card.root.list) {
      if (child instanceof Phaser.GameObjects.Image) child.setTint(COLOR.barDanger);
    }
  }

  private serveCard(card: OrderCard): void {
    card.leaving = true;
    this.track(
      this.scene.tweens.add({
        targets: card.root,
        y: CARD.y - CARD.servedRisePx,
        alpha: 0,
        duration: CARD.servedRiseMs,
        ease: 'Quad.easeOut',
        onComplete: () => this.removeCard(card),
      }),
    );
  }

  private removeCard(card: OrderCard): void {
    if (this.cards.get(card.id) === card) this.cards.delete(card.id);
    card.root.destroy(true);
  }

  // ─── Score, timer, prep hint ──────────────────────────────────────────────
  private drawScore(state: Readonly<SimState>): void {
    this.scoreText.setText(String(state.score));
    if (state.tipStreak > 1) {
      this.streakText.setText(`Tip streak x${state.tipStreak}`);
      this.streakText.setVisible(true);
    } else {
      this.streakText.setVisible(false);
    }
  }

  private drawTimer(state: Readonly<SimState>, deltaMs: number): void {
    this.timerText.setText(formatClock(state.timeLeft));
    // The clock sits left of the digits, which change width as the timer counts down.
    this.timerIcon.setX(this.timerText.x - this.timerText.displayWidth - TIMER.iconGap);
    const warning = state.timeLeft <= TIMER_WARNING_AT && state.phase !== 'ended';
    if (!warning) {
      this.blinkMs = 0;
      this.timerText.setColor(TEXT_COLOR.bright);
      this.timerIcon.setAlpha(1);
      return;
    }
    this.blinkMs += deltaMs;
    const on = Math.floor(this.blinkMs / TIMER.blinkMs) % 2 === 0;
    this.timerText.setColor(on ? TEXT_COLOR.danger : TEXT_COLOR.bright);
    this.timerIcon.setAlpha(on ? 1 : 0.4);
  }

  private drawPrepHint(state: Readonly<SimState>, deltaMs: number): void {
    const show = state.phase === 'prep';
    this.prepText.setVisible(show);
    if (!show) return;
    this.pulseMs += deltaMs;
    const wave = 0.5 + 0.5 * Math.sin((this.pulseMs / PREP_HINT.pulseMs) * Math.PI * 2);
    this.prepText.setAlpha(PREP_HINT.pulseMinAlpha + (1 - PREP_HINT.pulseMinAlpha) * wave);
  }

  private track(tween: Phaser.Tweens.Tween): void {
    this.tweens.add(tween);
    tween.once('complete', () => this.tweens.delete(tween));
  }
}
