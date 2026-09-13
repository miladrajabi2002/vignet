import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getCurrentUser } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { checkWorkspaceActive } from '@/lib/billing/entitlements'
import { dispatchProductEmbed } from '@/lib/queue/jobs'
import { cleanupProductMarkersFromMessages } from '@/lib/products/marker-cleanup'
import { cleanupProductIdsFromAutomations } from '@/lib/instagram/automation-cleanup'

export const dynamic = 'force-dynamic'

/**
 * Bulk-delete endpoints for products.
 *
 * GET  → returns { count } so the UI can show «۱۲۳ محصول حذف می‌شود»
 *        in the confirm dialog before the user commits.
 *
 * DELETE → soft-deletes ALL products in the workspace and returns the trashed
 * ids — the UI feeds them to /api/products/bulk/restore for the «بازگردانی»
 * (undo) snackbar. Rows are physically purged (with marker/automation/embed
 * cleanup below) by the worker after 7 days.
 *
 * The downstream cleanups run immediately so agent behavior stays correct
 * while the rows sit in the undo window:
 *   • dispatchProductEmbed(deleted:true) rebuilds per-agent vector stores
 *     without these products (restoring re-embeds them).
 *   • [[product:…]] markers are stripped from message history.
 *   • productIds are detached from Instagram automation scenarios.
 *
 * We trash in batches of 1000 (the Prisma limit for a single updateMany
 * without a sub-query) to avoid hitting Postgres' 65535 parameter limit on
 * stores with tens of thousands of products.
 */

const BATCH_SIZE = 1000

export async function GET() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  const count = await prisma.product.count({ where: { workspaceId: user.workspaceId } })
  return NextResponse.json({ count })
}

export async function DELETE(request: Request) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  if (!(await checkWorkspaceActive(user.workspaceId)).allowed) {
    return NextResponse.json({ error: 'PLAN_BLOCKED' }, { status: 402 })
  }

  // Scoped mode: when the body supplies ids, ONLY those products are
  // trashed (the selection bar on the products page). Without a body the
  // delete covers the whole workspace (the «حذف همه» button).
  const contentType = request.headers.get('content-type') ?? ''
  let scopedIds: string[] | null = null
  if (contentType.includes('application/json')) {
    const parsed = z
      .object({ ids: z.array(z.string().min(1).max(64)).min(1).max(20_000) })
      .safeParse(await request.json().catch(() => null))
    if (!parsed.success) {
      return NextResponse.json({ error: 'INVALID_INPUT' }, { status: 400 })
    }
    scopedIds = parsed.data.ids
  }

  // Capture the product IDs (and their assigned agent IDs) before we trash
  // them — we need the IDs to fire the embed-deletion jobs AFTER the rows are
  // gone. Without this, the per-agent vector store would still contain
  // deleted products until the next full rebuild.
  const products = await prisma.product.findMany({
    where: {
      workspaceId: user.workspaceId,
      ...(scopedIds ? { id: { in: scopedIds } } : {}),
    },
    select: {
      id: true,
      catalogItems: { select: { agentId: true } },
    },
  })
  if (products.length === 0) {
    return NextResponse.json({ ok: true, deleted: 0, ids: [] })
  }

  const agentIds = Array.from(
    new Set(products.flatMap((p) => p.catalogItems.map((c) => c.agentId))),
  )
  const productIds = products.map((p) => p.id)

  // Trash in batches to stay under Prisma's parameter limit. We use
  // `deleteMany` (soft-deleted by the extension) with a where clause instead
  // of `delete({ where: { id } })` in a loop because updateMany is a single SQL
  // statement and much faster on large catalogs.
  for (let i = 0; i < productIds.length; i += BATCH_SIZE) {
    const batch = productIds.slice(i, i + BATCH_SIZE)
    await prisma.product.deleteMany({
      where: { id: { in: batch } },
    })
  }

  // ── Clean up [[product:{…}]] markers from existing messages ──
  // See single-product DELETE for the rationale. Here we batch-strip
  // markers for every trashed product in one pass. (Restoring the products
  // later does NOT re-inject markers into history — old recommendation
  // bubbles degrade gracefully to plain text.)
  try {
    await cleanupProductMarkersFromMessages(user.workspaceId, productIds)
  } catch (e) {
    console.error('[products:bulk-delete] marker cleanup failed:', e)
  }

  // ── Clean up productIds from Instagram automation scenarios ──
  try {
    await cleanupProductIdsFromAutomations(user.workspaceId, new Set(productIds))
  } catch (e) {
    console.error('[products:bulk-delete] automation cleanup failed:', e)
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

  // Reset product access for agents whose access was never configured — only
  // relevant when the trash left the workspace with no live products at all
  // (mirrors the single-product delete route).
  const remainingProducts = await prisma.product.count({ where: { workspaceId: user.workspaceId } })
  if (remainingProducts === 0) {
    await prisma.agent.updateMany({
      where: { workspaceId: user.workspaceId, productAccessConfigured: false },
      data: { productAccessEnabled: false },
    })
  }

  return NextResponse.json({ ok: true, deleted: productIds.length, ids: productIds })
}

