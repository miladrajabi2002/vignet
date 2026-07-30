-- Durable event states for at-least-once channel webhooks.
CREATE TYPE "InboundEventState" AS ENUM (
  'RECEIVED',
  'PROCESSING',
  'EFFECTS_COMMITTED',
  'COMPLETED',
  'DELIVERY_UNCERTAIN',
  'FAILED'
);

CREATE TABLE "InboundEvent" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "channelId" TEXT NOT NULL,
  "externalEventId" TEXT NOT NULL,
  "conversationKey" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "payloadHash" TEXT NOT NULL,
  "payload" JSONB,
  "state" "InboundEventState" NOT NULL DEFAULT 'RECEIVED',
  "leaseOwner" TEXT,
  "leaseToken" INTEGER NOT NULL DEFAULT 0,
  "leaseExpiresAt" TIMESTAMP(3),
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "conversationId" TEXT,
  "inboundMessageId" TEXT,
  "resultMessageId" TEXT,
  "result" JSONB,
  "lastError" TEXT,
  "processingStartedAt" TIMESTAMP(3),
  "effectsCommittedAt" TIMESTAMP(3),
  "deliveryStartedAt" TIMESTAMP(3),
  "deliveryCompletedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "InboundEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ConversationTurnLease" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "channelId" TEXT NOT NULL,
  "conversationKey" TEXT NOT NULL,
  "leaseOwner" TEXT,
  "fencingToken" INTEGER NOT NULL DEFAULT 0,
  "leaseExpiresAt" TIMESTAMP(3),
  "eventId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ConversationTurnLease_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Message"
  ADD COLUMN "inboundEventId" TEXT,
  ADD COLUMN "resultForInboundEventId" TEXT;

CREATE UNIQUE INDEX "InboundEvent_workspaceId_channelId_externalEventId_key"
  ON "InboundEvent"("workspaceId", "channelId", "externalEventId");
CREATE INDEX "InboundEvent_state_leaseExpiresAt_idx"
  ON "InboundEvent"("state", "leaseExpiresAt");
CREATE INDEX "InboundEvent_workspaceId_createdAt_idx"
  ON "InboundEvent"("workspaceId", "createdAt");
CREATE INDEX "InboundEvent_channelId_conversationKey_idx"
  ON "InboundEvent"("channelId", "conversationKey");

CREATE UNIQUE INDEX "ConversationTurnLease_workspaceId_channelId_conversationKey_key"
  ON "ConversationTurnLease"("workspaceId", "channelId", "conversationKey");
CREATE INDEX "ConversationTurnLease_leaseExpiresAt_idx"
  ON "ConversationTurnLease"("leaseExpiresAt");
CREATE INDEX "ConversationTurnLease_eventId_idx"
  ON "ConversationTurnLease"("eventId");

CREATE UNIQUE INDEX "Message_inboundEventId_key" ON "Message"("inboundEventId");
CREATE UNIQUE INDEX "Message_resultForInboundEventId_key" ON "Message"("resultForInboundEventId");

ALTER TABLE "InboundEvent"
  ADD CONSTRAINT "InboundEvent_workspaceId_fkey"
  FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InboundEvent"
  ADD CONSTRAINT "InboundEvent_channelId_fkey"
  FOREIGN KEY ("channelId") REFERENCES "AgentChannel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ConversationTurnLease"
  ADD CONSTRAINT "ConversationTurnLease_workspaceId_fkey"
  FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ConversationTurnLease"
  ADD CONSTRAINT "ConversationTurnLease_channelId_fkey"
  FOREIGN KEY ("channelId") REFERENCES "AgentChannel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Message"
  ADD CONSTRAINT "Message_inboundEventId_fkey"
  FOREIGN KEY ("inboundEventId") REFERENCES "InboundEvent"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Message"
  ADD CONSTRAINT "Message_resultForInboundEventId_fkey"
  FOREIGN KEY ("resultForInboundEventId") REFERENCES "InboundEvent"("id") ON DELETE SET NULL ON UPDATE CASCADE;
