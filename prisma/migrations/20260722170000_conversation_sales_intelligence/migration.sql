-- Explainable sales-intelligence snapshot for each conversation. The snapshot
-- is queryable workspace-wide while its lifecycle follows the conversation.
CREATE TYPE "SalesLeadType" AS ENUM (
  'UNCLEAR',
  'INFORMATION_SEEKER',
  'BUYER',
  'EXISTING_CUSTOMER',
  'SUPPORT_SEEKER'
);

CREATE TYPE "SalesIntentStage" AS ENUM (
  'UNKNOWN',
  'DISCOVERY',
  'INFORMATION_GATHERING',
  'CONSIDERATION',
  'NEGOTIATION',
  'PURCHASE_INTENT',
  'POST_PURCHASE'
);

CREATE TYPE "SalesBuyerReadiness" AS ENUM (
  'COLD',
  'EXPLORING',
  'WARM',
  'HOT',
  'CUSTOMER'
);

CREATE TYPE "SalesSentiment" AS ENUM (
  'NEGATIVE',
  'NEUTRAL',
  'POSITIVE',
  'MIXED',
  'DISTRESSED'
);

CREATE TYPE "SalesUrgency" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

CREATE TABLE "ConversationSalesInsight" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "conversationId" TEXT NOT NULL,
  "leadType" "SalesLeadType" NOT NULL DEFAULT 'UNCLEAR',
  "stage" "SalesIntentStage" NOT NULL DEFAULT 'UNKNOWN',
  "buyerReadiness" "SalesBuyerReadiness" NOT NULL DEFAULT 'COLD',
  "buyerProbability" INTEGER NOT NULL DEFAULT 0,
  "sentiment" "SalesSentiment" NOT NULL DEFAULT 'NEUTRAL',
  "urgency" "SalesUrgency" NOT NULL DEFAULT 'LOW',
  "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "objections" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "riskFlags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "signalCodes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "evidence" JSONB,
  "recommendedAction" TEXT,
  "explanation" TEXT,
  "handoffRecommended" BOOLEAN NOT NULL DEFAULT false,
  "handoffReasonCodes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "modelVersion" TEXT NOT NULL DEFAULT 'sales-heuristic-v1',
  "analyzedMessageCount" INTEGER NOT NULL DEFAULT 0,
  "analyzedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ConversationSalesInsight_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ConversationSalesInsight_probability_check"
    CHECK ("buyerProbability" BETWEEN 0 AND 100),
  CONSTRAINT "ConversationSalesInsight_confidence_check"
    CHECK ("confidence" BETWEEN 0 AND 1),
  CONSTRAINT "ConversationSalesInsight_message_count_check"
    CHECK ("analyzedMessageCount" >= 0)
);

CREATE UNIQUE INDEX "ConversationSalesInsight_conversationId_key"
  ON "ConversationSalesInsight"("conversationId");
CREATE INDEX "ConversationSalesInsight_workspaceId_buyerProbability_idx"
  ON "ConversationSalesInsight"("workspaceId", "buyerProbability");
CREATE INDEX "ConversationSalesInsight_workspaceId_stage_idx"
  ON "ConversationSalesInsight"("workspaceId", "stage");
CREATE INDEX "ConversationSalesInsight_workspaceId_handoffRecommended_idx"
  ON "ConversationSalesInsight"("workspaceId", "handoffRecommended");
CREATE INDEX "ConversationSalesInsight_workspaceId_updatedAt_idx"
  ON "ConversationSalesInsight"("workspaceId", "updatedAt");

ALTER TABLE "ConversationSalesInsight"
  ADD CONSTRAINT "ConversationSalesInsight_workspaceId_fkey"
  FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ConversationSalesInsight"
  ADD CONSTRAINT "ConversationSalesInsight_conversationId_fkey"
  FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
