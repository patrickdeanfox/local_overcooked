// ─── Background music ───────────────────────────────────────────────────────
// An 8-bar loop at 120 bpm: triangle bass on a I–vi–IV–V progression under a
// square-wave motif. Notes are scheduled ahead on the Web Audio clock by a
// setInterval "lookahead" pump, which keeps timing sample-accurate even when the
// game loop stutters. No audio files, no samples.
import { log } from '../log';

// ─── Constants ──────────────────────────────────────────────────────────────

const BPM = 120;
const STEP_S = 60 / BPM / 2;          // one eighth note
const STEPS_PER_BAR = 8;
const BARS = 8;
const TOTAL_STEPS = STEPS_PER_BAR * BARS;

const LOOKAHEAD_MS = 25;              // how often the pump runs
const SCHEDULE_AHEAD_S = 0.25;        // how far ahead notes are queued

const MUSIC_GAIN = 0.125;             // ~-18 dB under the master gain
const BASS_GAIN = 0.5;
const LEAD_GAIN = 0.34;               // a triangle lead is quieter than the square it replaced
const BASS_DUR = 0.22;
const LEAD_DUR = 0.19;
const MIN_GAIN = 0.0001;

/** Bass root of each bar: C – Am – F – G, twice. */
const BAR_ROOTS: readonly number[] = [130.81, 110.00, 87.31, 98.00, 130.81, 110.00, 87.31, 98.00];
/** Semitone shift applied to the lead motif in each bar, so it follows the chords. */
const BAR_SHIFTS: readonly number[] = [0, -3, -7, -5, 0, -3, -7, -5];
/** Eighth-note steps of each bar that get a bass note. */
const BASS_STEPS: readonly number[] = [0, 3, 4, 6];
/** Two-bar motif in semitones above C5; null is a rest. */
const MOTIF: readonly (number | null)[] = [
  0, 4, 7, null, 7, 4, 0, null,
  5, 4, 2, null, 4, null, 0, null,
];
const LEAD_ROOT = 523.25;             // C5

// ─── Types ──────────────────────────────────────────────────────────────────

export interface MusicPlayer {
  start(): void;
  stop(): void;
  isPlaying(): boolean;
}

// ─── Player ─────────────────────────────────────────────────────────────────

export function createMusicPlayer(ctx: AudioContext, dest: AudioNode): MusicPlayer {
  const bus = ctx.createGain();
  bus.gain.value = MUSIC_GAIN;
  bus.connect(dest);

  const live = new Set<OscillatorNode>();
  let timer: ReturnType<typeof setInterval> | null = null;
  let nextStepTime = 0;
  let step = 0;

  function voice(type: OscillatorType, freq: number, at: number, dur: number, gain: number): void {
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, at);
    env.gain.setValueAtTime(MIN_GAIN, at);
    env.gain.exponentialRampToValueAtTime(gain, at + 0.01);
    env.gain.setValueAtTime(gain, at + dur * 0.5);
    env.gain.exponentialRampToValueAtTime(MIN_GAIN, at + dur);
    osc.connect(env);
    env.connect(bus);
    osc.onended = (): void => {
      osc.disconnect();
      env.disconnect();
      live.delete(osc);
    };
    live.add(osc);
    osc.start(at);
    osc.stop(at + dur + 0.02);
  }

  function scheduleStep(index: number, at: number): void {
    const bar = Math.floor(index / STEPS_PER_BAR);
    const inBar = index % STEPS_PER_BAR;

    if (BASS_STEPS.includes(inBar)) {
      const root = BAR_ROOTS[bar];
      voice('triangle', inBar === 4 ? root * 2 : root, at, BASS_DUR, BASS_GAIN);
    }
    const motifStep = MOTIF[index % MOTIF.length];
    if (motifStep !== null) {
      const freq = LEAD_ROOT * Math.pow(2, (motifStep + BAR_SHIFTS[bar]) / 12);
      voice('triangle', freq, at, LEAD_DUR, LEAD_GAIN); // softer than a square wave over a long session
    }
  }

  function pump(): void {
    try {
      // A hidden tab throttles setInterval (and a sleeping machine stops it) while the
      // audio clock keeps running, so nextStepTime can end up far in the past. Without
      // this the catch-up loop would schedule the whole backlog at once and fire every
      // missed note simultaneously on return.
      if (nextStepTime < ctx.currentTime) nextStepTime = ctx.currentTime + STEP_S;
      while (nextStepTime < ctx.currentTime + SCHEDULE_AHEAD_S) {
        scheduleStep(step, nextStepTime);
        nextStepTime += STEP_S;
        step = (step + 1) % TOTAL_STEPS;
      }
    } catch (err) {
      log.warn('audio: music scheduler stopped', err);
      stop();
    }
  }

  function start(): void {
    if (timer !== null) return;
    step = 0;
    nextStepTime = ctx.currentTime + 0.08;
    pump();
    timer = setInterval(pump, LOOKAHEAD_MS);
  }

  function stop(): void {
    if (timer !== null) {
      clearInterval(timer);
      timer = null;
    }
    for (const osc of live) {
      try {
        osc.stop();
      } catch {
        // Already stopped; onended still cleans it up.
      }
    }
    live.clear();
  }

  return { start, stop, isPlaying: () => timer !== null };
}
