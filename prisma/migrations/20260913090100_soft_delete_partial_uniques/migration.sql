-- Soft delete (undo) support, step 2 of 2: make the three composite unique
-- indexes PARTIAL so a soft-deleted ("trashed") row no longer blocks a new
-- live row with the same natural key:
--
--   • Conversation(agentId, channel, externalId) — a customer who messages
--     again while their previous conversation sits in the undo window must
--     get a new live conversation instead of a unique-violation 500.
--   • Product(sourceIntegrationId, externalId) — a WooCommerce re-sync of a
--     soft-deleted product must be able to recreate it.
--   • StoreOrder(integrationId, externalOrderId) — same reasoning for orders.
--
-- Uniqueness is therefore enforced among LIVE rows only. Restoring (undo)
-- a trashed row whose key was taken by a new live row is rejected with P2002
-- and skipped gracefully by the restore endpoints.
--
-- NOTE: Prisma's schema DSL cannot express partial indexes, so schema.prisma
-- still declares these as plain @@unique — the same convention already used
-- by Product_manual_workspaceId_sku_key (see 20260726100000). Do not run
-- `prisma db push` / `migrate dev` against production.

DROP INDEX "Conversation_agentId_channel_externalId_key";
CREATE UNIQUE INDEX "Conversation_agentId_channel_externalId_key"
  ON "Conversation"("agentId", "channel", "externalId")
  WHERE "deletedAt" IS NULL;

DROP INDEX "Product_sourceIntegrationId_externalId_key";
CREATE UNIQUE INDEX "Product_sourceIntegrationId_externalId_key"
  ON "Product"("sourceIntegrationId", "externalId")
  WHERE "deletedAt" IS NULL;

DROP INDEX "StoreOrder_integrationId_externalOrderId_key";
CREATE UNIQUE INDEX "StoreOrder_integrationId_externalOrderId_key"
  ON "StoreOrder"("integrationId", "externalOrderId")
  WHERE "deletedAt" IS NULL;
