import type { ZodIssue } from 'zod';
import { LIMITS, type Locale } from './constants';
import { parseCsv, stringifyCsv } from './csv';
import {
  QUESTION_TYPES,
  ROUND_TYPES,
  quizInputSchema,
  type QuestionInput,
  type QuestionType,
  type QuizContent,
  type RoundInput,
  type RoundType,
} from './quiz';

export const QUIZ_EXPORT_FORMAT = 'quiz-pro';
export const QUIZ_EXPORT_VERSION = 1;

export interface QuizExportFile {
  format: typeof QUIZ_EXPORT_FORMAT;
  version: typeof QUIZ_EXPORT_VERSION;
  exportedAt: string;
  quiz: QuizContent;
}

export interface ImportIssue {
  message: string;
  /** Dotted path into the quiz, e.g. `rounds.0.questions.2.correct`. */
  path?: string;
  /** 1-based spreadsheet row (the header is row 1). CSV imports only. */
  row?: number;
}

export type ImportResult = { ok: true; quiz: QuizContent } | { ok: false; issues: ImportIssue[] };

export function formatIssuePath(path: readonly (string | number)[]): string {
  return path.join('.');
}

function zodIssues(issues: ZodIssue[], rowFor?: (path: (string | number)[]) => number | undefined): ImportIssue[] {
  return issues.map((issue) => ({
    message: issue.message,
    path: formatIssuePath(issue.path),
    row: rowFor?.(issue.path),
  }));
}

/** Round and question ids are dropped: an imported quiz always gets fresh ones. */
function stripIds(quiz: QuizContent): QuizContent {
  return {
    ...quiz,
    rounds: quiz.rounds.map(({ id: _roundId, ...round }) => ({
      ...round,
      questions: round.questions.map(({ id: _questionId, ...q }) => q),
    })),
  };
}

// ---------------------------------------------------------------------------
// JSON
// ---------------------------------------------------------------------------

export function quizToExportJson(quiz: QuizContent, exportedAt: Date = new Date()): string {
  const file: QuizExportFile = {
    format: QUIZ_EXPORT_FORMAT,
    version: QUIZ_EXPORT_VERSION,
    exportedAt: exportedAt.toISOString(),
    quiz: stripIds(quiz),
  };
  return JSON.stringify(file, null, 2);
}

/** Accepts our export envelope or a bare quiz object. */
export function parseQuizJson(text: string): ImportResult {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch (err) {
    return { ok: false, issues: [{ message: `Invalid JSON: ${(err as Error).message}` }] };
  }
  if (data && typeof data === 'object' && 'format' in data) {
    const envelope = data as Partial<QuizExportFile>;
    if (envelope.format !== QUIZ_EXPORT_FORMAT) {
      return { ok: false, issues: [{ message: `Unknown file format "${String(envelope.format)}"` }] };
    }
    if (typeof envelope.version !== 'number' || envelope.version > QUIZ_EXPORT_VERSION) {
      return {
        ok: false,
        issues: [{ message: `Unsupported file version "${String(envelope.version)}"` }],
      };
    }
    data = envelope.quiz;
  }
  const parsed = quizInputSchema.safeParse(data);
  if (!parsed.success) return { ok: false, issues: zodIssues(parsed.error.issues) };
  return { ok: true, quiz: stripIds(parsed.data) };
}

// ---------------------------------------------------------------------------
// CSV — one row per question; consecutive rows with the same `round` form a
// round, whose settings are read from its first row. Option images are not
// representable in CSV; use JSON for a lossless round trip.
// ---------------------------------------------------------------------------

const OPTION_COLUMNS = Array.from({ length: LIMITS.optionsMax }, (_, i) => `option_${i + 1}`);

export const CSV_COLUMNS = [
  'round',
  'round_type',
  'time_per_question',
  'points_multiplier',
  'shuffle_questions',
  'shuffle_answers',
  'type',
  'prompt',
  'image_url',
  'time_limit',
  'base_points',
  ...OPTION_COLUMNS,
  /**
   * single/multiple/image: 1-based option numbers separated by `|` (e.g. `1|3`);
   * true_false: `true`/`false`; type_answer: accepted answers separated by `|`;
   * ordering: empty (options are listed in the correct order).
   */
  'correct',
  'case_sensitive',
  'explanation',
] as const;

