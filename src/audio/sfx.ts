// ─── One-shot sound effects ─────────────────────────────────────────────────
// One short synthesised sound per SfxName. Each entry gets the synth context and
// the absolute start time; layered voices offset themselves from it. Keep every
// sound under ~0.5 s — these fire several times a second in a busy kitchen.
import { noise, tone, type SynthContext } from './synth';
import type { SfxName } from './types';

// ─── Note table ─────────────────────────────────────────────────────────────

const NOTE = {
  c5: 523.25, e5: 659.25, g5: 783.99,
  c6: 1046.50, e6: 1318.51, g6: 1567.98,
} as const;

export type SfxDef = (sc: SynthContext, t: number) => void;

// ─── Definitions ────────────────────────────────────────────────────────────

export const SFX_TABLE: Record<SfxName, SfxDef> = {
  // Carrying things around.
  pickup: (sc, t) => {
    tone(sc, { type: 'triangle', freq: 440, freqEnd: 720, start: t, dur: 0.09, gain: 0.22 });
  },
  drop: (sc, t) => {
    tone(sc, { type: 'triangle', freq: 620, freqEnd: 300, start: t, dur: 0.09, gain: 0.2 });
  },
  trash: (sc, t) => {
    noise(sc, { start: t, dur: 0.22, gain: 0.28, filter: 'lowpass', freq: 1600, freqEnd: 300 });
    tone(sc, { type: 'sine', freq: 120, freqEnd: 70, start: t, dur: 0.18, gain: 0.18 });
  },

  // Chopping board.
  chop: (sc, t) => {
    noise(sc, { start: t, dur: 0.05, gain: 0.3, filter: 'highpass', freq: 1800 });
    tone(sc, { type: 'square', freq: 900, start: t, dur: 0.03, gain: 0.1 });
  },
  chopDone: (sc, t) => {
    tone(sc, { type: 'sine', freq: NOTE.g5, start: t, dur: 0.1, gain: 0.18 });
    tone(sc, { type: 'sine', freq: NOTE.e6, start: t + 0.08, dur: 0.18, gain: 0.16 });
  },

  // Pot and stove.
  potAdd: (sc, t) => {
    tone(sc, { type: 'sine', freq: 430, freqEnd: 140, start: t, dur: 0.13, gain: 0.24, hold: 0.1 });
    noise(sc, { start: t, dur: 0.06, gain: 0.1, filter: 'lowpass', freq: 900 });
  },
  sizzle: (sc, t) => {
    noise(sc, { start: t, dur: 0.34, gain: 0.12, filter: 'bandpass', freq: 3200, q: 0.9 });
  },
  cookDone: (sc, t) => {
    tone(sc, { type: 'sine', freq: NOTE.c6, start: t, dur: 0.34, gain: 0.18, attack: 0.012 });
    tone(sc, { type: 'sine', freq: NOTE.g6, start: t + 0.04, dur: 0.28, gain: 0.09 });
  },
  burnAlarm: (sc, t) => {
    tone(sc, { type: 'square', freq: 880, start: t, dur: 0.12, gain: 0.2, hold: 0.7 });
    tone(sc, { type: 'square', freq: 660, start: t + 0.14, dur: 0.14, gain: 0.2, hold: 0.7 });
  },
  pour: (sc, t) => {
    tone(sc, { type: 'triangle', freq: 900, freqEnd: 260, start: t, dur: 0.36, gain: 0.17 });
    noise(sc, { start: t, dur: 0.34, gain: 0.08, filter: 'bandpass', freq: 1400, freqEnd: 400, q: 1.2 });
  },
  // Assembling a burger: one soft blip per layer, quiet enough to repeat quickly.
  plateAdd: (sc, t) => {
    tone(sc, { type: 'sine', freq: 660, freqEnd: 940, start: t, dur: 0.07, gain: 0.15, attack: 0.004 });
    noise(sc, { start: t, dur: 0.04, gain: 0.05, filter: 'lowpass', freq: 1300 });
  },

  // Fire and extinguisher.
  fire: (sc, t) => {
    noise(sc, { start: t, dur: 0.4, gain: 0.2, filter: 'lowpass', freq: 520, hold: 0.5 });
    for (const [i, at] of [0.04, 0.17, 0.29].entries()) {
      tone(sc, { type: 'square', freq: 260 - i * 40, start: t + at, dur: 0.03, gain: 0.11 });
    }
  },
  spray: (sc, t) => {
    noise(sc, { start: t, dur: 0.35, gain: 0.18, filter: 'highpass', freq: 3800, hold: 0.6 });
  },
  fireOut: (sc, t) => {
    noise(sc, { start: t, dur: 0.5, gain: 0.2, filter: 'bandpass', freq: 6000, freqEnd: 700, q: 0.7, hold: 0.3 });
  },

  // Sink and plates.
  wash: (sc, t) => {
    noise(sc, { start: t, dur: 0.18, gain: 0.16, filter: 'bandpass', freq: 900, q: 2.2 });
    tone(sc, { type: 'sine', freq: 300, freqEnd: 540, start: t, dur: 0.12, gain: 0.08 });
  },
  washDone: (sc, t) => {
    tone(sc, { type: 'sine', freq: NOTE.e6, start: t, dur: 0.26, gain: 0.18 });
  },
  plateReturn: (sc, t) => {
    tone(sc, { type: 'sine', freq: 2200, start: t, dur: 0.09, gain: 0.13 });
    tone(sc, { type: 'sine', freq: 2900, start: t + 0.035, dur: 0.07, gain: 0.09 });
  },

  // Serving.
  serve: (sc, t) => {
    [NOTE.c5, NOTE.e5, NOTE.g5].forEach((freq, i) => {
      tone(sc, { type: 'triangle', freq, start: t + i * 0.07, dur: 0.17, gain: 0.2 });
    });
  },
  serveBad: (sc, t) => {
    tone(sc, { type: 'sawtooth', freq: 150, start: t, dur: 0.3, gain: 0.15, hold: 0.7 });
    tone(sc, { type: 'sawtooth', freq: 156, start: t, dur: 0.3, gain: 0.12, hold: 0.7 });
  },

  // Orders.
  orderNew: (sc, t) => {
    tone(sc, { type: 'sine', freq: 620, freqEnd: 1240, start: t, dur: 0.09, gain: 0.2, hold: 0.15 });
    tone(sc, { type: 'square', freq: NOTE.c6, start: t + 0.07, dur: 0.06, gain: 0.08 });
  },
  orderFail: (sc, t) => {
    tone(sc, { type: 'sawtooth', freq: 320, freqEnd: 110, start: t, dur: 0.4, gain: 0.16, hold: 0.5 });
    tone(sc, { type: 'square', freq: 160, freqEnd: 60, start: t + 0.03, dur: 0.35, gain: 0.08 });
  },

  // Timer and results.
  timerStart: (sc, t) => {
    tone(sc, { type: 'sine', freq: 1200, freqEnd: 1900, start: t, dur: 0.18, gain: 0.16, hold: 0.8 });
    tone(sc, { type: 'sine', freq: 1900, freqEnd: 1450, start: t + 0.17, dur: 0.24, gain: 0.14, hold: 0.5 });
  },
  timerWarning: (sc, t) => {
    tone(sc, { type: 'square', freq: 1500, start: t, dur: 0.045, gain: 0.16 });
  },
  levelEnd: (sc, t) => {
    [NOTE.c5, NOTE.e5, NOTE.g5, NOTE.c6].forEach((freq, i) => {
      const last = i === 3;
      tone(sc, { type: 'square', freq, start: t + i * 0.12, dur: last ? 0.45 : 0.16, gain: 0.14, hold: last ? 0.6 : 0.4 });
      tone(sc, { type: 'triangle', freq: freq / 2, start: t + i * 0.12, dur: last ? 0.45 : 0.16, gain: 0.12 });
    });
  },

  // Earthquake gate.
  gateOpen: (sc, t) => {
    noise(sc, { start: t, dur: 0.5, gain: 0.22, filter: 'lowpass', freq: 90, freqEnd: 420, hold: 0.55 });
    tone(sc, { type: 'sine', freq: 55, freqEnd: 120, start: t, dur: 0.48, gain: 0.2, hold: 0.5 });
    tone(sc, { type: 'triangle', freq: 110, freqEnd: 240, start: t + 0.06, dur: 0.4, gain: 0.09 });
  },
  gateClose: (sc, t) => {
    noise(sc, { start: t, dur: 0.4, gain: 0.24, filter: 'lowpass', freq: 500, freqEnd: 70, hold: 0.3 });
    tone(sc, { type: 'sine', freq: 150, freqEnd: 45, start: t, dur: 0.34, gain: 0.24, attack: 0.005, hold: 0.25 });
    tone(sc, { type: 'square', freq: 80, start: t + 0.24, dur: 0.1, gain: 0.12 });
  },

  // Menus.
  uiMove: (sc, t) => {
    tone(sc, { type: 'square', freq: 700, start: t, dur: 0.045, gain: 0.12 });
  },
  uiConfirm: (sc, t) => {
    tone(sc, { type: 'square', freq: 900, freqEnd: 1350, start: t, dur: 0.08, gain: 0.14 });
  },
  uiBack: (sc, t) => {
    tone(sc, { type: 'square', freq: 700, freqEnd: 420, start: t, dur: 0.08, gain: 0.14 });
  },
};
