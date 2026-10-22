import { describe, expect, it } from 'vitest';
import { SURVIVAL, survivalSeconds } from './survival';

describe('survivalSeconds', () => {
  it('starts slow, gets faster each level and never drops below the minimum', () => {
    expect(survivalSeconds(0)).toBe(SURVIVAL.startSeconds);
    expect(survivalSeconds(SURVIVAL.levelEvery - 1)).toBe(SURVIVAL.startSeconds);
    expect(survivalSeconds(SURVIVAL.levelEvery)).toBe(SURVIVAL.startSeconds - SURVIVAL.stepSeconds);
    expect(survivalSeconds(10_000)).toBe(SURVIVAL.minSeconds);
  });
});
