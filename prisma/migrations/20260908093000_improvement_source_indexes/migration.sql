-- CreateIndex
CREATE INDEX "ImprovementRun_agentId_createdAt_idx" ON "ImprovementRun"("agentId", "createdAt");

-- CreateIndex
CREATE INDEX "ImprovementReview_conversationId_idx" ON "ImprovementReview"("conversationId");

-- CreateIndex
CREATE INDEX "ImprovementEvidence_reviewId_idx" ON "ImprovementEvidence"("reviewId");

-- CreateIndex
CREATE INDEX "ImprovementEvidence_messageId_idx" ON "ImprovementEvidence"("messageId");

