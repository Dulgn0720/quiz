import { LIMITS } from './constants';
import type { AnswerPayload } from './game';
import type { Question, Round, RoundType } from './quiz';

/**
 * Scoring rules for live games. Pure functions: the server uses them to score
 * answers, the web app uses the constants to explain the rules.
 *
 *   scaled  = basePoints × round multiplier × (2 in a double-points round)
 *   points  = scaled + speed bonus + streak bonus          (0 when wrong)
 *   speed   = scaled × speedShare × (time left / time limit)
 *   streak  = scaled × min(streakStep × (streak − 1), streakMax)
 */
export const SCORING = {
  /** Share of the scaled points a correct answer can earn on top for being fast. */
  speedBonusShare: 0.5,
  /** Speed rounds reward pace twice as much… */
  speedRoundBonusShare: 1,
  /** …and halve the time per question. */
  speedRoundTimeFactor: 0.5,
  doubleRoundFactor: 2,
  /** Extra share per consecutive correct answer after the first. */
  streakStep: 0.1,
  streakMax: 0.5,
} as const;

/** Seconds a question is open for in a live game (speed rounds are shorter). */
export function gameTimeLimit(
  round: Pick<Round, 'timePerQuestion' | 'type'>,
  question: Pick<Question, 'timeLimit'>,
): number {
  const seconds = question.timeLimit ?? round.timePerQuestion;
  if (round.type !== 'speed') return seconds;
  return Math.max(LIMITS.timeMin, Math.ceil(seconds * SCORING.speedRoundTimeFactor));
}

/**
 * Canonical form of a typed answer: Unicode-normalized, surrounding
 * punctuation stripped, runs of whitespace collapsed and, unless the question
 * is case sensitive, lower-cased.
 */
export function normalizeTypedAnswer(value: string, caseSensitive = false): string {
  const text = value
    .normalize('NFKC')
    .replace(/\s+/g, ' ')
    .replace(/^[\s.,!?;:'"«»“”‘’()-]+|[\s.,!?;:'"«»“”‘’()-]+$/g, '');
  return caseSensitive ? text : text.toLocaleLowerCase();
}

function sameSet(a: readonly string[], b: readonly string[]): boolean {
  const left = new Set(a);
  const right = new Set(b);
  return left.size === right.size && [...left].every((id) => right.has(id));
}

/**
 * Whether an answer is fully correct. Answers whose shape does not match the
 * question type are simply wrong. Multiple choice and ordering are
 * all-or-nothing, like Kahoot.
 */
export function isAnswerCorrect(question: Question, answer: AnswerPayload): boolean {
  switch (question.type) {
    case 'single':
    case 'image':
    case 'multiple':
      if (answer.type !== question.type) return false;
      return sameSet(answer.optionIds, question.correct);
    case 'true_false':
      return answer.type === 'true_false' && answer.value === question.correct;
    case 'type_answer': {
      if (answer.type !== 'type_answer') return false;
      const given = normalizeTypedAnswer(answer.text, question.caseSensitive);
      if (!given) return false;
      return question.acceptedAnswers.some((a) => normalizeTypedAnswer(a, question.caseSensitive) === given);
    }
    case 'ordering':
      return (
        answer.type === 'ordering' &&
        answer.itemIds.length === question.items.length &&
        question.items.every((item, i) => answer.itemIds[i] === item.id)
      );
    case 'estimate':
      return answer.type === 'estimate' && Math.abs(answer.value - question.answer) <= question.tolerance + 1e-9;
  }
}

export interface ScoreInput {
  correct: boolean;
  basePoints: number;
  roundType: RoundType;
  roundMultiplier: number;
  /** Milliseconds between the question opening and the answer arriving (pauses excluded). */
  responseMs: number;
  timeLimitMs: number;
  /** Consecutive correct answers including this one (0 when wrong). */
  streak: number;
}

export interface ScoreBreakdown {
  base: number;
  speed: number;
  streak: number;
  /** Extra points from the double-points power-up. */
  boost?: number;
  total: number;
}

export function scoreAnswer(input: ScoreInput): ScoreBreakdown {
  if (!input.correct) return { base: 0, speed: 0, streak: 0, total: 0 };
  const roundFactor = input.roundType === 'double' ? SCORING.doubleRoundFactor : 1;
  const scaled = input.basePoints * input.roundMultiplier * roundFactor;
  const share = input.roundType === 'speed' ? SCORING.speedRoundBonusShare : SCORING.speedBonusShare;
  const timeLeft = input.timeLimitMs > 0 ? 1 - input.responseMs / input.timeLimitMs : 0;
  const speedFactor = Math.min(1, Math.max(0, timeLeft));
  const streakShare = Math.min(SCORING.streakStep * Math.max(0, input.streak - 1), SCORING.streakMax);

  const base = Math.round(scaled);
  const speed = Math.round(scaled * share * speedFactor);
  const streak = Math.round(scaled * streakShare);
  return { base, speed, streak, total: base + speed + streak };
}

/**
 * Standard competition ranking ("1, 1, 3"): items must already be sorted by
 * score, highest first. Returns the rank of each item, in the same order.
 */
export function competitionRanks(sortedScores: readonly number[]): number[] {
  const ranks: number[] = [];
  sortedScores.forEach((score, i) => {
    ranks.push(i > 0 && score === sortedScores[i - 1] ? ranks[i - 1]! : i + 1);
  });
  return ranks;
}
