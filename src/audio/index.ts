// ─── Audio bus ──────────────────────────────────────────────────────────────
// Web Audio only: every sound is synthesised, there are no audio files. The
// AudioContext is created lazily on the first resume()/play() so nothing is
// constructed before the browser allows it, and every method is a no-op where
// Web Audio does not exist (Node, tests, locked-down browsers).
import { STORAGE_KEYS } from '../config';
import { log } from '../log';
import type { SimEvent } from '../sim/types';
import type { AudioBus, SfxName } from './types';
import { SFX_TABLE } from './sfx';
import { createMusicPlayer, type MusicPlayer } from './music';
import { createNoiseBuffer, createVoicePool, safely, type SynthContext } from './synth';

export * from './types';

// ─── Constants ──────────────────────────────────────────────────────────────

const MASTER_GAIN = 0.55;
const SFX_MIN_INTERVAL_MS = 60;   // the same sound plays at most this often
const SCHEDULE_OFFSET_S = 0.002;  // never schedule in the past
const MUTE_RAMP_S = 0.03;

type AudioContextCtor = new () => AudioContext;

// ─── Environment ────────────────────────────────────────────────────────────

function audioContextCtor(): AudioContextCtor | null {
  const g = globalThis as { AudioContext?: AudioContextCtor; webkitAudioContext?: AudioContextCtor };
  return g.AudioContext ?? g.webkitAudioContext ?? null;
}

function nowMs(): number {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}

function loadMuted(): boolean {
  try {
    const raw = globalThis.localStorage?.getItem(STORAGE_KEYS.MUTED);
    return raw === '1' || raw === 'true';
  } catch (err) {
    log.warn('audio: could not read mute state', err);
    return false;
  }
}

function saveMuted(muted: boolean): void {
  try {
    globalThis.localStorage?.setItem(STORAGE_KEYS.MUTED, muted ? '1' : '0');
  } catch (err) {
    log.warn('audio: could not persist mute state', err);
  }
}

// ─── Bus ────────────────────────────────────────────────────────────────────

export function createAudioBus(): AudioBus {
  let synth: SynthContext | null = null;
  let master: GainNode | null = null;
  let music: MusicPlayer | null = null;
  let musicWanted = false;
  let muted = loadMuted();
  let musicEnabled = true;
  let sfxEnabled = true;
  const lastPlayedAt: Partial<Record<SfxName, number>> = {};

  /** Build the AudioContext on first use; null where Web Audio is unavailable. */
  function ensure(): SynthContext | null {
    if (synth) return synth;
    const Ctor = audioContextCtor();
    if (!Ctor) return null;
    try {
      const ctx = new Ctor();
      const gain = ctx.createGain();
      gain.gain.value = muted ? 0 : MASTER_GAIN;
      gain.connect(ctx.destination);
      // The context starts suspended until a user gesture; music waits for that.
      ctx.onstatechange = (): void => syncMusic();
      master = gain;
      synth = { ctx, dest: gain, pool: createVoicePool(), noiseBuffer: createNoiseBuffer(ctx) };
      log.info('audio: context created', ctx.sampleRate, 'Hz');
      return synth;
    } catch (err) {
      log.warn('audio: Web Audio unavailable', err);
      return null;
    }
  }

  /** Music runs only while wanted, switched on, unmuted and audible, so a muted game costs nothing. */
  function syncMusic(): void {
    const sc = synth;
    if (!sc) return;
    if (!music) music = createMusicPlayer(sc.ctx, sc.dest);
    if (musicWanted && musicEnabled && !muted && sc.ctx.state === 'running') {
      if (!music.isPlaying()) music.start();
    } else if (music.isPlaying()) {
      music.stop();
    }
  }

  return {
    resume: (): void => {
      const sc = ensure();
      if (!sc) return;
      if (sc.ctx.state === 'suspended') {
        sc.ctx.resume().catch((err: unknown) => log.warn('audio: resume rejected', err));
      }
      syncMusic();
    },

    play: (name: SfxName): void => {
      if (muted || !sfxEnabled) return;
      const sc = ensure();
      if (!sc) return;
      // Nothing is audible before the first gesture, and scheduling into a
      // suspended context would fire the whole backlog at once on resume.
      if (sc.ctx.state !== 'running') return;
      const t = nowMs();
      const last = lastPlayedAt[name];
      if (last !== undefined && t - last < SFX_MIN_INTERVAL_MS) return;
      lastPlayedAt[name] = t;
      safely(name, () => SFX_TABLE[name](sc, sc.ctx.currentTime + SCHEDULE_OFFSET_S));
    },

    startMusic: (): void => {
      musicWanted = true;
      if (!synth) return;   // starts on the next resume(), once the context exists
      syncMusic();
    },

    stopMusic: (): void => {
      musicWanted = false;
      syncMusic();
    },

    setMuted: (value: boolean): void => {
      muted = value;
      saveMuted(value);
      if (master && synth) {
        const target = value ? 0 : MASTER_GAIN;
        master.gain.setTargetAtTime(target, synth.ctx.currentTime, MUTE_RAMP_S);
      }
      syncMusic();
    },

    isMuted: (): boolean => muted,

    setMusicEnabled: (enabled: boolean): void => {
      musicEnabled = enabled;
      syncMusic();
    },

    isMusicEnabled: (): boolean => musicEnabled,

    setSfxEnabled: (enabled: boolean): void => {
      sfxEnabled = enabled;
    },

    isSfxEnabled: (): boolean => sfxEnabled,
  };
}

// ─── Simulation events → sounds ─────────────────────────────────────────────

export function sfxForEvent(event: SimEvent): SfxName | null {
  switch (event.type) {
    case 'pickup': return 'pickup';
    case 'drop': return 'drop';
    case 'trash': return 'trash';
    case 'chopTick': return 'chop';
    case 'chopDone': return 'chopDone';
    case 'potAdd': return 'potAdd';
    case 'cookStart': return 'sizzle';
    case 'cookDone': return 'cookDone';
    case 'burnt': return 'burnAlarm';
    case 'potPour': return 'pour';
    case 'plateAdd': return 'plateAdd';
    case 'fireStart': case 'fireSpread': return 'fire';
    case 'spray': return 'spray';
    case 'fireOut': return 'fireOut';
    case 'washTick': return 'wash';
    case 'washDone': return 'washDone';
    case 'plateReturned': return 'plateReturn';
    case 'serve': return 'serve';
    case 'serveRejected': return 'serveBad';
    case 'orderNew': return 'orderNew';
    case 'orderExpired': return 'orderFail';
    case 'timerStart': return 'timerStart';
    case 'timerWarning': return 'timerWarning';
    case 'levelEnd': return 'levelEnd';
    case 'gateOpen': return 'gateOpen';
    case 'gateClose': return 'gateClose';
    case 'throw': return 'throw';
    case 'catch': return 'catch';
    case 'throwLand': return 'throwLand';
    case 'dash': return 'dash';
    case 'dashBump': return 'dashBump';
    case 'chefFell': return 'chefFell';
    default: return null;
  }
}
