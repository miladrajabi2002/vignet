-- Operator handoff is always on: the per-agent switch is gone, so every agent
-- that had it off is switched back on and new agents start with it on.
UPDATE "Agent" SET "handoffEnabled" = true WHERE "handoffEnabled" = false;
ALTER TABLE "Agent" ALTER COLUMN "handoffEnabled" SET DEFAULT true;
