import type { Prisma } from '@prisma/client';
import {
  countQuestions,
  type Locale,
  type QuizCategory,
  type Question,
  type QuizContent,
  type QuizDetail,
  type QuizSummary,
  type SavedQuestion,
} from '@quiz/shared';

/** Author name and number of finished games, for library cards. */
export const QUIZ_SUMMARY_INCLUDE = {
  owner: { select: { displayName: true } },
  _count: { select: { games: { where: { status: 'finished' } } } },
} satisfies Prisma.QuizInclude;

/** Prisma include that loads a quiz with its ordered rounds and questions. */
export const QUIZ_WITH_CONTENT = {
  owner: { select: { displayName: true } },
  rounds: {
    orderBy: { position: 'asc' },
    include: { questions: { orderBy: { position: 'asc' } } },
  },
} satisfies Prisma.QuizInclude;

export type QuizSummaryRow = Prisma.QuizGetPayload<{ include: typeof QUIZ_SUMMARY_INCLUDE }>;

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
    case 'estimate':
      data = {
        answer: question.answer,
        min: question.min,
        max: question.max,
        step: question.step,
        tolerance: question.tolerance,
        ...(question.unit ? { unit: question.unit } : {}),
      };
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
    category: content.category,
    visibility: content.visibility,
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

export function rowToQuestion(row: QuestionRow): SavedQuestion {
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

export function toQuizSummary(row: QuizSummaryRow): QuizSummary {
  return {
    id: row.id,
    title: row.title,
    description: row.description ?? undefined,
    coverImageUrl: row.coverImageUrl ?? undefined,
    language: row.language as Locale,
    isSample: row.isSample,
    ownerId: row.ownerId ?? undefined,
    authorName: row.owner?.displayName,
    category: row.category as QuizCategory,
    visibility: row.visibility,
    playCount: row._count.games,
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
    category: row.category as QuizCategory,
    visibility: row.visibility,
    isSample: row.isSample,
    ownerId: row.ownerId ?? undefined,
    authorName: row.owner?.displayName,
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
    category: detail.category,
    visibility: detail.visibility,
    rounds: detail.rounds,
  };
}
