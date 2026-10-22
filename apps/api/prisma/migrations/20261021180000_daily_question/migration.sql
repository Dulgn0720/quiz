-- «Өдрийн асуулт»: one answer per player per day.
CREATE TABLE "DailyAnswer" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "correct" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DailyAnswer_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DailyAnswer_userId_day_key" ON "DailyAnswer"("userId", "day");

ALTER TABLE "DailyAnswer" ADD CONSTRAINT "DailyAnswer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
