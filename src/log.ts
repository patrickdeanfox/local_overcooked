import { DEBUG } from './config';

// DEBUG-gated logger. Never call console.* directly elsewhere.
export const log = {
  info: (...args: unknown[]): void => { if (DEBUG) console.log('[oc]', ...args); },
  warn: (...args: unknown[]): void => { if (DEBUG) console.warn('[oc]', ...args); },
  error: (...args: unknown[]): void => { if (DEBUG) console.error('[oc]', ...args); },
};
