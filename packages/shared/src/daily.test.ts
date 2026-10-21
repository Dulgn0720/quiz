import { describe, expect, it } from 'vitest';
import { dailyDayKey, dailyStreak, previousDayKey } from './daily';

describe('daily question days', () => {
  it('uses Ulaanbaatar time', () => {
    expect(dailyDayKey(Date.parse('2026-10-21T15:59:00Z'))).toBe('2026-10-21');
    expect(dailyDayKey(Date.parse('2026-10-21T16:00:00Z'))).toBe('2026-10-22');
  });

  it('steps back across months and years', () => {
    expect(previousDayKey('2026-03-01')).toBe('2026-02-28');
    expect(previousDayKey('2027-01-01')).toBe('2026-12-31');
  });
});

describe('dailyStreak', () => {
  const today = '2026-10-21';

  it('counts the run ending today', () => {
    expect(dailyStreak(['2026-10-19', '2026-10-20', '2026-10-21'], 2, today)).toEqual({
      current: 3,
      best: 3,
      correctTotal: 2,
      daysTotal: 3,
    });
  });

  it('keeps yesterday’s run alive until today is over', () => {
    expect(dailyStreak(['2026-10-19', '2026-10-20'], 0, today).current).toBe(2);
  });

  it('breaks after a missed day and remembers the best run', () => {
    const s = dailyStreak(['2026-10-10', '2026-10-11', '2026-10-12', '2026-10-13', '2026-10-19', '2026-10-21'], 1, today);
    expect(s.current).toBe(1);
    expect(s.best).toBe(4);
  });

  it('is zero with no answers', () => {
    expect(dailyStreak([], 0, today)).toEqual({ current: 0, best: 0, correctTotal: 0, daysTotal: 0 });
  });
});
