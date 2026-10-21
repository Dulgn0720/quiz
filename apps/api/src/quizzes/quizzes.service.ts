import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import {
  LIMITS,
  parseQuizCsv,
  parseQuizJson,
  quizToCsv,
  quizToExportJson,
  type ApiErrorBody,
  type ExportFormat,
  type ImportQuizRequest,
  type Paginated,
  type QuizContent,
  type QuizDetail,
  type QuizSummary,
} from '@quiz/shared';
import { ProgressionService } from '../account/progression.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  QUIZ_WITH_CONTENT,
  contentToCreateData,
  toQuizContent,
  toQuizDetail,
  toQuizSummary,
} from './quiz.mapper';

export interface ListQuizzesParams {
  search?: string;
  /** Only quizzes owned by `userId`. */
  mine?: boolean;
  userId?: string;
  page: number;
  pageSize: number;
}

export interface QuizFile {
  filename: string;
  contentType: string;
  body: string;
}

/**
 * Quizzes created while signed in belong to that account: only the owner may
 * edit or delete them (everyone may play and duplicate them). Quizzes made
 * by guests have no owner and stay editable by anyone.
 */
@Injectable()
export class QuizzesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly progression: ProgressionService,
  ) {}

  async list({ search, mine, userId, page, pageSize }: ListQuizzesParams): Promise<Paginated<QuizSummary>> {
    const where: Prisma.QuizWhereInput = {
      ...(search
        ? {
            OR: [
              { title: { contains: search, mode: 'insensitive' } },
              { description: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
      ...(mine ? { ownerId: userId ?? '-' } : {}),
    };
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.quiz.count({ where }),
      this.prisma.quiz.findMany({
        where,
        orderBy: [{ isSample: 'asc' }, { updatedAt: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);
    return { items: rows.map(toQuizSummary), total, page, pageSize };
  }

  async get(id: string): Promise<QuizDetail> {
    const row = await this.prisma.quiz.findUnique({ where: { id }, include: QUIZ_WITH_CONTENT });
    if (!row) throw new NotFoundException('Quiz not found');
    return toQuizDetail(row);
  }

  async create(content: QuizContent, ownerId?: string): Promise<QuizDetail> {
    const row = await this.prisma.quiz.create({
      data: { ...contentToCreateData(content), ownerId: ownerId ?? null },
      include: QUIZ_WITH_CONTENT,
    });
    if (ownerId) await this.progression.refreshBadges(ownerId).catch(() => undefined);
    return toQuizDetail(row);
  }

  /** Replaces the quiz's content. Rounds and questions are rewritten, so their ids change. */
  async update(id: string, content: QuizContent, userId?: string): Promise<QuizDetail> {
    const row = await this.prisma.$transaction(async (tx) => {
      await this.assertEditable(tx, id, userId);
      await tx.round.deleteMany({ where: { quizId: id } });
      return tx.quiz.update({
        where: { id },
        data: contentToCreateData(content),
        include: QUIZ_WITH_CONTENT,
      });
    });
    return toQuizDetail(row);
  }

  async remove(id: string, userId?: string): Promise<void> {
    await this.assertEditable(this.prisma, id, userId);
    await this.prisma.quiz.delete({ where: { id } });
  }

  async duplicate(id: string, userId?: string): Promise<QuizDetail> {
    const content = toQuizContent(await this.get(id));
    const suffix = ' (copy)';
    const title = content.title.slice(0, LIMITS.titleMax - suffix.length) + suffix;
    return this.create({ ...content, title }, userId);
  }

  async export(id: string, format: ExportFormat): Promise<QuizFile> {
    const content = toQuizContent(await this.get(id));
    const base = content.title.replace(/[\\/:*?"<>|\u0000-\u001f]+/g, ' ').trim() || 'quiz';
    return format === 'csv'
      ? { filename: `${base}.csv`, contentType: 'text/csv; charset=utf-8', body: quizToCsv(content) }
      : {
          filename: `${base}.json`,
          contentType: 'application/json; charset=utf-8',
          body: quizToExportJson(content),
        };
  }

  async import({ format, content, title }: ImportQuizRequest, userId?: string): Promise<QuizDetail> {
    const result =
      format === 'csv'
        ? parseQuizCsv(content, { title: title?.trim() || 'Imported quiz' })
        : parseQuizJson(content);
    if (!result.ok) {
      const body: ApiErrorBody = { statusCode: 400, message: 'Import failed', issues: result.issues };
      throw new BadRequestException(body);
    }
    return this.create(result.quiz, userId);
  }

  private async assertEditable(db: Prisma.TransactionClient, id: string, userId?: string): Promise<void> {
    const quiz = await db.quiz.findUnique({ where: { id }, select: { isSample: true, ownerId: true } });
    if (!quiz) throw new NotFoundException('Quiz not found');
    if (quiz.isSample) {
      throw new ForbiddenException('Sample quizzes are read-only. Duplicate it to make changes.');
    }
    if (quiz.ownerId && quiz.ownerId !== userId) {
      throw new ForbiddenException('Only the owner can change this quiz. Duplicate it to make your own copy.');
    }
  }
}