type CsvColumn = (typeof CSV_COLUMNS)[number];

export function quizToCsv(quiz: QuizContent): string {
  const rows: string[][] = [[...CSV_COLUMNS]];
  for (const round of quiz.rounds) {
    round.questions.forEach((q) => {
      const cells: Partial<Record<CsvColumn, string>> = {
        round: round.name,
        round_type: round.type,
        time_per_question: String(round.timePerQuestion),
        points_multiplier: String(round.pointsMultiplier),
        shuffle_questions: String(round.shuffleQuestions),
        shuffle_answers: String(round.shuffleAnswers),
        type: q.type,
        prompt: q.prompt,
        image_url: q.imageUrl ?? '',
        time_limit: q.timeLimit === undefined ? '' : String(q.timeLimit),
        base_points: String(q.basePoints),
        explanation: q.explanation ?? '',
      };
      let options: string[] = [];
      switch (q.type) {
        case 'single':
        case 'multiple':
        case 'image':
          options = q.options.map((o) => o.text);
          cells.correct = q.options
            .map((o, i) => (q.correct.includes(o.id) ? String(i + 1) : null))
            .filter((v): v is string => v !== null)
            .join('|');
          break;
        case 'true_false':
          cells.correct = String(q.correct);
          break;
        case 'type_answer':
          cells.correct = q.acceptedAnswers.join('|');
          cells.case_sensitive = String(q.caseSensitive);
          break;
        case 'ordering':
          options = q.items.map((item) => item.text);
          break;
      }
      options.forEach((text, i) => {
        cells[OPTION_COLUMNS[i] as CsvColumn] = text;
      });
      rows.push(CSV_COLUMNS.map((c) => cells[c] ?? ''));
    });
  }
  // BOM so spreadsheet apps detect UTF-8 (needed for Cyrillic).
  return stringifyCsv(rows, { bom: true });
}

const TYPE_ALIASES: Record<string, QuestionType> = {
  tf: 'true_false',
  truefalse: 'true_false',
  'true/false': 'true_false',
  boolean: 'true_false',
  text: 'type_answer',
  typed: 'type_answer',
  input: 'type_answer',
  order: 'ordering',
  sort: 'ordering',
  choice: 'single',
  multi: 'multiple',
};

function parseQuestionType(raw: string): QuestionType | undefined {
  const value = raw.trim().toLowerCase().replace(/[\s-]+/g, '_');
  if ((QUESTION_TYPES as readonly string[]).includes(value)) return value as QuestionType;
  return TYPE_ALIASES[value] ?? TYPE_ALIASES[value.replace(/_/g, '')];
}

function parseBool(raw: string): boolean | undefined {
  const value = raw.trim().toLowerCase();
  if (['true', 'yes', 'y', '1', 't', 'тийм', 'үнэн'].includes(value)) return true;
  if (['false', 'no', 'n', '0', 'f', 'үгүй', 'худал'].includes(value)) return false;
  return undefined;
}

function parseNumber(raw: string): number | undefined {
  const value = raw.trim().replace(',', '.');
  if (value === '') return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : NaN;
}

/** `1|3`, `1,3`, `1 3` or `A|C` → zero-based option indices. */
function parseOptionRefs(raw: string): number[] | undefined {
  const parts = raw
    .split(/[|,;\s]+/)
    .map((p) => p.trim())
    .filter(Boolean);
  const out: number[] = [];
  for (const part of parts) {
    if (/^\d+$/.test(part)) out.push(Number(part) - 1);
    else if (/^[a-z]$/i.test(part)) out.push(part.toLowerCase().charCodeAt(0) - 97);
    else return undefined;
  }
  return out;
}

