import { Controller, Get, Query } from '@nestjs/common';
import { SURVIVAL, type SurvivalBatch } from '@quiz/shared';
import { z } from 'zod';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { PrismaService } from '../prisma/prisma.service';
import { rowToQuestion } from '../quizzes/quiz.mapper';

const querySchema = z.object({
  /** Question ids already played in this run, so a batch brings new ones. */
  exclude: z
    .string()
    .max(20_000)
    .optional()
    .transform((s) => (s ? s.split(',').filter(Boolean).slice(0, 800) : [])),
});

/**
 * Random questions from the official, public library for «Амьд үлдэх».
 * Answers are included: like practice, the run is scored in the browser.
 */
@Controller('survival')
export class SurvivalController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async batch(@Query(new ZodValidationPipe(querySchema)) { exclude }: z.output<typeof querySchema>): Promise<SurvivalBatch> {
    const pool = await this.prisma.question.findMany({
      where: { id: { notIn: exclude }, round: { quiz: { isSample: true, visibility: 'public' } } },
      select: { id: true },
    });
    // Fisher–Yates on the ids, then load only the picked rows.
    const ids = pool.map((p) => p.id);
    for (let i = ids.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [ids[i], ids[j]] = [ids[j]!, ids[i]!];
    }
    const picked = ids.slice(0, SURVIVAL.batch);
    const rows = await this.prisma.question.findMany({
      where: { id: { in: picked } },
      include: { round: { select: { quiz: { select: { title: true } } } } },
    });
    const byId = new Map(rows.map((r) => [r.id, r]));
    return {
      questions: picked
        .map((id) => byId.get(id))
        .filter((r): r is NonNullable<typeof r> => r !== undefined)
        .map((r) => ({ quizTitle: r.round.quiz.title, question: rowToQuestion(r) })),
    };
  }
}
