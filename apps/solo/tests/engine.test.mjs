import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  shuffle, createRng, normalizeQuestion, validateQuestions, parseInput, parseCSV,
  createGame, evaluate, toPortable, streakMultiplier, levelInfo, xpForLevel, grade, SCORING,
} from '../js/engine.js';
import { SAMPLE_SET } from '../js/sample-data.js';

const sample = () => validateQuestions(SAMPLE_SET.questions).questions;

test('sample data is fully valid', () => {
  const { questions, errors } = validateQuestions(SAMPLE_SET.questions);
  assert.deepEqual(errors, []);
  assert.equal(questions.length, SAMPLE_SET.questions.length);
});

test('shuffle is a permutation and deterministic per seed', () => {
  const items = Array.from({ length: 50 }, (_, i) => i);
  const a = shuffle(items, createRng(42));
  const b = shuffle(items, createRng(42));
  assert.deepEqual(a, b);
  assert.deepEqual(a.slice().sort((x, y) => x - y), items);
  assert.notDeepEqual(a, items);
  assert.deepEqual(items, Array.from({ length: 50 }, (_, i) => i), 'input untouched');
});

test('shuffle is unbiased (each position roughly uniform)', () => {
  const rng = createRng('bias');
  const counts = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  const N = 30000;
  for (let i = 0; i < N; i++) shuffle([0, 1, 2], rng).forEach((v, pos) => counts[v][pos]++);
  for (const row of counts) for (const c of row) assert.ok(Math.abs(c / N - 1 / 3) < 0.02, `skewed: ${c}`);
});

test('answers resolve by text, index, letter and boolean words', () => {
  const opts = ['A1', 'B1', 'C1'];
  assert.deepEqual(normalizeQuestion({ question: 'x', options: opts, answer: 'b1' }).question.correct, [1]);
  assert.deepEqual(normalizeQuestion({ question: 'x', options: opts, answer: 2 }).question.correct, [2]);
  assert.deepEqual(normalizeQuestion({ question: 'x', options: opts, answer: 'C' }).question.correct, [2]);
  const multi = normalizeQuestion({ question: 'x', options: opts, answer: ['A1', 'C1'] }).question;
  assert.equal(multi.type, 'multiple');
  assert.deepEqual(multi.correct, [0, 2]);
  const bool = normalizeQuestion({ question: 'x', answer: 'худал' }).question;
  assert.equal(bool.type, 'boolean');
  assert.deepEqual(bool.correct, [1]);
  assert.equal(normalizeQuestion({ question: 'x', answer: 'Улаанбаатар' }).question.type, 'text');
});

test('invalid questions report readable errors', () => {
  const { questions, errors } = validateQuestions([
    { question: '', options: ['a', 'b'], answer: 'a' },
    { question: 'q', options: ['a'], answer: 'a' },
    { question: 'q', options: ['a', 'b'], answer: 'z' },
    { question: 'q', options: ['a', 'a'], answer: 'a' },
    { question: 'q', options: ['a', 'b'], answer: 'a', difficulty: 'super' },
    { question: 'ok', options: ['a', 'b'], answer: 'a' },
  ]);
  assert.equal(questions.length, 1);
  assert.equal(errors.length, 5);
});

test('duplicate ids are made unique', () => {
  const { questions } = validateQuestions([
    { id: 'x', question: 'a', answer: true },
    { id: 'x', question: 'b', answer: false },
  ]);
  assert.deepEqual(questions.map((q) => q.id), ['x', 'x-2']);
});

test('CSV import with quotes, pipes and semicolon delimiter', () => {
  const csv = 'question;options;answer;difficulty;category\n"Say ""hi""";a|b|c;b;2;Test\nText q;;Улаанбаатар;easy;Geo\n';
  const rows = parseCSV(csv);
  assert.equal(rows[0].question, 'Say "hi"');
  assert.deepEqual(rows[0].options, ['a', 'b', 'c']);
  const { questions, errors } = parseInput(csv);
  assert.deepEqual(errors, []);
  assert.equal(questions[0].difficulty, 2);
  assert.deepEqual(questions[0].correct, [1]);
  assert.equal(questions[1].type, 'text');
});

