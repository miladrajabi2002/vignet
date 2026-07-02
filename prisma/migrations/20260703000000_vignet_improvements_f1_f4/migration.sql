-- Vignet Improvements (F1-F4)
-- Adds: layered prompt config + role template + customer identification on Agent;
--       knowledge freshness fields; customer-info state on Conversation;
--       OperatorChannel, HandoffAlert, StoreIntegration, StoreOrder, StoreSyncLog.

-- AlterTable: Agent
ALTER TABLE "Agent" ADD COLUMN "promptConfig" JSONB,
                       ADD COLUMN "roleTemplate" TEXT,
                       ADD COLUMN "requireCustomerInfo" BOOLEAN NOT NULL DEFAULT false,
                       ADD COLUMN "customerInfoPrompt" TEXT;

-- AlterTable: KnowledgeBase (freshness)
ALTER TABLE "KnowledgeBase" ADD COLUMN "lastIngestedAt" TIMESTAMP(3),
                            ADD COLUMN "refreshIntervalHours" INTEGER NOT NULL DEFAULT 0;

-- AlterTable: Conversation (customer-info state)
ALTER TABLE "Conversation" ADD COLUMN "customerInfoState" TEXT NOT NULL DEFAULT 'pending',
                           ADD COLUMN "identifiedAt" TIMESTAMP(3);

-- CreateTable: OperatorChannel
CREATE TABLE "OperatorChannel" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "botToken" TEXT NOT NULL,
    "operatorChatId" TEXT,
    "botUsername" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OperatorChannel_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "OperatorChannel_workspaceId_key" ON "OperatorChannel"("workspaceId");
ALTER TABLE "OperatorChannel" ADD CONSTRAINT "OperatorChannel_workspaceId_fkey"
  FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable: HandoffAlert
CREATE TABLE "HandoffAlert" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "contactName" TEXT,
    "contactPhone" TEXT,
    "channel" "ChannelType" NOT NULL,
    "reason" TEXT,
    "summary" TEXT,
    "state" TEXT NOT NULL DEFAULT 'open',
    "claimedBy" TEXT,
    "externalMessageId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "HandoffAlert_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "HandoffAlert_workspaceId_state_idx" ON "HandoffAlert"("workspaceId", "state");
CREATE INDEX "HandoffAlert_conversationId_idx" ON "HandoffAlert"("conversationId");
CREATE INDEX "HandoffAlert_agentId_idx" ON "HandoffAlert"("agentId");
ALTER TABLE "HandoffAlert" ADD CONSTRAINT "HandoffAlert_workspaceId_fkey"
  FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "HandoffAlert" ADD CONSTRAINT "HandoffAlert_conversationId_fkey"
  FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "HandoffAlert" ADD CONSTRAINT "HandoffAlert_agentId_fkey"
  FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateEnum: StoreType
CREATE TYPE "StoreType" AS ENUM ('WOOCOMMERCE', 'CUSTOM_URL', 'SHOPIFY');

-- CreateTable: StoreIntegration
CREATE TABLE "StoreIntegration" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "type" "StoreType" NOT NULL,
    "storeUrl" TEXT NOT NULL,
    "credentials" JSONB NOT NULL,
    "webhookSecret" TEXT,
    "pollIntervalMinutes" INTEGER NOT NULL DEFAULT 30,
    "lastSyncAt" TIMESTAMP(3),
    "lastSyncStatus" TEXT,
    "lastSyncError" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StoreIntegration_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "StoreIntegration_workspaceId_idx" ON "StoreIntegration"("workspaceId");
ALTER TABLE "StoreIntegration" ADD CONSTRAINT "StoreIntegration_workspaceId_fkey"
  FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable: StoreOrder
CREATE TABLE "StoreOrder" (
    "id" TEXT NOT NULL,
    "integrationId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "externalOrderId" TEXT NOT NULL,
    "contactId" TEXT,
    "customerName" TEXT,
    "customerPhone" TEXT,
    "customerEmail" TEXT,
    "status" TEXT NOT NULL,
    "total" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'IRR',
    "itemCount" INTEGER NOT NULL DEFAULT 0,
    "itemsSummary" TEXT,
    "paymentMethod" TEXT,
    "shippingMethod" TEXT,
    "trackingCode" TEXT,
    "orderDate" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StoreOrder_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "StoreOrder_integrationId_externalOrderId_key"
  ON "StoreOrder"("integrationId", "externalOrderId");
CREATE INDEX "StoreOrder_workspaceId_idx" ON "StoreOrder"("workspaceId");
CREATE INDEX "StoreOrder_contactId_idx" ON "StoreOrder"("contactId");
CREATE INDEX "StoreOrder_externalOrderId_idx" ON "StoreOrder"("externalOrderId");
ALTER TABLE "StoreOrder" ADD CONSTRAINT "StoreOrder_integrationId_fkey"
  FOREIGN KEY ("integrationId") REFERENCES "StoreIntegration"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable: StoreSyncLog
CREATE TABLE "StoreSyncLog" (
    "id" TEXT NOT NULL,
    "integrationId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "outcome" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "message" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StoreSyncLog_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "StoreSyncLog_integrationId_createdAt_idx" ON "StoreSyncLog"("integrationId", "createdAt");
CREATE INDEX "StoreSyncLog_workspaceId_idx" ON "StoreSyncLog"("workspaceId");
ALTER TABLE "StoreSyncLog" ADD CONSTRAINT "StoreSyncLog_integrationId_fkey"
  FOREIGN KEY ("integrationId") REFERENCES "StoreIntegration"("id") ON DELETE CASCADE ON UPDATE CASCADE;
