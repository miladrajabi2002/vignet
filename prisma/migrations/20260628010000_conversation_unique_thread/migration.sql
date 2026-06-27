-- Make each platform thread map to a single ongoing conversation.
--
-- Before adding the unique constraint we must collapse any duplicate
-- conversations that earlier (pre-fix) webhook deliveries may have created for
-- the same (agentId, channel, externalId). For each such group we keep the most
-- recently created row as the survivor, re-point its messages and usage logs to
-- the survivor, then delete the redundant rows. Rows with a NULL externalId
-- (e.g. web widget) are left untouched — NULLs are distinct in a unique index.

WITH ranked AS (
  SELECT
    "id",
    "agentId",
    "channel",
    "externalId",
    ROW_NUMBER() OVER (
      PARTITION BY "agentId", "channel", "externalId"
      ORDER BY "createdAt" DESC
    ) AS rn,
    FIRST_VALUE("id") OVER (
      PARTITION BY "agentId", "channel", "externalId"
      ORDER BY "createdAt" DESC
    ) AS survivor_id
  FROM "Conversation"
  WHERE "externalId" IS NOT NULL
),
dups AS (
  SELECT "id", survivor_id FROM ranked WHERE rn > 1
)
-- Re-point child messages onto the survivor.
UPDATE "Message" m
SET "conversationId" = d.survivor_id
FROM dups d
WHERE m."conversationId" = d."id";

WITH ranked AS (
  SELECT
    "id",
    ROW_NUMBER() OVER (
      PARTITION BY "agentId", "channel", "externalId"
      ORDER BY "createdAt" DESC
    ) AS rn,
    FIRST_VALUE("id") OVER (
      PARTITION BY "agentId", "channel", "externalId"
      ORDER BY "createdAt" DESC
    ) AS survivor_id
  FROM "Conversation"
  WHERE "externalId" IS NOT NULL
),
dups AS (
  SELECT "id", survivor_id FROM ranked WHERE rn > 1
)
-- Re-point usage logs onto the survivor.
UPDATE "UsageLog" u
SET "conversationId" = d.survivor_id
FROM dups d
WHERE u."conversationId" = d."id";

WITH ranked AS (
  SELECT
    "id",
    ROW_NUMBER() OVER (
      PARTITION BY "agentId", "channel", "externalId"
      ORDER BY "createdAt" DESC
    ) AS rn
  FROM "Conversation"
  WHERE "externalId" IS NOT NULL
)
DELETE FROM "Conversation"
WHERE "id" IN (SELECT "id" FROM ranked WHERE rn > 1);

-- Now the column tuple is unique; enforce it.
CREATE UNIQUE INDEX "Conversation_agentId_channel_externalId_key"
  ON "Conversation" ("agentId", "channel", "externalId");
