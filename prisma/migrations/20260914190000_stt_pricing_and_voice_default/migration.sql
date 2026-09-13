ALTER TABLE "Agent"
ALTER COLUMN "voiceInputEnabled" SET DEFAULT true;

UPDATE "Agent"
SET "voiceInputEnabled" = true;

ALTER TABLE "UsageLog"
ADD COLUMN "audioSeconds" DOUBLE PRECISION;

ALTER TABLE "PlatformAiSettings"
ADD COLUMN "sttPricePerMinuteIRR" INTEGER NOT NULL DEFAULT 100;

UPDATE "PlatformAiSettings"
SET "sttModel" = 'openai/whisper-large-v3-turbo',
    "sttPricePerMinuteIRR" = 100;