test('JSON object with questions key is accepted', () => {
  const { questions, errors } = parseInput(JSON.stringify({ questions: [{ question: 'q', answer: true }] }));
  assert.deepEqual(errors, []);
  assert.equal(questions.length, 1);
});

test('shuffled options keep correct answers correct', () => {
  const questions = sample();
  for (let s = 0; s < 50; s++) {
    const game = createGame(questions, { seed: s, rounds: 1, perRound: questions.length, difficulty: 'mixed' });
    for (const q of game.rounds[0]) {
      const original = questions.find((o) => o.id === q.id);
      const correctTexts = q.options.filter((o) => q.correctIds.includes(o.id)).map((o) => o.text).sort();
      assert.deepEqual(correctTexts, original.correct.map((i) => original.options[i]).sort());
    }
  }
});

test('same seed builds the same game, different seed differs', () => {
  const qs = sample();
  const ids = (g) => g.rounds.flat().map((q) => q.id + q.options.map((o) => o.id).join());
  assert.deepEqual(ids(createGame(qs, { seed: 7 })), ids(createGame(qs, { seed: 7 })));
  assert.notDeepEqual(ids(createGame(qs, { seed: 7 })), ids(createGame(qs, { seed: 8 })));
});

test('progressive mode makes rounds non-decreasing in difficulty', () => {
  const qs = sample();
  for (let s = 0; s < 20; s++) {
    const game = createGame(qs, { seed: s, rounds: 3, perRound: 6 });
    const maxes = game.rounds.map((r) => Math.max(...r.map((q) => q.difficulty)));
    const mins = game.rounds.map((r) => Math.min(...r.map((q) => q.difficulty)));
    for (let i = 1; i < game.rounds.length; i++) assert.ok(mins[i] >= maxes[i - 1]);
    assert.equal(game.totalQuestions, 18);
    assert.equal(new Set(game.rounds.flat().map((q) => q.id)).size, 18, 'no repeated questions');
  }
});

test('filters by category and difficulty; small pools shrink rounds', () => {
  const qs = sample();
  const g = createGame(qs, { seed: 1, categories: ['Технологи'], difficulty: 3, rounds: 3, perRound: 5 });
  assert.ok(g.rounds.flat().every((q) => q.category === 'Технологи' && q.difficulty === 3));
  assert.equal(g.rounds.length, 2); // only 2 hard tech questions → 2 rounds of 1
  assert.throws(() => createGame(qs, { categories: ['Байхгүй'] }));
});

test('evaluate handles every type', () => {
  const single = { type: 'single', correctIds: ['a'] };
  assert.equal(evaluate(single, 'a'), 1);
  assert.equal(evaluate(single, 'b'), 0);
  assert.equal(evaluate(single, null), 0);
  const multi = { type: 'multiple', correctIds: ['a', 'b'] };
  assert.equal(evaluate(multi, ['a', 'b']), 1);
  assert.equal(evaluate(multi, ['a']), 0.5);
  assert.equal(evaluate(multi, ['a', 'c']), 0);
  assert.equal(evaluate(multi, ['a', 'b', 'c']), 0.5);
  const text = { type: 'text', accepted: ['Улаанбаатар'] };
  assert.equal(evaluate(text, '  улаанбаатар. '), 1);
  assert.equal(evaluate(text, ''), 0);
});

function fixedGame(config = {}) {
  const qs = validateQuestions(Array.from({ length: 6 }, (_, i) => ({ id: `q${i}`, question: `Q${i}`, options: ['x', 'y', 'z', 'w'], answer: 'x', difficulty: 1 }))).questions;
  return createGame(qs, { seed: 3, rounds: 2, perRound: 3, timePerQuestion: 20, difficulty: 'mixed', ...config });
}
const right = (g) => g.current.correctIds[0];
const wrong = (g) => g.current.options.find((o) => !g.current.correctIds.includes(o.id)).id;

