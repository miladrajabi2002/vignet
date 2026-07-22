-- Track every conversation mutation, not only creation/last-message changes.
-- This lets the CRM live probe refresh older conversations after status,
-- ownership, summary, identity, or delivery updates.
ALTER TABLE "Conversation"
ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX "Conversation_workspaceId_updatedAt_idx"
ON "Conversation"("workspaceId", "updatedAt");

-- Canonicalize existing Iranian mobile values to +989XXXXXXXXX. This covers
-- the formats accepted by the application, including Persian/Arabic digits.
WITH normalized AS (
  SELECT
    "id",
    regexp_replace(
      translate(
        "phone",
        '۰۱۲۳۴۵۶۷۸۹٠١٢٣٤٥٦٧٨٩',
        '01234567890123456789'
      ),
      '[^0-9]',
      '',
      'g'
    ) AS digits
  FROM "Contact"
  WHERE "phone" IS NOT NULL
)
UPDATE "Contact" AS contact
SET
  "phone" = CASE
    WHEN normalized.digits ~ '^00989[0-9]{9}$' THEN '+' || substring(normalized.digits FROM 3)
    WHEN normalized.digits ~ '^989[0-9]{9}$' THEN '+' || normalized.digits
    WHEN normalized.digits ~ '^09[0-9]{9}$' THEN '+98' || substring(normalized.digits FROM 2)
    WHEN normalized.digits ~ '^9[0-9]{9}$' THEN '+98' || normalized.digits
    ELSE contact."phone"
  END,
  "updatedAt" = CURRENT_TIMESTAMP
FROM normalized
WHERE contact."id" = normalized."id"
  AND normalized.digits ~ '^(00989|989|09|9)[0-9]{9}$';

-- Merge duplicate contacts made by historical phone formatting differences.
-- Groups with conflicting IDs for the same channel are deliberately skipped:
-- the current Contact model can represent one identity per channel and the
-- migration must never discard a second real account.
DO $$
DECLARE
  duplicate RECORD;
