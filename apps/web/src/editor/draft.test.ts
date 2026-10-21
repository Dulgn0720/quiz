import { quizInputSchema, VALIDATION_CODES, type QuizDetail } from '@quiz/shared';
import { describe, expect, it } from 'vitest';
import {
  changeQuestionType,
  createQuestion,
  createQuiz,
  detailToDraft,
  draftToInput,
  hasErrorsUnder,
  roundSettingsHaveErrors,
  toggleCorrect,
  validateDraft,
} from './draft';

function validDraft() {
  const draft = createQuiz('mn', 'Round 1');
  draft.title = 'My quiz';
  const q = draft.rounds[0]!.questions[0]!;
  q.prompt = 'Question?';
  q.options.forEach((o, i) => (o.text = `Option ${i + 1}`));
  toggleCorrect(q, q.options[1]!.id);
  return draft;
}

describe('draft model', () => {
  it('a filled-in new quiz is valid', () => {
    expect(validateDraft(validDraft()).size).toBe(0);
  });

  it('a blank new quiz reports the missing fields by path', () => {
    const errors = validateDraft(createQuiz('mn', 'Round 1'));
    expect(errors.get('title')).toEqual({ key: 'required', params: { min: 1 } });
    expect(errors.get('rounds.0.questions.0.prompt')?.key).toBe('required');
    expect(errors.get('rounds.0.questions.0.correct')?.key).toBe(VALIDATION_CODES.singleCorrectRequired);
    expect(hasErrorsUnder(errors, 'rounds.0.questions.0')).toBe(true);
    expect(roundSettingsHaveErrors(errors, 0)).toBe(false);
  });

  it('flags cleared number inputs instead of defaulting them', () => {
    const draft = validDraft();
    draft.rounds[0]!.timePerQuestion = '';
    const errors = validateDraft(draft);
    expect(errors.get('rounds.0.timePerQuestion')?.key).toBe('number');
    expect(roundSettingsHaveErrors(errors, 0)).toBe(true);
  });

  it('toggles correct answers according to the question type', () => {
    const q = createQuestion('multiple');
    const [a, b] = q.options;
    toggleCorrect(q, a!.id);
    toggleCorrect(q, b!.id);
    expect(q.correct).toEqual([a!.id, b!.id]);
    toggleCorrect(q, a!.id);
    expect(q.correct).toEqual([b!.id]);

    changeQuestionType(q, 'multiple');
    toggleCorrect(q, a!.id);
    changeQuestionType(q, 'single');
    expect(q.correct).toHaveLength(1);
  });

  it('keeps typed content when switching types back and forth', () => {
    const draft = validDraft();
    const q = draft.rounds[0]!.questions[0]!;
    changeQuestionType(q, 'true_false');
    expect(draftToInput(draft).rounds[0]!.questions[0]).toMatchObject({ type: 'true_false', correct: true });
    changeQuestionType(q, 'single');
    expect(validateDraft(draft).size).toBe(0);
  });

  it('round-trips a saved quiz', () => {
    const content = quizInputSchema.parse(draftToInput(validDraft()));
    const detail: QuizDetail = {
      ...content,
      id: 'quiz1',
      isSample: false,
      createdAt: '',
      updatedAt: '',
      rounds: content.rounds.map((r, ri) => ({
        ...r,
        id: `r${ri}`,
        questions: r.questions.map((q, qi) => ({ ...q, id: `q${qi}` })),
      })),
    };
    expect(quizInputSchema.parse(draftToInput(detailToDraft(detail)))).toEqual(content);
  });
});
