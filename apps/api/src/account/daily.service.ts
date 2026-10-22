import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  DAILY_XP,
  dailyDayKey,
  dailyStreak,
  levelForXp,
  type DailyAnswerResponse,
  type DailyQuestion,
  type DailyResult,
  type DailyStreak,
} from '@quiz/shared';
import { PrismaService } from '../prisma/prisma.service';

/** Official, public single-choice and true/false questions: the daily pool. */
const POOL: Prisma.QuestionWhereInput = {
  type: { in: ['single', 'true_false'] },
  round: { quiz: { isSample: true, visibility: 'public' } },
};

const QUESTION_SELECT = {
  id: true,
  type: true,
  prompt: true,
  imageUrl: true,
  explanation: true,
  data: true,
  round: { select: { quiz: { select: { title: true } } } },
} satisfies Prisma.QuestionSelect;

type QuestionRow = Prisma.QuestionGetPayload<{ select: typeof QUESTION_SELECT }>;

interface ChoiceData {
  options?: { id: string; text: string; imageUrl?: string }[];
  correct: string[] | boolean;
}

/** FNV-1a, so every server picks the same question for a day. */
function hash(text: string): number {
  let h = 0x811c9dc5;
  for (const ch of text) {
    h ^= ch.codePointAt(0)!;
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h;
}

/**
 * «Өдрийн асуулт»: the same question for everyone each day, from the official
 * library. Signed-in players get XP and a streak of days in a row; guests can
 * answer too and keep their streak in the browser.
 */
@Injectable()
export class DailyService {
  constructor(private readonly prisma: PrismaService) {}

  async today(userId?: string): Promise<DailyQuestion> {
    const day = dailyDayKey();
    const answered = userId
      ? await this.prisma.dailyAnswer.findUnique({ where: { userId_day: { userId, day } } })
      : null;
    // Once answered, keep showing that question even if the library changed since.
    const question = (answered && (await this.byId(answered.questionId))) || (await this.pick(day));
    return {
      day,
      quizTitle: question.round.quiz.title,
      type: question.type as DailyQuestion['type'],
      prompt: question.prompt,
      imageUrl: question.imageUrl ?? undefined,
      options: this.data(question).options?.map((o) => ({
        id: o.id,
        text: o.text,
        ...(o.imageUrl ? { imageUrl: o.imageUrl } : {}),
      })),
      result: answered ? this.result(question, answered.answer, 0) : undefined,
      streak: userId ? await this.streak(userId, day) : undefined,
    };
  }

  async answer(answer: string, userId?: string): Promise<DailyAnswerResponse> {
    const day = dailyDayKey();
    const question = await this.pick(day);
    const valid =
      question.type === 'true_false'
        ? answer === 'true' || answer === 'false'
        : (this.data(question).options ?? []).some((o) => o.id === answer);
    if (!valid) throw new BadRequestException('invalid_answer');

    if (!userId) return { result: this.result(question, answer, 0) };

    const correct = this.isCorrect(question, answer);
    const xp = correct ? DAILY_XP.correct : DAILY_XP.answered;
    const { saved, created } = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.dailyAnswer.findUnique({ where: { userId_day: { userId, day } } });
      if (existing) return { saved: existing, created: false };
      const row = await tx.dailyAnswer.create({ data: { userId, day, questionId: question.id, answer, correct } });
      const user = await tx.user.findUniqueOrThrow({ where: { id: userId }, select: { xp: true } });
      const total = user.xp + xp;
      await tx.user.update({ where: { id: userId }, data: { xp: total, level: levelForXp(total) } });
      return { saved: row, created: true };
    });
    // A second answer the same day (another tab) gets the first one back, with no extra XP.
    const shown = created ? question : ((await this.byId(saved.questionId)) ?? question);
    return {
      result: this.result(shown, saved.answer, created ? xp : 0),
      streak: await this.streak(userId, day),
    };
  }

  private async pick(day: string): Promise<QuestionRow> {
    const count = await this.prisma.question.count({ where: POOL });
    if (count === 0) throw new NotFoundException('no_daily_question');
    const question = await this.prisma.question.findFirst({
      where: POOL,
      orderBy: { id: 'asc' },
      skip: hash(day) % count,
      select: QUESTION_SELECT,
    });
    if (!question) throw new NotFoundException('no_daily_question');
    return question;
  }

  private byId(id: string): Promise<QuestionRow | null> {
    return this.prisma.question.findUnique({ where: { id }, select: QUESTION_SELECT });
  }

  private data(question: QuestionRow): ChoiceData {
    return question.data as unknown as ChoiceData;
  }

  private correctAnswer(question: QuestionRow): string {
    const { correct } = this.data(question);
    return typeof correct === 'boolean' ? String(correct) : (correct[0] ?? '');
  }

  private isCorrect(question: QuestionRow, answer: string): boolean {
    return this.correctAnswer(question) === answer;
  }

  private result(question: QuestionRow, answer: string, xp: number): DailyResult {
    return {
      answer,
      correct: this.isCorrect(question, answer),
      correctAnswer: this.correctAnswer(question),
      explanation: question.explanation ?? undefined,
      xp,
    };
  }

  private async streak(userId: string, today: string): Promise<DailyStreak> {
    const rows = await this.prisma.dailyAnswer.findMany({
      where: { userId },
      select: { day: true, correct: true },
      orderBy: { day: 'desc' },
      take: 1000,
    });
    return dailyStreak(
      rows.map((r) => r.day),
      rows.filter((r) => r.correct).length,
      today,
    );
  }
}
