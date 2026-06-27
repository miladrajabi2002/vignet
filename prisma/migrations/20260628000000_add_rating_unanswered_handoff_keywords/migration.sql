-- AlterTable: Agent — add handoffKeywords
ALTER TABLE "Agent" ADD COLUMN "handoffKeywords" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- AlterTable: Message — add rating and unanswered
ALTER TABLE "Message" ADD COLUMN "rating" INTEGER;
ALTER TABLE "Message" ADD COLUMN "unanswered" BOOLEAN NOT NULL DEFAULT false;
