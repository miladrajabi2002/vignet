import { prisma } from '@/lib/prisma'

const DAY_MS = 24 * 60 * 60 * 1000

export const AUDIT_RETENTION_DAYS = 30
export const STORE_SYNC_SUCCESS_RETENTION_DAYS = 7
export const STORE_SYNC_ERROR_RETENTION_DAYS = 30
export const STORE_SYNC_LOGS_PER_INTEGRATION = 500
export const ORPHAN_WORKSPACE_GRACE_DAYS = 7

export interface CleanupResult {
  otpLogs: number
  errorLogs: number
  syncLogsByAge: number
  syncLogsOverCap: number
  orphanWorkspaces: number
}

/**
 * Keep high-volume audit data bounded and remove tenant data left behind by
 * the legacy account-deletion flow. The platform workspace and explicitly
 * hidden/internal workspaces are never considered orphan candidates.
 */
export async function cleanupOldRecords(now = new Date()): Promise<CleanupResult> {
  const auditCutoff = new Date(now.getTime() - AUDIT_RETENTION_DAYS * DAY_MS)
  const successCutoff = new Date(
    now.getTime() - STORE_SYNC_SUCCESS_RETENTION_DAYS * DAY_MS,
  )
  const syncErrorCutoff = new Date(
    now.getTime() - STORE_SYNC_ERROR_RETENTION_DAYS * DAY_MS,
  )

  const [otp, errors, syncLogsByAge] = await Promise.all([
    prisma.oTPLog.deleteMany({ where: { sentAt: { lt: auditCutoff } } }),
    prisma.errorLog.deleteMany({ where: { createdAt: { lt: auditCutoff } } }),
    prisma.storeSyncLog.deleteMany({
      where: {
        OR: [
          { outcome: 'ok', createdAt: { lt: successCutoff } },
          { createdAt: { lt: syncErrorCutoff } },
        ],
      },
    }),
  ])

  // Time retention handles normal traffic. This hard per-integration ceiling
  // also contains a webhook storm without loading millions of ids into Node.
  const syncLogsOverCap = await prisma.$executeRaw`
    WITH ranked AS (
      SELECT "id",
             ROW_NUMBER() OVER (
               PARTITION BY "integrationId"
               ORDER BY "createdAt" DESC, "id" DESC
             ) AS row_number
      FROM "StoreSyncLog"
    )
    DELETE FROM "StoreSyncLog" AS log
    USING ranked
    WHERE log."id" = ranked."id"
      AND ranked.row_number > ${STORE_SYNC_LOGS_PER_INTEGRATION}
  `

  const orphanCutoff = new Date(
    now.getTime() - ORPHAN_WORKSPACE_GRACE_DAYS * DAY_MS,
  )
  const configuredPlatformWorkspaceId = process.env.PLATFORM_WORKSPACE_ID?.trim()
  // The public blog resolver intentionally falls back to the oldest workspace
  // when PLATFORM_WORKSPACE_ID is unset. Mirror that fallback here so retention
  // can never erase platform content because of a missing environment value.
  const protectedWorkspaceId = configuredPlatformWorkspaceId || (
    await prisma.workspace.findFirst({
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    })
  )?.id
  const orphaned = await prisma.workspace.findMany({
    where: {
      owner: { is: null },
      excludeFromAdminReports: false,
      createdAt: { lt: orphanCutoff },
      ...(protectedWorkspaceId ? { id: { not: protectedWorkspaceId } } : {}),
    },
    select: { id: true },
    take: 100,
  })
  const orphanIds = orphaned.map((workspace) => workspace.id)
  const deletedOrphans = orphanIds.length
    ? await prisma.workspace.deleteMany({
        // Re-check ownerlessness on the destructive statement so a workspace
        // claimed between the read and delete is preserved.
        where: { id: { in: orphanIds }, owner: { is: null } },
      })
    : { count: 0 }

  return {
    otpLogs: otp.count,
    errorLogs: errors.count,
    syncLogsByAge: syncLogsByAge.count,
    syncLogsOverCap: Number(syncLogsOverCap),
    orphanWorkspaces: deletedOrphans.count,
  }
}
