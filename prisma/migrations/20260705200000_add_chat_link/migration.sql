-- Chat Link: public standalone chat page (/c/[slug]) per agent
CREATE TABLE "ChatLink" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "settings" JSONB,
    "views" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChatLink_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ChatLink_agentId_key" ON "ChatLink"("agentId");
CREATE UNIQUE INDEX "ChatLink_slug_key" ON "ChatLink"("slug");
CREATE INDEX "ChatLink_workspaceId_idx" ON "ChatLink"("workspaceId");

ALTER TABLE "ChatLink" ADD CONSTRAINT "ChatLink_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChatLink" ADD CONSTRAINT "ChatLink_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
