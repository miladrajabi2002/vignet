-- Agent generation controls are platform-managed. Normalize existing agents so
-- historical form values cannot produce different customer-facing behavior.
ALTER TABLE "Agent" ALTER COLUMN "temperature" SET DEFAULT 0.55;
ALTER TABLE "Agent" ALTER COLUMN "maxTokens" SET DEFAULT 600;

UPDATE "Agent" SET "temperature" = 0.55, "maxTokens" = 600;

ALTER TABLE "AgentVersion" ALTER COLUMN "temperature" SET DEFAULT 0.55;
ALTER TABLE "AgentVersion" ALTER COLUMN "maxTokens" SET DEFAULT 600;
