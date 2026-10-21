import { z } from 'zod';
import { answerPayloadSchema } from './game';
import type { ChoiceOption, OrderingItem, QuestionType } from './quiz';

/**
 * Trainings: an admin assigns a quiz as a required training (to everyone or to
 * one department), employees take it at their own pace, answers are graded on
 * the server, and passing earns a printable certificate.
 */

export const TRAINING_LIMITS = { titleMax: 120, passMin: 1, passMax: 100, departmentMax: 40 } as const;

export const createTrainingSchema = z.object({
  quizId: z.string().trim().min(1).max(64),
  /** Defaults to the quiz title. */
  title: z.string().trim().max(TRAINING_LIMITS.titleMax).optional(),
  passPercent: z.number().int().min(TRAINING_LIMITS.passMin).max(TRAINING_LIMITS.passMax).default(80),
  /** ISO date (YYYY-MM-DD) the training should be done by. */
  dueDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  /** Only this department; everyone when empty. */
  department: z.string().trim().max(TRAINING_LIMITS.departmentMax).optional(),
});
export type CreateTrainingRequest = z.input<typeof createTrainingSchema>;
export type CreateTrainingInput = z.output<typeof createTrainingSchema>;

export const submitTrainingSchema = z.object({
  answers: z
    .array(z.object({ questionId: z.string().min(1).max(64), answer: answerPayloadSchema }))
    .max(500),
});
export type SubmitTrainingRequest = z.input<typeof submitTrainingSchema>;

export type TrainingStatus = 'passed' | 'failed' | 'todo';

export interface TrainingSummary {
  id: string;
  title: string;
  quizId: string;
  quizTitle: string;
  questionCount: number;
  passPercent: number;
  dueDate?: string;
  department?: string;
  active: boolean;
  createdAt: string;
  /** The signed-in employee's standing. */
  status: TrainingStatus;
  bestPercent?: number;
  attempts: number;
  /** Id of the passing attempt, which is also the certificate number. */
  certificateId?: string;
  passedAt?: string;
}

/** A question as shown while taking a training: no answer keys. */
export interface TrainingQuestion {
  id: string;
  type: QuestionType;
  prompt: string;
  imageUrl?: string;
  options?: ChoiceOption[];
  /** Number of right options (multiple choice), so the player knows how many to pick. */
  correctCount?: number;
  /** Ordering items, shuffled. */
  items?: OrderingItem[];
}

export interface TrainingDetail extends TrainingSummary {
  questions: TrainingQuestion[];
}

export interface TrainingReviewItem {
  questionId: string;
  correct: boolean;
  explanation?: string;
}

export interface TrainingAttemptResult {
  attemptId: string;
  correct: number;
  total: number;
  percent: number;
  passed: boolean;
  passPercent: number;
  review: TrainingReviewItem[];
  /** Set when this or an earlier attempt passed. */
  certificateId?: string;
}

export interface TrainingCertificate {
  certificateId: string;
  trainingTitle: string;
  displayName: string;
  department?: string;
  percent: number;
  passedAt: string;
}

export interface TrainingReportRow {
  displayName: string;
  email: string;
  department?: string;
  status: TrainingStatus;
  attempts: number;
  bestPercent?: number;
  passedAt?: string;
  certificateId?: string;
}

export interface TrainingReport {
  training: TrainingSummary;
  rows: TrainingReportRow[];
  passed: number;
  failed: number;
  todo: number;
}

