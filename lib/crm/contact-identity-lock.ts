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
    // pg_advisory_xact_lock returns PostgreSQL's `void` pseudo-type. Prisma 6
    // cannot deserialize that value through $queryRaw (P2010), so execute the
    // statement without asking Prisma to materialize a result column.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))`
    return operation(tx)
  })
}
