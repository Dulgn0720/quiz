import { describe, expect, it } from 'vitest';
import { questionSchema, quizInputSchema, VALIDATION_CODES, type QuizInput } from './quiz';

const validQuiz: QuizInput = {
  title: 'Capitals',
  rounds: [
    {
      name: 'Round 1',
      questions: [
        {
          type: 'single',
          prompt: 'Capital of Mongolia?',
          options: [
            { id: 'a', text: 'Ulaanbaatar' },
            { id: 'b', text: 'Erdenet' },
          ],
          correct: ['a'],
        },
      ],
    },
  ],
};

function messages(result: ReturnType<typeof questionSchema.safeParse>): string[] {
  return result.success ? [] : result.error.issues.map((i) => i.message);
}

describe('quizInputSchema', () => {
  it('applies defaults', () => {
    const quiz = quizInputSchema.parse(validQuiz);
    expect(quiz.language).toBe('mn');
    const round = quiz.rounds[0]!;
    expect(round).toMatchObject({
      type: 'normal',
      timePerQuestion: 20,
      pointsMultiplier: 1,
      shuffleQuestions: false,
      shuffleAnswers: false,
    });
    expect(round.questions[0]!.basePoints).toBe(1000);
  });

  it('normalizes null optional fields to undefined', () => {
    const quiz = quizInputSchema.parse({ ...validQuiz, description: null, coverImageUrl: null });
    expect(quiz.description).toBeUndefined();
    expect(quiz.coverImageUrl).toBeUndefined();
  });

  it('requires at least one round with one question', () => {
    expect(quizInputSchema.safeParse({ title: 'x', rounds: [] }).success).toBe(false);
    expect(
      quizInputSchema.safeParse({ title: 'x', rounds: [{ name: 'r', questions: [] }] }).success,
    ).toBe(false);
  });
});

describe('questionSchema', () => {
  const options = [
    { id: 'a', text: 'A' },
    { id: 'b', text: 'B' },
    { id: 'c', text: 'C' },
  ];

  it('single choice needs exactly one known correct option', () => {
    expect(messages(questionSchema.safeParse({ type: 'single', prompt: 'q', options, correct: ['a', 'b'] }))).toContain(
      VALIDATION_CODES.singleCorrectRequired,
    );
    expect(messages(questionSchema.safeParse({ type: 'single', prompt: 'q', options, correct: ['z'] }))).toContain(
      VALIDATION_CODES.unknownCorrectOption,
    );
  });

  it('multiple choice accepts several correct options', () => {
    expect(questionSchema.safeParse({ type: 'multiple', prompt: 'q', options, correct: ['a', 'c'] }).success).toBe(true);
    expect(messages(questionSchema.safeParse({ type: 'multiple', prompt: 'q', options, correct: [] }))).toContain(
      VALIDATION_CODES.correctRequired,
    );
  });

  it('rejects duplicate option ids', () => {
    const dup = [
      { id: 'a', text: 'A' },
      { id: 'a', text: 'B' },
    ];
    expect(messages(questionSchema.safeParse({ type: 'single', prompt: 'q', options: dup, correct: ['a'] }))).toContain(
      VALIDATION_CODES.duplicateId,
    );
  });

  it('image questions require an image', () => {
    const q = { type: 'image', prompt: 'Who is this?', options, correct: ['a'] };
    expect(messages(questionSchema.safeParse(q))).toContain(VALIDATION_CODES.imageRequired);
    expect(questionSchema.safeParse({ ...q, imageUrl: '/uploads/x.png' }).success).toBe(true);
  });

  it('only accepts http(s) or root-relative image URLs', () => {
    const q = { type: 'true_false', prompt: 'q', correct: true };
    expect(questionSchema.safeParse({ ...q, imageUrl: 'https://example.com/a.png' }).success).toBe(true);
    expect(questionSchema.safeParse({ ...q, imageUrl: 'javascript:alert(1)' }).success).toBe(false);
    expect(questionSchema.safeParse({ ...q, imageUrl: '//evil.example/a.png' }).success).toBe(false);
  });

  it('options may be image-only but not empty', () => {
    const base = { type: 'single', prompt: 'q', correct: ['a'] };
    expect(
      questionSchema.safeParse({ ...base, options: [{ id: 'a', imageUrl: '/uploads/a.png' }, { id: 'b', text: 'B' }] })
        .success,
    ).toBe(true);
    expect(messages(questionSchema.safeParse({ ...base, options: [{ id: 'a', text: '' }, { id: 'b', text: 'B' }] }))).toContain(
      VALIDATION_CODES.optionEmpty,
    );
  });

  it('validates type-answer and ordering questions', () => {
    expect(questionSchema.safeParse({ type: 'type_answer', prompt: 'q', acceptedAnswers: [] }).success).toBe(false);
    expect(questionSchema.parse({ type: 'type_answer', prompt: 'q', acceptedAnswers: ['x'] })).toMatchObject({
      caseSensitive: false,
    });
    expect(
      questionSchema.safeParse({ type: 'ordering', prompt: 'q', items: [{ id: '1', text: 'one' }] }).success,
    ).toBe(false);
  });
});

describe('estimate question schema', () => {
  const base = { type: 'estimate', prompt: 'Year?', answer: 1206, min: 1100, max: 1300 };
  it('fills step and tolerance and checks the range', () => {
    const ok = questionSchema.safeParse(base);
    expect(ok.success && ok.data).toMatchObject({ step: 1, tolerance: 0 });
    expect(questionSchema.safeParse({ ...base, answer: 1400 }).success).toBe(false);
    expect(questionSchema.safeParse({ ...base, min: 1300, max: 1100 }).success).toBe(false);
    expect(questionSchema.safeParse({ ...base, tolerance: 500 }).success).toBe(false);
  });
});
