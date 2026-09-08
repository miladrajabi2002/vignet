-- AlterTable
ALTER TABLE "Agent" ADD COLUMN     "improvementSettings" JSONB;

-- CreateTable
CREATE TABLE "ImprovementRun" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "total" INTEGER NOT NULL,
    "filters" JSONB NOT NULL,
    "snapshot" JSONB NOT NULL,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "ImprovementRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImprovementReview" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "result" JSONB,
    "checkpoint" JSONB,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ImprovementReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImprovementSuggestion" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "topicKey" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "diagnosis" TEXT NOT NULL,
    "priority" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "draft" JSONB NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "preview" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ImprovementSuggestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImprovementEvidence" (
    "suggestionId" TEXT NOT NULL,
    "reviewId" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,

    CONSTRAINT "ImprovementEvidence_pkey" PRIMARY KEY ("suggestionId","reviewId","messageId")
);

-- CreateTable
CREATE TABLE "ImprovementChange" (
    "id" TEXT NOT NULL,
    "suggestionId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "targetId" TEXT,
    "before" JSONB NOT NULL,
    "after" JSONB NOT NULL,
    "revertedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ImprovementChange_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ImprovementRun_workspaceId_agentId_createdAt_idx" ON "ImprovementRun"("workspaceId", "agentId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ImprovementReview_runId_conversationId_key" ON "ImprovementReview"("runId", "conversationId");

-- CreateIndex
CREATE INDEX "ImprovementSuggestion_workspaceId_agentId_status_idx" ON "ImprovementSuggestion"("workspaceId", "agentId", "status");

-- CreateIndex
CREATE INDEX "ImprovementSuggestion_agentId_topicKey_idx" ON "ImprovementSuggestion"("agentId", "topicKey");

-- CreateIndex
CREATE INDEX "ImprovementChange_suggestionId_createdAt_idx" ON "ImprovementChange"("suggestionId", "createdAt");

-- AddForeignKey
ALTER TABLE "ImprovementRun" ADD CONSTRAINT "ImprovementRun_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImprovementReview" ADD CONSTRAINT "ImprovementReview_runId_fkey" FOREIGN KEY ("runId") REFERENCES "ImprovementRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImprovementReview" ADD CONSTRAINT "ImprovementReview_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImprovementSuggestion" ADD CONSTRAINT "ImprovementSuggestion_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImprovementEvidence" ADD CONSTRAINT "ImprovementEvidence_suggestionId_fkey" FOREIGN KEY ("suggestionId") REFERENCES "ImprovementSuggestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImprovementEvidence" ADD CONSTRAINT "ImprovementEvidence_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "ImprovementReview"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImprovementEvidence" ADD CONSTRAINT "ImprovementEvidence_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImprovementChange" ADD CONSTRAINT "ImprovementChange_suggestionId_fkey" FOREIGN KEY ("suggestionId") REFERENCES "ImprovementSuggestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

