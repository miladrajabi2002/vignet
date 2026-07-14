import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'

/**
 * Serialize find-or-create for one tenant identity without requiring a risky
 * cleanup migration over existing CRM duplicates. PostgreSQL releases this
 * transaction-scoped advisory lock automatically on commit/rollback.
 */
export async function withContactIdentityLock<T>(
  workspaceId: string,
  identity: string,
  operation: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  const lockKey = `contact:${workspaceId}:${identity}`
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))`
    return operation(tx)
  })
}