test('scoring: base, time bonus, streak multiplier', () => {
  const g = fixedGame();
  let r = g.answer(right(g), 0);
  assert.equal(r.points, 150); // 100 base + 50 time bonus, ×1
  g.next();
  r = g.answer(right(g), 10);
  assert.equal(r.breakdown.timeBonus, 25);
  assert.equal(r.points, Math.round(125 * 1.25));
  g.next();
  r = g.answer(wrong(g), 0);
  assert.equal(r.points, 0);
  assert.equal(g.streak, 0);
  assert.equal(g.bestStreak, 2);
  assert.equal(streakMultiplier(1), 1);
  assert.equal(streakMultiplier(5), 2);
  assert.equal(streakMultiplier(20), SCORING.streakMax);
});

test('cannot answer twice or advance before answering', () => {
  const g = fixedGame();
  assert.throws(() => g.next());
  g.answer(right(g), 1);
  assert.throws(() => g.answer(right(g), 1));
});

test('rounds: perfect bonus, round-end, then finish', () => {
  const g = fixedGame();
  for (let i = 0; i < 3; i++) { g.answer(right(g), 20); const s = g.next(); if (i < 2) assert.equal(s, null); else { assert.equal(s.bonus, 200); assert.ok(s.passed); } }
  assert.equal(g.status, 'round-end');
  g.startNextRound();
  assert.equal(g.roundIndex, 1);
  for (let i = 0; i < 3; i++) { g.answer(right(g), 20); g.next(); }
  assert.equal(g.status, 'finished');
  const res = g.results();
  assert.equal(res.correct, 6);
  assert.equal(res.grade, 'S');
  assert.ok(res.completed);
  // round 2 bonus = 200 × 2
  assert.equal(res.rounds[1].bonus, 400);
});

test('failing the pass threshold ends the game', () => {
  const g = fixedGame({ passThreshold: 0.67 });
  g.answer(right(g), 0); g.next();
  g.answer(wrong(g), 0); g.next();
  g.answer(null, 20); // timeout
  const s = g.next();
  assert.equal(s.passed, false);
  assert.equal(g.status, 'finished');
  assert.ok(g.results().failed);
});

test('lifelines: 50/50 keeps the right answer and halves points; skip is excluded from accuracy', () => {
  const g = fixedGame();
  const hidden = g.useFifty();
  assert.equal(hidden.length, 2);
  assert.ok(!hidden.includes(right(g)));
  assert.equal(g.useFifty(), null, 'only once');
  const r = g.answer(right(g), 0);
  assert.equal(r.points, 75);
  g.next();
  assert.ok(g.skip().skipped);
  assert.equal(g.skip(), null);
  g.next();
  g.answer(right(g), 20); g.next();
  const s = g.roundStats(0);
  assert.equal(s.answered, 2);
  assert.equal(s.accuracy, 1);
  assert.equal(s.bonus, 0, 'no perfect bonus with a skip');
});

test('extra time extends the limit once', () => {
  const g = fixedGame();
  assert.equal(g.timeLimit, 20);
  assert.equal(g.useExtraTime(), SCORING.extraTime);
  assert.equal(g.timeLimit, 35);
  assert.equal(g.useExtraTime(), 0);
  g.answer(right(g), 1); g.next();
  assert.equal(g.timeLimit, 20);
});

test('level curve', () => {
  assert.equal(levelInfo(0).level, 1);
  assert.equal(levelInfo(499).level, 1);
  assert.equal(levelInfo(500).level, 2);
  assert.equal(levelInfo(xpForLevel(5)).level, 5);
  assert.ok(levelInfo(700).progress > 0 && levelInfo(700).progress < 1);
  assert.equal(grade(0.96), 'S');
  assert.equal(grade(0.4), 'D');
});

test('toPortable round-trips every question', () => {
  const qs = sample();
  const again = validateQuestions(qs.map(toPortable));
  assert.deepEqual(again.errors, []);
  assert.deepEqual(again.questions, qs);
});
