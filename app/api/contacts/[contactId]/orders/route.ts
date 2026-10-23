import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getCurrentUser } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { markContactIdentified } from '@/lib/crm/customer'
import { MAX_PAY_ITEMS, payItemsTotal, readPayItems, type PayItem } from '@/lib/payments/card/items'

/**
 * Orders the owner records by hand on a customer's profile — a phone order,
 * an in-store sale. The AI reads the latest ones (lib/crm/customer-brief.ts).
 */

type Params = { params: Promise<{ contactId: string }> }

const createSchema = z.object({
  // Picked like a new payment's items: catalog products or typed lines.
  items: z.array(z.object({
    name: z.string().trim().min(1).max(120),
    quantity: z.number().int().min(1).max(999),
    unitPrice: z.number().int().min(0).max(100_000_000_000).nullable(),
    productId: z.string().max(64).nullish(),
  })).min(1).max(MAX_PAY_ITEMS),
  // Defaults to the items' total.
  amount: z.number().int().min(0).max(100_000_000_000).nullish(),
  orderedAt: z.string().datetime().optional(),
  note: z.string().trim().max(1000).nullish(),
})

const orderSelect = { id: true, title: true, items: true, amount: true, orderedAt: true, note: true } as const

/** «۲× مانتو مشکی، شال» — the line the AI and the lists read. */
function manualOrderTitle(items: PayItem[]): string {
  return items.map((item) => (item.quantity > 1 ? `${item.quantity}× ${item.name}` : item.name)).join('، ').slice(0, 160)
}

async function ownContact(workspaceId: string, contactId: string) {
  return prisma.contact.findFirst({ where: { id: contactId, workspaceId }, select: { id: true } })
}

export async function POST(req: Request, props: Params) {
  const params = await props.params
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  if (!(await ownContact(user.workspaceId, params.contactId)))
    return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 })

  const parsed = createSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'INVALID' }, { status: 400 })

  const items = readPayItems(parsed.data.items)
  if (!items.length) return NextResponse.json({ error: 'INVALID' }, { status: 400 })
  const itemsTotal = payItemsTotal(items)
  const order = await prisma.$transaction(async (tx) => {
    const created = await tx.contactManualOrder.create({
      data: {
        workspaceId: user.workspaceId,
        contactId: params.contactId,
        title: manualOrderTitle(items),
        items: items as unknown as object,
        amount: parsed.data.amount ?? (itemsTotal || null),
        orderedAt: parsed.data.orderedAt ? new Date(parsed.data.orderedAt) : new Date(),
        note: parsed.data.note || null,
      },
      select: orderSelect,
    })
    // Bought something: a customer.
    await markContactIdentified(tx, user.workspaceId, params.contactId)
    return created
  })
  return NextResponse.json({ order }, { status: 201 })
}

export async function DELETE(req: Request, props: Params) {
  const params = await props.params
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  const orderId = new URL(req.url).searchParams.get('id')?.slice(0, 64)
  if (!orderId) return NextResponse.json({ error: 'INVALID' }, { status: 400 })

  const deleted = await prisma.contactManualOrder.deleteMany({
    where: { id: orderId, contactId: params.contactId, workspaceId: user.workspaceId },
  })
  if (!deleted.count) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 })
  return NextResponse.json({ ok: true })
}
