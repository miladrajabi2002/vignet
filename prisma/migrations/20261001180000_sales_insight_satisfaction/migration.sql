-- Conversation satisfaction, topics and reply-model signal coverage.
-- Additive and nullable/defaulted: safe to apply before the code ships.
ALTER TABLE "ConversationSalesInsight"
  ADD COLUMN IF NOT EXISTS "satisfaction" INTEGER,
  ADD COLUMN IF NOT EXISTS "topics" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS "aiTurnCount" INTEGER NOT NULL DEFAULT 0;
