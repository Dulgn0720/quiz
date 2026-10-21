import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Put,
  Query,
  Res,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  EXPORT_FORMATS,
  LIMITS,
  QUIZ_CATEGORIES,
  QUIZ_SCOPES,
  QUIZ_SORTS,
  quizInputSchema,
  type ImportQuizRequest,
  type Paginated,
  type QuizContent,
  type QuizDetail,
  type QuizSummary,
} from '@quiz/shared';
import type { Response } from 'express';
import { z } from 'zod';
import { CurrentUserId } from '../auth/current-user';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { QuizzesService, type ListQuizzesParams } from './quizzes.service';

/** Upper bound for an import file's text; the JSON body limit in main.ts leaves room for escaping. */
export const IMPORT_MAX_CHARS = 2_000_000;

const listQuerySchema = z.object({
  search: z.string().trim().max(100).optional(),
  mine: z
    .enum(['true', 'false', '1', '0'])
    .optional()
    .transform((v) => v === 'true' || v === '1'),
  scope: z.enum(QUIZ_SCOPES).optional(),
  category: z.enum(QUIZ_CATEGORIES).optional(),
  sort: z.enum(QUIZ_SORTS).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
});

const exportQuerySchema = z.object({ format: z.enum(EXPORT_FORMATS).default('json') });

const importBodySchema = z.object({
  format: z.enum(EXPORT_FORMATS),
  content: z.string().min(1).max(IMPORT_MAX_CHARS),
  title: z.string().trim().max(LIMITS.titleMax).optional(),
});

@Controller('quizzes')
export class QuizzesController {
  constructor(private readonly quizzes: QuizzesService) {}

  @Get()
  list(
    @Query(new ZodValidationPipe(listQuerySchema)) query: Omit<ListQuizzesParams, 'userId'>,
    @CurrentUserId() userId?: string,
  ): Promise<Paginated<QuizSummary>> {
    return this.quizzes.list({ ...query, userId });
  }

  @Post()
  create(
    @Body(new ZodValidationPipe(quizInputSchema)) body: QuizContent,
    @CurrentUserId() userId?: string,
  ): Promise<QuizDetail> {
    return this.quizzes.create(body, userId);
  }

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('import')
  import(
    @Body(new ZodValidationPipe(importBodySchema)) body: ImportQuizRequest,
    @CurrentUserId() userId?: string,
  ): Promise<QuizDetail> {
    return this.quizzes.import(body, userId);
  }

  @Get(':id')
  get(@Param('id') id: string, @CurrentUserId() userId?: string): Promise<QuizDetail> {
    return this.quizzes.get(id, userId);
  }

  @Put(':id')
  update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(quizInputSchema)) body: QuizContent,
    @CurrentUserId() userId?: string,
  ): Promise<QuizDetail> {
    return this.quizzes.update(id, body, userId);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@Param('id') id: string, @CurrentUserId() userId?: string): Promise<void> {
    return this.quizzes.remove(id, userId);
  }

  @Post(':id/duplicate')
  duplicate(@Param('id') id: string, @CurrentUserId() userId?: string): Promise<QuizDetail> {
    return this.quizzes.duplicate(id, userId);
  }

  @Get(':id/export')
  async export(
    @Param('id') id: string,
    @Query(new ZodValidationPipe(exportQuerySchema)) { format }: z.output<typeof exportQuerySchema>,
    @Res({ passthrough: true }) res: Response,
    @CurrentUserId() userId?: string,
  ): Promise<string> {
    const file = await this.quizzes.export(id, format, userId);
    const asciiName = file.filename.replace(/[^\x20-\x7e]/g, '_').replace(/"/g, "'");
    res.setHeader('Content-Type', file.contentType);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(file.filename)}`,
    );
    return file.body;
  }
}
