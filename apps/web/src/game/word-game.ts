import { dailyDayKey, seededShuffle } from '@quiz/shared';
import { WORDS, type WordEntry } from './words';

/**
 * «Үг таах»: guess a five-letter Mongolian word in six tries. Green letters are
 * in the right place, yellow ones are in the word elsewhere. Everyone gets the
 * same word each day (Ulaanbaatar time); after that, free play picks random words.
 */
export const WORD_LENGTH = 5;
export const MAX_GUESSES = 6;
/** A hint appears after this many wrong guesses. */
export const HINT_AFTER = 3;

export const MONGOLIAN_LETTERS = 'абвгдеёжзийклмноөпрстуүфхцчшщъыьэюя';

/** On-screen keyboard in the Mongolian layout. */
export const KEYBOARD_ROWS = ['фцужэнгшүзкъ', 'йыбөахролдпе', 'ячёсмитьвющ'];

export type LetterState = 'hit' | 'near' | 'miss';

export function normalizeWord(input: string): string {
  return input.trim().toLowerCase();
}

export function isLetter(key: string): boolean {
  return key.length === 1 && MONGOLIAN_LETTERS.includes(key.toLowerCase());
}

/** Wordle colouring, counting repeated letters only as often as the answer has them. */
export function scoreGuess(guess: string, answer: string): LetterState[] {
  const g = [...guess];
  const a = [...answer];
  const result: LetterState[] = g.map(() => 'miss');
  const left = new Map<string, number>();
  g.forEach((letter, i) => {
    if (letter === a[i]) result[i] = 'hit';
    else left.set(a[i]!, (left.get(a[i]!) ?? 0) + 1);
  });
  g.forEach((letter, i) => {
    if (result[i] === 'hit') return;
    const n = left.get(letter) ?? 0;
    if (n > 0) {
      result[i] = 'near';
      left.set(letter, n - 1);
    }
  });
  return result;
}

const RANK: Record<LetterState, number> = { miss: 0, near: 1, hit: 2 };

/** The best state seen for each letter so far, for the keyboard. */
export function keyboardStates(guesses: readonly string[], answer: string): Map<string, LetterState> {
  const states = new Map<string, LetterState>();
  for (const guess of guesses) {
    scoreGuess(guess, answer).forEach((state, i) => {
      const letter = guess[i]!;
      const prev = states.get(letter);
      if (!prev || RANK[state] > RANK[prev]) states.set(letter, state);
    });
  }
  return states;
}

const EPOCH = Date.UTC(2026, 0, 1);
const ORDER = seededShuffle(WORDS, 'agula-word-game');

/** Today's word: a fixed shuffle of the list, one word per day, repeating after the whole list. */
export function dailyWord(day: string = dailyDayKey()): WordEntry {
  const n = Math.floor((Date.parse(`${day}T00:00:00Z`) - EPOCH) / 86_400_000);
  const len = ORDER.length;
  return ORDER[((n % len) + len) % len]!;
}

export function randomWord(except?: string): WordEntry {
  for (;;) {
    const entry = WORDS[Math.floor(Math.random() * WORDS.length)]!;
    if (entry.word !== except || WORDS.length < 2) return entry;
  }
}

/** Emoji grid for sharing, without the letters so it spoils nothing. */
export function shareText(day: string, guesses: readonly string[], answer: string, won: boolean): string {
  const rows = guesses.map((g) =>
    scoreGuess(g, answer)
      .map((s) => (s === 'hit' ? '🟩' : s === 'near' ? '🟨' : '⬜'))
      .join(''),
  );
  return [`Үг таах ${day} ${won ? guesses.length : 'X'}/${MAX_GUESSES}`, '', ...rows].join('\n');
}

export interface WordStats {
  played: number;
  wins: number;
  streak: number;
  best: number;
  /** Wins by number of guesses (index 0 = first try). */
  distribution: number[];
  lastDay?: string;
  /** Today's guesses, so a reload keeps the board. */
  today?: { day: string; guesses: string[] };
}

const KEY = 'quiz-pro:word-game';

export function emptyStats(): WordStats {
  return { played: 0, wins: 0, streak: 0, best: 0, distribution: Array(MAX_GUESSES).fill(0) };
}

export function loadStats(): WordStats {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) ?? 'null') as WordStats | null;
    if (parsed && Array.isArray(parsed.distribution)) return { ...emptyStats(), ...parsed };
  } catch {
    // Private mode or bad data: start over.
  }
  return emptyStats();
}

export function saveStats(stats: WordStats): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(stats));
  } catch {
    // Storage full or blocked: the game still works, it just forgets.
  }
}

/** Stats after the daily game ends. A streak continues only from yesterday's win. */
export function recordDaily(stats: WordStats, day: string, yesterday: string, guesses: number, won: boolean): WordStats {
  if (stats.lastDay === day) return stats;
  const distribution = [...stats.distribution];
  if (won) distribution[guesses - 1] = (distribution[guesses - 1] ?? 0) + 1;
  const streak = won ? (stats.lastDay === yesterday ? stats.streak + 1 : 1) : 0;
  return {
    ...stats,
    played: stats.played + 1,
    wins: stats.wins + (won ? 1 : 0),
    streak,
    best: Math.max(stats.best, streak),
    distribution,
    lastDay: day,
  };
}