BEGIN
  FOR duplicate IN
    WITH safe_groups AS (
      SELECT "workspaceId", "phone"
      FROM "Contact"
      WHERE "phone" IS NOT NULL
      GROUP BY "workspaceId", "phone"
      HAVING COUNT(*) > 1
        AND COUNT(DISTINCT "telegramId") FILTER (WHERE "telegramId" IS NOT NULL) <= 1
        AND COUNT(DISTINCT "whatsappId") FILTER (WHERE "whatsappId" IS NOT NULL) <= 1
        AND COUNT(DISTINCT "instagramId") FILTER (WHERE "instagramId" IS NOT NULL) <= 1
        AND COUNT(DISTINCT "rubikaId") FILTER (WHERE "rubikaId" IS NOT NULL) <= 1
        AND COUNT(DISTINCT "baleId") FILTER (WHERE "baleId" IS NOT NULL) <= 1
    ), ranked AS (
      SELECT
        contact."id",
        first_value(contact."id") OVER (
          PARTITION BY contact."workspaceId", contact."phone"
          ORDER BY contact."createdAt" ASC, contact."id" ASC
        ) AS survivor_id
      FROM "Contact" AS contact
      JOIN safe_groups
        ON safe_groups."workspaceId" = contact."workspaceId"
       AND safe_groups."phone" = contact."phone"
    )
    SELECT "id" AS duplicate_id, survivor_id
    FROM ranked
    WHERE "id" <> survivor_id
  LOOP
    DELETE FROM "CampaignRecipient" AS recipient
    WHERE recipient."contactId" = duplicate.duplicate_id
      AND EXISTS (
        SELECT 1
        FROM "CampaignRecipient" AS survivor_recipient
        WHERE survivor_recipient."campaignId" = recipient."campaignId"
          AND survivor_recipient."contactId" = duplicate.survivor_id
      );

    UPDATE "CampaignRecipient" SET "contactId" = duplicate.survivor_id
    WHERE "contactId" = duplicate.duplicate_id;
    UPDATE "Conversation" SET "contactId" = duplicate.survivor_id
    WHERE "contactId" = duplicate.duplicate_id;
    UPDATE "Appointment" SET "contactId" = duplicate.survivor_id
    WHERE "contactId" = duplicate.duplicate_id;
    UPDATE "StoreOrder" SET "contactId" = duplicate.survivor_id
    WHERE "contactId" = duplicate.duplicate_id;
    UPDATE "InstagramFollowGate" SET "contactId" = duplicate.survivor_id
    WHERE "contactId" = duplicate.duplicate_id;

    UPDATE "Contact" AS survivor
    SET
      "name" = COALESCE(survivor."name", source."name"),
      "telegramId" = COALESCE(survivor."telegramId", source."telegramId"),
      "whatsappId" = COALESCE(survivor."whatsappId", source."whatsappId"),
      "instagramId" = COALESCE(survivor."instagramId", source."instagramId"),
      "rubikaId" = COALESCE(survivor."rubikaId", source."rubikaId"),
      "baleId" = COALESCE(survivor."baleId", source."baleId"),
      "telegramUsername" = COALESCE(survivor."telegramUsername", source."telegramUsername"),
      "telegramAvatarUrl" = COALESCE(survivor."telegramAvatarUrl", source."telegramAvatarUrl"),
      "baleUsername" = COALESCE(survivor."baleUsername", source."baleUsername"),
      "baleAvatarUrl" = COALESCE(survivor."baleAvatarUrl", source."baleAvatarUrl"),
      "rubikaUsername" = COALESCE(survivor."rubikaUsername", source."rubikaUsername"),
      "rubikaAvatarUrl" = COALESCE(survivor."rubikaAvatarUrl", source."rubikaAvatarUrl"),
      "whatsappName" = COALESCE(survivor."whatsappName", source."whatsappName"),
      "whatsappAvatarUrl" = COALESCE(survivor."whatsappAvatarUrl", source."whatsappAvatarUrl"),
      "instagramUsername" = COALESCE(survivor."instagramUsername", source."instagramUsername"),
      "instagramAvatarUrl" = COALESCE(survivor."instagramAvatarUrl", source."instagramAvatarUrl"),
      "tags" = ARRAY(
        SELECT DISTINCT unnest(survivor."tags" || source."tags")
      ),
      "notes" = CASE
        WHEN survivor."notes" IS NULL THEN source."notes"
        WHEN source."notes" IS NULL OR source."notes" = survivor."notes" THEN survivor."notes"
        ELSE survivor."notes" || E'\n\n' || source."notes"
      END,
      "lastActivityAt" = GREATEST(survivor."lastActivityAt", source."lastActivityAt"),
      "marketingOptInAt" = GREATEST(survivor."marketingOptInAt", source."marketingOptInAt"),
      "marketingOptOutAt" = GREATEST(survivor."marketingOptOutAt", source."marketingOptOutAt"),
      "marketingOptIn" = CASE
        WHEN GREATEST(survivor."marketingOptOutAt", source."marketingOptOutAt") >
             GREATEST(survivor."marketingOptInAt", source."marketingOptInAt") THEN FALSE
        WHEN GREATEST(survivor."marketingOptInAt", source."marketingOptInAt") IS NOT NULL THEN TRUE
        ELSE survivor."marketingOptIn" OR source."marketingOptIn"
      END,
      "updatedAt" = CURRENT_TIMESTAMP
    FROM "Contact" AS source
    WHERE survivor."id" = duplicate.survivor_id
      AND source."id" = duplicate.duplicate_id;

    DELETE FROM "Contact" WHERE "id" = duplicate.duplicate_id;
  END LOOP;
END $$;

CREATE INDEX "Contact_workspaceId_phone_idx"
ON "Contact"("workspaceId", "phone");
