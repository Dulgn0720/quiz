import { z } from 'zod';
import { DEFAULTS, LIMITS, SUPPORTED_LOCALES } from './constants';

export const QUESTION_TYPES = [
  'single',
  'multiple',
  'true_false',
  'type_answer',
  'ordering',
  'image',
] as const;
export type QuestionType = (typeof QUESTION_TYPES)[number];

export const ROUND_TYPES = ['normal', 'speed', 'double', 'elimination'] as const;

/** Topic shelves for the quiz library. */
export const QUIZ_CATEGORIES = ['agula', 'insurance', 'mongolia', 'world', 'entertainment', 'fun', 'other'] as const;
export type QuizCategory = (typeof QUIZ_CATEGORIES)[number];

/**
 * Private quizzes are seen only by their owner (drafts, team-only quizzes);
 * public ones appear in everyone's library. Quizzes without an owner are always public.
 */
export const QUIZ_VISIBILITIES = ['private', 'public'] as const;
export type QuizVisibility = (typeof QUIZ_VISIBILITIES)[number];
export type RoundType = (typeof ROUND_TYPES)[number];

/** Question types whose answer is picked from a list of options. */
export const CHOICE_QUESTION_TYPES = ['single', 'multiple', 'image'] as const;
export type ChoiceQuestionType = (typeof CHOICE_QUESTION_TYPES)[number];

export function isChoiceQuestionType(type: QuestionType): type is ChoiceQuestionType {
  return (CHOICE_QUESTION_TYPES as readonly string[]).includes(type);
}

/**
 * Validation messages that are not plain zod defaults. The web app translates
 * these codes; the API returns them as-is.
 */
export const VALIDATION_CODES = {
  invalidUrl: 'invalid_url',
  optionEmpty: 'option_empty',
  duplicateId: 'duplicate_id',
  unknownCorrectOption: 'unknown_correct_option',
  singleCorrectRequired: 'single_correct_required',
  correctRequired: 'correct_required',
  imageRequired: 'image_required',
} as const;

/** Accepts absolute http(s) URLs and root-relative paths (e.g. `/uploads/abc.png`). */
function isAllowedUrl(value: string): boolean {
  if (value.startsWith('/') && !value.startsWith('//')) return true;
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

/** Optional field that also accepts `null` (e.g. from the DB or hand-written JSON). */
function optional<T extends z.ZodTypeAny>(schema: T) {
  return schema.nullish().transform((v) => (v ?? undefined) as z.output<T> | undefined);
}

const idSchema = z.string().trim().min(1).max(LIMITS.idMax);
const urlSchema = z
  .string()
  .trim()
  .max(LIMITS.urlMax)
  .refine(isAllowedUrl, VALIDATION_CODES.invalidUrl);

export const choiceOptionSchema = z
  .object({
    id: idSchema,
    text: z.string().trim().max(LIMITS.optionTextMax).default(''),
    imageUrl: optional(urlSchema),
  })
  .refine((o) => o.text.length > 0 || o.imageUrl !== undefined, {
    message: VALIDATION_CODES.optionEmpty,
    path: ['text'],
  });

export const orderingItemSchema = z.object({
  id: idSchema,
  text: z.string().trim().min(1).max(LIMITS.optionTextMax),
});

const questionBase = {
  id: optional(idSchema),
  prompt: z.string().trim().min(1).max(LIMITS.promptMax),
  imageUrl: optional(urlSchema),
  /** Overrides the round's time per question, in seconds. */
  timeLimit: optional(z.number().int().min(LIMITS.timeMin).max(LIMITS.timeMax)),
  basePoints: z.number().int().min(0).max(LIMITS.basePointsMax).default(DEFAULTS.basePoints),
  /** Shown to players after the answer is revealed. */
  explanation: optional(z.string().trim().max(LIMITS.explanationMax)),
};

const choiceFields = {
  options: z.array(choiceOptionSchema).min(LIMITS.optionsMin).max(LIMITS.optionsMax),
  /** Ids of the correct options. */
  correct: z.array(idSchema).max(LIMITS.optionsMax),
};

const singleQuestionSchema = z.object({ type: z.literal('single'), ...questionBase, ...choiceFields });
const multipleQuestionSchema = z.object({
  type: z.literal('multiple'),
  ...questionBase,
  ...choiceFields,
});
/** A single-choice question built around its picture; options may be images too. */
const imageQuestionSchema = z.object({ type: z.literal('image'), ...questionBase, ...choiceFields });
const trueFalseQuestionSchema = z.object({
  type: z.literal('true_false'),
  ...questionBase,
  correct: z.boolean(),
});
const typeAnswerQuestionSchema = z.object({
  type: z.literal('type_answer'),
  ...questionBase,
  acceptedAnswers: z
    .array(z.string().trim().min(1).max(LIMITS.acceptedAnswerMax))
    .min(1)
    .max(LIMITS.acceptedAnswersMax),
  caseSensitive: z.boolean().default(false),
});
const orderingQuestionSchema = z.object({
  type: z.literal('ordering'),
  ...questionBase,
  /** Items listed in their correct order. */
  items: z.array(orderingItemSchema).min(LIMITS.orderingItemsMin).max(LIMITS.orderingItemsMax),
});

function checkUniqueIds(ids: string[], path: string, ctx: z.RefinementCtx) {
  const seen = new Set<string>();
  ids.forEach((id, i) => {
    if (seen.has(id)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: VALIDATION_CODES.duplicateId, path: [path, i, 'id'] });
    }
    seen.add(id);
  });
}

