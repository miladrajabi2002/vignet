import { prisma } from '@/lib/prisma'

const DAY_MS = 24 * 60 * 60 * 1000

const AUDIT_RETENTION_DAYS = 30
const STORE_SYNC_SUCCESS_RETENTION_DAYS = 7
const STORE_SYNC_ERROR_RETENTION_DAYS = 30
export const STORE_SYNC_LOGS_PER_INTEGRATION = 500
const ORPHAN_WORKSPACE_GRACE_DAYS = 7
// Per-turn understanding readings: enough history for the admin report's
// 90-day view and for comparing a rollout, without growing forever.
const UNDERSTANDING_LOG_RETENTION_DAYS = 90
// Finished inbound events only guard against a provider redelivering the same
// webhook (hours, a day at most); two weeks is ample.
const INBOUND_EVENT_RETENTION_DAYS = 14
// A conversation's turn lease is recreated on its next message.
const IDLE_TURN_LEASE_DAYS = 7
// Big deletes go in slices so one run never holds long locks.
const DELETE_SLICE = 5_000
const MAX_SLICES_PER_RUN = 40

interface CleanupResult {
  otpLogs: number
  errorLogs: number
  syncLogsByAge: number
  syncLogsOverCap: number
  orphanWorkspaces: number
  understandingLogs: number
  inboundEvents: number
  turnLeases: number
}

/** Run a `DELETE … WHERE id IN (SELECT … LIMIT n)` until nothing is left (or the run cap). */
async function deleteInSlices(deleteSlice: () => Promise<number>): Promise<number> {
  let total = 0
  for (let slice = 0; slice < MAX_SLICES_PER_RUN; slice++) {
    const deleted = await deleteSlice()
    total += deleted
    if (deleted < DELETE_SLICE) break
  }
  return total
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

  const understandingCutoff = new Date(
    now.getTime() - UNDERSTANDING_LOG_RETENTION_DAYS * DAY_MS,
  )

  const [otp, errors, syncLogsByAge, understandingLogs] = await Promise.all([
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
    prisma.turnUnderstandingLog
      .deleteMany({ where: { createdAt: { lt: understandingCutoff } } })
      // The table arrives with the agent-core migration.
      .catch(() => ({ count: 0 })),
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

  const inboundCutoff = new Date(now.getTime() - INBOUND_EVENT_RETENTION_DAYS * DAY_MS)
  // Messages keep their text; their link to the event is set to NULL.
  const inboundEvents = await deleteInSlices(() => prisma.$executeRaw`
    DELETE FROM "InboundEvent"
    WHERE "id" IN (
      SELECT "id" FROM "InboundEvent"
      WHERE "state" IN ('COMPLETED', 'FAILED', 'DELIVERY_UNCERTAIN')
        AND "updatedAt" < ${inboundCutoff}
      LIMIT ${DELETE_SLICE}
    )`)

  const leaseCutoff = new Date(now.getTime() - IDLE_TURN_LEASE_DAYS * DAY_MS)
  // Only released or long-expired leases; the outer WHERE re-checks so a
  // lease taken between the two reads is kept.
  const turnLeases = await deleteInSlices(() => prisma.$executeRaw`
    DELETE FROM "ConversationTurnLease"
    WHERE "id" IN (
      SELECT "id" FROM "ConversationTurnLease"
      WHERE "updatedAt" < ${leaseCutoff}
      LIMIT ${DELETE_SLICE}
    )
      AND "updatedAt" < ${leaseCutoff}
      AND ("leaseExpiresAt" IS NULL OR "leaseExpiresAt" < ${now})`)

  return {
    otpLogs: otp.count,
    errorLogs: errors.count,
    syncLogsByAge: syncLogsByAge.count,
    syncLogsOverCap: Number(syncLogsOverCap),
    orphanWorkspaces: deletedOrphans.count,
    understandingLogs: understandingLogs.count,
    inboundEvents,
    turnLeases,
  }
}
