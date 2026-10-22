import { PrismaClient } from '@prisma/client';
import { quizInputSchema } from '@quiz/shared';
import { contentToCreateData } from '../quizzes/quiz.mapper';
import { LIBRARY_QUIZZES as SAMPLE_QUIZZES } from './library';

/** Idempotent: inserts or refreshes the sample quizzes and removes retired ones. Run with `pnpm db:seed`. */
async function main(): Promise<void> {
  const prisma = new PrismaClient();
  try {
    // Lists show the most recently updated first, so seed in reverse to keep the file's order on screen.
    for (const sample of [...SAMPLE_QUIZZES].reverse()) {
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
    // Retire sample quizzes that are no longer shipped. Past games keep their results (quizId becomes null).
    const removed = await prisma.quiz.deleteMany({
      where: { isSample: true, id: { notIn: SAMPLE_QUIZZES.map((s) => s.id) } },
    });
    if (removed.count > 0) console.log(`Removed ${removed.count} retired sample quiz(zes)`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
