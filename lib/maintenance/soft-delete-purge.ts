import { prismaRaw } from '@/lib/prisma'
import { dispatchProductEmbed } from '@/lib/queue/jobs'
import { cleanupProductMarkersFromMessages } from '@/lib/products/marker-cleanup'
import { cleanupProductIdsFromAutomations } from '@/lib/instagram/automation-cleanup'

/**
 * Physically removes soft-deleted rows whose undo window is long over.
 *
 * Retention: 7 days. Deleting in the UI stamps `deletedAt` (undo snackbar +
 * safety net); this sweeper is the only thing that actually drops the rows.
 *
 * Product purges also run the same downstream cleanups the hard-delete API
 * routes perform: strip `[[product:…]]` markers from message history, detach
 * product ids from Instagram automations, and rebuild the agents' vector
 * stores without the purged products.
 */

export const SOFT_DELETE_RETENTION_DAYS = 7
const PURGE_BATCH = 500
const MAX_PER_MODEL_PER_RUN = 10_000

export interface SoftDeletePurgeResult {
  contacts: number
  conversations: number
  products: number
  orders: number
}

interface SoftPurgeDelegate {
  findMany(args: { where: { deletedAt: { lt: Date } }; select: { id: true }; take: number }): Promise<Array<{ id: string }>>
  deleteMany(args: { where: { id: { in: string[] } } }): Promise<{ count: number }>
}

async function purgeModel(
  model: 'contact' | 'conversation' | 'product' | 'storeOrder',
  cutoff: Date,
  onBatch?: (ids: string[]) => Promise<void>,
): Promise<number> {
  // Union-typed delegates can't be called directly under strict TS — narrow
  // to the tiny structural slice this sweeper actually uses.
  const delegate = prismaRaw[model] as unknown as SoftPurgeDelegate
  let purged = 0
  while (purged < MAX_PER_MODEL_PER_RUN) {
    const rows = await delegate.findMany({
      where: { deletedAt: { lt: cutoff } },
      select: { id: true },
      take: PURGE_BATCH,
    })
    if (rows.length === 0) break
    const ids = rows.map((row) => row.id)
    if (onBatch) await onBatch(ids)
    // prismaRaw bypasses the soft-delete extension → real DELETE (cascades fire).
    const result = await delegate.deleteMany({ where: { id: { in: ids } } })
    purged += result.count
    if (rows.length < PURGE_BATCH) break
  }
  return purged
}

export async function purgeSoftDeleted(now = new Date()): Promise<SoftDeletePurgeResult> {
  const cutoff = new Date(now.getTime() - SOFT_DELETE_RETENTION_DAYS * 24 * 60 * 60 * 1_000)

  const [contacts, conversations, products, orders] = await Promise.all([
    purgeModel('contact', cutoff),
    purgeModel('conversation', cutoff),
    purgeModel('product', cutoff, async (ids) => {
      // Best-effort downstream cleanup — the purge itself must never fail
      // because a marker strip hiccuped.
      try {
        const workspaceIds = await prismaRaw.product.findMany({
          where: { id: { in: ids } },
          select: { id: true, workspaceId: true, catalogItems: { select: { agentId: true } } },
        })
        const byWorkspace = new Map<string, string[]>()
        for (const row of workspaceIds) {
          byWorkspace.set(row.workspaceId, [...(byWorkspace.get(row.workspaceId) ?? []), row.id])
        }
        for (const [workspaceId, productIds] of byWorkspace) {
          try {
            await cleanupProductMarkersFromMessages(workspaceId, productIds)
          } catch (e) {
            console.error('[soft-delete-purge] marker cleanup failed:', e)
          }
          try {
            await cleanupProductIdsFromAutomations(workspaceId, new Set(productIds))
          } catch (e) {
            console.error('[soft-delete-purge] automation cleanup failed:', e)
          }
          for (const productId of productIds) {
            try {
              await dispatchProductEmbed({
                productId,
                workspaceId,
                deleted: true,
              })
            } catch (e) {
              console.error('[soft-delete-purge] embed dispatch failed:', e)
            }
          }
        }
      } catch (e) {
        console.error('[soft-delete-purge] product cleanup lookup failed:', e)
      }
    }),
    purgeModel('storeOrder', cutoff),
  ])

  const total = contacts + conversations + products + orders
  if (total > 0) {
    console.log(
      `[soft-delete-purge] removed ${total} trashed row(s): ${contacts} contacts, ${conversations} conversations, ${products} products, ${orders} orders`,
    )
  }
  return { contacts, conversations, products, orders }
}
