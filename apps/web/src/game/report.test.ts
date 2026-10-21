import type { PlayerStats } from '@quiz/shared';
import { describe, expect, it } from 'vitest';
import { hardestQuestions, reportCsv, type QuestionRecord, type ReportLabels } from './report';

const labels: ReportLabels = {
  players: 'Players',
  questions: 'Questions',
  rank: '#',
  player: 'Player',
  team: 'Team',
  score: 'Score',
  correct: 'Correct',
  answered: 'Answered',
  bestStreak: 'Streak',
  avgSeconds: 'Avg s',
  number: 'No',
  round: 'Round',
  question: 'Question',
  correctPercent: '%',
};

const q = (number: number, correct: number | null, players = 10): QuestionRecord => ({
  number,
  roundName: 'Round 1',
  prompt: `Q${number}`,
  answered: players,
  players,
  correct,
});

const player: PlayerStats = {
  playerId: 'p1',
  nickname: '=Бат, "Од"',
  avatar: '🦊',
  score: 1200,
  rank: 1,
  correctCount: 3,
  answerCount: 4,
  questionCount: 4,
  bestStreak: 2,
  avgResponseMs: 4321,
};

describe('hardestQuestions', () => {
  it('lists the least answered-right questions first, skipping perfect and unknown ones', () => {
    const list = hardestQuestions([q(1, 10), q(2, 2), q(3, null), q(4, 5), q(5, 2), q(6, 9)]);
    expect(list.map((x) => x.number)).toEqual([2, 5, 4]);
  });
});

describe('reportCsv', () => {
  it('starts with a BOM, escapes quotes and commas, and defuses formulas', () => {
    const csv = reportCsv('Quiz', [player], [q(2, 3), q(1, 5)], new Map([['p1', 'Борлуулалт']]), labels);
    expect(csv.startsWith('﻿Quiz\r\n')).toBe(true);
    expect(csv).toContain(`1,"'=Бат, ""Од""",Борлуулалт,1200,3/4,4,2,4.3`);
    expect(csv.indexOf('\r\n1,Round 1,Q1,10/10,5,50')).toBeLessThan(csv.indexOf('\r\n2,Round 1,Q2,10/10,3,30'));
  });

  it('leaves out the team column outside team games', () => {
    const csv = reportCsv('Quiz', [player], [], new Map(), labels);
    expect(csv).toContain('#,Player,Score,');
    expect(csv).not.toContain('Questions');
  });
});
