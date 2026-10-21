import {
  DEFAULTS,
  LIMITS,
  formatIssuePath,
  isChoiceQuestionType,
  quizInputSchema,
  type Locale,
  type Question,
  type QuestionInput,
  type QuestionType,
  type QuizDetail,
  type QuizCategory,
  type QuizInput,
  type QuizVisibility,
  type RoundType,
} from '@quiz/shared';
import type { ZodIssue } from 'zod';

/**
 * The editor works on a "draft": a flat, always-complete shape that keeps the
 * fields of every question type, so switching a question's type never loses
 * what was typed. It is converted to the API's QuizInput on save/validate.
 */

export interface DraftOption {
  id: string;
  text: string;
  imageUrl: string;
}

export interface DraftItem {
  id: string;
  text: string;
}

export interface DraftQuestion {
  /** Stable key for list rendering; not sent to the API. */
  key: string;
  type: QuestionType;
  prompt: string;
  imageUrl: string;
  /** Empty string when the input is cleared (v-model.number). */
  timeLimit: number | '' | null;
  basePoints: number | '';
  explanation: string;
  options: DraftOption[];
  correct: string[];
  trueFalse: boolean;
  acceptedAnswers: string[];
  caseSensitive: boolean;
  items: DraftItem[];
}

export interface DraftRound {
  key: string;
  name: string;
  type: RoundType;
  timePerQuestion: number | '';
  pointsMultiplier: number | '';
  shuffleQuestions: boolean;
  shuffleAnswers: boolean;
  questions: DraftQuestion[];
}

export interface DraftQuiz {
  title: string;
  description: string;
  coverImageUrl: string;
  language: Locale;
  category: QuizCategory;
  visibility: QuizVisibility;
  rounds: DraftRound[];
}

export function uid(): string {
  return Math.random().toString(36).slice(2, 10);
}

export function createOption(text = ''): DraftOption {
  return { id: uid(), text, imageUrl: '' };
}

export function createItem(text = ''): DraftItem {
  return { id: uid(), text };
}

export function createQuestion(type: QuestionType = 'single'): DraftQuestion {
  return {
    key: uid(),
    type,
    prompt: '',
    imageUrl: '',
    timeLimit: null,
    basePoints: DEFAULTS.basePoints,
    explanation: '',
    options: Array.from({ length: 4 }, () => createOption()),
    correct: [],
    trueFalse: true,
    acceptedAnswers: [''],
    caseSensitive: false,
    items: Array.from({ length: 4 }, () => createItem()),
  };
}

export function createRound(name: string): DraftRound {
  return {
    key: uid(),
    name,
    type: 'normal',
    timePerQuestion: DEFAULTS.timePerQuestion,
    pointsMultiplier: DEFAULTS.pointsMultiplier,
    shuffleQuestions: false,
    shuffleAnswers: false,
    questions: [createQuestion()],
  };
}

export function createQuiz(language: Locale, firstRoundName: string): DraftQuiz {
  return {
    title: '',
    description: '',
    coverImageUrl: '',
    language,
    category: 'other',
    visibility: 'private',
    rounds: [createRound(firstRoundName)],
  };
}

export function cloneQuestion(question: DraftQuestion): DraftQuestion {
  return { ...structuredClone(question), key: uid() };
}

export function questionToDraft(question: Question): DraftQuestion {
  const draft = createQuestion(question.type);
  draft.prompt = question.prompt;
  draft.imageUrl = question.imageUrl ?? '';
  draft.timeLimit = question.timeLimit ?? null;
  draft.basePoints = question.basePoints;
  draft.explanation = question.explanation ?? '';
  switch (question.type) {
    case 'single':
    case 'multiple':
    case 'image':
      draft.options = question.options.map((o) => ({ id: o.id, text: o.text, imageUrl: o.imageUrl ?? '' }));
      draft.correct = [...question.correct];
      break;
    case 'true_false':
      draft.trueFalse = question.correct;
      break;
    case 'type_answer':
      draft.acceptedAnswers = [...question.acceptedAnswers];
      draft.caseSensitive = question.caseSensitive;
      break;
    case 'ordering':
      draft.items = question.items.map((i) => ({ ...i }));
      break;
  }
  return draft;
}

export function detailToDraft(detail: QuizDetail): DraftQuiz {
  return {
    title: detail.title,
    description: detail.description ?? '',
    coverImageUrl: detail.coverImageUrl ?? '',
    language: detail.language,
    category: detail.category,
    visibility: detail.visibility,
    rounds: detail.rounds.map((round) => ({
      key: uid(),
      name: round.name,
      type: round.type,
      timePerQuestion: round.timePerQuestion,
      pointsMultiplier: round.pointsMultiplier,
      shuffleQuestions: round.shuffleQuestions,
      shuffleAnswers: round.shuffleAnswers,
      questions: round.questions.map(questionToDraft),
    })),
  };
}

/** Cleared number inputs become NaN so validation reports them instead of silently defaulting. */
function requiredNumber(value: number | ''): number {
  return value === '' ? Number.NaN : value;
}

function optionalText(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
}

