import { PrismaClient } from '@prisma/client';
import { quizInputSchema } from '@quiz/shared';
import { contentToCreateData } from '../quizzes/quiz.mapper';
import { SAMPLE_QUIZZES } from './sample-quizzes';

/** Idempotent: inserts or refreshes the sample quizzes. Run with `pnpm db:seed`. */
async function main(): Promise<void> {
  const prisma = new PrismaClient();
  try {
    for (const sample of SAMPLE_QUIZZES) {
      const data = { ...contentToCreateData(quizInputSchema.parse(sample.quiz)), isSample: true };
      await prisma.$transaction(async (tx) => {
        await tx.round.deleteMany({ where: { quizId: sample.id } });
        await tx.quiz.upsert({
          where: { id: sample.id },
          create: { id: sample.id, ...data },
          update: data,
        });
      });
      console.log(`Seeded sample quiz "${sample.quiz.title}"`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
