-- Query-performance indexes for hot tables (2026-09-15)
--
-- Applied online with CREATE INDEX CONCURRENTLY (no table lock) BEFORE
-- `prisma migrate deploy` recorded this migration. Re-running this file is
-- safe — every statement uses IF NOT EXISTS.
--
-- Justification (from EXPLAIN ANALYZE on Production):
-- 1. Contact: per-channel identity lookups were filtering INSIDE the workspace
--    partition (Filter ... Rows Removed by Filter). The new composite indexes
--    cover (workspaceId, <channelId>) for telegram/whatsapp/instagram/rubika/bale.
-- 2. Message: unanswered filter + createdAt DESC inside a conversation was
--    doing a Sort on top of an Index Scan + Filter. The new (conversationId,
--    unanswered, createdAt) makes it an Index Scan Backward with no sort.
-- 3. Notification: existing (workspaceId, read, createdAt) is ASC; the inbox
--    uses DESC. The new DESC variant lets the index walk newest-first.
-- 4. ConversationTurnLease: reaper scans leaseExpiresAt < now() AND leaseOwner
--    IS NOT NULL. Partial index keeps only "possibly-held" rows.
-- 5. InboundEvent: reaper scans state='PROCESSING' AND leaseExpiresAt < now().
--    Partial index covers exactly those rows.
-- 6. Product: catalog browse filters active=true AND deletedAt IS NULL. Partial.
-- 7. Conversation: inbox ORDER BY lastMessageAt DESC filtered by workspace +
--    status. Composite DESC partial (deletedAt IS NULL).
-- 8. HandoffAlert: operator triage by workspace + state + createdAt DESC.
-- 9. StoreOrder: customer detail page recent orders by (contactId, createdAt).

CREATE INDEX CONCURRENTLY IF NOT EXISTS "Contact_workspaceId_whatsappId_idx"
  ON "Contact" ("workspaceId", "whatsappId");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "Contact_workspaceId_instagramId_idx"
  ON "Contact" ("workspaceId", "instagramId");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "Contact_workspaceId_rubikaId_idx"
  ON "Contact" ("workspaceId", "rubikaId");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "Contact_workspaceId_baleId_idx"
  ON "Contact" ("workspaceId", "baleId");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "Contact_workspaceId_telegramId_idx"
  ON "Contact" ("workspaceId", "telegramId");

CREATE INDEX CONCURRENTLY IF NOT EXISTS "Message_conversationId_unanswered_createdAt_idx"
  ON "Message" ("conversationId", "unanswered", "createdAt");

CREATE INDEX CONCURRENTLY IF NOT EXISTS "Notification_workspaceId_read_createdAt_desc_idx"
  ON "Notification" ("workspaceId", "read", "createdAt" DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS "ConversationTurnLease_leaseExpiresAt_held_partial_idx"
  ON "ConversationTurnLease" ("leaseExpiresAt")
  WHERE "leaseOwner" IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS "InboundEvent_state_processing_leaseExpiresAt_partial_idx"
  ON "InboundEvent" ("leaseExpiresAt")
  WHERE state = 'PROCESSING';

CREATE INDEX CONCURRENTLY IF NOT EXISTS "Product_workspaceId_active_live_partial_idx"
  ON "Product" ("workspaceId", "updatedAt")
  WHERE "active" = TRUE AND "deletedAt" IS NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS "Conversation_workspaceId_status_lastMessageAt_desc_idx"
  ON "Conversation" ("workspaceId", "status", "lastMessageAt" DESC)
  WHERE "deletedAt" IS NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS "HandoffAlert_workspaceId_state_createdAt_desc_idx"
  ON "HandoffAlert" ("workspaceId", state, "createdAt" DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS "StoreOrder_contactId_createdAt_idx"
  ON "StoreOrder" ("contactId", "createdAt" DESC);
