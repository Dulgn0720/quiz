import type { Locale } from './constants';
import type { ImportIssue } from './quiz-io';
import type { Question, QuizContent, Round } from './quiz';

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
  createdAt: string;
  updatedAt: string;
  rounds: SavedRound[];
}

export interface ListQuizzesQuery {
  search?: string;
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
