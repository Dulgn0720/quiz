import type { Locale } from './constants';
import type { ImportIssue } from './quiz-io';
import type { Question, QuizCategory, QuizContent, QuizVisibility, Round } from './quiz';

/** Shapes of the REST API (`/api/...`). Dates are ISO-8601 strings. */

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface QuizSummary {
  id: string;
  title: string;
  description?: string;
  coverImageUrl?: string;
  language: Locale;
  isSample: boolean;
  /** Set when the quiz belongs to an account; only that account may edit it. */
  ownerId?: string;
  /** Display name of the owner, shown as the author of community quizzes. */
  authorName?: string;
  category: QuizCategory;
  visibility: QuizVisibility;
  /** Finished live games played with this quiz. */
  playCount: number;
  roundCount: number;
  questionCount: number;
  createdAt: string;
  updatedAt: string;
}

export type SavedQuestion = Question & { id: string };
export type SavedRound = Omit<Round, 'questions'> & { id: string; questions: SavedQuestion[] };

export interface QuizDetail extends Omit<QuizContent, 'rounds'> {
  id: string;
  isSample: boolean;
  ownerId?: string;
  authorName?: string;
  createdAt: string;
  updatedAt: string;
  rounds: SavedRound[];
}

/** Library shelves: everything visible, official (seeded) quizzes, other people's public quizzes, or your own. */
export const QUIZ_SCOPES = ['all', 'official', 'community', 'mine'] as const;
export type QuizScope = (typeof QUIZ_SCOPES)[number];
export const QUIZ_SORTS = ['recent', 'popular'] as const;
export type QuizSort = (typeof QUIZ_SORTS)[number];

export interface ListQuizzesQuery {
  search?: string;
  /** Only quizzes owned by the signed-in user (same as `scope: 'mine'`). */
  mine?: boolean;
  scope?: QuizScope;
  category?: QuizCategory;
  sort?: QuizSort;
  page?: number;
  pageSize?: number;
}

export const EXPORT_FORMATS = ['json', 'csv'] as const;
export type ExportFormat = (typeof EXPORT_FORMATS)[number];

export interface ImportQuizRequest {
  format: ExportFormat;
  /** Raw file contents. */
  content: string;
  /** Quiz title for CSV imports (CSV has no title); defaults to "Imported quiz". */
  title?: string;
}

export interface UploadImageResponse {
  url: string;
}

export interface ApiErrorBody {
  statusCode: number;
  message: string;
  /** Validation or import problems, when applicable. */
  issues?: ImportIssue[];
}

export interface HealthResponse {
  status: 'ok' | 'degraded';
  database: boolean;
  redis: boolean;
}
