import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { dispatchProductEmbed } from '@/lib/queue/jobs'

/**
 * Shared plumbing for the "بازگردانی" (undo) flow that follows every bulk
 * delete. The bulk DELETE routes soft-delete rows (via the Prisma extension)
 * and return their ids; the client keeps them for UNDO_WINDOW_MS and can POST
 * them to the matching …/restore route to bring them back.
 */

/** How long after the delete the restore endpoint still accepts the request. */
export const UNDO_WINDOW_MS = 5 * 60 * 1_000
/** Upper bound for one restore request (matches the bulk delete batch size). */
export const RESTORE_MAX_IDS = 20_000

export const restoreIdsSchema = z.object({
  ids: z.array(z.string().min(1).max(64)).min(1).max(RESTORE_MAX_IDS),
})

export interface SoftDeleteRestoreResult {
  ok: true
  restored: number
  skipped: number
}

interface SoftUpdateDelegate {
  updateMany(args: { where: unknown; data: { deletedAt: Date | null } }): Promise<{ count: number }>
}

/**
 * Restores soft-deleted rows for one workspace. Only rows trashed within the
 * last UNDO_WINDOW_MS are eligible — an old id cannot be "un-deleted" through
 * this endpoint.
 *
 * Rows whose unique key was reclaimed by a newer live row (e.g. the same
 * customer opened a fresh conversation, or Woo re-synced the same order while
 * the old one was trashed) are skipped gracefully instead of failing the
 * whole restore.
 */
export async function restoreSoftDeleted(
  model: 'contact' | 'conversation' | 'product' | 'storeOrder',
  workspaceId: string,
  ids: string[],
): Promise<SoftDeleteRestoreResult> {
  const cutoff = new Date(Date.now() - UNDO_WINDOW_MS)
  const delegate = prisma[model] as unknown as SoftUpdateDelegate
  const eligibility = {
    AND: [
      { deletedAt: { not: null } },
      { deletedAt: { gte: cutoff } },
    ],
  }

  try {
    const result = await delegate.updateMany({
      where: { id: { in: ids }, workspaceId, ...eligibility },
      data: { deletedAt: null },
    })
    return { ok: true, restored: result.count, skipped: ids.length - result.count }
  } catch (error) {
    // P2002: at least one trashed row now conflicts with a live row's unique
    // key (partial unique indexes only cover live rows). Fall back to a
    // per-row restore so the rest still come back.
    if (!(error instanceof Error) || !error.message.includes('P2002')) throw error
  }

  let restored = 0
  for (const id of ids) {
    try {
      const result = await delegate.updateMany({
        where: { id, workspaceId, ...eligibility },
        data: { deletedAt: null },
      })
      restored += result.count
    } catch {
      // Unique conflict on this row — skip it.
    }
  }
  return { ok: true, restored, skipped: ids.length - restored }
}

/**
 * After products come back from the trash their per-agent vector stores must
 * be rebuilt so the AI can recommend them again.
 */
export async function reembedRestoredProducts(workspaceId: string, ids: string[]): Promise<void> {
  if (ids.length === 0) return
  const products = await prisma.product.findMany({
    where: { id: { in: ids }, workspaceId },
    select: {
      id: true,
      catalogItems: { select: { agentId: true } },
    },
  })
  const agentIds = [...new Set(products.flatMap((product) => product.catalogItems.map((item) => item.agentId)))]
  for (const product of products) {
    try {
      await dispatchProductEmbed({
        productId: product.id,
        workspaceId,
        agentIds,
      })
    } catch (e) {
      console.error('[soft-delete-restore] embed dispatch failed:', e)
    }
  }
}
