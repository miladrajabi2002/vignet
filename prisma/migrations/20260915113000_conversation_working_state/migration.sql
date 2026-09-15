-- Structured, session-scoped working state for the shared chat engine.
-- This is additive and safe to deploy while old application instances run:
-- no existing rows or conversation history are rewritten.
CREATE TABLE "ConversationState" (
    "conversationId" TEXT NOT NULL,
    "sessionStartId" TEXT NOT NULL,
    "state" JSONB NOT NULL,
    "throughId" TEXT NOT NULL,
    "throughAt" TIMESTAMP(3) NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConversationState_pkey" PRIMARY KEY ("conversationId")
);

ALTER TABLE "ConversationState"
ADD CONSTRAINT "ConversationState_conversationId_fkey"
FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
