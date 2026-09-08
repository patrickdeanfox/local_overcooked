// STUB: art+audio agent replaces with a Web Audio synthesiser. Keep createAudioBus() and sfxForEvent().
import type { SimEvent } from '../sim/types';
import type { AudioBus, SfxName } from './types';
export * from './types';

export function createAudioBus(): AudioBus {
  let muted = false;
  return {
    resume: () => {},
    play: (_name: SfxName) => {},
    startMusic: () => {},
    stopMusic: () => {},
    setMuted: (m) => { muted = m; },
    isMuted: () => muted,
  };
}

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
    default: return null;
  }
}