export const questionSchema = z
  .discriminatedUnion('type', [
    singleQuestionSchema,
    multipleQuestionSchema,
    imageQuestionSchema,
    trueFalseQuestionSchema,
    typeAnswerQuestionSchema,
    orderingQuestionSchema,
  ])
  .superRefine((q, ctx) => {
    if (q.type === 'ordering') {
      checkUniqueIds(
        q.items.map((i) => i.id),
        'items',
        ctx,
      );
      return;
    }
    if (q.type === 'single' || q.type === 'multiple' || q.type === 'image') {
      const optionIds = q.options.map((o) => o.id);
      checkUniqueIds(optionIds, 'options', ctx);
      const known = new Set(optionIds);
      const correct = new Set(q.correct);
      if ([...correct].some((id) => !known.has(id))) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: VALIDATION_CODES.unknownCorrectOption,
          path: ['correct'],
        });
      }
      if (q.type === 'multiple') {
        if (correct.size < 1) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: VALIDATION_CODES.correctRequired,
            path: ['correct'],
          });
        }
      } else if (correct.size !== 1) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: VALIDATION_CODES.singleCorrectRequired,
          path: ['correct'],
        });
      }
      if (q.type === 'image' && q.imageUrl === undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: VALIDATION_CODES.imageRequired,
          path: ['imageUrl'],
        });
      }
    }
  });

export const roundSchema = z.object({
  id: optional(idSchema),
  name: z.string().trim().min(1).max(LIMITS.roundNameMax),
  type: z.enum(ROUND_TYPES).default('normal'),
  /** Seconds per question unless a question overrides it. */
  timePerQuestion: z
    .number()
    .int()
    .min(LIMITS.timeMin)
    .max(LIMITS.timeMax)
    .default(DEFAULTS.timePerQuestion),
  pointsMultiplier: z
    .number()
    .min(LIMITS.multiplierMin)
    .max(LIMITS.multiplierMax)
    .default(DEFAULTS.pointsMultiplier),
  shuffleQuestions: z.boolean().default(false),
  shuffleAnswers: z.boolean().default(false),
  questions: z.array(questionSchema).min(1).max(LIMITS.questionsPerRoundMax),
});

export const quizInputSchema = z.object({
  title: z.string().trim().min(1).max(LIMITS.titleMax),
  description: optional(z.string().trim().max(LIMITS.descriptionMax)),
  coverImageUrl: optional(urlSchema),
  language: z.enum(SUPPORTED_LOCALES).default('mn'),
  category: z.enum(QUIZ_CATEGORIES).default('other'),
  visibility: z.enum(QUIZ_VISIBILITIES).default('private'),
  rounds: z.array(roundSchema).min(1).max(LIMITS.roundsMax),
});

/** What clients send (defaults may be omitted, optional fields may be null). */
export type QuizInput = z.input<typeof quizInputSchema>;
export type RoundInput = z.input<typeof roundSchema>;
export type QuestionInput = z.input<typeof questionSchema>;

/** Normalized, validated quiz content. */
export type QuizContent = z.output<typeof quizInputSchema>;
export type Round = z.output<typeof roundSchema>;
export type Question = z.output<typeof questionSchema>;
export type ChoiceOption = z.output<typeof choiceOptionSchema>;
export type OrderingItem = z.output<typeof orderingItemSchema>;

export type QuestionOfType<T extends QuestionType> = Extract<Question, { type: T }>;

/** Seconds a question is shown for, honouring the per-question override. */
export function effectiveTimeLimit(round: Pick<Round, 'timePerQuestion'>, question: Pick<Question, 'timeLimit'>): number {
  return question.timeLimit ?? round.timePerQuestion;
}

export function countQuestions(quiz: Pick<QuizContent, 'rounds'>): number {
  return quiz.rounds.reduce((sum, r) => sum + r.questions.length, 0);
}
