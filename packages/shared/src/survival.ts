import type { SavedQuestion } from './api';

/**
 * «Амьд үлдэх» (survival): a solo mode with endless random questions from the
 * official library. Three lives; a wrong answer or the clock running out costs
 * one; every few right answers in a row win one back; the clock gets shorter.
 */
export const SURVIVAL = {
  lives: 3,
  maxLives: 3,
  /** Right answers in a row that give a life back. */
  lifeEvery: 5,
  /** Seconds per question, shrinking every `levelEvery` questions down to `minSeconds`. */
  startSeconds: 20,
  minSeconds: 8,
  stepSeconds: 2,
  levelEvery: 8,
  /** Questions fetched per batch. */
  batch: 40,
} as const;

/** Seconds for the n-th question (0-based) of a survival run. */
export function survivalSeconds(index: number): number {
  const level = Math.floor(index / SURVIVAL.levelEvery);
  return Math.max(SURVIVAL.minSeconds, SURVIVAL.startSeconds - level * SURVIVAL.stepSeconds);
}

export interface SurvivalQuestion {
  quizTitle: string;
  question: SavedQuestion;
}

export interface SurvivalBatch {
  questions: SurvivalQuestion[];
}
