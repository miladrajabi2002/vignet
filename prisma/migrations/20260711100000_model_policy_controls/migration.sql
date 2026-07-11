-- Admin-managed provider model mapping and plan-specific trial model.
ALTER TABLE "PlatformAiSettings"
  ADD COLUMN "trialModel" TEXT NOT NULL DEFAULT 'fast',
  ADD COLUMN "providerModels" JSONB NOT NULL DEFAULT '{}'::jsonb;

UPDATE "PlatformAiSettings"
SET
  "enabledModels" = ARRAY['fast', 'standard', 'balanced', 'premium']::TEXT[],
  "providerModels" = '{
    "fast": "deepseek/deepseek-v4-flash",
    "standard": "openai/gpt-4o-mini",
    "balanced": "qwen/qwen3.5-35b-a3b",
    "premium": "deepseek/deepseek-v4-pro"
  }'::jsonb
WHERE "id" = 'primary';
