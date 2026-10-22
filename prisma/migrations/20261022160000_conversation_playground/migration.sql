-- Conversations started from the dashboard's «test the agent» panel are kept
-- out of the inbox, stats and alerts. That panel is the only caller of
-- /api/chat, which is the only writer of the API channel so far.
ALTER TABLE "Conversation" ADD COLUMN "isPlayground" BOOLEAN NOT NULL DEFAULT false;

UPDATE "Conversation" SET "isPlayground" = true WHERE "channel" = 'API';

-- Test chats that were handed off must not keep waiting in the operator queue.
UPDATE "HandoffAlert" SET "state" = 'resolved'
WHERE "state" = 'open' AND "conversationId" IN (SELECT "id" FROM "Conversation" WHERE "isPlayground" = true);
