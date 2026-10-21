import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import {
  isAnswerCorrect,
  shuffleAwayFromIdentity,
  type CreateTrainingInput,
  type SavedQuestion,
  type SubmitTrainingRequest,
  type TrainingAttemptResult,
  type TrainingCertificate,
  type TrainingDetail,
  type TrainingQuestion,
  type TrainingReport,
  type TrainingReportRow,
  type TrainingStatus,
  type TrainingSummary,
} from '@quiz/shared';
import { AccessPolicy } from '../auth/access-policy';
import { PrismaService } from '../prisma/prisma.service';
import { QUIZ_WITH_CONTENT, toQuizDetail } from '../quizzes/quiz.mapper';

const TRAINING_INCLUDE = { quiz: { select: { title: true, questionCount: true } } } satisfies Prisma.TrainingInclude;
type TrainingRow = Prisma.TrainingGetPayload<{ include: typeof TRAINING_INCLUDE }>;

interface AttemptLite {
  id: string;
  percent: number;
  passed: boolean;
  createdAt: Date;
}

/** Same department, however it was typed. */
const sameDepartment = (a: string | null | undefined, b: string | null | undefined) =>
  !!a && !!b && a.trim().toLocaleLowerCase() === b.trim().toLocaleLowerCase();

/**
 * Required trainings: admins assign a quiz (to everyone or one department),
 * employees take it at their own pace, answers are graded here, and a passing
 * attempt is the certificate.
 */
