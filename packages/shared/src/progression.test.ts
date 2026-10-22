import { describe, expect, it } from 'vitest';
import { levelForXp, levelProgress, qualifyingBadges, xpForGame, xpToReach, type BadgeContext } from './progression';

describe('levels', () => {
  it('needs 100, 300, 600, 1000 XP for levels 2–5', () => {
    expect([1, 2, 3, 4, 5].map(xpToReach)).toEqual([0, 100, 300, 600, 1000]);
  });

  it('maps XP to levels at the boundaries', () => {
    expect(levelForXp(0)).toBe(1);
    expect(levelForXp(99)).toBe(1);
    expect(levelForXp(100)).toBe(2);
    expect(levelForXp(299)).toBe(2);
    expect(levelForXp(1000)).toBe(5);
    expect(levelForXp(10 ** 9)).toBe(100);
  });

  it('reports progress inside a level', () => {
    expect(levelProgress(400)).toEqual({ level: 3, current: 100, needed: 300, fraction: 1 / 3 });
    expect(levelProgress(10 ** 9).fraction).toBe(1);
  });
});

describe('xpForGame', () => {
  it('adds participation, correct answers, points and placement', () => {
    expect(xpForGame({ score: 4000, rank: 1, playerCount: 5, correctCount: 4 })).toBe(25 + 40 + 20 + 100);
    expect(xpForGame({ score: 0, rank: 4, playerCount: 5, correctCount: 0 })).toBe(25);
  });

  it('gives no placement bonus in a solo game', () => {
    expect(xpForGame({ score: 0, rank: 1, playerCount: 1, correctCount: 0 })).toBe(25);
  });
});

describe('qualifyingBadges', () => {
  const base: BadgeContext = { gamesPlayed: 1, quizzesCreated: 0, gamesHosted: 0, level: 1 };

  it('awards the first game badge', () => {
    expect(qualifyingBadges(base)).toEqual(['first_game']);
  });

  it('awards game achievements', () => {
    const codes = qualifyingBadges({
      ...base,
      game: {
        rank: 1,
        playerCount: 3,
        correctCount: 10,
        questionCount: 10,
        answerCount: 10,
        bestStreak: 10,
        avgResponseMs: 2500,
      },
    });
    expect(codes).toEqual(
      expect.arrayContaining(['first_win', 'podium', 'perfect', 'streak_5', 'streak_10', 'speedster']),
    );
  });

  it('does not reward a solo win or a short perfect game', () => {
    const codes = qualifyingBadges({
      ...base,
      game: { rank: 1, playerCount: 1, correctCount: 3, questionCount: 3, answerCount: 3, bestStreak: 3, avgResponseMs: 9000 },
    });
    expect(codes).toEqual(['first_game']);
  });

  it('awards creator, host and level badges', () => {
    expect(qualifyingBadges({ ...base, gamesPlayed: 0, quizzesCreated: 1, gamesHosted: 1, level: 10 })).toEqual([
      'quiz_maker',
      'host',
      'level_5',
      'level_10',
    ]);
  });
});
