// ─── Tutorials ──────────────────────────────────────────────────────────────
// The guided walkthrough a tutorial kitchen carries in its level JSON (LevelDef.tutorial):
// a pure step machine over SimState and the frame's SimEvents. No Phaser here; the overlay
// in ui/TutorialOverlay.ts draws it and the Tutorials page reads the same definitions.
import type { TileRect, TutorialDef, TutorialGoal, TutorialStep } from '../levels/schema';
import type { Chef, Item, SimEvent, SimState } from '../sim/types';
import type { GameAction, HintAction } from '../input/types';

export type TutorialPhase = 'intro' | 'steps' | 'done' | 'skipped';
/** What a stepped frame did to the walkthrough. */
export type TutorialProgress = 'advanced' | 'completed' | null;

/** Where a step's progress stands: events of its type since it began, and sim seconds. */
export interface StepProgress { events: number; waited: number; }

// ─── Text ───────────────────────────────────────────────────────────────────
const PLACEHOLDER = /\{(pickup|interact|throw|dash)\}/g;

/** Swaps {pickup}, {interact}, {throw} and {dash} for the player's own button labels. */
export function fillLabels(text: string, labelFor: (action: HintAction) => string): string {
  return text.replace(PLACEHOLDER, (_match, action: string) => labelFor(action as GameAction));
}

// ─── Goals ──────────────────────────────────────────────────────────────────
function inZone(chef: Readonly<Chef>, zone: TileRect): boolean {
  return chef.x >= zone.x && chef.x < zone.x + zone.w && chef.y >= zone.y && chef.y < zone.y + zone.h;
}

function holdingMatches(item: Item | null, goal: Extract<TutorialGoal, { type: 'holding' }>): boolean {
  if (!item || item.kind !== goal.kind) return false;
  if (goal.count !== undefined) {
    const stacked = item.kind === 'plate' || item.kind === 'dirtyPlate' ? (item.count ?? 1) : 1;
    if (stacked !== goal.count) return false;
  }
  if (goal.load !== undefined && (item.kind !== 'tray' || item.items.length < goal.load)) return false;
  return true;
}

/** True when the goal holds for this state and the step's progress so far. */
export function goalMet(goal: TutorialGoal, state: Readonly<SimState>, progress: Readonly<StepProgress>): boolean {
  switch (goal.type) {
    case 'event': return progress.events >= (goal.count ?? 1);
    case 'holding': return state.chefs.some((c) => holdingMatches(c.holding, goal) && (!goal.zone || inZone(c, goal.zone)));
    case 'tileItem': {
      for (let y = goal.y; y < goal.y + (goal.h ?? 1); y++) {
        for (let x = goal.x; x < goal.x + (goal.w ?? 1); x++) {
          if (state.tileItems[y * state.width + x]?.kind === goal.kind) return true;
        }
      }
      return false;
    }
    case 'stock': {
      const tile = state.tiles[goal.y * state.width + goal.x];
      return tile?.stock !== undefined && tile.stock <= goal.max;
    }
    case 'served': return state.servedCount >= goal.count;
    case 'assisting': return state.chefs.some((c) => c.assisting === true);
    case 'wait': return progress.waited >= goal.sec;
  }
}

// ─── Runner ─────────────────────────────────────────────────────────────────
export class TutorialRunner {
  /** The steps this run plays: those whose minPlayers the player count meets. */
  readonly steps: readonly TutorialStep[];
  private phaseNow: TutorialPhase = 'intro';
  private index = 0;
  private progress: StepProgress = { events: 0, waited: 0 };

  constructor(readonly def: TutorialDef, players: number) {
    this.steps = def.steps.filter((step) => (step.minPlayers ?? 1) <= players);
  }

  get phase(): TutorialPhase { return this.phaseNow; }
  /** The rules panel is up: the kitchen holds still until the player starts. */
  get isBlocking(): boolean { return this.phaseNow === 'intro'; }
  /** The panel or a step is showing. */
  get isActive(): boolean { return this.phaseNow === 'intro' || this.phaseNow === 'steps'; }
  get current(): TutorialStep | null { return this.phaseNow === 'steps' ? this.steps[this.index] ?? null : null; }
  get stepNumber(): number { return Math.min(this.index + 1, this.steps.length); }
  get stepCount(): number { return this.steps.length; }

  /** Leaves the panel for the first step; a run whose player count leaves no steps is done at once. */
  start(): void {
    if (this.phaseNow !== 'intro') return;
    this.phaseNow = this.steps.length > 0 ? 'steps' : 'done';
  }

  skip(): void {
    if (this.isActive) this.phaseNow = 'skipped';
  }

  /**
   * After a stepped frame: counts the step's events and sim time, then advances through every
   * goal the frame satisfied. One frame can finish more than one step (the last tomato empties
   * the crate and the ticket rewrites in the same step), so the frame's events count for the
   * step that follows too; its wait starts fresh.
   */
  observe(state: Readonly<SimState>, events: readonly SimEvent[], dtSec: number): TutorialProgress {
    if (this.phaseNow !== 'steps') return null;
    let result: TutorialProgress = null;
    let dt = dtSec;
    for (let guard = 0; guard <= this.steps.length; guard++) {
      const step = this.steps[this.index];
      if (!step) {
        this.phaseNow = 'done';
        return 'completed';
      }
      if (step.goal.type === 'event') {
        for (const event of events) if (event.type === step.goal.event) this.progress.events += 1;
      }
      this.progress.waited += dt;
      if (!goalMet(step.goal, state, this.progress)) return result;
      this.index += 1;
      this.progress = { events: 0, waited: 0 };
      result = 'advanced';
      dt = 0;
    }
    return result;
  }

  /** For the F8 note context and the debug overlay. */
  describe(): { phase: TutorialPhase; step: number; of: number } {
    return { phase: this.phaseNow, step: this.stepNumber, of: this.steps.length };
  }
}
