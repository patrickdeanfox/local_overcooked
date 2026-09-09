// ─── Audio contract ─────────────────────────────────────────────────────────
import type { SimEvent } from '../sim/types';

export type SfxName =
  | 'pickup' | 'drop' | 'trash'
  | 'chop' | 'chopDone'
  | 'potAdd' | 'sizzle' | 'cookDone' | 'burnAlarm'
  | 'pour' | 'plateAdd'
  | 'fire' | 'spray' | 'fireOut'
  | 'wash' | 'washDone' | 'plateReturn'
  | 'serve' | 'serveBad'
  | 'orderNew' | 'orderFail'
  | 'timerStart' | 'timerWarning' | 'levelEnd'
  | 'gateOpen' | 'gateClose'
  | 'throw' | 'catch' | 'throwLand' | 'dash' | 'dashBump' | 'chefFell'
  // Mechanics spec (docs/MECHANICS.md): the 86 sting must read as different from orderNew
  | 'crateEmpty' | 'orderRewritten' | 'restockDue' | 'restockTick' | 'restocked'
  | 'trayLift' | 'traySet' | 'trayWobble'
  | 'uiMove' | 'uiConfirm' | 'uiBack';

export interface AudioBus {
  /** Must be called from a user gesture once (Web Audio autoplay policy). Safe to call repeatedly. */
  resume(): void;
  play(name: SfxName): void;
  startMusic(): void;
  stopMusic(): void;
  setMuted(muted: boolean): void;
  isMuted(): boolean;
  /** Music and sound effects can be switched off on their own, under the master mute. */
  setMusicEnabled(enabled: boolean): void;
  isMusicEnabled(): boolean;
  setSfxEnabled(enabled: boolean): void;
  isSfxEnabled(): boolean;
}

export type SfxForEvent = (event: SimEvent) => SfxName | null;
