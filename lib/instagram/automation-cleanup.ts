/**
 * Instagram automation cleanup utilities.
 *
 * When a product is deleted, its id may still be referenced in the
 * `productIds` array of PRODUCT_LIST messages inside InstagramAutomation
 * action JSON. Without cleanup, the automation still tries to show the
 * deleted product in the showcase — resulting in a card with no details
 * (resolveProduct returns null for missing products, so the card is
 * silently skipped, but the operator sees a "missing" slot in the form).
 *
 * This module strips deleted product IDs from automation action JSON.
 */

import { Prisma } from '@prisma/client'

/**
 * Remove a set of product IDs from every InstagramAutomation's action JSON
 * in the given workspace. Only PRODUCT_LIST messages are affected; all other
 * action fields are preserved.
 *
 * Returns the number of automation rows updated.
 */
export async function cleanupProductIdsFromAutomations(
  workspaceId: string,
  productIdsToRemove: Set<string>,
): Promise<number> {
  if (productIdsToRemove.size === 0) return 0

  const { prisma } = await import('@/lib/prisma')

  // Find automations that reference any of the deleted product IDs.
  // We use a LIKE filter on the action column to avoid scanning every row.
  const conditions: Prisma.Sql[] = []
  for (const id of productIdsToRemove) {
    conditions.push(Prisma.sql`a.action::text LIKE ${`%"${id}"%`}`)
  }

  const automations = await prisma.$queryRaw<{ id: string; action: unknown }[]>`
    SELECT id, action
    FROM "InstagramAutomation" a
    WHERE a."agentId" IN (
      SELECT id FROM "Agent" WHERE "workspaceId" = ${workspaceId}
    )
      AND (${Prisma.join(conditions, ' OR ')})
  `

  let updated = 0
  for (const auto of automations) {
    const action = auto.action as Record<string, unknown> | null
    if (!action || typeof action !== 'object') continue
    const messages = action.messages
    if (!Array.isArray(messages)) continue

    let changed = false
    const newMessages = messages.map((msg: unknown) => {
      if (!msg || typeof msg !== 'object') return msg
      const m = msg as Record<string, unknown>
      if (m.type !== 'PRODUCT_LIST') return msg
      const ids = m.productIds
      if (!Array.isArray(ids)) return msg
      const filtered = ids.filter(
        (id: unknown) => typeof id === 'string' && !productIdsToRemove.has(id),
      )
      if (filtered.length !== ids.length) {
        changed = true
        return { ...m, productIds: filtered }
      }
      return msg
    })

    if (changed) {
      await prisma.instagramAutomation.update({
        where: { id: auto.id },
        data: { action: { ...action, messages: newMessages } as Prisma.InputJsonValue },
      })
      updated += 1
    }
  }

  return updated
}
