import { describe, expect, it } from 'vitest';
import { quizInputSchema, type QuizInput } from './quiz';
import { parseQuizCsv, parseQuizJson, quizToCsv, quizToExportJson } from './quiz-io';

const quiz = quizInputSchema.parse({
  title: 'Mixed',
  language: 'en',
  rounds: [
    {
      id: 'round-1',
      name: 'Warm-up',
      type: 'speed',
      timePerQuestion: 10,
      pointsMultiplier: 1.5,
      shuffleAnswers: true,
      questions: [
        {
          id: 'q1',
          type: 'single',
          prompt: 'Pick "B", please',
          options: [
            { id: 'o1', text: 'A' },
            { id: 'o2', text: 'B' },
          ],
          correct: ['o2'],
          explanation: 'Because, B.',
        },
        {
          type: 'multiple',
          prompt: 'Primes',
          options: [
            { id: 'o1', text: '2' },
            { id: 'o2', text: '4' },
            { id: 'o3', text: '5' },
          ],
          correct: ['o1', 'o3'],
          timeLimit: 30,
        },
      ],
    },
    {
      name: 'Main',
      questions: [
        { type: 'true_false', prompt: 'The sky is blue', correct: true },
        { type: 'type_answer', prompt: 'Capital of Mongolia', acceptedAnswers: ['Ulaanbaatar', 'Улаанбаатар'] },
        {
          type: 'ordering',
          prompt: 'Smallest first',
          items: [
            { id: 'i1', text: 'one' },
            { id: 'i2', text: 'two' },
            { id: 'i3', text: 'three' },
          ],
        },
        {
          type: 'image',
          prompt: 'What is this?',
          imageUrl: 'https://example.com/cat.png',
          options: [
            { id: 'o1', text: 'Cat' },
            { id: 'o2', text: 'Dog' },
          ],
          correct: ['o1'],
          basePoints: 500,
        },
      ],
    },
  ],
} satisfies QuizInput);

function withoutIds<T>(value: T): T {
  return JSON.parse(JSON.stringify(value, (k, v) => (k === 'id' && typeof v === 'string' && /^(round|q)/.test(v) ? undefined : v)));
}

describe('JSON import/export', () => {
  it('round-trips through the export envelope without round/question ids', () => {
    const result = parseQuizJson(quizToExportJson(quiz));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.quiz.rounds[0]!.id).toBeUndefined();
    expect(result.quiz.rounds[0]!.questions[0]!.id).toBeUndefined();
    expect(result.quiz).toEqual(withoutIds(quiz));
  });

  it('accepts a bare quiz object', () => {
    const result = parseQuizJson(JSON.stringify({ title: 'Bare', rounds: quiz.rounds }));
    expect(result.ok).toBe(true);
  });

  it('reports invalid JSON and validation issues with paths', () => {
    expect(parseQuizJson('{nope')).toMatchObject({ ok: false });
    const result = parseQuizJson(JSON.stringify({ title: '', rounds: quiz.rounds }));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues.map((i) => i.path)).toContain('title');
  });

  it('rejects unknown formats and future versions', () => {
    expect(parseQuizJson(JSON.stringify({ format: 'other', quiz })).ok).toBe(false);
    expect(parseQuizJson(JSON.stringify({ format: 'quiz-pro', version: 99, quiz })).ok).toBe(false);
  });
});

describe('CSV import/export', () => {
  it('round-trips every question type', () => {
    const result = parseQuizCsv(quizToCsv(quiz), { title: 'Mixed', language: 'en' });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.quiz).toEqual(withoutIds(quiz));
  });

  it('accepts minimal hand-written files with aliases and letters', () => {
    const csv = [
      'Type,Prompt,Option 1,Option 2,Option 3,Correct',
      'single,2+2?,3,4,5,B',
      'tf,Water is wet,,,,yes',
      'text,Say hi,,,,hi|hello',
    ].join('\n');
    const result = parseQuizCsv(csv, { title: 'Hand-made' });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.quiz.rounds).toHaveLength(1);
    const [q1, q2, q3] = result.quiz.rounds[0]!.questions;
    expect(q1).toMatchObject({ type: 'single', correct: ['o2'] });
    expect(q2).toMatchObject({ type: 'true_false', correct: true });
    expect(q3).toMatchObject({ type: 'type_answer', acceptedAnswers: ['hi', 'hello'] });
  });

  it('reports the spreadsheet row of each problem', () => {
    const csv = [
      'type,prompt,option_1,option_2,correct',
      'single,ok,a,b,1',
      'single,,a,b,1',
      'wat,?,,,',
    ].join('\n');
    const structural = parseQuizCsv(csv, { title: 't' });
    expect(structural).toMatchObject({ ok: false, issues: [{ row: 4 }] });

    const validation = parseQuizCsv(csv.split('\n').slice(0, 3).join('\n'), { title: 't' });
    expect(validation.ok).toBe(false);
    if (validation.ok) return;
    expect(validation.issues[0]).toMatchObject({ row: 3, path: 'rounds.0.questions.1.prompt' });
  });

  it('rejects files without required columns', () => {
    expect(parseQuizCsv('prompt\nhello', { title: 't' })).toMatchObject({ ok: false, issues: [{ row: 1 }] });
  });
});
