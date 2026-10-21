import type { QuizInput } from '@quiz/shared';
import { GENERAL_QUIZZES } from './general-quizzes';
import { SAMPLE_QUIZZES } from './sample-quizzes';

/**
 * Every quiz seeded into the library, in the order shown: the Agula company
 * quizzes first, then the general-knowledge, Mongolia, insurance and fun ones.
 * All are official (read-only) and public.
 */
export const LIBRARY_QUIZZES: { id: string; quiz: QuizInput }[] = [
  ...SAMPLE_QUIZZES.map((s) => ({ id: s.id, quiz: { ...s.quiz, category: 'agula' as const, visibility: 'public' as const } })),
  ...GENERAL_QUIZZES.map((s) => ({ id: s.id, quiz: { ...s.quiz, visibility: 'public' as const } })),
];
