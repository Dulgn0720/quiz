import { quizInputSchema } from '@quiz/shared';
import { describe, expect, it } from 'vitest';
import { SAMPLE_QUIZZES } from './sample-quizzes';

describe('sample quizzes', () => {
  it.each(SAMPLE_QUIZZES.map((s) => [s.id, s.quiz] as const))('%s is valid', (_id, quiz) => {
    const result = quizInputSchema.safeParse(quiz);
    expect(result.success ? [] : result.error.issues).toEqual([]);
  });

  it('have unique ids', () => {
    const ids = SAMPLE_QUIZZES.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
