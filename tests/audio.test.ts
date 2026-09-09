import { describe, expect, it } from 'vitest';
import { createAudioBus, sfxForEvent } from '../src/audio';
import type { SfxName } from '../src/audio/types';
import { SFX_TABLE } from '../src/audio/sfx';
import type { SimEventType } from '../src/sim/types';

// Kept in sync by hand with SimEventType in src/sim/types.ts: a new event type
// must either get a sound or an explicit null in sfxForEvent.
const ALL_EVENT_TYPES: readonly SimEventType[] = [
  'pickup', 'drop', 'trash',
  'chopTick', 'chopDone',
  'potAdd', 'cookStart', 'cookDone', 'burnt',
  'potPour', 'plateAdd',
  'fireStart', 'fireSpread', 'fireOut', 'spray',
  'washTick', 'washDone', 'plateReturned',
  'serve', 'serveRejected',
  'orderNew', 'orderExpired',
  'timerStart', 'timerWarning', 'levelEnd',
  'gateOpen', 'gateClose',
  'throw', 'catch', 'throwLand', 'dash', 'dashBump', 'chefFell',
  'crateEmpty', 'orderRewritten', 'restockDue', 'restockTick', 'restocked',
  'trayLift', 'traySet', 'trayWobble',
];

const ALL_SFX: readonly SfxName[] = [
  'pickup', 'drop', 'trash',
  'chop', 'chopDone',
  'potAdd', 'sizzle', 'cookDone', 'burnAlarm',
  'pour', 'plateAdd',
  'fire', 'spray', 'fireOut',
  'wash', 'washDone', 'plateReturn',
  'serve', 'serveBad',
  'orderNew', 'orderFail',
  'timerStart', 'timerWarning', 'levelEnd',
  'gateOpen', 'gateClose',
  'throw', 'catch', 'throwLand', 'dash', 'dashBump', 'chefFell',
  'crateEmpty', 'orderRewritten', 'restockDue', 'restockTick', 'restocked',
  'trayLift', 'traySet', 'trayWobble',
  'uiMove', 'uiConfirm', 'uiBack',
];

// ─── Event mapping ──────────────────────────────────────────────────────────

describe('sfxForEvent', () => {
  it('maps every SimEventType to a sound', () => {
    for (const type of ALL_EVENT_TYPES) {
      const name = sfxForEvent({ type });
      expect(name, type).not.toBeNull();
      expect(ALL_SFX, type).toContain(name);
    }
  });
});

describe('SFX_TABLE', () => {
  it('defines every SfxName', () => {
    for (const name of ALL_SFX) expect(typeof SFX_TABLE[name], name).toBe('function');
    expect(Object.keys(SFX_TABLE).length).toBe(ALL_SFX.length);
  });
});

// ─── Headless behaviour ─────────────────────────────────────────────────────

describe('createAudioBus without Web Audio', () => {
  it('constructs and every method is a safe no-op', () => {
    expect(globalThis.AudioContext).toBeUndefined();
    const bus = createAudioBus();
    expect(() => {
      bus.resume();
      bus.resume();
      for (const name of ALL_SFX) bus.play(name);
      bus.startMusic();
      bus.stopMusic();
    }).not.toThrow();
  });

  it('tracks mute state even with no context and no localStorage', () => {
    const bus = createAudioBus();
    expect(bus.isMuted()).toBe(false);
    bus.setMuted(true);
    expect(bus.isMuted()).toBe(true);
    bus.play('serve');
    bus.setMuted(false);
    expect(bus.isMuted()).toBe(false);
  });
});
