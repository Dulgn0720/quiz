import { dailyStreak, type DailyResult, type DailyStreak } from '@quiz/shared';

/** A guest's daily-question history, kept in this browser only. */
interface GuestDaily {
  days: string[];
  correct: number;
  /** The latest answer, so a reload shows today's result. */
  last?: { day: string; result: DailyResult };
}

const KEY = 'quiz-pro:daily';

function read(): GuestDaily {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) ?? 'null') as GuestDaily | null;
    if (parsed && Array.isArray(parsed.days)) return parsed;
  } catch {
    // Private mode or bad data: start over.
  }
  return { days: [], correct: 0 };
}

export function guestDaily(today: string): { result?: DailyResult; streak: DailyStreak } {
  const data = read();
  return {
    result: data.last?.day === today ? data.last.result : undefined,
    streak: dailyStreak(data.days, data.correct, today),
  };
}

export function saveGuestDaily(today: string, result: DailyResult): DailyStreak {
  const data = read();
  if (!data.days.includes(today)) {
    // Enough history for the longest streak anyone keeps up as a guest.
    data.days = [...data.days, today].slice(-400);
    if (result.correct) data.correct++;
    data.last = { day: today, result };
    try {
      localStorage.setItem(KEY, JSON.stringify(data));
    } catch {
      // Not saved: the streak just restarts next time.
    }
  }
  return dailyStreak(data.days, data.correct, today);
}
