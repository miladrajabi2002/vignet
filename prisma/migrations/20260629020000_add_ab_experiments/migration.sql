-- A/B prompt experiments + agent prompt/config version snapshots.

ALTER TABLE "Agent" ADD COLUMN "experimentActive" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Agent" ADD COLUMN "experimentVariantPrompt" TEXT;
ALTER TABLE "Agent" ADD COLUMN "experimentSplit" INTEGER NOT NULL DEFAULT 50;

ALTER TABLE "Conversation" ADD COLUMN "variant" TEXT;

CREATE TABLE "AgentVersion" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "systemPrompt" TEXT NOT NULL,
    "model" TEXT,
    "temperature" DOUBLE PRECISION NOT NULL DEFAULT 0.7,
    "maxTokens" INTEGER NOT NULL DEFAULT 1000,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentVersion_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AgentVersion_agentId_idx" ON "AgentVersion"("agentId");

ALTER TABLE "AgentVersion"
    ADD CONSTRAINT "AgentVersion_agentId_fkey"
    FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
