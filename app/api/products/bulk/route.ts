import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { checkWorkspaceActive } from '@/lib/billing/entitlements'
import { dispatchProductEmbed } from '@/lib/queue/jobs'

export const dynamic = 'force-dynamic'

/**
 * Bulk-delete endpoints for products.
 *
 * GET  → returns { count } so the UI can show «۱۲۳ محصول حذف می‌شود»
 *        in the confirm dialog before the user commits.
 *
 * DELETE → wipes ALL products in the workspace. Cascades automatically:
 *   • AgentCatalog rows (productId FK has onDelete: Cascade)
 *   • ProductQuery rows (productId FK has onDelete: Cascade)
 *   We also fire dispatchProductEmbed with deleted:true so the
 *   per-agent vector store is rebuilt without these products.
 *
 * We delete in batches of 1000 (the Prisma limit for a single
 * deleteMany without a sub-query) to avoid hitting Postgres' 65535
 * parameter limit on stores with tens of thousands of products.
 */

const BATCH_SIZE = 1000

export async function GET() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  const count = await prisma.product.count({ where: { workspaceId: user.workspaceId } })
  return NextResponse.json({ count })
}

export async function DELETE() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  if (!(await checkWorkspaceActive(user.workspaceId)).allowed) {
    return NextResponse.json({ error: 'PLAN_BLOCKED' }, { status: 402 })
  }

  // Capture all product IDs (and their assigned agent IDs) before we
  // delete them — we need the IDs to fire the embed-deletion jobs
  // AFTER the rows are gone. Without this, the per-agent vector store
  // would still contain deleted products until the next full rebuild.
  const products = await prisma.product.findMany({
    where: { workspaceId: user.workspaceId },
    select: {
      id: true,
      catalogItems: { select: { agentId: true } },
    },
  })
  if (products.length === 0) {
    return NextResponse.json({ ok: true, deleted: 0 })
  }

  const agentIds = Array.from(
    new Set(products.flatMap((p) => p.catalogItems.map((c) => c.agentId))),
  )
  const productIds = products.map((p) => p.id)

  // Delete in batches to stay under Prisma's parameter limit. We use
  // `deleteMany` with a where clause instead of `delete({ where: { id } })`
  // in a loop because deleteMany is a single SQL statement and is much
  // faster on large catalogs.
  let deleted = 0
  for (let i = 0; i < productIds.length; i += BATCH_SIZE) {
    const batch = productIds.slice(i, i + BATCH_SIZE)
    const result = await prisma.product.deleteMany({
      where: { id: { in: batch } },
    })
    deleted += result.count
  }

  // Fire a single embed-deletion job covering all agents + all deleted
  // products. The job is idempotent — re-running it is safe.
  for (const productId of productIds) {
    await dispatchProductEmbed({
      productId,
      workspaceId: user.workspaceId,
      agentIds,
      deleted: true,
    })
  }

  await prisma.agent.updateMany({
    where: { workspaceId: user.workspaceId, productAccessConfigured: false },
    data: { productAccessEnabled: false },
  })

  return NextResponse.json({ ok: true, deleted })
}
