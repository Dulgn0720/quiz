import { z } from 'zod';

/**
 * «Өдрийн асуулт»: one question a day, the same for everyone, picked from the
 * official library. Days follow Ulaanbaatar time (UTC+8, no daylight saving).
 */
export const DAILY_UTC_OFFSET_HOURS = 8;

/** XP for answering the daily question (signed-in players). */
export const DAILY_XP = { answered: 5, correct: 15 } as const;

/** YYYY-MM-DD of a moment in Ulaanbaatar. */
export function dailyDayKey(at: Date | number = Date.now()): string {
  const ms = typeof at === 'number' ? at : at.getTime();
  return new Date(ms + DAILY_UTC_OFFSET_HOURS * 3_600_000).toISOString().slice(0, 10);
}

/** The day before a YYYY-MM-DD key. */
export function previousDayKey(day: string): string {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

export interface DailyStreak {
  /** Days in a row with an answer, up to today (or yesterday while today is still open). */
  current: number;
  best: number;
  correctTotal: number;
  daysTotal: number;
}

/** Streak figures from the days a player answered (any order) and how many they got right. */
export function dailyStreak(days: readonly string[], correctTotal: number, today: string): DailyStreak {
  const set = new Set(days);
  let current = 0;
  let cursor = set.has(today) ? today : previousDayKey(today);
  while (set.has(cursor)) {
    current++;
    cursor = previousDayKey(cursor);
  }
  let best = 0;
  let run = 0;
  let last: string | undefined;
  for (const day of [...set].sort()) {
    run = last !== undefined && previousDayKey(day) === last ? run + 1 : 1;
    best = Math.max(best, run);
    last = day;
  }
  return { current, best, correctTotal, daysTotal: set.size };
}

/** An option id for single choice, `true` / `false` for true/false. */
export const dailyAnswerSchema = z.object({ answer: z.string().trim().min(1).max(64) });
export type DailyAnswerInput = z.infer<typeof dailyAnswerSchema>;

export interface DailyResult {
  answer: string;
  correct: boolean;
  correctAnswer: string;
  explanation?: string;
  /** XP earned (signed-in players). */
  xp: number;
}

export interface DailyQuestion {
  day: string;
  quizTitle: string;
  type: 'single' | 'true_false';
  prompt: string;
  imageUrl?: string;
  options?: { id: string; text: string; imageUrl?: string }[];
  /** Set once the signed-in player has answered today. */
  result?: DailyResult;
  /** Signed-in players only; guests keep theirs in the browser. */
  streak?: DailyStreak;
}

export interface DailyAnswerResponse {
  result: DailyResult;
  streak?: DailyStreak;
}
