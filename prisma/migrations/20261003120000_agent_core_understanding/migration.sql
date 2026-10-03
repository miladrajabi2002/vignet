-- Agent core upgrade: turn understanding (2026-10-03)
--
-- Additive only. Older code keeps working against this schema: every new
-- column is nullable or defaulted, and the new table is written only by the
-- understanding layer.

-- Auxiliary model calls name their job and the customer turn they served,
-- so the cost of a whole turn (reply + understanding + planners) adds up.
ALTER TABLE "UsageLog" ADD COLUMN IF NOT EXISTS "purpose" TEXT;
ALTER TABLE "UsageLog" ADD COLUMN IF NOT EXISTS "turnKey" TEXT;
CREATE INDEX IF NOT EXISTS "UsageLog_purpose_date_idx" ON "UsageLog" ("purpose", "date");
CREATE INDEX IF NOT EXISTS "UsageLog_turnKey_idx" ON "UsageLog" ("turnKey");

-- Rollout switch for the understanding layer (off | shadow | on, per domain).
ALTER TABLE "PlatformAiSettings" ADD COLUMN IF NOT EXISTS "understandingConfig" JSONB NOT NULL DEFAULT '{}';

-- Per-turn reading of the understanding layer next to the legacy router.
CREATE TABLE IF NOT EXISTS "TurnUnderstandingLog" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "messageId" TEXT,
    "mode" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "errorCode" TEXT,
    "model" TEXT,
    "latencyMs" INTEGER,
    "promptTokens" INTEGER NOT NULL DEFAULT 0,
    "completionTokens" INTEGER NOT NULL DEFAULT 0,
    "costUSD" DOUBLE PRECISION,
    "confidence" DOUBLE PRECISION,
    "acts" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "routedDomains" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "understanding" JSONB,
    "legacy" JSONB,
    "diffKinds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "agreed" BOOLEAN,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TurnUnderstandingLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "TurnUnderstandingLog_workspaceId_createdAt_idx" ON "TurnUnderstandingLog" ("workspaceId", "createdAt");
CREATE INDEX IF NOT EXISTS "TurnUnderstandingLog_createdAt_idx" ON "TurnUnderstandingLog" ("createdAt");
CREATE INDEX IF NOT EXISTS "TurnUnderstandingLog_conversationId_idx" ON "TurnUnderstandingLog" ("conversationId");

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'TurnUnderstandingLog_workspaceId_fkey'
    ) THEN
        ALTER TABLE "TurnUnderstandingLog"
            ADD CONSTRAINT "TurnUnderstandingLog_workspaceId_fkey"
            FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