export function draftQuestionToInput(q: DraftQuestion): QuestionInput {
  const base = {
    prompt: q.prompt,
    imageUrl: optionalText(q.imageUrl),
    timeLimit: q.timeLimit === null || q.timeLimit === '' ? undefined : q.timeLimit,
    basePoints: requiredNumber(q.basePoints),
    explanation: optionalText(q.explanation),
  };
  switch (q.type) {
    case 'single':
    case 'multiple':
    case 'image':
      return {
        type: q.type,
        ...base,
        options: q.options.map((o) => ({ id: o.id, text: o.text, imageUrl: optionalText(o.imageUrl) })),
        correct: q.correct.filter((id) => q.options.some((o) => o.id === id)),
      };
    case 'true_false':
      return { type: q.type, ...base, correct: q.trueFalse };
    case 'type_answer':
      return { type: q.type, ...base, acceptedAnswers: q.acceptedAnswers, caseSensitive: q.caseSensitive };
    case 'ordering':
      return { type: q.type, ...base, items: q.items };
  }
}

export function draftToInput(draft: DraftQuiz): QuizInput {
  return {
    title: draft.title,
    description: optionalText(draft.description),
    coverImageUrl: optionalText(draft.coverImageUrl),
    language: draft.language,
    category: draft.category,
    visibility: draft.visibility,
    rounds: draft.rounds.map((round) => ({
      name: round.name,
      type: round.type,
      timePerQuestion: requiredNumber(round.timePerQuestion),
      pointsMultiplier: requiredNumber(round.pointsMultiplier),
      shuffleQuestions: round.shuffleQuestions,
      shuffleAnswers: round.shuffleAnswers,
      questions: round.questions.map(draftQuestionToInput),
    })),
  };
}

/** Switches a question's type in place, keeping its content valid for the new type. */
export function changeQuestionType(q: DraftQuestion, type: QuestionType): void {
  q.type = type;
  if (isChoiceQuestionType(type)) {
    while (q.options.length < LIMITS.optionsMin) q.options.push(createOption());
    if (type !== 'multiple' && q.correct.length > 1) q.correct = q.correct.slice(0, 1);
  }
  if (type === 'ordering') {
    while (q.items.length < LIMITS.orderingItemsMin) q.items.push(createItem());
  }
  if (type === 'type_answer' && q.acceptedAnswers.length === 0) q.acceptedAnswers.push('');
}

/** Selecting an option: replaces the answer for single-answer types, toggles it for multiple. */
export function toggleCorrect(q: DraftQuestion, optionId: string): void {
  if (q.type === 'multiple') {
    q.correct = q.correct.includes(optionId)
      ? q.correct.filter((id) => id !== optionId)
      : [...q.correct, optionId];
  } else {
    q.correct = [optionId];
  }
}

export function moveItem<T>(list: T[], from: number, to: number): void {
  if (to < 0 || to >= list.length || from === to) return;
  const [item] = list.splice(from, 1);
  list.splice(to, 0, item as T);
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

/** An i18n key under `validation.` plus its interpolation params. */
export interface IssueMessage {
  key: string;
  params?: Record<string, unknown>;
}

export function issueToMessage(issue: ZodIssue): IssueMessage {
  switch (issue.code) {
    case 'custom':
      return { key: issue.message };
    case 'too_small':
      if (issue.type === 'string') return { key: Number(issue.minimum) <= 1 ? 'required' : 'tooShort', params: { min: Number(issue.minimum) } };
      if (issue.type === 'array') return { key: 'tooFewItems', params: { min: Number(issue.minimum) } };
      return { key: 'min', params: { min: Number(issue.minimum) } };
    case 'too_big':
      if (issue.type === 'string') return { key: 'tooLong', params: { max: Number(issue.maximum) } };
      if (issue.type === 'array') return { key: 'tooManyItems', params: { max: Number(issue.maximum) } };
      return { key: 'max', params: { max: Number(issue.maximum) } };
    case 'invalid_type':
      return { key: issue.expected === 'number' ? 'number' : 'required' };
    case 'invalid_enum_value':
      return { key: 'invalid' };
    default:
      return { key: 'invalid' };
  }
}

/** Path (`rounds.0.questions.1.prompt`) → first problem at that path. */
export type DraftErrors = Map<string, IssueMessage>;

export function validateDraft(draft: DraftQuiz): DraftErrors {
  const errors: DraftErrors = new Map();
  const result = quizInputSchema.safeParse(draftToInput(draft));
  if (!result.success) {
    for (const issue of result.error.issues) {
      const path = formatIssuePath(issue.path);
      if (!errors.has(path)) errors.set(path, issueToMessage(issue));
    }
  }
  return errors;
}

export function hasErrorsUnder(errors: DraftErrors, prefix: string): boolean {
  for (const path of errors.keys()) {
    if (path === prefix || path.startsWith(`${prefix}.`)) return true;
  }
  return false;
}

/** Errors on the round's own settings, ignoring its questions. */
export function roundSettingsHaveErrors(errors: DraftErrors, roundIndex: number): boolean {
  const prefix = `rounds.${roundIndex}`;
  for (const path of errors.keys()) {
    if ((path === prefix || path.startsWith(`${prefix}.`)) && !path.startsWith(`${prefix}.questions.`)) {
      return true;
    }
  }
  return errors.has(`${prefix}.questions`);
}