@Injectable()
export class TrainingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessPolicy,
  ) {}

  async create(input: CreateTrainingInput, userId: string): Promise<TrainingSummary> {
    await this.assertAdmin(userId);
    const quiz = await this.prisma.quiz.findUnique({ where: { id: input.quizId }, select: { title: true, questionCount: true } });
    if (!quiz) throw new NotFoundException('Quiz not found');
    if (quiz.questionCount === 0) throw new BadRequestException('This quiz has no questions');
    const row = await this.prisma.training.create({
      data: {
        quizId: input.quizId,
        title: input.title?.trim() || quiz.title,
        passPercent: input.passPercent,
        dueDate: input.dueDate,
        department: input.department?.trim() || null,
        createdById: userId,
      },
      include: TRAINING_INCLUDE,
    });
    return this.summary(row, []);
  }

  async setActive(id: string, active: boolean, userId: string): Promise<void> {
    await this.assertAdmin(userId);
    await this.prisma.training.update({ where: { id }, data: { active } }).catch(() => {
      throw new NotFoundException('Training not found');
    });
  }

  /** Trainings for this employee; admins see every training, including closed ones. */
  async list(userId: string): Promise<TrainingSummary[]> {
    const [user, admin] = await Promise.all([
      this.prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { department: true } }),
      this.access.isAdmin(userId),
    ]);
    const rows = await this.prisma.training.findMany({
      where: admin ? {} : { active: true },
      include: TRAINING_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });
    const mine = admin ? rows : rows.filter((r) => !r.department || sameDepartment(r.department, user.department));
    const attempts = await this.prisma.trainingAttempt.findMany({
      where: { userId, trainingId: { in: mine.map((r) => r.id) } },
      select: { id: true, trainingId: true, percent: true, passed: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    });
    return mine.map((row) =>
      this.summary(
        row,
        attempts.filter((a) => a.trainingId === row.id),
      ),
    );
  }

  async get(id: string, userId: string): Promise<TrainingDetail> {
    const row = await this.findVisible(id, userId);
    const attempts = await this.attemptsOf(id, userId);
    const quiz = await this.quizQuestions(row.quizId);
    return {
      ...this.summary(row, attempts),
      questions: quiz.map((q) => this.publicQuestion(q, `${id}:${userId}`)),
    };
  }

  async submit(id: string, input: SubmitTrainingRequest, userId: string): Promise<TrainingAttemptResult> {
    const row = await this.findVisible(id, userId);
    if (!row.active) throw new BadRequestException('This training is closed');
    const questions = await this.quizQuestions(row.quizId);
    const given = new Map(input.answers.map((a) => [a.questionId, a.answer]));
    const review = questions.map((q) => {
      const answer = given.get(q.id);
      let correct = false;
      try {
        correct = answer !== undefined && answer.type === q.type && isAnswerCorrect(q, answer);
      } catch {
        correct = false;
      }
      return { questionId: q.id, correct, explanation: q.explanation };
    });
    const correct = review.filter((r) => r.correct).length;
    const total = questions.length;
    const percent = total === 0 ? 0 : Math.round((correct / total) * 100);
    const passed = percent >= row.passPercent;
    const attempt = await this.prisma.trainingAttempt.create({
      data: { trainingId: id, userId, correct, total, percent, passed },
    });
    const firstPass = passed
      ? attempt
      : await this.prisma.trainingAttempt.findFirst({ where: { trainingId: id, userId, passed: true }, orderBy: { createdAt: 'asc' } });
    return {
      attemptId: attempt.id,
      correct,
      total,
      percent,
      passed,
      passPercent: row.passPercent,
      review,
      certificateId: firstPass?.id,
    };
  }

  /** The certificate behind a passing attempt; its owner and admins can open it. */
  async certificate(attemptId: string, userId: string): Promise<TrainingCertificate> {
    const attempt = await this.prisma.trainingAttempt.findUnique({
      where: { id: attemptId },
      include: { training: { select: { title: true } }, user: { select: { displayName: true, department: true } } },
    });
    if (!attempt || !attempt.passed) throw new NotFoundException('Certificate not found');
    if (attempt.userId !== userId && !(await this.access.isAdmin(userId))) throw new NotFoundException('Certificate not found');
    return {
      certificateId: attempt.id,
      trainingTitle: attempt.training.title,
      displayName: attempt.user.displayName,
      department: attempt.user.department ?? undefined,
      percent: attempt.percent,
      passedAt: attempt.createdAt.toISOString(),
    };
  }

  /** Who has passed, failed or not started yet: every employee the training is for. */
  async report(id: string, userId: string): Promise<TrainingReport> {
    await this.assertAdmin(userId);
    const row = await this.prisma.training.findUnique({ where: { id }, include: TRAINING_INCLUDE });
    if (!row) throw new NotFoundException('Training not found');
    const [users, attempts] = await Promise.all([
      this.prisma.user.findMany({
        select: { id: true, displayName: true, email: true, department: true },
        orderBy: { displayName: 'asc' },
      }),
      this.prisma.trainingAttempt.findMany({
        where: { trainingId: id },
        select: { id: true, userId: true, percent: true, passed: true, createdAt: true },
        orderBy: { createdAt: 'asc' },
      }),
    ]);
    const tried = new Set(attempts.map((a) => a.userId));
    // Everyone in the department, plus anyone else who took it anyway.
    const audience = users.filter((u) => !row.department || sameDepartment(row.department, u.department) || tried.has(u.id));
    const rows: TrainingReportRow[] = audience.map((u) => {
      const mine = attempts.filter((a) => a.userId === u.id);
      const s = this.standing(mine);
      return {
        displayName: u.displayName,
        email: u.email,
        department: u.department ?? undefined,
        status: s.status,
        attempts: mine.length,
        bestPercent: s.bestPercent,
        passedAt: s.passedAt,
        certificateId: s.certificateId,
      };
    });
    const order: Record<TrainingStatus, number> = { todo: 0, failed: 1, passed: 2 };
    rows.sort((a, b) => order[a.status] - order[b.status] || a.displayName.localeCompare(b.displayName, 'mn'));
    return {
      training: this.summary(row, []),
      rows,
      passed: rows.filter((r) => r.status === 'passed').length,
      failed: rows.filter((r) => r.status === 'failed').length,
      todo: rows.filter((r) => r.status === 'todo').length,
    };
  }

  private async assertAdmin(userId: string): Promise<void> {
    if (!(await this.access.isAdmin(userId))) throw new ForbiddenException('Only admins can manage trainings');
  }

  private async findVisible(id: string, userId: string): Promise<TrainingRow> {
    const row = await this.prisma.training.findUnique({ where: { id }, include: TRAINING_INCLUDE });
    if (!row) throw new NotFoundException('Training not found');
    if (await this.access.isAdmin(userId)) return row;
    if (!row.active) throw new NotFoundException('Training not found');
    if (row.department) {
      const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { department: true } });
      if (!sameDepartment(row.department, user?.department)) throw new NotFoundException('Training not found');
    }
    return row;
  }

  private attemptsOf(trainingId: string, userId: string): Promise<AttemptLite[]> {
    return this.prisma.trainingAttempt.findMany({
      where: { trainingId, userId },
      select: { id: true, percent: true, passed: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    });
  }

  private async quizQuestions(quizId: string): Promise<SavedQuestion[]> {
    const row = await this.prisma.quiz.findUnique({ where: { id: quizId }, include: QUIZ_WITH_CONTENT });
    if (!row) throw new NotFoundException('Quiz not found');
    return toQuizDetail(row).rounds.flatMap((r) => r.questions);
  }

  private standing(attempts: AttemptLite[]): {
    status: TrainingStatus;
    bestPercent?: number;
    passedAt?: string;
    certificateId?: string;
  } {
    if (attempts.length === 0) return { status: 'todo' };
    const pass = attempts.find((a) => a.passed);
    return {
      status: pass ? 'passed' : 'failed',
      bestPercent: Math.max(...attempts.map((a) => a.percent)),
      passedAt: pass?.createdAt.toISOString(),
      certificateId: pass?.id,
    };
  }

  private summary(row: TrainingRow, attempts: AttemptLite[]): TrainingSummary {
    return {
      id: row.id,
      title: row.title,
      quizId: row.quizId,
      quizTitle: row.quiz.title,
      questionCount: row.quiz.questionCount,
      passPercent: row.passPercent,
      dueDate: row.dueDate ?? undefined,
      department: row.department ?? undefined,
      active: row.active,
      createdAt: row.createdAt.toISOString(),
      attempts: attempts.length,
      ...this.standing(attempts),
    };
  }

  /** Answer keys stay on the server; ordering items come shuffled. */
  private publicQuestion(q: SavedQuestion, seed: string): TrainingQuestion {
    const base = { id: q.id, type: q.type, prompt: q.prompt, imageUrl: q.imageUrl };
    switch (q.type) {
      case 'single':
      case 'multiple':
      case 'image':
        return { ...base, options: q.options, correctCount: q.correct.length };
      case 'ordering':
        return { ...base, items: shuffleAwayFromIdentity(q.items, `${seed}:${q.id}`) };
      case 'true_false':
      case 'type_answer':
        return base;
    }
  }
}
