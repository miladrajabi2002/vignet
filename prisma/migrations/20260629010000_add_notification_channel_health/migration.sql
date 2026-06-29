-- In-app notifications (bell), plus a dedup timestamp for channel-down alerts.

CREATE TYPE "NotificationType" AS ENUM ('NEW_MESSAGE', 'HANDOFF', 'CHANNEL_DOWN', 'LEARNING', 'SYSTEM');

CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "link" TEXT,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Notification_workspaceId_read_createdAt_idx" ON "Notification"("workspaceId", "read", "createdAt");

ALTER TABLE "Notification"
    ADD CONSTRAINT "Notification_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Track when a "channel silent" alert was last sent, to avoid re-alerting.
ALTER TABLE "AgentChannel" ADD COLUMN "healthAlertedAt" TIMESTAMP(3);
