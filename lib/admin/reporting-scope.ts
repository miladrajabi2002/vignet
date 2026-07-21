import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'

/**
 * Platform-owner workspaces are internal accounts. Their test conversations,
 * agents, payments and AI usage must not affect customer/commercial reporting.
 *
 * The role is more stable than a name or phone number and is assigned from the
 * configured platform-owner phone during authentication.
 */
export const ADMIN_VISIBLE_WORKSPACE_WHERE = {
  users: { none: { platformRole: 'ADMIN' } },
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
    NOT EXISTS (
      SELECT 1
      FROM "User" admin_scope_user
      WHERE admin_scope_user."workspaceId" = ${workspaceId}
        AND admin_scope_user."platformRole" = 'ADMIN'
    )
  `
}

/** For workspace-id-only tables (for example ErrorLog) that have no relation. */
export async function getAdminHiddenWorkspaceIds(): Promise<string[]> {
  const rows = await prisma.workspace.findMany({
    where: { users: { some: { platformRole: 'ADMIN' } } },
    select: { id: true },
  })
  return rows.map((row) => row.id)
}
