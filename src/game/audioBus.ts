// ─── Audio bus singleton ────────────────────────────────────────────────────
// One AudioBus for the whole game so music and mute survive scene changes.
// Web Audio needs a user gesture before it will make noise, so every scene arms
// installAudioGestureResume() and the first key / pad / pointer press resumes it.
import Phaser from 'phaser';
import { createAudioBus } from '../audio';
import type { AudioBus } from '../audio/types';
import { STORAGE_KEYS } from '../config';
import { log } from '../log';

const MUTED_ON = '1';
const MUTED_OFF = '0';
const MUTE_KEY_EVENT = 'keydown-M';

let bus: AudioBus | null = null;

// ─── Persistence ────────────────────────────────────────────────────────────
function loadMuted(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEYS.MUTED) === MUTED_ON;
  } catch (err) {
    log.warn('could not read mute state', err);
    return false;
  }
}

function saveMuted(muted: boolean): void {
  try {
    window.localStorage.setItem(STORAGE_KEYS.MUTED, muted ? MUTED_ON : MUTED_OFF);
  } catch (err) {
    log.warn('could not save mute state', err);
  }
}

// ─── Public API ─────────────────────────────────────────────────────────────
export function getAudioBus(): AudioBus {
  if (!bus) {
    bus = createAudioBus();
    bus.setMuted(loadMuted());
  }
  return bus;
}

export function setMuted(muted: boolean): void {
  getAudioBus().setMuted(muted);
  saveMuted(muted);
  log.info('audio muted:', muted);
}

export function toggleMuted(): boolean {
  const next = !getAudioBus().isMuted();
  setMuted(next);
  return next;
}

/** Resumes the audio context on the first input of any kind. Returns a disposer. */
export function installAudioGestureResume(scene: Phaser.Scene): () => void {
  const audio = getAudioBus();
  let resumed = false;
  const resume = (): void => {
    if (resumed) return;
    resumed = true;
    audio.resume();
  };
  scene.input.keyboard?.on(Phaser.Input.Keyboard.Events.ANY_KEY_DOWN, resume);
  scene.input.gamepad?.on(Phaser.Input.Gamepad.Events.BUTTON_DOWN, resume);
  scene.input.on(Phaser.Input.Events.POINTER_DOWN, resume);
  return () => {
    scene.input.keyboard?.off(Phaser.Input.Keyboard.Events.ANY_KEY_DOWN, resume);
    scene.input.gamepad?.off(Phaser.Input.Gamepad.Events.BUTTON_DOWN, resume);
    scene.input.off(Phaser.Input.Events.POINTER_DOWN, resume);
  };
}

/** M toggles mute for the whole game. Returns a disposer. */
export function installMuteToggle(scene: Phaser.Scene): () => void {
  const onMute = (): void => { toggleMuted(); };
  scene.input.keyboard?.on(MUTE_KEY_EVENT, onMute);
  return () => { scene.input.keyboard?.off(MUTE_KEY_EVENT, onMute); };
}
