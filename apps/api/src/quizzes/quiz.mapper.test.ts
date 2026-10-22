import type { Prisma } from '@prisma/client';
import { quizInputSchema } from '@quiz/shared';
import { describe, expect, it } from 'vitest';
import { LIBRARY_QUIZZES as SAMPLE_QUIZZES } from '../database/library';
import { contentToCreateData, toQuizContent, toQuizDetail, type QuizWithContent } from './quiz.mapper';

/** Builds what Prisma would return after `contentToCreateData` was written. */
function fakeRow(id: string, data: ReturnType<typeof contentToCreateData>): QuizWithContent {
  const now = new Date('2026-01-01T00:00:00Z');
  return {
    id,
    title: data.title,
    description: data.description,
    coverImageUrl: data.coverImageUrl,
    language: data.language,
    category: data.category,
    visibility: data.visibility,
    isSample: false,
    roundCount: data.roundCount,
    questionCount: data.questionCount,
    ownerId: null,
    owner: null,
    createdAt: now,
    updatedAt: now,
    rounds: data.rounds.create.map((round, ri) => ({
      ...round,
      id: `r${ri}`,
      quizId: id,
      questions: round.questions.create.map((q, qi) => ({
        ...q,
        data: q.data as Prisma.JsonValue,
        id: `r${ri}q${qi}`,
        roundId: `r${ri}`,
      })),
    })),
  };
}

describe('quiz mapper', () => {
  it.each(SAMPLE_QUIZZES.map((s) => [s.id, s.quiz] as const))(
    'round-trips %s through the database shape',
    (id, quiz) => {
      const content = quizInputSchema.parse(quiz);
      const data = contentToCreateData(content);
      expect(data.questionCount).toBe(content.rounds.reduce((n, r) => n + r.questions.length, 0));

      const detail = toQuizDetail(fakeRow(id, data));
      expect(detail.rounds.every((r) => r.id && r.questions.every((q) => q.id))).toBe(true);
      // Re-validating what we read back must give the original content (ids aside).
      const reread = quizInputSchema.parse(toQuizContent(detail));
      const strip = (c: typeof content) =>
        JSON.parse(JSON.stringify(c, (k, v) => (k === 'id' && /^r\d/.test(String(v)) ? undefined : v)));
      expect(strip(reread)).toEqual(strip(content));
    },
  );
});
