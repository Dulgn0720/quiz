/**
 * Deterministic randomness for shuffling. The same seed always produces the
 * same order, so a game (or a player within it) can be replayed or restored
 * after a server restart without storing every permutation.
 */

/** A function returning floats in [0, 1), like `Math.random`. */
export type Rng = () => number;

/** 32-bit FNV-1a hash of a string, used to turn seeds like `game:player:question` into numbers. */
export function hashSeed(value: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/** Mulberry32: tiny, fast and good enough for shuffling (not for cryptography). */
export function createRng(seed: number | string): Rng {
  let state = typeof seed === 'string' ? hashSeed(seed) : seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Unbiased Fisher–Yates shuffle. Returns a new array; the input is left untouched. */
export function shuffle<T>(items: readonly T[], rng: Rng = Math.random): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

/** Shuffle with a string seed. */
export function seededShuffle<T>(items: readonly T[], seed: string): T[] {
  return shuffle(items, createRng(seed));
}

/**
 * Shuffles items for an ordering question so they never arrive already in
 * the correct order (which would make the question free).
 */
export function shuffleAwayFromIdentity<T>(items: readonly T[], seed: string): T[] {
  if (items.length < 2) return items.slice();
  const rng = createRng(seed);
  for (let attempt = 0; attempt < 8; attempt++) {
    const out = shuffle(items, rng);
    if (out.some((item, i) => item !== items[i])) return out;
  }
  // Astronomically unlikely; rotate by one as a guaranteed fallback.
  return [...items.slice(1), items[0]!];
}
