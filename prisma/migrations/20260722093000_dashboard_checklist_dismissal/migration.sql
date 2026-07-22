-- Persist the owner's "do not show again" choice across devices and sessions.
ALTER TABLE "Workspace"
ADD COLUMN "dashboardChecklistDismissedAt" TIMESTAMP(3);
