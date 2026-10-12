-- The fast tier moves to DeepSeek V4.1 Flash, the model the smart tier
-- already runs: on the understanding evaluation it reads more turns right,
-- answers sooner and costs less per request than V4 Flash. Only the previous
-- default is replaced, so a deliberate choice in the owner panel stays
-- untouched.
UPDATE "PlatformAiSettings"
SET "providerModels" = jsonb_set(
  COALESCE("providerModels", '{}'::jsonb),
  '{fast}', '"deepseek/deepseek-v4.1-flash"'
)
WHERE "id" = 'primary'
  AND COALESCE("providerModels"->>'fast', '') IN ('', 'deepseek/deepseek-v4-flash');
