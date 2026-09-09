ALTER TABLE "Conversation"
ADD COLUMN "lastImprovementReviewAt" TIMESTAMP(3);

UPDATE "Conversation" AS conversation
SET "lastImprovementReviewAt" = latest."reviewedAt"
FROM (
  SELECT review."conversationId", MAX(run."createdAt") AS "reviewedAt"
  FROM "ImprovementReview" AS review
  JOIN "ImprovementRun" AS run ON run.id = review."runId"
  WHERE review.status = 'DONE'
  GROUP BY review."conversationId"
) AS latest
WHERE conversation.id = latest."conversationId";

CREATE INDEX "Conversation_agentId_lastImprovementReviewAt_idx"
ON "Conversation"("agentId", "lastImprovementReviewAt");
