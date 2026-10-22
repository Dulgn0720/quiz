import { describe, expect, it } from 'vitest';
import { createRng, hashSeed, seededShuffle, shuffle, shuffleAwayFromIdentity } from './random';

describe('createRng', () => {
  it('is deterministic for a seed and stays in [0, 1)', () => {
    const a = createRng('game-1');
    const b = createRng('game-1');
    for (let i = 0; i < 1000; i++) {
      const value = a();
      expect(value).toBe(b());
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });

  it('differs between seeds', () => {
    expect(createRng('a')()).not.toBe(createRng('b')());
    expect(hashSeed('a')).not.toBe(hashSeed('b'));
  });
});

describe('shuffle', () => {
  it('returns a permutation and leaves the input untouched', () => {
    const input = [1, 2, 3, 4, 5, 6];
    const out = shuffle(input, createRng(42));
    expect(input).toEqual([1, 2, 3, 4, 5, 6]);
    expect([...out].sort()).toEqual(input);
  });

  it('repeats the same order for the same seed', () => {
    const items = ['a', 'b', 'c', 'd', 'e'];
    expect(seededShuffle(items, 'seed:q1:p1')).toEqual(seededShuffle(items, 'seed:q1:p1'));
  });

  it('is unbiased: every item lands in every position about equally often', () => {
    const rng = createRng('bias');
    const counts = [0, 0, 0, 0].map(() => [0, 0, 0, 0]);
    const runs = 40_000;
    for (let i = 0; i < runs; i++) {
      shuffle([0, 1, 2, 3], rng).forEach((item, position) => counts[item]![position]!++);
    }
    for (const row of counts) {
      for (const n of row) expect(Math.abs(n / runs - 0.25)).toBeLessThan(0.01);
    }
  });
});

describe('shuffleAwayFromIdentity', () => {
  it('never returns the original order', () => {
    const items = ['first', 'second'];
    for (let i = 0; i < 200; i++) {
      expect(shuffleAwayFromIdentity(items, `seed-${i}`)).toEqual(['second', 'first']);
    }
  });

  it('keeps single items as they are', () => {
    expect(shuffleAwayFromIdentity(['only'], 'x')).toEqual(['only']);
  });
});
