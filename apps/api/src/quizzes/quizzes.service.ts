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
  page: number;
  pageSize: number;
}

export interface QuizFile {
  filename: string;
  contentType: string;
  body: string;
}

// TODO(phase 5): scope list/update/delete to the signed-in owner once accounts exist.
@Injectable()
export class QuizzesService {
  constructor(private readonly prisma: PrismaService) {}

  async list({ search, page, pageSize }: ListQuizzesParams): Promise<Paginated<QuizSummary>> {
    const where: Prisma.QuizWhereInput = search
      ? {
          OR: [
            { title: { contains: search, mode: 'insensitive' } },
            { description: { contains: search, mode: 'insensitive' } },
          ],
        }
      : {};
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

  async create(content: QuizContent): Promise<QuizDetail> {
    const row = await this.prisma.quiz.create({
      data: contentToCreateData(content),
      include: QUIZ_WITH_CONTENT,
    });
    return toQuizDetail(row);
  }

  /** Replaces the quiz's content. Rounds and questions are rewritten, so their ids change. */
  async update(id: string, content: QuizContent): Promise<QuizDetail> {
    const row = await this.prisma.$transaction(async (tx) => {
      await this.assertEditable(tx, id);
      await tx.round.deleteMany({ where: { quizId: id } });
      return tx.quiz.update({
        where: { id },
        data: contentToCreateData(content),
        include: QUIZ_WITH_CONTENT,
      });
    });
    return toQuizDetail(row);
  }

  async remove(id: string): Promise<void> {
    await this.assertEditable(this.prisma, id);
    await this.prisma.quiz.delete({ where: { id } });
  }

  async duplicate(id: string): Promise<QuizDetail> {
    const content = toQuizContent(await this.get(id));
    const suffix = ' (copy)';
    const title = content.title.slice(0, LIMITS.titleMax - suffix.length) + suffix;
    return this.create({ ...content, title });
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

  async import({ format, content, title }: ImportQuizRequest): Promise<QuizDetail> {
    const result =
      format === 'csv'
        ? parseQuizCsv(content, { title: title?.trim() || 'Imported quiz' })
        : parseQuizJson(content);
    if (!result.ok) {
      const body: ApiErrorBody = { statusCode: 400, message: 'Import failed', issues: result.issues };
      throw new BadRequestException(body);
    }
    return this.create(result.quiz);
  }

  private async assertEditable(db: Prisma.TransactionClient, id: string): Promise<void> {
    const quiz = await db.quiz.findUnique({ where: { id }, select: { isSample: true } });
    if (!quiz) throw new NotFoundException('Quiz not found');
    if (quiz.isSample) {
      throw new ForbiddenException('Sample quizzes are read-only. Duplicate it to make changes.');
    }
  }
}
