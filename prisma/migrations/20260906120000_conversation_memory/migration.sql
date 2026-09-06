CREATE TABLE "ConversationMemory" (
    "conversationId" TEXT NOT NULL,
    "sessionStartId" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "throughId" TEXT NOT NULL,
    "throughAt" TIMESTAMP(3) NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ConversationMemory_pkey" PRIMARY KEY ("conversationId"),
    CONSTRAINT "ConversationMemory_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
