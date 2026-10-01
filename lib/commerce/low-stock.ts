/**
 * Low-stock alerts: when a tracked product's stock falls to its alert level
 * (the product's own, else the workspace default), the owner hears once — in
 * the panel bell and the manager Telegram bot («موجودی کم محصول»). The mark
 * clears when stock is back above the level, so the next drop alerts again.
 * Untracked stock (null) never alerts; a level of 0 turns the alert off.
 */
import { prisma } from '@/lib/prisma'
import { notifyWorkspace } from '@/lib/notifications/create'
import { captureError } from '@/lib/errors/capture'

export const LOW_STOCK_MAX_THRESHOLD = 1000
const LIST_LIMIT = 6

interface LowStockRow {
  id: string
  workspaceId: string
  name: string
  stock: number
}

export function lowStockAlertText(rows: ReadonlyArray<Pick<LowStockRow, 'name' | 'stock'>>): { title: string; body: string } {
  const nf = new Intl.NumberFormat('fa-IR')
  const out = rows.filter((row) => row.stock <= 0).length
  const title = rows.length === 1
    ? (rows[0].stock <= 0 ? `«${rows[0].name}» تمام شد` : `موجودی «${rows[0].name}» کم شده`)
    : out === rows.length
      ? `${nf.format(rows.length)} محصول تمام شد`
      : `موجودی ${nf.format(rows.length)} محصول کم شده`
  const lines = rows.slice(0, LIST_LIMIT).map((row) =>
    `• ${row.name}: ${row.stock <= 0 ? 'ناموجود' : `${nf.format(row.stock)} عدد مانده`}`)
  if (rows.length > LIST_LIMIT) lines.push(`و ${nf.format(rows.length - LIST_LIMIT)} محصول دیگر`)
  return { title, body: lines.join('\n') }
}

/** One pass: re-arm recovered products, then claim and announce new drops. */
export async function sweepLowStockAlerts(): Promise<number> {
  // Back above the level (or no longer tracked): ready to alert again.
  await prisma.$executeRaw`
    UPDATE "Product" p
    SET "lowStockAlertedAt" = NULL
    FROM "Workspace" w
    WHERE p."workspaceId" = w.id
      AND p."lowStockAlertedAt" IS NOT NULL
      AND (p."stock" IS NULL OR p."stock" > COALESCE(p."lowStockThreshold", w."lowStockThreshold"))`

  // Claim in the same statement that selects, so two workers never both
  // announce the same drop.
  const rows = await prisma.$queryRaw<LowStockRow[]>`
    UPDATE "Product" p
    SET "lowStockAlertedAt" = NOW()
    FROM "Workspace" w
    WHERE p."workspaceId" = w.id
      AND p."active" = true
      AND p."deletedAt" IS NULL
      AND p."stock" IS NOT NULL
      AND p."lowStockAlertedAt" IS NULL
      AND COALESCE(p."lowStockThreshold", w."lowStockThreshold") > 0
      AND p."stock" <= COALESCE(p."lowStockThreshold", w."lowStockThreshold")
      AND p.id IN (
        SELECT p2.id FROM "Product" p2
        JOIN "Workspace" w2 ON w2.id = p2."workspaceId"
        WHERE p2."active" = true AND p2."deletedAt" IS NULL AND p2."stock" IS NOT NULL
          AND p2."lowStockAlertedAt" IS NULL
          AND COALESCE(p2."lowStockThreshold", w2."lowStockThreshold") > 0
          AND p2."stock" <= COALESCE(p2."lowStockThreshold", w2."lowStockThreshold")
        ORDER BY p2."stock" ASC
        LIMIT 500
      )
    RETURNING p.id, p."workspaceId", p.name, p."stock"`
  if (!rows.length) return 0

  const byWorkspace = new Map<string, LowStockRow[]>()
  for (const row of rows) {
    const list = byWorkspace.get(row.workspaceId) ?? []
    list.push(row)
    byWorkspace.set(row.workspaceId, list)
  }
  for (const [workspaceId, list] of byWorkspace) {
    list.sort((a, b) => a.stock - b.stock)
    const { title, body } = lowStockAlertText(list)
    await notifyWorkspace({
      workspaceId,
      type: 'SYSTEM',
      title,
      body,
      link: list.length === 1 ? `/products/${list[0].id}` : '/products?stock=low_stock',
      operatorTelegram: 'stock',
    }).catch((error) => captureError('commerce:low-stock-notify', error, { workspaceId }))
  }
  return rows.length
}
