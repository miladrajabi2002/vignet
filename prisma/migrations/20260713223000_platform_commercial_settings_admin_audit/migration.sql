-- Runtime commercial/voice policy managed from the owner-only admin panel.
ALTER TABLE "PlatformAiSettings"
  ADD COLUMN IF NOT EXISTS "sttModel" TEXT NOT NULL DEFAULT 'openai/whisper-large-v3-turbo',
  ADD COLUMN IF NOT EXISTS "ttsModel" TEXT NOT NULL DEFAULT 'openai/gpt-4o-mini-tts-2025-12-15',
  ADD COLUMN IF NOT EXISTS "providerSort" TEXT NOT NULL DEFAULT 'price',
  ADD COLUMN IF NOT EXISTS "zeroDataRetention" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "replyPricesIRR" JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS "trialCreditIRR" INTEGER NOT NULL DEFAULT 100000,
  ADD COLUMN IF NOT EXISTS "planConfig" JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS "financeUsdToIRR" INTEGER;

CREATE TABLE IF NOT EXISTS "AdminAuditLog" (
  "id" TEXT NOT NULL,
  "adminPhone" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "targetType" TEXT NOT NULL,
  "targetId" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AdminAuditLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "AdminAuditLog_createdAt_idx" ON "AdminAuditLog"("createdAt");
CREATE INDEX IF NOT EXISTS "AdminAuditLog_action_createdAt_idx" ON "AdminAuditLog"("action", "createdAt");
CREATE INDEX IF NOT EXISTS "AdminAuditLog_targetType_targetId_idx" ON "AdminAuditLog"("targetType", "targetId");
