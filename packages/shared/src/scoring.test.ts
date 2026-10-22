import { describe, expect, it } from 'vitest';
import type { Question } from './quiz';
import {
  competitionRanks,
  gameTimeLimit,
  isAnswerCorrect,
  normalizeTypedAnswer,
  scoreAnswer,
  type ScoreInput,
} from './scoring';

const base: ScoreInput = {
  correct: true,
  basePoints: 1000,
  roundType: 'normal',
  roundMultiplier: 1,
  responseMs: 0,
  timeLimitMs: 20_000,
  streak: 1,
};

describe('scoreAnswer', () => {
  it('gives nothing for a wrong answer', () => {
    expect(scoreAnswer({ ...base, correct: false, streak: 0 }).total).toBe(0);
  });

  it('adds a speed bonus of up to half the points', () => {
    expect(scoreAnswer(base)).toEqual({ base: 1000, speed: 500, streak: 0, total: 1500 });
    expect(scoreAnswer({ ...base, responseMs: 10_000 }).speed).toBe(250);
    expect(scoreAnswer({ ...base, responseMs: 20_000 }).total).toBe(1000);
    // Late answers inside the grace window never go negative.
    expect(scoreAnswer({ ...base, responseMs: 25_000 }).speed).toBe(0);
  });

  it('rewards streaks, capped at +50%', () => {
    const slow = { ...base, responseMs: 20_000 };
    expect(scoreAnswer({ ...slow, streak: 2 }).streak).toBe(100);
    expect(scoreAnswer({ ...slow, streak: 4 }).streak).toBe(300);
    expect(scoreAnswer({ ...slow, streak: 20 }).streak).toBe(500);
  });

  it('applies the round multiplier and double-points rounds', () => {
    const slow = { ...base, responseMs: 20_000 };
    expect(scoreAnswer({ ...slow, roundMultiplier: 1.5 }).total).toBe(1500);
    expect(scoreAnswer({ ...slow, roundType: 'double' }).total).toBe(2000);
    expect(scoreAnswer({ ...slow, roundType: 'double', roundMultiplier: 2 }).total).toBe(4000);
  });

  it('doubles the speed bonus in speed rounds', () => {
    expect(scoreAnswer({ ...base, roundType: 'speed', responseMs: 10_000 }).speed).toBe(500);
  });
});

describe('gameTimeLimit', () => {
  it('uses the question override, then the round default', () => {
    expect(gameTimeLimit({ type: 'normal', timePerQuestion: 20 }, { timeLimit: undefined })).toBe(20);
    expect(gameTimeLimit({ type: 'normal', timePerQuestion: 20 }, { timeLimit: 30 })).toBe(30);
  });

  it('halves time in speed rounds, but not below the minimum', () => {
    expect(gameTimeLimit({ type: 'speed', timePerQuestion: 20 }, { timeLimit: undefined })).toBe(10);
    expect(gameTimeLimit({ type: 'speed', timePerQuestion: 6 }, { timeLimit: undefined })).toBe(5);
  });
});

describe('normalizeTypedAnswer', () => {
  it('ignores case, surrounding punctuation and extra spaces', () => {
    expect(normalizeTypedAnswer('  Улаан   Баатар!  ')).toBe('улаан баатар');
    expect(normalizeTypedAnswer('"Paris."')).toBe('paris');
  });

  it('keeps case when asked to', () => {
    expect(normalizeTypedAnswer(' NaCl ', true)).toBe('NaCl');
  });
});

const common = { prompt: 'Q', basePoints: 1000 } as const;
const options = [
  { id: 'a', text: 'A' },
  { id: 'b', text: 'B' },
  { id: 'c', text: 'C' },
];

