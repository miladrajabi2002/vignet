-- Captured application errors surfaced in the /admin monitoring dashboard,
-- so the operator can watch production health without tailing PM2 logs.
CREATE TABLE "ErrorLog" (
    "id" TEXT NOT NULL,
    "level" TEXT NOT NULL DEFAULT 'error',
    "source" TEXT,
    "message" TEXT NOT NULL,
    "stack" TEXT,
    "workspaceId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ErrorLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ErrorLog_createdAt_idx" ON "ErrorLog"("createdAt");
CREATE INDEX "ErrorLog_level_idx" ON "ErrorLog"("level");
