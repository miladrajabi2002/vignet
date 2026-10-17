-- Drop indexes that another index already fully covers (2026-10-17).
--
-- Each index below is a strict leading-column prefix of another btree index on
-- the same table (same column order and direction), so PostgreSQL answers the
-- same lookups from the wider index. Keeping both only cost write time and
-- disk on every insert. The covering index is named next to each drop.
--
-- lock_timeout: a DROP waits for an exclusive lock; never queue behind a long
-- transaction and stall the table — fail fast and let the deploy retry.
SET lock_timeout = '5s';

-- covered by "OTPLog_phone_sentAt_idx"
DROP INDEX IF EXISTS "OTPLog_phone_idx";
-- covered by "AgentChannel_agentId_type_key"
DROP INDEX IF EXISTS "AgentChannel_agentId_idx";
-- covered by "ProductCategory_workspaceId_slug_key"
DROP INDEX IF EXISTS "ProductCategory_workspaceId_idx";
-- covered by "ProductCategory_sourceIntegrationId_externalId_key"
DROP INDEX IF EXISTS "ProductCategory_sourceIntegrationId_idx";
-- covered by "Product_workspaceId_name_idx"
DROP INDEX IF EXISTS "Product_workspaceId_idx";
-- covered by "AgentCatalog_agentId_productId_key"
DROP INDEX IF EXISTS "AgentCatalog_agentId_idx";
-- covered by "Contact_workspaceId_phone_idx"
DROP INDEX IF EXISTS "Contact_workspaceId_idx";
-- covered by "Conversation_workspaceId_status_idx"
DROP INDEX IF EXISTS "Conversation_workspaceId_idx";
-- covered by "Conversation_agentId_lastImprovementReviewAt_idx"
DROP INDEX IF EXISTS "Conversation_agentId_idx";
-- covered by "Message_conversationId_createdAt_idx"
DROP INDEX IF EXISTS "Message_conversationId_idx";
-- covered by "ErrorLog_level_createdAt_idx"
DROP INDEX IF EXISTS "ErrorLog_level_idx";
-- covered by "BlogCategory_workspaceId_slug_key"
DROP INDEX IF EXISTS "BlogCategory_workspaceId_idx";
-- covered by "HandoffAlert_workspaceId_state_createdAt_desc_idx"
DROP INDEX IF EXISTS "HandoffAlert_workspaceId_state_idx";
-- covered by "StoreOrder_contactId_createdAt_idx"
DROP INDEX IF EXISTS "StoreOrder_contactId_idx";
