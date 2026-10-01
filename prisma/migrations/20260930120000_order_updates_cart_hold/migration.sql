-- Order status updates in chat, one-hour cart hold and the digital menu's
-- design settings. Additive only: new
-- columns are nullable or default to off, so the running app keeps working
-- before and after deploy.
ALTER TABLE "Agent" ADD COLUMN "orderUpdatesEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Agent" ADD COLUMN "cartHoldEnabled" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "OrderDraft" ADD COLUMN "heldUntil" TIMESTAMP(3);
ALTER TABLE "OrderDraft" ADD COLUMN "holdState" TEXT;
CREATE INDEX "OrderDraft_holdState_heldUntil_idx" ON "OrderDraft"("holdState", "heldUntil");

CREATE TABLE "OrderWatch" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "integrationId" TEXT NOT NULL,
    "externalOrderId" TEXT NOT NULL,
    "notifiedStatus" TEXT,
    "notifiedTracking" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "OrderWatch_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "OrderWatch_conversationId_integrationId_externalOrderId_key" ON "OrderWatch"("conversationId", "integrationId", "externalOrderId");
CREATE INDEX "OrderWatch_integrationId_externalOrderId_idx" ON "OrderWatch"("integrationId", "externalOrderId");
CREATE INDEX "OrderWatch_expiresAt_idx" ON "OrderWatch"("expiresAt");
ALTER TABLE "OrderWatch" ADD CONSTRAINT "OrderWatch_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Digital menu design & info (lib/menu/settings.ts); null = defaults.
ALTER TABLE "Workspace" ADD COLUMN "menuSettings" JSONB;
