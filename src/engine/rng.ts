// Seeded, serialisable RNG (mulberry32). The whole run state stores the seed, so every roll replays identically.
export interface RngState { s: number }

export function makeRng(seed: number): RngState {
  return { s: seed >>> 0 || 0x9e3779b9 };
}

export function next(r: RngState): number {
  r.s = (r.s + 0x6d2b79f5) >>> 0;
  let t = r.s;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export function int(r: RngState, lo: number, hi: number): number {
  return lo + Math.floor(next(r) * (hi - lo + 1));
}

export function chance(r: RngState, p: number): boolean {
  return next(r) < p;
}

export function pick<T>(r: RngState, xs: readonly T[]): T {
  return xs[Math.floor(next(r) * xs.length)];
}

export function weighted<T>(r: RngState, xs: readonly T[], w: (x: T) => number): T {
  const total = xs.reduce((a, x) => a + Math.max(0, w(x)), 0);
  let roll = next(r) * total;
  for (const x of xs) {
    roll -= Math.max(0, w(x));
    if (roll < 0) return x;
  }
  return xs[xs.length - 1];
}

export function shuffle<T>(r: RngState, xs: T[]): T[] {
  for (let i = xs.length - 1; i > 0; i--) {
    const j = Math.floor(next(r) * (i + 1));
    [xs[i], xs[j]] = [xs[j], xs[i]];
  }
  return xs;
}

export function hashSeed(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}