describe('isAnswerCorrect', () => {
  it('checks single and image choice', () => {
    const q: Question = { ...common, type: 'single', options, correct: ['b'] };
    expect(isAnswerCorrect(q, { type: 'single', optionIds: ['b'] })).toBe(true);
    expect(isAnswerCorrect(q, { type: 'single', optionIds: ['a'] })).toBe(false);
    expect(isAnswerCorrect(q, { type: 'true_false', value: true })).toBe(false);
  });

  it('requires exactly the correct set for multiple choice', () => {
    const q: Question = { ...common, type: 'multiple', options, correct: ['a', 'c'] };
    expect(isAnswerCorrect(q, { type: 'multiple', optionIds: ['c', 'a'] })).toBe(true);
    expect(isAnswerCorrect(q, { type: 'multiple', optionIds: ['a'] })).toBe(false);
    expect(isAnswerCorrect(q, { type: 'multiple', optionIds: ['a', 'b', 'c'] })).toBe(false);
  });

  it('checks true/false', () => {
    const q: Question = { ...common, type: 'true_false', correct: false };
    expect(isAnswerCorrect(q, { type: 'true_false', value: false })).toBe(true);
    expect(isAnswerCorrect(q, { type: 'true_false', value: true })).toBe(false);
  });

  it('matches typed answers against every accepted answer', () => {
    const q: Question = {
      ...common,
      type: 'type_answer',
      acceptedAnswers: ['Ulaanbaatar', 'Улаанбаатар'],
      caseSensitive: false,
    };
    expect(isAnswerCorrect(q, { type: 'type_answer', text: ' улаанбаатар ' })).toBe(true);
    expect(isAnswerCorrect(q, { type: 'type_answer', text: 'ULAANBAATAR.' })).toBe(true);
    expect(isAnswerCorrect(q, { type: 'type_answer', text: '' })).toBe(false);
    expect(isAnswerCorrect(q, { type: 'type_answer', text: 'Darkhan' })).toBe(false);
  });

  it('respects case-sensitive typed answers', () => {
    const q: Question = { ...common, type: 'type_answer', acceptedAnswers: ['NaCl'], caseSensitive: true };
    expect(isAnswerCorrect(q, { type: 'type_answer', text: 'NaCl' })).toBe(true);
    expect(isAnswerCorrect(q, { type: 'type_answer', text: 'nacl' })).toBe(false);
  });

  it('requires the exact order for ordering questions', () => {
    const q: Question = {
      ...common,
      type: 'ordering',
      items: [
        { id: '1', text: 'one' },
        { id: '2', text: 'two' },
        { id: '3', text: 'three' },
      ],
    };
    expect(isAnswerCorrect(q, { type: 'ordering', itemIds: ['1', '2', '3'] })).toBe(true);
    expect(isAnswerCorrect(q, { type: 'ordering', itemIds: ['2', '1', '3'] })).toBe(false);
    expect(isAnswerCorrect(q, { type: 'ordering', itemIds: ['1', '2'] })).toBe(false);
  });
});

describe('competitionRanks', () => {
  it('shares ranks on ties and skips the following ones', () => {
    expect(competitionRanks([900, 900, 500, 100, 100, 0])).toEqual([1, 1, 3, 4, 4, 6]);
    expect(competitionRanks([])).toEqual([]);
  });
});

describe('estimate questions', () => {
  const q = { type: 'estimate', prompt: 'How far?', basePoints: 1000, answer: 384, min: 0, max: 1000, step: 1, tolerance: 20 } as const;

  it('counts guesses within the tolerance as right', () => {
    expect(isAnswerCorrect(q, { type: 'estimate', value: 384 })).toBe(true);
    expect(isAnswerCorrect(q, { type: 'estimate', value: 404 })).toBe(true);
    expect(isAnswerCorrect(q, { type: 'estimate', value: 364 })).toBe(true);
    expect(isAnswerCorrect(q, { type: 'estimate', value: 405 })).toBe(false);
    expect(isAnswerCorrect(q, { type: 'true_false', value: true })).toBe(false);
  });
});
