-- Operator bot: per-category alert preferences (missing keys default to on).
ALTER TABLE "OperatorChannel" ADD COLUMN "prefs" JSONB;
