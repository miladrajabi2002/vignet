-- Vigent fixes: A16 trial quota alerting, A20 real channel health checks,
-- A8 order verification enabled by default.

-- A16: trial quota alerting latches on the workspace
ALTER TABLE "Workspace" ADD COLUMN "trialInitialCreditIRR" INTEGER;
ALTER TABLE "Workspace" ADD COLUMN "trialQuota80AlertedAt" TIMESTAMP(3);
ALTER TABLE "Workspace" ADD COLUMN "trialQuota100AlertedAt" TIMESTAMP(3);

-- A20: periodic health check results on connected channels
ALTER TABLE "AgentChannel" ADD COLUMN "healthStatus" TEXT NOT NULL DEFAULT 'unknown';
ALTER TABLE "AgentChannel" ADD COLUMN "healthCheckedAt" TIMESTAMP(3);
ALTER TABLE "AgentChannel" ADD COLUMN "healthError" TEXT;
CREATE INDEX "AgentChannel_healthStatus_idx" ON "AgentChannel"("healthStatus");

-- A8: verified order answers on for every agent by default. Tenants without a
-- connected store see no change (no orders match), and each agent's flag
-- remains the per-tenant off switch.
ALTER TABLE "Agent" ALTER COLUMN "orderTrackingEnabled" SET DEFAULT true;
UPDATE "Agent" SET "orderTrackingEnabled" = true WHERE "orderTrackingEnabled" = false;
