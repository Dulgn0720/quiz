import {
  gameTimeLimit,
  isAnswerCorrect,
  scoreAnswer,
  seededShuffle,
  shuffleAwayFromIdentity,
  type AnswerPayload,
  type PlayerAnswerResult,
  type QuestionPublic,
  type QuizDetail,
  type RevealedAnswer,
  type SavedQuestion,
  type SavedRound,
} from '@quiz/shared';

/**
 * Solo practice: plays a quiz on one device with the live-game scoring rules,
 * entirely in the browser. Elimination rounds play as normal rounds.
 */
export interface PracticeItem {
  round: SavedRound;
  question: SavedQuestion;
  roundIndex: number;
  questionIndex: number;
  globalIndex: number;
}

export function practiceItems(quiz: QuizDetail, seed: string): PracticeItem[] {
  const items: PracticeItem[] = [];
  quiz.rounds.forEach((round, roundIndex) => {
    const questions = round.shuffleQuestions ? seededShuffle(round.questions, `${seed}:round:${roundIndex}`) : round.questions;
    questions.forEach((question, questionIndex) => {
      items.push({ round, question, roundIndex, questionIndex, globalIndex: items.length });
    });
  });
  return items;
}

export function practiceTimeLimit(item: PracticeItem): number {
  return gameTimeLimit(item.round, item.question);
}

export function practiceQuestion(item: PracticeItem, total: number, endsAt: number, seed: string): QuestionPublic {
  const { round, question } = item;
  const roundFactor = round.type === 'double' ? 2 : 1;
  const base = {
    roundIndex: item.roundIndex,
    roundName: round.name,
    roundType: round.type === 'elimination' ? ('normal' as const) : round.type,
    questionIndex: item.questionIndex,
    roundQuestionCount: round.questions.length,
    globalIndex: item.globalIndex,
    totalQuestions: total,
    prompt: question.prompt,
    imageUrl: question.imageUrl,
    points: Math.round(question.basePoints * round.pointsMultiplier * roundFactor),
    timeLimit: practiceTimeLimit(item),
    endsAt,
  };
  const shuffleSeed = `${seed}:${question.id}`;
  switch (question.type) {
    case 'single':
    case 'multiple':
    case 'image':
      return {
        ...base,
        type: question.type,
        options: round.shuffleAnswers ? seededShuffle(question.options, shuffleSeed) : question.options,
        correctCount: question.correct.length,
      };
    case 'ordering':
      return { ...base, type: 'ordering', items: shuffleAwayFromIdentity(question.items, shuffleSeed) };
    case 'true_false':
    case 'type_answer':
      return { ...base, type: question.type };
  }
}

export function practiceAnswer(question: SavedQuestion): RevealedAnswer {
  switch (question.type) {
    case 'single':
    case 'multiple':
    case 'image':
      return { type: question.type, optionIds: question.correct };
    case 'true_false':
      return { type: 'true_false', value: question.correct };
    case 'type_answer':
      return { type: 'type_answer', acceptedAnswers: question.acceptedAnswers };
    case 'ordering':
      return { type: 'ordering', itemIds: question.items.map((i) => i.id) };
  }
}

/** Scores one answer (or a missed question when `answer` is undefined). */
export function practiceResult(
  item: PracticeItem,
  answer: AnswerPayload | undefined,
  responseMs: number,
  previous: { score: number; streak: number },
): PlayerAnswerResult {
  const correct = answer !== undefined && isAnswerCorrect(item.question, answer);
  const streak = correct ? previous.streak + 1 : 0;
  const breakdown = scoreAnswer({
    correct,
    basePoints: item.question.basePoints,
    roundType: item.round.type,
    roundMultiplier: item.round.pointsMultiplier,
    responseMs,
    timeLimitMs: practiceTimeLimit(item) * 1000,
    streak,
  });
  return {
    answered: answer !== undefined,
    correct,
    points: breakdown.total,
    breakdown,
    streak,
    score: previous.score + breakdown.total,
    rank: 1,
    eliminated: false,
  };
}

/** 0–3 stars from the share of correct answers. */
export function practiceStars(correct: number, total: number): number {
  if (total === 0) return 0;
  const share = correct / total;
  if (share >= 0.9) return 3;
  if (share >= 0.7) return 2;
  if (share >= 0.4) return 1;
  return 0;
}

export interface PracticeBest {
  score: number;
  correct: number;
  total: number;
}

const bestKey = (quizId: string) => `agula-quiz:practice-best:${quizId}`;

export function readPracticeBest(quizId: string): PracticeBest | null {
  try {
    const raw = localStorage.getItem(bestKey(quizId));
    return raw ? (JSON.parse(raw) as PracticeBest) : null;
  } catch {
    return null;
  }
}

/** Saves the result if it beats the stored best; returns whether it did. */
export function savePracticeBest(quizId: string, result: PracticeBest): boolean {
  const best = readPracticeBest(quizId);
  if (best && best.score >= result.score) return false;
  try {
    localStorage.setItem(bestKey(quizId), JSON.stringify(result));
  } catch {
    // Private mode: nothing to remember.
  }
  return true;
}
