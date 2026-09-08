// ─── Web Audio synthesis primitives ─────────────────────────────────────────
// Two building blocks — an enveloped oscillator and an enveloped, filtered noise
// burst — plus a small voice pool. Every node disconnects itself in `onended`,
// so nothing accumulates over a long session.
import { log } from '../log';

// ─── Constants ──────────────────────────────────────────────────────────────

export const MAX_VOICES = 16;
const MIN_GAIN = 0.0001;    // exponential ramps cannot reach zero
const MIN_FREQ = 20;
const TAIL = 0.02;          // extra time before stop() so the release is not clipped
const NOISE_SECONDS = 1;

// ─── Voice pool ─────────────────────────────────────────────────────────────

export interface VoicePool {
  acquire(): boolean;
  release(): void;
  active(): number;
}

export function createVoicePool(max: number = MAX_VOICES): VoicePool {
  let active = 0;
  return {
    acquire: () => {
      if (active >= max) return false;
      active++;
      return true;
    },
    release: () => {
      if (active > 0) active--;
    },
    active: () => active,
  };
}

// ─── Synth context ──────────────────────────────────────────────────────────

export interface SynthContext {
  ctx: AudioContext;
  dest: AudioNode;
  pool: VoicePool;
  noiseBuffer: AudioBuffer;
}

/** One second of white noise, reused by every noise voice. */
export function createNoiseBuffer(ctx: AudioContext): AudioBuffer {
  const length = Math.floor(ctx.sampleRate * NOISE_SECONDS);
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
  return buffer;
}

// ─── Voices ─────────────────────────────────────────────────────────────────

export interface ToneOptions {
  type: OscillatorType;
  freq: number;
  /** Optional glide target reached at the end of the note. */
  freqEnd?: number;
  start: number;   // absolute AudioContext time
  dur: number;
  gain: number;
  attack?: number;
  /** Fraction of `dur` the note holds before the release starts (0..1). */
  hold?: number;
  detune?: number;
}

export function tone(sc: SynthContext, o: ToneOptions): void {
  if (!sc.pool.acquire()) return;
  const { ctx } = sc;
  const osc = ctx.createOscillator();
  const gainNode = ctx.createGain();
  const attack = Math.min(o.attack ?? 0.006, o.dur * 0.5);
  const holdUntil = o.start + o.dur * (o.hold ?? 0.35);
  const peak = Math.max(MIN_GAIN * 2, o.gain);

  osc.type = o.type;
  if (o.detune !== undefined) osc.detune.setValueAtTime(o.detune, o.start);
  osc.frequency.setValueAtTime(Math.max(MIN_FREQ, o.freq), o.start);
  if (o.freqEnd !== undefined) {
    osc.frequency.exponentialRampToValueAtTime(Math.max(MIN_FREQ, o.freqEnd), o.start + o.dur);
  }

  gainNode.gain.setValueAtTime(MIN_GAIN, o.start);
  gainNode.gain.exponentialRampToValueAtTime(peak, o.start + attack);
  gainNode.gain.setValueAtTime(peak, Math.max(o.start + attack, holdUntil));
  gainNode.gain.exponentialRampToValueAtTime(MIN_GAIN, o.start + o.dur);

  osc.connect(gainNode);
  gainNode.connect(sc.dest);
  osc.onended = (): void => {
    osc.disconnect();
    gainNode.disconnect();
    sc.pool.release();
  };
  osc.start(o.start);
  osc.stop(o.start + o.dur + TAIL);
}

export interface NoiseOptions {
  start: number;
  dur: number;
  gain: number;
  filter?: BiquadFilterType;
  freq?: number;
  /** Optional filter sweep target reached at the end of the burst. */
  freqEnd?: number;
  q?: number;
  attack?: number;
  hold?: number;
  playbackRate?: number;
}

export function noise(sc: SynthContext, o: NoiseOptions): void {
  if (!sc.pool.acquire()) return;
  const { ctx } = sc;
  const src = ctx.createBufferSource();
  const gainNode = ctx.createGain();
  const attack = Math.min(o.attack ?? 0.004, o.dur * 0.5);
  const holdUntil = o.start + o.dur * (o.hold ?? 0.25);
  const peak = Math.max(MIN_GAIN * 2, o.gain);

  src.buffer = sc.noiseBuffer;
  src.loop = true;
  if (o.playbackRate !== undefined) src.playbackRate.setValueAtTime(o.playbackRate, o.start);

  gainNode.gain.setValueAtTime(MIN_GAIN, o.start);
  gainNode.gain.exponentialRampToValueAtTime(peak, o.start + attack);
  gainNode.gain.setValueAtTime(peak, Math.max(o.start + attack, holdUntil));
  gainNode.gain.exponentialRampToValueAtTime(MIN_GAIN, o.start + o.dur);

  let head: AudioNode = src;
  let filterNode: BiquadFilterNode | null = null;
  if (o.filter) {
    filterNode = ctx.createBiquadFilter();
    filterNode.type = o.filter;
    filterNode.frequency.setValueAtTime(Math.max(MIN_FREQ, o.freq ?? 1000), o.start);
    if (o.freqEnd !== undefined) {
      filterNode.frequency.exponentialRampToValueAtTime(Math.max(MIN_FREQ, o.freqEnd), o.start + o.dur);
    }
    if (o.q !== undefined) filterNode.Q.setValueAtTime(o.q, o.start);
    src.connect(filterNode);
    head = filterNode;
  }
  head.connect(gainNode);
  gainNode.connect(sc.dest);

  src.onended = (): void => {
    src.disconnect();
    filterNode?.disconnect();
    gainNode.disconnect();
    sc.pool.release();
  };
  src.start(o.start);
  src.stop(o.start + o.dur + TAIL);
}

// ─── Safety wrapper ─────────────────────────────────────────────────────────

/** Web Audio throws on invalid parameters; one bad sound must not kill the game. */
export function safely(what: string, body: () => void): void {
  try {
    body();
  } catch (err) {
    log.warn('audio: failed to play', what, err);
  }
}
