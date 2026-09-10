ALTER TABLE "VigentoRun"
  ADD COLUMN "skillVersion" TEXT,
  ADD COLUMN "toolNames" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "principalKind" TEXT;

CREATE TYPE "VigentoUserMessageRole" AS ENUM ('USER', 'ASSISTANT');

CREATE TABLE "WorkspaceVigentoThread" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "actorId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WorkspaceVigentoThread_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WorkspaceVigentoMessage" (
  "id" TEXT NOT NULL,
  "threadId" TEXT NOT NULL,
  "role" "VigentoUserMessageRole" NOT NULL,
  "content" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WorkspaceVigentoMessage_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WorkspaceVigentoThread_workspaceId_actorId_key"
  ON "WorkspaceVigentoThread"("workspaceId", "actorId");
CREATE INDEX "WorkspaceVigentoThread_workspaceId_updatedAt_idx"
  ON "WorkspaceVigentoThread"("workspaceId", "updatedAt");
CREATE INDEX "WorkspaceVigentoThread_actorId_idx"
  ON "WorkspaceVigentoThread"("actorId");
CREATE INDEX "WorkspaceVigentoMessage_threadId_createdAt_idx"
  ON "WorkspaceVigentoMessage"("threadId", "createdAt");

ALTER TABLE "WorkspaceVigentoThread"
  ADD CONSTRAINT "WorkspaceVigentoThread_workspaceId_fkey"
  FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkspaceVigentoThread"
  ADD CONSTRAINT "WorkspaceVigentoThread_actorId_fkey"
  FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkspaceVigentoMessage"
  ADD CONSTRAINT "WorkspaceVigentoMessage_threadId_fkey"
  FOREIGN KEY ("threadId") REFERENCES "WorkspaceVigentoThread"("id") ON DELETE CASCADE ON UPDATE CASCADE;
