-- Each workspace has exactly one owner account; workspace roles and team members
-- are no longer part of the product model.
ALTER TABLE "Workspace"
ADD COLUMN "excludeFromAdminReports" BOOLEAN NOT NULL DEFAULT false;

-- Preserve the existing platform-owner exclusion when switching to the explicit
-- workspace flag, so the migration does not temporarily leak internal activity.
UPDATE "Workspace" AS workspace
SET "excludeFromAdminReports" = true
WHERE EXISTS (
  SELECT 1
  FROM "User" AS owner
  WHERE owner."workspaceId" = workspace."id"
    AND owner."platformRole" = 'ADMIN'
);

ALTER TABLE "User" DROP COLUMN "role";
DROP TYPE "UserRole";

DROP INDEX IF EXISTS "User_workspaceId_idx";
CREATE UNIQUE INDEX "User_workspaceId_key" ON "User"("workspaceId");
CREATE INDEX "Workspace_excludeFromAdminReports_idx" ON "Workspace"("excludeFromAdminReports");
