-- Account deletion owns the whole tenant lifecycle. Replacing the default
-- RESTRICT actions with CASCADE makes Workspace the single, reliable cleanup
-- root and prevents conversations/logs from surviving their account.

-- The WhatsApp transport is retired. Remove stored connection credentials and
-- durable delivery leases while preserving CRM contacts and conversation
-- history (the ChannelType enum intentionally remains for those old rows).
DELETE FROM "AgentChannel" WHERE "type" = 'WHATSAPP';

ALTER TABLE "User" DROP CONSTRAINT IF EXISTS "User_workspaceId_fkey";
ALTER TABLE "User" ADD CONSTRAINT "User_workspaceId_fkey"
  FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Agent" DROP CONSTRAINT IF EXISTS "Agent_workspaceId_fkey";
ALTER TABLE "Agent" ADD CONSTRAINT "Agent_workspaceId_fkey"
  FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AgentChannel" DROP CONSTRAINT IF EXISTS "AgentChannel_agentId_fkey";
ALTER TABLE "AgentChannel" ADD CONSTRAINT "AgentChannel_agentId_fkey"
  FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProductCategory" DROP CONSTRAINT IF EXISTS "ProductCategory_workspaceId_fkey";
ALTER TABLE "ProductCategory" ADD CONSTRAINT "ProductCategory_workspaceId_fkey"
  FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Product" DROP CONSTRAINT IF EXISTS "Product_workspaceId_fkey";
ALTER TABLE "Product" ADD CONSTRAINT "Product_workspaceId_fkey"
  FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "KnowledgeBase" DROP CONSTRAINT IF EXISTS "KnowledgeBase_agentId_fkey";
ALTER TABLE "KnowledgeBase" ADD CONSTRAINT "KnowledgeBase_agentId_fkey"
  FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Some early production databases were baselined with the initial migration
-- recorded as applied even though KnowledgeChunk was never created. Repair that
-- drift before changing its FK. CREATE ... IF NOT EXISTS preserves every row
-- when the table is already present and only rebuilds the missing empty table.
CREATE EXTENSION IF NOT EXISTS "vector";

CREATE TABLE IF NOT EXISTS "KnowledgeChunk" (
  "id" TEXT NOT NULL,
  "kbId" TEXT NOT NULL,
  "agentId" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "metadata" JSONB,
  "embedding" vector(1536),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "KnowledgeChunk_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "KnowledgeChunk_kbId_fkey"
    FOREIGN KEY ("kbId") REFERENCES "KnowledgeBase"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "KnowledgeChunk_agentId_idx"
  ON "KnowledgeChunk"("agentId");
CREATE INDEX IF NOT EXISTS "KnowledgeChunk_workspaceId_idx"
  ON "KnowledgeChunk"("workspaceId");
CREATE INDEX IF NOT EXISTS "KnowledgeChunk_embedding_idx"
  ON "KnowledgeChunk" USING hnsw ("embedding" vector_cosine_ops);
CREATE INDEX IF NOT EXISTS "KnowledgeChunk_content_fts_idx"
  ON "KnowledgeChunk" USING GIN (to_tsvector('simple', "content"));

ALTER TABLE "KnowledgeChunk" DROP CONSTRAINT IF EXISTS "KnowledgeChunk_agentId_fkey";
ALTER TABLE "KnowledgeChunk" ADD CONSTRAINT "KnowledgeChunk_agentId_fkey"
  FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Contact" DROP CONSTRAINT IF EXISTS "Contact_workspaceId_fkey";
ALTER TABLE "Contact" ADD CONSTRAINT "Contact_workspaceId_fkey"
  FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Conversation" DROP CONSTRAINT IF EXISTS "Conversation_workspaceId_fkey";
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_workspaceId_fkey"
  FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Conversation" DROP CONSTRAINT IF EXISTS "Conversation_agentId_fkey";
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_agentId_fkey"
  FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Message" DROP CONSTRAINT IF EXISTS "Message_conversationId_fkey";
ALTER TABLE "Message" ADD CONSTRAINT "Message_conversationId_fkey"
  FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "UsageLog" DROP CONSTRAINT IF EXISTS "UsageLog_workspaceId_fkey";
ALTER TABLE "UsageLog" ADD CONSTRAINT "UsageLog_workspaceId_fkey"
  FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Subscription" DROP CONSTRAINT IF EXISTS "Subscription_workspaceId_fkey";
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_workspaceId_fkey"
  FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Notification" DROP CONSTRAINT IF EXISTS "Notification_workspaceId_fkey";
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_workspaceId_fkey"
  FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "BlogCategory" DROP CONSTRAINT IF EXISTS "BlogCategory_workspaceId_fkey";
ALTER TABLE "BlogCategory" ADD CONSTRAINT "BlogCategory_workspaceId_fkey"
  FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "BlogPost" DROP CONSTRAINT IF EXISTS "BlogPost_workspaceId_fkey";
ALTER TABLE "BlogPost" ADD CONSTRAINT "BlogPost_workspaceId_fkey"
  FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "StoreSyncLog_outcome_createdAt_idx"
  ON "StoreSyncLog"("outcome", "createdAt");

CREATE TABLE "AdminMailboxMessage" (
  "id" TEXT NOT NULL,
  "providerEmailId" TEXT NOT NULL,
  "webhookEventId" TEXT,
  "messageId" TEXT,
  "from" TEXT NOT NULL,
  "to" TEXT[] NOT NULL,
  "cc" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "replyTo" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "subject" TEXT NOT NULL,
  "text" TEXT,
  "html" TEXT,
  "preview" TEXT NOT NULL,
  "attachments" JSONB,
  "receivedAt" TIMESTAMP(3) NOT NULL,
  "readAt" TIMESTAMP(3),
  "forwardedAt" TIMESTAMP(3),
  "repliedAt" TIMESTAMP(3),
  "replyText" TEXT,
  "replyProviderEmailId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "AdminMailboxMessage_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AdminMailboxMessage_providerEmailId_key"
  ON "AdminMailboxMessage"("providerEmailId");
CREATE UNIQUE INDEX "AdminMailboxMessage_webhookEventId_key"
  ON "AdminMailboxMessage"("webhookEventId");
CREATE INDEX "AdminMailboxMessage_readAt_receivedAt_idx"
  ON "AdminMailboxMessage"("readAt", "receivedAt");
CREATE INDEX "AdminMailboxMessage_receivedAt_idx"
  ON "AdminMailboxMessage"("receivedAt");
