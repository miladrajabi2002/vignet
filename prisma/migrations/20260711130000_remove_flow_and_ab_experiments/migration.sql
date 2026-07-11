BEGIN;

-- Preserve legacy Instagram automation behavior before FLOW is removed from
-- application types and validation. Some historical/shadow databases do not
-- contain this table, so only touch it when both the table and action column
-- exist. FLOW has always been an alias of AI.
DO $$
BEGIN
    IF to_regclass('"InstagramAutomation"') IS NOT NULL
       AND EXISTS (
           SELECT 1
           FROM pg_attribute
           WHERE attrelid = to_regclass('"InstagramAutomation"')
             AND attname = 'action'
             AND NOT attisdropped
       ) THEN
        EXECUTE $sql$
            UPDATE "InstagramAutomation"
            SET "action" = jsonb_set("action"::jsonb, '{replyMode}', '"AI"'::jsonb, false)
            WHERE "action"->>'replyMode' = 'FLOW'
        $sql$;
    END IF;
END $$;

-- Version rollback must include the structured prompt that currently drives
-- the prompt builder. Nullable columns preserve all legacy snapshots.
ALTER TABLE IF EXISTS "AgentVersion"
    ADD COLUMN IF NOT EXISTS "promptConfig" JSONB,
    ADD COLUMN IF NOT EXISTS "roleTemplate" TEXT;

-- Remove the retired visual flow builder and prompt experiment persistence.
-- IF EXISTS keeps this forward migration safe to retry and compatible with
-- older shadow databases whose historical schema omitted one of these fields.
ALTER TABLE IF EXISTS "Agent"
    DROP COLUMN IF EXISTS "flowConfig",
    DROP COLUMN IF EXISTS "experimentActive",
    DROP COLUMN IF EXISTS "experimentVariantPrompt",
    DROP COLUMN IF EXISTS "experimentSplit";

ALTER TABLE IF EXISTS "Conversation" DROP COLUMN IF EXISTS "variant";

COMMIT;
