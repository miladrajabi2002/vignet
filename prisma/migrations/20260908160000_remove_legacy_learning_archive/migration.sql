-- Remove Q&A records created by the retired learning center. Knowledge created
-- by the current improvement workflow uses an `improvement:` source reference
-- and is deliberately preserved.
DELETE FROM "KnowledgeBase"
WHERE id IN (
  SELECT "knowledgeBaseId"
  FROM "KnowledgeApproval"
  WHERE "sourceMessageRef" NOT LIKE 'improvement:%'
);

-- The retired analyzer stored its review payload inside message metadata.
UPDATE "Message"
SET metadata = metadata - 'learningReview'
WHERE metadata ? 'learningReview';

-- These columns and their relation were only used by the retired archive.
ALTER TABLE "KnowledgeApproval"
  DROP CONSTRAINT IF EXISTS "KnowledgeApproval_sourceMessageId_fkey";

DROP INDEX IF EXISTS "KnowledgeApproval_sourceMessageId_key";

ALTER TABLE "KnowledgeApproval"
  DROP COLUMN "sourceMessageId",
  DROP COLUMN "source";

DROP TYPE "LearningSource";
