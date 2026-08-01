CREATE TYPE "LearningSource" AS ENUM ('AI_UNANSWERED', 'OPERATOR_REPLY');

CREATE TABLE "KnowledgeApproval" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "agentId" TEXT NOT NULL,
  "knowledgeBaseId" TEXT NOT NULL,
  "sourceMessageId" TEXT,
  "sourceMessageRef" TEXT NOT NULL,
  "sourceConversationId" TEXT NOT NULL,
  "source" "LearningSource" NOT NULL,
  "question" TEXT NOT NULL,
  "answer" TEXT NOT NULL,
  "contentHash" TEXT NOT NULL,
  "verifiedByUserId" TEXT,
  "verifiedByUserRef" TEXT NOT NULL,
  "verifiedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "validFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "validUntil" TIMESTAMP(3),
  "knowledgeVersion" INTEGER NOT NULL DEFAULT 1,
  "policyVersion" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "KnowledgeApproval_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "KnowledgeApproval_knowledgeBaseId_key"
  ON "KnowledgeApproval"("knowledgeBaseId");
CREATE UNIQUE INDEX "KnowledgeApproval_sourceMessageId_key"
  ON "KnowledgeApproval"("sourceMessageId");
CREATE UNIQUE INDEX "KnowledgeApproval_sourceMessageRef_key"
  ON "KnowledgeApproval"("sourceMessageRef");
CREATE INDEX "KnowledgeApproval_workspaceId_verifiedAt_idx"
  ON "KnowledgeApproval"("workspaceId", "verifiedAt");
CREATE INDEX "KnowledgeApproval_agentId_validUntil_idx"
  ON "KnowledgeApproval"("agentId", "validUntil");
CREATE INDEX "KnowledgeApproval_verifiedByUserRef_idx"
  ON "KnowledgeApproval"("verifiedByUserRef");

ALTER TABLE "KnowledgeApproval"
  ADD CONSTRAINT "KnowledgeApproval_workspaceId_fkey"
  FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "KnowledgeApproval"
  ADD CONSTRAINT "KnowledgeApproval_agentId_fkey"
  FOREIGN KEY ("agentId") REFERENCES "Agent"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "KnowledgeApproval"
  ADD CONSTRAINT "KnowledgeApproval_knowledgeBaseId_fkey"
  FOREIGN KEY ("knowledgeBaseId") REFERENCES "KnowledgeBase"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "KnowledgeApproval"
  ADD CONSTRAINT "KnowledgeApproval_sourceMessageId_fkey"
  FOREIGN KEY ("sourceMessageId") REFERENCES "Message"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "KnowledgeApproval"
  ADD CONSTRAINT "KnowledgeApproval_verifiedByUserId_fkey"
  FOREIGN KEY ("verifiedByUserId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
