import { stringifyCsv, type PlayerStats, type QuestionPublic, type QuestionReveal } from '@quiz/shared';
import { correctCount } from './reveal-stats';

/** How the room did on one question, collected by the host screen as the game goes. */
export interface QuestionRecord {
  number: number;
  roundName: string;
  prompt: string;
  answered: number;
  players: number;
  /** null when the answer counts don't tell (multiple choice). */
  correct: number | null;
}

export function questionRecord(question: QuestionPublic, reveal: QuestionReveal): QuestionRecord {
  return {
    number: question.globalIndex + 1,
    roundName: question.roundName,
    prompt: question.prompt,
    answered: reveal.answeredCount,
    players: reveal.playerCount,
    correct: correctCount(reveal),
  };
}

/** Share of the room that got it right, 0–1, or null when unknown. */
export function correctRate(q: QuestionRecord): number | null {
  return q.correct === null || q.players === 0 ? null : q.correct / q.players;
}

/** The questions the room found hardest: the knowledge gaps worth a follow-up. */
export function hardestQuestions(records: QuestionRecord[], count = 3): QuestionRecord[] {
  return records
    .filter((q) => correctRate(q) !== null && correctRate(q)! < 1)
    .sort((a, b) => correctRate(a)! - correctRate(b)! || a.number - b.number)
    .slice(0, count);
}

export interface ReportLabels {
  players: string;
  questions: string;
  rank: string;
  player: string;
  team: string;
  score: string;
  correct: string;
  answered: string;
  bestStreak: string;
  avgSeconds: string;
  number: string;
  round: string;
  question: string;
  correctPercent: string;
}

function cell(value: string | number | null | undefined): string {
  const text = value === null || value === undefined ? '' : String(value);
  // Spreadsheet apps run cells starting with these as formulas.
  return /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
}

const row = (values: (string | number | null | undefined)[]): string[] => values.map(cell);

/** Results as CSV that Excel opens with Cyrillic intact: players, then per-question correct rates. */
export function reportCsv(
  title: string,
  results: PlayerStats[],
  questions: QuestionRecord[],
  teams: Map<string, string>,
  labels: ReportLabels,
): string {
  const hasTeams = teams.size > 0;
  const lines = [row([title]), [], row([labels.players])];
  lines.push(
    row([
      labels.rank,
      labels.player,
      ...(hasTeams ? [labels.team] : []),
      labels.score,
      labels.correct,
      labels.answered,
      labels.bestStreak,
      labels.avgSeconds,
    ]),
  );
  for (const r of results) {
    lines.push(
      row([
        r.rank,
        r.nickname,
        ...(hasTeams ? [teams.get(r.playerId) ?? ''] : []),
        r.score,
        `${r.correctCount}/${r.questionCount}`,
        r.answerCount,
        r.bestStreak,
        r.avgResponseMs === null ? '' : (r.avgResponseMs / 1000).toFixed(1),
      ]),
    );
  }
  if (questions.length > 0) {
    lines.push([], row([labels.questions]));
    lines.push(row([labels.number, labels.round, labels.question, labels.answered, labels.correct, labels.correctPercent]));
    for (const q of [...questions].sort((a, b) => a.number - b.number)) {
      const rate = correctRate(q);
      lines.push(
        row([q.number, q.roundName, q.prompt, `${q.answered}/${q.players}`, q.correct, rate === null ? '' : Math.round(rate * 100)]),
      );
    }
  }
  return stringifyCsv(lines, { bom: true });
}

export function downloadFile(name: string, content: string, type = 'text/csv;charset=utf-8'): void {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
