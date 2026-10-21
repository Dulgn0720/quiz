-- Quiz library: topic categories and private/public quizzes.
-- Existing quizzes were visible to everyone, so they start public.
CREATE TYPE "QuizVisibility" AS ENUM ('private', 'public');

ALTER TABLE "Quiz" ADD COLUMN "category" TEXT NOT NULL DEFAULT 'other';
ALTER TABLE "Quiz" ADD COLUMN "visibility" "QuizVisibility" NOT NULL DEFAULT 'public';

CREATE INDEX "Quiz_visibility_category_idx" ON "Quiz"("visibility", "category");
