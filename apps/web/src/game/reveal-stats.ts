import type { QuestionReveal } from '@quiz/shared';

/** Players who got a question right, when the distribution tells us (not for multiple choice). */
export function correctCount(reveal: QuestionReveal): number | null {
  const { answer, distribution } = reveal;
  if (answer.type === 'single' || answer.type === 'image') return distribution[answer.optionIds[0]!] ?? 0;
  if (answer.type === 'true_false') return distribution[String(answer.value)] ?? 0;
  if (answer.type === 'type_answer' || answer.type === 'ordering') return distribution.correct ?? 0;
  return null;
}
