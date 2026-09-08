// ─── Seeded random ──────────────────────────────────────────────────────────
// mulberry32: 32-bit state, uniform enough for order picks and fire spread, and cheap.
// The sim must never call Math.random(); every draw goes through here so a given seed
// plus input sequence replays identically on every machine.

export interface Rng {
  /** Next float in [0, 1). */
  next(): number;
  /** Integer in [0, n). Returns 0 when n <= 0. */
  int(n: number): number;
  /** Internal state, for snapshots and replays. */
  getState(): number;
  setState(state: number): void;
}

export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  const next = (): number => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    int(n: number): number {
      if (n <= 0) return 0;
      const v = Math.floor(next() * n);
      return v >= n ? n - 1 : v;
    },
    getState(): number { return a; },
    setState(state: number): void { a = state >>> 0; },
  };
}