export function parseQuizCsv(text: string, opts: { title: string; language?: Locale }): ImportResult {
  const rows = parseCsv(text);
  const [headerRow, ...dataRows] = rows;
  if (!headerRow || dataRows.length === 0) {
    return { ok: false, issues: [{ message: 'The CSV file has no question rows' }] };
  }
  const header = headerRow.map((h) => h.trim().toLowerCase().replace(/\s+/g, '_'));
  for (const required of ['type', 'prompt'] as const) {
    if (!header.includes(required)) {
      return { ok: false, issues: [{ message: `Missing required column "${required}"`, row: 1 }] };
    }
  }

  const issues: ImportIssue[] = [];
  const rounds: RoundInput[] = [];
  const roundNames: string[] = [];
  /** `${roundIndex}` and `${roundIndex}.${questionIndex}` → spreadsheet row. */
  const rowOf = new Map<string, number>();

  dataRows.forEach((cells, index) => {
    const rowNumber = index + 2;
    const get = (col: CsvColumn) => {
      const i = header.indexOf(col);
      return i >= 0 ? (cells[i] ?? '').trim() : '';
    };
    const fail = (message: string) => issues.push({ message, row: rowNumber });

    const type = parseQuestionType(get('type'));
    if (!type) return fail(`Unknown question type "${get('type')}"`);

    const roundName = get('round') || roundNames[roundNames.length - 1] || 'Round 1';
    if (roundName !== roundNames[roundNames.length - 1]) {
      const roundTypeRaw = get('round_type').toLowerCase();
      if (roundTypeRaw && !(ROUND_TYPES as readonly string[]).includes(roundTypeRaw)) {
        fail(`Unknown round type "${roundTypeRaw}"`);
      }
      rowOf.set(String(rounds.length), rowNumber);
      roundNames.push(roundName);
      rounds.push({
        name: roundName,
        type: (ROUND_TYPES as readonly string[]).includes(roundTypeRaw)
          ? (roundTypeRaw as RoundType)
          : undefined,
        timePerQuestion: parseNumber(get('time_per_question')),
        pointsMultiplier: parseNumber(get('points_multiplier')),
        shuffleQuestions: parseBool(get('shuffle_questions')),
        shuffleAnswers: parseBool(get('shuffle_answers')),
        questions: [],
      });
    }
    const round = rounds[rounds.length - 1]!;

    const options = OPTION_COLUMNS.map((col, i) => ({ index: i, text: get(col as CsvColumn) })).filter(
      (o) => o.text !== '',
    );
    const base = {
      prompt: get('prompt'),
      imageUrl: get('image_url') || undefined,
      timeLimit: parseNumber(get('time_limit')),
      basePoints: parseNumber(get('base_points')),
      explanation: get('explanation') || undefined,
    };
    const correctRaw = get('correct');
    let question: QuestionInput;

    switch (type) {
      case 'single':
      case 'multiple':
      case 'image': {
        const refs = parseOptionRefs(correctRaw);
        if (!refs) return fail(`Cannot read correct answer "${correctRaw}"`);
        const byIndex = new Map(options.map((o) => [o.index, `o${o.index + 1}`]));
        const correct: string[] = [];
        for (const ref of refs) {
          const id = byIndex.get(ref);
          if (!id) return fail(`Correct answer refers to empty option ${ref + 1}`);
          correct.push(id);
        }
        question = {
          type,
          ...base,
          options: options.map((o) => ({ id: `o${o.index + 1}`, text: o.text })),
          correct,
        };
        break;
      }
      case 'true_false': {
        const correct = parseBool(correctRaw);
        if (correct === undefined) return fail(`Correct answer must be true or false, got "${correctRaw}"`);
        question = { type, ...base, correct };
        break;
      }
      case 'type_answer': {
        const fromCorrect = correctRaw
          .split('|')
          .map((s) => s.trim())
          .filter(Boolean);
        question = {
          type,
          ...base,
          acceptedAnswers: fromCorrect.length > 0 ? fromCorrect : options.map((o) => o.text),
          caseSensitive: parseBool(get('case_sensitive')) ?? false,
        };
        break;
      }
      case 'ordering':
        question = {
          type,
          ...base,
          items: options.map((o, i) => ({ id: `i${i + 1}`, text: o.text })),
        };
        break;
    }
    rowOf.set(`${rounds.length - 1}.${round.questions.length}`, rowNumber);
    round.questions.push(question);
  });

  if (issues.length > 0) return { ok: false, issues };

  const parsed = quizInputSchema.safeParse({ title: opts.title, language: opts.language, rounds });
  if (!parsed.success) {
    return {
      ok: false,
      issues: zodIssues(parsed.error.issues, (path) => {
        if (path[0] !== 'rounds' || typeof path[1] !== 'number') return undefined;
        if (path[2] === 'questions' && typeof path[3] === 'number') {
          return rowOf.get(`${path[1]}.${path[3]}`);
        }
        return rowOf.get(String(path[1]));
      }),
    };
  }
  return { ok: true, quiz: parsed.data };
}
