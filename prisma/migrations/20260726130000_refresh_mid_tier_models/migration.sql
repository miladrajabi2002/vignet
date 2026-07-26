-- Refresh the two middle managed tiers. The operator had temporarily pointed
-- standard/balanced at duplicate DeepSeek slugs; re-point them at the new
-- catalog defaults (Gemini 3.1 Flash Lite / GPT-5.4 Nano). Only known
-- stale/duplicate values are replaced, so any other deliberate customization
-- (and the fast/premium tiers) stays untouched.
UPDATE "PlatformAiSettings"
SET "providerModels" = jsonb_set(
  COALESCE("providerModels", '{}'::jsonb),
  '{standard}', '"google/gemini-3.1-flash-lite"'
)
WHERE "id" = 'primary'
  AND COALESCE("providerModels"->>'standard', '') IN (
    '', 'deepseek/deepseek-v4-flash', 'deepseek/deepseek-v4-pro', 'deepseek/deepseek-chat',
    'openai/gpt-4o-mini', 'qwen/qwen3.7-plus'
  );

UPDATE "PlatformAiSettings"
SET "providerModels" = jsonb_set(
  COALESCE("providerModels", '{}'::jsonb),
  '{balanced}', '"openai/gpt-5.4-nano"'
)
WHERE "id" = 'primary'
  AND COALESCE("providerModels"->>'balanced', '') IN (
    '', 'deepseek/deepseek-v4-flash', 'deepseek/deepseek-v4-pro', 'deepseek/deepseek-chat',
    'qwen/qwen3.5-35b-a3b', 'qwen/qwen3.6-35b-a3b'
  );
