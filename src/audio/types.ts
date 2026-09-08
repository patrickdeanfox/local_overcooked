// ─── Audio contract ─────────────────────────────────────────────────────────
import type { SimEvent } from '../sim/types';

export type SfxName =
  | 'pickup' | 'drop' | 'trash'
  | 'chop' | 'chopDone'
  | 'potAdd' | 'sizzle' | 'cookDone' | 'burnAlarm'
  | 'pour'
  | 'fire' | 'spray' | 'fireOut'
  | 'wash' | 'washDone' | 'plateReturn'
  | 'serve' | 'serveBad'
  | 'orderNew' | 'orderFail'
  | 'timerStart' | 'timerWarning' | 'levelEnd'
  | 'uiMove' | 'uiConfirm' | 'uiBack';

export interface AudioBus {
  /** Must be called from a user gesture once (Web Audio autoplay policy). Safe to call repeatedly. */
  resume(): void;
  play(name: SfxName): void;
  startMusic(): void;
  stopMusic(): void;
  setMuted(muted: boolean): void;
  isMuted(): boolean;
}

export type SfxForEvent = (event: SimEvent) => SfxName | null;
