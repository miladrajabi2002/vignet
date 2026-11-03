-- Expired-trial data purge: warning and purge timestamps.
ALTER TABLE "Workspace" ADD COLUMN "trialPurgeWarnedAt" TIMESTAMP(3);
ALTER TABLE "Workspace" ADD COLUMN "trialDataPurgedAt" TIMESTAMP(3);
