-- CreateTable
CREATE TABLE "SkillFinding" (
    "id" TEXT NOT NULL,
    "skillKey" TEXT NOT NULL,
    "dedupeKey" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "agentId" TEXT,
    "conversationId" TEXT,
    "contactId" TEXT,
    "severity" TEXT NOT NULL DEFAULT 'MEDIUM',
    "title" TEXT NOT NULL,
    "diagnosis" TEXT NOT NULL,
    "evidence" JSONB,
    "suggestedAction" JSONB,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "occurrences" INTEGER NOT NULL DEFAULT 1,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "resolvedNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SkillFinding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SkillRun" (
    "id" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "skills" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'RUNNING',
    "agentsScanned" INTEGER NOT NULL DEFAULT 0,
    "conversationsScanned" INTEGER NOT NULL DEFAULT 0,
    "findingsCreated" INTEGER NOT NULL DEFAULT 0,
    "findingsUpdated" INTEGER NOT NULL DEFAULT 0,
    "findingsResolved" INTEGER NOT NULL DEFAULT 0,
    "llmRequests" INTEGER NOT NULL DEFAULT 0,
    "durationMs" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "SkillRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SkillFinding_status_severity_lastSeenAt_idx" ON "SkillFinding"("status", "severity", "lastSeenAt");

-- CreateIndex
CREATE INDEX "SkillFinding_skillKey_lastSeenAt_idx" ON "SkillFinding"("skillKey", "lastSeenAt");

-- CreateIndex
CREATE INDEX "SkillFinding_workspaceId_agentId_idx" ON "SkillFinding"("workspaceId", "agentId");

-- CreateIndex
CREATE UNIQUE INDEX "SkillFinding_skillKey_dedupeKey_key" ON "SkillFinding"("skillKey", "dedupeKey");

-- CreateIndex
CREATE INDEX "SkillRun_status_createdAt_idx" ON "SkillRun"("status", "createdAt");

-- CreateIndex
CREATE INDEX "SkillRun_source_mode_createdAt_idx" ON "SkillRun"("source", "mode", "createdAt");

-- AddForeignKey
ALTER TABLE "SkillFinding" ADD CONSTRAINT "SkillFinding_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillFinding" ADD CONSTRAINT "SkillFinding_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

