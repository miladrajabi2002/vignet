import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'

/**
 * Platform-owner workspaces are internal accounts. Their test conversations,
 * agents, payments and AI usage must not affect customer/commercial reporting.
 *
 * The explicit workspace flag keeps this reporting decision independent from
 * account identity and authentication details.
 */
export const ADMIN_VISIBLE_WORKSPACE_WHERE = {
  excludeFromAdminReports: false,
} satisfies Prisma.WorkspaceWhereInput

export const ADMIN_VISIBLE_USER_WHERE = {
  workspace: ADMIN_VISIBLE_WORKSPACE_WHERE,
} satisfies Prisma.UserWhereInput

/** Scope a model which has a required `workspace` relation. */
export const ADMIN_VISIBLE_RELATED_WHERE = {
  workspace: ADMIN_VISIBLE_WORKSPACE_WHERE,
}

/** Scope raw reporting queries by a SQL expression containing a workspace id. */
export function adminVisibleWorkspaceSql(workspaceId: Prisma.Sql): Prisma.Sql {
  return Prisma.sql`
    EXISTS (
      SELECT 1
      FROM "Workspace" admin_scope_workspace
      WHERE admin_scope_workspace."id" = ${workspaceId}
        AND admin_scope_workspace."excludeFromAdminReports" = false
    )
  `
}

/** For workspace-id-only tables (for example ErrorLog) that have no relation. */
export async function getAdminHiddenWorkspaceIds(): Promise<string[]> {
  const rows = await prisma.workspace.findMany({
    where: { excludeFromAdminReports: true },
    select: { id: true },
  })
  return rows.map((row) => row.id)
}
