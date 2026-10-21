import type { Prisma, Quiz as QuizRow } from '@prisma/client';
import {
  countQuestions,
  type Locale,
  type Question,
  type QuizContent,
  type QuizDetail,
  type QuizSummary,
  type SavedQuestion,
} from '@quiz/shared';

/** Prisma include that loads a quiz with its ordered rounds and questions. */
export const QUIZ_WITH_CONTENT = {
  rounds: {
    orderBy: { position: 'asc' },
    include: { questions: { orderBy: { position: 'asc' } } },
  },
} satisfies Prisma.QuizInclude;

export type QuizWithContent = Prisma.QuizGetPayload<{ include: typeof QUIZ_WITH_CONTENT }>;
type QuestionRow = QuizWithContent['rounds'][number]['questions'][number];

/** Splits a question into its scalar columns and the type-specific `data` JSON. */
function questionToRow(question: Question, position: number) {
  const common = {
    position,
    type: question.type,
    prompt: question.prompt,
    imageUrl: question.imageUrl ?? null,
    timeLimit: question.timeLimit ?? null,
    basePoints: question.basePoints,
    explanation: question.explanation ?? null,
  };
  let data: Prisma.InputJsonObject;
  switch (question.type) {
    case 'single':
    case 'multiple':
    case 'image':
      data = {
        options: question.options.map((o) => ({
          id: o.id,
          text: o.text,
          ...(o.imageUrl ? { imageUrl: o.imageUrl } : {}),
        })),
        correct: question.correct,
      };
      break;
    case 'true_false':
      data = { correct: question.correct };
      break;
    case 'type_answer':
      data = { acceptedAnswers: question.acceptedAnswers, caseSensitive: question.caseSensitive };
      break;
    case 'ordering':
      data = { items: question.items };
      break;
  }
  return { ...common, data };
}

/** Nested `create` payload for a quiz's rounds and questions, plus denormalized counts. */
export function contentToCreateData(content: QuizContent) {
  return {
    title: content.title,
    description: content.description ?? null,
    coverImageUrl: content.coverImageUrl ?? null,
    language: content.language,
    roundCount: content.rounds.length,
    questionCount: countQuestions(content),
    rounds: {
      create: content.rounds.map((round, position) => ({
        position,
        name: round.name,
        type: round.type,
        timePerQuestion: round.timePerQuestion,
        pointsMultiplier: round.pointsMultiplier,
        shuffleQuestions: round.shuffleQuestions,
        shuffleAnswers: round.shuffleAnswers,
        questions: { create: round.questions.map((q, i) => questionToRow(q, i)) },
      })),
    },
  } satisfies Prisma.QuizCreateInput;
}

function rowToQuestion(row: QuestionRow): SavedQuestion {
  // `data` was validated by questionSchema before it was written.
  const data = row.data as Record<string, unknown>;
  return {
    id: row.id,
    type: row.type,
    prompt: row.prompt,
    imageUrl: row.imageUrl ?? undefined,
    timeLimit: row.timeLimit ?? undefined,
    basePoints: row.basePoints,
    explanation: row.explanation ?? undefined,
    ...data,
  } as unknown as SavedQuestion;
}

export function toQuizSummary(row: QuizRow): QuizSummary {
  return {
    id: row.id,
    title: row.title,
    description: row.description ?? undefined,
    coverImageUrl: row.coverImageUrl ?? undefined,
    language: row.language as Locale,
    isSample: row.isSample,
    roundCount: row.roundCount,
    questionCount: row.questionCount,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toQuizDetail(row: QuizWithContent): QuizDetail {
  return {
    id: row.id,
    title: row.title,
    description: row.description ?? undefined,
    coverImageUrl: row.coverImageUrl ?? undefined,
    language: row.language as Locale,
    isSample: row.isSample,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    rounds: row.rounds.map((round) => ({
      id: round.id,
      name: round.name,
      type: round.type,
      timePerQuestion: round.timePerQuestion,
      pointsMultiplier: round.pointsMultiplier,
      shuffleQuestions: round.shuffleQuestions,
      shuffleAnswers: round.shuffleAnswers,
      questions: round.questions.map(rowToQuestion),
    })),
  };
}

/** The editable content of a saved quiz (what export and duplicate work from). */
export function toQuizContent(detail: QuizDetail): QuizContent {
  return {
    title: detail.title,
    description: detail.description,
    coverImageUrl: detail.coverImageUrl,
    language: detail.language,
    rounds: detail.rounds,
  };
}
